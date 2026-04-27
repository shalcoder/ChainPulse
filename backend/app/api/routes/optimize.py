"""POST /optimize — run OR-Tools VRPTW on demand."""

import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_db, get_ws_manager

router = APIRouter()
logger = logging.getLogger(__name__)


class OptimizeRequest(BaseModel):
    vehicle_id: str
    risk_score: float = 0.75
    risk_level: str = "HIGH"
    weather_severity: float = 0.3
    hub_congestion: float = 0.3
    sla_criticality: float = 0.5
    anomaly_score: float = 0.2


@router.post("/optimize")
async def optimize(
    req: OptimizeRequest,
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager),
):
    from app.services.dispatch.alert_engine import (
        _demo_hubs, _demo_vehicle, _demo_shipments, _null_route
    )
    from app.services.optimization.constraint_builder import build_routing_data
    from app.services.optimization.vrptw_solver import solve_vrptw
    from app.services.optimization.decision_publisher import (
        build_reason_code, compute_eta_delta,
        build_decision_record, publish_decision,
    )
    from app.services.prediction.risk_scorer import RiskResult, RiskLevel

    congestion_factor = 1.0 + req.hub_congestion * 0.5
    routing_data = build_routing_data(
        [_demo_vehicle(req.vehicle_id)],
        _demo_shipments(req.vehicle_id),
        _demo_hubs(),
        congestion_factor=congestion_factor,
    )

    solver_result = solve_vrptw(routing_data, time_limit_seconds=8)

    # Build a minimal risk result for reason code
    class _MockRisk:
        score = req.risk_score
        anomaly_score = req.anomaly_score
        sla_criticality = req.sla_criticality
        breakdown = {
            "delay_contribution": req.risk_score * 0.45,
            "anomaly_contribution": req.anomaly_score * 0.25,
            "sla_contribution": req.sla_criticality * 0.20,
            "weather_contribution": req.weather_severity * 0.10,
        }

    reason_code, reason_desc = build_reason_code(
        risk_score=req.risk_score,
        weather_severity=req.weather_severity,
        anomaly_score=req.anomaly_score,
        hub_congestion=req.hub_congestion,
        sla_criticality=req.sla_criticality,
    )

    vehicle_route = next(
        (vr for vr in solver_result.vehicle_routes if vr.vehicle_id == req.vehicle_id),
        solver_result.vehicle_routes[0] if solver_result.vehicle_routes else _null_route(req.vehicle_id),
    )

    original_eta = int(vehicle_route.total_time_min * 1.35)
    eta_delta = compute_eta_delta(original_eta_min=original_eta, optimized_route=vehicle_route)

    decision = build_decision_record(
        solver_result=solver_result,
        vehicle_id=req.vehicle_id,
        shipment_ids=[s["shipment_id"] for s in _demo_shipments(req.vehicle_id)],
        risk_score=req.risk_score,
        risk_level=req.risk_level,
        reason_code=reason_code,
        reason_description=reason_desc,
        eta_delta=eta_delta,
        triggered_by="API",
    )

    await publish_decision(decision, ws_manager, db)

    return {"status": "optimized", "decision": decision}