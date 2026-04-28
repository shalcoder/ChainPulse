"use client";

import { useEffect, useState } from "react";

export interface DemoStep {
  label: string;
  detail: string;
  durationMs: number;
  icon: string;
  color: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    icon: "⛈",
    color: "var(--accent)",
    label: "Injecting weather alert",
    detail: "3 vehicles in storm zone — risk scores rising",
    durationMs: 3000,
  },
  {
    icon: "◎",
    color: "#a78bfa",
    label: "Anomaly detected",
    detail: "IsolationForest flagged GPS deviation on V-07",
    durationMs: 2500,
  },
  {
    icon: "⊕",
    color: "var(--status-warn)",
    label: "Risk threshold crossed",
    detail: "RiskScore 0.82 > 0.70 — triggering OR-Tools",
    durationMs: 2000,
  },
  {
    icon: "⊞",
    color: "var(--risk-medium)",
    label: "Route optimising",
    detail: "VRPTW solver running — 10s time limit",
    durationMs: 4000,
  },
  {
    icon: "⇌",
    color: "var(--status-ok)",
    label: "Decision dispatched",
    detail: "New route pushed — ETA saved: 18 min",
    durationMs: 2000,
  },
];

interface Props {
  running: boolean;
  onComplete: () => void;
}

export function DemoProgressOverlay({ running, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0); // 0–100
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) {
      setCurrentStep(0);
      setStepProgress(0);
      setDone(false);
      return;
    }

    let stepIdx = 0;
    let cancelled = false;

    function runStep(idx: number) {
      if (cancelled || idx >= DEMO_STEPS.length) {
        if (!cancelled) {
          setDone(true);
          setTimeout(onComplete, 1200);
        }
        return;
      }

      setCurrentStep(idx);
      setStepProgress(0);
      setDone(false);

      const duration = DEMO_STEPS[idx].durationMs;
      const interval = 50; // ms per tick
      const ticks = duration / interval;
      let tick = 0;

      const timer = setInterval(() => {
        tick++;
        setStepProgress(Math.min((tick / ticks) * 100, 100));
        if (tick >= ticks) {
          clearInterval(timer);
          runStep(idx + 1);
        }
      }, interval);
    }

    runStep(0);

    return () => {
      cancelled = true;
    };
  }, [running]);

  if (!running && !done) return null;

  const step = DEMO_STEPS[currentStep] ?? DEMO_STEPS[DEMO_STEPS.length - 1];
  const totalProgress =
    ((currentStep + stepProgress / 100) / DEMO_STEPS.length) * 100;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl overflow-hidden
                 shadow-2xl"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse shrink-0"
          style={{ background: "var(--risk-high)" }}
        />
        <span
          className="text-[10px] font-mono font-bold tracking-widest uppercase flex-1"
          style={{ color: "var(--text-primary)" }}
        >
          Demo Running
        </span>
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          {currentStep + 1}/{DEMO_STEPS.length}
        </span>
      </div>

      {/* Step list */}
      <div className="px-4 py-3 space-y-2">
        {DEMO_STEPS.map((s, i) => {
          const isActive = i === currentStep && !done;
          const isDone = i < currentStep || done;

          return (
            <div
              key={i}
              className="flex items-center gap-3 transition-all duration-300"
              style={{ opacity: i > currentStep && !done ? 0.35 : 1 }}
            >
              {/* Icon */}
              <span
                className="text-base w-5 text-center shrink-0"
                style={{
                  color: isDone
                    ? "var(--status-ok)"
                    : isActive
                    ? s.color
                    : "var(--text-disabled)",
                }}
              >
                {isDone ? "✓" : s.icon}
              </span>

              {/* Label + progress bar */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[11px] font-mono font-bold truncate"
                  style={{
                    color: isDone
                      ? "var(--text-muted)"
                      : isActive
                      ? "var(--text-primary)"
                      : "var(--text-disabled)",
                  }}
                >
                  {s.label}
                </div>
                {isActive && (
                  <div
                    className="h-0.5 rounded-full mt-1 overflow-hidden"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-100"
                      style={{
                        width: `${stepProgress}%`,
                        background: s.color,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      <div
        className="px-4 pb-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="flex justify-between text-[9px] font-mono mb-1.5 pt-3"
          style={{ color: "var(--text-muted)" }}
        >
          <span>OVERALL PROGRESS</span>
          <span>{Math.round(totalProgress)}%</span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "var(--bg-elevated)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${done ? 100 : totalProgress}%`,
              background: done ? "var(--status-ok)" : "var(--accent)",
              boxShadow: done
                ? "0 0 8px var(--status-ok)"
                : "0 0 8px var(--accent)",
            }}
          />
        </div>
        {done && (
          <div
            className="text-[10px] font-mono text-center mt-2 font-bold
                       tracking-widest uppercase"
            style={{ color: "var(--status-ok)" }}
          >
            ✓ Demo Complete
          </div>
        )}
      </div>
    </div>
  );
}