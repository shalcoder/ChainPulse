"""
Anomaly detection inference service.

Loads the trained IsolationForest model once at startup.
Exposes score(event_features) → anomaly_score (0.0–1.0).
"""

import logging
import pickle
from pathlib import Path

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent.parent.parent / "ml" / "models" / "anomaly_model.pkl"

_model = None
_scaler = None
_feature_cols = None


def load_model() -> None:
    """Load model from disk. Call once at startup."""
    global _model, _scaler, _feature_cols
    if not MODEL_PATH.exists():
        logger.warning(
            f"Anomaly model not found at {MODEL_PATH}. "
            "Run backend/ml/train_anomaly_model.py first. Using fallback."
        )
        return
    with open(MODEL_PATH, "rb") as f:
        payload = pickle.load(f)
    _model = payload["model"]
    _scaler = payload["scaler"]
    _feature_cols = payload["feature_cols"]
    logger.info(f"Anomaly model loaded from {MODEL_PATH}")


def score_anomaly(event_features: dict) -> float:
    """
    Score how anomalous an event is.

    Returns:
        float in [0.0, 1.0] where 1.0 = highly anomalous.
        Falls back to heuristic if model not loaded.
    """
    if _model is None or _scaler is None or _feature_cols is None:
        return _heuristic_anomaly_score(event_features)

    import pandas as pd
    import numpy as np

    row = {col: event_features.get(col, 0.0) for col in _feature_cols}
    df = pd.DataFrame([row])
    scaled = _scaler.transform(df)

    # decision_function: negative = anomalous, positive = normal
    # Typical range: [-0.5, 0.5]
    raw_score = float(_model.decision_function(scaled)[0])

    # Normalize to [0, 1]: invert and scale
    # score of -0.5 → anomaly_score ~1.0
    # score of +0.5 → anomaly_score ~0.0
    anomaly_score = float(max(0.0, min(1.0, (-raw_score + 0.3) / 0.6)))
    return anomaly_score


def _heuristic_anomaly_score(event_features: dict) -> float:
    """
    Fallback heuristic when model is not yet trained.
    """
    score = 0.0

    # GPS jump
    actual = event_features.get("actual_distance_m", 0)
    expected = event_features.get("expected_distance_m", 1)
    if expected > 0 and actual / expected > 5:
        score += 0.4

    # Long dwell
    dwell = event_features.get("dwell_time_min", 0)
    if dwell > 60:
        score += 0.3

    # Temperature excursion
    temp = event_features.get("temperature_c", 20)
    if temp > 15 or temp < 0:
        score += 0.3

    return float(min(score, 1.0))