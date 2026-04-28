"use client";

import { useEffect, useState, useRef } from "react";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { RiskLevel } from "@/types";
import { formatTime } from "@/lib/utils";
import Link from "next/link";

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

// ── Reason code → icon + color ──────────────────────────────────────────────

function getReasonMeta(code: string): { icon: string; color: string; bg: string; border: string } {
  switch (code) {
    case "WEATHER_REROUTE":
      return { icon: "⛈", color: "text-blue-400",   bg: "bg-blue-950/30",   border: "border-blue-900/50" };
    case "ANOMALY_DETECTED":
      return { icon: "⚠", color: "text-orange-400", bg: "bg-orange-950/30", border: "border-orange-900/50" };
    case "HUB_CONGESTION":
      return { icon: "🔴", color: "text-red-400",    bg: "bg-red-950/30",    border: "border-red-900/50" };
    case "SLA_BREACH_RISK":
      return { icon: "⏱", color: "text-amber-400",  bg: "bg-amber-950/30",  border: "border-amber-900/50" };
    case "MULTI_FACTOR":
      return { icon: "⚡", color: "text-violet-400", bg: "bg-violet-950/30", border: "border-violet-900/50" };
    case "ROUTE_DEVIATION":
      return { icon: "↗", color: "text-cyan-400",   bg: "bg-cyan-950/30",   border: "border-cyan-900/50" };
    default:
      return { icon: "◈",  color: "text-slate-400",  bg: "bg-slate-900/40",  border: "border-slate-800" };
  }
}

function getRiskLineColor(level: RiskLevel): string {
  switch (level) {
    case "HIGH":   return "bg-red-500";
    case "MEDIUM": return "bg-orange-500";
    default:       return "bg-green-500";
  }
}

// ── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(records: AuditRecord[]) {
  const header = [
    "ID", "Timestamp", "Vehicle", "Risk Level", "Risk Score",
    "Reason Code", "Event Type", "Shipment ID", "Description"
  ].join(",");

  const rows = records.map((r) => [
    r.id,
    r.created_at,
    r.vehicle_id,
    r.risk_level,
    r.risk_score.toFixed(3),
    r.reason_code,
    r.event_type,
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

// ── Timeline entry ───────────────────────────────────────────────────────────

function TimelineEntry({
  rec,
  isLast,
  index,
}: {
  rec: AuditRecord;
  isLast: boolean;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = getReasonMeta(rec.reason_code);
  const lineColor = getRiskLineColor(rec.risk_level);

  return (
    <div className="flex gap-4 group">

      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 w-8">
        {/* Node */}
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center
                      text-sm shrink-0 transition-transform duration-200
                      group-hover:scale-110 ${meta.bg} ${meta.border}`}
        >
          {meta.icon}
        </div>
        {/* Connector line */}
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-1 ${lineColor} opacity-20`} style={{ minHeight: 24 }} />
        )}
      </div>

      {/* Card */}
      <div
        className={`flex-1 mb-4 rounded-lg border transition-all duration-200 cursor-pointer
                    hover:border-slate-600 ${meta.bg} ${meta.border}`}
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-mono font-black tracking-widest ${meta.color}`}>
              {rec.reason_code}
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {rec.vehicle_id}
            </span>
            <RiskBadge level={rec.risk_level} score={rec.risk_score} />
            {rec.event_type && (
              <span className="text-[10px] font-mono text-slate-500 border border-slate-800
                               px-1.5 py-0.5 rounded uppercase">
                {rec.event_type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-mono text-slate-500">
              {rec.created_at ? formatTime(rec.created_at) : "—"}
            </span>
            <span className={`text-[10px] font-mono text-slate-600 transition-transform duration-200
                              ${expanded ? "rotate-180" : ""}`}>
              ▼
            </span>
          </div>
        </div>

        {/* Collapsed preview */}
        {!expanded && (
          <div className="px-4 pb-3">
            <p className="text-xs font-mono text-slate-500 truncate">
              {rec.reason_description || rec.action_taken || "—"}
            </p>
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-800/60 pt-3">

            {/* Risk score bar */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                <span>RISK SCORE</span>
                <span className={meta.color}>{(rec.risk_score * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${lineColor}`}
                  style={{
                    width: `${rec.risk_score * 100}%`,
                    boxShadow: rec.risk_level === "HIGH" ? `0 0 6px currentColor` : "none",
                  }}
                />
              </div>
            </div>

            {/* Reason + action grid */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="p-2.5 rounded border border-slate-800 bg-slate-950/40">
                <div className="text-[10px] font-mono text-amber-500 font-bold mb-1.5 tracking-widest">
                  REASON
                </div>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  {rec.reason_description || "—"}
                </p>
              </div>
              <div className="p-2.5 rounded border border-slate-800 bg-slate-950/40">
                <div className="text-[10px] font-mono text-cyan-600 font-bold mb-1.5 tracking-widest">
                  ACTION TAKEN
                </div>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  {rec.action_taken || "—"}
                </p>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-600">
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

// ── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ records }: { records: AuditRecord[] }) {
  const high   = records.filter((r) => r.risk_level === "HIGH").length;
  const medium = records.filter((r) => r.risk_level === "MEDIUM").length;
  const low    = records.filter((r) => r.risk_level === "LOW").length;

  const reasonCounts = records.reduce((acc, r) => {
    acc[r.reason_code] = (acc[r.reason_code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total Decisions", value: records.length, color: "text-white" },
        { label: "High Risk",       value: high,           color: "text-red-400" },
        { label: "Medium Risk",     value: medium,         color: "text-orange-400" },
        { label: "Top Reason",      value: topReason?.[0] ?? "—", color: "text-violet-400", small: true },
      ].map(({ label, value, color, small }) => (
        <div key={label}
          className="bg-slate-900/40 border border-slate-800 rounded-lg px-4 py-3 text-center">
          <div className={`font-black tabular-nums ${small ? "text-sm" : "text-xl"} ${color}`}>
            {value}
          </div>
          <div className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mt-1">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────

type FilterLevel = "ALL" | "HIGH" | "MEDIUM" | "LOW";

function FilterBar({
  active,
  onChange,
  records,
}: {
  active: FilterLevel;
  onChange: (f: FilterLevel) => void;
  records: AuditRecord[];
}) {
  const counts: Record<FilterLevel, number> = {
    ALL:    records.length,
    HIGH:   records.filter((r) => r.risk_level === "HIGH").length,
    MEDIUM: records.filter((r) => r.risk_level === "MEDIUM").length,
    LOW:    records.filter((r) => r.risk_level === "LOW").length,
  };

  const filters: FilterLevel[] = ["ALL", "HIGH", "MEDIUM", "LOW"];
  const colors: Record<FilterLevel, string> = {
    ALL:    "text-white border-slate-600 bg-slate-800/60",
    HIGH:   "text-red-400 border-red-800 bg-red-950/40",
    MEDIUM: "text-orange-400 border-orange-800 bg-orange-950/40",
    LOW:    "text-green-400 border-green-800 bg-green-950/40",
  };
  const inactive = "text-slate-500 border-slate-800 bg-transparent hover:border-slate-600";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-3 py-1 rounded border text-[11px] font-mono font-bold
                      tracking-widest uppercase transition-all duration-150
                      ${active === f ? colors[f] : inactive}`}
        >
          {f}
          <span className="ml-1.5 opacity-60">{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterLevel>("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchRecords = () => {
    fetch("http://localhost:8000/dashboard/audit")
      .then((r) => r.json())
      .then((data) => { setRecords(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(() => {
      if (autoRefresh) fetchRecords();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = filter === "ALL"
    ? records
    : records.filter((r) => r.risk_level === filter);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 font-mono">

      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-800
                         bg-[#080c14]/95 backdrop-blur px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="relative w-6 h-6 shrink-0">
              <div className="absolute inset-0 border-2 border-cyan-500 rotate-45 rounded-sm" />
              <div className="absolute inset-[4px] bg-cyan-400 rotate-45 rounded-sm" />
            </div>
            <span className="text-sm font-black tracking-[0.12em] text-white uppercase">
              Chain<span className="text-cyan-400">Pulse</span>
            </span>
            <span className="text-slate-700 text-xs">›</span>
            <span className="text-xs font-mono text-slate-400 tracking-widest uppercase">
              Audit Trail
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded border text-[10px]
                          font-mono uppercase tracking-widest transition-all
                          ${autoRefresh
                            ? "border-green-800 bg-green-950/30 text-green-400"
                            : "border-slate-700 text-slate-500"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full
                ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-slate-600"}`} />
              {autoRefresh ? "Live" : "Paused"}
            </button>

            {/* CSV export */}
            <button
              onClick={() => exportCSV(records)}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded border border-cyan-900
                         bg-cyan-950/30 text-cyan-400 text-[10px] font-mono uppercase
                         tracking-widest hover:border-cyan-700 transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↓ Export CSV
            </button>

            <Link
              href="/"
              className="px-3 py-1 rounded border border-slate-700 text-slate-400
                         text-[10px] font-mono uppercase tracking-widest
                         hover:border-slate-500 transition-all"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Sub-header */}
        <div className="mb-6">
          <h1 className="text-lg font-black tracking-widest text-white uppercase mb-1">
            Decision Audit Trail
          </h1>
          <p className="text-xs font-mono text-slate-500">
            Every route optimization decision — reason code, ML confidence, and full explainability.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-600">
            <div className="w-8 h-8 border-2 border-cyan-800 border-t-cyan-400
                            rounded-full animate-spin mb-4" />
            <span className="text-xs font-mono tracking-widest">
              LOADING AUDIT RECORDS...
            </span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 border
                          border-slate-800 rounded-xl">
            <div className="text-4xl mb-4 opacity-30">◈</div>
            <div className="text-slate-500 text-xs tracking-widest mb-2 uppercase">
              No Records Yet
            </div>
            <div className="text-slate-700 text-xs mb-5">
              Run the demo to generate decisions
            </div>
            <div className="text-xs font-mono text-cyan-900 bg-slate-900
                            px-4 py-2 rounded border border-slate-800">
              Click ▶ START DEMO on the dashboard
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <StatsBar records={records} />

            {/* Filter bar */}
            <div className="flex items-center justify-between mb-6">
              <FilterBar active={filter} onChange={setFilter} records={records} />
              <span className="text-[10px] font-mono text-slate-600">
                {filtered.length} of {records.length} shown
              </span>
            </div>

            {/* Timeline */}
            <div className="relative">
              {filtered.map((rec, i) => (
                <TimelineEntry
                  key={rec.id}
                  rec={rec}
                  isLast={i === filtered.length - 1}
                  index={i}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}