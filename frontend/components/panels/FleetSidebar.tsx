"use client";

import { VehiclePosition, FleetMetrics } from "@/types";
import { riskColor } from "@/lib/utils";

interface Props {
  vehicles: VehiclePosition[];
  metrics: FleetMetrics;
}

function SystemHealth() {
  return (
    <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        className="text-[10px] font-mono tracking-widest uppercase mb-2"
        style={{ color: "var(--text-muted)" }}
      >
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
    <div
      className="px-3 py-2 transition-colors duration-150 cursor-default"
      style={{
        borderBottom: "1px solid var(--border)",
        background: isHigh ? "var(--risk-high-bg)" : "transparent",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = isHigh ? "var(--risk-high-bg)" : "transparent")
      }
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-xs font-mono font-bold"
          style={{ color: "var(--text-primary)" }}
        >
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
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {v.speed_kmh} km/h
        </span>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {v.risk_score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function FleetSidebar({ vehicles, metrics }: Props) {
  const sorted = [...vehicles].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div
      className="w-[220px] shrink-0 flex flex-col overflow-hidden"
      style={{
        borderRight: "1px solid var(--border)",
        background: "var(--sidebar-bg)",
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-mono tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Fleet Status
          </span>
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {vehicles.length} units
          </span>
        </div>
      </div>

      {/* Risk summary pills */}
      <div
        className="grid grid-cols-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {[
          { count: metrics.high_risk_count,   label: "High", color: "var(--risk-high)" },
          { count: metrics.medium_risk_count, label: "Med",  color: "var(--risk-medium)" },
          { count: metrics.low_risk_count,    label: "Low",  color: "var(--risk-low)" },
        ].map(({ count, label, color }, i) => (
          <div
            key={label}
            className="flex flex-col items-center py-2"
            style={{
              borderRight: i < 2 ? "1px solid var(--border)" : "none",
            }}
          >
            <span className="text-sm font-black" style={{ color }}>{count}</span>
            <span
              className="text-[9px] font-mono uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </span>
          </div>
        ))}
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