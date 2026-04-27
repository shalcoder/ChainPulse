"use client";

import { useState, useEffect } from "react";
import { RiskAlert, RouteDecision, WebSocketMessage } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatTime } from "@/lib/utils";

interface Props {
  alerts: RiskAlert[];
  latestDecision: RouteDecision | null;
  lastMessage: WebSocketMessage | null;
}

// ── Alert Feed Tab ────────────────────────────────────────────────────────────

function AlertFeed({ alerts }: { alerts: RiskAlert[] }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
      {alerts.length === 0 && (
        <div className="flex items-center justify-center h-32 text-slate-600 text-xs font-mono">
          — system nominal —
        </div>
      )}
      {alerts.map((alert) => (
        <div
          key={alert.alert_id}
          className="rounded border border-slate-800 bg-slate-900/50
                     hover:border-slate-700 transition-colors p-2.5"
        >
          <div className="flex items-center justify-between mb-1.5">
            <RiskBadge level={alert.risk_level} score={alert.risk_score} />
            <span className="text-[10px] font-mono text-slate-600">
              {formatTime(alert.timestamp)}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400 leading-relaxed">
            <span className="text-cyan-500 font-bold">{alert.vehicle_id}</span>
            {" — "}
            {alert.message || alert.reason_code}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Decision Tab ──────────────────────────────────────────────────────────────

function DecisionView({ decision }: { decision: RouteDecision | null }) {
  if (!decision) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-mono">
        — awaiting optimization trigger —
      </div>
    );
  }

  const saved = decision.eta_delta_min;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">

      {/* Vehicle + risk badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono font-black text-white">
          {decision.vehicle_id}
        </span>
        <RiskBadge level={decision.risk_level} score={decision.risk_score} />
      </div>

      {/* ETA comparison */}
      <div className="grid grid-cols-3 p-3 bg-slate-900/60 rounded border border-slate-800 text-center">
        <div>
          <div className="text-[10px] font-mono text-slate-500 mb-1">OLD ETA</div>
          <div className="text-sm font-mono font-bold text-slate-400 line-through">
            {decision.old_eta_min}m
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className={`text-sm font-mono font-black
            ${saved > 0 ? "text-green-400" : "text-red-400"}`}>
            {saved > 0 ? `−${saved}m` : `+${Math.abs(saved)}m`}
          </div>
          <div className="text-[10px] text-slate-600">
            {saved > 0 ? "saved" : "added"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 mb-1">NEW ETA</div>
          <div className="text-sm font-mono font-bold text-green-400">
            {decision.new_eta_min}m
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="p-2.5 rounded border border-amber-900/40 bg-slate-900/40">
        <div className="text-xs font-mono text-amber-500 font-bold mb-1">
          {decision.reason_code}
        </div>
        <div className="text-xs font-mono text-slate-400 leading-relaxed">
          {decision.reason_description}
        </div>
      </div>

      {/* Confidence + model */}
      {decision.confidence_pct !== undefined && (
        <div className="p-2.5 rounded border border-slate-800 bg-slate-900/40">
          <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-widest">
            ML CONFIDENCE
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-700"
                style={{ width: `${decision.confidence_pct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold w-8 text-right">
              {decision.confidence_pct}%
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-600 mt-1">
            {decision.model_used === "xgboost" ? "XGBoost classifier" : "Heuristic fallback"}
          </div>
        </div>
      )}

      {/* Risk breakdown */}
      <div className="p-2.5 rounded border border-slate-800 bg-slate-900/40">
        <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-widest">
          RISK BREAKDOWN
        </div>
        {[
          { label: "DELAY",   pct: Math.round(decision.risk_score * 45), color: "bg-red-500" },
          { label: "ANOMALY", pct: Math.round(decision.risk_score * 25), color: "bg-orange-500" },
          { label: "SLA",     pct: Math.round(decision.risk_score * 20), color: "bg-amber-500" },
          { label: "WEATHER", pct: Math.round(decision.risk_score * 10), color: "bg-blue-500" },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-2 mb-1">
            <div className="text-[10px] font-mono text-slate-500 w-14 shrink-0">{label}</div>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-700`}
                style={{ width: `${Math.min(pct * 1.1, 100)}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-slate-500 w-6 text-right">{pct}%</div>
          </div>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {[
          { label: "Solver",   value: decision.solver_status },
          { label: "OR-Tools", value: `${decision.solve_time_ms}ms`, accent: "text-cyan-400" },
          { label: "Distance", value: `${decision.total_distance_km}km` },
          { label: "Stops",    value: String(decision.route_stops.length) },
        ].map(({ label, value, accent }) => (
          <div key={label} className="p-2 bg-slate-900/40 rounded border border-slate-800">
            <div className="text-slate-500 text-[10px] mb-0.5">{label}</div>
            <div className={`font-bold ${accent || "text-slate-200"}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="text-[10px] font-mono text-slate-600">
        {formatTime(decision.timestamp)} · {decision.triggered_by}
      </div>
    </div>
  );
}

// ── Right Panel (tabbed) ──────────────────────────────────────────────────────

export function RightPanel({ alerts, latestDecision, lastMessage }: Props) {
  const [activeTab, setActiveTab] = useState<"alerts" | "decision">("alerts");

  // Auto-switch to decision tab when a new decision arrives
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "ROUTE_DECISION") {
      setActiveTab("decision");
    }
  }, [lastMessage]);

  return (
    <div className="w-[300px] shrink-0 border-l border-slate-800 bg-[#090d15]
                    flex flex-col overflow-hidden">

      {/* Tab headers */}
      <div className="flex shrink-0 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex-1 py-2.5 text-[11px] font-mono font-bold tracking-widest uppercase
                      transition-colors border-b-2
                      ${activeTab === "alerts"
                        ? "text-cyan-400 border-cyan-500 bg-cyan-950/20"
                        : "text-slate-600 border-transparent hover:text-slate-400"
                      }`}
        >
          Alerts
          {alerts.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-900/60
                             text-amber-400 text-[9px]">
              {alerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("decision")}
          className={`flex-1 py-2.5 text-[11px] font-mono font-bold tracking-widest uppercase
                      transition-colors border-b-2
                      ${activeTab === "decision"
                        ? "text-cyan-400 border-cyan-500 bg-cyan-950/20"
                        : "text-slate-600 border-transparent hover:text-slate-400"
                      }`}
        >
          Decision
          {latestDecision && (
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-orange-500
                             inline-block animate-pulse" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {activeTab === "alerts"
          ? <AlertFeed alerts={alerts} />
          : <DecisionView decision={latestDecision} />
        }
      </div>
    </div>
  );
}