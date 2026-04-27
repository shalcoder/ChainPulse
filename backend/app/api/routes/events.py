"""
POST /events — ingest a single event and run the full pipeline.

This is what the demo_injector.py calls to inject disruptions.
Also what real IoT devices would POST to in production.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.api.deps import get_db, get_ws_manager
from app.services.dispatch.websocket_manager import WebSocketManager

router = APIRouter()
logger = logging.getLogger(__name__)


class EventPayload(BaseModel):
    event_type: str                          # "gps", "weather", "warehouse", "order"
    vehicle_id: str
    severity: float = Field(0.5, ge=0, le=1)
    lat: Optional[float] = None
    lng: Optional[float] = None
    speed_kmh: Optional[float] = None
    weather_severity: Optional[float] = None
    hub_congestion: Optional[float] = None
    sla_criticality: Optional[float] = 0.5
    source: str = "api"
    # Anomaly feature overrides for demo injection
    dwell_time_min: Optional[float] = None
    route_deviation_m: Optional[float] = None
    anomaly_score_override: Optional[float] = None


@router.post("/events")
async def ingest_event(
    payload: EventPayload,
    db=Depends(get_db),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    """
    Ingest event → run ML pipeline → broadcast results.
    This is the entry point for the entire sense→predict→optimize→execute flow.
    """
    from app.services.dispatch.alert_engine import process_risk_and_trigger

    logger.info(f"Event received: type={payload.event_type} vehicle={payload.vehicle_id} severity={payload.severity}")

    # Build feature dict from event
    features = {
        "route_length_km": 25.0,
        "historical_avg_min": 45.0,
        "hour_sin": 0.5,
        "hour_cos": 0.5,
        "dow_sin": 0.0,
        "dow_cos": 1.0,
        "vehicle_type": 1.0,
        "vehicle_age_years": 3.0,
        "recent_delay_rate": payload.severity * 0.8,
        "recent_avg_delay_min": payload.severity * 30,
        # Anomaly features
        "gps_interval_sec": 60,
        "speed_kmh": payload.speed_kmh or 30,
        "actual_distance_m": 500,
        "expected_distance_m": 500,
        "dwell_time_min": payload.dwell_time_min or 5,
        "route_deviation_m": payload.route_deviation_m or 100,
        "temperature_c": 25,
        "time_since_scan_min": 15,
        "signal_strength": 0.9,
        "speed_delta_kmh": 10,
    }

    weather = payload.weather_severity if payload.weather_severity is not None else (
        payload.severity if payload.event_type == "weather" else 0.1
    )
    congestion = payload.hub_congestion if payload.hub_congestion is not None else (
        payload.severity if payload.event_type == "warehouse" else 0.2
    )

    result = await process_risk_and_trigger(
        vehicle_id=payload.vehicle_id,
        features=features,
        weather_severity=weather,
        hub_congestion=congestion,
        sla_criticality=payload.sla_criticality or 0.5,
        websocket_manager=ws_manager,
        db_session=db,
    )

    # Also broadcast a vehicle position update so map marker changes color
    await ws_manager.broadcast({
        "type": "VEHICLE_UPDATE",
        "payload": {
            "vehicle_id": payload.vehicle_id,
            "lat": payload.lat or 12.9716,
            "lng": payload.lng or 77.5946,
            "speed_kmh": payload.speed_kmh or 0,
            "heading": 0,
            "status": "ANOMALY" if result["anomaly_score"] > 0.5 else "MOVING",
            "risk_score": result["risk_score"],
            "risk_level": result["risk_level"],
            "anomaly_score": result["anomaly_score"],
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    })

    return {
        "status": "processed",
        "event_type": payload.event_type,
        "vehicle_id": payload.vehicle_id,
        **result,
    }