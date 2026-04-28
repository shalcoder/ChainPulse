"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "@/components/layout/ThemeProvider";
import { OnboardingTooltip } from "@/components/ui/OnboardingTooltip";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toggle: toggleTheme } = useTheme();

  useKeyboardShortcuts({
    onThemeToggle: toggleTheme,
    onDemoStart: () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${API_URL}/demo/start`, { method: "POST" }).catch(() => {});
    },
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  // On tablet (768px) auto-collapse sidebar. On mobile (640px) hide entirely.
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
      if (window.innerWidth >= 1024) {
        setCollapsed(false);
        setMobileOpen(false);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close mobile drawer on route change (clicking a nav link)
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Mobile overlay ────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40 sm:hidden"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar — hidden on mobile unless mobileOpen ──────────── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 sm:relative sm:flex sm:inset-auto
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          sm:translate-x-0
        `}
        style={{ flexShrink: 0 }}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => {
            if (window.innerWidth < 640) {
              setMobileOpen(false);
            } else {
              setCollapsed((v) => !v);
            }
          }}
        />
      </div>

      {/* Onboarding — present on every page */}
      <OnboardingTooltip />

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 relative">

        {/* Mobile hamburger — only visible on xs screens */}
        <button
          onClick={() => setMobileOpen(true)}
          className="sm:hidden fixed top-3 left-3 z-30 w-9 h-9 flex items-center
                     justify-center rounded-lg border text-base transition-colors"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--accent)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-secondary)")
          }
          aria-label="Open navigation"
        >
          ☰
        </button>

        {children}
      </main>
    </div>
  );
}