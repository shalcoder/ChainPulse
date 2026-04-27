"use client";

import { FleetMetrics } from "@/types";

interface Props {
  metrics: FleetMetrics;
  connected: boolean;
  reroutes: number;
}

function Metric({ label, value, unit, accent }: {
  label: string; value: string | number; unit?: string; accent?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-3 border border-slate-800 bg-slate-900/40 rounded">
      <div className={`text-xl font-mono font-black ${accent || "text-white"}`}>
        {value}<span className="text-xs font-normal text-slate-500 ml-0.5">{unit}</span>
      </div>
      <div className="text-xs font-mono text-slate-500 tracking-widest uppercase mt-0.5">{label}</div>
    </div>
  );
}

export function MetricsSummary({ metrics, connected, reroutes }: Props) {
  return (
    <div className="flex items-center gap-2">
      {/* Connection status */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 rounded bg-slate-900/40">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        <span className="text-xs font-mono text-slate-400">
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2 flex-1">
        <Metric label="Fleet" value={metrics.total_vehicles} />
        <Metric label="High Risk" value={metrics.high_risk_count} accent="text-red-400" />
        <Metric label="Medium" value={metrics.medium_risk_count} accent="text-orange-400" />
        <Metric label="Alerts" value={metrics.active_alerts} accent="text-amber-400" />
        <Metric label="SLA Hit" value={metrics.sla_hit_rate.toFixed(1)} unit="%" accent="text-cyan-400" />
        <Metric label="Reroutes" value={reroutes} accent="text-violet-400" />
      </div>
    </div>
  );
}