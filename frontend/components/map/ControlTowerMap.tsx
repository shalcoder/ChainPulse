"use client";

import { useEffect, useRef, useState } from "react";
import { VehiclePosition, Hub, RouteDecision } from "@/types";
import { riskColor } from "@/lib/utils";

interface Props {
  vehicles: VehiclePosition[];
  hubs: Hub[];
  latestDecision: RouteDecision | null;
}

// Bengaluru center
const CENTER = { lat: 12.9716, lng: 77.5946 };
const ZOOM = 11;

// Mock hub data for demo
const DEMO_HUBS: Hub[] = [
  { hub_id: "H1", name: "MG Road", lat: 12.9716, lng: 77.5946, congestion_level: 0.3 },
  { hub_id: "H2", name: "Koramangala", lat: 12.9352, lng: 77.6245, congestion_level: 0.7 },
  { hub_id: "H3", name: "Whitefield", lat: 12.9698, lng: 77.7499, congestion_level: 0.2 },
  { hub_id: "H4", name: "Hebbal", lat: 13.0358, lng: 77.5970, congestion_level: 0.5 },
  { hub_id: "H5", name: "Electronic City", lat: 12.8458, lng: 77.6604, congestion_level: 0.4 },
];

export function ControlTowerMap({ vehicles, hubs, latestDecision }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load Mapbox GL JS dynamically
  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // If no Mapbox token, show mock map
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

  // Update vehicle markers when positions change
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
          // Update color
          const el = existing.getElement();
          el.style.borderColor = color;
          el.style.boxShadow = `0 0 8px ${color}88`;
        } else {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 12px; height: 12px;
            border-radius: 50%;
            background: ${color}44;
            border: 2px solid ${color};
            box-shadow: 0 0 8px ${color}88;
            cursor: pointer;
            transition: all 0.3s ease;
          `;
          el.title = `${v.vehicle_id} — ${v.risk_level}`;

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([v.lng, v.lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 10, className: "scc-popup" }).setHTML(`
                <div style="font-family:monospace;font-size:11px;background:#0f172a;color:#e2e8f0;padding:8px;border-radius:4px;">
                  <strong>${v.vehicle_id}</strong><br/>
                  Risk: <span style="color:${color}">${v.risk_level} (${v.risk_score.toFixed(2)})</span><br/>
                  Speed: ${v.speed_kmh} km/h<br/>
                  Anomaly: ${v.anomaly_score.toFixed(2)}
                </div>
              `)
            )
            .addTo(map);

          markersRef.current.set(v.vehicle_id, marker);
        }
      });
    });
  }, [vehicles, mapLoaded]);

  // Show mock SVG map when Mapbox token not configured
  if (!mapLoaded) {
    return <MockMap vehicles={vehicles} />;
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-slate-800">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

// ── Mock map for demo without Mapbox token ────────────────────────────────
function MockMap({ vehicles }: { vehicles: VehiclePosition[] }) {
  // Map Bengaluru lat/lng to SVG coordinates
  const toX = (lng: number) => ((lng - 77.45) / 0.30) * 100;
  const toY = (lat: number) => (1 - (lat - 12.85) / 0.25) * 100;

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i}>
            <line x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="#334155" strokeWidth="1" />
            <line x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke="#334155" strokeWidth="1" />
          </g>
        ))}
      </svg>

      {/* Hub markers */}
      {[
        { name: "MG Road", x: 38, y: 45 },
        { name: "Koramangala", x: 58, y: 62 },
        { name: "Whitefield", x: 100, y: 47 },
        { name: "Hebbal", x: 40, y: 25 },
        { name: "Elec. City", x: 62, y: 85 },
      ].map((hub) => (
        <div
          key={hub.name}
          className="absolute flex flex-col items-center"
          style={{ left: `${hub.x}%`, top: `${hub.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="w-4 h-4 rounded border-2 border-cyan-500 bg-cyan-500/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
          </div>
          <span className="text-xs font-mono text-cyan-600 mt-1 whitespace-nowrap">{hub.name}</span>
        </div>
      ))}

      {/* Vehicle dots */}
      {vehicles.map((v) => {
        const x = toX(v.lng);
        const y = toY(v.lat);
        const color = riskColor(v.risk_level);
        if (x < 0 || x > 100 || y < 0 || y > 100) return null;
        return (
          <div
            key={v.vehicle_id}
            className="absolute transition-all duration-1000"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
            }}
            title={`${v.vehicle_id} — ${v.risk_level}`}
          >
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{
                background: `${color}44`,
                borderColor: color,
                boxShadow: `0 0 8px ${color}88`,
              }}
            />
          </div>
        );
      })}

      {/* Label */}
      <div className="absolute bottom-3 left-3 text-xs font-mono text-slate-600">
        BENGALURU METRO · LIVE FLEET · {vehicles.length} VEHICLES
      </div>
      <div className="absolute top-3 right-3 text-xs font-mono text-slate-700">
        {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? "" : "DEMO MODE — Configure Mapbox for live map"}
      </div>
    </div>
  );
}