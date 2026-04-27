"use client";

import { useEffect, useState } from "react";
import { VehiclePosition, WebSocketMessage } from "@/types";
import { generateMockFleet } from "@/lib/utils";

export function useFleetState(lastMessage: WebSocketMessage | null) {
  // Start with empty array — populated only on client to avoid hydration mismatch
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);

  // Generate fleet on client only (after mount)
  useEffect(() => {
    setVehicles(generateMockFleet());
  }, []);

  // Animate vehicles slowly even without backend data
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles((prev) => {
        if (prev.length === 0) return prev;
        return prev.map((v) => ({
          ...v,
          lat: v.lat + (Math.random() - 0.5) * 0.001,
          lng: v.lng + (Math.random() - 0.5) * 0.001,
          last_updated: new Date().toISOString(),
        }));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Apply real WebSocket updates when available
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "VEHICLE_UPDATE") {
      const update = lastMessage.payload as VehiclePosition;
      setVehicles((prev) =>
        prev.map((v) => (v.vehicle_id === update.vehicle_id ? update : v))
      );
    }
    if (lastMessage.type === "RISK_ALERT") {
      const alert = lastMessage.payload as any;
      setVehicles((prev) =>
        prev.map((v) =>
          v.vehicle_id === alert.vehicle_id
            ? { ...v, risk_level: alert.risk_level, risk_score: alert.risk_score }
            : v
        )
      );
    }
  }, [lastMessage]);

  return { vehicles, setVehicles };
}