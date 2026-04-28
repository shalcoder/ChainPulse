"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface TooltipStep {
    targetId: string;
    title: string;
    body: string;
    position: "bottom" | "left" | "top" | "right";
    page: string; // which route this step belongs to
}

const STEPS: TooltipStep[] = [
    // ── Dashboard ──────────────────────────────────────────────
    {
        page: "/",
        targetId: "onboard-map",
        title: "Live Fleet Map",
        body: "20 vehicles moving in real time. Green = safe, orange = medium risk, red = needs immediate rerouting.",
        position: "bottom",
    },
    {
        page: "/",
        targetId: "onboard-alerts",
        title: "Risk Alert Feed",
        body: "Every disruption event appears here instantly — weather alerts, GPS anomalies, hub congestion, and SLA breach risks.",
        position: "left",
    },
    {
        page: "/",
        targetId: "onboard-alerts",
        title: "AI Decision Panel",
        body: "When risk crosses 0.70, OR-Tools automatically calculates a new route. Old ETA vs new ETA shown with full reason code.",
        position: "left",
    },
    {
        page: "/",
        targetId: "onboard-demo",
        title: "Start the Demo",
        body: "Click START DEMO to inject a live disruption sequence — weather alert → GPS anomaly → auto-reroute. Takes 30 seconds.",
        position: "bottom",
    },
    // ── Sidebar nav (visible on all pages) ────────────────────
    {
        page: "/",
        targetId: "nav-fleet",
        title: "Fleet Monitor",
        body: "See all 20 vehicles ranked by risk. Sortable table with live risk bars, anomaly scores, and speed.",
        position: "right",
    },
    {
        page: "/",
        targetId: "nav-audit",
        title: "Audit Trail",
        body: "Every AI decision logged with reason code, ML confidence, and full explainability. Export to CSV or print.",
        position: "right",
    },
    {
        page: "/",
        targetId: "nav-health",
        title: "System Health",
        body: "Live status of all 6 subsystems. 100% means XGBoost, IsolationForest, Kafka, PostgreSQL, Redis, WebSocket are all operational.",
        position: "right",
    },
    {
        page: "/",
        targetId: "nav-about",
        title: "How It Works",
        body: "Full technical walkthrough of the AI pipeline with the risk formula, tech stack, and demo flow for judges.",
        position: "right",
    },
    // ── Fleet Monitor page ─────────────────────────────────────
    {
        page: "/fleet",
        targetId: "fleet-stats",
        title: "Fleet Summary",
        body: "Live counts of HIGH/MEDIUM/LOW risk vehicles and anomalies detected by IsolationForest across the fleet.",
        position: "bottom",
    },
    {
        page: "/fleet",
        targetId: "fleet-filters",
        title: "Search & Filter",
        body: "Search by vehicle ID or filter by risk level. The table updates instantly — try clicking HIGH to see only critical vehicles.",
        position: "bottom",
    },
    {
        page: "/fleet",
        targetId: "fleet-table",
        title: "Live Vehicle Table",
        body: "Click any column header to sort. Risk bars update every second. ANOMALY badges are flagged by IsolationForest.",
        position: "top",
    },
    // ── Audit Trail page ───────────────────────────────────────
    {
        page: "/audit",
        targetId: "audit-stats",
        title: "Decision Summary",
        body: "Total decisions made, broken down by risk level. The top reason code shows what is causing the most disruptions.",
        position: "bottom",
    },
    {
        page: "/audit",
        targetId: "audit-filters",
        title: "Filter by Risk",
        body: "Filter the timeline to show only HIGH, MEDIUM, or LOW risk decisions. Use this to show judges the most critical events.",
        position: "bottom",
    },
    {
        page: "/audit",
        targetId: "audit-timeline",
        title: "Decision Timeline",
        body: "Click any entry to expand it. Each decision shows the reason, action taken, ML confidence, and full audit metadata.",
        position: "top",
    },
    // ── System Health page ─────────────────────────────────────
    {
        page: "/health",
        targetId: "health-banner",
        title: "Overall Status",
        body: "Single-line summary of the entire system. Green means all 6 subsystems are operational and the pipeline is running.",
        position: "bottom",
    },
    {
        page: "/health",
        targetId: "health-cards",
        title: "Subsystem Cards",
        body: "Each card shows live status, latency in ms, and what that component does in the pipeline.",
        position: "top",
    },
    // ── How It Works page ──────────────────────────────────────
    {
        page: "/about",
        targetId: "about-pipeline",
        title: "The AI Pipeline",
        body: "Click each step to expand it. Step 03 SCORE shows the weighted risk formula with live weight bars for each component.",
        position: "bottom",
    },
    {
        page: "/about",
        targetId: "about-demo",
        title: "Demo Flow",
        body: "This shows exactly what judges will see during the 60-second demo. Share this page before running the demo.",
        position: "top",
    },
];

const STORAGE_KEY = "chainpulse-onboarded";

function getTargetRect(id: string): DOMRect | null {
    const el = document.getElementById(id);
    return el ? el.getBoundingClientRect() : null;
}

const BOX_HEIGHT = 260;
const BOX_WIDTH = 300;
const GAP = 14;
const EDGE = 12;

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
    let style: React.CSSProperties = {
        position: "fixed",
        zIndex: 9999,
        width: BOX_WIDTH,
        pointerEvents: "auto",
    };

    if (rect) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        switch (step.position) {
            case "bottom": {
                const left = Math.min(
                    Math.max(rect.left + rect.width / 2 - BOX_WIDTH / 2, EDGE),
                    vw - BOX_WIDTH - EDGE
                );
                style.left = left;
                const belowPos = rect.bottom + GAP;
                const abovePos = rect.top - BOX_HEIGHT - GAP;
                if (belowPos + BOX_HEIGHT <= vh - EDGE) {
                    // enough room below
                    style.top = belowPos;
                } else if (abovePos >= EDGE) {
                    // flip to above
                    style.top = abovePos;
                } else {
                    // neither fits — anchor near bottom of viewport
                    style.top = Math.max(vh - BOX_HEIGHT - EDGE, EDGE);
                }
                break;
            }
            case "top": {
                const left = Math.min(
                    Math.max(rect.left + rect.width / 2 - BOX_WIDTH / 2, EDGE),
                    vw - BOX_WIDTH - EDGE
                );
                style.left = left;
                const abovePos = rect.top - BOX_HEIGHT - GAP;
                const belowPos = rect.bottom + GAP;
                if (abovePos >= EDGE) {
                    // enough room above
                    style.top = abovePos;
                } else if (belowPos + BOX_HEIGHT <= vh - EDGE) {
                    // flip to below
                    style.top = belowPos;
                } else {
                    // neither fits — anchor to center of viewport
                    style.top = Math.max(vh / 2 - BOX_HEIGHT / 2, EDGE);
                }
                break;
            }
            case "left": {
                const right = vw - rect.left + GAP;
                let top = rect.top + rect.height / 2 - BOX_HEIGHT / 2;
                top = Math.max(EDGE, Math.min(top, vh - BOX_HEIGHT - EDGE));
                style.right = Math.max(right, EDGE);
                style.top = top;
                break;
            }
            case "right": {
                const left = rect.right + GAP;
                let top = rect.top + rect.height / 2 - BOX_HEIGHT / 2;
                top = Math.max(EDGE, Math.min(top, vh - BOX_HEIGHT - EDGE));
                if (left + BOX_WIDTH > vw - EDGE) {
                    style.right = vw - rect.left + GAP;
                } else {
                    style.left = left;
                }
                style.top = top;
                break;
            }
        }
    } else {
        // No target found — center of screen
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
                    boxShadow: "0 0 32px var(--accent-glow), 0 8px 32px rgba(0,0,0,0.5)",
                }}
            >
                {/* Progress dots + skip */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-1 flex-wrap" style={{ maxWidth: 200 }}>
                        {Array.from({ length: total }).map((_, i) => (
                            <div
                                key={i}
                                className="h-1 rounded-full transition-all duration-300"
                                style={{
                                    width: i === stepIndex ? 16 : 5,
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
                        className="text-[10px] font-mono uppercase tracking-widest ml-3
                       transition-colors duration-150 shrink-0"
                        style={{ color: "var(--text-disabled)" }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "var(--text-muted)")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "var(--text-disabled)")
                        }
                    >
                        Skip all
                    </button>
                </div>

                {/* Step counter */}
                <div
                    className="text-[9px] font-mono tracking-widest uppercase mb-1"
                    style={{ color: "var(--text-muted)" }}
                >
                    Step {stepIndex + 1} of {total}
                </div>

                {/* Title */}
                <div
                    className="text-sm font-mono font-black mb-2 tracking-wide"
                    style={{ color: "var(--accent)" }}
                >
                    {step.title}
                </div>

                {/* Body */}
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
                    {isLast ? "✓ Got it — let's go" : "Next →"}
                </button>
            </div>
        </div>
    );
}

export function OnboardingTooltip() {
    const router = useRouter();
    const pathname = usePathname();
    const [stepIndex, setStepIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [navigating, setNavigating] = useState(false);

    // Show only on first visit
    useEffect(() => {
        if (typeof window === "undefined") return;
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen) {
            const timer = setTimeout(() => setVisible(true), 1200);
            return () => clearTimeout(timer);
        }
    }, []);

    // When step changes, navigate to the correct page if needed
    useEffect(() => {
        if (!visible) return;
        const step = STEPS[stepIndex];
        if (!step) return;

        if (pathname !== step.page) {
            setNavigating(true);
            setRect(null);
            router.push(step.page);
        } else {
            setNavigating(false);
        }
    }, [stepIndex, visible]);

    // After navigation completes (pathname matches step page),
    // scroll target into view then measure it
    useEffect(() => {
        if (!visible) return;
        const step = STEPS[stepIndex];
        if (!step) return;
        if (pathname !== step.page) return;

        setNavigating(false);

        const timer = setTimeout(() => {
            const el = document.getElementById(step.targetId);
            if (el) {
                // Scroll element into the center of the viewport
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                // Wait for scroll to finish before measuring
                setTimeout(() => {
                    setRect(getTargetRect(step.targetId));
                }, 500);
            } else {
                setRect(null);
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [pathname, stepIndex, visible]);

    // Keep rect in sync on resize
    useEffect(() => {
        if (!visible) return;
        function update() {
            const id = STEPS[stepIndex]?.targetId ?? "";
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "instant", block: "center" });
                setTimeout(() => setRect(getTargetRect(id)), 100);
            }
        }
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
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
        // Navigate back to dashboard after finishing
        if (pathname !== "/") router.push("/");
    }

    if (!visible) return null;

    // While navigating to a new page, hide the highlight ring
    // but keep the backdrop so the transition feels smooth
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: 9998, background: "rgba(0,0,0,0.4)" }}
            />

            {/* Highlight ring — only when target is found */}
            {rect && !navigating && (
                <div
                    className="fixed pointer-events-none transition-all duration-300"
                    style={{
                        zIndex: 9998,
                        top: rect.top - 4,
                        left: rect.left - 4,
                        width: rect.width + 8,
                        height: rect.height + 8,
                        borderRadius: 10,
                        border: "2px solid var(--accent)",
                        boxShadow: "0 0 0 4000px rgba(0,0,0,0.45)",
                    }}
                />
            )}

            {/* Tooltip box */}
            {!navigating && (
                <TooltipBox
                    step={STEPS[stepIndex]}
                    stepIndex={stepIndex}
                    total={STEPS.length}
                    onNext={next}
                    onSkip={dismiss}
                    rect={rect}
                />
            )}
        </>
    );
}