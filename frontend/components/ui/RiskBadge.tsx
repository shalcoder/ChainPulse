import { RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  level: RiskLevel;
  score?: number;
  className?: string;
}

const config = {
  HIGH:   { bg: "bg-red-500/20", border: "border-red-500", text: "text-red-400", dot: "bg-red-500", pulse: true },
  MEDIUM: { bg: "bg-orange-500/20", border: "border-orange-500", text: "text-orange-400", dot: "bg-orange-400", pulse: false },
  LOW:    { bg: "bg-green-500/10", border: "border-green-600", text: "text-green-400", dot: "bg-green-500", pulse: false },
};

export function RiskBadge({ level, score, className }: Props) {
  const c = config[level];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-bold tracking-widest",
      c.bg, c.border, c.text, className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot, c.pulse && "animate-pulse")} />
      {level}
      {score !== undefined && <span className="opacity-60">·{score.toFixed(2)}</span>}
    </span>
  );
}