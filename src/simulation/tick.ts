import { prisma } from "../db";
import { stepPeep } from "./peep";
import type { PeepState } from "../types";

/**
 * Advance the whole world by one tick:
 *  1. load all living peeps with their home/workplace buildings
 *  2. compute each one's next state (pure, in-memory) — including movement
 *     toward home (sleeping) or workplace (working)
 *  3. write the changes back
 *  4. bump the world tick counter
 * Returns the peeps that changed, for broadcasting to viewers.
 */
export async function runTick(): Promise<{ tick: number; day: number; changed: PeepState[] }> {
  const peeps = await prisma.peep.findMany({
    where: { alive: true },
    include: { home: true, workplace: true },
  });

  const deltas = peeps.map((p) => stepPeep(p, p.home ?? undefined, p.workplace ?? undefined));

  await prisma.$transaction(
    deltas.map((d) =>
      prisma.peep.update({
        where: { id: d.id },
        data: {
          x: d.x,
          y: d.y,
          hunger: d.hunger,
          energy: d.energy,
          happiness: d.happiness,
          money: d.money,
          activity: d.activity,
        },
      })
    )
  );

  const world = await prisma.worldState.upsert({
    where: { id: 1 },
    update: { tick: { increment: 1 } },
    create: { id: 1, tick: 1, day: 1 },
  });

  // Roughly one "day" every 100 ticks — tune to taste.
  const day = Math.floor(world.tick / 100) + 1;
  if (day !== world.day) {
    await prisma.worldState.update({ where: { id: 1 }, data: { day } });
  }

  const changed: PeepState[] = peeps.map((p, i) => ({
    id: p.id,
    name: p.name,
    x: deltas[i].x,
    y: deltas[i].y,
    hunger: deltas[i].hunger,
    energy: deltas[i].energy,
    happiness: deltas[i].happiness,
    money: deltas[i].money,
    job: p.job,
    activity: deltas[i].activity,
    alive: p.alive,
  }));

  return { tick: world.tick, day, changed };
}
