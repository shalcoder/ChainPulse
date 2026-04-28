"use client";

import { useMemo, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useFleetState } from "@/hooks/useFleetState";
import { VehiclePosition } from "@/types";
import { riskColor } from "@/lib/utils";
import { PageTransition } from "@/components/ui/PageTransition";

// ── Sort config ───────────────────────────────────────────────────────────────

type SortKey = "risk_score" | "speed_kmh" | "vehicle_id" | "anomaly_score";
type SortDir = "asc" | "desc";

// ── Risk level helpers ────────────────────────────────────────────────────────

function riskBg(level: string): React.CSSProperties {
  switch (level) {
    case "HIGH":   return { background: "var(--risk-high-bg)",   borderLeft: "3px solid var(--risk-high)" };
    case "MEDIUM": return { background: "var(--risk-medium-bg)", borderLeft: "3px solid var(--risk-medium)" };
    default:       return { background: "transparent",           borderLeft: "3px solid transparent" };
  }
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colorVar,
}: {
  label: string;
  value: number | string;
  sub?: string;
  colorVar: string;
}) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col gap-1 transition-all duration-200"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="text-2xl font-black tabular-nums leading-none"
        style={{ color: colorVar }}
      >
        {value}
      </span>
      <span
        className="text-[11px] font-mono tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      {sub && (
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--text-disabled)" }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Sort Header Cell ──────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, active, dir, onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th
      className="px-4 py-3 text-left cursor-pointer select-none group"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-mono font-bold tracking-widest uppercase
                     transition-colors duration-150"
          style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
        >
          {label}
        </span>
        <span
          className="text-[10px] transition-all duration-150"
          style={{
            color: active ? "var(--accent)" : "var(--text-disabled)",
            opacity: active ? 1 : 0,
            transform: dir === "asc" ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </div>
    </th>
  );
}

// ── Vehicle Row ───────────────────────────────────────────────────────────────

function VehicleRow({ v, rank }: { v: VehiclePosition; rank: number }) {
  const color = riskColor(v.risk_level);
  const isHigh = v.risk_level === "HIGH";
  const anomalyPct = Math.min((v.anomaly_score ?? 0) * 100, 100);

  return (
    <tr
      className="transition-colors duration-150 group"
      style={riskBg(v.risk_level)}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--bg-elevated)")
      }
      onMouseLeave={(e) => {
        const s = riskBg(v.risk_level);
        e.currentTarget.style.background = s.background as string;
      }}
    >
      {/* Rank */}
      <td className="px-4 py-3 w-10">
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: "var(--text-disabled)" }}
        >
          {String(rank).padStart(2, "0")}
        </span>
      </td>

      {/* Vehicle ID */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${isHigh ? "animate-pulse" : ""}`}
            style={{ background: color }}
          />
          <span
            className="text-sm font-mono font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {v.vehicle_id}
          </span>
          {v.status === "ANOMALY" && (
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded tracking-widest"
              style={{
                background: "var(--risk-medium-bg)",
                border: "1px solid var(--risk-medium-border)",
                color: "var(--risk-medium)",
              }}
            >
              ANOMALY
            </span>
          )}
        </div>
      </td>

      {/* Risk level + bar */}
      <td className="px-4 py-3 min-w-[140px]">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono font-bold w-14 shrink-0"
            style={{ color }}
          >
            {v.risk_level}
          </span>
          <div className="flex-1 flex items-center gap-1.5">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-elevated)", minWidth: 60 }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${v.risk_score * 100}%`,
                  background: color,
                  boxShadow: isHigh ? `0 0 6px ${color}` : "none",
                }}
              />
            </div>
            <span
              className="text-[10px] font-mono tabular-nums w-8 text-right shrink-0"
              style={{ color: "var(--text-secondary)" }}
            >
              {(v.risk_score * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </td>

      {/* Speed */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span
          className="text-sm font-mono tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          {v.speed_kmh}
          <span
            className="text-[10px] ml-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            km/h
          </span>
        </span>
      </td>

      {/* Anomaly score */}
      <td className="px-4 py-3 hidden md:table-cell min-w-[120px]">
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: "var(--bg-elevated)", minWidth: 50 }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${anomalyPct}%`,
                background:
                  anomalyPct > 60
                    ? "var(--risk-medium)"
                    : "var(--border-strong)",
              }}
            />
          </div>
          <span
            className="text-[10px] font-mono tabular-nums w-7 text-right shrink-0"
            style={{
              color:
                anomalyPct > 60
                  ? "var(--risk-medium)"
                  : "var(--text-muted)",
            }}
          >
            {anomalyPct.toFixed(0)}
          </span>
        </div>
      </td>

      {/* Position */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span
          className="text-[10px] font-mono tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {v.lat?.toFixed(4)}, {v.lng?.toFixed(4)}
        </span>
      </td>
    </tr>
  );
}

// ── Mobile Card (shown on xs screens instead of table) ────────────────────────

function VehicleCard({ v, rank }: { v: VehiclePosition; rank: number }) {
  const color = riskColor(v.risk_level);
  const isHigh = v.risk_level === "HIGH";

  return (
    <div
      className="rounded-lg p-3 transition-colors duration-150"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--text-disabled)" }}
          >
            #{rank}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${isHigh ? "animate-pulse" : ""}`}
            style={{ background: color }}
          />
          <span
            className="text-sm font-mono font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {v.vehicle_id}
          </span>
          {v.status === "ANOMALY" && (
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                background: "var(--risk-medium-bg)",
                border: "1px solid var(--risk-medium-border)",
                color: "var(--risk-medium)",
              }}
            >
              ANOMALY
            </span>
          )}
        </div>
        <span
          className="text-xs font-mono font-bold"
          style={{ color }}
        >
          {v.risk_level}
        </span>
      </div>

      {/* Risk bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden mb-2"
        style={{ background: "var(--bg-elevated)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${v.risk_score * 100}%`,
            background: color,
            boxShadow: isHigh ? `0 0 6px ${color}` : "none",
          }}
        />
      </div>

      <div
        className="flex items-center justify-between text-[10px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        <span>Risk: {(v.risk_score * 100).toFixed(0)}%</span>
        <span>{v.speed_kmh} km/h</span>
        <span>Anomaly: {((v.anomaly_score ?? 0) * 100).toFixed(0)}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FleetPage() {
  const { lastMessage } = useWebSocket();
  const { vehicles } = useFleetState(lastMessage);

  const [sortKey, setSortKey]   = useState<SortKey>("risk_score");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");
  const [search,  setSearch]    = useState("");
  const [levelFilter, setLevel] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    let list = [...vehicles];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((v) => v.vehicle_id.toLowerCase().includes(q));
    }

    if (levelFilter !== "ALL") {
      list = list.filter((v) => v.risk_level === levelFilter);
    }

    list.sort((a, b) => {
      let av: number | string = a[sortKey] ?? 0;
      let bv: number | string = b[sortKey] ?? 0;
      if (sortKey === "vehicle_id") {
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sortDir === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });

    return list;
  }, [vehicles, sortKey, sortDir, search, levelFilter]);

  // Stats
  const high   = vehicles.filter((v) => v.risk_level === "HIGH").length;
  const medium = vehicles.filter((v) => v.risk_level === "MEDIUM").length;
  const low    = vehicles.filter((v) => v.risk_level === "LOW").length;
  const anomalies = vehicles.filter((v) => v.status === "ANOMALY").length;
  const avgRisk = vehicles.length
    ? (vehicles.reduce((s, v) => s + v.risk_score, 0) / vehicles.length * 100).toFixed(1)
    : "0.0";

  return (
    <PageTransition> 
    <div
      className="h-full overflow-y-auto scrollbar-thin font-mono"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Page header ──────────────────────────────────────────── */}
      <div
        className="px-6 py-5 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1
                className="text-lg font-black tracking-widest uppercase mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                Fleet Monitor
              </h1>
              <p
                className="text-xs font-mono leading-relaxed max-w-xl"
                style={{ color: "var(--text-muted)" }}
              >
                Live view of all {vehicles.length} vehicles sorted by risk. Vehicles at the top
                need the most attention — watch the risk bars and anomaly scores update in real time.
              </p>
            </div>
            {/* Live indicator */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px]
                         font-mono uppercase tracking-widest shrink-0 self-start sm:self-auto"
              style={{
                border: "1px solid var(--risk-low-border)",
                background: "var(--risk-low-bg)",
                color: "var(--risk-low)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--risk-low)" }}
              />
              Live · {vehicles.length} units
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stat cards ───────────────────────────────────────────── */}
        <div id="fleet-stats" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total Fleet"  value={vehicles.length} colorVar="var(--text-primary)"
            sub="active vehicles" />
          <StatCard label="High Risk"    value={high}   colorVar="var(--risk-high)"
            sub="need immediate action" />
          <StatCard label="Medium Risk"  value={medium} colorVar="var(--risk-medium)"
            sub="being monitored" />
          <StatCard label="Nominal"      value={low}    colorVar="var(--risk-low)"
            sub="on schedule" />
          <StatCard label="Anomalies"    value={anomalies} colorVar="var(--status-warn)"
            sub={`avg risk ${avgRisk}%`} />
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div
          id="fleet-filters"
          className="rounded-xl p-4"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                ⌕
              </span>
              <input
                type="text"
                placeholder="Search vehicle ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs font-mono
                           outline-none transition-all duration-150"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border-focus)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              />
            </div>

            {/* Level filter buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((lvl) => {
                const colorMap = {
                  ALL:    "var(--text-primary)",
                  HIGH:   "var(--risk-high)",
                  MEDIUM: "var(--risk-medium)",
                  LOW:    "var(--risk-low)",
                };
                const bgMap = {
                  ALL:    "var(--bg-elevated)",
                  HIGH:   "var(--risk-high-bg)",
                  MEDIUM: "var(--risk-medium-bg)",
                  LOW:    "var(--risk-low-bg)",
                };
                const borderMap = {
                  ALL:    "var(--border-strong)",
                  HIGH:   "var(--risk-high-border)",
                  MEDIUM: "var(--risk-medium-border)",
                  LOW:    "var(--risk-low-border)",
                };
                const isActive = levelFilter === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className="px-3 py-2 rounded-lg text-[10px] font-mono font-bold
                               tracking-widest uppercase transition-all duration-150"
                    style={
                      isActive
                        ? {
                            color: colorMap[lvl],
                            background: bgMap[lvl],
                            border: `1px solid ${borderMap[lvl]}`,
                          }
                        : {
                            color: "var(--text-muted)",
                            background: "transparent",
                            border: "1px solid var(--border)",
                          }
                    }
                  >
                    {lvl}
                    <span style={{ opacity: 0.6, marginLeft: 5 }}>
                      {lvl === "ALL"
                        ? vehicles.length
                        : vehicles.filter((v) => v.risk_level === lvl).length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Result count */}
          <div
            className="mt-2 text-[10px] font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            Showing {filtered.length} of {vehicles.length} vehicles
            {search && ` matching "${search}"`}
          </div>
        </div>

        {/* ── Table — desktop/tablet ───────────────────────────────── */}
        {vehicles.length === 0 ? (
          <div
            className="rounded-xl py-24 flex flex-col items-center gap-3"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="text-3xl opacity-20"
              style={{ color: "var(--text-muted)" }}
            >
              ⬡
            </div>
            <div
              className="text-xs font-mono tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Waiting for vehicle data…
            </div>
            <div
              className="text-[10px] font-mono"
              style={{ color: "var(--text-disabled)" }}
            >
              Connect to the backend or run the demo to populate fleet
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div
              id="fleet-table"
              className="hidden sm:block rounded-xl overflow-hidden"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                      }}
                    >
                      <th className="px-4 py-3 w-10">
                        <span
                          className="text-[10px] font-mono tracking-widest uppercase"
                          style={{ color: "var(--text-muted)" }}
                        >
                          #
                        </span>
                      </th>
                      <SortTh label="Vehicle"  sortKey="vehicle_id"    active={sortKey==="vehicle_id"}    dir={sortDir} onClick={() => handleSort("vehicle_id")} />
                      <SortTh label="Risk"     sortKey="risk_score"    active={sortKey==="risk_score"}    dir={sortDir} onClick={() => handleSort("risk_score")} />
                      <SortTh label="Speed"    sortKey="speed_kmh"     active={sortKey==="speed_kmh"}     dir={sortDir} onClick={() => handleSort("speed_kmh")} />
                      <SortTh label="Anomaly"  sortKey="anomaly_score" active={sortKey==="anomaly_score"} dir={sortDir} onClick={() => handleSort("anomaly_score")} />
                      <th className="px-4 py-3 hidden lg:table-cell">
                        <span
                          className="text-[10px] font-mono tracking-widest uppercase"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Position
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v, i) => (
                      <VehicleRow key={v.vehicle_id} v={v} rank={i + 1} />
                    ))}
                  </tbody>
                </table>
              </div>

              {filtered.length === 0 && (
                <div
                  className="py-12 text-center text-xs font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  No vehicles match your filter
                </div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {filtered.map((v, i) => (
                <VehicleCard key={v.vehicle_id} v={v} rank={i + 1} />
              ))}
              {filtered.length === 0 && (
                <div
                  className="py-12 text-center text-xs font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  No vehicles match your filter
                </div>
              )}
            </div>
          </>
        )}

        {/* ── How to read this page ────────────────────────────────── */}
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
            How to read this page
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "▬",
                color: "var(--risk-high)",
                title: "Risk Bar",
                desc: "Shows the combined AI risk score (0–100%). Red = HIGH means OR-Tools will auto-reroute this vehicle.",
              },
              {
                icon: "◎",
                color: "var(--status-warn)",
                title: "Anomaly Score",
                desc: "IsolationForest score. A high value means unusual GPS behavior, dwell time, or route deviation.",
              },
              {
                icon: "⚡",
                color: "var(--accent)",
                title: "ANOMALY Badge",
                desc: "Shown when IsolationForest flags this vehicle as an outlier compared to normal fleet patterns.",
              },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="flex gap-3">
                <span
                  className="text-lg shrink-0 leading-none mt-0.5"
                  style={{ color }}
                >
                  {icon}
                </span>
                <div>
                  <div
                    className="text-xs font-mono font-bold mb-1"
                    style={{ color: "var(--text-primary)" }}
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
            ))}
          </div>
        </div>

      </div>
    </div>
    </PageTransition>
  );
}