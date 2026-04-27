"use client";

import { useMemo, useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useFleetState } from "@/hooks/useFleetState";
import { useAlerts } from "@/hooks/useAlerts";
import { MetricsSummary } from "@/components/panels/MetricsSummary";
import { RiskAlertFeed } from "@/components/panels/RiskAlertFeed";
import { FleetStatusPanel } from "@/components/panels/FleetStatusPanel";
import { DecisionPanel } from "@/components/panels/DecisionPanel";
import { ControlTowerMap } from "@/components/map/ControlTowerMap";
import { EventTicker } from "@/components/panels/EventTicker";
import { DemoLauncher } from "@/components/panels/DemoLauncher";
import { computeFleetMetrics } from "@/lib/utils";
import { RouteDecision } from "@/types";

export default function Dashboard() {
  const { connected, lastMessage } = useWebSocket();
  const { vehicles } = useFleetState(lastMessage);
  const { alerts, decisions, reroutes } = useAlerts(lastMessage);

  const metrics = useMemo(() => computeFleetMetrics(vehicles), [vehicles]);
  const latestDecision: RouteDecision | null = decisions[0] ?? null;

  // Client-only date — prevents hydration mismatch
  const [dateDisplay, setDateDisplay] = useState("");
  useEffect(() => {
    setDateDisplay(
      new Date().toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      }).toUpperCase()
    );
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 font-mono">

      {/* ── Top header bar ──────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 relative">
                <div className="absolute inset-0 border-2 border-cyan-500 rotate-45" />
                <div className="absolute inset-1 bg-cyan-500/30 rotate-45" />
              </div>
              <span className="text-sm font-black tracking-[0.15em] text-white uppercase">
                Chain<span className="text-cyan-400">Pulse</span>
              </span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <span className="text-xs text-slate-500 tracking-widest uppercase">
              AI Supply Chain Control Tower
            </span>
          </div>

          <div className="flex items-center gap-4">
            <DemoLauncher />
            <div className="text-xs font-mono text-slate-600 tracking-widest">
              {dateDisplay}
            </div>
          </div>
        </div>

        {/* Metrics bar */}
        <MetricsSummary metrics={metrics} connected={connected} reroutes={reroutes} />
      </header>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-[1fr_280px] grid-rows-1 gap-0 overflow-hidden min-h-0">

        {/* Left: Map + Decision */}
        <div className="grid grid-rows-[1fr_220px] gap-0 overflow-hidden border-r border-slate-800 min-h-0">

          {/* Map */}
          <div className="p-3 overflow-hidden min-h-0">
            <div className="h-full rounded-lg overflow-hidden">
              <ControlTowerMap
                vehicles={vehicles}
                hubs={[]}
                latestDecision={latestDecision}
              />
            </div>
          </div>

          {/* Decision panel — taller to fit breakdown bar */}
          <div className="border-t border-slate-800 p-3 overflow-y-auto">
            <DecisionPanel decision={latestDecision} />
          </div>
        </div>

        {/* Right: Alert feed + Fleet status */}
        <div className="grid grid-rows-[1fr_1fr] overflow-hidden min-h-0">

          {/* Alert feed */}
          <div className="border-b border-slate-800 p-3 overflow-hidden">
            <RiskAlertFeed alerts={alerts} />
          </div>

          {/* Fleet status */}
          <div className="p-3 overflow-hidden">
            <FleetStatusPanel vehicles={vehicles} />
          </div>
        </div>
      </main>

      {/* ── Event ticker — full width bottom bar ────────────────────── */}
      <EventTicker lastMessage={lastMessage} />

    </div>
  );
}