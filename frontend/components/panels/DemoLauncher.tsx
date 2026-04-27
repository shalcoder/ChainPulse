"use client";

import { useState } from "react";

type DemoState = "idle" | "running" | "done" | "error";

export function DemoLauncher() {
  const [state, setState] = useState<DemoState>("idle");
  const [countdown, setCountdown] = useState(0);

  async function handleStart() {
    if (state === "running") return;

    try {
      const res = await fetch("http://localhost:8000/demo/start", {
        method: "POST",
      });
      const data = await res.json();

      if (data.status === "already_running") {
        setState("running");
        return;
      }

      setState("running");
      setCountdown(25);

      // Countdown timer
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setState("done");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch {
      setState("error");
    }
  }

  function handleReset() {
    setState("idle");
    setCountdown(0);
  }

  return (
    <div className="flex items-center gap-2">
      {state === "idle" && (
        <button
          onClick={handleStart}
          className="flex items-center gap-2 px-4 py-1.5 rounded border border-cyan-700
                     bg-cyan-950/60 hover:bg-cyan-900/60 hover:border-cyan-500
                     text-cyan-400 text-xs font-mono font-bold tracking-widest
                     uppercase transition-all duration-200 group"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-500 group-hover:animate-ping" />
          ▶ START DEMO
        </button>
      )}

      {state === "running" && (
        <div className="flex items-center gap-2 px-4 py-1.5 rounded border border-orange-800
                        bg-orange-950/40 text-orange-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          DEMO RUNNING
          {countdown > 0 && (
            <span className="text-orange-600 ml-1">{countdown}s</span>
          )}
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-green-800
                          bg-green-950/40 text-green-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            DEMO COMPLETE
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded border border-slate-700 bg-slate-900/60
                       hover:border-slate-500 text-slate-400 text-xs font-mono
                       transition-all duration-200"
          >
            RESET
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded border border-red-800 bg-red-950/40
                          text-red-400 text-xs font-mono">
            ✕ Backend unreachable
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded border border-slate-700 text-slate-400
                       text-xs font-mono hover:border-slate-500 transition-all"
          >
            RETRY
          </button>
        </div>
      )}
    </div>
  );
}