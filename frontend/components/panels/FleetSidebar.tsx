"use client";

import { VehiclePosition, FleetMetrics } from "@/types";
import { riskColor } from "@/lib/utils";

interface Props {
  vehicles: VehiclePosition[];
  metrics: FleetMetrics;
}

function SystemHealth() {
  return (
    <div className="px-3 py-2 border-b border-slate-800">
      <div className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-2">
        System Health
      </div>
      <div className="grid grid-cols-2 gap-1">
        {[
          { label: "OR-Tools",   ok: true },
          { label: "XGBoost",    ok: true },
          { label: "Kafka",      ok: true },
          { label: "PostgreSQL", ok: true },
          { label: "Redis",      ok: true },
          { label: "WebSocket",  ok: true },
        ].map(({ label, ok }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-[10px] font-mono text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleRow({ v }: { v: VehiclePosition }) {
  const color = riskColor(v.risk_level);
  const isHigh = v.risk_level === "HIGH";
  const isMed = v.risk_level === "MEDIUM";

  return (
    <div className={`px-3 py-2 border-b border-slate-800/50 hover:bg-slate-800/30
                     transition-colors cursor-default
                     ${isHigh ? "bg-red-950/10" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono font-bold text-slate-200">
          {v.vehicle_id}
        </span>
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            color,
            background: `${color}18`,
            border: `1px solid ${color}44`,
          }}
        >
          {v.risk_level}
        </span>
      </div>

      {/* Risk bar */}
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-1">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${v.risk_score * 100}%`,
            background: color,
            boxShadow: isHigh ? `0 0 6px ${color}` : "none",
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-600">
          {v.speed_kmh} km/h
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          {v.risk_score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function FleetSidebar({ vehicles, metrics }: Props) {
  const sorted = [...vehicles].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="w-[220px] shrink-0 border-r border-slate-800 bg-[#090d15]
                    flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">
            Fleet Status
          </span>
          <span className="text-[10px] font-mono text-slate-600">
            {vehicles.length} units
          </span>
        </div>
      </div>

      {/* Risk summary pills */}
      <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-800 shrink-0">
        <div className="flex flex-col items-center py-2">
          <span className="text-sm font-black text-red-400">{metrics.high_risk_count}</span>
          <span className="text-[9px] font-mono text-slate-600 uppercase">High</span>
        </div>
        <div className="flex flex-col items-center py-2">
          <span className="text-sm font-black text-orange-400">{metrics.medium_risk_count}</span>
          <span className="text-[9px] font-mono text-slate-600 uppercase">Med</span>
        </div>
        <div className="flex flex-col items-center py-2">
          <span className="text-sm font-black text-green-400">{metrics.low_risk_count}</span>
          <span className="text-[9px] font-mono text-slate-600 uppercase">Low</span>
        </div>
      </div>

      {/* System health */}
      <SystemHealth />

      {/* Vehicle list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sorted.map((v) => (
          <VehicleRow key={v.vehicle_id} v={v} />
        ))}
      </div>
    </div>
  );
}