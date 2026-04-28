"use client";

import { useEffect, useState } from "react";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { RiskLevel } from "@/types";
import { formatTime } from "@/lib/utils";

interface AuditRecord {
  id: string;
  event_type: string;
  vehicle_id: string;
  shipment_id: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  reason_code: string;
  reason_description: string;
  action_taken: string;
  created_at: string;
}

function getReasonMeta(code: string) {
  switch (code) {
    case "WEATHER_REROUTE":  return { icon: "⛈", colorVar: "var(--accent)" };
    case "ANOMALY_DETECTED": return { icon: "⚠", colorVar: "var(--risk-medium)" };
    case "HUB_CONGESTION":   return { icon: "🔴", colorVar: "var(--risk-high)" };
    case "SLA_BREACH_RISK":  return { icon: "⏱", colorVar: "var(--status-warn)" };
    case "MULTI_FACTOR":     return { icon: "⚡", colorVar: "#a78bfa" };
    case "ROUTE_DEVIATION":  return { icon: "↗", colorVar: "var(--accent)" };
    default:                 return { icon: "◈",  colorVar: "var(--text-muted)" };
  }
}

function getRiskLineColor(level: RiskLevel): string {
  switch (level) {
    case "HIGH":   return "var(--risk-high)";
    case "MEDIUM": return "var(--risk-medium)";
    default:       return "var(--risk-low)";
  }
}

function exportCSV(records: AuditRecord[]) {
  const header = ["ID","Timestamp","Vehicle","Risk Level","Risk Score",
    "Reason Code","Event Type","Shipment ID","Description"].join(",");
  const rows = records.map((r) => [
    r.id, r.created_at, r.vehicle_id, r.risk_level,
    r.risk_score.toFixed(3), r.reason_code, r.event_type,
    r.shipment_id || "",
    `"${(r.reason_description || "").replace(/"/g, "'")}"`,
  ].join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chainpulse-audit-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(records: AuditRecord[]) {
  const rows = records
    .map(
      (r) => `
      <tr>
        <td>${r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
        <td>${r.vehicle_id}</td>
        <td>${r.risk_level}</td>
        <td>${(r.risk_score * 100).toFixed(1)}%</td>
        <td>${r.reason_code}</td>
        <td>${r.reason_description || "—"}</td>
        <td>${r.action_taken || "—"}</td>
      </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ChainPulse Audit Report</title>
      <style>
        body { font-family: monospace; font-size: 11px; color: #0f172a; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { color: #64748b; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; text-align: left; padding: 6px 10px;
             border: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 6px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) { background: #f8fafc; }
        .high   { color: #ef4444; font-weight: bold; }
        .medium { color: #f97316; font-weight: bold; }
        .low    { color: #22c55e; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>ChainPulse — Decision Audit Report</h1>
      <p>Generated: ${new Date().toLocaleString()} · ${records.length} decisions</p>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th><th>Vehicle</th><th>Risk Level</th>
            <th>Score</th><th>Reason Code</th><th>Description</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function TimelineEntry({ rec, isLast }: { rec: AuditRecord; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getReasonMeta(rec.reason_code);
  const lineColor = getRiskLineColor(rec.risk_level);

  return (
    <div className="flex gap-4 group">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center
                     text-sm shrink-0 transition-transform duration-200 group-hover:scale-110"
          style={{
            borderColor: meta.colorVar,
            background: `${meta.colorVar}18`,
          }}
        >
          {meta.icon}
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1 opacity-20"
            style={{ minHeight: 24, background: lineColor }}
          />
        )}
      </div>

      {/* Card */}
      <div
        className="flex-1 mb-4 rounded-lg transition-all duration-200 cursor-pointer"
        style={{
          border: `1px solid var(--border)`,
          background: "var(--bg-surface)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.borderColor = "var(--border-strong)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = "var(--border)")
        }
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-xs font-mono font-black tracking-widest"
              style={{ color: meta.colorVar }}
            >
              {rec.reason_code}
            </span>
            <span
              className="text-sm font-bold font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {rec.vehicle_id}
            </span>
            <RiskBadge level={rec.risk_level} score={rec.risk_score} />
            {rec.event_type && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                {rec.event_type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              {rec.created_at ? formatTime(rec.created_at) : "—"}
            </span>
            <span
              className="text-[10px] font-mono transition-transform duration-200"
              style={{
                color: "var(--text-muted)",
                display: "inline-block",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Collapsed preview */}
        {!expanded && (
          <div className="px-4 pb-3">
            <p
              className="text-xs font-mono truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {rec.reason_description || rec.action_taken || "—"}
            </p>
          </div>
        )}

        {/* Expanded */}
        {expanded && (
          <div
            className="px-4 pb-4 space-y-3 pt-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {/* Risk bar */}
            <div>
              <div
                className="flex justify-between text-[10px] font-mono mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                <span>RISK SCORE</span>
                <span style={{ color: meta.colorVar }}>
                  {(rec.risk_score * 100).toFixed(1)}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-elevated)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${rec.risk_score * 100}%`,
                    background: lineColor,
                  }}
                />
              </div>
            </div>

            {/* Reason + action */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { title: "REASON", text: rec.reason_description, titleColor: "var(--status-warn)" },
                { title: "ACTION TAKEN", text: rec.action_taken, titleColor: "var(--accent)" },
              ].map(({ title, text, titleColor }) => (
                <div
                  key={title}
                  className="p-2.5 rounded"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <div
                    className="text-[10px] font-mono font-bold mb-1.5 tracking-widest"
                    style={{ color: titleColor }}
                  >
                    {title}
                  </div>
                  <p
                    className="text-xs font-mono leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {text || "—"}
                  </p>
                </div>
              ))}
            </div>

            {/* Meta */}
            <div
              className="flex flex-wrap gap-3 text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              <span>ID: {rec.id.substring(0, 8)}…</span>
              {rec.shipment_id && <span>Shipment: {rec.shipment_id}</span>}
              <span className="ml-auto">{rec.created_at}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsBar({ records }: { records: AuditRecord[] }) {
  const high   = records.filter((r) => r.risk_level === "HIGH").length;
  const medium = records.filter((r) => r.risk_level === "MEDIUM").length;
  const reasonCounts = records.reduce((acc, r) => {
    acc[r.reason_code] = (acc[r.reason_code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total Decisions", value: records.length, colorVar: "var(--text-primary)" },
        { label: "High Risk",       value: high,           colorVar: "var(--risk-high)" },
        { label: "Medium Risk",     value: medium,         colorVar: "var(--risk-medium)" },
        { label: "Top Reason",      value: topReason?.[0] ?? "—", colorVar: "#a78bfa", small: true },
      ].map(({ label, value, colorVar, small }) => (
        <div
          key={label}
          className="rounded-lg px-4 py-3 text-center"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className={`font-black tabular-nums ${small ? "text-sm" : "text-xl"}`}
            style={{ color: colorVar }}
          >
            {value}
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
  );
}

type FilterLevel = "ALL" | "HIGH" | "MEDIUM" | "LOW";

function FilterBar({
  active, onChange, records,
}: {
  active: FilterLevel;
  onChange: (f: FilterLevel) => void;
  records: AuditRecord[];
}) {
  const counts = {
    ALL: records.length,
    HIGH: records.filter((r) => r.risk_level === "HIGH").length,
    MEDIUM: records.filter((r) => r.risk_level === "MEDIUM").length,
    LOW: records.filter((r) => r.risk_level === "LOW").length,
  };

  const activeStyle: Record<FilterLevel, React.CSSProperties> = {
    ALL:    { color: "var(--text-primary)",  borderColor: "var(--border-strong)", background: "var(--bg-elevated)" },
    HIGH:   { color: "var(--risk-high)",     borderColor: "var(--risk-high-border)", background: "var(--risk-high-bg)" },
    MEDIUM: { color: "var(--risk-medium)",   borderColor: "var(--risk-medium-border)", background: "var(--risk-medium-bg)" },
    LOW:    { color: "var(--risk-low)",      borderColor: "var(--risk-low-border)", background: "var(--risk-low-bg)" },
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(["ALL", "HIGH", "MEDIUM", "LOW"] as FilterLevel[]).map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className="px-3 py-1 rounded text-[11px] font-mono font-bold
                     tracking-widest uppercase transition-all duration-150"
          style={
            active === f
              ? { ...activeStyle[f], border: `1px solid` }
              : {
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  background: "transparent",
                }
          }
        >
          {f}
          <span style={{ opacity: 0.6, marginLeft: 6 }}>{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterLevel>("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchRecords = () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API_URL}/dashboard/audit`)
      .then((r) => r.json())
      .then((data) => { setRecords(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(() => { if (autoRefresh) fetchRecords(); }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = filter === "ALL"
    ? records
    : records.filter((r) => r.risk_level === filter);

  return (
    <div
      className="h-full overflow-y-auto scrollbar-thin font-mono"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-10 px-6 py-3 backdrop-blur"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <span
              className="text-xs font-mono font-bold tracking-widest uppercase"
              style={{ color: "var(--text-primary)" }}
            >
              Audit Trail
            </span>
            <span
              className="text-xs font-mono ml-3"
              style={{ color: "var(--text-muted)" }}
            >
              Decision history with full explainability
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px]
                         font-mono uppercase tracking-widest transition-all"
              style={
                autoRefresh
                  ? { border: "1px solid var(--risk-low-border)",
                      background: "var(--risk-low-bg)",
                      color: "var(--risk-low)" }
                  : { border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                      background: "transparent" }
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "animate-pulse" : ""}`}
                style={{ background: autoRefresh ? "var(--risk-low)" : "var(--text-muted)" }}
              />
              {autoRefresh ? "Live" : "Paused"}
            </button>

            <button
              onClick={() => exportCSV(records)}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px]
                         font-mono uppercase tracking-widest transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                border: "1px solid var(--accent-dim)",
                background: "var(--accent-glow)",
                color: "var(--accent)",
              }}
            >
              ↓ Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1
            className="text-lg font-black tracking-widest uppercase mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Decision Audit Trail
          </h1>
          <p
            className="text-xs font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            Every route optimization decision — reason code, ML confidence, and full explainability.
          </p>
        </div>

        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-32"
            style={{ color: "var(--text-muted)" }}
          >
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin mb-4"
              style={{
                borderColor: "var(--border)",
                borderTopColor: "var(--accent)",
              }}
            />
            <span className="text-xs font-mono tracking-widest">
              LOADING AUDIT RECORDS...
            </span>
          </div>
        ) : records.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-32 rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          >
            <div
              className="text-4xl mb-4 opacity-30"
              style={{ color: "var(--text-muted)" }}
            >
              ◈
            </div>
            <div
              className="text-xs tracking-widest mb-2 uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              No Records Yet
            </div>
            <div
              className="text-xs mb-5"
              style={{ color: "var(--text-disabled)" }}
            >
              Run the demo to generate decisions
            </div>
            <div
              className="text-xs font-mono px-4 py-2 rounded"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Click ▶ START DEMO on the dashboard
            </div>
          </div>
        ) : (
          <>
            <div id="audit-stats">
              <StatsBar records={records} />
            </div>
            <div id="audit-filters" className="flex items-center justify-between mb-6">
              <FilterBar active={filter} onChange={setFilter} records={records} />
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {filtered.length} of {records.length} shown
              </span>
            </div>
            <div id="audit-timeline" className="relative">
              {filtered.map((rec, i) => (
                <TimelineEntry
                  key={rec.id}
                  rec={rec}
                  isLast={i === filtered.length - 1}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}