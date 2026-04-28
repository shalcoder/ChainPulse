"use client";

import { useTheme } from "@/components/layout/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg
                 text-xs font-mono transition-all duration-150
                 hover:bg-[var(--bg-elevated)]"
      style={{ color: "var(--text-secondary)" }}
    >
      <span className="text-base leading-none">
        {theme === "dark" ? "☀" : "☾"}
      </span>
      <span className="tracking-widest uppercase text-[10px]">
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </span>
    </button>
  );
}