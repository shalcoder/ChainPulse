"""
Phase 3 — Decision Publisher

Takes an OR-Tools SolverResult and publishes it as:
1. A RouteDecision record stored in PostgreSQL (audit trail)
2. A RiskAlert if the trigger score was HIGH
3. A WebSocket broadcast to the frontend dashboard

Also computes ETA delta (time saved by rerouting) for the demo display.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.services.optimization.vrptw_solver import SolverResult, VehicleRoute

logger = logging.getLogger(__name__)


# ── Reason code catalogue ─────────────────────────────────────────────────
# Each code maps to a human-readable explanation shown on the audit trail.
REASON_CODES = {
    "WEATHER_REROUTE":      "Rerouted due to severe weather event on original path",
    "ANOMALY_DETECTED":     "Anomalous vehicle behavior detected — route reassigned",
    "HUB_CONGESTION":       "Origin hub congestion exceeded threshold — alternate hub used",
    "SLA_BREACH_RISK":      "SLA breach probability exceeded threshold — expedited route",
    "HIGH_RISK_SCORE":      "Composite risk score exceeded HIGH threshold (≥0.70)",
    "CAPACITY_REBALANCE":   "Vehicle capacity exceeded — load redistributed across fleet",
    "MANUAL_OVERRIDE":      "Operator manually triggered route optimization",
    "DEMO_INJECTION":       "Demo disruption event injected for demonstration",
}


def build_reason_code(
    risk_score: float,
    weather_severity: float,
    anomaly_score: float,
    hub_congestion: float,
    sla_criticality: float,
) -> tuple[str, str]:
    """
    Select the most appropriate reason code based on which factor
    contributed most to the risk score. Returns (code, description).
    """
    # Pick the dominant trigger factor
    factors = {
        "WEATHER_REROUTE":  weather_severity * 0.10,
        "ANOMALY_DETECTED": anomaly_score * 0.25,
        "HUB_CONGESTION":   hub_congestion * 0.15,
        "SLA_BREACH_RISK":  sla_criticality * 0.20,
    }

    # Always label with HIGH_RISK_SCORE if score is above threshold
    if risk_score >= 0.70:
        dominant = max(factors, key=factors.get)
        # Combine: primary reason + risk score context
        description = (
            f"{REASON_CODES[dominant]} "
            f"[Risk Score: {risk_score:.2f}]"
        )
        return dominant, description

    dominant = max(factors, key=factors.get)
    return dominant, REASON_CODES[dominant]


def compute_eta_delta(
    original_eta_min: int,
    optimized_route: VehicleRoute,
) -> dict:
    """
    Compute time saved (or added) by the new route vs original ETA.

    Returns dict with old_eta, new_eta, delta_min, improved (bool).
    """
    new_eta_min = optimized_route.total_time_min
    delta_min = original_eta_min - new_eta_min

    return {
        "old_eta_min": original_eta_min,
        "new_eta_min": new_eta_min,
        "delta_min": delta_min,
        "improved": delta_min > 0,
        "time_saved_display": f"{abs(delta_min)} min {'saved' if delta_min > 0 else 'added'}",
    }


def build_decision_record(
    solver_result: SolverResult,
    vehicle_id: str,
    shipment_ids: list[str],
    risk_score: float,
    risk_level: str,
    reason_code: str,
    reason_description: str,
    eta_delta: dict,
    triggered_by: str = "AUTO",
) -> dict:
    """
    Build the complete decision record dict for storage and broadcast.

    This is what gets stored in PostgreSQL and sent over WebSocket.
    """
    decision_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Find the specific vehicle's route in the solution
    vehicle_route = None
    for vr in solver_result.vehicle_routes:
        if vr.vehicle_id == vehicle_id:
            vehicle_route = vr
            break

    route_stops = []
    if vehicle_route:
        route_stops = [
            {
                "location_id": stop.location_id,
                "location_name": stop.location_name,
                "arrival_time_min": stop.arrival_time_min,
                "shipment_id": stop.shipment_id,
            }
            for stop in vehicle_route.stops
        ]

    record = {
        "decision_id": decision_id,
        "timestamp": now,
        "vehicle_id": vehicle_id,
        "shipment_ids": shipment_ids,
        "solver_status": solver_result.status,
        "reason_code": reason_code,
        "reason_description": reason_description,
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "old_eta_min": eta_delta["old_eta_min"],
        "new_eta_min": eta_delta["new_eta_min"],
        "eta_delta_min": eta_delta["delta_min"],
        "time_saved_display": eta_delta["time_saved_display"],
        "route_stops": route_stops,
        "total_distance_km": solver_result.total_distance_km,
        "dropped_shipments": solver_result.dropped_shipments,
        "solve_time_ms": solver_result.solve_time_ms,
        "triggered_by": triggered_by,
        "objective_value": solver_result.objective_value,
    }

    return record


async def publish_decision(
    decision_record: dict,
    websocket_manager=None,
    db_session=None,
) -> str:
    """
    Publish the route decision:
    1. Store in PostgreSQL audit log
    2. Broadcast over WebSocket to frontend

    Returns the decision_id.
    """
    decision_id = decision_record["decision_id"]

    # ── Store in PostgreSQL ───────────────────────────────────────────────
    if db_session is not None:
        try:
            from app.models.decisions import AuditRecord
            import json

            audit = AuditRecord(
                id=decision_id,
                event_type="ROUTE_DECISION",
                vehicle_id=decision_record["vehicle_id"],
                shipment_id=decision_record["shipment_ids"][0]
                    if decision_record["shipment_ids"] else None,
                risk_score=decision_record["risk_score"],
                risk_level=decision_record["risk_level"],
                reason_code=decision_record["reason_code"],
                reason_description=decision_record["reason_description"],
                action_taken=f"Rerouted via OR-Tools VRPTW "
                             f"(status={decision_record['solver_status']})",
                payload=json.dumps(decision_record),
            )
            db_session.add(audit)
            await db_session.commit()
            logger.info(f"Decision {decision_id} stored in audit log")
        except Exception as e:
            logger.error(f"Failed to store decision in DB: {e}")

    # ── Broadcast over WebSocket ──────────────────────────────────────────
    if websocket_manager is not None:
        try:
            message = {
                "type": "ROUTE_DECISION",
                "payload": decision_record,
            }
            await websocket_manager.broadcast(message)
            logger.info(f"Decision {decision_id} broadcast over WebSocket")
        except Exception as e:
            logger.error(f"Failed to broadcast decision: {e}")

    logger.info(
        f"Decision published: vehicle={decision_record['vehicle_id']} "
        f"risk={decision_record['risk_level']} "
        f"reason={decision_record['reason_code']} "
        f"eta_saved={decision_record['eta_delta_min']}min"
    )

    return decision_id