"""
Phase 3 — Constraint Builder for VRPTW

Translates business entities (vehicles, shipments, hubs) into
the exact data structures OR-Tools routing solver expects.

Key concepts:
- Time matrix: travel time in minutes between every pair of locations
- Time windows: [earliest_arrival, latest_arrival] per location
- Capacity: vehicle max load vs shipment demands
- Penalty: cost of dropping a shipment (SLA-weighted)
"""

import math
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Location:
    """A point in the routing problem (depot, hub, or delivery address)."""
    id: str
    lat: float
    lng: float
    name: str = ""


@dataclass
class VehicleConstraint:
    """Constraints for a single vehicle."""
    vehicle_id: str
    depot_index: int          # Index into locations list (start/end point)
    capacity_kg: float        # Max load in kg
    current_load_kg: float    # Current load
    max_distance_km: float = 300.0


@dataclass
class ShipmentConstraint:
    """Constraints for a single shipment stop."""
    shipment_id: str
    location_index: int       # Index into locations list
    demand_kg: float          # Weight to pick up or deliver
    time_window_start: int    # Minutes from epoch start (e.g. start of day)
    time_window_end: int      # Must arrive before this
    service_time_min: int     # Time to load/unload at this stop
    sla_penalty: int          # Cost if dropped (higher = more critical)
    is_pickup: bool = False   # True = pickup, False = delivery


@dataclass
class RoutingData:
    """Complete data package for OR-Tools solver."""
    locations: list[Location]
    time_matrix: list[list[int]]    # minutes between locations (integers)
    distance_matrix: list[list[int]] # km × 10 between locations (integers)
    vehicles: list[VehicleConstraint]
    shipments: list[ShipmentConstraint]
    depot_indices: list[int]        # one per vehicle


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate great-circle distance between two GPS coordinates.
    Returns distance in kilometers.
    """
    R = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def build_time_matrix(
    locations: list[Location],
    avg_speed_kmh: float = 30.0,  # Urban Bengaluru average
    congestion_factor: float = 1.0,
) -> list[list[int]]:
    """
    Build NxN time matrix in minutes (integer, as OR-Tools requires).

    congestion_factor > 1.0 simulates traffic — injected during weather events.
    """
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = 0
                continue
            dist_km = haversine_km(
                locations[i].lat, locations[i].lng,
                locations[j].lat, locations[j].lng,
            )
            # travel_min = (dist / speed) * 60 * congestion
            travel_min = (dist_km / avg_speed_kmh) * 60.0 * congestion_factor
            matrix[i][j] = max(1, int(travel_min))  # minimum 1 minute
    return matrix


def build_distance_matrix(locations: list[Location]) -> list[list[int]]:
    """
    Build NxN distance matrix in km × 10 (integer).
    Multiplied by 10 to preserve one decimal place as integer.
    """
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = 0
                continue
            dist_km = haversine_km(
                locations[i].lat, locations[i].lng,
                locations[j].lat, locations[j].lng,
            )
            matrix[i][j] = int(dist_km * 10)
    return matrix


def build_routing_data(
    vehicle_dicts: list[dict],
    shipment_dicts: list[dict],
    hub_dicts: list[dict],
    congestion_factor: float = 1.0,
) -> RoutingData:
    """
    Build complete RoutingData from raw business entity dicts.

    vehicle_dicts: list of {vehicle_id, depot_lat, depot_lng, capacity_kg,
                             current_load_kg}
    shipment_dicts: list of {shipment_id, dest_lat, dest_lng, weight_kg,
                              time_window_start, time_window_end,
                              service_time_min, sla_priority}
    hub_dicts: list of {hub_id, lat, lng, name}
    """
    locations: list[Location] = []
    loc_index: dict[str, int] = {}

    # ── Add hub locations (depots) ─────────────────────────────────────────
    for hub in hub_dicts:
        idx = len(locations)
        loc_id = f"hub_{hub['hub_id']}"
        loc_index[loc_id] = idx
        locations.append(Location(
            id=loc_id,
            lat=hub["lat"],
            lng=hub["lng"],
            name=hub.get("name", loc_id),
        ))

    # ── Add shipment destination locations ────────────────────────────────
    for shipment in shipment_dicts:
        idx = len(locations)
        loc_id = f"shipment_{shipment['shipment_id']}"
        loc_index[loc_id] = idx
        locations.append(Location(
            id=loc_id,
            lat=shipment["dest_lat"],
            lng=shipment["dest_lng"],
            name=f"Delivery {shipment['shipment_id']}",
        ))

    # ── Build matrices ─────────────────────────────────────────────────────
    time_matrix = build_time_matrix(locations, congestion_factor=congestion_factor)
    distance_matrix = build_distance_matrix(locations)

    # ── Build vehicle constraints ─────────────────────────────────────────
    vehicles: list[VehicleConstraint] = []
    depot_indices: list[int] = []

    for v in vehicle_dicts:
        # Find nearest hub as depot for this vehicle
        depot_loc_id = f"hub_{v.get('depot_hub_id', hub_dicts[0]['hub_id'])}"
        depot_idx = loc_index.get(depot_loc_id, 0)
        depot_indices.append(depot_idx)
        vehicles.append(VehicleConstraint(
            vehicle_id=v["vehicle_id"],
            depot_index=depot_idx,
            capacity_kg=float(v.get("capacity_kg", 500)),
            current_load_kg=float(v.get("current_load_kg", 0)),
        ))

    # ── Build shipment constraints ────────────────────────────────────────
    shipments: list[ShipmentConstraint] = []
    for s in shipment_dicts:
        loc_id = f"shipment_{s['shipment_id']}"
        loc_idx = loc_index[loc_id]

        # SLA priority → penalty: CRITICAL=10000, HIGH=5000, MEDIUM=1000
        sla_map = {"CRITICAL": 10000, "HIGH": 5000, "MEDIUM": 1000, "LOW": 100}
        penalty = sla_map.get(s.get("sla_priority", "MEDIUM"), 1000)

        shipments.append(ShipmentConstraint(
            shipment_id=s["shipment_id"],
            location_index=loc_idx,
            demand_kg=float(s.get("weight_kg", 10)),
            time_window_start=int(s.get("time_window_start", 0)),
            time_window_end=int(s.get("time_window_end", 480)),
            service_time_min=int(s.get("service_time_min", 10)),
            sla_penalty=penalty,
        ))

    return RoutingData(
        locations=locations,
        time_matrix=time_matrix,
        distance_matrix=distance_matrix,
        vehicles=vehicles,
        shipments=shipments,
        depot_indices=depot_indices,
    )