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

export interface TickBroadcast {
  type: "tick";
  tick: number;
  day: number;
  changed: PeepState[];
}
