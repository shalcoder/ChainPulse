"use client";

import { useEffect, useRef, useState } from "react";
import { WebSocketMessage } from "@/types";

interface TickerEvent {
  id: string;
  time: string;
  text: string;
  color: string;
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
      color: "text-slate-500",
    }]);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastMessage) return;

    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });

    let text = "";
    let color = "text-slate-400";

    const p = lastMessage.payload as any;

    switch (lastMessage.type) {
      case "CONNECTED":
        text = "WebSocket connected — live event stream active";
        color = "text-green-400";
        break;

      case "HEARTBEAT":
        // Skip — too noisy for the ticker
        return;

      case "RISK_ALERT": {
        const level = p.risk_level as string;
        const score = Number(p.risk_score).toFixed(3);
        const reason = p.reason_code || "";
        if (level === "HIGH") {
          text = `⚠ HIGH RISK · ${p.vehicle_id} · score=${score} · ${reason} → OR-Tools triggered`;
          color = "text-red-400";
        } else if (level === "MEDIUM") {
          text = `▲ MEDIUM · ${p.vehicle_id} · score=${score} · ${reason} — monitoring`;
          color = "text-orange-400";
        } else {
          text = `✓ LOW · ${p.vehicle_id} · score=${score} — nominal`;
          color = "text-slate-500";
        }
        break;
      }

      case "VEHICLE_UPDATE": {
        const status = p.status as string;
        const speed = Number(p.speed_kmh).toFixed(0);
        const anomaly = Number(p.anomaly_score).toFixed(3);
        if (status === "ANOMALY") {
          text = `GPS anomaly · ${p.vehicle_id} · speed=${speed}km/h · anomaly_score=${anomaly}`;
          color = "text-amber-400";
        } else {
          text = `GPS · ${p.vehicle_id} · ${speed}km/h · risk=${p.risk_level}`;
          color = "text-slate-500";
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
        color = "text-cyan-400";
        break;
      }

      default:
        text = `${lastMessage.type} received`;
        color = "text-slate-600";
    }

    const entry: TickerEvent = {
      id: `${Date.now()}-${Math.random()}`,
      time,
      text,
      color,
    };

    setEvents((prev) => [entry, ...prev].slice(0, 120));
  }, [lastMessage]);

  // Auto-scroll to top (newest) on new event
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <div className="w-full border-t border-slate-800 bg-slate-950/80 px-3 py-1.5"
         style={{ height: "72px" }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
        <span className="text-xs font-mono text-slate-600 tracking-widest uppercase">
          Event Log
        </span>
        <span className="text-xs font-mono text-slate-700 ml-auto">
          {events.length} events
        </span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-y-auto scrollbar-thin"
        style={{ height: "42px" }}
      >
        {events.map((e) => (
          <div
            key={e.id}
            className="flex items-baseline gap-2 leading-relaxed"
          >
            <span className="text-xs font-mono text-slate-700 shrink-0 w-16">
              {e.time}
            </span>
            <span className={`text-xs font-mono ${e.color} leading-tight`}>
              {e.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}