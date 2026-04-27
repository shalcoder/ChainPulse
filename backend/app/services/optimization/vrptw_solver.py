"""
Phase 3 — OR-Tools VRPTW Solver

Solves the Vehicle Routing Problem with Time Windows for disrupted vehicles.
Re-optimizes only the affected subset of the fleet for speed.

Key constraints enforced:
- Vehicle capacity (cannot exceed max load)
- Time windows (must arrive within customer's window)
- Service time (time spent at each stop)
- Depot start/end (vehicles start and end at their assigned hub)
- SLA penalty (dropped shipments incur heavy cost)

Time limit: 10 seconds (configurable) — fast enough for live demo.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.services.optimization.constraint_builder import RoutingData

logger = logging.getLogger(__name__)

# OR-Tools time limit — must be fast for live demo
SOLVER_TIME_LIMIT_SECONDS = 10


@dataclass
class StopResult:
    """A single stop in the optimized route."""
    location_id: str
    location_name: str
    arrival_time_min: int      # Minutes from route start
    departure_time_min: int
    shipment_id: Optional[str] = None


@dataclass
class VehicleRoute:
    """Optimized route for one vehicle."""
    vehicle_id: str
    stops: list[StopResult]
    total_distance_km: float
    total_time_min: int
    load_kg: float
    dropped_shipment_ids: list[str] = field(default_factory=list)


@dataclass
class SolverResult:
    """Complete solution from OR-Tools."""
    status: str                          # "OPTIMAL", "FEASIBLE", "INFEASIBLE"
    vehicle_routes: list[VehicleRoute]
    total_distance_km: float
    total_time_min: int
    dropped_shipments: list[str]
    objective_value: int
    solve_time_ms: float


def solve_vrptw(
    routing_data: RoutingData,
    time_limit_seconds: int = SOLVER_TIME_LIMIT_SECONDS,
) -> SolverResult:
    """
    Run OR-Tools VRPTW solver on the given routing data.

    Returns SolverResult with optimized routes or INFEASIBLE status.
    """
    import time
    start_time = time.time()

    n_locations = len(routing_data.locations)
    n_vehicles = len(routing_data.vehicles)

    if n_locations == 0 or n_vehicles == 0:
        return SolverResult(
            status="INFEASIBLE",
            vehicle_routes=[],
            total_distance_km=0,
            total_time_min=0,
            dropped_shipments=[s.shipment_id for s in routing_data.shipments],
            objective_value=0,
            solve_time_ms=0,
        )

    # ── OR-Tools Manager + Routing Model ──────────────────────────────────
    # RoutingIndexManager maps between node indices and OR-Tools internal IDs
    manager = pywrapcp.RoutingIndexManager(
        n_locations,
        n_vehicles,
        routing_data.depot_indices,  # start depots
        routing_data.depot_indices,  # end depots (same — return to base)
    )
    routing = pywrapcp.RoutingModel(manager)

    # ── Transit callback: time between locations ───────────────────────────
    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel = routing_data.time_matrix[from_node][to_node]
        # Add service time at the origin node
        service = 0
        for s in routing_data.shipments:
            if s.location_index == from_node:
                service = s.service_time_min
                break
        return travel + service

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(time_callback_index)

    # ── Distance callback: for total distance tracking ────────────────────
    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return routing_data.distance_matrix[from_node][to_node]

    distance_callback_index = routing.RegisterTransitCallback(distance_callback)

    # ── Time window dimension ─────────────────────────────────────────────
    # slack_max=0: no waiting allowed (tighter, forces realistic routes)
    # capacity=1440: 24 hours in minutes
    routing.AddDimension(
        time_callback_index,
        slack_max=30,     # Allow up to 30 min early arrival wait
        capacity=1440,    # 24 hours
        fix_start_cumul_to_zero=True,
        name="Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")
    time_dimension.SetGlobalSpanCostCoefficient(10)

    # Apply time windows to each shipment location
    for shipment in routing_data.shipments:
        index = manager.NodeToIndex(shipment.location_index)
        time_dimension.CumulVar(index).SetRange(
            shipment.time_window_start,
            shipment.time_window_end,
        )

    # ── Capacity dimension ────────────────────────────────────────────────
    def demand_callback(from_index: int) -> int:
        node = manager.IndexToNode(from_index)
        for s in routing_data.shipments:
            if s.location_index == node:
                return int(s.demand_kg)
        return 0

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        slack_max=0,
        vehicle_capacities=[int(v.capacity_kg - v.current_load_kg)
                            for v in routing_data.vehicles],
        fix_start_cumul_to_zero=True,
        name="Capacity",
    )

    # ── Allow dropping shipments with SLA penalty ─────────────────────────
    # This makes the solver feasible even when not all stops can be served
    for shipment in routing_data.shipments:
        index = manager.NodeToIndex(shipment.location_index)
        routing.AddDisjunction([index], shipment.sla_penalty)

    # ── Search parameters ─────────────────────────────────────────────────
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = time_limit_seconds
    search_params.log_search = False  # Suppress verbose OR-Tools logs

    # ── Solve ─────────────────────────────────────────────────────────────
    logger.info(f"OR-Tools solving for {n_vehicles} vehicles, "
                f"{len(routing_data.shipments)} shipments, "
                f"time_limit={time_limit_seconds}s")

    solution = routing.SolveWithParameters(search_params)
    solve_time_ms = (time.time() - start_time) * 1000

    # ── Parse solution ────────────────────────────────────────────────────
    if solution:
        status = "OPTIMAL" if routing.status() == 1 else "FEASIBLE"
        return _parse_solution(
            solution, routing, manager, routing_data, status, solve_time_ms
        )
    else:
        logger.warning("OR-Tools found no feasible solution")
        return SolverResult(
            status="INFEASIBLE",
            vehicle_routes=[],
            total_distance_km=0,
            total_time_min=0,
            dropped_shipments=[s.shipment_id for s in routing_data.shipments],
            objective_value=0,
            solve_time_ms=solve_time_ms,
        )


def _parse_solution(
    solution,
    routing,
    manager,
    routing_data: RoutingData,
    status: str,
    solve_time_ms: float,
) -> SolverResult:
    """Extract routes and metrics from OR-Tools solution object."""
    time_dimension = routing.GetDimensionOrDie("Time")

    vehicle_routes: list[VehicleRoute] = []
    total_distance_km = 0.0
    total_time_min = 0
    served_shipment_ids: set[str] = set()

    for v_idx, vehicle in enumerate(routing_data.vehicles):
        index = routing.Start(v_idx)
        stops: list[StopResult] = []
        route_distance = 0
        route_time = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            time_var = time_dimension.CumulVar(index)
            arrival = solution.Min(time_var)
            departure = arrival

            # Find shipment at this node
            shipment_id = None
            for s in routing_data.shipments:
                if s.location_index == node:
                    shipment_id = s.shipment_id
                    departure = arrival + s.service_time_min
                    served_shipment_ids.add(s.shipment_id)
                    break

            loc = routing_data.locations[node]
            stops.append(StopResult(
                location_id=loc.id,
                location_name=loc.name,
                arrival_time_min=arrival,
                departure_time_min=departure,
                shipment_id=shipment_id,
            ))

            next_index = solution.Value(routing.NextVar(index))
            if not routing.IsEnd(next_index):
                route_distance += routing_data.distance_matrix[node][
                    manager.IndexToNode(next_index)
                ]
            index = next_index

        # Add final depot stop
        node = manager.IndexToNode(index)
        loc = routing_data.locations[node]
        time_var = time_dimension.CumulVar(index)
        stops.append(StopResult(
            location_id=loc.id,
            location_name=loc.name,
            arrival_time_min=solution.Min(time_var),
            departure_time_min=solution.Min(time_var),
        ))

        dist_km = route_distance / 10.0  # convert back from ×10 encoding
        time_min = stops[-1].arrival_time_min if stops else 0

        vehicle_routes.append(VehicleRoute(
            vehicle_id=vehicle.vehicle_id,
            stops=stops,
            total_distance_km=round(dist_km, 2),
            total_time_min=time_min,
            load_kg=vehicle.current_load_kg,
        ))

        total_distance_km += dist_km
        total_time_min = max(total_time_min, time_min)

    # Find dropped shipments
    all_shipment_ids = {s.shipment_id for s in routing_data.shipments}
    dropped = list(all_shipment_ids - served_shipment_ids)

    # Attach dropped shipments to vehicle routes
    for vr in vehicle_routes:
        vr.dropped_shipment_ids = dropped

    return SolverResult(
        status=status,
        vehicle_routes=vehicle_routes,
        total_distance_km=round(total_distance_km, 2),
        total_time_min=total_time_min,
        dropped_shipments=dropped,
        objective_value=solution.ObjectiveValue(),
        solve_time_ms=round(solve_time_ms, 1),
    )