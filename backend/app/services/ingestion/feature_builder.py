"""
Feature builder — transforms raw GPS events into ML-ready feature vectors.

Features computed:
  Temporal:   hour_sin, hour_cos, dow_sin, dow_cos (cyclical encoding)
  Spatial:    haversine distance from last position (GPS jump detection)
  Speed:      current, rolling mean, rolling std over last N events
  Vehicle:    fuel level, vehicle type (encoded), dwell time
  Context:    hub congestion (from Redis), weather severity (from Redis)
  History:    recent delay count, anomaly count

Why cyclical encoding for time?
  hour=23 and hour=0 are 1 hour apart in reality.
  Without cyclical encoding, a linear model sees them as 23 apart.
  sin(2π×23/24) ≈ sin(2π×0/24) — they're close in the encoded space.
"""

import asyncio
import math
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings
from app.models.events import GPSEvent

# Vehicle type encoding — must match the training script in Phase 2
VEHICLE_TYPE_ENCODING = {"truck": 0, "van": 1, "bike": 2}


class FeatureBuilder:
    """
    Maintains rolling state per vehicle and computes feature vectors.

    State is kept in memory (not Redis) because it's only needed for
    real-time inference and doesn't need to survive restarts.
    """

    def __init__(self) -> None:
        # Deque of recent (lat, lon, speed, timestamp) per vehicle
        self._history: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=settings.ROLLING_WINDOW_SIZE)
        )
        # Track when each vehicle last moved (for dwell time)
        self._last_moved_at: dict[str, datetime] = {}
        # Track recent anomaly flags per vehicle
        self._recent_anomalies: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=settings.ROLLING_WINDOW_SIZE)
        )
        # Track recent delay flags per vehicle
        self._recent_delays: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=settings.ROLLING_WINDOW_SIZE)
        )

    async def build_gps_features(self, event: GPSEvent) -> dict:
        """
        Build a flat feature dict from a GPS event.
        This dict is fed directly to XGBoost and IsolationForest.

        Returns a dict with all feature keys — missing values are 0.0.
        """
        vid = event.vehicle_id
        now = event.timestamp

        # ── Temporal features (cyclical) ──────────────────────────────────
        hour = now.hour
        dow = now.weekday()  # 0=Monday, 6=Sunday

        hour_sin = math.sin(2 * math.pi * hour / 24)
        hour_cos = math.cos(2 * math.pi * hour / 24)
        dow_sin = math.sin(2 * math.pi * dow / 7)
        dow_cos = math.cos(2 * math.pi * dow / 7)

        # ── Spatial features ──────────────────────────────────────────────
        history = self._history[vid]
        gps_jump_km = 0.0
        if history:
            last = history[-1]
            gps_jump_km = _haversine(
                last["lat"], last["lon"],
                event.latitude, event.longitude
            )

        # ── Speed features ────────────────────────────────────────────────
        speeds = [h["speed"] for h in history] if history else []
        speed_mean = sum(speeds) / len(speeds) if speeds else event.speed_kmh
        speed_std = _std(speeds) if len(speeds) > 1 else 0.0
        speed_delta = event.speed_kmh - speeds[-1] if speeds else 0.0

        # ── Dwell time ────────────────────────────────────────────────────
        dwell_minutes = 0.0
        if event.speed_kmh < 1.0:
            if vid not in self._last_moved_at:
                self._last_moved_at[vid] = now
            else:
                delta = (now - self._last_moved_at[vid]).total_seconds()
                dwell_minutes = delta / 60.0
        else:
            self._last_moved_at[vid] = now

        # ── Context features (from Redis) ─────────────────────────────────
        hub_congestion = await _get_hub_congestion_safe(event.current_hub_id)
        weather_severity = await _get_weather_severity_safe(
            event.latitude, event.longitude
        )

        # ── History features ──────────────────────────────────────────────
        recent_anomaly_count = sum(self._recent_anomalies[vid])
        recent_delay_count = sum(self._recent_delays[vid])

        # ── Vehicle type encoding ─────────────────────────────────────────
        # vehicle_type comes from the Vehicle DB record; default to truck
        vehicle_type_encoded = VEHICLE_TYPE_ENCODING.get("truck", 0)

        # ── Update history ────────────────────────────────────────────────
        self._history[vid].append({
            "lat": event.latitude,
            "lon": event.longitude,
            "speed": event.speed_kmh,
            "timestamp": now,
        })

        return {
            # Temporal
            "hour_sin": round(hour_sin, 6),
            "hour_cos": round(hour_cos, 6),
            "dow_sin": round(dow_sin, 6),
            "dow_cos": round(dow_cos, 6),
            # Spatial
            "gps_jump_km": round(gps_jump_km, 4),
            # Speed
            "speed_kmh": round(event.speed_kmh, 2),
            "speed_mean": round(speed_mean, 2),
            "speed_std": round(speed_std, 2),
            "speed_delta": round(speed_delta, 2),
            # Vehicle state
            "fuel_level_pct": round(event.fuel_level_pct, 2),
            "dwell_minutes": round(dwell_minutes, 2),
            "vehicle_type_encoded": vehicle_type_encoded,
            # Context
            "hub_congestion": round(hub_congestion, 4),
            "weather_severity": round(weather_severity, 4),
            # History
            "recent_anomaly_count": recent_anomaly_count,
            "recent_delay_count": recent_delay_count,
            # Raw coords (for anomaly spatial check)
            "latitude": event.latitude,
            "longitude": event.longitude,
        }

    def record_anomaly(self, vehicle_id: str, is_anomaly: bool) -> None:
        """Called by anomaly model to update rolling anomaly history."""
        self._recent_anomalies[vehicle_id].append(1 if is_anomaly else 0)

    def record_delay(self, vehicle_id: str, is_delayed: bool) -> None:
        """Called by ETA model to update rolling delay history."""
        self._recent_delays[vehicle_id].append(1 if is_delayed else 0)


# ── Helper functions ──────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Haversine formula — great-circle distance between two GPS points in km.
    Used to detect GPS jumps (sudden large position changes = anomaly).
    """
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _std(values: list[float]) -> float:
    """Population standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return math.sqrt(variance)


async def _get_hub_congestion_safe(hub_id: Optional[str]) -> float:
    """Get hub congestion from Redis. Returns 0.0 on any error."""
    if not hub_id:
        return 0.0
    try:
        from app.db.redis_client import get_hub_congestion
        return await get_hub_congestion(hub_id)
    except Exception:
        return 0.0


async def _get_weather_severity_safe(lat: float, lon: float) -> float:
    """
    Get weather severity for the vehicle's current position.
    Checks all active weather events and returns the max severity
    if the vehicle is within the weather event's radius.
    Returns 0.0 on any error.
    """
    try:
        from app.db.redis_client import get_all_active_weather
        weather_events = await get_all_active_weather()
        max_severity = 0.0
        for we in weather_events:
            if we.get("latitude") and we.get("longitude"):
                dist = _haversine(lat, lon, we["latitude"], we["longitude"])
                if dist <= we.get("radius_km", 50.0):
                    max_severity = max(max_severity, we.get("severity_score", 0.0))
        return max_severity
    except Exception:
        return 0.0