"use client";

import { RiskAlert } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatTime } from "@/lib/utils";

interface Props {
  alerts: RiskAlert[];
}

export function RiskAlertFeed({ alerts }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">
          Live Alert Feed
        </h2>
        <span className="text-xs font-mono text-slate-500">{alerts.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
        {alerts.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-xs font-mono">
            — system nominal —
          </div>
        )}
        {alerts.map((alert) => (
          <div
            key={alert.alert_id}
            className="group border border-slate-800 bg-slate-900/60 rounded p-2.5 hover:border-slate-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <RiskBadge level={alert.risk_level} score={alert.risk_score} />
              <span className="text-xs font-mono text-slate-500 shrink-0">
                {formatTime(alert.timestamp)}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-300 leading-relaxed">
              <span className="text-cyan-500">{alert.vehicle_id}</span>
              {" — "}
              {alert.message || alert.reason_code}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}