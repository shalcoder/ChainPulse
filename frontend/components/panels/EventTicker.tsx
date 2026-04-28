"use client";

import { useEffect, useRef, useState } from "react";
import { WebSocketMessage } from "@/types";

interface TickerEvent {
  id: string;
  time: string;
  text: string;
  colorVar: string;
}

interface Props {
  lastMessage: WebSocketMessage | null;
}

export function EventTicker({ lastMessage }: Props) {
  const [events, setEvents] = useState<TickerEvent[]>([]);

  useEffect(() => {
    setEvents([{
      id: "boot",
      time: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      text: "ChainPulse Control Tower initialised — awaiting event stream",
      colorVar: "var(--text-muted)",
    }]);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastMessage) return;

    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });

    let text = "";
    let colorVar = "var(--text-secondary)";

    const p = lastMessage.payload as any;

    switch (lastMessage.type) {
      case "CONNECTED":
        text = "WebSocket connected — live event stream active";
        colorVar = "var(--status-ok)";
        break;
      case "HEARTBEAT":
        return;
      case "RISK_ALERT": {
        const level = p.risk_level as string;
        const score = Number(p.risk_score).toFixed(3);
        const reason = p.reason_code || "";
        if (level === "HIGH") {
          text = `⚠ HIGH RISK · ${p.vehicle_id} · score=${score} · ${reason} → OR-Tools triggered`;
          colorVar = "var(--risk-high)";
        } else if (level === "MEDIUM") {
          text = `▲ MEDIUM · ${p.vehicle_id} · score=${score} · ${reason} — monitoring`;
          colorVar = "var(--risk-medium)";
        } else {
          text = `✓ LOW · ${p.vehicle_id} · score=${score} — nominal`;
          colorVar = "var(--text-muted)";
        }
        break;
      }
      case "VEHICLE_UPDATE": {
        const status = p.status as string;
        const speed = Number(p.speed_kmh).toFixed(0);
        const anomaly = Number(p.anomaly_score).toFixed(3);
        if (status === "ANOMALY") {
          text = `GPS anomaly · ${p.vehicle_id} · speed=${speed}km/h · anomaly_score=${anomaly}`;
          colorVar = "var(--status-warn)";
        } else {
          text = `GPS · ${p.vehicle_id} · ${speed}km/h · risk=${p.risk_level}`;
          colorVar = "var(--text-muted)";
        }
        break;
      }
      case "ROUTE_DECISION": {
        const stops = Array.isArray(p.route_stops) ? p.route_stops.length : "?";
        const saved = Number(p.eta_delta_min);
        const solveMs = p.solve_time_ms ?? "?";
        text = `✦ REROUTE · ${p.vehicle_id} · ${p.reason_code} · `
          + `OR-Tools=${solveMs}ms · stops=${stops} · `
          + `ETA ${saved > 0 ? `−${saved}m saved` : `+${Math.abs(saved)}m added`} `
          + `· status=${p.solver_status}`;
        colorVar = "var(--accent)";
        break;
      }
      default:
        text = `${lastMessage.type} received`;
        colorVar = "var(--text-muted)";
    }

    setEvents((prev) => [{
      id: `${Date.now()}-${Math.random()}`,
      time,
      text,
      colorVar,
    }, ...prev].slice(0, 120));
  }, [lastMessage]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events]);

  return (
    <div
      className="w-full px-3 py-1.5"
      style={{
        height: "72px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "var(--accent)" }}
        />
        <span
          className="text-xs font-mono tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Event Log
        </span>
        <span
          className="text-xs font-mono ml-auto"
          style={{ color: "var(--text-disabled)" }}
        >
          {events.length} events
        </span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-y-auto scrollbar-thin"
        style={{ height: "42px" }}
      >
        {events.map((e) => (
          <div key={e.id} className="flex items-baseline gap-2 leading-relaxed">
            <span
              className="text-xs font-mono shrink-0 w-16"
              style={{ color: "var(--text-disabled)" }}
            >
              {e.time}
            </span>
            <span
              className="text-xs font-mono leading-tight"
              style={{ color: e.colorVar }}
            >
              {e.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}