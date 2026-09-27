# Peeps Town

A persistent town simulation: peeps live, work, eat and sleep on their own
schedule, ticking forward continuously whether or not anyone is watching.
Viewers connect over WebSocket to see the town update live.

## What's here (v0)

- **Prisma schema** (`prisma/schema.prisma`) — `Peep`, `Building`, `WorldState`
- **Simulation** (`src/simulation/`) — pure per-peep decision logic (`peep.ts`)
  and the world tick that runs it against the DB (`tick.ts`)
- **Server** (`src/server.ts`) — REST endpoints, WebSocket broadcast of what
  changed each tick, *and* the tick loop itself, all in one process. (An
  earlier version ran the tick loop as a separate process; that caused a
  port conflict crash on deploy, since it imported `server.ts` just to call
  `broadcast()`, which re-ran the whole Express app. Keeping it one process
  is simpler and correct for a single small instance — split it out with a
  message queue only once you actually need multiple instances.)
- Frontend: see below.

## Local setup

1. Install Postgres locally, or point `DATABASE_URL` at any Postgres instance.
2. `cp .env.example .env` and fill in `DATABASE_URL`.
3. `npm install`
4. `npm run prisma:migrate` — creates the tables
5. `npx ts-node prisma/seed.ts` — creates a handful of starting peeps, houses,
   and a workshop
6. `npm run dev:server`
7. Check it's alive: `curl http://localhost:3000/api/state`

You should see peeps' hunger/energy/happiness drifting and their `activity`
field changing every ~10 seconds (configurable via `TICK_INTERVAL_MS`).

## Frontend

`frontend/` is a Vite + React + PixiJS viewer:

1. `cd frontend && npm install`
2. `cp .env.example .env` (defaults to `http://localhost:3000`, matching the
   backend's default port)
3. `npm run dev` — opens on `http://localhost:5173`

It loads the current world via `GET /api/state`, then patches peeps in place
as `tick` messages arrive over `/ws`. Peeps are colored dots on a grid, color
= current activity; click one to see its stats in the side panel. This is a
deliberately plain placeholder view — swap in sprites/animations once the
loop and data model feel right.

## Buildings

Peeps have a `homeId` and `workplaceId` (both optional). When a peep's
activity is `sleeping` or `working`, they move one tile per tick toward their
home or workplace and only get the activity's benefit (energy/money) once
they've actually arrived — no teleporting. `prisma/seed.ts` creates 5 houses
and one workshop and assigns each starter peep to both.

The frontend fetches `/api/buildings` once on load (buildings don't change
often, so this isn't part of the tick broadcast) and draws them as colored
squares beneath the peeps — grey for houses, tan for the workshop.

This is still simple: movement is a straight line with no obstacle avoidance,
and there's no "arriving early and waiting" logic — a peep just holds at the
building's tile until their activity changes. Good enough to prove the loop;
revisit if buildings start overlapping or the town gets a real street layout.

## Next steps (not built yet)

- Sprites, animations, and a proper tileset instead of colored dots/squares
- Pathfinding around obstacles once buildings can be placed close together
- Viewer interactions: a REST endpoint (e.g. `POST /api/peeps/:id/nudge`) that
  the tick loop reads before deciding activities
- If this ever needs to scale beyond one instance: split the tick loop into
  its own process again, but replace the direct function import with a
  message queue (SQS, Redis pub/sub) so the two processes don't share memory

## Deploying to AWS (first pass)

- **Compute**: a single Lightsail instance running `npm run start:server`
  (via `pm2`) — this one process handles the API, WebSocket, and tick loop
- **Database**: RDS for PostgreSQL (`db.t4g.micro` is plenty at this scale)
- **Frontend**: S3 + CloudFront for the static build
- **TLS on the API**: since the frontend is served over HTTPS via CloudFront,
  the API needs HTTPS too (mixed content is blocked by browsers) — a domain
  pointed at the instance + Caddy (automatic Let's Encrypt certs) in front of
  the Node app is the simplest way to get this on a single instance
- CORS: `app.use(cors())` is enabled in `server.ts` since the frontend and API
  are different origins once both are deployed; restrict it to your actual
  frontend origin once you're past testing
- Set `DATABASE_URL` in the instance's environment (or a `.env` file) to point
  at your RDS endpoint

See the conversation history for the fuller reasoning behind these choices
(Fargate is the natural next step once this outgrows one instance).
