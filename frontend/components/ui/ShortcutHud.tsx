import React from "react";

const SHORTCUTS = [
  { key: "D", label: "Start Demo" },
  { key: "T", label: "Theme" },
  { key: "1–5", label: "Navigate" },
];

export function ShortcutHud() {
  return (
    <div className="px-3 py-2 space-y-1">
      {SHORTCUTS.map(({ key, label }) => (
        <div
          key={key}
          className="flex items-center justify-between"
        >
          <span
            className="text-[9px] font-mono tracking-widest"
            style={{ color: "var(--text-disabled)" }}
          >
            {label}
          </span>
          <kbd
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {key}
          </kbd>
        </div>
      ))}
    </div>
  );
}