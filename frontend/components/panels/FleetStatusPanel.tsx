"use client";

import { VehiclePosition } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";

interface Props {
  vehicles: VehiclePosition[];
}

export function FleetStatusPanel({ vehicles }: Props) {
  const sorted = [...vehicles].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase mb-3">
        Fleet Status — {vehicles.length} Units
      </h2>
      <div className="flex-1 overflow-y-auto space-y-1">
        {sorted.map((v) => (
          <div
            key={v.vehicle_id}
            className="flex items-center justify-between px-2.5 py-1.5 rounded border border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-200 w-10">
                {v.vehicle_id}
              </span>
              <span className="text-xs font-mono text-slate-500">
                {v.speed_kmh} km/h
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${v.risk_score * 100}%`,
                    background: v.risk_level === "HIGH" ? "#ef4444"
                      : v.risk_level === "MEDIUM" ? "#f97316"
                      : "#22c55e",
                  }}
                />
              </div>
              <RiskBadge level={v.risk_level} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}