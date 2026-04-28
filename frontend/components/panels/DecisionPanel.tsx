"use client";

import { RouteDecision } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatTime } from "@/lib/utils";

interface Props {
  decision: RouteDecision | null;
}

export function DecisionPanel({ decision }: Props) {
  if (!decision) {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase mb-3">
          Latest Decision
        </h2>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-mono">
          — awaiting optimization trigger —
        </div>
      </div>
    );
  }

  const saved = decision.eta_delta_min;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase mb-3">
        Latest Decision
      </h2>

      <div className="space-y-3 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono font-bold text-white">{decision.vehicle_id}</span>
          <RiskBadge level={decision.risk_level} score={decision.risk_score} />
        </div>

        {/* ETA comparison */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900/60 rounded border border-slate-800">
          <div className="text-center">
            <div className="text-xs font-mono text-slate-500 mb-1">OLD ETA</div>
            <div className="text-sm font-mono font-bold text-slate-400 line-through">
              {decision.old_eta_min}m
            </div>
          </div>
          <div className="text-center flex flex-col items-center justify-center">
            <div className={`text-xs font-mono font-bold ${saved > 0 ? "text-green-400" : "text-red-400"}`}>
              {saved > 0 ? `−${saved}m` : `+${Math.abs(saved)}m`}
            </div>
            <div className="text-xs text-slate-600">saved</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono text-slate-500 mb-1">NEW ETA</div>
            <div className="text-sm font-mono font-bold text-green-400">
              {decision.new_eta_min}m
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="p-2.5 bg-slate-900/40 rounded border border-amber-900/40">
          <div className="text-xs font-mono text-amber-500 font-bold mb-1">
            {decision.reason_code}
          </div>
          <div className="text-xs font-mono text-slate-400 leading-relaxed">
            {decision.reason_description}
          </div>
        </div>

        {/* Risk score breakdown bar */}
        <div className="p-2.5 bg-slate-900/40 rounded border border-slate-800">
          <div className="text-xs font-mono text-slate-500 mb-2 tracking-widest">
            RISK BREAKDOWN
          </div>
          {[
            { label: "DELAY",   value: decision.risk_score * 0.45, color: "bg-red-500",    width: Math.round(decision.risk_score * 45) },
            { label: "ANOMALY", value: decision.risk_score * 0.25, color: "bg-orange-500", width: Math.round(decision.risk_score * 25) },
            { label: "SLA",     value: decision.risk_score * 0.20, color: "bg-amber-500",  width: Math.round(decision.risk_score * 20) },
            { label: "WEATHER", value: decision.risk_score * 0.10, color: "bg-blue-500",   width: Math.round(decision.risk_score * 10) },
          ].map(({ label, value, color, width }) => (
            <div key={label} className="flex items-center gap-2 mb-1">
              <div className="text-xs font-mono text-slate-500 w-14 shrink-0">{label}</div>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all duration-700`}
                  style={{ width: `${Math.min(width * 1.1, 100)}%` }}
                />
              </div>
              <div className="text-xs font-mono text-slate-400 w-8 text-right">
                {value.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 bg-slate-900/40 rounded border border-slate-800">
            <div className="text-slate-500">Solver</div>
            <div className="text-slate-200 font-bold">{decision.solver_status}</div>
          </div>
          <div className="p-2 bg-slate-900/40 rounded border border-slate-800">
            <div className="text-slate-500">OR-Tools</div>
            <div className="text-cyan-400 font-bold">{decision.solve_time_ms}ms</div>
          </div>
          <div className="p-2 bg-slate-900/40 rounded border border-slate-800">
            <div className="text-slate-500">Distance</div>
            <div className="text-slate-200 font-bold">{decision.total_distance_km}km</div>
          </div>
          <div className="p-2 bg-slate-900/40 rounded border border-slate-800">
            <div className="text-slate-500">Stops</div>
            <div className="text-slate-200 font-bold">{decision.route_stops.length}</div>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-600">
          {formatTime(decision.timestamp)} · {decision.triggered_by}
        </div>

        {/* Gemini Dispatch Section */}
        {(decision.gemini_driver_instruction || decision.gemini_judge_explanation) && (
          <div className="mt-3 p-3 bg-slate-900/80 rounded border border-indigo-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 uppercase">
                ✦ Gemini Dispatch
              </span>
            </div>
            
            {decision.gemini_driver_instruction && (
              <div className="mb-2">
                <div className="text-[9px] text-slate-500 font-mono mb-0.5">DRIVER INSTRUCTION</div>
                <div className="text-xs text-slate-300 italic">
                  "{decision.gemini_driver_instruction}"
                </div>
              </div>
            )}
            
            {decision.gemini_judge_explanation && (
              <div>
                <div className="text-[9px] text-slate-500 font-mono mb-0.5">SYSTEM EXPLANATION</div>
                <div className="text-xs text-indigo-200">
                  {decision.gemini_judge_explanation}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}