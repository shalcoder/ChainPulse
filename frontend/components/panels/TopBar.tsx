"use client";

import { useEffect, useRef, useState } from "react";
import { FleetMetrics } from "@/types";
import { DemoLauncher } from "@/components/panels/DemoLauncher";

interface Props {
  connected: boolean;
  metrics: FleetMetrics;
  reroutes: number;
  dateDisplay: string;
}

// Animated counter — smoothly counts from previous value to new value
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
      // Ease out cubic
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
    <div className={`flex flex-col items-center px-4 py-1.5 border-r border-slate-800
                     last:border-r-0 transition-colors duration-300
                     ${flashing ? "bg-red-950/30" : ""}`}>
      <span className={`text-lg font-black tabular-nums transition-colors duration-300
                        ${color || "text-white"}
                        ${flashing ? "scale-110" : ""}`}>
        {displayValue}
        {unit && (
          <span className="text-xs font-normal text-slate-500 ml-0.5">{unit}</span>
        )}
      </span>
      <span className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mt-0.5">
        {label}
      </span>
    </div>
  );
}

export function TopBar({ connected, metrics, reroutes, dateDisplay }: Props) {
  return (
    <header className="shrink-0 border-b border-slate-800 bg-[#080c14]/95 backdrop-blur">

      {/* Row 1 — branding + demo + date */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
        <div className="flex items-center gap-3">

          {/* Logo mark */}
          <div className="relative w-7 h-7 shrink-0">
            <div className="absolute inset-0 border-2 border-cyan-500 rotate-45 rounded-sm" />
            <div className="absolute inset-[3px] bg-cyan-500/20 rotate-45 rounded-sm" />
            <div className="absolute inset-[6px] bg-cyan-400 rotate-45 rounded-sm" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-base font-black tracking-[0.12em] text-white uppercase">
              Chain<span className="text-cyan-400">Pulse</span>
            </span>
            <span className="text-[10px] text-slate-600 tracking-widest uppercase hidden sm:block">
              AI Supply Chain Control Tower
            </span>
          </div>

          {/* Live indicator */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono
            ${connected
              ? "border-green-800 bg-green-950/40 text-green-400"
              : "border-red-800 bg-red-950/40 text-red-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full
              ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {connected ? "LIVE" : "OFFLINE"}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DemoLauncher />
          <span className="text-[10px] font-mono text-slate-600 tracking-widest hidden md:block">
            {dateDisplay}
          </span>
        </div>
      </div>

      {/* Row 2 — animated metrics strip */}
      <div className="flex items-stretch divide-x divide-slate-800">
        <MetricPill
          label="Fleet"
          value={metrics.total_vehicles}
        />
        <MetricPill
          label="High Risk"
          value={metrics.high_risk_count}
          color="text-red-400"
          flash
        />
        <MetricPill
          label="Medium"
          value={metrics.medium_risk_count}
          color="text-orange-400"
        />
        <MetricPill
          label="Alerts"
          value={metrics.active_alerts}
          color="text-amber-400"
          flash
        />
        <MetricPill
          label="SLA Hit"
          value={metrics.sla_hit_rate.toFixed(1)}
          unit="%"
          color="text-cyan-400"
        />
        <MetricPill
          label="Reroutes"
          value={reroutes}
          color="text-violet-400"
          flash
        />
      </div>
    </header>
  );
}