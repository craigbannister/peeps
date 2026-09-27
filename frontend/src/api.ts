const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

/** Viewer interactions — fire-and-forget from the UI's perspective; the
 * resulting state change arrives back over the WebSocket like any other
 * update, so callers don't need to do anything with the response. */
export async function feedPeep(id: string) {
  await fetch(`${API_BASE}/api/peeps/${id}/feed`, { method: "POST" });
}

export async function giveMoney(id: string, amount = 10) {
  await fetch(`${API_BASE}/api/peeps/${id}/give-money`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
}
