// Shared TypeScript types across the entire dashboard

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export interface VehiclePosition {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  status: "MOVING" | "IDLE" | "STOPPED" | "ANOMALY";
  risk_score: number;
  risk_level: RiskLevel;
  anomaly_score: number;
  last_updated: string;
}

export interface RouteStop {
  location_id: string;
  location_name: string;
  arrival_time_min: number;
  shipment_id: string | null;
}

export interface RouteDecision {
  decision_id: string;
  timestamp: string;
  vehicle_id: string;
  shipment_ids: string[];
  solver_status: string;
  reason_code: string;
  reason_description: string;
  risk_score: number;
  risk_level: RiskLevel;
  old_eta_min: number;
  new_eta_min: number;
  eta_delta_min: number;
  time_saved_display: string;
  route_stops: RouteStop[];
  total_distance_km: number;
  dropped_shipments: string[];
  solve_time_ms: number;
  triggered_by: string;
}

export interface RiskAlert {
  alert_id: string;
  timestamp: string;
  vehicle_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  reason_code: string;
  message: string;
  acknowledged: boolean;
}

export interface Hub {
  hub_id: string;
  name: string;
  lat: number;
  lng: number;
  congestion_level: number;  // 0.0–1.0
}

export interface FleetMetrics {
  total_vehicles: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  reroutes_today: number;
  sla_hit_rate: number;       // percentage
  avg_eta_saved_min: number;
  active_alerts: number;
}

export interface WebSocketMessage {
  type: "ROUTE_DECISION" | "RISK_ALERT" | "VEHICLE_UPDATE" | "FLEET_METRICS";
  payload: RouteDecision | RiskAlert | VehiclePosition | FleetMetrics;
}