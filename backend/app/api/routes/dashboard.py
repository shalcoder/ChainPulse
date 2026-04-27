"""
Dashboard WebSocket endpoint + audit trail REST endpoint.

GET /dashboard/stream  — WebSocket, streams all decisions and alerts live
GET /dashboard/audit   — REST, returns last 50 audit records
GET /dashboard/health  — REST, returns system status
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_ws_manager
from app.services.dispatch.websocket_manager import WebSocketManager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/dashboard/stream")
async def dashboard_stream(
    websocket: WebSocket,
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    """
    WebSocket endpoint. Frontend connects here to receive live updates.
    Sends heartbeat every 30s to keep connection alive.
    """
    await ws_manager.connect(websocket)
    logger.info("Dashboard client connected")

    # Send immediate welcome + current system status
    await ws_manager.send_to(websocket, {
        "type": "CONNECTED",
        "payload": {
            "message": "ChainPulse Control Tower connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "connections": ws_manager.connection_count,
        }
    })

    try:
        while True:
            # Heartbeat every 30 seconds
            await asyncio.sleep(30)
            await ws_manager.send_to(websocket, {
                "type": "HEARTBEAT",
                "payload": {"timestamp": datetime.now(timezone.utc).isoformat()}
            })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        logger.info("Dashboard client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)


@router.get("/dashboard/audit")
async def get_audit_records(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Return last N audit records for the audit trail page."""
    try:
        from app.models.decisions import AuditRecord
        result = await db.execute(
            select(AuditRecord)
            .order_by(desc(AuditRecord.created_at))
            .limit(limit)
        )
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "event_type": r.action_type,
                "vehicle_id": r.vehicle_id,
                "shipment_id": r.shipment_id,
                "risk_score": r.context.get("risk_score") if r.context else None,
                "risk_level": r.context.get("risk_level") if r.context else None,
                "reason_code": r.context.get("reason_code") if r.context else None,
                "reason_description": r.summary,
                "action_taken": r.summary,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    except Exception as e:
        logger.error(f"Audit fetch error: {e}")
        return []


@router.get("/dashboard/health")
async def dashboard_health(ws_manager: WebSocketManager = Depends(get_ws_manager)):
    return {
        "status": "ok",
        "active_connections": ws_manager.connection_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Demo launcher ─────────────────────────────────────────────────────────────

_demo_running = False  # simple lock — only one demo at a time


async def _run_demo_sequence():
    """
    Runs the full 5-step demo sequence as a background coroutine.
    Calls /events and /optimize via internal HTTP so all WebSocket
    broadcasts fire exactly as they would from the real demo injector.
    """
    import httpx

    global _demo_running
    BASE = "http://localhost:8000"

    async def post_event(payload: dict):
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                await client.post(f"{BASE}/events", json=payload)
            except Exception as e:
                logger.error(f"Demo event error: {e}")

    async def force_optimize(vehicle_id: str, risk_score: float):
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                await client.post(f"{BASE}/optimize", json={
                    "vehicle_id": vehicle_id,
                    "risk_score": risk_score,
                    "risk_level": "HIGH",
                    "weather_severity": 0.90,
                    "hub_congestion": 0.85,
                    "sla_criticality": 0.95,
                    "anomaly_score": 0.70,
                })
            except Exception as e:
                logger.error(f"Demo optimize error: {e}")

    try:
        # Step 1 — Weather alerts on 3 vehicles
        await post_event({
            "event_type": "weather", "vehicle_id": "V003",
            "severity": 0.75, "weather_severity": 0.78,
            "hub_congestion": 0.40, "sla_criticality": 0.60,
            "lat": 12.9200, "lng": 77.6100, "source": "weather_sensor",
        })
        await asyncio.sleep(2)

        await post_event({
            "event_type": "weather", "vehicle_id": "V007",
            "severity": 0.82, "weather_severity": 0.85,
            "hub_congestion": 0.55, "sla_criticality": 0.70,
            "lat": 12.9100, "lng": 77.6300, "source": "weather_sensor",
        })
        await asyncio.sleep(2)

        await post_event({
            "event_type": "weather", "vehicle_id": "V012",
            "severity": 0.88, "weather_severity": 0.90,
            "hub_congestion": 0.65, "sla_criticality": 0.80,
            "lat": 12.9050, "lng": 77.6200, "source": "weather_sensor",
        })
        await asyncio.sleep(4)

        # Step 2 — GPS anomaly
        await post_event({
            "event_type": "gps", "vehicle_id": "V005",
            "severity": 0.70, "weather_severity": 0.20,
            "hub_congestion": 0.30, "sla_criticality": 0.75,
            "lat": 13.0500, "lng": 77.4800,
            "speed_kmh": 0, "dwell_time_min": 95.0,
            "route_deviation_m": 2800.0, "source": "gps_tracker",
        })
        await asyncio.sleep(3)

        # Step 3 — Hub congestion
        await post_event({
            "event_type": "warehouse", "vehicle_id": "V009",
            "severity": 0.85, "weather_severity": 0.30,
            "hub_congestion": 0.92, "sla_criticality": 0.85,
            "lat": 12.9352, "lng": 77.6245, "source": "hub_sensor",
        })
        await asyncio.sleep(3)

        # Step 4 — Critical event + force OR-Tools
        await post_event({
            "event_type": "weather", "vehicle_id": "V015",
            "severity": 0.99, "weather_severity": 0.97,
            "hub_congestion": 0.95, "sla_criticality": 0.99,
            "lat": 12.8900, "lng": 77.6500,
            "speed_kmh": 0, "dwell_time_min": 120.0,
            "route_deviation_m": 4000.0, "source": "demo_injector",
        })
        await asyncio.sleep(2)

        await force_optimize("V015", 0.92)
        await asyncio.sleep(4)
        await force_optimize("V005", 0.81)

    finally:
        _demo_running = False
        logger.info("Demo sequence completed")


@router.post("/demo/start")
async def start_demo():
    """
    Starts the 5-step live demo sequence as a background task.
    Returns immediately — events inject over the next ~25 seconds.
    Only one demo can run at a time.
    """
    global _demo_running
    if _demo_running:
        return {"status": "already_running", "message": "Demo is already in progress"}

    _demo_running = True
    # Fire-and-forget — asyncio.create_task schedules it on the running event loop
    asyncio.create_task(_run_demo_sequence())

    return {
        "status": "started",
        "message": "Demo sequence started — watch the dashboard for the next 25 seconds",
        "steps": [
            "Step 1 (0s)   — Weather alerts: V003, V007, V012",
            "Step 2 (8s)   — GPS anomaly: V005 dwell=95min deviation=2.8km",
            "Step 3 (11s)  — Hub congestion: Koramangala blocked, V009",
            "Step 4 (14s)  — CRITICAL: V015 → OR-Tools VRPTW reroute",
            "Step 5 (18s)  — Second reroute: V005 anomaly resolved",
        ],
    }