"use client";

import { useMemo, useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useFleetState } from "@/hooks/useFleetState";
import { useAlerts } from "@/hooks/useAlerts";
import { ControlTowerMap } from "@/components/map/ControlTowerMap";
import { BootScreen } from "@/components/panels/BootScreen";
import { FleetSidebar } from "@/components/panels/FleetSidebar";
import { RightPanel } from "@/components/panels/RightPanel";
import { TopBar } from "@/components/panels/TopBar";
import { EventTicker } from "@/components/panels/EventTicker";
import { computeFleetMetrics } from "@/lib/utils";
import { RouteDecision } from "@/types";

export default function Dashboard() {
  const { connected, lastMessage } = useWebSocket();
  const { vehicles } = useFleetState(lastMessage);
  const { alerts, decisions, reroutes } = useAlerts(lastMessage);

  const metrics = useMemo(() => computeFleetMetrics(vehicles), [vehicles]);
  const latestDecision: RouteDecision | null = decisions[0] ?? null;

  const [dateDisplay, setDateDisplay] = useState("");
  const [booted, setBooted] = useState(true);

  // Mobile bottom sheet state — which panel is open on small screens
  const [mobilePanel, setMobilePanel] = useState<"none" | "fleet" | "alerts">("none");

  useEffect(() => {
    setDateDisplay(
      new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).toUpperCase()
    );
    const alreadyBooted = sessionStorage.getItem("chainpulse-booted");
    if (!alreadyBooted) {
      setBooted(false);
    }
  }, []);

  function handleBootComplete() {
    sessionStorage.setItem("chainpulse-booted", "1");
    setBooted(true);
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden font-mono"
      style={{ background: "var(--bg-base)" }}
    >
      {!booted && <BootScreen onComplete={handleBootComplete} />}

      {/* ── Top bar ─────────────────────────────────────────────── */}
      {/* On mobile, add left padding so it doesn't clash with the
          floating hamburger button from AppShell */}
      <div className="sm:pl-0 pl-12">
        <TopBar
          connected={connected}
          metrics={metrics}
          reroutes={reroutes}
          dateDisplay={dateDisplay}
        />
      </div>

      {/* ── 3-panel main area ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left fleet sidebar — md+ only */}
        <div className="hidden md:flex">
          <FleetSidebar vehicles={vehicles} metrics={metrics} />
        </div>

        {/* Center + mobile stack */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Map — fixed height on mobile, flex-1 on desktop */}
          <div
            className="w-full shrink-0 md:flex-1 md:shrink md:h-auto overflow-hidden"
            style={{ height: "55vw", maxHeight: "420px" }}
          >
            {/* On md+ override inline height with h-full via a wrapper */}
            <div className="hidden md:block h-full">
              <ControlTowerMap
                vehicles={vehicles}
                hubs={[]}
                latestDecision={latestDecision}
              />
            </div>
            {/* Mobile map — fixed height */}
            <div className="md:hidden w-full h-full">
              <ControlTowerMap
                vehicles={vehicles}
                hubs={[]}
                latestDecision={latestDecision}
              />
            </div>
          </div>

          {/* Mobile-only stacked panels below the map */}
          <div
            className="md:hidden flex-1 overflow-y-auto scrollbar-thin"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {/* Fleet section */}
            <div
              className="px-3 py-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div
                className="text-[10px] font-mono font-bold tracking-widest
                           uppercase mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                ⬡ Fleet Status — {vehicles.length} vehicles
              </div>
              <div className="space-y-1.5">
                {[...vehicles]
                  .sort((a, b) => b.risk_score - a.risk_score)
                  .slice(0, 8)
                  .map((v) => {
                    const color =
                      v.risk_level === "HIGH"
                        ? "var(--risk-high)"
                        : v.risk_level === "MEDIUM"
                          ? "var(--risk-medium)"
                          : "var(--risk-low)";
                    return (
                      <div
                        key={v.vehicle_id}
                        className="flex items-center gap-3 rounded px-3 py-2"
                        style={{
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <span
                          className="text-xs font-mono font-bold flex-1"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {v.vehicle_id}
                        </span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color }}
                        >
                          {v.risk_level}
                        </span>
                        <div
                          className="w-16 h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--bg-elevated)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${v.risk_score * 100}%`,
                              background: color,
                            }}
                          />
                        </div>
                        <span
                          className="text-[10px] font-mono w-8 text-right"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {v.speed_kmh}
                        </span>
                      </div>
                    );
                  })}
                {vehicles.length > 8 && (
                  <p
                    className="text-[10px] font-mono text-center py-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    +{vehicles.length - 8} more — see Fleet Monitor
                  </p>
                )}
              </div>
            </div>

            {/* Alerts section */}
            <div className="px-3 py-2">
              <div
                className="text-[10px] font-mono font-bold tracking-widest
                           uppercase mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                ◈ Alerts — {alerts.length} active
              </div>
              <RightPanel
                alerts={alerts}
                latestDecision={latestDecision}
                lastMessage={lastMessage}
              />
            </div>
          </div>
        </div>

        {/* Right panel — lg+ only */}
        <div className="hidden lg:flex">
          <RightPanel
            alerts={alerts}
            latestDecision={latestDecision}
            lastMessage={lastMessage}
          />
        </div>
      </div>

      {/* ── Event ticker ─────────────────────────────────────────── */}
      {/* Hidden on mobile — too small to be useful, shown sm+ */}
      <div className="hidden sm:block">
        <EventTicker lastMessage={lastMessage} />
      </div>
    </div>
  );
}