"use client";

import { useState } from "react";

// ── Pipeline steps ─────────────────────────────────────────────────────────

const PIPELINE = [
  {
    step: "01",
    label: "SENSE",
    icon: "≋",
    color: "var(--accent)",
    border: "var(--border-focus)",
    bg: "var(--accent-glow)",
    title: "Live Event Ingestion",
    what: "Four Kafka topics receive a continuous stream of real-world signals every second — GPS coordinates from each vehicle, weather severity scores, warehouse scan events, and order status changes.",
    how: "Apache Kafka acts as the event bus. Each event type has its own topic: gps-updates, weather-alerts, order-events, warehouse-events. A FastAPI async consumer normalises every message into a standard schema before passing it downstream.",
    tech: ["Apache Kafka", "FastAPI", "Pydantic"],
  },
  {
    step: "02",
    label: "PREDICT",
    icon: "◈",
    color: "#a78bfa",
    border: "#7c3aed",
    bg: "#a78bfa18",
    title: "ML Risk Scoring",
    what: "Two machine learning models run on every incoming event. XGBoost predicts the probability of a delivery delay. IsolationForest detects whether the vehicle's behaviour is anomalous compared to its normal pattern.",
    how: "XGBoost uses 8 features: route length, historic travel time, weather severity, hub congestion, day of week, hour of day, vehicle type, and recent delay history. IsolationForest scores GPS jumps, unusual dwell times, route deviations, and missing scans. Both scores feed into the weighted RiskScore formula.",
    tech: ["XGBoost", "IsolationForest", "scikit-learn"],
  },
  {
    step: "03",
    label: "SCORE",
    icon: "⊕",
    color: "var(--status-warn)",
    border: "#a16207",
    bg: "#facc1518",
    title: "Weighted Risk Formula",
    what: "A single composite RiskScore (0.0–1.0) is computed for every vehicle on every event. Scores above 0.70 are HIGH risk and trigger automatic rerouting. Scores above 0.45 are MEDIUM and placed under closer monitoring.",
    how: null,
    formula: true,
    tech: ["Custom formula", "Redis cache"],
  },
  {
    step: "04",
    label: "OPTIMIZE",
    icon: "⊞",
    color: "var(--risk-medium)",
    border: "var(--risk-medium-border)",
    bg: "var(--risk-medium-bg)",
    title: "OR-Tools Route Solver",
    what: "When a vehicle crosses the HIGH risk threshold, Google OR-Tools solves a Vehicle Routing Problem with Time Windows (VRPTW) — a constrained optimisation problem that finds the fastest valid route under real operational rules.",
    how: "Hard constraints enforced: vehicle capacity limits, pickup must happen before drop-off, all vehicles return to depot, delivery time windows per shipment, SLA breach penalties. The solver runs for a maximum of 10 seconds and only re-optimises the affected vehicles — not the entire fleet — for speed.",
    tech: ["Google OR-Tools", "VRPTW", "FastAPI"],
  },
  {
    step: "05",
    label: "EXECUTE",
    icon: "⇌",
    color: "var(--status-ok)",
    border: "var(--risk-low-border)",
    bg: "var(--risk-low-bg)",
    title: "Real-Time Dispatch",
    what: "The new route, ETA delta, reason code, and solver confidence are pushed instantly to every connected dashboard via WebSocket. The map animates the reroute in orange. The audit trail records the full decision with explainability.",
    how: "FastAPI manages the WebSocket broadcast. Every decision is written to PostgreSQL with a structured audit record — vehicle ID, reason code, old ETA, new ETA, ML confidence, solver status, and all route stops. Judges can replay the full decision history on the Audit Trail page.",
    tech: ["WebSocket", "PostgreSQL", "PostGIS"],
  },
];

// ── Tech stack ─────────────────────────────────────────────────────────────

const STACK = [
  {
    category: "Frontend",
    color: "var(--accent)",
    items: [
      { name: "Next.js 14",     desc: "App router, server components, page-level layouts" },
      { name: "Mapbox GL JS",   desc: "Live vehicle markers, animated reroute lines, hub overlays" },
      { name: "TypeScript",     desc: "Full type safety across all components and API calls" },
      { name: "Tailwind CSS",   desc: "Utility-first styling with CSS variable theme system" },
    ],
  },
  {
    category: "Backend",
    color: "#a78bfa",
    items: [
      { name: "FastAPI",        desc: "Async REST + WebSocket push, event ingestion, orchestration" },
      { name: "Apache Kafka",   desc: "Event bus for GPS, weather, order, warehouse streams" },
      { name: "PostgreSQL",     desc: "Shipments, vehicles, routes, decisions, audit log (PostGIS)" },
      { name: "Redis",          desc: "Hot vehicle position cache, route state, distributed locks" },
    ],
  },
  {
    category: "AI / ML",
    color: "var(--status-warn)",
    items: [
      { name: "XGBoost",        desc: "Tabular delay prediction — 8 operational features, trained on 10k records" },
      { name: "IsolationForest",desc: "Unsupervised anomaly detection on GPS and event deviation patterns" },
      { name: "OR-Tools",       desc: "VRPTW constrained route optimisation — capacity, time windows, SLA" },
      { name: "scikit-learn",   desc: "Model training pipeline, feature engineering, .pkl serialisation" },
    ],
  },
];

// ── Risk formula ───────────────────────────────────────────────────────────

const FORMULA_TERMS = [
  { weight: "0.45", label: "Delay Probability",  color: "var(--risk-high)",   desc: "XGBoost output — how likely is this vehicle to be late?" },
  { weight: "0.25", label: "Anomaly Score",       color: "#a78bfa",            desc: "IsolationForest — how unusual is this vehicle's current behaviour?" },
  { weight: "0.20", label: "SLA Criticality",     color: "var(--status-warn)", desc: "How close is the shipment to its guaranteed delivery window?" },
  { weight: "0.10", label: "Weather Severity",    color: "var(--accent)",      desc: "Live severity score from the weather-alerts Kafka topic." },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function TechPill({ name }: { name: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold
                 tracking-widest uppercase"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      {name}
    </span>
  );
}

function FormulaBlock() {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Formula display */}
      <div
        className="text-xs font-mono text-center py-3 px-4 rounded-lg leading-loose"
        style={{
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>RiskScore = </span>
        <span style={{ color: "var(--risk-high)" }}>0.45 × delay_prob</span>
        <span style={{ color: "var(--text-muted)" }}> + </span>
        <span style={{ color: "#a78bfa" }}>0.25 × anomaly_score</span>
        <span style={{ color: "var(--text-muted)" }}> + </span>
        <span style={{ color: "var(--status-warn)" }}>0.20 × sla_criticality</span>
        <span style={{ color: "var(--text-muted)" }}> + </span>
        <span style={{ color: "var(--accent)" }}>0.10 × weather_severity</span>
      </div>

      {/* Term breakdown */}
      <div className="space-y-2">
        {FORMULA_TERMS.map(({ weight, label, color, desc }) => (
          <div key={label} className="flex items-start gap-3">
            {/* Weight pill */}
            <span
              className="text-sm font-mono font-black shrink-0 w-10 text-right"
              style={{ color }}
            >
              {weight}
            </span>
            {/* Bar */}
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-mono font-bold"
                  style={{ color }}
                >
                  {label}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-base)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${parseFloat(weight) * 100}%`,
                    background: color,
                  }}
                />
              </div>
              <span
                className="text-[10px] font-mono leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {desc}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Thresholds */}
      <div
        className="grid grid-cols-2 gap-3 pt-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="rounded-lg px-3 py-2 text-center"
          style={{
            background: "var(--risk-high-bg)",
            border: "1px solid var(--risk-high-border)",
          }}
        >
          <div
            className="text-sm font-mono font-black"
            style={{ color: "var(--risk-high)" }}
          >
            ≥ 0.70
          </div>
          <div
            className="text-[10px] font-mono uppercase tracking-widest mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            HIGH — auto-reroute
          </div>
        </div>
        <div
          className="rounded-lg px-3 py-2 text-center"
          style={{
            background: "var(--risk-medium-bg)",
            border: "1px solid var(--risk-medium-border)",
          }}
        >
          <div
            className="text-sm font-mono font-black"
            style={{ color: "var(--risk-medium)" }}
          >
            ≥ 0.45
          </div>
          <div
            className="text-[10px] font-mono uppercase tracking-widest mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            MEDIUM — monitor
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineStep({
  step: s,
  index,
  isLast,
  isOpen,
  onToggle,
}: {
  step: (typeof PIPELINE)[0];
  index: number;
  isLast: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex gap-4 sm:gap-6">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-full border-2 flex items-center justify-center
                     text-lg font-mono shrink-0 transition-all duration-200
                     hover:scale-110 focus-visible:outline-none"
          style={{
            borderColor: isOpen ? s.color : "var(--border)",
            background: isOpen ? s.bg : "var(--bg-surface)",
            color: isOpen ? s.color : "var(--text-muted)",
            boxShadow: isOpen ? `0 0 12px ${s.bg}` : "none",
          }}
          aria-expanded={isOpen}
          aria-label={`${s.label} — ${s.title}`}
        >
          {s.icon}
        </button>
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-2 mb-2 opacity-20 transition-opacity duration-200"
            style={{
              minHeight: 24,
              background: isOpen ? s.color : "var(--border)",
              opacity: isOpen ? 0.4 : 0.2,
            }}
          />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 mb-4">
        {/* Header — always visible */}
        <button
          onClick={onToggle}
          className="w-full text-left mb-2 group"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-[10px] font-mono font-bold tracking-widest"
              style={{ color: s.color }}
            >
              STEP {s.step}
            </span>
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded tracking-widest uppercase"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
              }}
            >
              {s.label}
            </span>
            <span
              className="text-sm font-mono font-black"
              style={{ color: "var(--text-primary)" }}
            >
              {s.title}
            </span>
            <span
              className="ml-auto text-[10px] font-mono transition-transform duration-200
                         inline-block"
              style={{
                color: "var(--text-muted)",
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>
          </div>
        </button>

        {/* Expanded content */}
        {isOpen && (
          <div
            className="rounded-xl p-4 sm:p-5 space-y-4"
            style={{
              background: "var(--bg-surface)",
              border: `1px solid var(--border)`,
              borderLeft: `3px solid ${s.color}`,
            }}
          >
            {/* What */}
            <div>
              <div
                className="text-[10px] font-mono font-bold tracking-widest uppercase mb-1.5"
                style={{ color: s.color }}
              >
                What happens
              </div>
              <p
                className="text-xs font-mono leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {s.what}
              </p>
            </div>

            {/* How / Formula */}
            {s.formula ? (
              <div>
                <div
                  className="text-[10px] font-mono font-bold tracking-widest uppercase mb-2"
                  style={{ color: s.color }}
                >
                  The formula
                </div>
                <FormulaBlock />
              </div>
            ) : s.how ? (
              <div>
                <div
                  className="text-[10px] font-mono font-bold tracking-widest uppercase mb-1.5"
                  style={{ color: s.color }}
                >
                  How it works
                </div>
                <p
                  className="text-xs font-mono leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.how}
                </p>
              </div>
            ) : null}

            {/* Tech pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {s.tech.map((t) => (
                <TechPill key={t} name={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StackCategory({
  category,
  color,
  items,
}: {
  category: string;
  color: string;
  items: { name: string; desc: string }[];
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Category header */}
      <div
        className="px-4 py-3"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <span
          className="text-[10px] font-mono font-bold tracking-widest uppercase"
          style={{ color }}
        >
          {category}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {items.map(({ name, desc }) => (
          <div
            key={name}
            className="px-4 py-3 transition-colors duration-150"
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-elevated)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <div
              className="text-xs font-mono font-bold mb-0.5"
              style={{ color: "var(--text-primary)" }}
            >
              {name}
            </div>
            <div
              className="text-[11px] font-mono leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Demo sequence ──────────────────────────────────────────────────────────

const DEMO_STEPS = [
  { n: 1, icon: "⬡", color: "var(--status-ok)",   text: "Open the dashboard — 20 vehicles moving on the live map, all risk scores green." },
  { n: 2, icon: "⛈", color: "var(--accent)",       text: "Inject a weather alert. Risk scores rise on 3 affected vehicles. Alerts appear in the feed." },
  { n: 3, icon: "◎", color: "#a78bfa",              text: "IsolationForest detects a GPS anomaly on one vehicle. ANOMALY badge appears on the map marker." },
  { n: 4, icon: "⊕", color: "var(--status-warn)",  text: "RiskScore crosses 0.70. The system automatically calls OR-Tools — no human needed." },
  { n: 5, icon: "⊞", color: "var(--risk-medium)",  text: "New route appears on the map in orange. Decision panel shows old ETA → new ETA → time saved → reason code." },
  { n: 6, icon: "◈", color: "var(--risk-high)",    text: "Open the Audit Trail. Every decision is logged with full explainability — reason, confidence, and solver details." },
];

// ── Main page ──────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [openStep, setOpenStep] = useState<number>(0);

  function toggleStep(i: number) {
    setOpenStep((prev) => (prev === i ? -1 : i));
  }

  return (
    <div
      className="h-full overflow-y-auto scrollbar-thin font-mono"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Page header ─────────────────────────────────────────── */}
      <div
        className="px-6 py-5 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="max-w-4xl mx-auto">
          <h1
            className="text-lg font-black tracking-widest uppercase mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            How It Works
          </h1>
          <p
            className="text-xs font-mono leading-relaxed max-w-2xl"
            style={{ color: "var(--text-muted)" }}
          >
            ChainPulse is a closed-loop AI system — it continuously senses disruption signals,
            scores risk with real ML models, re-optimises routes under hard constraints, and
            pushes decisions to operators in real time. Click each step to expand it.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-12">

        {/* ── Pipeline ────────────────────────────────────────────── */}
        <section>
          <div
            className="text-[10px] font-mono font-bold tracking-widest uppercase mb-6"
            style={{ color: "var(--text-muted)" }}
          >
            The Pipeline — Sense → Predict → Score → Optimise → Execute
          </div>

          <div>
            {PIPELINE.map((step, i) => (
              <PipelineStep
                key={step.step}
                step={step}
                index={i}
                isLast={i === PIPELINE.length - 1}
                isOpen={openStep === i}
                onToggle={() => toggleStep(i)}
              />
            ))}
          </div>
        </section>

        {/* ── Demo sequence ────────────────────────────────────────── */}
        <section>
          <div
            className="text-[10px] font-mono font-bold tracking-widest uppercase mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Demo Flow
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            {DEMO_STEPS.map((ds, i) => (
              <div
                key={ds.n}
                className="flex items-start gap-4 px-5 py-4 transition-colors duration-150"
                style={{
                  borderBottom:
                    i < DEMO_STEPS.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-elevated)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Step number */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center
                             text-[10px] font-mono font-black shrink-0 mt-0.5"
                  style={{
                    background: `${ds.color}18`,
                    border: `1px solid ${ds.color}`,
                    color: ds.color,
                  }}
                >
                  {ds.n}
                </div>

                {/* Icon */}
                <span
                  className="text-lg leading-none shrink-0 mt-0.5"
                  style={{ color: ds.color }}
                >
                  {ds.icon}
                </span>

                {/* Text */}
                <p
                  className="text-xs font-mono leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {ds.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tech stack ───────────────────────────────────────────── */}
        <section>
          <div
            className="text-[10px] font-mono font-bold tracking-widest uppercase mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Technology Stack
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STACK.map((cat) => (
              <StackCategory
                key={cat.category}
                category={cat.category}
                color={cat.color}
                items={cat.items}
              />
            ))}
          </div>
        </section>

        {/* ── Why this wins ────────────────────────────────────────── */}
        <section>
          <div
            className="text-[10px] font-mono font-bold tracking-widest uppercase mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Why This Prototype Stands Out
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                icon: "≋",
                color: "var(--accent)",
                title: "Real event stream",
                desc: "Kafka, not fake button clicks. Events flow continuously from a synthetic generator that mirrors real IoT data.",
              },
              {
                icon: "◈",
                color: "#a78bfa",
                title: "Two real ML models",
                desc: "XGBoost and IsolationForest are trained, serialised, and loaded — not mocked. Judges can inspect the .pkl files.",
              },
              {
                icon: "⊞",
                color: "var(--risk-medium)",
                title: "Hard-constraint solver",
                desc: "OR-Tools VRPTW enforces capacity, time windows, and pickup order — not a greedy heuristic. NP-hard problem, solved in under 10 seconds.",
              },
              {
                icon: "◫",
                color: "var(--status-warn)",
                title: "Full audit trail",
                desc: "Every decision is stored with reason code, ML confidence, and solver details. Judges can see the system explain itself.",
              },
              {
                icon: "⇌",
                color: "var(--status-ok)",
                title: "Zero-latency push",
                desc: "WebSocket means the dashboard updates in under 100ms from the moment a decision is made. No polling.",
              },
              {
                icon: "⬡",
                color: "var(--risk-high)",
                title: "Demo-proof fallbacks",
                desc: "Every component has a mock fallback. If the backend is unreachable, the UI still shows realistic data — the demo never breaks.",
              },
            ].map(({ icon, color, title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-4 flex gap-4 transition-all duration-200"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = color)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                <span
                  className="text-2xl leading-none shrink-0"
                  style={{ color }}
                >
                  {icon}
                </span>
                <div>
                  <div
                    className="text-xs font-mono font-black mb-1"
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
        </section>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}