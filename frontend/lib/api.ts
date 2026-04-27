const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchAuditRecords() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/audit`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function injectDisruption(type: string, vehicleId: string) {
  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: type,
        vehicle_id: vehicleId,
        severity: 0.85,
        source: "demo_injector",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}