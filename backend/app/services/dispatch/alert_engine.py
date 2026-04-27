"""
Alert Engine — threshold checks and optimization trigger.

On every GPS event:
1. Compute features
2. Score delay probability (XGBoost)
3. Score anomaly (IsolationForest)
4. Compute RiskScore
5. If HIGH → trigger OR-Tools optimizer → publish decision
6. Broadcast alert over WebSocket regardless of level
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


async def process_risk_and_trigger(
    vehicle_id: str,
    features: dict,
    weather_severity: float,
    hub_congestion: float,
    sla_criticality: float,
    websocket_manager,
    db_session=None,
) -> dict:
    """
    Full pipeline: predict → score → maybe optimize → broadcast.

    Returns the risk result dict.
    """
    from app.services.prediction.eta_model import predict_with_confidence
    from app.services.prediction.anomaly_model import score_anomaly
    from app.services.prediction.risk_scorer import compute_risk_score, RiskLevel

    # ── Step 1: ML predictions ────────────────────────────────────────────
    prediction = predict_with_confidence({
        **features,
        "weather_severity": weather_severity,
        "hub_congestion": hub_congestion,
    })
    delay_prob = prediction["delay_probability"]
    confidence_pct = prediction["confidence_pct"]
    model_used = prediction["model_used"]

    anomaly_score = score_anomaly(features)

    # ── Step 2: Risk score ────────────────────────────────────────────────
    risk_result = compute_risk_score(
        delay_probability=delay_prob,
        anomaly_score=anomaly_score,
        sla_criticality=sla_criticality,
        weather_severity=weather_severity,
    )

    # ── Step 3: Build and broadcast alert ────────────────────────────────
    alert = {
        "alert_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vehicle_id": vehicle_id,
        "risk_level": risk_result.level.value,
        "risk_score": risk_result.score,
        "reason_code": _dominant_reason(risk_result),
        "message": _build_message(vehicle_id, risk_result, weather_severity, hub_congestion),
        "acknowledged": False,
    }

    await websocket_manager.broadcast({
        "type": "RISK_ALERT",
        "payload": alert,
    })

    # ── Step 4: Trigger optimizer if HIGH risk ────────────────────────────
    if risk_result.level == RiskLevel.HIGH:
        logger.info(f"HIGH risk on {vehicle_id} (score={risk_result.score:.3f}) — triggering optimizer")
        await _trigger_optimization(
            vehicle_id=vehicle_id,
            risk_result=risk_result,
            weather_severity=weather_severity,
            hub_congestion=hub_congestion,
            websocket_manager=websocket_manager,
            db_session=db_session,
        )

    return {
        "vehicle_id": vehicle_id,
        "risk_score": risk_result.score,
        "risk_level": risk_result.level.value,
        "delay_probability": delay_prob,
        "anomaly_score": anomaly_score,
        "alert_id": alert["alert_id"],
        "confidence_pct": confidence_pct,
        "model_used": model_used,
    }


async def _trigger_optimization(
    vehicle_id: str,
    risk_result,
    weather_severity: float,
    hub_congestion: float,
    websocket_manager,
    db_session=None,
) -> None:
    """Run OR-Tools optimizer and publish decision."""
    try:
        from app.services.optimization.constraint_builder import build_routing_data
        from app.services.optimization.vrptw_solver import solve_vrptw
        from app.services.optimization.decision_publisher import (
            build_reason_code, compute_eta_delta,
            build_decision_record, publish_decision,
        )

        # Build minimal routing problem for this vehicle
        # In production this would pull real shipments from DB
        # For demo: use realistic synthetic data
        hubs = _demo_hubs()
        vehicles = [_demo_vehicle(vehicle_id)]
        shipments = _demo_shipments(vehicle_id)

        congestion = 1.0 + hub_congestion * 0.5  # 1.0–1.5x slowdown
        routing_data = build_routing_data(vehicles, shipments, hubs, congestion_factor=congestion)

        solver_result = solve_vrptw(routing_data, time_limit_seconds=8)

        # Find vehicle route FIRST before using it
        vehicle_route = next(
            (vr for vr in solver_result.vehicle_routes if vr.vehicle_id == vehicle_id),
            None,
        )
        if vehicle_route is None and solver_result.vehicle_routes:
            vehicle_route = solver_result.vehicle_routes[0]

        reason_code, reason_desc = build_reason_code(
            risk_score=risk_result.score,
            weather_severity=weather_severity,
            anomaly_score=risk_result.anomaly_score,  # from RiskResult dataclass
            hub_congestion=hub_congestion,
            sla_criticality=risk_result.sla_criticality,
        )

        original_eta = int((vehicle_route or _null_route(vehicle_id)).total_time_min * 1.35)
        eta_delta = compute_eta_delta(
            original_eta_min=original_eta,
            optimized_route=vehicle_route or _null_route(vehicle_id),
        )

        decision = build_decision_record(
            solver_result=solver_result,
            vehicle_id=vehicle_id,
            shipment_ids=[s["shipment_id"] for s in shipments],
            risk_score=risk_result.score,
            risk_level=risk_result.level.value,
            reason_code=reason_code,
            reason_description=reason_desc,
            eta_delta=eta_delta,
            triggered_by="AUTO",
        )

        await publish_decision(decision, websocket_manager, db_session)

    except Exception as e:
        logger.error(f"Optimization failed for {vehicle_id}: {e}", exc_info=True)


def _dominant_reason(risk_result) -> str:
    breakdown = risk_result.breakdown
    dominant = max(breakdown, key=breakdown.get)
    return {
        "delay_contribution":   "HIGH_DELAY_PROBABILITY",
        "anomaly_contribution": "ANOMALY_DETECTED",
        "sla_contribution":     "SLA_BREACH_RISK",
        "weather_contribution": "WEATHER_REROUTE",
    }.get(dominant, "HIGH_RISK_SCORE")


def _build_message(vehicle_id: str, risk_result, weather: float, congestion: float) -> str:
    parts = []
    if risk_result.delay_probability > 0.6:
        parts.append(f"delay prob {risk_result.delay_probability:.0%}")
    if risk_result.anomaly_score > 0.5:
        parts.append(f"anomaly score {risk_result.anomaly_score:.2f}")
    if weather > 0.5:
        parts.append(f"weather severity {weather:.2f}")
    if congestion > 0.6:
        parts.append(f"hub congestion {congestion:.2f}")
    detail = ", ".join(parts) if parts else f"risk score {risk_result.score:.2f}"
    return f"{vehicle_id} flagged — {detail}"


# ── Demo data helpers (fallback when DB not available) ────────────────────

def _demo_hubs():
    return [
        {"hub_id": "H1", "lat": 12.9716, "lng": 77.5946, "name": "MG Road"},
        {"hub_id": "H2", "lat": 12.9352, "lng": 77.6245, "name": "Koramangala"},
        {"hub_id": "H3", "lat": 12.9698, "lng": 77.7499, "name": "Whitefield"},
        {"hub_id": "H4", "lat": 13.0358, "lng": 77.5970, "name": "Hebbal"},
        {"hub_id": "H5", "lat": 12.8458, "lng": 77.6604, "name": "Electronic City"},
    ]


def _demo_vehicle(vehicle_id: str):
    return {
        "vehicle_id": vehicle_id,
        "depot_hub_id": "H1",
        "capacity_kg": 500,
        "current_load_kg": 0,
    }


def _demo_shipments(vehicle_id: str):
    import hashlib
    # Deterministic but varied positions based on vehicle_id
    seed = int(hashlib.md5(vehicle_id.encode()).hexdigest()[:8], 16)
    import random
    rng = random.Random(seed)
    return [
        {
            "shipment_id": f"{vehicle_id}-S1",
            "dest_lat": 12.85 + rng.random() * 0.25,
            "dest_lng": 77.45 + rng.random() * 0.30,
            "weight_kg": rng.randint(10, 100),
            "time_window_start": 0,
            "time_window_end": 300,
            "service_time_min": 10,
            "sla_priority": rng.choice(["HIGH", "MEDIUM", "CRITICAL"]),
        },
        {
            "shipment_id": f"{vehicle_id}-S2",
            "dest_lat": 12.85 + rng.random() * 0.25,
            "dest_lng": 77.45 + rng.random() * 0.30,
            "weight_kg": rng.randint(10, 80),
            "time_window_start": 0,
            "time_window_end": 300,
            "service_time_min": 8,
            "sla_priority": rng.choice(["MEDIUM", "LOW"]),
        },
    ]


class _null_route:
    def __init__(self, vehicle_id):
        self.vehicle_id = vehicle_id
        self.total_time_min = 45
        self.stops = []
        self.total_distance_km = 0
        self.dropped_shipment_ids = []