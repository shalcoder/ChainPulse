import { VehiclePosition, RiskLevel, FleetMetrics } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function riskColor(level: RiskLevel): string {
  return level === "HIGH" ? "#ef4444"
    : level === "MEDIUM" ? "#f97316"
    : "#22c55e";
}

export function riskGlow(level: RiskLevel): string {
  return level === "HIGH" ? "0 0 12px #ef444488"
    : level === "MEDIUM" ? "0 0 12px #f9731688"
    : "0 0 8px #22c55e44";
}

// Bengaluru area bounding box
const BLAT = { min: 12.85, max: 13.10 };
const BLNG = { min: 77.45, max: 77.75 };

function randInRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function generateMockFleet(): VehiclePosition[] {
  const statuses: VehiclePosition["status"][] = ["MOVING", "MOVING", "MOVING", "IDLE", "ANOMALY"];
  const levels: RiskLevel[] = ["LOW", "LOW", "LOW", "MEDIUM", "HIGH"];

  return Array.from({ length: 20 }, (_, i) => {
    const riskIdx = i < 15 ? 0 : i < 18 ? 3 : 4;
    return {
      vehicle_id: `V${String(i + 1).padStart(3, "0")}`,
      lat: randInRange(BLAT.min, BLAT.max),
      lng: randInRange(BLNG.min, BLNG.max),
      speed_kmh: Math.round(randInRange(0, 60)),
      heading: Math.round(randInRange(0, 360)),
      status: statuses[riskIdx],
      risk_score: riskIdx === 0 ? randInRange(0.05, 0.40)
        : riskIdx === 3 ? randInRange(0.45, 0.69)
        : randInRange(0.70, 0.95),
      risk_level: levels[riskIdx],
      anomaly_score: riskIdx === 4 ? randInRange(0.6, 0.9) : randInRange(0, 0.2),
      last_updated: new Date().toISOString(),
    };
  });
}

export function computeFleetMetrics(vehicles: VehiclePosition[]): FleetMetrics {
  return {
    total_vehicles: vehicles.length,
    high_risk_count: vehicles.filter(v => v.risk_level === "HIGH").length,
    medium_risk_count: vehicles.filter(v => v.risk_level === "MEDIUM").length,
    low_risk_count: vehicles.filter(v => v.risk_level === "LOW").length,
    reroutes_today: 0,
    sla_hit_rate: 94.2,
    avg_eta_saved_min: 0,
    active_alerts: vehicles.filter(v => v.risk_level !== "LOW").length,
  };
}