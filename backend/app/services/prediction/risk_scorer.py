"""
Weighted RiskScore computation.

Formula:
    RiskScore = 0.45 × delay_probability
              + 0.25 × anomaly_score
              + 0.20 × sla_criticality
              + 0.10 × weather_severity

All inputs and output are in [0.0, 1.0].
Thresholds: HIGH ≥ 0.70, MEDIUM ≥ 0.45, LOW < 0.45
"""

from dataclasses import dataclass
from enum import Enum


class RiskLevel(str, Enum):
    HIGH   = "HIGH"
    MEDIUM = "MEDIUM"
    LOW    = "LOW"


# Weights — must sum to 1.0
WEIGHT_DELAY   = 0.45
WEIGHT_ANOMALY = 0.25
WEIGHT_SLA     = 0.20
WEIGHT_WEATHER = 0.10

# Thresholds
HIGH_THRESHOLD   = 0.70
MEDIUM_THRESHOLD = 0.45


@dataclass
class RiskResult:
    score: float            # 0.0–1.0
    level: RiskLevel
    delay_probability: float
    anomaly_score: float
    sla_criticality: float
    weather_severity: float
    breakdown: dict         # component contributions for explainability


def compute_risk_score(
    delay_probability: float,
    anomaly_score: float,
    sla_criticality: float,
    weather_severity: float,
) -> RiskResult:
    """
    Compute weighted risk score and classify into HIGH/MEDIUM/LOW.

    Args:
        delay_probability: P(delay > 15min) from XGBoost [0, 1]
        anomaly_score:     IsolationForest deviation score [0, 1]
        sla_criticality:   How critical SLA breach would be [0, 1]
                           (1.0 = premium next-day, 0.0 = standard 5-day)
        weather_severity:  Current weather condition severity [0, 1]

    Returns:
        RiskResult with score, level, and per-component breakdown
    """
    # Clamp all inputs to [0, 1]
    delay_probability = float(max(0.0, min(1.0, delay_probability)))
    anomaly_score     = float(max(0.0, min(1.0, anomaly_score)))
    sla_criticality   = float(max(0.0, min(1.0, sla_criticality)))
    weather_severity  = float(max(0.0, min(1.0, weather_severity)))

    # Weighted sum
    score = (
        WEIGHT_DELAY   * delay_probability
        + WEIGHT_ANOMALY * anomaly_score
        + WEIGHT_SLA     * sla_criticality
        + WEIGHT_WEATHER * weather_severity
    )
    score = round(float(max(0.0, min(1.0, score))), 4)

    # Classify
    if score >= HIGH_THRESHOLD:
        level = RiskLevel.HIGH
    elif score >= MEDIUM_THRESHOLD:
        level = RiskLevel.MEDIUM
    else:
        level = RiskLevel.LOW

    # Breakdown for explainability — what drove the score?
    breakdown = {
        "delay_contribution":   round(WEIGHT_DELAY   * delay_probability, 4),
        "anomaly_contribution": round(WEIGHT_ANOMALY * anomaly_score, 4),
        "sla_contribution":     round(WEIGHT_SLA     * sla_criticality, 4),
        "weather_contribution": round(WEIGHT_WEATHER * weather_severity, 4),
    }

    return RiskResult(
        score=score,
        level=level,
        delay_probability=delay_probability,
        anomaly_score=anomaly_score,
        sla_criticality=sla_criticality,
        weather_severity=weather_severity,
        breakdown=breakdown,
    )