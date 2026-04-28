"use client";

import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  rows?: number;
  rowHeight?: string;
}

// Single shimmer bar
export function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded animate-pulse", className)}
      style={{ background: "var(--bg-elevated)" }}
    />
  );
}

// Stack of shimmer bars — drop-in for list panels
export function SkeletonList({ rows = 5, rowHeight = "h-10" }: Props) {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn("rounded animate-pulse w-full", rowHeight)}
          style={{
            background: "var(--bg-elevated)",
            opacity: 1 - i * 0.12, // each row slightly more faded
          }}
        />
      ))}
    </div>
  );
}

// Card skeleton — for stat cards
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl p-4 animate-pulse space-y-3",
        className
      )}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      <SkeletonBar className="h-7 w-16" />
      <SkeletonBar className="h-3 w-24" />
    </div>
  );
}