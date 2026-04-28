"use client";

import { useEffect, useRef } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add("page-enter");

    // Force reflow so the browser registers the start state
    void el.offsetHeight;

    el.classList.add("page-enter-active");
    el.classList.remove("page-enter");

    const cleanup = setTimeout(() => {
      el.classList.remove("page-enter-active");
    }, 220);

    return () => clearTimeout(cleanup);
  }, []);

  return (
    <div ref={ref} className="h-full">
      {children}
    </div>
  );
}