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
      {/* Desktop/tablet: all 3 panels side by side.
          Mobile: only map + bottom sheet toggle buttons. */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">

        {/* Left fleet sidebar — hidden on mobile, shown md+ */}
        <div className="hidden md:flex">
          <FleetSidebar vehicles={vehicles} metrics={metrics} />
        </div>

        {/* Center: Full-height map — always visible */}
        <div className="flex-1 overflow-hidden relative">
          <ControlTowerMap
            vehicles={vehicles}
            hubs={[]}
            latestDecision={latestDecision}
          />

          {/* ── Mobile panel toggle buttons ─────────────────────── */}
          {/* Floats above the map on xs/sm screens only */}
          <div
            className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-20
                        flex items-center gap-2"
          >
            <button
              onClick={() =>
                setMobilePanel((p) => (p === "fleet" ? "none" : "fleet"))
              }
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px]
                         font-mono font-bold tracking-widest uppercase
                         transition-all duration-200 shadow-lg"
              style={{
                background:
                  mobilePanel === "fleet"
                    ? "var(--accent)"
                    : "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                color:
                  mobilePanel === "fleet"
                    ? "var(--bg-base)"
                    : "var(--text-primary)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              ⬡ Fleet
            </button>

            <button
              onClick={() =>
                setMobilePanel((p) => (p === "alerts" ? "none" : "alerts"))
              }
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px]
                         font-mono font-bold tracking-widest uppercase
                         transition-all duration-200 shadow-lg"
              style={{
                background:
                  mobilePanel === "alerts"
                    ? "var(--accent)"
                    : "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                color:
                  mobilePanel === "alerts"
                    ? "var(--bg-base)"
                    : "var(--text-primary)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              ◈ Alerts
              {alerts.length > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-[9px] flex items-center
                             justify-center font-black"
                  style={{
                    background: "var(--risk-high)",
                    color: "#fff",
                  }}
                >
                  {alerts.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Mobile bottom sheet ─────────────────────────────── */}
          {mobilePanel !== "none" && (
            <div
              className="md:hidden absolute bottom-0 left-0 right-0 z-20
                          rounded-t-2xl overflow-hidden flex flex-col"
              style={{
                height: "55vh",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {/* Drag handle + close */}
              <div
                className="flex items-center justify-between px-4 py-2 shrink-0"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div
                  className="w-10 h-1 rounded-full mx-auto"
                  style={{ background: "var(--border-strong)" }}
                />
                <button
                  onClick={() => setMobilePanel("none")}
                  className="text-xs font-mono shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden min-h-0">
                {mobilePanel === "fleet" && (
                  <FleetSidebar vehicles={vehicles} metrics={metrics} />
                )}
                {mobilePanel === "alerts" && (
                  <RightPanel
                    alerts={alerts}
                    latestDecision={latestDecision}
                    lastMessage={lastMessage}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — hidden on mobile, shown lg+ */}
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