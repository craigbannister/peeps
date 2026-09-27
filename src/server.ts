import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "./db";
import type { TickBroadcast, WorldSnapshot } from "./types";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();

// REST: full current state, for a viewer who just opened the page.
app.get("/api/state", async (_req, res) => {
  const [world, peeps] = await Promise.all([
    prisma.worldState.findUnique({ where: { id: 1 } }),
    prisma.peep.findMany({ where: { alive: true } }),
  ]);

  const snapshot: WorldSnapshot = {
    tick: world?.tick ?? 0,
    day: world?.day ?? 1,
    peeps: peeps.map((p) => ({
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
    })),
  };

  res.json(snapshot);
});

// REST: buildings rarely change, so a plain GET (not part of the tick
// broadcast) is enough for now.
app.get("/api/buildings", async (_req, res) => {
  const buildings = await prisma.building.findMany();
  res.json(buildings.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y })));
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
