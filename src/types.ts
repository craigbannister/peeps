export type Activity = "idle" | "eating" | "working" | "sleeping" | "socializing";

export interface PeepState {
  id: string;
  name: string;
  x: number;
  y: number;
  hunger: number;
  energy: number;
  happiness: number;
  money: number;
  job: string | null;
  activity: Activity;
  alive: boolean;
}

export interface WorldSnapshot {
  tick: number;
  day: number;
  peeps: PeepState[];
}

// Sent over WebSocket after each tick. `changed` lets the frontend
// avoid re-rendering peeps whose state didn't move.
export interface TickBroadcast {
  type: "tick";
  tick: number;
  day: number;
  changed: PeepState[];
}
