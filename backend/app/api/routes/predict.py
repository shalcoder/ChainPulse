"""POST /predict — run ETA + anomaly prediction on demand."""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)


class PredictRequest(BaseModel):
    vehicle_id: str
    route_length_km: float = 25.0
    historical_avg_min: float = 45.0
    weather_severity: float = 0.0
    hub_congestion: float = 0.0
    vehicle_type: float = 1.0
    vehicle_age_years: float = 3.0
    recent_delay_rate: float = 0.0
    recent_avg_delay_min: float = 0.0
    hour_of_day: int = 12
    day_of_week: int = 1
    # Anomaly features
    speed_kmh: float = 40.0
    dwell_time_min: float = 5.0
    route_deviation_m: float = 100.0
    sla_criticality: float = 0.5


@router.post("/predict")
async def predict(req: PredictRequest):
    import math
    from app.services.prediction.eta_model import predict_delay_probability
    from app.services.prediction.anomaly_model import score_anomaly
    from app.services.prediction.risk_scorer import compute_risk_score

    features = {
        "route_length_km": req.route_length_km,
        "historical_avg_min": req.historical_avg_min,
        "hour_sin": math.sin(2 * math.pi * req.hour_of_day / 24),
        "hour_cos": math.cos(2 * math.pi * req.hour_of_day / 24),
        "dow_sin": math.sin(2 * math.pi * req.day_of_week / 7),
        "dow_cos": math.cos(2 * math.pi * req.day_of_week / 7),
        "weather_severity": req.weather_severity,
        "hub_congestion": req.hub_congestion,
        "vehicle_type": req.vehicle_type,
        "vehicle_age_years": req.vehicle_age_years,
        "recent_delay_rate": req.recent_delay_rate,
        "recent_avg_delay_min": req.recent_avg_delay_min,
        "gps_interval_sec": 60,
        "speed_kmh": req.speed_kmh,
        "actual_distance_m": req.speed_kmh * 60 / 3.6,
        "expected_distance_m": req.speed_kmh * 60 / 3.6,
        "dwell_time_min": req.dwell_time_min,
        "route_deviation_m": req.route_deviation_m,
        "temperature_c": 25,
        "time_since_scan_min": 15,
        "signal_strength": 0.9,
        "speed_delta_kmh": 5,
    }

    delay_prob = predict_delay_probability(features)
    anomaly_score = score_anomaly(features)
    risk = compute_risk_score(
        delay_probability=delay_prob,
        anomaly_score=anomaly_score,
        sla_criticality=req.sla_criticality,
        weather_severity=req.weather_severity,
    )

    return {
        "vehicle_id": req.vehicle_id,
        "delay_probability": round(delay_prob, 4),
        "anomaly_score": round(anomaly_score, 4),
        "risk_score": risk.score,
        "risk_level": risk.level.value,
        "breakdown": risk.breakdown,
    }