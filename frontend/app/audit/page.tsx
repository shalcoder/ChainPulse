"use client";

import { useEffect, useState } from "react";
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

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/dashboard/audit")
      .then((r) => r.json())
      .then((data) => {
        setRecords(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetch("http://localhost:8000/dashboard/audit")
        .then((r) => r.json())
        .then(setRecords)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/"
              className="text-xs text-cyan-500 hover:text-cyan-300 tracking-widest uppercase border border-cyan-900 px-2 py-1 rounded"
            >
              ← Dashboard
            </Link>
            <h1 className="text-sm font-black tracking-[0.2em] uppercase text-white">
              Chain<span className="text-cyan-400">Pulse</span> — Audit Trail
            </h1>
          </div>
          <p className="text-xs text-slate-500 tracking-widest">
            Complete decision history with explainability — every route change logged
          </p>
        </div>
        <div className="text-xs font-mono text-slate-600">
          {records.length} decisions recorded
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-slate-600 text-xs tracking-widest">
          LOADING AUDIT RECORDS...
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-20 border border-slate-800 rounded-lg">
          <div className="text-slate-600 text-xs tracking-widest mb-2">NO RECORDS YET</div>
          <div className="text-slate-700 text-xs">
            Run the demo injector to generate decisions
          </div>
          <div className="mt-4 text-xs font-mono text-cyan-900 bg-slate-900 px-4 py-2 rounded inline-block">
            python scripts/demo_injector.py
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="border border-slate-800 bg-slate-900/40 rounded-lg p-4 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <RiskBadge level={rec.risk_level} score={rec.risk_score} />
                  <span className="text-sm font-bold text-white">{rec.vehicle_id}</span>
                  <span className="text-xs text-slate-500 border border-slate-800 px-2 py-0.5 rounded">
                    {rec.event_type}
                  </span>
                </div>
                <span className="text-xs text-slate-600 shrink-0">
                  {rec.created_at ? formatTime(rec.created_at) : "—"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-2 bg-slate-950/60 rounded border border-amber-900/30">
                  <div className="text-xs text-amber-500 font-bold mb-1">REASON CODE</div>
                  <div className="text-xs text-slate-300">{rec.reason_code}</div>
                </div>
                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <div className="text-xs text-cyan-600 font-bold mb-1">ACTION TAKEN</div>
                  <div className="text-xs text-slate-300">{rec.action_taken}</div>
                </div>
              </div>

              <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                <div className="text-xs text-slate-500 font-bold mb-1">EXPLANATION</div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  {rec.reason_description}
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-700 font-mono">
                ID: {rec.id}
                {rec.shipment_id && ` · Shipment: ${rec.shipment_id}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}