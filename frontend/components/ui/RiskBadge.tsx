import { RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  level: RiskLevel;
  score?: number;
  className?: string;
}

export function RiskBadge({ level, score, className }: Props) {
  const styles: Record<RiskLevel, React.CSSProperties> = {
    HIGH: {
      background: "var(--risk-high-bg)",
      border: "1px solid var(--risk-high-border)",
      color: "var(--risk-high)",
    },
    MEDIUM: {
      background: "var(--risk-medium-bg)",
      border: "1px solid var(--risk-medium-border)",
      color: "var(--risk-medium)",
    },
    LOW: {
      background: "var(--risk-low-bg)",
      border: "1px solid var(--risk-low-border)",
      color: "var(--risk-low)",
    },
  };

  const dotColor: Record<RiskLevel, string> = {
    HIGH:   "var(--risk-high)",
    MEDIUM: "var(--risk-medium)",
    LOW:    "var(--risk-low)",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold tracking-widest",
        className
      )}
      style={styles[level]}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${level === "HIGH" ? "animate-pulse" : ""}`}
        style={{ background: dotColor[level] }}
      />
      {level}
      {score !== undefined && (
        <span style={{ opacity: 0.6 }}>·{score.toFixed(2)}</span>
      )}
    </span>
  );
}