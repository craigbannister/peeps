import type { Peep } from "@prisma/client";
import type { Activity } from "../types";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export interface BuildingRef {
  x: number;
  y: number;
}

/** Result of stepping one peep forward by one tick. Only changed fields. */
export interface PeepDelta {
  id: string;
  x: number;
  y: number;
  hunger: number;
  energy: number;
  happiness: number;
  money: number;
  activity: Activity;
}

/**
 * Decide what a peep does this tick, purely from their current needs.
 * This is intentionally simple (highest-priority-need wins) — swap in
 * something fancier (utility AI, goals/plans) once this loop is proven out.
 */
function decideActivity(p: Peep): Activity {
  if (p.energy < 25) return "sleeping";
  if (p.hunger < 30) return "eating";
  if (p.job && p.energy > 40 && p.hunger > 30) return "working";
  if (p.happiness < 40) return "socializing";
  return "idle";
}

/** Which building (if any) a given activity should walk the peep toward. */
function targetFor(activity: Activity, home?: BuildingRef, work?: BuildingRef): BuildingRef | undefined {
  if (activity === "sleeping") return home;
  if (activity === "working") return work;
  return undefined;
}

/** Move one tile per axis per tick toward a target — simple, no pathfinding/obstacles yet. */
function stepToward(x: number, y: number, target?: BuildingRef): { x: number; y: number; arrived: boolean } {
  if (!target) return { x, y, arrived: true };
  const dx = Math.sign(target.x - x);
  const dy = Math.sign(target.y - y);
  const nx = x + dx;
  const ny = dy !== 0 && dx === 0 ? y + dy : y; // move on one axis per tick
  const arrived = nx === target.x && ny === target.y;
  return { x: nx, y: ny, arrived };
}

/**
 * Advance a single peep by one tick. Pure function — no DB access here.
 * `home`/`work` are the peep's assigned buildings, if any; a peep with no
 * home just sleeps in place, same for work.
 */
export function stepPeep(p: Peep, home?: BuildingRef, work?: BuildingRef): PeepDelta {
  // Needs decay a little every tick regardless of activity.
  let hunger = clamp(p.hunger - 3);
  let energy = clamp(p.energy - 2);
  let happiness = clamp(p.happiness - 1);
  let money = p.money;

  const activity = decideActivity(p);
  const target = targetFor(activity, home, work);
  const { x, y, arrived } = stepToward(p.x, p.y, target);

  // Only apply the activity's effect once the peep has actually arrived —
  // otherwise a peep en route to work would earn money while still walking.
  if (arrived) {
    switch (activity) {
      case "sleeping":
        energy = clamp(energy + 15);
        break;
      case "eating":
        hunger = clamp(hunger + 30);
        money = Math.max(0, money - 1); // food costs a little
        break;
      case "working":
        money = money + 3;
        energy = clamp(energy - 5);
        happiness = clamp(happiness - 1);
        break;
      case "socializing":
        happiness = clamp(happiness + 10);
        energy = clamp(energy - 3);
        break;
      case "idle":
        happiness = clamp(happiness + 2);
        break;
    }
  }

  return { id: p.id, x, y, hunger, energy, happiness, money, activity };
}
