# ChainPulse — AI Supply Chain Control Tower

> **Solution Challenge 2026 · Smart Supply Chain Track**
> A real-time, event-driven AI system that continuously senses disruption signals, scores risk with ML models, re-optimizes delivery routes under hard constraints, and pushes execution decisions to field operators — all in under 10 seconds, end-to-end.

```
SENSE  ──►  PREDICT  ──►  OPTIMIZE  ──►  EXECUTE
 Kafka        XGBoost       OR-Tools      WebSocket
 Events     + IsoForest     VRPTW         → Dashboard
```

[![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-7.5-231F20?style=flat-square&logo=apache-kafka)](https://kafka.apache.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15_+_PostGIS-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D?style=flat-square&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docker.com)

---

## Table of Contents

1. [What Is ChainPulse?](#1-what-is-chainpulse)
2. [Live Demo Flow](#2-live-demo-flow)
3. [What Makes This Different](#3-what-makes-this-different)
4. [System Architecture](#4-system-architecture)
5. [Tech Stack — Every Layer Explained](#5-tech-stack--every-layer-explained)
6. [ML Models — How They Work](#6-ml-models--how-they-work)
7. [Risk Scoring Formula](#7-risk-scoring-formula)
8. [OR-Tools VRPTW Optimizer](#8-or-tools-vrptw-optimizer)
9. [Complete Folder Structure](#9-complete-folder-structure)
10. [Setup and Installation](#10-setup-and-installation)
11. [Running the Full Stack](#11-running-the-full-stack)
12. [Running the Live Demo](#12-running-the-live-demo)
13. [API Reference](#13-api-reference)
14. [WebSocket Protocol](#14-websocket-protocol)
15. [Database Schema](#15-database-schema)
16. [Configuration Reference](#16-configuration-reference)
17. [Testing](#17-testing)
18. [Key Design Decisions](#18-key-design-decisions)
19. [Limitations and Production Roadmap](#19-limitations-and-production-roadmap)
20. [Team](#20-team)

---

## 1. What Is ChainPulse?

ChainPulse is a **closed-loop AI supply chain control tower**. It monitors a fleet of delivery vehicles in real time, detects disruptions the moment they happen, computes a composite risk score using trained ML models, and automatically re-optimizes affected delivery routes using Google OR-Tools — all without a human pressing a button.

**The problem it solves:** In traditional logistics, a weather alert or GPS anomaly sits in a spreadsheet until a dispatcher notices it — often hours later. By then, SLA windows have been missed and customers are waiting. ChainPulse compresses the sense-to-action loop from hours to under 10 seconds.

**The demo in one sentence:** A judge opens the dashboard, a Python script injects a simulated weather disruption, and within 10 seconds they see the affected vehicles turn red, an alert appear in the feed, OR-Tools fire, and a new optimized route appear on the map with before/after ETA comparison — fully automated, zero human clicks.

---

## 2. Live Demo Flow

This is exactly what judges see, step by step:

| Step | What Happens | What Judges See |
|------|-------------|-----------------|
| **1** | Dashboard opens. Backend WebSocket connects. | Status badge turns **LIVE** (green). Fleet of 20 vehicles moving on dark Bengaluru map. All risk scores green. |
| **2** | `demo_injector.py` injects weather alert on V003, V007, V012. | Alert feed populates in real time. Vehicle badges turn **orange (MEDIUM)**. Metrics bar: Alerts counter increments. |
| **3** | GPS anomaly injected on V005 — 95-min dwell, 2.8km route deviation. | IsolationForest anomaly score spikes. V005 badge changes. |
| **4** | Hub congestion event on V009 — Koramangala hub 92% blocked. | Congestion alert appears. V009 highlighted. |
| **5** | CRITICAL event on V015 + direct OR-Tools trigger. | Vehicle turns **red (HIGH)**. Decision panel updates: OLD ETA → NEW ETA, time saved, reason code `SLA_BREACH_RISK`. |
| **6** | Show `http://localhost:3000/audit`. | Full audit trail: every decision with vehicle ID, risk level, reason code, explanation, timestamp. |

**To run the demo:**
```bash
python scripts/demo_injector.py
```

---

## 3. What Makes This Different

Most hackathon supply chain prototypes are a map with fake button-click events and hardcoded responses. ChainPulse is not that.

| Feature | Typical Prototype | ChainPulse |
|---------|-------------------|------------|
| Event stream | Button click triggers hardcoded response | Apache Kafka topics: `gps-updates`, `weather-alerts`, `order-events`, `warehouse-events` |
| ETA prediction | Hardcoded delay value | XGBoost model trained on 50,000 synthetic operational records with 12 features |
| Anomaly detection | None | IsolationForest trained on normal GPS/dwell patterns — outputs real anomaly score |
| Route optimization | Show a static alternative route | Google OR-Tools VRPTW with capacity constraints, time windows, pickup-before-dropoff, SLA penalties |
| Risk scoring | Color change based on threshold | Weighted formula: `0.45×delay + 0.25×anomaly + 0.20×SLA + 0.10×weather` |
| Frontend updates | Polling every N seconds | WebSocket push — decision arrives at browser the instant OR-Tools finishes |
| Audit trail | None | PostgreSQL append-only log with reason codes, full decision payload, explainability text |
| Infrastructure | None / mocked | Docker Compose: Kafka + Zookeeper + PostgreSQL + PostGIS + Redis + Kafka UI |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHAINPULSE ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────┘

  IoT / Demo Injector
  ┌──────────────┐
  │ GPS Tracker  │──┐
  │ Weather API  │  │   Apache Kafka (Docker)
  │ Hub Sensors  │  │   ┌─────────────────────────────┐
  │ Order System │──┼──►│  gps-updates       (3 parts)│
  └──────────────┘  │   │  weather-alerts    (1 part) │
                    └──►│  order-events      (1 part) │
                        │  warehouse-events  (1 part) │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │     FastAPI Backend          │
                        │                              │
                        │  ┌─────────────────────────┐│
                        │  │  Kafka Consumer          ││  ← async, normalizes events
                        │  │  Feature Builder         ││  ← rolling window features
                        │  │  Event Validator         ││  ← schema validation
                        │  └──────────┬──────────────┘│
                        │             │                │
                        │  ┌──────────▼──────────────┐│
                        │  │  XGBoost ETA Model       ││  ← delay_probability
                        │  │  IsolationForest         ││  ← anomaly_score
                        │  │  Risk Scorer             ││  ← weighted formula
                        │  └──────────┬──────────────┘│
                        │             │                │
                        │  ┌──────────▼──────────────┐│
                        │  │  Alert Engine            ││  ← threshold check
                        │  │  OR-Tools VRPTW Solver   ││  ← route optimization
                        │  │  Decision Publisher      ││  ← audit + broadcast
                        │  └──────────┬──────────────┘│
                        │             │                │
                        └─────────────┼────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼──────┐    ┌──────────▼───────┐    ┌─────────▼──────┐
    │  PostgreSQL     │    │  Redis           │    │  WebSocket     │
    │  + PostGIS      │    │  Hot State Cache │    │  Push to       │
    │  Audit trail    │    │  Vehicle positions│    │  Frontend      │
    │  Route decisions│    │  Route cache     │    │                │
    └─────────────────┘    └──────────────────┘    └────────┬───────┘
                                                            │
                                              ┌─────────────▼──────────┐
                                              │   Next.js 14 Dashboard  │
                                              │                         │
                                              │  ┌───────────────────┐  │
                                              │  │  Mapbox GL JS Map │  │
                                              │  │  20 live vehicles │  │
                                              │  │  5 hub markers    │  │
                                              │  └───────────────────┘  │
                                              │  ┌───────────────────┐  │
                                              │  │  Risk Alert Feed  │  │
                                              │  │  Fleet Status     │  │
                                              │  │  Decision Panel   │  │
                                              │  │  Metrics Bar      │  │
                                              │  └───────────────────┘  │
                                              └─────────────────────────┘
```

### Data Flow — Step by Step

1. **Event arrives** via Kafka topic (or `POST /events` for the demo)
2. **Kafka consumer** normalizes the event into a standard schema
3. **Feature builder** computes rolling-window features (recent delay rate, average delay, etc.)
4. **XGBoost** outputs `delay_probability` — probability the vehicle will be delayed >15 minutes
5. **IsolationForest** outputs `anomaly_score` — how unusual this event is vs. normal patterns
6. **Risk scorer** computes `RiskScore = 0.45×delay + 0.25×anomaly + 0.20×SLA + 0.10×weather`
7. **Alert engine** checks threshold — if `RiskScore ≥ 0.70` (HIGH), triggers OR-Tools
8. **OR-Tools VRPTW** solves the vehicle routing problem with time windows and capacity constraints
9. **Decision publisher** writes the decision to PostgreSQL audit log + broadcasts over WebSocket
10. **Frontend** receives the WebSocket message and updates the map, decision panel, and alert feed

---

## 5. Tech Stack — Every Layer Explained

### Frontend: Next.js 14 + Mapbox GL JS + TypeScript + Tailwind CSS

- **Next.js 14** with App Router — server-side rendering for the initial page load, then client-side for all live updates
- **Mapbox GL JS** — hardware-accelerated WebGL map with custom vehicle markers and route overlays. Uses `mapbox://styles/mapbox/dark-v11` for the dark operational aesthetic
- **TypeScript** — full type safety across all components, hooks, and API calls
- **Tailwind CSS** — utility-first styling with a custom dark palette (`slate-950` background, `cyan-400` accents)
- **WebSocket hook** (`useWebSocket.ts`) — auto-reconnecting connection to FastAPI, exponential backoff on disconnect
- **Mock fallback** — if the backend is offline, the map shows a mock SVG fleet with simulated movement so the dashboard is never blank

### API: FastAPI (Python 3.11)

- **Async throughout** — all endpoints are `async def`, all DB calls use `asyncio`, Kafka consumer runs as a background task
- **Lifespan context manager** — startup creates DB tables and starts Kafka consumer; shutdown closes all connections cleanly
- **Dependency injection** — `get_db()` yields an `AsyncSession`, `get_ws_manager()` returns the singleton WebSocket manager
- **CORS** — configured for `localhost:3000` in development
- **Structured logging** — JSON in production, colored in development

### Event Bus: Apache Kafka (Docker, Confluent 7.5)

- **4 topics**: `gps-updates` (3 partitions for throughput), `weather-alerts`, `order-events`, `warehouse-events` (1 partition each)
- **aiokafka** — async Python Kafka client, non-blocking consumer loop
- **Kafka UI** — Provectus Kafka UI running at `localhost:8080` for visual topic inspection during demos
- **Zookeeper** — Confluent Zookeeper for Kafka broker coordination

### Operational Store: PostgreSQL 15 + PostGIS 3.3

- **PostGIS** — enables `Geography` column type for storing GPS coordinates and computing geospatial distances efficiently
- **SQLAlchemy 2.0 async** — ORM with `AsyncSession`, connection pool of 10 + 20 overflow
- **Tables**: `hubs`, `vehicles`, `shipments`, `routes`, `route_decisions`, `risk_alerts`, `audit_records`
- **Audit records** — append-only, never updated. Every system decision is preserved forever with full JSON context payload

### Fast State: Redis 7.2

- **aioredis** — async Redis client
- **Vehicle positions** — hot cache for current lat/lng of all 20 vehicles (sub-millisecond reads)
- **Route cache** — OR-Tools solutions cached by vehicle ID to avoid re-solving identical problems
- **Distributed locks** — prevents two concurrent optimization requests for the same vehicle

### ML: XGBoost + scikit-learn IsolationForest

See [Section 6](#6-ml-models--how-they-work) for full details.

### Optimization: Google OR-Tools VRPTW

See [Section 8](#8-or-tools-vrptw-optimizer) for full details.

### Infrastructure: Docker + Docker Compose

All infrastructure services run in Docker. A single command starts the entire stack:
```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

Services started: Zookeeper, Kafka, PostgreSQL + PostGIS, Redis, Kafka UI.

---

## 6. ML Models — How They Work

### 6.1 XGBoost Delay Prediction Model

**File:** `backend/ml/train_eta_model.py`  
**Saved model:** `backend/ml/models/eta_model.pkl`  
**Inference:** `backend/app/services/prediction/eta_model.py`

**What it predicts:** `delay_probability` — the probability that a vehicle will be delayed more than 15 minutes on its current route. Output is a float in `[0.0, 1.0]`.

**Training data:** 50,000 synthetic operational records generated by `backend/data/generate_synthetic_data.py`. Each record represents one delivery event with realistic correlations — e.g., bad weather + high congestion + peak hour reliably causes delays.

**Feature set (12 features):**

| Feature | Description | How Computed |
|---------|-------------|--------------|
| `route_length_km` | Total planned route distance | From shipment destinations |
| `historical_avg_min` | Historical average completion time for this route type | Rolling 30-day average |
| `hour_sin`, `hour_cos` | Hour of day encoded as sine/cosine | Captures cyclic nature of rush hour |
| `dow_sin`, `dow_cos` | Day of week encoded as sine/cosine | Captures weekly patterns |
| `weather_severity` | Current weather condition score | From weather event payload `[0,1]` |
| `hub_congestion` | Current hub occupancy rate | From warehouse event payload `[0,1]` |
| `vehicle_type` | Encoded vehicle category | 0=bike, 1=van, 2=truck |
| `vehicle_age_years` | Vehicle age | Older vehicles have higher breakdown risk |
| `recent_delay_rate` | Fraction of last 10 deliveries that were delayed | Rolling window |
| `recent_avg_delay_min` | Average delay over last 10 deliveries | Rolling window |

**Why XGBoost:** Gradient boosted trees handle mixed numerical features well, are robust to outliers, train fast on tabular data, and produce well-calibrated probabilities — exactly what a risk scorer needs.

**Why sine/cosine encoding for time:** A naive encoding of hour=23 and hour=0 looks very different numerically but they are actually adjacent in time. Sine/cosine encoding preserves the circular structure.

### 6.2 IsolationForest Anomaly Detection Model

**File:** `backend/ml/train_anomaly_model.py`  
**Saved model:** `backend/ml/models/anomaly_model.pkl`  
**Inference:** `backend/app/services/prediction/anomaly_model.py`

**What it detects:** Unusual vehicle behavior that deviates from normal operational patterns. Output is `anomaly_score` in `[0.0, 1.0]` where higher = more anomalous.

**Anomaly types it detects:**

| Anomaly Type | Indicator Feature | Normal Range | Anomalous Range |
|-------------|-------------------|--------------|-----------------|
| GPS jump | `actual_distance_m` vs `expected_distance_m` | Ratio ≈ 1.0 | Ratio > 3.0 |
| Long dwell | `dwell_time_min` | 3–15 min | > 60 min |
| Route deviation | `route_deviation_m` | < 500m | > 2000m |
| Speed anomaly | `speed_delta_kmh` | < 20 km/h change | > 50 km/h change |
| Missing scan | `time_since_scan_min` | < 30 min | > 120 min |
| Temperature excursion | `temperature_c` | 2–8°C (cold chain) | Outside range |
| Signal loss | `signal_strength` | > 0.7 | < 0.3 |

**Why IsolationForest:** It learns what "normal" looks like from unlabeled data, then scores how hard it is to isolate each new observation. Anomalies are isolated with fewer random splits. No labeled anomaly data needed — perfect for a system where abnormal events are rare.

**Score normalization:** Raw IsolationForest scores are in `[-0.5, 0.5]`. We normalize to `[0,1]` with `score = 1 - (raw_score + 0.5)` so higher always means more anomalous.

---

## 7. Risk Scoring Formula

**File:** `backend/app/services/prediction/risk_scorer.py`

```
RiskScore = 0.45 × delay_probability
          + 0.25 × anomaly_score
          + 0.20 × sla_criticality
          + 0.10 × weather_severity
```

All inputs and output are in `[0.0, 1.0]`.

**Why these weights:**
- `delay_probability (0.45)` — The primary operational concern. A delayed vehicle has the largest direct customer impact.
- `anomaly_score (0.25)` — Unusual behavior is a leading indicator of breakdowns, theft, or accidents.
- `sla_criticality (0.20)` — A delay on a CRITICAL next-day shipment is far worse than a delay on standard 5-day delivery.
- `weather_severity (0.10)` — Weather affects all vehicles on a corridor equally; it's context, not a vehicle-specific signal.

**Thresholds:**

| Level | Score Range | Action |
|-------|-------------|--------|
| `HIGH` | ≥ 0.70 | Auto-trigger OR-Tools optimizer |
| `MEDIUM` | 0.45 – 0.69 | Alert generated, human review |
| `LOW` | < 0.45 | Log only |

**Breakdown for explainability:** Every `RiskResult` includes a `breakdown` dict showing exactly how much each factor contributed to the final score. This is shown on the audit trail page.

---

## 8. OR-Tools VRPTW Optimizer

**File:** `backend/app/services/optimization/vrptw_solver.py`  
**Constraint builder:** `backend/app/services/optimization/constraint_builder.py`

### What is VRPTW?

Vehicle Routing Problem with Time Windows (VRPTW) is the problem of finding optimal routes for a fleet of vehicles to serve a set of customers, where each customer must be visited within a specified time window. It is NP-hard in general — OR-Tools uses constraint programming and local search heuristics to find near-optimal solutions fast.

### Hard Constraints (must never be violated)

1. **Vehicle capacity** — total shipment weight on a vehicle cannot exceed its `capacity_kg`
2. **Time windows** — each delivery must be attempted within `[time_window_start, time_window_end]` minutes from now
3. **Depot start/end** — every vehicle starts and ends at its assigned hub
4. **Pickup before dropoff** — for shipments with both a pickup and delivery location, pickup must happen first

### Soft Constraints (penalized but allowed)

1. **SLA breach** — late delivery incurs a penalty proportional to `sla_criticality` (HIGH SLA = high penalty)
2. **Dropped shipments** — if a shipment cannot be served within constraints, it is dropped with a penalty of 10,000 cost units
3. **Congestion factor** — hub congestion multiplies travel time by `1.0 + congestion × 0.5` (up to 1.5× slowdown)

### Optimization Objective

```
Minimize: total_travel_time × distance_weight
        + SLA_penalty × sla_weight
        + dropped_shipments × 10000
```

### Solver Configuration

- **Algorithm:** `AUTOMATIC` (OR-Tools selects between path cheapest arc, savings, etc.)
- **Time limit:** 8 seconds (configurable via `VRPTW_TIME_LIMIT_SECONDS`)
- **Re-optimize only disrupted vehicles** — when one vehicle is flagged HIGH risk, only that vehicle's sub-problem is solved, not the entire fleet. This keeps solve time under 1 second for typical cases.

### Output

The solver returns a `SolverResult` containing:
- `status` — `OPTIMAL`, `FEASIBLE`, or `INFEASIBLE`
- `vehicle_routes` — list of `VehicleRoute` with ordered stops, arrival times, and shipment IDs
- `total_distance_km` — total fleet distance in the new plan
- `dropped_shipments` — list of shipment IDs that couldn't be served
- `solve_time_ms` — how long the solver took
- `objective_value` — raw solver objective score

---

## 9. Complete Folder Structure

```
ai-supply-chain-control-tower/
├── .github/
│   └── workflows/
│       └── ci.yml                      ← GitHub Actions: lint + test on push
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py                 ← FastAPI dependency injection (DB, WebSocket)
│   │   │   └── routes/
│   │   │       ├── dashboard.py        ← WS /dashboard/stream + GET /dashboard/audit
│   │   │       ├── events.py           ← POST /events — full pipeline entry point
│   │   │       ├── predict.py          ← POST /predict — on-demand ML scoring
│   │   │       ├── optimize.py         ← POST /optimize — direct OR-Tools trigger
│   │   │       └── routes_api.py       ← GET /routes/{id}
│   │   │
│   │   ├── core/
│   │   │   ├── config.py               ← All constants and env vars via Pydantic Settings
│   │   │   ├── logging.py              ← structlog: JSON in prod, colored in dev
│   │   │   └── exceptions.py           ← Custom exception hierarchy
│   │   │
│   │   ├── services/
│   │   │   ├── ingestion/
│   │   │   │   ├── kafka_consumer.py   ← Async Kafka consumer, event normalization
│   │   │   │   ├── event_validator.py  ← Schema validation per event type
│   │   │   │   └── feature_builder.py  ← Rolling window feature computation
│   │   │   │
│   │   │   ├── prediction/
│   │   │   │   ├── eta_model.py        ← XGBoost: load .pkl + predict()
│   │   │   │   ├── anomaly_model.py    ← IsolationForest: load .pkl + score()
│   │   │   │   └── risk_scorer.py      ← RiskScore formula, RiskLevel enum
│   │   │   │
│   │   │   ├── optimization/
│   │   │   │   ├── vrptw_solver.py     ← OR-Tools VRPTW solver
│   │   │   │   ├── constraint_builder.py ← Distance matrix, time windows, capacity
│   │   │   │   └── decision_publisher.py ← Write to DB + broadcast over WebSocket
│   │   │   │
│   │   │   └── dispatch/
│   │   │       ├── alert_engine.py     ← Risk threshold checks + optimization trigger
│   │   │       └── websocket_manager.py ← Connection registry + broadcast manager
│   │   │
│   │   ├── db/
│   │   │   ├── postgres.py             ← SQLAlchemy async engine + session factory
│   │   │   └── redis_client.py         ← aioredis connection + helpers
│   │   │
│   │   ├── models/
│   │   │   ├── events.py               ← Event Pydantic schemas (GPS, weather, order)
│   │   │   ├── entities.py             ← ORM models: Hub, Vehicle, Shipment, Route
│   │   │   └── decisions.py            ← ORM models: RouteDecision, RiskAlert, AuditRecord
│   │   │
│   │   └── main.py                     ← FastAPI app, lifespan, CORS, route registration
│   │
│   ├── ml/
│   │   ├── train_eta_model.py          ← XGBoost training script
│   │   ├── train_anomaly_model.py      ← IsolationForest training script
│   │   └── models/
│   │       ├── eta_model.pkl           ← Saved XGBoost model
│   │       └── anomaly_model.pkl       ← Saved IsolationForest model
│   │
│   ├── data/
│   │   └── generate_synthetic_data.py  ← Generates 20 vehicles, 5 hubs, 100 shipments
│   │
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_risk_scorer.py
│   │   │   ├── test_vrptw_solver.py
│   │   │   └── test_feature_builder.py
│   │   └── integration/
│   │       ├── test_event_pipeline.py
│   │       └── test_optimize_endpoint.py
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                    ← Main control tower dashboard
│   │   ├── audit/page.tsx              ← Audit trail viewer (auto-refreshes every 5s)
│   │   └── layout.tsx                  ← Root layout, metadata, font
│   │
│   ├── components/
│   │   ├── map/
│   │   │   └── ControlTowerMap.tsx     ← SVG map with live vehicle dots + hub markers
│   │   ├── panels/
│   │   │   ├── RiskAlertFeed.tsx       ← Live scrolling alert list
│   │   │   ├── FleetStatusPanel.tsx    ← Vehicle list with risk scores + speed
│   │   │   ├── DecisionPanel.tsx       ← OLD ETA / saved / NEW ETA + reason code
│   │   │   └── MetricsSummary.tsx      ← Fleet, High Risk, Medium, Alerts, SLA Hit
│   │   └── ui/
│   │       └── RiskBadge.tsx           ← Color-coded HIGH/MEDIUM/LOW with pulse animation
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts             ← Auto-reconnecting WS, exponential backoff
│   │   ├── useFleetState.ts            ← Vehicle position state, 2s mock animation
│   │   └── useAlerts.ts                ← Alert feed + decision history state
│   │
│   ├── lib/
│   │   ├── api.ts                      ← REST API client functions
│   │   ├── mapbox.ts                   ← Mapbox helpers (unused in mock mode)
│   │   └── utils.ts                    ← computeFleetMetrics, formatTime, generateMockFleet
│   │
│   └── types/index.ts                  ← All TypeScript interfaces
│
├── infra/
│   ├── docker-compose.dev.yml          ← Full local dev stack
│   └── kafka/
│       └── topics.sh                   ← Topic creation script
│
├── docs/
│   └── architecture.md                 ← Architecture deep-dive
│
├── scripts/
│   └── demo_injector.py                ← 5-step live demo sequence
│
├── .gitignore
├── Makefile                            ← make dev, make test, make demo
└── README.md
```

---

## 10. Setup and Installation

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend runtime |
| Docker Desktop | Latest | Kafka, PostgreSQL, Redis |
| Git | Any | Clone repo |

### Step 1 — Clone the Repository

```bash
git clone https://github.com/shalcoder/ChainPulse.git
cd ChainPulse
git checkout poornachandran
```

### Step 2 — Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate.ps1

# Activate (Mac/Linux)
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

### Step 3 — Train the ML Models

This only needs to be done once. The trained models are saved as `.pkl` files.

```bash
cd backend

# Train XGBoost delay prediction model
# Generates 50,000 synthetic records, trains, saves to ml/models/eta_model.pkl
python ml/train_eta_model.py

# Train IsolationForest anomaly detection model
# Learns normal GPS/dwell patterns, saves to ml/models/anomaly_model.pkl
python ml/train_anomaly_model.py
```

### Step 4 — Frontend Setup

```bash
cd frontend
npm install
```

### Step 5 — Environment Variables

```bash
# Backend — copy and configure
cp backend/.env.example backend/.env
```

The `.env` file contains:

```env
# Database
DATABASE_URL=postgresql+asyncpg://chainpulse:chainpulse@localhost:5432/chainpulse

# Redis
REDIS_URL=redis://localhost:6379/0

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Application
DEBUG=true
LOG_LEVEL=INFO

# Risk thresholds
HIGH_RISK_THRESHOLD=0.70
MEDIUM_RISK_THRESHOLD=0.45

# OR-Tools
VRPTW_TIME_LIMIT_SECONDS=10
```

```bash
# Frontend — create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > frontend/.env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8000" >> frontend/.env.local
# Optional: add Mapbox token for real map (free at account.mapbox.com)
# echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiLi4uIn0..." >> frontend/.env.local
```

---

## 11. Running the Full Stack

### Start Infrastructure (Docker)

```bash
# Start Kafka, Zookeeper, PostgreSQL, Redis, Kafka UI
docker compose -f infra/docker-compose.dev.yml up -d

# Verify all containers are healthy
docker ps

# Create Kafka topics (first time only, or after docker down -v)
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic gps-updates --partitions 3 --replication-factor 1
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic weather-alerts --partitions 1 --replication-factor 1
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic order-events --partitions 1 --replication-factor 1
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic warehouse-events --partitions 1 --replication-factor 1
```

### Start Backend

```bash
cd backend
.\venv\Scripts\Activate.ps1          # Windows
# source venv/bin/activate           # Mac/Linux

uvicorn app.main:app --reload --port 8000
```

Wait for:
```
INFO: Application startup complete.
INFO: ML models loaded successfully.
INFO: Kafka consumer started.
```

### Start Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. Status badge should show **LIVE** (green).

### Services Summary

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend Dashboard | http://localhost:3000 | Main control tower UI |
| Audit Trail | http://localhost:3000/audit | Decision history |
| FastAPI Backend | http://localhost:8000 | REST + WebSocket API |
| API Docs (Swagger) | http://localhost:8000/docs | Auto-generated API explorer |
| Kafka UI | http://localhost:8080 | Inspect Kafka topics live |
| PostgreSQL | localhost:5432 | DB (user: chainpulse, pass: chainpulse) |
| Redis | localhost:6379 | Cache |

---

## 12. Running the Live Demo

Open these three browser tabs before starting:
1. `http://localhost:3000` — main dashboard
2. `http://localhost:3000/audit` — audit trail
3. `http://localhost:8080` — Kafka UI

Then run:

```bash
cd D:\Documents\Projects\Solution_Challenge
.\backend\venv\Scripts\Activate.ps1
python scripts/demo_injector.py
```

**What you will see in sequence:**

1. **Status turns LIVE** — WebSocket connects, dashboard shows 20 vehicles moving
2. **STEP 1** — V003, V007, V012 get weather alerts. Alert feed populates. Badges turn orange.
3. **STEP 2** — V005 GPS anomaly (95-min dwell, 2.8km deviation). Anomaly score spikes.
4. **STEP 3** — V009 hub congestion. Koramangala hub 92% blocked.
5. **STEP 4** — V015 CRITICAL event → OR-Tools fires → Decision panel shows OLD ETA, NEW ETA, time saved, reason code
6. **STEP 5** — Audit trail shows all decisions with full explainability

---

## 13. API Reference

### `POST /events`

Ingest a single event and run the full sense→predict→optimize→execute pipeline.

**Request body:**
```json
{
  "event_type": "weather",         // "gps" | "weather" | "warehouse" | "order"
  "vehicle_id": "V001",
  "severity": 0.95,                // overall event severity [0,1]
  "weather_severity": 0.90,        // [0,1]
  "hub_congestion": 0.80,          // [0,1]
  "sla_criticality": 0.85,         // [0,1]
  "lat": 12.9716,
  "lng": 77.5946,
  "speed_kmh": 0,
  "dwell_time_min": 95.0,          // for anomaly detection
  "route_deviation_m": 2800.0,     // for anomaly detection
  "source": "gps_tracker"
}
```

**Response:**
```json
{
  "status": "processed",
  "event_type": "weather",
  "vehicle_id": "V001",
  "risk_score": 0.732,
  "risk_level": "HIGH",
  "delay_probability": 0.684,
  "anomaly_score": 0.547,
  "alert_id": "8ac568b7-..."
}
```

---

### `POST /predict`

On-demand ML scoring without triggering optimization.

**Request body:**
```json
{
  "vehicle_id": "V001",
  "route_length_km": 25.0,
  "weather_severity": 0.80,
  "hub_congestion": 0.60,
  "sla_criticality": 0.75,
  "hour_of_day": 17,
  "day_of_week": 1
}
```

**Response:**
```json
{
  "vehicle_id": "V001",
  "delay_probability": 0.684,
  "anomaly_score": 0.231,
  "risk_score": 0.612,
  "risk_level": "MEDIUM",
  "breakdown": {
    "delay_contribution": 0.308,
    "anomaly_contribution": 0.058,
    "sla_contribution": 0.150,
    "weather_contribution": 0.080
  }
}
```

---

### `POST /optimize`

Directly trigger OR-Tools VRPTW for a vehicle. Used when you want to force an optimization regardless of risk threshold.

**Request body:**
```json
{
  "vehicle_id": "V015",
  "risk_score": 0.85,
  "risk_level": "HIGH",
  "weather_severity": 0.90,
  "hub_congestion": 0.85,
  "sla_criticality": 0.95,
  "anomaly_score": 0.70
}
```

**Response:**
```json
{
  "status": "optimized",
  "decision": {
    "decision_id": "3adbe225-...",
    "vehicle_id": "V015",
    "solver_status": "OPTIMAL",
    "reason_code": "SLA_BREACH_RISK",
    "reason_description": "SLA breach probability exceeded threshold [Risk Score: 0.85]",
    "old_eta_min": 271,
    "new_eta_min": 201,
    "eta_delta_min": 70,
    "time_saved_display": "70 min saved",
    "route_stops": [...],
    "total_distance_km": 47.3,
    "solve_time_ms": 312
  }
}
```

---

### `GET /dashboard/audit`

Returns the last 50 decisions from the audit log.

**Response:** Array of audit records, newest first.

---

### `GET /dashboard/health`

```json
{
  "status": "ok",
  "active_connections": 1,
  "timestamp": "2026-04-27T10:19:46.694418+00:00"
}
```

---

### `GET /health`

Top-level health check. Returns service status for all dependencies.

---

## 14. WebSocket Protocol

**Endpoint:** `ws://localhost:8000/dashboard/stream`

The frontend connects to this endpoint on load. All messages are JSON with a `type` field.

### Messages sent by server to frontend:

**`CONNECTED`** — sent immediately on connect
```json
{
  "type": "CONNECTED",
  "payload": {
    "message": "ChainPulse Control Tower connected",
    "timestamp": "2026-04-27T10:00:00Z",
    "connections": 1
  }
}
```

**`HEARTBEAT`** — sent every 30 seconds to keep connection alive
```json
{
  "type": "HEARTBEAT",
  "payload": { "timestamp": "2026-04-27T10:00:30Z" }
}
```

**`RISK_ALERT`** — sent when any vehicle crosses a risk threshold
```json
{
  "type": "RISK_ALERT",
  "payload": {
    "alert_id": "8ac568b7-...",
    "timestamp": "2026-04-27T10:00:01Z",
    "vehicle_id": "V001",
    "risk_level": "HIGH",
    "risk_score": 0.732,
    "reason_code": "WEATHER_REROUTE",
    "message": "V001 flagged — weather severity 0.90, hub congestion 0.80",
    "acknowledged": false
  }
}
```

**`VEHICLE_UPDATE`** — sent after each event, updates vehicle position and risk on map
```json
{
  "type": "VEHICLE_UPDATE",
  "payload": {
    "vehicle_id": "V001",
    "lat": 12.9716,
    "lng": 77.5946,
    "speed_kmh": 0,
    "status": "ANOMALY",
    "risk_score": 0.732,
    "risk_level": "HIGH",
    "anomaly_score": 0.547,
    "last_updated": "2026-04-27T10:00:01Z"
  }
}
```

**`ROUTE_DECISION`** — sent when OR-Tools produces a new route (HIGH risk events only)
```json
{
  "type": "ROUTE_DECISION",
  "payload": {
    "decision_id": "3adbe225-...",
    "vehicle_id": "V015",
    "solver_status": "OPTIMAL",
    "reason_code": "SLA_BREACH_RISK",
    "risk_score": 0.92,
    "risk_level": "HIGH",
    "old_eta_min": 271,
    "new_eta_min": 201,
    "eta_delta_min": 70,
    "time_saved_display": "70 min saved",
    "route_stops": [
      {
        "location_id": "H1",
        "location_name": "MG Road Hub",
        "arrival_time_min": 15,
        "shipment_id": "V015-S1"
      }
    ]
  }
}
```

---

## 15. Database Schema

### `audit_records` — The explainability layer

```sql
CREATE TABLE audit_records (
    id                  VARCHAR(36)  PRIMARY KEY,
    action_type         VARCHAR(32)  NOT NULL,   -- "ROUTE_DECISION", "ANOMALY_DETECTED", etc.
    actor               VARCHAR(64)  DEFAULT 'system',
    vehicle_id          VARCHAR(36),
    shipment_id         VARCHAR(36),
    route_decision_id   VARCHAR(36),
    summary             TEXT         NOT NULL,   -- Human-readable explanation
    context             JSONB        NOT NULL,   -- Full decision payload
    severity            VARCHAR(10)  DEFAULT 'INFO',  -- INFO, WARNING, CRITICAL
    created_at          TIMESTAMP    DEFAULT NOW()
);
```

### `route_decisions` — OR-Tools outputs

```sql
CREATE TABLE route_decisions (
    id                      VARCHAR(36) PRIMARY KEY,
    vehicle_id              VARCHAR(36) NOT NULL,
    reason_code             VARCHAR(64) NOT NULL,
    previous_eta_minutes    FLOAT,
    new_eta_minutes         FLOAT,
    eta_saved_minutes       FLOAT,
    risk_score_at_decision  FLOAT       NOT NULL,
    decision_payload        JSONB       NOT NULL,
    created_at              TIMESTAMP   DEFAULT NOW()
);
```

### `risk_alerts` — Threshold crossings

```sql
CREATE TABLE risk_alerts (
    id              VARCHAR(36) PRIMARY KEY,
    vehicle_id      VARCHAR(36) NOT NULL,
    alert_level     VARCHAR(10) NOT NULL,  -- HIGH, MEDIUM, LOW
    risk_score      FLOAT       NOT NULL,
    alert_reason    VARCHAR(512) NOT NULL,
    resolved        BOOLEAN     DEFAULT FALSE,
    created_at      TIMESTAMP   DEFAULT NOW()
);
```

---

## 16. Configuration Reference

All configuration lives in `backend/app/core/config.py` and is loaded from environment variables via Pydantic Settings.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL async connection URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker address |
| `HIGH_RISK_THRESHOLD` | `0.70` | RiskScore threshold for HIGH classification |
| `MEDIUM_RISK_THRESHOLD` | `0.45` | RiskScore threshold for MEDIUM classification |
| `VRPTW_TIME_LIMIT_SECONDS` | `10` | Max time OR-Tools can spend per solve |
| `RISK_WEIGHT_DELAY` | `0.45` | XGBoost delay probability weight |
| `RISK_WEIGHT_ANOMALY` | `0.25` | IsolationForest anomaly score weight |
| `RISK_WEIGHT_SLA` | `0.20` | SLA criticality weight |
| `RISK_WEIGHT_WEATHER` | `0.10` | Weather severity weight |
| `FLEET_SIZE` | `20` | Number of vehicles in demo fleet |
| `HUB_COUNT` | `5` | Number of distribution hubs |
| `SHIPMENT_COUNT` | `100` | Number of active shipments |
| `DEBUG` | `false` | Enables SQL logging and verbose output |
| `LOG_LEVEL` | `INFO` | Logging level |

---

## 17. Testing

```bash
cd backend
.\venv\Scripts\Activate.ps1

# Run all tests
pytest tests/ -v

# Unit tests only
pytest tests/unit/ -v

# Integration tests (requires Docker stack running)
pytest tests/integration/ -v

# With coverage
pytest tests/ --cov=app --cov-report=term-missing
```

### Key Unit Tests

| Test File | What It Tests |
|-----------|---------------|
| `test_risk_scorer.py` | Formula correctness, edge cases (all zeros, all ones, boundary values) |
| `test_vrptw_solver.py` | OR-Tools returns OPTIMAL/FEASIBLE, capacity constraints respected |
| `test_feature_builder.py` | Rolling window computations, sine/cosine encoding correctness |

### Key Integration Tests

| Test File | What It Tests |
|-----------|---------------|
| `test_event_pipeline.py` | Full POST /events → ML → risk → optimize → DB write → WebSocket |
| `test_optimize_endpoint.py` | POST /optimize → solver → audit record written |

---

## 18. Key Design Decisions

**Why Kafka instead of a simple REST queue?**
Kafka decouples event producers from consumers. In production, 1000s of GPS devices would be writing simultaneously. A REST queue would bottleneck at the API. Kafka handles millions of events/second with replay capability — if the ML pipeline crashes, it can reprocess from offset.

**Why PostgreSQL + PostGIS instead of a time-series DB?**
PostGIS enables geospatial queries (`ST_Distance`, `ST_Within`) for future features like "find all vehicles within 5km of a flooded road." A pure time-series DB like InfluxDB can't do that. PostgreSQL's JSONB columns also let us store arbitrary decision payloads without schema migrations.

**Why Redis for vehicle positions?**
PostgreSQL is too slow for 20 vehicles × 1 GPS update/second = 20 writes/second sustained. Redis stores the latest position in memory — sub-millisecond reads for the map. PostgreSQL stores the audit trail — slower, but durable.

**Why re-optimize only the affected vehicle instead of the whole fleet?**
Full fleet VRPTW with 20 vehicles and 100 shipments would take 10–60 seconds. Re-optimizing 1 vehicle with 2–3 shipments takes under 1 second. In a real disruption, only the disrupted vehicle needs rerouting — the rest of the fleet doesn't change.

**Why XGBoost instead of a neural network?**
12 tabular features, 50,000 training samples. Neural networks are overkill here and harder to explain to judges. XGBoost gives comparable accuracy, trains in seconds, and its feature importance scores directly explain which factors drive delay predictions.

**Why IsolationForest instead of supervised anomaly detection?**
You don't have labeled anomaly data in a new supply chain deployment. IsolationForest learns from unlabeled normal data. It's the standard approach for operational anomaly detection precisely because ground-truth anomaly labels are expensive to collect.

---

## 19. Limitations and Production Roadmap

### Current Limitations (Prototype Scope)

| Limitation | Description |
|-----------|-------------|
| Synthetic data | ML models trained on generated data, not real operational records |
| Mock map | Uses SVG mock map, not Mapbox GL JS with real tile rendering (needs API token) |
| Single-region | Bengaluru coordinates only — distance matrix is Euclidean, not road network |
| No authentication | API endpoints have no auth — fine for demo, not for production |
| In-memory WebSocket | WebSocket connections lost on backend restart — no persistence |

### Production Roadmap

1. **Real map tiles** — Add Mapbox token, switch `ControlTowerMap` to full Mapbox GL JS with vehicle layer
2. **Road-network distances** — Replace Euclidean distance matrix with OSRM or Google Maps Distance Matrix API
3. **Real ML training data** — Connect to actual TMS/WMS systems for historical delay data
4. **Auth** — Add JWT authentication to all endpoints
5. **Horizontal scaling** — Move WebSocket state to Redis Pub/Sub so multiple backend instances can broadcast
6. **Kafka Streams** — Move feature computation from in-process to Kafka Streams for true real-time processing
7. **Multi-city** — Parameterize hub locations and vehicle fleet per region

---


**Poornachandran** — 2nd Year Engineering Student  
Solution Challenge 2026 — Smart Supply Chain Track  

---

## Quick Start (TL;DR)

```bash
# 1. Start infrastructure
docker compose -f infra/docker-compose.dev.yml up -d

# 2. Create Kafka topics (first time only)
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic gps-updates --partitions 3 --replication-factor 1
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic weather-alerts --partitions 1 --replication-factor 1
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic order-events --partitions 1 --replication-factor 1
docker exec scc_kafka kafka-topics --create --bootstrap-server localhost:9092 --topic warehouse-events --partitions 1 --replication-factor 1

# 3. Start backend
cd backend && .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# 4. Start frontend (new terminal)
cd frontend && npm run dev

# 5. Run live demo (new terminal)
python scripts/demo_injector.py

# 6. Open dashboard
start http://localhost:3000
```

---

*Built for Solution Challenge 2026 · Smart Supply Chain Track*