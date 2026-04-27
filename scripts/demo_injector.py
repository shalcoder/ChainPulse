"""
ChainPulse Demo Injector
Injects a scripted sequence of disruption events for the live demo.

Usage:
    python scripts/demo_injector.py

The sequence (judges watch this happen in real time):
  Step 1 — Weather alert hits 3 vehicles (MEDIUM risk — alerts populate)
  Step 2 — GPS anomaly on V005 (anomaly score spikes)
  Step 3 — Hub congestion on V009 (MEDIUM risk)
  Step 4 — CRITICAL event on V015 — directly triggers OR-Tools (guaranteed HIGH)
  Step 5 — Show audit trail
"""

import time
import requests
import json

API = "http://localhost:8000"


def post_event(payload: dict, label: str) -> dict:
    print(f"\n{'='*60}")
    print(f"  INJECTING: {label}")
    print(f"{'='*60}")
    try:
        r = requests.post(f"{API}/events", json=payload, timeout=30)
        data = r.json()
        print(f"  Status     : {r.status_code}")
        print(f"  Vehicle    : {data.get('vehicle_id')}")
        print(f"  Risk Level : {data.get('risk_level')}")
        print(f"  Risk Score : {data.get('risk_score', 0):.3f}")
        print(f"  Delay Prob : {data.get('delay_probability', 0):.3f}")
        print(f"  Anomaly    : {data.get('anomaly_score', 0):.3f}")
        print(f"  Alert ID   : {data.get('alert_id')}")
        return data
    except Exception as e:
        print(f"  ERROR: {e}")
        return {}


def force_optimize(vehicle_id: str, risk_score: float, reason: str) -> dict:
    """Directly call /optimize — bypasses risk threshold for guaranteed demo."""
    print(f"\n{'='*60}")
    print(f"  OPTIMIZING: {reason}")
    print(f"{'='*60}")
    try:
        r = requests.post(f"{API}/optimize", json={
            "vehicle_id": vehicle_id,
            "risk_score": risk_score,
            "risk_level": "HIGH",
            "weather_severity": 0.90,
            "hub_congestion": 0.85,
            "sla_criticality": 0.95,
            "anomaly_score": 0.70,
        }, timeout=30)
        data = r.json()
        decision = data.get("decision", {})
        stops = len(decision.get("route_stops", []))
        eta_delta = decision.get("eta_delta_min", 0)
        solver = decision.get("solver_status", "?")
        reason_code = decision.get("reason_code", "?")
        time_display = decision.get("time_saved_display", "?")

        print(f"  Solver     : {solver}")
        print(f"  Reason     : {reason_code}")
        print(f"  Route stops: {stops}")
        print(f"  ETA delta  : {time_display}")
        print(f"  Decision ID: {decision.get('decision_id', '?')[:16]}...")
        return data
    except Exception as e:
        print(f"  ERROR: {e}")
        return {}


def pause(seconds: int, reason: str):
    print(f"\n  ⏳ Waiting {seconds}s — {reason}")
    time.sleep(seconds)


def main():
    print("\n" + "█"*60)
    print("  CHAINPULSE AI SUPPLY CHAIN CONTROL TOWER")
    print("  LIVE DEMO SEQUENCE — Solution Challenge 2026")
    print("█"*60)
    print("\n  Open http://localhost:3000 in your browser NOW")
    print("  Watch the dashboard as events are injected...\n")

    pause(3, "giving you time to open the dashboard")

    # ── Step 1: Weather alert — 3 vehicles, MEDIUM risk ───────────────
    print("\n▶ STEP 1: SEVERE WEATHER EVENT — Bengaluru South corridor")
    print("  (Watch: alert feed populates, vehicle badges turn orange)\n")

    post_event({
        "event_type": "weather",
        "vehicle_id": "V003",
        "severity": 0.75,
        "weather_severity": 0.78,
        "hub_congestion": 0.40,
        "sla_criticality": 0.60,
        "lat": 12.9200, "lng": 77.6100,
        "source": "weather_sensor",
    }, "Weather alert — V003")

    pause(2, "next vehicle")

    post_event({
        "event_type": "weather",
        "vehicle_id": "V007",
        "severity": 0.82,
        "weather_severity": 0.85,
        "hub_congestion": 0.55,
        "sla_criticality": 0.70,
        "lat": 12.9100, "lng": 77.6300,
        "source": "weather_sensor",
    }, "Weather alert — V007")

    pause(2, "next vehicle")

    post_event({
        "event_type": "weather",
        "vehicle_id": "V012",
        "severity": 0.88,
        "weather_severity": 0.90,
        "hub_congestion": 0.65,
        "sla_criticality": 0.80,
        "lat": 12.9050, "lng": 77.6200,
        "source": "weather_sensor",
    }, "Weather alert — V012")

    pause(4, "letting judges see alerts populate in dashboard")

    # ── Step 2: GPS anomaly ───────────────────────────────────────────
    print("\n▶ STEP 2: GPS ANOMALY DETECTED — Vehicle V005")
    print("  (Watch: anomaly score spikes, badge changes)\n")

    post_event({
        "event_type": "gps",
        "vehicle_id": "V005",
        "severity": 0.70,
        "weather_severity": 0.20,
        "hub_congestion": 0.30,
        "sla_criticality": 0.75,
        "lat": 13.0500, "lng": 77.4800,
        "speed_kmh": 0,
        "dwell_time_min": 95.0,
        "route_deviation_m": 2800.0,
        "source": "gps_tracker",
    }, "GPS anomaly — V005 long dwell + route deviation")

    pause(3, "anomaly score registering")

    # ── Step 3: Hub congestion ────────────────────────────────────────
    print("\n▶ STEP 3: HUB CONGESTION — Koramangala Hub blocked")
    print("  (Watch: V009 alert appears in feed)\n")

    post_event({
        "event_type": "warehouse",
        "vehicle_id": "V009",
        "severity": 0.85,
        "weather_severity": 0.30,
        "hub_congestion": 0.92,
        "sla_criticality": 0.85,
        "lat": 12.9352, "lng": 77.6245,
        "source": "hub_sensor",
    }, "Hub congestion — Koramangala blocked, V009")

    pause(3, "congestion alert registering")

    # ── Step 4: CRITICAL — force OR-Tools optimizer ───────────────────
    print("\n▶ STEP 4: CRITICAL DISRUPTION + AUTO REROUTE — V015")
    print("  (Watch: Decision panel updates with new route + ETA)\n")

    # First inject the event so alert appears
    post_event({
        "event_type": "weather",
        "vehicle_id": "V015",
        "severity": 0.99,
        "weather_severity": 0.97,
        "hub_congestion": 0.95,
        "sla_criticality": 0.99,
        "lat": 12.8900, "lng": 77.6500,
        "speed_kmh": 0,
        "dwell_time_min": 120.0,
        "route_deviation_m": 4000.0,
        "source": "demo_injector",
    }, "CRITICAL disruption event — V015")

    pause(2, "event processed")

    # Then force the optimizer directly — guaranteed HIGH + decision panel update
    force_optimize("V015", 0.92, "OR-Tools VRPTW reroute — V015 CRITICAL")

    pause(6, "OR-Tools solving + decision broadcasting to dashboard")

    # Also trigger one more for variety
    force_optimize("V005", 0.81, "OR-Tools VRPTW reroute — V005 anomaly resolved")

    pause(4, "second decision broadcasting")

    # ── Step 5: Audit trail ───────────────────────────────────────────
    print("\n▶ STEP 5: AUDIT TRAIL VERIFICATION")
    try:
        r = requests.get(f"{API}/dashboard/audit", timeout=10)
        records = r.json()
        print(f"\n  {len(records)} decisions in audit log:")
        for rec in records[:5]:
            level = rec.get("risk_level", "?")
            vid = rec.get("vehicle_id", "?")
            code = rec.get("reason_code", "?")
            desc = rec.get("reason_description", "")[:55]
            print(f"  [{level:6}] {vid:5} — {code:20} — {desc}")
    except Exception as e:
        print(f"  Audit fetch error: {e}")

    print("\n" + "█"*60)
    print("  DEMO COMPLETE")
    print("")
    print("  NOW SHOW JUDGES:")
    print("  1. http://localhost:3000       — Live dashboard")
    print("  2. http://localhost:3000/audit — Full audit trail")
    print("  3. http://localhost:8080       — Kafka UI (live topics)")
    print("█"*60 + "\n")


if __name__ == "__main__":
    main()