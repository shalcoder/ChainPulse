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
    const totalDuration = STEPS.reduce((sum, s) => sum + s.duration, 0);

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
                  bg-[#080c14] transition-opacity duration-500
                  ${done ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 border-2 border-cyan-500 rotate-45 rounded-sm" />
          <div className="absolute inset-[3px] bg-cyan-500/20 rotate-45 rounded-sm" />
          <div className="absolute inset-[7px] bg-cyan-400 rotate-45 rounded-sm" />
        </div>
        <div>
          <div className="text-xl font-black tracking-[0.15em] text-white uppercase">
            Chain<span className="text-cyan-400">Pulse</span>
          </div>
          <div className="text-[10px] font-mono text-slate-600 tracking-widest uppercase">
            AI Supply Chain Control Tower
          </div>
        </div>
      </div>

      {/* Boot log */}
      <div className="w-[480px] bg-slate-900/60 border border-slate-800 rounded-lg p-4 mb-6
                      font-mono text-xs space-y-1.5">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 transition-opacity duration-300
                        ${visibleSteps.includes(i) ? "opacity-100" : "opacity-0"}`}
          >
            <span className={`shrink-0 ${
              i === visibleSteps[visibleSteps.length - 1] && !done
                ? "text-cyan-400 animate-pulse"
                : "text-green-500"
            }`}>
              {i === visibleSteps[visibleSteps.length - 1] && !done ? "►" : "✓"}
            </span>
            <span className={
              i === STEPS.length - 1 && visibleSteps.includes(i)
                ? "text-cyan-400"
                : "text-slate-400"
            }>
              {step.text}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-[480px]">
        <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-1">
          <span>SYSTEM BOOT</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, boxShadow: "0 0 8px #06b6d4" }}
          />
        </div>
      </div>
    </div>
  );
}