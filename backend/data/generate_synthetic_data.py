"""
Synthetic data generator for the AI Supply Chain Control Tower demo.

Two modes:
  1. seed   — Populates PostgreSQL with hubs, vehicles, shipments (run once)
  2. stream — Continuously publishes realistic GPS events to Kafka (run during demo)

Run: python generate_synthetic_data.py seed
     python generate_synthetic_data.py stream

Uses Bengaluru (Bangalore), India as the geographic area.
All hubs are at real Bengaluru industrial/logistics locations.
"""

import asyncio
import json
import math
import random
import sys
import uuid
from datetime import datetime, timedelta
from typing import Optional

import asyncpg
from aiokafka import AIOKafkaProducer

# ── Configuration ─────────────────────────────────────────────────────────────
POSTGRES_DSN = "postgresql://scc_user:scc_password@localhost:5432/scc_db"
KAFKA_BOOTSTRAP = "localhost:9092"
GPS_INTERVAL_SECONDS = 2.0
FLEET_SIZE = 20
SHIPMENT_COUNT = 100

# ── Bengaluru Hub Locations ───────────────────────────────────────────────────
HUB_DEFINITIONS = [
    {
        "name": "Whitefield Logistics Hub",
        "city": "Bengaluru",
        "latitude": 12.9698,
        "longitude": 77.7500,
        "capacity_vehicles": 8,
        "dock_count": 6,
    },
    {
        "name": "Electronic City Distribution Centre",
        "city": "Bengaluru",
        "latitude": 12.8399,
        "longitude": 77.6770,
        "capacity_vehicles": 10,
        "dock_count": 8,
    },
    {
        "name": "Peenya Industrial Warehouse",
        "city": "Bengaluru",
        "latitude": 13.0280,
        "longitude": 77.5200,
        "capacity_vehicles": 6,
        "dock_count": 4,
    },
    {
        "name": "Bommasandra Fulfilment Centre",
        "city": "Bengaluru",
        "latitude": 12.8085,
        "longitude": 77.6887,
        "capacity_vehicles": 8,
        "dock_count": 5,
    },
    {
        "name": "Hebbal Central Hub",
        "city": "Bengaluru",
        "latitude": 13.0358,
        "longitude": 77.5970,
        "capacity_vehicles": 10,
        "dock_count": 7,
    },
]

VEHICLE_TYPES = [
    {"type": "truck", "capacity_kg": 5000.0, "capacity_m3": 20.0},
    {"type": "van",   "capacity_kg": 1500.0, "capacity_m3": 8.0},
    {"type": "bike",  "capacity_kg": 50.0,   "capacity_m3": 0.5},
]

VEHICLE_TYPE_DISTRIBUTION = [
    ("truck", 0.5),  # 50% trucks
    ("van", 0.35),   # 35% vans
    ("bike", 0.15),  # 15% bikes
]


def _new_id() -> str:
    return str(uuid.uuid4())


def _weighted_choice(choices: list[tuple]) -> str:
    """Pick from [(value, weight)] pairs."""
    values, weights = zip(*choices)
    return random.choices(values, weights=weights, k=1)[0]


def _random_point_near(lat: float, lon: float, radius_km: float = 10.0):
    """Generate a random GPS point within radius_km of (lat, lon)."""
    # Approximate: 1 degree lat ≈ 111 km
    delta_lat = random.uniform(-radius_km / 111, radius_km / 111)
    delta_lon = random.uniform(-radius_km / 111, radius_km / 111)
    return lat + delta_lat, lon + delta_lon


# ── Database Seeding ──────────────────────────────────────────────────────────

async def seed_database() -> None:
    """Populate PostgreSQL with hubs, vehicles, and shipments."""
    print("Connecting to PostgreSQL...")
    conn = await asyncpg.connect(POSTGRES_DSN)

    try:
        print("Enabling PostGIS...")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

        # ── Seed Hubs ─────────────────────────────────────────────────────
        print("Seeding hubs...")
        hub_ids = []
        for hub_def in HUB_DEFINITIONS:
            hub_id = _new_id()
            hub_ids.append(hub_id)
            await conn.execute(
                """
                INSERT INTO hubs (id, name, city, latitude, longitude,
                                  capacity_vehicles, dock_count, congestion_score, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 0.0, true)
                ON CONFLICT (id) DO NOTHING
                """,
                hub_id,
                hub_def["name"],
                hub_def["city"],
                hub_def["latitude"],
                hub_def["longitude"],
                hub_def["capacity_vehicles"],
                hub_def["dock_count"],
            )
        print(f"  Created {len(hub_ids)} hubs.")

        # ── Seed Vehicles ─────────────────────────────────────────────────
        print("Seeding vehicles...")
        vehicle_ids = []
        for i in range(FLEET_SIZE):
            v_type = _weighted_choice(VEHICLE_TYPE_DISTRIBUTION)
            specs = next(s for s in VEHICLE_TYPES if s["type"] == v_type)
            vehicle_id = _new_id()
            vehicle_ids.append(vehicle_id)

            # Start vehicles near their assigned hub
            hub_def = HUB_DEFINITIONS[i % len(HUB_DEFINITIONS)]
            lat, lon = _random_point_near(hub_def["latitude"], hub_def["longitude"], 5.0)

            reg_prefix = {"truck": "KA-TRK", "van": "KA-VAN", "bike": "KA-BIK"}[v_type]
            registration = f"{reg_prefix}-{str(i + 1).zfill(3)}"

            await conn.execute(
                """
                INSERT INTO vehicles (
                    id, registration, vehicle_type, capacity_kg, capacity_m3,
                    latitude, longitude, speed_kmh, heading_degrees,
                    fuel_level_pct, odometer_km, status,
                    current_risk_score, anomaly_score, delay_probability,
                    current_hub_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 0.0, 0.0, 100.0, 0.0,
                        'idle', 0.0, 0.0, 0.0, $8)
                ON CONFLICT (id) DO NOTHING
                """,
                vehicle_id,
                registration,
                v_type,
                specs["capacity_kg"],
                specs["capacity_m3"],
                lat,
                lon,
                hub_ids[i % len(hub_ids)],
            )
        print(f"  Created {len(vehicle_ids)} vehicles.")

        # ── Seed Shipments ────────────────────────────────────────────────
        print("Seeding shipments...")
        now = datetime.utcnow()
        for i in range(SHIPMENT_COUNT):
            shipment_id = _new_id()
            order_id = _new_id()
            customer_id = _new_id()

            origin_hub = hub_ids[i % len(hub_ids)]
            dest_hub = hub_ids[(i + 1 + random.randint(0, 2)) % len(hub_ids)]
            while dest_hub == origin_hub:
                dest_hub = random.choice(hub_ids)

            priority = random.choices([1, 2, 3, 4, 5], weights=[5, 20, 40, 25, 10])[0]
            # SLA deadline: 2–48 hours from now, shorter for higher priority
            sla_hours = random.uniform(2, 48) / (priority * 0.5)
            sla_deadline = now + timedelta(hours=sla_hours)

            weight_kg = random.uniform(10, 2000)
            volume_m3 = weight_kg / random.uniform(200, 500)

            # Assign to a random vehicle (some shipments unassigned)
            vehicle_id = random.choice(vehicle_ids) if random.random() > 0.3 else None
            status = "assigned" if vehicle_id else "created"

            await conn.execute(
                """
                INSERT INTO shipments (
                    id, order_id, customer_id,
                    origin_hub_id, destination_hub_id, vehicle_id,
                    weight_kg, volume_m3, requires_refrigeration, estimated_value_inr,
                    sla_deadline, priority, sla_criticality,
                    status, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                        NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                shipment_id, order_id, customer_id,
                origin_hub, dest_hub, vehicle_id,
                round(weight_kg, 2), round(volume_m3, 4),
                random.random() < 0.1,
                round(random.uniform(500, 50000), 2),
                sla_deadline, priority,
                round((5 - priority + 1) / 5, 4),
                status,
            )
        print(f"  Created {SHIPMENT_COUNT} shipments.")

        print("\nDatabase seeding complete!")
        print(f"  Hubs: {len(hub_ids)}")
        print(f"  Vehicles: {len(vehicle_ids)}")
        print(f"  Shipments: {SHIPMENT_COUNT}")

    finally:
        await conn.close()


# ── Kafka Event Stream ────────────────────────────────────────────────────────

class VehicleSimulator:
    """
    Simulates a single vehicle moving around Bengaluru.
    Produces GPS events with realistic noise, fuel depletion, and breakdowns.
    """

    def __init__(self, vehicle_id: str, vehicle_type: str,
                 start_lat: float, start_lon: float,
                 hub_definitions: list[dict]) -> None:
        self.vehicle_id = vehicle_id
        self.vehicle_type = vehicle_type
        self.lat = start_lat
        self.lon = start_lon
        self.hub_defs = hub_definitions

        # Pick a target hub
        self.target_hub = random.choice(hub_definitions)
        self.status = "moving"
        self.fuel = 100.0
        self.odometer = random.uniform(0, 50000)
        self.heading = random.uniform(0, 360)

        # Speed depends on vehicle type
        self._max_speed = {"truck": 70, "van": 90, "bike": 60}.get(vehicle_type, 70)

    def _move_toward_target(self) -> None:
        """Move vehicle toward target hub with realistic noise."""
        target_lat = self.target_hub["latitude"]
        target_lon = self.target_hub["longitude"]

        # Direction vector
        dlat = target_lat - self.lat
        dlon = target_lon - self.lon
        dist = math.sqrt(dlat ** 2 + dlon ** 2)

        if dist < 0.01:  # Reached the hub (~1.1 km)
            # Pick a new target hub
            self.target_hub = random.choice(self.hub_defs)
            self.status = "loading"
            return

        # Normalize and step
        step = 0.005 * random.uniform(0.5, 1.5)  # ~0.5km per tick with variance
        self.lat += (dlat / dist) * step + random.gauss(0, 0.0001)
        self.lon += (dlon / dist) * step + random.gauss(0, 0.0001)

        # Update heading
        self.heading = math.degrees(math.atan2(dlon, dlat)) % 360

        # Fuel depletion
        self.fuel = max(0, self.fuel - random.uniform(0.01, 0.05))
        self.odometer += step * 111  # approx km

        # Random status transitions
        if random.random() < 0.002:  # 0.2% chance of breakdown
            self.status = "breakdown"
        elif self.status == "breakdown" and random.random() < 0.1:
            self.status = "moving"
        elif self.status not in ("breakdown", "loading"):
            self.status = "moving"

    def get_gps_event(self) -> dict:
        """Generate a GPS event dict for Kafka."""
        self._move_toward_target()
        speed = (
            0.0 if self.status in ("loading", "breakdown")
            else random.uniform(20, self._max_speed)
        )
        return {
            "event_id": _new_id(),
            "event_type": "gps",
            "timestamp": datetime.utcnow().isoformat(),
            "source": "simulator",
            "vehicle_id": self.vehicle_id,
            "latitude": round(self.lat, 6),
            "longitude": round(self.lon, 6),
            "speed_kmh": round(speed, 2),
            "heading_degrees": round(self.heading, 2),
            "status": self.status,
            "fuel_level_pct": round(self.fuel, 2),
            "odometer_km": round(self.odometer, 2),
            "active_shipment_ids": [],
        }


async def stream_events() -> None:
    """
    Read vehicles from DB, create simulators, publish GPS events continuously.
    Also injects periodic weather and warehouse events for realism.
    """
    print("Connecting to PostgreSQL for vehicle data...")
    conn = await asyncpg.connect(POSTGRES_DSN)
    rows = await conn.fetch(
        "SELECT id, vehicle_type, latitude, longitude FROM vehicles"
    )
    await conn.close()

    if not rows:
        print("No vehicles found. Run 'seed' first.")
        return

    print(f"Loaded {len(rows)} vehicles from database.")

    # Create simulators
    simulators = [
        VehicleSimulator(
            vehicle_id=str(row["id"]),
            vehicle_type=row["vehicle_type"],
            start_lat=float(row["latitude"]),
            start_lon=float(row["longitude"]),
            hub_definitions=HUB_DEFINITIONS,
        )
        for row in rows
    ]

    print("Connecting to Kafka...")
    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        acks="all",
        compression_type="gzip",
    )
    await producer.start()
    print("Kafka producer connected.")
    print(f"Streaming GPS events for {len(simulators)} vehicles every {GPS_INTERVAL_SECONDS}s...")
    print("Press Ctrl+C to stop.")

    tick = 0
    try:
        while True:
            tick += 1

            # ── GPS events for all vehicles ───────────────────────────────
            for sim in simulators:
                event = sim.get_gps_event()
                await producer.send("gps-updates", value=event)

            # ── Periodic weather event (every 50 ticks ≈ 100 seconds) ────
            if tick % 50 == 0:
                hub = random.choice(HUB_DEFINITIONS)
                severity_score = random.uniform(0.1, 0.6)
                weather = {
                    "event_id": _new_id(),
                    "event_type": "weather",
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "simulator",
                    "region_id": f"region_{random.randint(1, 5)}",
                    "condition": random.choice(["heavy_rain", "fog", "strong_wind"]),
                    "severity": (
                        "high" if severity_score > 0.5
                        else "medium" if severity_score > 0.3
                        else "low"
                    ),
                    "severity_score": round(severity_score, 3),
                    "affected_hub_ids": [random.choice([h["name"] for h in HUB_DEFINITIONS])],
                    "affected_route_ids": [],
                    "wind_speed_kmh": round(random.uniform(10, 80), 1),
                    "visibility_km": round(random.uniform(0.5, 10.0), 1),
                    "expected_duration_minutes": random.randint(30, 180),
                    "latitude": hub["latitude"] + random.gauss(0, 0.05),
                    "longitude": hub["longitude"] + random.gauss(0, 0.05),
                    "radius_km": random.uniform(10, 50),
                }
                await producer.send("weather-alerts", value=weather)
                print(f"  [tick {tick}] Weather: {weather['condition']} severity={severity_score:.2f}")

            # ── Periodic warehouse congestion event (every 30 ticks) ──────
            if tick % 30 == 0:
                hub = random.choice(HUB_DEFINITIONS)
                congestion = round(random.uniform(0.2, 0.9), 3)
                warehouse = {
                    "event_id": _new_id(),
                    "event_type": "warehouse",
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "simulator",
                    "hub_id": hub["name"],
                    "warehouse_event_type": "congestion",
                    "congestion_score": congestion,
                    "capacity_used_pct": round(congestion * 100, 1),
                    "dock_count_available": max(0, int((1 - congestion) * hub["dock_count"])),
                    "estimated_wait_minutes": int(congestion * 60),
                }
                await producer.send("warehouse-events", value=warehouse)

            await asyncio.sleep(GPS_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print("\nStopping event stream.")
    finally:
        await producer.stop()
        print("Kafka producer closed.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "stream"
    if command == "seed":
        asyncio.run(seed_database())
    elif command == "stream":
        asyncio.run(stream_events())
    else:
        print(f"Unknown command: {command}. Use 'seed' or 'stream'.")
        sys.exit(1)