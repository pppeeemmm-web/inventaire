# Broadcast Phase 2 — Handover

Session model: Opus 4.7 → Sonnet 4.6.
Branch: `claude/quirky-bose-15e335` (worktree). Not committed yet.

## State

Code written in worktree **and copied to real app** at `C:\Users\pppee\Documents\Claude\Projects\Art db\app`. SQL migration **NOT yet applied** to dev DB. No commits. Real-app dev server should HMR the changes once running.

## What Phase 1 already had (do not duplicate)

- `Oeuvres.broadcast_ready` boolean + toggle in `WorkForm.tsx:672` and `WorkDrawer.tsx:1691`
- `BatchEditModal` tri-state for `broadcast_ready`
- `batchEdit({ broadcast_ready })` in `app/atelier/selection/actions.ts:133`
- `oeuvre_broadcasts` table with UNIQUE(oeuvre_id, platform) dedupe
- `/api/inventory/broadcast/feed` GET + `/confirm` POST, case-insensitive Bearer auth
- `lib/inventory-broadcast-secret.ts` (Bearer + `x-inventory-broadcast-secret`)
- `lib/broadcast-eligibility.ts` — `isBroadcastEligible()`, `normalizeBroadcastPlatform()`
- i18n: `wf_broadcast_ready`, `wf_broadcast_ready_hint`, `nav_group_diffusion`

## What Phase 2 adds

### Schema — `supabase/sql/broadcast_phase2.sql` (idempotent, NOT YET APPLIED)
- `Oeuvres.broadcast_caption_seed text` — operator note, practice/vision framing per amended MD §2
- `oeuvre_broadcasts` extended: `status ('queued'|'posted')` default `'posted'`, `queued_at`, `attempt_count`, `external_url`, `caption_final`. Existing rows back-fill to `posted`.
- New `broadcast_events` (id, oeuvre_id, platform, event_type, priority, summary, external_url, payload, created_at). RLS admin-only read; service-role writes.

### API (Bearer auth via `INVENTORY_BROADCAST_SECRET`)
- **GET `/api/inventory/broadcast/feed?platform=<slug>`** — extended: payload now has `captionSeed`; excludes `status='posted'` always and `status='queued'` within last 30 min (stuck queues self-recover).
- **POST `/api/inventory/broadcast/queue`** *(new)* — body `{oeuvreId, platform}`. Upserts row to `status='queued'`, bumps `attempt_count`. 409 if already posted.
- **POST `/api/inventory/broadcast/confirm`** — extended: body now accepts `externalUrl`, `captionFinal`. Flips a queued row to posted (no 409); 409 only if already posted.
- **POST `/api/inventory/broadcast/event`** *(new)* — body `{oeuvreId?, platform, eventType, priority?, summary?, externalUrl?, payload?}`. `eventType ∈ {queued, posted, comment, engagement, error, note}`. `priority ∈ {vip, normal}` default normal.

### Atelier UI
- **New tab**: `components/atelier/BroadcastTab.tsx`, registered in `TeamPortalClient.tsx` (TABS_RAW, GROUPS.diffusion both narrow + desktop, dynamic import). Admin-only via `is_admin()`.
  - Subtabs: **Queue** (in-flight, "Release" button calls `clearStuckQueue`), **Posted** (last 50, click-out to `external_url`), **Activity** (last 50 events, VIP filter on by default, toggle for All).
- **Caption seed textarea**: added to WorkDrawer + WorkForm immediately under existing `wf_broadcast_ready` switch; only renders when switch is ON; 2000-char cap; FormData key `broadcast_caption_seed`.
- **Row toggle in InventoryTab**: small `◉` chip in the Réserve cell, hidden under 360px viewport, reuses `batchEdit({broadcast_ready})` + `router.refresh()`. Optimistic state via `bcOverride` map.
- **Server action**: `app/atelier/broadcast/actions.ts` — `listBroadcastDashboard()` (Promise.all of 3 selects + works lookup) and `clearStuckQueue(oeuvreId, platform)`. Both admin-gated.

### i18n (fr + en, both maps, both DictKey unions)
New keys: `tab_broadcast`, `bc_subtab_queue/posted/activity`, `bc_queue_empty/posted_empty/activity_empty`, `bc_filter_vip/all`, `bc_caption_seed`, `bc_caption_seed_hint`, `bc_quick_toggle`, `bc_quick_toggle_aria`, `bc_attempts`, `bc_queued_at`, `bc_posted_at`, `bc_clear_stuck`, `bc_clear_stuck_confirm`, `bc_open_post`, `bc_admin_only`, `bc_count_queued/posted/vip`, `bc_caption_final`, `bc_no_caption`, `bc_event_type_label`.

### Wired in `app/atelier/works/actions.ts`
`broadcast_caption_seed` read from FormData (slice 2000), written in both INSERT (line ~351) and UPDATE (line ~473) payloads.

## Out of scope (do NOT build — explicitly dropped from amended strategy MD)

- ❌ First-comment automation
- ❌ "DMs/Comments not monitored" hard-funnel disclaimer
- ❌ AI caption generation **in this app** — Make.com does it; atelier only stores `caption_seed` (input) and `caption_final` (echo)
- ❌ Comment ingestion endpoint, Slack outbound, VIP detection in this app — Make.com tags `priority: vip` on events; atelier just displays
- ❌ Benefit-driven sales framing in caption seed copy — practice/vision posture per amended MD §2

## Verification (per plan §Verification — none executed yet)

1. Apply `supabase/sql/broadcast_phase2.sql` on dev DB. Confirm pre-existing posted rows default `status='posted'`.
2. curl flow:
   - `POST /api/inventory/broadcast/queue` (Bearer) → row in `oeuvre_broadcasts` `status=queued`.
   - `GET /api/inventory/broadcast/feed?platform=instagram` → that oeuvre disappears within 30 min, reappears after.
   - `POST /api/inventory/broadcast/confirm` with `externalUrl` → flips to `posted`, no 409.
   - `POST /api/inventory/broadcast/event` `priority=vip` → visible in atelier Activity.
3. `/atelier?tab=broadcast` renders all 3 subtabs.
4. WorkDrawer: flip `broadcast_ready` ON → seed textarea appears; type, save, reload, persists.
5. InventoryTab row toggle: flip, refresh, persists. 375px viewport: not clipped.
6. i18n sweep on the new tab in both `lang=fr` and `lang=en`.
7. Mobile contract: 375px and 360px — no horizontal scroll, 44px targets on Broadcast tab buttons.
8. Non-admin editor → BroadcastTab shows admin-only message.

## Static checks done

- `npx tsc --noEmit` filtered to new/edited files: **0 errors**
- `npm run lint`: 1 introduced warning (missing memo dep on `broadcastCaptionSeed`) → fixed
- `npm run build`: "✓ Compiled successfully in 7.9s". Page-data collection 500s are env-var artefacts of worktree (no `.env.local`), not code.

## Make.com integration contract (what the middleware does)

1. **Pull**: GET `/feed?platform=<slug>` → batch of eligible items with `oeuvreId`, image URLs, dims, technique/support labels, **`captionSeed`** (if operator left one).
2. **Lock**: POST `/queue` per item before processing → atelier shows it as queued.
3. **AI transform**: Make.com calls its own AI with the spec + caption seed; pushes to Buffer as draft.
4. **Confirm**: after the draft is published, POST `/confirm` with `externalUrl`, `captionFinal` → row flips to posted, appears in atelier Posted history.
5. **Events** (optional but recommended): POST `/event` for VIP comments, errors, engagement → atelier Activity feed; operator can click out to Slack thread / IG post URL.

## Key files (open these first in next session)

- [supabase/sql/broadcast_phase2.sql](../supabase/sql/broadcast_phase2.sql) — apply this first
- [app/atelier/broadcast/actions.ts](../app/atelier/broadcast/actions.ts)
- [components/atelier/BroadcastTab.tsx](../components/atelier/BroadcastTab.tsx)
- [app/api/inventory/broadcast/queue/route.ts](../app/api/inventory/broadcast/queue/route.ts)
- [app/api/inventory/broadcast/event/route.ts](../app/api/inventory/broadcast/event/route.ts)
- [app/api/inventory/broadcast/confirm/route.ts](../app/api/inventory/broadcast/confirm/route.ts) (queued→posted)
- [app/api/inventory/broadcast/feed/route.ts](../app/api/inventory/broadcast/feed/route.ts) (caption + 30m exclusion)
- [components/atelier/TeamPortalClient.tsx](../components/atelier/TeamPortalClient.tsx) (tab registration)
- [components/atelier/WorkDrawer.tsx](../components/atelier/WorkDrawer.tsx) + [components/atelier/WorkForm.tsx](../components/atelier/WorkForm.tsx) (caption seed)
- [components/atelier/InventoryTab.tsx](../components/atelier/InventoryTab.tsx) (row toggle)
- [lib/i18n/dictionary.ts](../lib/i18n/dictionary.ts)
- Plan file: `C:\Users\pppee\.claude\plans\c-users-pppee-desktop-inventory-broadca-playful-sedgewick.md`
- Source strategy: `C:\Users\pppee\Desktop\inventory-broadcast-strategy-refined.md`

## Worktree hygiene per CLAUDE.md

- Worktree edits already copied to real app. If you make further edits, re-copy.
- Don't commit unless user says "GO".
- At session end remove the worktree per CLAUDE.md `WORKTREE CLEANUP` rule, except the active one.
