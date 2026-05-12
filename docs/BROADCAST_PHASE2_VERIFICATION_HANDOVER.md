# Broadcast Phase 2 — Verification Handover

Session: Sonnet 4.6 · worktree `friendly-euclid-fa185b`
Commit pushed: `70d5074` on `main`

## What was completed this session

### SQL migration — APPLIED ✅
`supabase/sql/broadcast_phase2.sql` applied to dev project `mcrzsxrcoexnlwmaunte`.
- `Oeuvres.broadcast_caption_seed text` — present
- `oeuvre_broadcasts`: `status`, `queued_at`, `attempt_count`, `external_url`, `caption_final` — present, existing row backfilled to `status='posted'`
- `broadcast_events` table — created, RLS admin-only select active

### API — ALL VERIFIED ✅
Bearer: `INVENTORY_BROADCAST_SECRET` from `.env.local`

| Endpoint | Result |
|---|---|
| `GET /feed?platform=instagram` | 6 items, `captionSeed` field present |
| `POST /queue {oeuvreId:2329, platform:"instagram"}` | 200, `status=queued`, disappears from feed |
| `POST /confirm {oeuvreId:2329, platform, externalUrl, captionFinal}` | 200, `transition=queued_to_posted` |
| `POST /event {priority:"vip", eventType:"comment", ...}` | 200, appears in Activity tab |

### BroadcastTab UI — VERIFIED ✅
`/atelier?tab=broadcast` renders all 3 subtabs with live data:
- Queue: 0 (empty state text shows)
- Posted: 2 (work 2329 "Portrait - Father" with caption + Open ↗ link)
- Activity: 1 (VIP filter ON by default, toggle to All works)

### Bug found and fixed — COMMITTED ✅
`app/atelier/page.tsx` Oeuvres select was missing `broadcast_caption_seed`.
Drawer always loaded null. Fixed — `broadcast_caption_seed` now in select.

### Dev server refactor — DONE ✅
- `scripts/dev.ps1` — kills port 3000, prints LAN IP, starts `npm run dev`
- `.claude/launch.json` — gated: exits cleanly if no `.env.local` (prevents worktree from stealing port 3000)
- Empty blocker `.claude/launch.json` stamped in `friendly-euclid-fa185b/` and `quirky-bose-15e335/`
- CLAUDE.md updated with `DEV SERVER` + `WORKTREE START` rules

## Still to verify (no code changes expected)

### 1. Caption seed persist — manual test needed
Browser automation can't reliably trigger React onChange. **Test manually:**
1. Open WorkDrawer for any `broadcast_ready=true` work
2. Type something in "BROADCAST NOTE" textarea
3. Click Save → "Saved" toast
4. Reload (`?work=<id>`) → text should reappear in textarea
5. Confirm `GET /feed?platform=instagram` returns that work with `captionSeed` populated

Code is correct: `WorkDrawer.tsx:903` appends to FormData, `actions.ts:238-239` reads + slices, writes in both INSERT (line 353) and UPDATE (line 476) paths.

### 2. InventoryTab row toggle
- `◉` chip in Réserve cell on inventory rows
- Flip it → optimistic update → `router.refresh()` → persists
- At 375px: chip visible, not clipped

### 3. i18n sweep
Switch `?lang=fr` / `?lang=en` on BroadcastTab — no hardcoded FR/EN literals anywhere.
New keys all in `lib/i18n/dictionary.ts`: `tab_broadcast`, `bc_subtab_*`, `bc_caption_seed`, etc.

### 4. Mobile 375px + 360px
No horizontal scroll, 44px touch targets on BroadcastTab primary buttons.

### 5. Non-admin check
Log in as editor → BroadcastTab shows admin-only message, no data.

## Test data in dev DB
- Work **2329** "Portrait - Father" — `broadcast_ready=true`, posted instagram, `external_url` set, 1 VIP event in `broadcast_events`
- Work **2336** — also posted instagram (pre-existing from Phase 1)

## Key files
- [`app/atelier/page.tsx`](../app/atelier/page.tsx) — select includes `broadcast_caption_seed` (bug fix this session)
- [`components/atelier/BroadcastTab.tsx`](../components/atelier/BroadcastTab.tsx)
- [`app/atelier/broadcast/actions.ts`](../app/atelier/broadcast/actions.ts)
- [`app/api/inventory/broadcast/feed/route.ts`](../app/api/inventory/broadcast/feed/route.ts)
- [`app/api/inventory/broadcast/queue/route.ts`](../app/api/inventory/broadcast/queue/route.ts)
- [`app/api/inventory/broadcast/confirm/route.ts`](../app/api/inventory/broadcast/confirm/route.ts)
- [`app/api/inventory/broadcast/event/route.ts`](../app/api/inventory/broadcast/event/route.ts)
- [`scripts/dev.ps1`](../scripts/dev.ps1) — run with `pwsh scripts/dev.ps1`

## Dev server
Run from real app: `pwsh scripts/dev.ps1`
Phone: `http://192.168.1.9:3000` (LAN IP printed on start)
