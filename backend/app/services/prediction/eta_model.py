"""
ETA/Delay prediction inference service.

Loads the trained XGBoost model once at startup.
Exposes predict(features) → delay_probability (0.0–1.0).
"""

import logging
import math
import pickle
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent.parent.parent / "ml" / "models" / "eta_model.pkl"

# Module-level cache — loaded once at startup
_model = None
_feature_cols = None


def load_model() -> None:
    """Load model from disk into module-level cache. Call once at startup."""
    global _model, _feature_cols
    if not MODEL_PATH.exists():
        logger.warning(
            f"ETA model not found at {MODEL_PATH}. "
            "Run backend/ml/train_eta_model.py first. Using fallback."
        )
        return
    with open(MODEL_PATH, "rb") as f:
        payload = pickle.load(f)
    _model = payload["model"]
    _feature_cols = payload["feature_cols"]
    logger.info(f"ETA model loaded from {MODEL_PATH}")


def predict_delay_probability(features: dict) -> float:
    """
    Predict probability of delay > 15 minutes.
    Returns float in [0.0, 1.0]. Falls back to heuristic if model not loaded.
    """
    result = predict_with_confidence(features)
    return result["delay_probability"]


def predict_with_confidence(features: dict) -> dict:
    """
    Full prediction with confidence score.

    Returns:
        dict with:
          delay_probability: float [0, 1]
          confidence_pct:    int [50, 99] — model certainty
          model_used:        "xgboost" | "heuristic"
    """
    if _model is None or _feature_cols is None:
        prob = _heuristic_delay_probability(features)
        # Heuristic confidence: how far from 0.5 the prediction is
        confidence = int(50 + abs(prob - 0.5) * 80)
        return {
            "delay_probability": prob,
            "confidence_pct": min(confidence, 92),
            "model_used": "heuristic",
        }

    import pandas as pd

    row = {col: features.get(col, 0.0) for col in _feature_cols}
    df = pd.DataFrame([row])

    proba = _model.predict_proba(df)[0]  # [prob_no_delay, prob_delay]
    prob = float(proba[1])

    # Confidence = how decisive the model is (distance from 50/50)
    # proba[0] + proba[1] = 1.0, so max confidence = 99% when one class = 1.0
    confidence = int(50 + abs(proba[1] - proba[0]) * 49)

    return {
        "delay_probability": prob,
        "confidence_pct": min(max(confidence, 51), 99),
        "model_used": "xgboost",
    }


def _heuristic_delay_probability(features: dict) -> float:
    """
    Fallback when model is not trained yet.
    Uses simple weighted formula so demo still works.
    """
    weather = features.get("weather_severity", 0.0)
    congestion = features.get("hub_congestion", 0.0)
    recent_delay = features.get("recent_delay_rate", 0.0)
    route_km = features.get("route_length_km", 20.0)

    prob = (
        0.05
        + 0.25 * weather
        + 0.20 * congestion
        + 0.15 * recent_delay
        + 0.10 * min(route_km / 100.0, 1.0)
    )
    return float(min(prob, 0.95))