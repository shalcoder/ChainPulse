"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Options {
  onThemeToggle: () => void;
  onDemoStart: () => void;
}

const ROUTES: Record<string, string> = {
  "1": "/",
  "2": "/fleet",
  "3": "/audit",
  "4": "/health",
  "5": "/about",
};

export function useKeyboardShortcuts({ onThemeToggle, onDemoStart }: Options) {
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "t":
        case "T":
          onThemeToggle();
          break;
        case "d":
        case "D":
          onDemoStart();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          router.push(ROUTES[e.key]);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onThemeToggle, onDemoStart, router]);
}