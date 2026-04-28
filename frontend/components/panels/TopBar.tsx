"use client";

import { useEffect, useRef, useState } from "react";
import { FleetMetrics } from "@/types";
import { DemoLauncher } from "@/components/panels/DemoLauncher";

interface Props {
  connected: boolean;
  metrics: FleetMetrics;
  reroutes: number;
  dateDisplay: string;
  onDemoStateChange?: (state: "idle" | "running" | "done" | "error") => void;
}

function useAnimatedValue(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

function MetricPill({
  label, value, unit, color, flash,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color?: string;
  flash?: boolean;
}) {
  const numericValue = typeof value === "number" ? value : parseFloat(value as string);
  const isNumeric = !isNaN(numericValue) && unit !== "%";
  const animated = useAnimatedValue(isNumeric ? numericValue : 0);
  const [flashing, setFlashing] = useState(false);
  const prevVal = useRef(numericValue);

  useEffect(() => {
    if (!flash) return;
    if (numericValue !== prevVal.current && numericValue > prevVal.current) {
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 800);
      prevVal.current = numericValue;
      return () => clearTimeout(t);
    }
    prevVal.current = numericValue;
  }, [numericValue, flash]);

  const displayValue = isNumeric
    ? animated
    : typeof value === "number"
      ? value.toFixed(1)
      : value;

  return (
    <div
      className="flex flex-col items-center px-4 py-1.5 last:border-r-0
                 transition-colors duration-300"
      style={{
        borderRight: "1px solid var(--border)",
        background: flashing ? "rgba(239,68,68,0.08)" : "transparent",
      }}
    >
      <span
        className="text-lg font-black tabular-nums transition-colors duration-300"
        style={{ color: color || "var(--text-primary)" }}
      >
        {displayValue}
        {unit && (
          <span className="text-xs font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        )}
      </span>
      <span
        className="text-[10px] font-mono tracking-widest uppercase mt-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

export function TopBar({ connected, metrics, reroutes, dateDisplay, onDemoStateChange }: Props) {
  return (
    <header
      className="shrink-0 border-b backdrop-blur"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Row 1 — status + demo + date */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Left — page title + live indicator */}
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-mono font-bold tracking-widest uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            Control Tower
          </span>

          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono"
            style={
              connected
                ? {
                    borderColor: "var(--status-ok)",
                    background: "rgba(74,222,128,0.06)",
                    color: "var(--status-ok)",
                  }
                : {
                    borderColor: "var(--status-error)",
                    background: "rgba(248,113,113,0.06)",
                    color: "var(--status-error)",
                  }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: connected ? "var(--status-ok)" : "var(--status-error)",
                animation: connected ? "pulse 2s infinite" : "none",
              }}
            />
            {connected ? "LIVE" : "OFFLINE"}
          </div>
        </div>

        {/* Right — demo launcher + date */}
        <div className="flex items-center gap-4">
          <DemoLauncher onStateChange={onDemoStateChange} />
          <span
            className="text-[10px] font-mono tracking-widest hidden md:block"
            style={{ color: "var(--text-muted)" }}
          >
            {dateDisplay}
          </span>
        </div>
      </div>

      {/* Row 2 — animated metrics strip */}
      <div className="flex items-stretch" style={{ borderColor: "var(--border)" }}>
        <MetricPill label="Fleet"     value={metrics.total_vehicles} />
        <MetricPill label="High Risk" value={metrics.high_risk_count}
          color="var(--risk-high)" flash />
        <MetricPill label="Medium"    value={metrics.medium_risk_count}
          color="var(--risk-medium)" />
        <MetricPill label="Alerts"    value={metrics.active_alerts}
          color="var(--status-warn)" flash />
        <MetricPill label="SLA Hit"   value={metrics.sla_hit_rate.toFixed(1)}
          unit="%" color="var(--accent)" />
        <MetricPill label="Reroutes"  value={reroutes}
          color="#a78bfa" flash />
      </div>
    </header>
  );
}