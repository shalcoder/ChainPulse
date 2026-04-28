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
  const [booted, setBooted] = useState(true); // default true — no flash

  useEffect(() => {
    setDateDisplay(
      new Date().toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      }).toUpperCase()
    );
    // Show boot screen only once per browser session
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
    <div className="flex flex-col h-full overflow-hidden font-mono" style={{ background: "var(--bg-base)" }}>
      {!booted && <BootScreen onComplete={handleBootComplete} />}

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <TopBar
        connected={connected}
        metrics={metrics}
        reroutes={reroutes}
        dateDisplay={dateDisplay}
      />

      {/* ── 3-panel main area ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left: Fleet sidebar */}
        <FleetSidebar vehicles={vehicles} metrics={metrics} />

        {/* Center: Full-height map */}
        <div className="flex-1 overflow-hidden relative">
          <ControlTowerMap
            vehicles={vehicles}
            hubs={[]}
            latestDecision={latestDecision}
          />
        </div>

        {/* Right: Tabbed alerts + decision */}
        <RightPanel
          alerts={alerts}
          latestDecision={latestDecision}
          lastMessage={lastMessage}
        />
      </div>

      {/* ── Event ticker ─────────────────────────────────────────── */}
      <EventTicker lastMessage={lastMessage} />
    </div>
  );
}