# Stress copy — how to run it

A private copy of PEM Hub on this PC: same tables and rules as the real site, fake data, fake image
storage. Nothing here reaches the real site or the real database. Report: `docs/design/2026-11-18/StressTest.notes.md`.

**What Docker does here:** Docker Desktop runs small ready-made servers (« containers ») on this PC.
The Supabase tool asks it for a database, a login service and an API, all local, filled with fake data.

## Once
- Docker Desktop is installed (Start menu → **Docker Desktop**). Nothing else to install: the Supabase
  tool comes through `npx` (v3 — an older `supabase` from Scoop on this PC does not read this config).
- The scripts refuse to run in a folder that has `.env.local` (the real keys). Run them from a worktree
  without it — e.g. `app-worktrees\brave-goldberg-0cf0bd`, or a new one: `git worktree add ..\app-wt-stress main`.

## Start (3 windows)
1. Open **Docker Desktop** and wait for « Engine running » (bottom left). Check: `docker info` answers.
2. Window 1 — the database (first time: a few minutes to download; then ~30 s; the data is kept between runs):
   ```powershell
   npx -y supabase@3 start --workdir scripts/stress -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,realtime
   ```
   Empty or want fresh fake data: `node scripts/stress/seed.mjs` (wipes the copy, ~1 200 works).
3. Window 2 — fake image storage: `node scripts/stress/r2-stub.mjs` (leave it open).
4. Window 3 — the app: `node scripts/stress/run-stress-dev.mjs --prod` (builds then serves; `--prod --no-build` reuses the last build).
   Open http://127.0.0.1:3077 — sign in `pem.stress@example.test` / `stress-admin-2026`
   (team: `team.stress@example.test` / `stress-team-2026`). These fake accounts exist only in the copy.

## Tests
- `node scripts/stress/run-chains.mjs [sale|races|…]` — the order / payment / shipment chains.
- `node scripts/stress/races-plus.mjs 3` — two clicks at once (double sale, double payment), 3 rounds.
- `node scripts/stress/security.mjs [rest|actions|admin]`, `integrity.mjs`, `ui.mjs`.

## Stop
Ctrl+C in windows 2 and 3, then `npx -y supabase@3 stop --workdir scripts/stress` (data kept).
Quit Docker Desktop when done: it holds memory while open.

## Safety
- `seed.mjs` refuses any API that is not `127.0.0.1` / `localhost` or that mentions the production project.
- Never `supabase link` this folder: a link makes `supabase status` carry the production project id
  (it happened once on 2026-11-18 while copying the schema; the link files were moved out).
- A new SQL file is tried here first: `Get-Content supabase/sql/<file>.sql | docker exec -i supabase_db_stress psql -U postgres`.
