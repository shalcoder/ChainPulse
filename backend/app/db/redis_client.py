"""
Async Redis client — hot state cache for the control tower.

Keys stored:
  vehicle:pos:{vehicle_id}      — Latest GPS position (TTL: 30s)
  vehicle:risk:{vehicle_id}     — Latest risk score breakdown (TTL: 60s)
  route:active:{vehicle_id}     — Active route waypoints (TTL: 3600s)
  hub:congestion:{hub_id}       — Hub congestion score (TTL: 120s)
  weather:active:{region_id}    — Active weather event (TTL: 3600s)
  lock:optimize:{vehicle_id}    — Distributed lock (TTL: 15s)

Why Redis for these:
  - Vehicle positions update every 2s — PostgreSQL writes would be too slow
  - Risk scores are read by every WebSocket push — needs sub-millisecond access
  - The distributed lock prevents duplicate optimization runs when multiple
    events arrive for the same vehicle in quick succession
"""

import json
from typing import Optional, Any
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings

# Module-level client — initialized at startup, shared across all coroutines
_redis_client: Optional[Redis] = None


async def init_redis() -> None:
    """Called at application startup (in main.py lifespan)."""
    global _redis_client
    _redis_client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
        health_check_interval=30,
    )
    # Test the connection
    await _redis_client.ping()


async def close_redis() -> None:
    """Called at application shutdown."""
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None


def get_redis() -> Redis:
    """Return the shared Redis client. Raises if not initialized."""
    if _redis_client is None:
        raise RuntimeError("Redis client not initialized. Call init_redis() first.")
    return _redis_client


# ── Vehicle Position Cache ────────────────────────────────────────────────────

async def set_vehicle_position(vehicle_id: str, position: dict[str, Any]) -> None:
    """
    Cache the latest GPS position for a vehicle.
    TTL=30s: if no GPS update in 30s, the vehicle is considered offline.
    """
    key = f"vehicle:pos:{vehicle_id}"
    await get_redis().setex(key, 30, json.dumps(position))


async def get_vehicle_position(vehicle_id: str) -> Optional[dict[str, Any]]:
    """Get cached vehicle position. Returns None if expired or not set."""
    key = f"vehicle:pos:{vehicle_id}"
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


async def get_all_vehicle_positions() -> dict[str, dict]:
    """
    Get all cached vehicle positions in one round trip using a pipeline.
    Used by the WebSocket broadcaster to push fleet state to the frontend.
    """
    redis = get_redis()
    keys = await redis.keys("vehicle:pos:*")
    if not keys:
        return {}

    pipe = redis.pipeline()
    for key in keys:
        pipe.get(key)
    values = await pipe.execute()

    result = {}
    for key, value in zip(keys, values):
        if value:
            vehicle_id = key.split(":")[-1]
            result[vehicle_id] = json.loads(value)
    return result


# ── Vehicle Risk Score Cache ──────────────────────────────────────────────────

async def set_vehicle_risk(vehicle_id: str, risk_data: dict[str, Any]) -> None:
    """Cache the latest risk breakdown for a vehicle. TTL=60s."""
    key = f"vehicle:risk:{vehicle_id}"
    await get_redis().setex(key, 60, json.dumps(risk_data))


async def get_vehicle_risk(vehicle_id: str) -> Optional[dict[str, Any]]:
    key = f"vehicle:risk:{vehicle_id}"
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


# ── Active Route Cache ────────────────────────────────────────────────────────

async def set_active_route(vehicle_id: str, route: dict[str, Any]) -> None:
    """Cache the active route for a vehicle. TTL=1 hour."""
    key = f"route:active:{vehicle_id}"
    await get_redis().setex(key, 3600, json.dumps(route))


async def get_active_route(vehicle_id: str) -> Optional[dict[str, Any]]:
    key = f"route:active:{vehicle_id}"
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


# ── Hub Congestion Cache ──────────────────────────────────────────────────────

async def set_hub_congestion(hub_id: str, congestion_score: float) -> None:
    """Cache hub congestion score. TTL=2 minutes."""
    key = f"hub:congestion:{hub_id}"
    await get_redis().setex(key, 120, str(congestion_score))


async def get_hub_congestion(hub_id: str) -> float:
    """Get hub congestion score. Returns 0.0 if not cached."""
    key = f"hub:congestion:{hub_id}"
    raw = await get_redis().get(key)
    return float(raw) if raw else 0.0


async def get_all_hub_congestion() -> dict[str, float]:
    """Get all hub congestion scores."""
    redis = get_redis()
    keys = await redis.keys("hub:congestion:*")
    if not keys:
        return {}

    pipe = redis.pipeline()
    for key in keys:
        pipe.get(key)
    values = await pipe.execute()

    return {
        key.split(":")[-1]: float(val)
        for key, val in zip(keys, values)
        if val is not None
    }


# ── Active Weather Cache ──────────────────────────────────────────────────────

async def set_active_weather(region_id: str, weather: dict[str, Any]) -> None:
    """Cache active weather event. TTL matches expected_duration_minutes."""
    ttl = weather.get("expected_duration_minutes", 60) * 60
    key = f"weather:active:{region_id}"
    await get_redis().setex(key, ttl, json.dumps(weather))


async def get_active_weather(region_id: str) -> Optional[dict[str, Any]]:
    key = f"weather:active:{region_id}"
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


async def get_all_active_weather() -> list[dict[str, Any]]:
    """Get all active weather events."""
    redis = get_redis()
    keys = await redis.keys("weather:active:*")
    if not keys:
        return []

    pipe = redis.pipeline()
    for key in keys:
        pipe.get(key)
    values = await pipe.execute()

    return [json.loads(v) for v in values if v is not None]


# ── Distributed Optimization Lock ─────────────────────────────────────────────

@asynccontextmanager
async def optimization_lock(vehicle_id: str, ttl: int = 15):
    """
    Distributed lock to prevent concurrent optimization runs for the same vehicle.

    If two HIGH risk alerts arrive within 15 seconds for the same vehicle,
    only the first one triggers OR-Tools. The second one is silently skipped.

    Usage:
        async with optimization_lock(vehicle_id) as acquired:
            if not acquired:
                return  # Another coroutine is already optimizing this vehicle
            # ... run OR-Tools ...
    """
    redis = get_redis()
    lock_key = f"lock:optimize:{vehicle_id}"
    # SET key value NX EX ttl — only sets if key doesn't exist
    acquired = await redis.set(lock_key, "1", nx=True, ex=ttl)
    try:
        yield bool(acquired)
    finally:
        if acquired:
            await redis.delete(lock_key)