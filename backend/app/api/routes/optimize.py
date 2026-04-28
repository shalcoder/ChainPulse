"""POST /optimize — run OR-Tools VRPTW on demand."""

import logging
import asyncio
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
    from app.services.prediction.eta_model import predict_with_confidence

    # Get confidence score from XGBoost
    prediction = predict_with_confidence({
        "weather_severity": req.weather_severity,
        "hub_congestion": req.hub_congestion,
        "recent_delay_rate": req.risk_score * 0.8,
        "route_length_km": 25.0,
        "historical_avg_min": 45.0,
        "hour_sin": 0.5, "hour_cos": 0.5,
        "dow_sin": 0.0, "dow_cos": 1.0,
        "vehicle_type": 1.0, "vehicle_age_years": 3.0,
        "recent_avg_delay_min": req.risk_score * 30,
    })
    confidence_pct = prediction["confidence_pct"]
    model_used = prediction["model_used"]

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
    decision["confidence_pct"] = confidence_pct
    decision["model_used"] = model_used

    await publish_decision(decision, ws_manager, db)

    # Feature 1: Trigger Gemini asynchronously to update the Decision Panel
    async def fetch_and_publish_gemini():
        try:
            from app.services.dispatch.gemini_narrator import generate_dispatch_instructions
            
            gemini_response = await generate_dispatch_instructions(decision)
            decision["gemini_driver_instruction"] = gemini_response.get("driver_instruction")
            decision["gemini_judge_explanation"] = gemini_response.get("judge_explanation")
            
            # Broadcast the enriched decision over WebSocket
            await ws_manager.broadcast({
                "type": "ROUTE_DECISION",
                "payload": decision
            })
        except Exception as e:
            logger.error(f"Gemini narrator failed: {e}")

    asyncio.create_task(fetch_and_publish_gemini())

    return {"status": "optimized", "decision": decision}