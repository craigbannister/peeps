import { useEffect, useRef, useState } from "react";
import type { PeepState, TickBroadcast, WorldSnapshot } from "./types";

// Adjust for your deployment — same host as the API server, just a
// different scheme/path for the WebSocket upgrade.
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws";

export function useWorldState() {
  const [peeps, setPeeps] = useState<Record<string, PeepState>>({});
  const [tick, setTick] = useState(0);
  const [day, setDay] = useState(1);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 1. Load the full snapshot so we're not waiting on the first tick.
    fetch(`${API_BASE}/api/state`)
      .then((r) => r.json())
      .then((snapshot: WorldSnapshot) => {
        if (cancelled) return;
        const byId: Record<string, PeepState> = {};
        for (const p of snapshot.peeps) byId[p.id] = p;
        setPeeps(byId);
        setTick(snapshot.tick);
        setDay(snapshot.day);
      })
      .catch((err) => console.error("Failed to load initial state:", err));

    // 2. Then subscribe to diffs.
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = (e) => console.error("WebSocket error:", e);

    ws.onmessage = (event) => {
      const msg: TickBroadcast = JSON.parse(event.data);
      if (msg.type !== "tick") return;
      setTick(msg.tick);
      setDay(msg.day);
      setPeeps((prev) => {
        const next = { ...prev };
        for (const p of msg.changed) next[p.id] = p;
        return next;
      });
    };

    return () => {
      cancelled = true;
      ws.close();
    };
  }, []);

  return { peeps: Object.values(peeps), tick, day, connected };
}
