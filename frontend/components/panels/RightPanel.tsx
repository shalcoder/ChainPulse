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

function AlertFeed({ alerts }: { alerts: RiskAlert[] }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
      {alerts.length === 0 && (
        <div
          className="flex items-center justify-center h-32 text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          — system nominal —
        </div>
      )}
      {alerts.map((alert) => (
        <div
          key={alert.alert_id}
          className="rounded transition-colors p-2.5"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "var(--border-strong)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--border)")
          }
        >
          <div className="flex items-center justify-between mb-1.5">
            <RiskBadge level={alert.risk_level} score={alert.risk_score} />
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              {formatTime(alert.timestamp)}
            </span>
          </div>
          <div
            className="text-xs font-mono leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
              {alert.vehicle_id}
            </span>
            {" — "}
            {alert.message || alert.reason_code}
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionView({ decision }: { decision: RouteDecision | null }) {
  if (!decision) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-xs font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        — awaiting optimization trigger —
      </div>
    );
  }

  const saved = decision.eta_delta_min;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">

      {/* Vehicle + risk badge */}
      <div className="flex items-center justify-between">
        <span
          className="text-sm font-mono font-black"
          style={{ color: "var(--text-primary)" }}
        >
          {decision.vehicle_id}
        </span>
        <RiskBadge level={decision.risk_level} score={decision.risk_score} />
      </div>

      {/* ETA comparison */}
      <div
        className="grid grid-cols-3 p-3 rounded text-center"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <div
            className="text-[10px] font-mono mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            OLD ETA
          </div>
          <div
            className="text-sm font-mono font-bold line-through"
            style={{ color: "var(--text-secondary)" }}
          >
            {decision.old_eta_min}m
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <div
            className="text-sm font-mono font-black"
            style={{ color: saved > 0 ? "var(--risk-low)" : "var(--risk-high)" }}
          >
            {saved > 0 ? `−${saved}m` : `+${Math.abs(saved)}m`}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            {saved > 0 ? "saved" : "added"}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            NEW ETA
          </div>
          <div
            className="text-sm font-mono font-bold"
            style={{ color: "var(--risk-low)" }}
          >
            {decision.new_eta_min}m
          </div>
        </div>
      </div>

      {/* Reason */}
      <div
        className="p-2.5 rounded"
        style={{
          border: "1px solid var(--risk-medium-border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div
          className="text-xs font-mono font-bold mb-1"
          style={{ color: "var(--status-warn)" }}
        >
          {decision.reason_code}
        </div>
        <div
          className="text-xs font-mono leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {decision.reason_description}
        </div>
      </div>

      {/* Confidence + model */}
      {decision.confidence_pct !== undefined && (
        <div
          className="p-2.5 rounded"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <div
            className="text-[10px] font-mono mb-2 tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            ML CONFIDENCE
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-base)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${decision.confidence_pct}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
            <span
              className="text-xs font-mono font-bold w-8 text-right"
              style={{ color: "var(--accent)" }}
            >
              {decision.confidence_pct}%
            </span>
          </div>
          <div
            className="text-[10px] font-mono mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {decision.model_used === "xgboost"
              ? "XGBoost classifier"
              : "Heuristic fallback"}
          </div>
        </div>
      )}

      {/* Risk breakdown */}
      <div
        className="p-2.5 rounded"
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div
          className="text-[10px] font-mono mb-2 tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          RISK BREAKDOWN
        </div>
        {[
          { label: "DELAY",   pct: Math.round(decision.risk_score * 45), color: "var(--risk-high)" },
          { label: "ANOMALY", pct: Math.round(decision.risk_score * 25), color: "var(--risk-medium)" },
          { label: "SLA",     pct: Math.round(decision.risk_score * 20), color: "var(--status-warn)" },
          { label: "WEATHER", pct: Math.round(decision.risk_score * 10), color: "var(--accent)" },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-2 mb-1">
            <div
              className="text-[10px] font-mono w-14 shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </div>
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-base)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(pct * 1.1, 100)}%`,
                  background: color,
                }}
              />
            </div>
            <div
              className="text-[10px] font-mono w-6 text-right"
              style={{ color: "var(--text-muted)" }}
            >
              {pct}%
            </div>
          </div>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {[
          { label: "Solver",   value: decision.solver_status, accent: false },
          { label: "OR-Tools", value: `${decision.solve_time_ms}ms`, accent: true },
          { label: "Distance", value: `${decision.total_distance_km}km`, accent: false },
          { label: "Stops",    value: String(decision.route_stops.length), accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="p-2 rounded"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="text-[10px] mb-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </div>
            <div
              className="font-bold"
              style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div
        className="text-[10px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        {formatTime(decision.timestamp)} · {decision.triggered_by}
      </div>
    </div>
  );
}

export function RightPanel({ alerts, latestDecision, lastMessage }: Props) {
  const [activeTab, setActiveTab] = useState<"alerts" | "decision">("alerts");

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "ROUTE_DECISION") {
      setActiveTab("decision");
    }
  }, [lastMessage]);

  return (
    <div
      className="w-[300px] shrink-0 flex flex-col overflow-hidden"
      style={{
        borderLeft: "1px solid var(--border)",
        background: "var(--sidebar-bg)",
      }}
    >
      {/* Tab headers */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {(["alerts", "decision"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 text-[11px] font-mono font-bold tracking-widest
                       uppercase transition-colors duration-150"
            style={{
              color:
                activeTab === tab ? "var(--accent)" : "var(--text-muted)",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              background:
                activeTab === tab ? "var(--accent-glow)" : "transparent",
            }}
          >
            {tab === "alerts" ? "Alerts" : "Decision"}
            {tab === "alerts" && alerts.length > 0 && (
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px]"
                style={{
                  background: "var(--risk-medium-bg)",
                  color: "var(--status-warn)",
                }}
              >
                {alerts.length}
              </span>
            )}
            {tab === "decision" && latestDecision && (
              <span
                className="ml-1.5 w-1.5 h-1.5 rounded-full inline-block animate-pulse"
                style={{ background: "var(--risk-medium)" }}
              />
            )}
          </button>
        ))}
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