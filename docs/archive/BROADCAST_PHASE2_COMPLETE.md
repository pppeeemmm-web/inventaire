# Broadcast — Phase 2 Complete

> **ARCHIVED — session snapshot (2026).** Durable contract: [`BROADCAST.md`](../BROADCAST.md). Make guide: [`BROADCAST_OUTSIDE_CHAIN.md`](../BROADCAST_OUTSIDE_CHAIN.md).

**See also:** Production host checklist + curl patterns — keep aligned with live `app/api/inventory/broadcast/*` route handlers; historical narrative in this file. *(A separate `BROADCAST_PHASE3_OPERATIONS.md` may exist in backups/worktrees.)*

Session: Sonnet 4.6 · worktree `amazing-swirles-6480c6`
Commit pushed: `12cb1f6` on `main`

## What was verified this session

All 5 remaining tasks from the Phase 2 handover doc:

| Task | Result |
|---|---|
| Caption seed persist | ✅ — stale closure fixed, DB confirmed `broadcast_caption_seed = "phase2_verified_ok"` |
| InventoryTab `◉` toggle | ✅ — optimistic update + `router.refresh()` persists |
| i18n sweep fr/en on BroadcastTab | ✅ — all `bc_*` keys bilingual, no hardcoded literals |
| Mobile 375px / 360px | ✅ — no horizontal scroll, 44px touch targets |
| Non-admin gate | ✅ — BroadcastTab renders `bc_admin_only` message, no data |

## Bug found and fixed — `12cb1f6`

**Root cause:** `broadcastCaptionSeed` was missing from `performSave` useCallback deps in `WorkDrawer.tsx`.  
`performSave` → `buildFormData()` closed over the initial empty value and always wrote `''` to `broadcast_caption_seed`, regardless of what the user typed.

**Fix:** added `broadcastCaptionSeed` between `broadcastReady` and `encadree` in the `performSave` deps array (~line 1014 of `WorkDrawer.tsx`).

## Current state of broadcast feature

### DB columns (dev + prod)
- `Oeuvres.broadcast_ready boolean` — gates inclusion in `/feed`
- `Oeuvres.broadcast_caption_seed text` — freeform note → passed to AI caption pipeline
- `oeuvre_broadcasts`: `status`, `queued_at`, `attempt_count`, `external_url`, `caption_final`
- `broadcast_events`: VIP/standard event log, RLS admin-only

### API endpoints (Bearer `INVENTORY_BROADCAST_SECRET`)
| Endpoint | Purpose |
|---|---|
| `GET /api/inventory/broadcast/feed?platform=instagram` | Works ready to post; includes `captionSeed` |
| `POST /api/inventory/broadcast/queue` | Mark work queued (removes from feed) |
| `POST /api/inventory/broadcast/confirm` | Confirm posted; writes `external_url` + `caption_final` |
| `POST /api/inventory/broadcast/event` | Log VIP/standard event |

### UI — `/atelier?tab=broadcast`
- **Queue** subtab — works with `status=queued`
- **Publiés** subtab — works with `status=posted`, caption + external link
- **Activité** subtab — broadcast events, VIP filter default ON

## Test data in dev DB
- Work **2329** "Portrait - Father" — `broadcast_ready=true`, posted instagram, `caption_final` set, 1 VIP event
- Work **2336** — posted instagram (Phase 1 pre-existing)

## Key files
- [`components/atelier/BroadcastTab.tsx`](../../components/atelier/BroadcastTab.tsx)
- [`app/atelier/broadcast/actions.ts`](../../app/atelier/broadcast/actions.ts)
- [`app/api/inventory/broadcast/feed/route.ts`](../../app/api/inventory/broadcast/feed/route.ts)
- [`app/api/inventory/broadcast/queue/route.ts`](../../app/api/inventory/broadcast/queue/route.ts)
- [`app/api/inventory/broadcast/confirm/route.ts`](../../app/api/inventory/broadcast/confirm/route.ts)
- [`app/api/inventory/broadcast/event/route.ts`](../../app/api/inventory/broadcast/event/route.ts)
- [`app/atelier/inventory/_components/Inventory.tsx`](../../app/atelier/inventory/_components/Inventory.tsx) — `◉` chip toggles `broadcast_ready`
- [`supabase/sql/broadcast_phase2.sql`](../../supabase/sql/broadcast_phase2.sql) — Phase 2 migration
- [`supabase/sql/oeuvre_broadcasts.sql`](../../supabase/sql/oeuvre_broadcasts.sql) — Phase 1 migration
