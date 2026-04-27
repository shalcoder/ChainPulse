"""
Phase 2 — XGBoost ETA/Delay Prediction Training Script

Generates synthetic operational training data and trains an XGBoost
classifier that predicts P(delay > 15 minutes) for a given shipment.

Output: backend/ml/models/eta_model.pkl
"""

import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split

# ── Paths ──────────────────────────────────────────────────────────────────
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)
MODEL_PATH = MODELS_DIR / "eta_model.pkl"

# ── Reproducibility ────────────────────────────────────────────────────────
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

N_SAMPLES = 50_000  # Enough for XGBoost to learn meaningful patterns


def generate_training_data(n: int) -> pd.DataFrame:
    """
    Generate realistic synthetic operational features.
    Each row = one shipment leg observation.
    """
    rng = np.random.default_rng(RANDOM_SEED)

    # ── Core route features ────────────────────────────────────────────────
    route_length_km = rng.uniform(5, 150, n)          # Bengaluru metro scale
    historical_avg_min = route_length_km * rng.uniform(1.5, 3.5, n)  # min/km varies

    # ── Temporal features (raw — will be cyclically encoded) ───────────────
    hour_of_day = rng.integers(0, 24, n)
    day_of_week = rng.integers(0, 7, n)               # 0=Mon, 6=Sun

    # ── Cyclical encoding: sin/cos so model sees 23→0 as adjacent ──────────
    hour_sin = np.sin(2 * np.pi * hour_of_day / 24)
    hour_cos = np.cos(2 * np.pi * hour_of_day / 24)
    dow_sin  = np.sin(2 * np.pi * day_of_week / 7)
    dow_cos  = np.cos(2 * np.pi * day_of_week / 7)

    # ── External condition features ────────────────────────────────────────
    weather_severity  = rng.uniform(0, 1, n)          # 0=clear, 1=severe storm
    hub_congestion    = rng.uniform(0, 1, n)          # 0=empty, 1=blocked

    # ── Vehicle features ───────────────────────────────────────────────────
    # 0=motorcycle, 1=van, 2=truck, 3=refrigerated
    vehicle_type      = rng.integers(0, 4, n).astype(float)
    vehicle_age_years = rng.uniform(0, 10, n)

    # ── Recent history features ────────────────────────────────────────────
    recent_delay_rate = rng.uniform(0, 1, n)          # fraction of last 5 trips delayed
    recent_avg_delay_min = rng.uniform(0, 45, n)      # avg delay in minutes recently

    # ── Label generation: realistic causal model ───────────────────────────
    # Each factor contributes additively to delay probability
    base_delay_prob = (
        0.05                                           # baseline ~5% delay
        + 0.15 * (route_length_km / 150)              # longer = more risky
        + 0.20 * weather_severity                     # weather is big factor
        + 0.15 * hub_congestion                       # hub blockage
        + 0.10 * recent_delay_rate                    # vehicle history
        + 0.08 * (vehicle_age_years / 10)             # older vehicles
        # Peak hours: 8-10am and 5-8pm increase delay
        + 0.12 * np.where(
            ((hour_of_day >= 8) & (hour_of_day <= 10)) |
            ((hour_of_day >= 17) & (hour_of_day <= 20)),
            1.0, 0.0
        )
        # Trucks are slower in traffic
        + 0.05 * (vehicle_type == 2).astype(float)
    )

    # Clip to valid probability range and add noise
    base_delay_prob = np.clip(base_delay_prob, 0.02, 0.97)
    noise = rng.uniform(-0.05, 0.05, n)
    final_prob = np.clip(base_delay_prob + noise, 0.0, 1.0)

    # Binary label: 1 = delayed >15 min
    delayed = (rng.uniform(0, 1, n) < final_prob).astype(int)

    df = pd.DataFrame({
        "route_length_km":       route_length_km,
        "historical_avg_min":    historical_avg_min,
        "hour_sin":              hour_sin,
        "hour_cos":              hour_cos,
        "dow_sin":               dow_sin,
        "dow_cos":               dow_cos,
        "weather_severity":      weather_severity,
        "hub_congestion":        hub_congestion,
        "vehicle_type":          vehicle_type,
        "vehicle_age_years":     vehicle_age_years,
        "recent_delay_rate":     recent_delay_rate,
        "recent_avg_delay_min":  recent_avg_delay_min,
        "delayed":               delayed,
    })

    return df


def train() -> None:
    print(f"Generating {N_SAMPLES:,} synthetic training samples...")
    df = generate_training_data(N_SAMPLES)

    feature_cols = [c for c in df.columns if c != "delayed"]
    X = df[feature_cols]
    y = df["delayed"]

    print(f"Class balance: {y.mean():.1%} delayed")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    # ── XGBoost with class weight balancing ───────────────────────────────
    # scale_pos_weight handles class imbalance automatically
    neg_count = (y_train == 0).sum()
    pos_count = (y_train == 1).sum()
    scale_pos_weight = neg_count / pos_count if pos_count > 0 else 1.0

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        use_label_encoder=False,
        eval_metric="auc",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )

    print("Training XGBoost ETA model...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    # ── Evaluation ────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_prob)

    print("\n── Evaluation Results ──")
    print(f"AUC-ROC: {auc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["on_time", "delayed"]))

    # ── Feature importance ────────────────────────────────────────────────
    print("── Feature Importances ──")
    importance = dict(zip(feature_cols, model.feature_importances_))
    for feat, imp in sorted(importance.items(), key=lambda x: -x[1]):
        print(f"  {feat:30s}: {imp:.4f}")

    # ── Save model + feature list ─────────────────────────────────────────
    # We save both model and feature_cols so inference always uses same order
    payload = {"model": model, "feature_cols": feature_cols}
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(payload, f)

    print(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    train()