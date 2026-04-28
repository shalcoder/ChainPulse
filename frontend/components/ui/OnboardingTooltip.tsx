"use client";

import { useEffect, useState } from "react";

interface TooltipStep {
  targetId: string;
  title: string;
  body: string;
  position: "bottom" | "left" | "top" | "right";
}

const STEPS: TooltipStep[] = [
  {
    targetId: "onboard-map",
    title: "Live Fleet Map",
    body: "20 vehicles moving in real time. Colors show risk level — green is safe, orange is medium risk, red needs immediate action.",
    position: "top",
  },
  {
    targetId: "onboard-alerts",
    title: "Risk Alert Feed",
    body: "Every disruption event appears here instantly — weather alerts, GPS anomalies, hub congestion, and SLA breach risks.",
    position: "left",
  },
  {
    targetId: "onboard-alerts",
    title: "AI Decision Panel",
    body: "When risk crosses the HIGH threshold (0.70), OR-Tools automatically calculates a new route. Old ETA vs new ETA shown here with full reason code.",
    position: "left",
  },
  {
    targetId: "onboard-demo",
    title: "Start the Demo",
    body: "Click START DEMO to inject a live disruption sequence — weather alert → GPS anomaly → auto-reroute. Takes 30 seconds.",
    position: "bottom",
  },
];

const STORAGE_KEY = "chainpulse-onboarded";

function getTargetRect(id: string): DOMRect | null {
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect() : null;
}

function TooltipBox({
  step,
  stepIndex,
  total,
  onNext,
  onSkip,
  rect,
}: {
  step: TooltipStep;
  stepIndex: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  rect: DOMRect | null;
}) {
  // Position the tooltip near the target element
  let style: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    maxWidth: 300,
    pointerEvents: "auto",
  };

  const GAP = 16;

  if (rect) {
    switch (step.position) {
      case "bottom":
        style.top = rect.bottom + GAP;
        style.left = Math.min(
          Math.max(rect.left + rect.width / 2 - 150, 12),
          window.innerWidth - 312
        );
        break;
      case "left":
        style.top = Math.min(
          Math.max(rect.top + rect.height / 2 - 80, 12),
          window.innerHeight - 200
        );
        style.right = window.innerWidth - rect.left + GAP;
        break;
      case "top":
        style.bottom = Math.max(window.innerHeight - rect.top + GAP, GAP);
        style.left = Math.min(
          Math.max(rect.left + rect.width / 2 - 150, 12),
          window.innerWidth - 312
        );
        break;
      case "right":
        style.top = Math.min(
          Math.max(rect.top + rect.height / 2 - 80, 12),
          window.innerHeight - 200
        );
        style.left = rect.right + GAP;
        break;
    }
    // Safety clamp — never let tooltip go below viewport
    if (style.top !== undefined && typeof style.top === "number") {
      style.top = Math.min(style.top, window.innerHeight - 220);
    }
  } else {
    // Fallback — center of screen
    style.top = "50%";
    style.left = "50%";
    style.transform = "translate(-50%, -50%)";
  }

  const isLast = stepIndex === total - 1;

  return (
    <div style={style}>
      <div
        className="rounded-xl p-4 shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          border: "2px solid var(--accent)",
          boxShadow: "0 0 32px var(--accent-glow), 0 8px 32px rgba(0,0,0,0.4)",
          minWidth: 260,
        }}
      >
        {/* Step counter */}
        <div
          className="flex items-center justify-between mb-3"
        >
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-1 rounded-full transition-all duration-300"
                style={{
                  background:
                    i === stepIndex
                      ? "var(--accent)"
                      : i < stepIndex
                      ? "var(--accent-dim)"
                      : "var(--bg-elevated)",
                }}
              />
            ))}
          </div>
          <button
            onClick={onSkip}
            className="text-[10px] font-mono uppercase tracking-widest
                       transition-colors duration-150 ml-4"
            style={{ color: "var(--text-disabled)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-disabled)")
            }
          >
            Skip
          </button>
        </div>

        {/* Content */}
        <div
          className="text-xs font-mono font-black mb-1.5 tracking-wide"
          style={{ color: "var(--accent)" }}
        >
          {step.title}
        </div>
        <p
          className="text-xs font-mono leading-relaxed mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {step.body}
        </p>

        {/* CTA */}
        <button
          onClick={onNext}
          className="w-full py-2 rounded-lg text-xs font-mono font-black
                     tracking-widest uppercase transition-all duration-150
                     hover:opacity-90 active:scale-95"
          style={{
            background: "var(--accent)",
            color: "var(--bg-base)",
          }}
        >
          {isLast ? "Got it — let's go ▶" : `Next (${stepIndex + 1}/${total})`}
        </button>
      </div>
    </div>
  );
}

export function OnboardingTooltip() {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Show only if not seen before, and only after a short delay
  // so the page has time to render the target elements
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update target rect whenever step changes or window resizes
  useEffect(() => {
    if (!visible) return;
    function updateRect() {
      setRect(getTargetRect(STEPS[stepIndex].targetId));
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [stepIndex, visible]);

  function next() {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      dismiss();
    }
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop — subtle, non-blocking */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 9998, background: "rgba(0,0,0,0.25)" }}
      />

      {/* Highlight ring around target */}
      {rect && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 9998,
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            borderRadius: 10,
            border: "2px solid var(--accent)",
            boxShadow: "0 0 0 4000px rgba(0,0,0,0.35)",
            transition: "all 0.3s ease",
          }}
        />
      )}

      <TooltipBox
        step={STEPS[stepIndex]}
        stepIndex={stepIndex}
        total={STEPS.length}
        onNext={next}
        onSkip={dismiss}
        rect={rect}
      />
    </>
  );
}