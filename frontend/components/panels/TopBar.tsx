"use client";

import { FleetMetrics } from "@/types";
import { DemoLauncher } from "@/components/panels/DemoLauncher";

interface Props {
  connected: boolean;
  metrics: FleetMetrics;
  reroutes: number;
  dateDisplay: string;
}

function MetricPill({
  label, value, unit, color,
}: {
  label: string; value: string | number; unit?: string; color?: string;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-1.5 border-r border-slate-800 last:border-r-0">
      <span className={`text-lg font-black tabular-nums ${color || "text-white"}`}>
        {value}
        {unit && <span className="text-xs font-normal text-slate-500 ml-0.5">{unit}</span>}
      </span>
      <span className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mt-0.5">
        {label}
      </span>
    </div>
  );
}

export function TopBar({ connected, metrics, reroutes, dateDisplay }: Props) {
  return (
    <header className="shrink-0 border-b border-slate-800 bg-[#080c14]/95 backdrop-blur">

      {/* Row 1 — branding + demo + date */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="relative w-7 h-7 shrink-0">
            <div className="absolute inset-0 border-2 border-cyan-500 rotate-45 rounded-sm" />
            <div className="absolute inset-[3px] bg-cyan-500/20 rotate-45 rounded-sm" />
            <div className="absolute inset-[6px] bg-cyan-400 rotate-45 rounded-sm" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black tracking-[0.12em] text-white uppercase">
              Chain<span className="text-cyan-400">Pulse</span>
            </span>
            <span className="text-[10px] text-slate-600 tracking-widest uppercase hidden sm:block">
              AI Supply Chain Control Tower
            </span>
          </div>

          {/* Live indicator */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono
            ${connected
              ? "border-green-800 bg-green-950/40 text-green-400"
              : "border-red-800 bg-red-950/40 text-red-400"
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {connected ? "LIVE" : "OFFLINE"}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DemoLauncher />
          <span className="text-[10px] font-mono text-slate-600 tracking-widest hidden md:block">
            {dateDisplay}
          </span>
        </div>
      </div>

      {/* Row 2 — metrics strip */}
      <div className="flex items-stretch divide-x divide-slate-800">
        <MetricPill label="Fleet"     value={metrics.total_vehicles} />
        <MetricPill label="High Risk" value={metrics.high_risk_count}   color="text-red-400" />
        <MetricPill label="Medium"    value={metrics.medium_risk_count} color="text-orange-400" />
        <MetricPill label="Alerts"    value={metrics.active_alerts}     color="text-amber-400" />
        <MetricPill label="SLA Hit"   value={metrics.sla_hit_rate.toFixed(1)} unit="%" color="text-cyan-400" />
        <MetricPill label="Reroutes"  value={reroutes}                  color="text-violet-400" />
      </div>
    </header>
  );
}