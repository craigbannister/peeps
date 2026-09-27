import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import { PixiCanvas } from "./PixiCanvas";
import { useWorldState } from "./useWorldState";
import { useBuildings } from "./useBuildings";
import { feedPeep, giveMoney } from "./api";
import type { PeepState } from "./types";

export default function App() {
  const { peeps, tick, day, connected } = useWorldState();
  const buildings = useBuildings();
  const [selected, setSelected] = useState<PeepState | null>(null);

  // Keep the panel showing fresh data for the selected peep as ticks arrive.
  const live = selected ? peeps.find((p) => p.id === selected.id) ?? selected : null;

  const onSelect = useCallback((p: PeepState) => setSelected(p), []);

  return (
    <div style={{ display: "flex", height: "100vh", color: "#e6e6e6", fontFamily: "sans-serif" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <PixiCanvas peeps={peeps} buildings={buildings} onSelect={onSelect} />
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(0,0,0,0.5)",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Day {day} · Tick {tick} · {connected ? "live" : "reconnecting…"} · {peeps.length} peeps
        </div>
      </div>

      {live && (
        <div style={{ width: 260, background: "#222831", padding: 16, boxSizing: "border-box" }}>
          <h2 style={{ marginTop: 0 }}>{live.name}</h2>
          <p style={{ opacity: 0.8, marginTop: -8 }}>{live.activity}</p>
          <Stat label="Hunger" value={live.hunger} />
          <Stat label="Energy" value={live.energy} />
          <Stat label="Happiness" value={live.happiness} />
          <p>💰 {live.money}</p>
          <p>Job: {live.job ?? "unemployed"}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => feedPeep(live.id)} style={buttonStyle}>
              🍎 Feed
            </button>
            <button onClick={() => giveMoney(live.id, 10)} style={buttonStyle}>
              💰 Give $10
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const buttonStyle: CSSProperties = {
  flex: 1,
  padding: "8px 0",
  background: "#3a4048",
  border: "none",
  borderRadius: 6,
  color: "#e6e6e6",
  cursor: "pointer",
  fontSize: 13,
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ background: "#3a4048", borderRadius: 4, height: 6 }}>
        <div style={{ width: `${value}%`, background: "#4c9be0", height: "100%", borderRadius: 4 }} />
      </div>
    </div>
  );
}
