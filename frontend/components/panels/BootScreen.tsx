"use client";

import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

const STEPS = [
  { text: "Initialising ChainPulse Control Tower...", duration: 400 },
  { text: "Loading XGBoost delay prediction model...", duration: 500 },
  { text: "Loading IsolationForest anomaly detector...", duration: 450 },
  { text: "Connecting to Kafka event stream...", duration: 400 },
  { text: "Establishing PostgreSQL connection...", duration: 350 },
  { text: "Mounting OR-Tools VRPTW solver...", duration: 400 },
  { text: "Opening WebSocket channel...", duration: 300 },
  { text: "All systems nominal. Launching dashboard...", duration: 400 },
];

export function BootScreen({ onComplete }: Props) {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let elapsed = 0;

    STEPS.forEach((step, i) => {
      setTimeout(() => {
        setVisibleSteps((prev) => [...prev, i]);
        setProgress(Math.round(((i + 1) / STEPS.length) * 100));
        if (i === STEPS.length - 1) {
          setTimeout(() => {
            setDone(true);
            setTimeout(onComplete, 400);
          }, 300);
        }
      }, elapsed);
      elapsed += step.duration;
    });
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center
                  transition-opacity duration-500
                  ${done ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ background: "var(--bg-base)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="relative w-10 h-10">
          <div
            className="absolute inset-0 border-2 rotate-45 rounded-sm"
            style={{ borderColor: "var(--accent)" }}
          />
          <div
            className="absolute inset-[3px] rotate-45 rounded-sm"
            style={{ background: "var(--accent-glow)" }}
          />
          <div
            className="absolute inset-[7px] rotate-45 rounded-sm"
            style={{ background: "var(--accent)" }}
          />
        </div>
        <div>
          <div
            className="text-xl font-black tracking-[0.15em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            Chain
            <span style={{ color: "var(--accent)" }}>Pulse</span>
          </div>
          <div
            className="text-[10px] font-mono tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            AI Supply Chain Control Tower
          </div>
        </div>
      </div>

      {/* Boot log */}
      <div
        className="w-[90vw] max-w-[480px] rounded-lg p-4 mb-6 font-mono text-xs space-y-1.5"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        {STEPS.map((step, i) => {
          const isActive =
            i === visibleSteps[visibleSteps.length - 1] && !done;
          const isVisible = visibleSteps.includes(i);
          const isLast = i === STEPS.length - 1;

          return (
            <div
              key={i}
              className="flex items-center gap-2 transition-opacity duration-300"
              style={{ opacity: isVisible ? 1 : 0 }}
            >
              <span
                className={`shrink-0 ${isActive ? "animate-pulse" : ""}`}
                style={{
                  color: isActive ? "var(--accent)" : "var(--status-ok)",
                }}
              >
                {isActive ? "►" : "✓"}
              </span>
              <span
                style={{
                  color:
                    isLast && isVisible
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                }}
              >
                {step.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-[90vw] max-w-[480px]">
        <div
          className="flex justify-between text-[10px] font-mono mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          <span>SYSTEM BOOT</span>
          <span>{progress}%</span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "var(--bg-elevated)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}