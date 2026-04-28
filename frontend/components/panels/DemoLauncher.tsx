"use client";

import { useState } from "react";

type DemoState = "idle" | "running" | "done" | "error";

export function DemoLauncher() {
  const [state, setState] = useState<DemoState>("idle");
  const [countdown, setCountdown] = useState(0);

  async function handleStart() {
    if (state === "running") return;
    try {
      const res = await fetch("http://localhost:8000/demo/start", { method: "POST" });
      const data = await res.json();
      if (data.status === "already_running") { setState("running"); return; }
      setState("running");
      setCountdown(25);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(interval); setState("done"); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setState("error");
    }
  }

  function handleReset() { setState("idle"); setCountdown(0); }

  if (state === "idle") return (
    <button
      onClick={handleStart}
      className="flex items-center gap-2 px-4 py-1.5 rounded text-xs font-mono
                 font-bold tracking-widest uppercase transition-all duration-200 group"
      style={{
        border: "1px solid var(--accent-dim)",
        background: "var(--accent-glow)",
        color: "var(--accent)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--accent-dim)")}
    >
      <span
        className="w-2 h-2 rounded-full group-hover:animate-ping"
        style={{ background: "var(--accent)" }}
      />
      ▶ START DEMO
    </button>
  );

  if (state === "running") return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 rounded text-xs font-mono"
      style={{
        border: "1px solid var(--risk-medium-border)",
        background: "var(--risk-medium-bg)",
        color: "var(--risk-medium)",
      }}
    >
      <span
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ background: "var(--risk-medium)" }}
      />
      DEMO RUNNING
      {countdown > 0 && (
        <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>{countdown}s</span>
      )}
    </div>
  );

  if (state === "done") return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono"
        style={{
          border: "1px solid var(--risk-low-border)",
          background: "var(--risk-low-bg)",
          color: "var(--risk-low)",
        }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "var(--risk-low)" }} />
        DEMO COMPLETE
      </div>
      <button
        onClick={handleReset}
        className="px-3 py-1.5 rounded text-xs font-mono transition-all duration-200"
        style={{
          border: "1px solid var(--border)",
          color: "var(--text-secondary)",
          background: "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        RESET
      </button>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      <div
        className="px-3 py-1.5 rounded text-xs font-mono"
        style={{
          border: "1px solid var(--risk-high-border)",
          background: "var(--risk-high-bg)",
          color: "var(--risk-high)",
        }}
      >
        ✕ Backend unreachable
      </div>
      <button
        onClick={handleReset}
        className="px-3 py-1.5 rounded text-xs font-mono transition-all"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      >
        RETRY
      </button>
    </div>
  );
}