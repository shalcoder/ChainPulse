"use client";

import { useEffect, useRef, useState } from "react";
import { VehiclePosition, Hub, RouteDecision } from "@/types";
import { riskColor } from "@/lib/utils";

interface Props {
  vehicles: VehiclePosition[];
  hubs: Hub[];
  latestDecision: RouteDecision | null;
}

const CENTER = { lat: 12.9716, lng: 77.5946 };
const ZOOM = 11;

const DEMO_HUBS: Hub[] = [
  { hub_id: "H1", name: "MG Road",        lat: 12.9716, lng: 77.5946, congestion_level: 0.3 },
  { hub_id: "H2", name: "Koramangala",    lat: 12.9352, lng: 77.6245, congestion_level: 0.7 },
  { hub_id: "H3", name: "Whitefield",     lat: 12.9698, lng: 77.7499, congestion_level: 0.2 },
  { hub_id: "H4", name: "Hebbal",         lat: 13.0358, lng: 77.5970, congestion_level: 0.5 },
  { hub_id: "H5", name: "Electronic City",lat: 12.8458, lng: 77.6604, congestion_level: 0.4 },
];

// Hub positions in SVG % space — must match MockMap hub list exactly
const HUB_SVG: Record<string, { x: number; y: number }> = {
  "MG Road":         { x: 38, y: 45 },
  "Koramangala":     { x: 58, y: 62 },
  "Whitefield":      { x: 100, y: 47 },
  "Hebbal":          { x: 40, y: 25 },
  "Elec. City":      { x: 62, y: 85 },
  "Electronic City": { x: 62, y: 85 },
};

export function ControlTowerMap({ vehicles, hubs, latestDecision }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token === "pk.placeholder") {
      setMapLoaded(false);
      return;
    }
    let mapboxgl: any;
    import("mapbox-gl").then((module) => {
      mapboxgl = module.default;
      mapboxgl.accessToken = token;
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [CENTER.lng, CENTER.lat],
        zoom: ZOOM,
        attributionControl: false,
      });
      map.on("load", () => {
        mapInstanceRef.current = map;
        setMapLoaded(true);
      });
    }).catch(() => setMapLoaded(false));
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    import("mapbox-gl").then((module) => {
      const mapboxgl = module.default;
      const map = mapInstanceRef.current;
      vehicles.forEach((v) => {
        const color = riskColor(v.risk_level);
        const existing = markersRef.current.get(v.vehicle_id);
        if (existing) {
          existing.setLngLat([v.lng, v.lat]);
          const el = existing.getElement();
          el.style.borderColor = color;
          el.style.boxShadow = `0 0 8px ${color}88`;
        } else {
          const el = document.createElement("div");
          el.style.cssText = `
            width:12px;height:12px;border-radius:50%;
            background:${color}44;border:2px solid ${color};
            box-shadow:0 0 8px ${color}88;cursor:pointer;transition:all 0.3s;
          `;
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([v.lng, v.lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 10 }).setHTML(`
                <div style="font-family:monospace;font-size:11px;background:#0f172a;color:#e2e8f0;padding:8px;border-radius:4px;">
                  <strong>${v.vehicle_id}</strong><br/>
                  Risk: <span style="color:${color}">${v.risk_level} (${v.risk_score.toFixed(2)})</span><br/>
                  Speed: ${v.speed_kmh} km/h
                </div>
              `)
            )
            .addTo(map);
          markersRef.current.set(v.vehicle_id, marker);
        }
      });
    });
  }, [vehicles, mapLoaded]);

  if (!mapLoaded) {
    return <MockMap vehicles={vehicles} latestDecision={latestDecision} />;
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-slate-800">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

// ── Mock map ──────────────────────────────────────────────────────────────────

interface RoutePoint { x: number; y: number; label: string }

function MockMap({
  vehicles,
  latestDecision,
}: {
  vehicles: VehiclePosition[];
  latestDecision: RouteDecision | null;
}) {
  const toX = (lng: number) => ((lng - 77.45) / 0.30) * 100;
  const toY = (lat: number) => (1 - (lat - 12.85) / 0.25) * 100;

  // Animate route line in when a new decision arrives
  const [routeProgress, setRouteProgress] = useState(0);
  const [prevDecisionId, setPrevDecisionId] = useState<string | null>(null);

  useEffect(() => {
    if (!latestDecision) return;
    if (latestDecision.decision_id === prevDecisionId) return;
    setPrevDecisionId(latestDecision.decision_id);
    // Animate from 0 → 100 over 1.2 seconds
    setRouteProgress(0);
    let start: number | null = null;
    const duration = 1200;
    function step(ts: number) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setRouteProgress(p * 100);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [latestDecision?.decision_id]);

  // Build route waypoints from decision stops → SVG hub positions
  const routePoints: RoutePoint[] = [];
  if (latestDecision?.route_stops?.length) {
    latestDecision.route_stops.forEach((stop) => {
      const hub = HUB_SVG[stop.location_name];
      if (hub) routePoints.push({ ...hub, label: stop.location_name });
    });
  }

  // If we have a decision but no named stops, draw depot → 3 random hubs → depot
  const fallbackPoints: RoutePoint[] =
    latestDecision && routePoints.length < 2
      ? [
          HUB_SVG["Hebbal"],
          HUB_SVG["MG Road"],
          HUB_SVG["Koramangala"],
          HUB_SVG["Elec. City"],
          HUB_SVG["MG Road"],
        ].map((h, i) => ({ ...h, label: `stop-${i}` }))
      : routePoints;

  const finalPoints = fallbackPoints.length >= 2 ? fallbackPoints : null;

  // Compute partial polyline for animation
  function partialPolyline(pts: RoutePoint[], pct: number): string {
    if (pts.length < 2) return "";
    const total = pts.length - 1;
    const filled = (pct / 100) * total;
    const fullSegs = Math.floor(filled);
    const frac = filled - fullSegs;
    const result: string[] = [];
    for (let i = 0; i <= fullSegs && i < pts.length; i++) {
      if (i === fullSegs && frac < 1 && i + 1 < pts.length) {
        const x = pts[i].x + (pts[i + 1].x - pts[i].x) * frac;
        const y = pts[i].y + (pts[i + 1].y - pts[i].y) * frac;
        result.push(`${x},${y}`);
      } else {
        result.push(`${pts[i].x},${pts[i].y}`);
      }
    }
    return result.join(" ");
  }

  const hubs = [
    { name: "MG Road",    x: 38, y: 45 },
    { name: "Koramangala",x: 58, y: 62 },
    { name: "Whitefield", x: 100, y: 47 },
    { name: "Hebbal",     x: 40, y: 25 },
    { name: "Elec. City", x: 62, y: 85 },
  ];

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950">

      {/* ── Grid lines ──────────────────────────────────────────── */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Background grid */}
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} opacity="0.06">
            <line x1={i * 10} y1={0} x2={i * 10} y2={100} stroke="#94a3b8" strokeWidth="0.3" />
            <line x1={0} y1={i * 10} x2={100} y2={i * 10} stroke="#94a3b8" strokeWidth="0.3" />
          </g>
        ))}

        {/* Old route — grey dashed, shown immediately when decision exists */}
        {finalPoints && latestDecision && (
          <polyline
            points={finalPoints.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#475569"
            strokeWidth="0.6"
            strokeDasharray="2,2"
            opacity="0.5"
          />
        )}

        {/* New route — orange, animates in */}
        {finalPoints && routeProgress > 0 && (
          <>
            {/* Glow layer */}
            <polyline
              points={partialPolyline(finalPoints, routeProgress)}
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.25"
            />
            {/* Main line */}
            <polyline
              points={partialPolyline(finalPoints, routeProgress)}
              fill="none"
              stroke="#f97316"
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          </>
        )}

        {/* Waypoint dots on new route */}
        {finalPoints && routeProgress === 100 &&
          finalPoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="1.2"
              fill="#f97316"
              opacity="0.8"
            />
          ))
        }
      </svg>

      {/* ── Hub markers ─────────────────────────────────────────── */}
      {hubs.map((hub) => (
        <div
          key={hub.name}
          className="absolute flex flex-col items-center"
          style={{
            left: `${hub.x}%`,
            top: `${hub.y}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 10,
          }}
        >
          <div className="w-4 h-4 rounded border-2 border-cyan-500 bg-cyan-500/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
          </div>
          <span className="text-xs font-mono text-cyan-600 mt-1 whitespace-nowrap"
            style={{ fontSize: "9px" }}>
            {hub.name}
          </span>
        </div>
      ))}

      {/* ── Vehicle dots ─────────────────────────────────────────── */}
      {vehicles.map((v) => {
        const x = toX(v.lng);
        const y = toY(v.lat);
        const color = riskColor(v.risk_level);
        if (x < 0 || x > 100 || y < 0 || y > 100) return null;
        const isHigh = v.risk_level === "HIGH";
        const isMed  = v.risk_level === "MEDIUM";

        return (
          <div
            key={v.vehicle_id}
            className="absolute transition-all duration-1000"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 20,
            }}
            title={`${v.vehicle_id} — ${v.risk_level} (${v.risk_score.toFixed(2)})`}
          >
            {/* Outer pulse ring — only for HIGH */}
            {isHigh && (
              <div
                className="absolute rounded-full animate-ping"
                style={{
                  width: "22px",
                  height: "22px",
                  top: "-5px",
                  left: "-5px",
                  background: `${color}22`,
                  border: `1.5px solid ${color}`,
                  animationDuration: "1.2s",
                }}
              />
            )}
            {/* Medium subtle pulse */}
            {isMed && (
              <div
                className="absolute rounded-full animate-ping"
                style={{
                  width: "18px",
                  height: "18px",
                  top: "-3px",
                  left: "-3px",
                  background: `${color}15`,
                  border: `1px solid ${color}`,
                  animationDuration: "2s",
                }}
              />
            )}
            {/* Core dot */}
            <div
              className="w-3 h-3 rounded-full border-2 relative"
              style={{
                background: `${color}44`,
                borderColor: color,
                boxShadow: isHigh
                  ? `0 0 14px ${color}cc, 0 0 4px ${color}`
                  : `0 0 8px ${color}88`,
              }}
            />
          </div>
        );
      })}

      {/* ── Route decision overlay badge ────────────────────────── */}
      {latestDecision && (
        <div
          className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/90
                     border border-orange-800/60 rounded px-2 py-1"
          style={{ zIndex: 30 }}
        >
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-mono text-orange-400">
            {latestDecision.vehicle_id} REROUTED
          </span>
          <span className="text-xs font-mono text-green-400">
            −{latestDecision.eta_delta_min}m
          </span>
        </div>
      )}

      {/* ── Bottom label ────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 text-xs font-mono text-slate-600" style={{ zIndex: 30 }}>
        BENGALURU METRO · LIVE FLEET · {vehicles.length} VEHICLES
      </div>
    </div>
  );
}