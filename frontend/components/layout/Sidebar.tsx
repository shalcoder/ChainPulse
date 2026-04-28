"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ShortcutHud } from "@/components/ui/ShortcutHud";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  description: string;
}

const NAV: NavItem[] = [
  {
    href: "/",
    icon: "◈",
    label: "Control Tower",
    description: "Live map with real-time vehicle tracking, risk alerts, and automated rerouting decisions.",
  },
  {
    href: "/fleet",
    icon: "⬡",
    label: "Fleet Monitor",
    description: "All 20 vehicles ranked by risk score with live speed, status, and anomaly indicators.",
  },
  {
    href: "/audit",
    icon: "≡",
    label: "Audit Trail",
    description: "Every route optimization decision logged with reason code, ML confidence, and full explanation.",
  },
  {
    href: "/health",
    icon: "◎",
    label: "System Health",
    description: "Live status of all subsystems: XGBoost, IsolationForest, OR-Tools, Kafka, PostgreSQL, Redis.",
  },
  {
    href: "/about",
    icon: "?",
    label: "How It Works",
    description: "Beginner-friendly walkthrough of the AI pipeline: Sense → Predict → Optimize → Execute.",
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <aside
      className="flex flex-col shrink-0 border-r h-full transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)",
        background: "var(--sidebar-bg)",
        borderColor: "var(--border)",
      }}
    >
      {/* ── Logo / Header ─────────────────────────────────────────── */}
      <div
        className="flex items-center border-b shrink-0 overflow-hidden"
        style={{
          borderColor: "var(--border)",
          height: "56px",
          padding: collapsed ? "0" : "0 12px",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        {collapsed ? (
          /* When collapsed: just a centered hamburger, full width clickable */
          <button
            onClick={onToggle}
            aria-label="Open sidebar"
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            ☰
          </button>
        ) : (
          /* When expanded: logo + name + X button */
          <>
            <div className="relative w-7 h-7 shrink-0">
              <div
                className="absolute inset-0 border-2 rotate-45 rounded-sm"
                style={{ borderColor: "var(--accent)" }}
              />
              <div
                className="absolute inset-[3px] rotate-45 rounded-sm opacity-20"
                style={{ background: "var(--accent)" }}
              />
              <div
                className="absolute inset-[6px] rotate-45 rounded-sm"
                style={{ background: "var(--accent)" }}
              />
            </div>

            <div className="flex flex-col min-w-0 flex-1 ml-3">
              <span
                className="text-sm font-black tracking-[0.1em] uppercase leading-none"
                style={{ color: "var(--text-primary)" }}
              >
                Chain<span style={{ color: "var(--accent)" }}>Pulse</span>
              </span>
              <span
                className="text-[9px] font-mono tracking-widest uppercase mt-0.5 truncate"
                style={{ color: "var(--text-muted)" }}
              >
                AI Supply Chain
              </span>
            </div>

            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded
                         transition-colors duration-150 text-sm leading-none ml-2"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              ✕
            </button>
          </>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2 space-y-0.5">
        {NAV.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <div
              key={item.href}
              className="relative"
              onMouseEnter={() => setHovered(item.href)}
              onMouseLeave={() => setHovered(null)}
            >
              <Link
                href={item.href}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg
                           transition-all duration-150 group relative"
                style={{
                  background: isActive
                    ? "var(--accent-glow)"
                    : hovered === item.href
                    ? "var(--bg-elevated)"
                    : "transparent",
                  color: isActive
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                }}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                )}

                {/* Icon */}
                <span
                  className="text-base w-5 text-center shrink-0 leading-none font-mono"
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {item.icon}
                </span>

                {/* Label */}
                {!collapsed && (
                  <span className="text-xs font-mono font-bold tracking-wide truncate">
                    {item.label}
                  </span>
                )}
              </Link>

              {/* Tooltip when collapsed */}
              {collapsed && hovered === item.href && (
                <div
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                             rounded-lg px-3 py-2 w-52 shadow-lg pointer-events-none"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-strong)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <div
                    className="text-xs font-mono font-bold mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="text-[10px] font-mono leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.description}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div
        className="shrink-0 border-t px-2 py-2 space-y-1"
        style={{ borderColor: "var(--border)" }}
      >
        <ThemeToggle />
        {!collapsed && (
          <>
            <ShortcutHud />
            <div
              className="px-3 pt-1 pb-0.5 text-[9px] font-mono tracking-widest"
              style={{ color: "var(--text-disabled)" }}
            >
              SOLUTION CHALLENGE 2026
            </div>
          </>
        )}
      </div>
    </aside>
  );
}