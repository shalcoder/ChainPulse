"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubsystemHealth {
  name: string;
  status: "ok" | "warn" | "error" | "unknown";
  latency_ms?: number;
  detail?: string;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime_seconds?: number;
  subsystems: Record<string, { status: string; detail?: string; latency_ms?: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(raw: HealthResponse): SubsystemHealth[] {
  const order = [
    "xgboost", "isolation_forest", "or_tools",
    "kafka", "postgresql", "redis", "websocket",
  ];

  const icons: Record<string, string> = {
    xgboost:          "◈",
    isolation_forest: "⬡",
    or_tools:         "⊞",
    kafka:            "≋",
    postgresql:       "◫",
    redis:            "◉",
    websocket:        "⇌",
  };

  const labels: Record<string, string> = {
    xgboost:          "XGBoost",
    isolation_forest: "IsolationForest",
    or_tools:         "OR-Tools",
    kafka:            "Kafka",
    postgresql:       "PostgreSQL",
    redis:            "Redis",
    websocket:        "WebSocket",
  };

  const descriptions: Record<string, string> = {
    xgboost:          "Predicts delivery delay probability from 8 operational features",
    isolation_forest: "Detects anomalous GPS, dwell time, and route deviation patterns",
    or_tools:         "Solves Vehicle Routing (VRPTW) with capacity and time-window constraints",
    kafka:            "Streams GPS, weather, order, and warehouse events in real time",
    postgresql:       "Stores shipments, vehicles, routes, decisions, and audit records",
    redis:            "Caches live vehicle positions and route state for sub-ms reads",
    websocket:        "Pushes every decision and alert to the frontend in real time",
  };

  return order.map((key) => {
    const raw_sub = raw.subsystems?.[key];
    const statusStr = raw_sub?.status ?? "unknown";
    const status: SubsystemHealth["status"] =
      statusStr === "ok" ? "ok"
      : statusStr === "warn" ? "warn"
      : statusStr === "error" ? "error"
      : "unknown";

    return {
      name: labels[key] ?? key,
      icon: icons[key] ?? "◈",
      description: descriptions[key] ?? "",
      status,
      latency_ms: raw_sub?.latency_ms,
      detail: raw_sub?.detail,
    };
  }) as any;
}

function statusStyle(status: SubsystemHealth["status"]): {
  color: string; bg: string; border: string; dot: string;
} {
  switch (status) {
    case "ok":      return { color: "var(--status-ok)",   bg: "var(--risk-low-bg)",    border: "var(--risk-low-border)",    dot: "var(--status-ok)" };
    case "warn":    return { color: "var(--status-warn)",  bg: "var(--risk-medium-bg)", border: "var(--risk-medium-border)", dot: "var(--status-warn)" };
    case "error":   return { color: "var(--status-error)", bg: "var(--risk-high-bg)",   border: "var(--risk-high-border)",   dot: "var(--status-error)" };
    default:        return { color: "var(--text-muted)",   bg: "var(--bg-elevated)",    border: "var(--border)",             dot: "var(--text-muted)" };
  }
}

function statusLabel(status: SubsystemHealth["status"]): string {
  switch (status) {
    case "ok":    return "OPERATIONAL";
    case "warn":  return "DEGRADED";
    case "error": return "DOWN";
    default:      return "UNKNOWN";
  }
}

function formatUptime(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Subsystem Card ────────────────────────────────────────────────────────────

function SubsystemCard({
  sub,
  icon,
  description,
}: {
  sub: SubsystemHealth;
  icon: string;
  description: string;
}) {
  const s = statusStyle(sub.status);
  const isOk = sub.status === "ok";

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid var(--border)`,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = s.border)
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "var(--border)")
      }
    >
      {/* Top row — icon + name + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="text-xl leading-none shrink-0"
            style={{ color: s.color }}
          >
            {icon}
          </span>
          <span
            className="text-sm font-mono font-black"
            style={{ color: "var(--text-primary)" }}
          >
            {sub.name}
          </span>
        </div>

        {/* Status badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px]
                     font-mono font-bold tracking-widest uppercase shrink-0"
          style={{
            background: s.bg,
            border: `1px solid ${s.border}`,
            color: s.color,
          }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOk ? "animate-pulse" : ""}`}
            style={{ background: s.dot }}
          />
          {statusLabel(sub.status)}
        </div>
      </div>

      {/* Description */}
      <p
        className="text-[11px] font-mono leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {description}
      </p>

      {/* Latency + detail */}
      <div
        className="flex items-center justify-between pt-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          {sub.detail || (isOk ? "All checks passed" : "—")}
        </span>
        {sub.latency_ms !== undefined && (
          <span
            className="text-[10px] font-mono tabular-nums font-bold"
            style={{
              color:
                sub.latency_ms < 50
                  ? "var(--status-ok)"
                  : sub.latency_ms < 200
                  ? "var(--status-warn)"
                  : "var(--status-error)",
            }}
          >
            {sub.latency_ms}ms
          </span>
        )}
      </div>
    </div>
  );
}

// ── Overall Status Banner ─────────────────────────────────────────────────────

function OverallBanner({
  subsystems,
  uptime,
  lastChecked,
}: {
  subsystems: (SubsystemHealth & { icon: string; description: string })[];
  uptime?: number;
  lastChecked: string;
}) {
  const errorCount = subsystems.filter((s) => s.status === "error").length;
  const warnCount  = subsystems.filter((s) => s.status === "warn").length;
  const okCount    = subsystems.filter((s) => s.status === "ok").length;

  const overall =
    errorCount > 0 ? "error"
    : warnCount > 0 ? "warn"
    : "ok";

  const bannerText =
    overall === "ok"
      ? "All systems operational"
      : overall === "warn"
      ? `${warnCount} subsystem${warnCount > 1 ? "s" : ""} degraded`
      : `${errorCount} subsystem${errorCount > 1 ? "s" : ""} down`;

  const s = statusStyle(overall);

  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center
                 sm:justify-between gap-3"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full shrink-0 animate-pulse"
          style={{ background: s.dot }}
        />
        <span
          className="text-sm font-mono font-black tracking-wide"
          style={{ color: s.color }}
        >
          {bannerText}
        </span>
      </div>

      <div
        className="flex items-center gap-4 text-[10px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        <span>
          <span className="font-bold" style={{ color: "var(--status-ok)" }}>{okCount}</span>
          {" operational"}
        </span>
        {warnCount > 0 && (
          <span>
            <span className="font-bold" style={{ color: "var(--status-warn)" }}>{warnCount}</span>
            {" degraded"}
          </span>
        )}
        {errorCount > 0 && (
          <span>
            <span className="font-bold" style={{ color: "var(--status-error)" }}>{errorCount}</span>
            {" down"}
          </span>
        )}
        <span style={{ color: "var(--text-disabled)" }}>
          uptime {formatUptime(uptime)}
        </span>
        <span style={{ color: "var(--text-disabled)" }}>
          checked {lastChecked}
        </span>
      </div>
    </div>
  );
}

// ── Latency Sparkline (last 10 pings) ─────────────────────────────────────────

function LatencyHistory({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const max = Math.max(...history, 1);
  const w = 120;
  const h = 28;
  const pts = history
    .slice(-12)
    .map((v, i, arr) => {
      const x = (i / (arr.length - 1)) * w;
      const y = h - (v / max) * h * 0.85 - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[10px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        Ping history
      </span>
      <svg width={w} height={h} style={{ overflow: "visible" }}>
        <polyline
          points={pts}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

// ── MOCK fallback data (so demo always works without backend) ─────────────────

function getMockHealth(): HealthResponse {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime_seconds: 3600 + Math.floor(Math.random() * 100),
    subsystems: {
      xgboost:          { status: "ok",  latency_ms: 2,  detail: "Model loaded, 8 features active" },
      isolation_forest: { status: "ok",  latency_ms: 1,  detail: "Trained on 10k normal events" },
      or_tools:         { status: "ok",  latency_ms: 45, detail: "VRPTW solver ready, limit=10s" },
      kafka:            { status: "ok",  latency_ms: 8,  detail: "4 topics · 0 lag" },
      postgresql:       { status: "ok",  latency_ms: 3,  detail: "PostGIS enabled · pool=5" },
      redis:            { status: "ok",  latency_ms: 1,  detail: "Hot cache · 20 vehicle keys" },
      websocket:        { status: "ok",  latency_ms: 0,  detail: "1 active connection" },
    },
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  XGBoost:          "◈",
  IsolationForest:  "⬡",
  "OR-Tools":       "⊞",
  Kafka:            "≋",
  PostgreSQL:       "◫",
  Redis:            "◉",
  WebSocket:        "⇌",
};

const DESCRIPTIONS: Record<string, string> = {
  XGBoost:          "Predicts delivery delay probability from 8 operational features per vehicle",
  IsolationForest:  "Detects anomalous GPS jumps, dwell times, and route deviation patterns",
  "OR-Tools":       "Solves Vehicle Routing (VRPTW) with capacity and time-window hard constraints",
  Kafka:            "Streams GPS, weather, order, and warehouse events in real time across 4 topics",
  PostgreSQL:       "Stores all shipments, vehicles, routes, decisions, and audit records with PostGIS",
  Redis:            "Caches live vehicle positions and route state for sub-millisecond reads",
  WebSocket:        "Pushes every optimization decision and risk alert to the frontend instantly",
};

export default function HealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState("—");
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [usedMock, setUsedMock] = useState(false);

  const fetchHealth = useCallback(async () => {
    const t0 = performance.now();
    try {
      const res = await fetch("http://localhost:8000/dashboard/health", {
        signal: AbortSignal.timeout(4000),
      });
      const json: HealthResponse = await res.json();
      const latency = Math.round(performance.now() - t0);
      setData(json);
      setUsedMock(false);
      setPingHistory((prev) => [...prev, latency].slice(-12));
    } catch {
      // Backend unreachable — show mock so demo always works
      setData(getMockHealth());
      setUsedMock(true);
      setPingHistory((prev) => [...prev, 0].slice(-12));
    }
    setLastChecked(
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const subsystems: (SubsystemHealth & { icon: string; description: string })[] =
    data ? normalize(data).map((s) => ({
      ...s,
      icon: ICONS[s.name] ?? "◈",
      description: DESCRIPTIONS[s.name] ?? "",
    })) : [];

  const okCount    = subsystems.filter((s) => s.status === "ok").length;
  const totalCount = subsystems.length;

  return (
    <div
      className="h-full overflow-y-auto scrollbar-thin font-mono"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Page header ──────────────────────────────────────────── */}
      <div
        className="px-6 py-5 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1
                className="text-lg font-black tracking-widest uppercase mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                System Health
              </h1>
              <p
                className="text-xs font-mono leading-relaxed max-w-xl"
                style={{ color: "var(--text-muted)" }}
              >
                Live status of every AI model and infrastructure component powering ChainPulse.
                Auto-refreshes every 5 seconds. Green means everything is working correctly.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {/* Refresh indicator */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           text-[10px] font-mono uppercase tracking-widest"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  background: "var(--bg-elevated)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--accent)" }}
                />
                Auto-refresh 5s
              </div>

              {/* Manual refresh */}
              <button
                onClick={fetchHealth}
                className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase
                           tracking-widest transition-all duration-150"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                  background: "var(--accent-glow)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--accent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-32 gap-4"
            style={{ color: "var(--text-muted)" }}
          >
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{
                borderColor: "var(--border)",
                borderTopColor: "var(--accent)",
              }}
            />
            <span className="text-xs font-mono tracking-widest">
              CHECKING SUBSYSTEMS…
            </span>
          </div>
        ) : (
          <>
            {/* Mock warning */}
            {usedMock && (
              <div
                className="rounded-lg px-4 py-3 text-xs font-mono"
                style={{
                  background: "var(--risk-medium-bg)",
                  border: "1px solid var(--risk-medium-border)",
                  color: "var(--risk-medium)",
                }}
              >
                ⚠ Backend unreachable — showing simulated health data for demo purposes.
                Start the backend with{" "}
                <code
                  className="px-1 py-0.5 rounded text-[10px]"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  docker-compose up
                </code>{" "}
                to see live data.
              </div>
            )}

            {/* Overall banner */}
            <OverallBanner
              subsystems={subsystems}
              uptime={data?.uptime_seconds}
              lastChecked={lastChecked}
            />

            {/* Summary pills */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Operational", count: okCount,                   colorVar: "var(--status-ok)" },
                { label: "Total",       count: totalCount,                 colorVar: "var(--text-primary)" },
                { label: "Health",      count: `${Math.round(okCount / Math.max(totalCount, 1) * 100)}%`, colorVar: okCount === totalCount ? "var(--status-ok)" : "var(--status-warn)" },
              ].map(({ label, count, colorVar }) => (
                <div
                  key={label}
                  className="rounded-xl px-4 py-3 text-center"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="text-2xl font-black tabular-nums"
                    style={{ color: colorVar }}
                  >
                    {count}
                  </div>
                  <div
                    className="text-[10px] font-mono tracking-widest uppercase mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Ping sparkline */}
            <div
              className="rounded-xl px-5 py-3 flex items-center justify-between"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="text-[10px] font-mono tracking-widest uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                API response latency
              </span>
              <LatencyHistory history={pingHistory} />
            </div>

            {/* Subsystem cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subsystems.map((sub) => (
                <SubsystemCard
                  key={sub.name}
                  sub={sub}
                  icon={sub.icon}
                  description={sub.description}
                />
              ))}
            </div>

            {/* Legend */}
            <div
              className="rounded-xl p-5"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="text-[10px] font-mono font-bold tracking-widest uppercase mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Status Guide
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    status: "ok" as const,
                    title: "OPERATIONAL",
                    desc: "Component is healthy and responding within normal latency bounds.",
                  },
                  {
                    status: "warn" as const,
                    title: "DEGRADED",
                    desc: "Component is responding but slower than expected. System continues to function.",
                  },
                  {
                    status: "error" as const,
                    title: "DOWN",
                    desc: "Component is unreachable. The pipeline may be affected. Check Docker logs.",
                  },
                ].map(({ status, title, desc }) => {
                  const s = statusStyle(status);
                  return (
                    <div key={title} className="flex gap-3">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 mt-1"
                        style={{ background: s.dot }}
                      />
                      <div>
                        <div
                          className="text-xs font-mono font-bold mb-1"
                          style={{ color: s.color }}
                        >
                          {title}
                        </div>
                        <div
                          className="text-[11px] font-mono leading-relaxed"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}