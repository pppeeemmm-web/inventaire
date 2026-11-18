# Broadcast — in-repo contract

_Re-checked against live code + DB 2026-11-18 (tables, columns, routes, tabs)._

Inventory → social middleware: Atelier UI + Bearer JSON API. Orchestration (AI, Buffer, Slack) lives in Make — see [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md).

**Implementations:** `app/api/inventory/broadcast/*`, [`Broadcast.tsx`](../app/atelier/(portal)/broadcast/_components/Broadcast.tsx), [`actions.ts`](../app/atelier/(portal)/broadcast/actions.ts).

---

## DB

| Object | Role |
|--------|------|
| `Oeuvres.broadcast_ready` | Gates inclusion in `/feed` |
| `Oeuvres.broadcast_caption_seed` | Operator note → AI caption input |
| `oeuvre_broadcasts` | `status`, `queued_at`, `attempt_count`, `external_url`, `caption_final` |
| `broadcast_events` | VIP/standard activity log (admin RLS) |

Migrations: [`supabase/sql/oeuvre_broadcasts.sql`](../supabase/sql/oeuvre_broadcasts.sql), [`supabase/sql/broadcast_phase2.sql`](../supabase/sql/broadcast_phase2.sql).

---

## HTTP API

Bearer `INVENTORY_BROADCAST_SECRET` (or `x-inventory-broadcast-secret` — see [`lib/inventory-broadcast-secret.ts`](../lib/inventory-broadcast-secret.ts)).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/inventory/broadcast/feed?platform=<slug>` | Eligible works + `captionSeed` |
| POST | `/api/inventory/broadcast/queue` | Mark queued (drops from feed) |
| POST | `/api/inventory/broadcast/confirm` | Posted: `externalUrl`, `captionFinal` |
| POST | `/api/inventory/broadcast/event` | Log VIP/standard event |

---

## Atelier UI

**Tab:** `/atelier/broadcast` (admin). Subtabs: Queue, Publiés, Activité.

**Inventory:** [`Inventory.tsx`](../app/atelier/(portal)/inventory/_components/Inventory.tsx) — the « Diffusion » column checkbox toggles `broadcast_ready` (through `batchEdit`).

**Work drawer:** `broadcast_ready` + `broadcast_caption_seed` persist via `performSave` (deps must include `broadcastCaptionSeed`).

---

## Optional product follow-ups

- Platform filter in Broadcast tab
- True VIP “unread” cursor (today: count in fetched window only)

See also [`PROJECT_SYNTHESIS.md`](./archive/PROJECT_SYNTHESIS.md) § assessment / outside-repo scope.
