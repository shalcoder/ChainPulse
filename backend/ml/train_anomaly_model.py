"""
Phase 2 — IsolationForest Anomaly Detection Training Script

Trains on normal operational patterns. At inference time, unusual events
(GPS jumps, long dwells, route deviations, temperature excursions) get
high anomaly scores.

Output: backend/ml/models/anomaly_model.pkl
"""

import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# ── Paths ──────────────────────────────────────────────────────────────────
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)
MODEL_PATH = MODELS_DIR / "anomaly_model.pkl"

RANDOM_SEED = 42
N_SAMPLES = 30_000  # Normal operational observations


def generate_normal_events(n: int) -> pd.DataFrame:
    """
    Generate synthetic NORMAL GPS/operational events.
    The model learns this distribution and flags deviations.

    Features capture five anomaly types we care about:
    1. GPS jumps — sudden large position changes
    2. Dwell time anomalies — stopped far too long
    3. Speed anomalies — impossibly fast or stationary when moving
    4. Route deviation — distance from expected path
    5. Temperature excursion — for cold chain vehicles
    """
    rng = np.random.default_rng(RANDOM_SEED)

    # Normal GPS update interval: 30s-5min
    gps_interval_sec = rng.uniform(30, 300, n)

    # Normal speed: 0-80 km/h in urban/highway mix
    speed_kmh = rng.uniform(0, 80, n)

    # Distance moved since last ping: consistent with speed × interval
    expected_distance_m = (speed_kmh / 3.6) * gps_interval_sec
    actual_distance_m = expected_distance_m * rng.uniform(0.8, 1.2, n)  # ±20% normal

    # Dwell time: how long stopped at current location (minutes)
    # Normal: 0-30min for traffic/stops
    dwell_time_min = rng.exponential(scale=8, size=n)
    dwell_time_min = np.clip(dwell_time_min, 0, 30)

    # Route deviation: distance from planned path (meters)
    # Normal: 0-500m for GPS accuracy + minor detours
    route_deviation_m = rng.exponential(scale=100, size=n)
    route_deviation_m = np.clip(route_deviation_m, 0, 500)

    # Temperature (for cold chain): normal is 2-8°C
    # Non-cold-chain vehicles get room temp ~20-30°C
    is_cold_chain = rng.random(n) < 0.3
    temperature_c = np.where(
        is_cold_chain,
        rng.uniform(2, 8, n),        # cold chain normal range
        rng.uniform(20, 30, n)       # ambient for others
    )

    # Time since last scan (warehouse/hub scan events), minutes
    # Normal: scanned every 15-60 min at hubs
    time_since_scan_min = rng.uniform(0, 60, n)

    # Signal strength proxy (RSSI-like): 0=no signal, 1=full
    signal_strength = rng.uniform(0.6, 1.0, n)  # normal: good signal

    # Acceleration proxy: how sharply speed changed
    # Normal: gradual changes
    speed_delta_kmh = rng.uniform(0, 20, n)

    df = pd.DataFrame({
        "gps_interval_sec":    gps_interval_sec,
        "speed_kmh":           speed_kmh,
        "actual_distance_m":   actual_distance_m,
        "expected_distance_m": expected_distance_m,
        "dwell_time_min":      dwell_time_min,
        "route_deviation_m":   route_deviation_m,
        "temperature_c":       temperature_c,
        "time_since_scan_min": time_since_scan_min,
        "signal_strength":     signal_strength,
        "speed_delta_kmh":     speed_delta_kmh,
    })

    return df


def train() -> None:
    print(f"Generating {N_SAMPLES:,} normal operational events...")
    df = generate_normal_events(N_SAMPLES)
    feature_cols = list(df.columns)

    # ── StandardScaler: IsolationForest is distance-based ─────────────────
    # Features on very different scales (meters vs celsius) must be normalized
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[feature_cols])

    # ── IsolationForest ───────────────────────────────────────────────────
    # contamination=0.05: we expect ~5% of real events to be anomalous
    # n_estimators=200: more trees = more stable anomaly scores
    print("Training IsolationForest anomaly model...")
    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        max_samples="auto",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # ── Sanity check: score the training data ─────────────────────────────
    # decision_function: negative = more anomalous
    # score_samples: raw anomaly score
    scores = model.decision_function(X_scaled)
    predictions = model.predict(X_scaled)  # -1 = anomaly, 1 = normal

    anomaly_rate = (predictions == -1).mean()
    print(f"Anomaly rate on training data: {anomaly_rate:.1%} (target ~5%)")
    print(f"Score range: [{scores.min():.3f}, {scores.max():.3f}]")
    print(f"Score mean: {scores.mean():.3f}, std: {scores.std():.3f}")

    # ── Test with injected anomalies ──────────────────────────────────────
    print("\nTesting with injected anomaly patterns:")
    anomaly_cases = {
        "GPS jump (5km in 30s)": {
            "gps_interval_sec": 30, "speed_kmh": 600,
            "actual_distance_m": 5000, "expected_distance_m": 500,
            "dwell_time_min": 0, "route_deviation_m": 4500,
            "temperature_c": 25, "time_since_scan_min": 5,
            "signal_strength": 0.9, "speed_delta_kmh": 520,
        },
        "Long dwell (8 hours)": {
            "gps_interval_sec": 120, "speed_kmh": 0,
            "actual_distance_m": 0, "expected_distance_m": 0,
            "dwell_time_min": 480, "route_deviation_m": 50,
            "temperature_c": 25, "time_since_scan_min": 480,
            "signal_strength": 0.8, "speed_delta_kmh": 0,
        },
        "Temperature excursion (cold chain at 25°C)": {
            "gps_interval_sec": 60, "speed_kmh": 40,
            "actual_distance_m": 667, "expected_distance_m": 667,
            "dwell_time_min": 2, "route_deviation_m": 100,
            "temperature_c": 25, "time_since_scan_min": 20,
            "signal_strength": 0.9, "speed_delta_kmh": 5,
        },
    }

    for name, case in anomaly_cases.items():
        row = pd.DataFrame([case])[feature_cols]
        row_scaled = scaler.transform(row)
        score = model.decision_function(row_scaled)[0]
        pred = model.predict(row_scaled)[0]
        label = "ANOMALY" if pred == -1 else "normal"
        print(f"  {name}: score={score:.3f} → {label}")

    # ── Save model + scaler + feature list ────────────────────────────────
    payload = {
        "model": model,
        "scaler": scaler,
        "feature_cols": feature_cols,
    }
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(payload, f)

    print(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    train()