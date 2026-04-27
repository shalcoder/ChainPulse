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