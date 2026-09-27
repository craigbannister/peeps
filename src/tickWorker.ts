import "dotenv/config";
import { runTick } from "./simulation/tick";
import { broadcast } from "./server"; // see note below

const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS ?? 10_000); // 10s per tick by default

async function loop() {
  try {
    const result = await runTick();
    console.log(`[tick ${result.tick}] day ${result.day} — ${result.changed.length} peeps updated`);
    broadcast({ type: "tick", tick: result.tick, day: result.day, changed: result.changed });
  } catch (err) {
    console.error("Tick failed:", err);
  } finally {
    setTimeout(loop, TICK_INTERVAL_MS);
  }
}

console.log(`Starting tick worker (interval: ${TICK_INTERVAL_MS}ms)`);
loop();

// NOTE: importing `broadcast` from server.ts only works if you run the tick
// loop in-process with the web server (fine for a single small instance).
// Once you split them into separate services/containers, replace this with
// a message queue (SQS, Redis pub/sub) so the worker doesn't need a direct
// reference to the WebSocket server.
