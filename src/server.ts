import "dotenv/config";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "./db";
import { runTick } from "./simulation/tick";
import type { TickBroadcast, WorldSnapshot } from "./types";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();

// The frontend is hosted on a different origin (CloudFront), so the browser
// needs an explicit allow here for the plain REST calls. Restrict this to
// your actual frontend origin once you're past testing.
app.use(cors());
app.use(express.json());

function toPeepState(p: {
  id: string;
  name: string;
  x: number;
  y: number;
  hunger: number;
  energy: number;
  happiness: number;
  money: number;
  job: string | null;
  activity: string;
  alive: boolean;
}) {
  return {
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    hunger: p.hunger,
    energy: p.energy,
    happiness: p.happiness,
    money: p.money,
    job: p.job,
    activity: p.activity as any,
    alive: p.alive,
  };
}

// REST: full current state, for a viewer who just opened the page.
app.get("/api/state", async (_req, res) => {
  const [world, peeps] = await Promise.all([
    prisma.worldState.findUnique({ where: { id: 1 } }),
    prisma.peep.findMany({ where: { alive: true } }),
  ]);

  const snapshot: WorldSnapshot = {
    tick: world?.tick ?? 0,
    day: world?.day ?? 1,
    peeps: peeps.map(toPeepState),
  };

  res.json(snapshot);
});

// REST: buildings rarely change, so a plain GET (not part of the tick
// broadcast) is enough for now.
app.get("/api/buildings", async (_req, res) => {
  const buildings = await prisma.building.findMany();
  res.json(buildings.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y })));
});

/** Broadcast a single peep's updated state to every connected viewer right away,
 * rather than waiting for the next tick — interactions should feel immediate. */
async function broadcastPeep(peep: Parameters<typeof toPeepState>[0]) {
  const world = await prisma.worldState.findUnique({ where: { id: 1 } });
  broadcast({
    type: "tick",
    tick: world?.tick ?? 0,
    day: world?.day ?? 1,
    changed: [toPeepState(peep)],
  });
}

// Viewer interaction: feed a peep, restoring hunger. Free — a small gift from
// a viewer, not drawn from the peep's own money.
app.post("/api/peeps/:id/feed", async (req, res) => {
  const peep = await prisma.peep.findUnique({ where: { id: req.params.id } });
  if (!peep || !peep.alive) return res.status(404).json({ error: "peep not found" });

  const updated = await prisma.peep.update({
    where: { id: peep.id },
    data: { hunger: Math.min(100, peep.hunger + 40) },
  });

  await broadcastPeep(updated);
  res.json(toPeepState(updated));
});

// Viewer interaction: give a peep some money. Amount is clamped server-side
// so a viewer can't hand out unlimited cash via a crafted request.
app.post("/api/peeps/:id/give-money", async (req, res) => {
  const peep = await prisma.peep.findUnique({ where: { id: req.params.id } });
  if (!peep || !peep.alive) return res.status(404).json({ error: "peep not found" });

  const requested = Number(req.body?.amount);
  const amount = Number.isFinite(requested) ? Math.max(1, Math.min(50, requested)) : 10;

  const updated = await prisma.peep.update({
    where: { id: peep.id },
    data: { money: peep.money + amount },
  });

  await broadcastPeep(updated);
  res.json(toPeepState(updated));
});

const server = app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});

// WebSocket: push tick diffs to every connected viewer.
const wss = new WebSocketServer({ server, path: "/ws" });

export function broadcast(msg: TickBroadcast) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

wss.on("connection", (ws) => {
  console.log("Viewer connected", `(${wss.clients.size} total)`);
  ws.on("close", () => console.log("Viewer disconnected", `(${wss.clients.size} total)`));
});

// The simulation tick runs in this same process (not a separate one) so it
// can call `broadcast` directly. Fine for a single small instance; split it
// into its own process + message queue (SQS/Redis) if you outgrow that.
const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS ?? 10_000);

async function tickLoop() {
  try {
    const result = await runTick();
    console.log(`[tick ${result.tick}] day ${result.day} — ${result.changed.length} peeps updated`);
    broadcast({ type: "tick", tick: result.tick, day: result.day, changed: result.changed });
  } catch (err) {
    console.error("Tick failed:", err);
  } finally {
    setTimeout(tickLoop, TICK_INTERVAL_MS);
  }
}

tickLoop();
