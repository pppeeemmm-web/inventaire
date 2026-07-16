# PEM Studio — Admin Guide (Encyclopedia, Standalone)

> **⚠ Freshness (2026-07-16):** photo/session/hub/approval sections predate the 2026-07 mobile rationalization pass (Lightroom UI removed, `image_add` pending gate, manual `NeedsPhotograph` gate, session apply guards). Where this guide and [`MOBILE_RATIONALIZATION_PLAN.md`](./MOBILE_RATIONALIZATION_PLAN.md) disagree, the plan + live code win. Full guide update owed with Phase 5.

**Audience.** You are an **admin** (`is_admin()` returns `true`, your `Contact.is_admin = true` linked to `auth.uid()`). This document is **self-contained**: it covers every team-accessible feature **and** every admin-only chapter. You do not need to read [`TEAM_MEMBER_GUIDE.md`](./TEAM_MEMBER_GUIDE.md) alongside it — but team members read that one.

**Companion docs.**
[`SITE_MAP.md`](../SITE_MAP.md) (engineer reference) • [`CONSTELLATION.md`](./CONSTELLATION.md) (canvas contract) • [`BROADCAST.md`](./BROADCAST.md) + [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) (broadcast pipeline) • [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) (backups) • [`PROJECT_SYNTHESIS.md`](./PROJECT_SYNTHESIS.md) (stack).

---

## Table of contents

**Shared with team — admin POV**
1. How to use this guide
2. Admin vs team — the gate map
3. Sign-in, sessions, devices
4. Navigation & global chrome
5. Command palette (⌘K)
6. Work drawer — full encyclopedia (delete image + version history live for you)
7. Curation dock
8. Hub & field routes (`/atelier/session/new` is yours)
9. Field workflow routes
10. Atelier tabs — Field group
11. Atelier tabs — Studio group
12. Atelier tabs — Catalogue group (Pivot Atlas CSV is yours)
13. Atelier tabs — Commercial group
14. Atelier tabs — Public group
15. Atelier tabs — Admin group surface (Contacts, System)
16. Maps index
17. PWA & offline
18. Semantic search & embeddings
19. Pending edits flow (you approve / reject)
20. Mobile field tool — narrow chrome
21. Recent features
22. Troubleshooting (team-level)
23. Glossary

**Admin-only**

24. Audit tab (`/atelier/audit`)
25. Broadcast tab (`/atelier/broadcast`)
26. Field session capture (`/atelier/session/new`)
27. Hard delete & R2 lifecycle
28. Contact privacy & conflict queue
29. CSV graph export (`/api/export/csv`)
30. Studio Bible regeneration
31. System tab admin actions
32. Backups & disaster recovery
33. RLS & permissions cheat sheet
34. Calendar OAuth admin notes
35. Admin troubleshooting
36. Glossary (admin terms)
37. Public site & partner portals
38. Optional reading + engineer handoffs

---

## 1. How to use this guide

### 1.1 Status badges

| Badge | Meaning |
|-------|---------|
| ✓ Live | Production, verified. |
| β Beta | Works, rough edges. |
| ▲ Stub | Placeholder; workflow not finished. |
| ⚠ Admin-blocked for team | Button visible to team but server rejects. |
| 🔒 Admin only | Tab/section hidden from team. |
| 🛠 Admin power tool | A destructive or systemic action that requires extra care — you should pause and re-read the section before pressing the button. |

### 1.2 Conventions

- French labels first when the UI is French-first (`Inventaire / Inventory`, `Vue d'ensemble / Overview`).
- **Tables** for fields/controls; **callouts** below for behaviour.
- Callouts:
  - **Do:** what to do, and why.
  - **Don't:** what to avoid, and what breaks if you do.
  - **Use case:** real scenario.
  - **Advanced:** hidden modes, query params, side effects.
  - **Pitfall:** specific gotcha + recovery.

### 1.3 Install on phone

Safari (or Chrome) → production URL → Share → **Add to Home Screen**. Opens at `/hub`. Registered as Share target.

### 1.4 Where help lives

- This guide — exhaustive.
- [`CONSTELLATION.md`](./CONSTELLATION.md), [`BROADCAST.md`](./BROADCAST.md), [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md).
- Atelier → System → reference panel.
- Studio Bible (Vault).
- [`SITE_MAP.md`](../SITE_MAP.md) (route index).

---

## 2. Admin vs team — the gate map

The single source of truth is the `is_admin()` RPC: it returns `true` if `auth.uid()` matches a `Contact.auth_user_id` with `is_admin = true`.

Tables explicitly gated by `is_admin()` in RLS:
- `oeuvre_broadcasts` — SELECT / UPDATE / DELETE.
- `broadcast_events` — SELECT (admin or team for read).
- `oeuvre_versions` — SELECT.
- `pending_changes` — UPDATE / DELETE.

| Capability | Team | You |
|------------|:----:|:--:|
| Read every visible tab | ✓ | ✓ |
| New work — immediate save | ✓ | ✓ |
| Existing-work edit | → queue | immediate |
| Batch edit / catalog persist / constellation edges | immediate | immediate |
| Approve / reject pending changes (`/atelier/audit`) | — | ✓ |
| Restore old `oeuvre_versions` snapshot | — | ✓ |
| `purgeWorkPermanently()` | — | ✓ |
| Delete a work image (`deleteWorkImage()`) | — | ✓ |
| `/atelier/audit` tab | — | ✓ |
| `/atelier/broadcast` tab | — | ✓ |
| `clearStuckQueue(oeuvreId, platform)` | — | ✓ |
| Full field session capture (`/atelier/session/new`) | review-only | ✓ |
| Pivot Atlas CSV (Entités / Arêtes) | — | ✓ |
| `GET /api/export/csv` (graph CSV) | — | ✓ |
| Regenerate Studio Bible | — | ✓ |
| `Contact.is_private = true` | — | ✓ |
| Contact conflict queue (Overview + Contacts) | — | ✓ |
| Delete `studio_task` (Hub pulse) | — | ✓ |
| Manual `system_log` entry | ✓ | ✓ |
| Ledger attachment upload | ✓ | ✓ |
| Connect own Google / Microsoft calendar | ✓ | ✓ |

> **Defense in depth.** Some admin buttons render for the team too — the server rejects with 403. Don't worry about hiding them on the client; the RLS or RPC check is the real guard.

---

## 3. Sign-in, sessions, devices

### 3.1 Sign-in surfaces — ✓ Live

| URL | Use |
|-----|-----|
| `/login` | Google OAuth (`?next=` for return path). |
| `/auth/callback` | OAuth handler. Never visit directly. |

### 3.2 Phone / LAN dev access

- `pwsh scripts/dev.ps1` prints `Phone : http://<LAN-IP>:3000`.
- Don't OAuth on `192.168.*`; use `DEV_AUTO_LOGIN_*`.
- For matching prod data, set `DEV_AUTO_LOGIN_EMAIL` to your **real PEM admin email** (with a dev password set on that Supabase user).
- `work_session` RLS: any team member sees team-wide rows. If empty, run [`supabase/sql/work_session_team_read.sql`](../supabase/sql/work_session_team_read.sql).

### 3.3 PWA install — ✓ Live

iOS Safari → Share → Add to Home Screen. Opens at `/hub`. iOS touch icon: `/pwa-icon-180.png`. Manifest icons: 192 / 512 from [`app/manifest.ts`](../app/manifest.ts) (static mirror in [`public/manifest.webmanifest`](../public/manifest.webmanifest)).

### 3.4 Sign-out

Header → user menu → **Sign out**. Clears Supabase cookies.

### 3.5 Admin identity

`Contact.is_admin = true` linked to `auth.uid()` via `Contact.auth_user_id`. The `is_admin()` RPC (`SECURITY DEFINER`) is the single source. Old `profiles.role` is dead — do not use.

---

## 4. Navigation & global chrome

### 4.1 Entry points

| URL | Use |
|-----|-----|
| `/hub` | Phone launcher (your admin Hub adds the session quick-link). |
| `/atelier/overview` | Default desktop landing. |
| `/atelier/<tab>` | 25 segment routes. See [`lib/atelier/tab-routes.ts`](../lib/atelier/tab-routes.ts). |
| `/atelier?tab=<id>` | Legacy 308 redirect. |

### 4.2 Sidebar — 6 groups

1. **Terrain / Field** — `inventory` → `production` → `stock-take` → `notes` → `map`
2. **Studio** — `overview`, `pipeline`, `exhibitions`, `concepts`
3. **Catalogue** — `reports`, `themes`, `stock`, `constellation`
4. **Commercial** — `sales`, `logistics`, `fiscal`, `vault`
5. **Public** — `site`, `portfolio`, `analytics`
6. **Admin** — `contacts`, `system`, **`audit`**, **`broadcast`** *(last two yours only)*

Narrow: tap **☰**. Header shows active tab.

### 4.3 Header controls

| Control | What it does |
|---------|---------------|
| Hub link | Back to `/hub` (with unsaved guard). |
| Catalogue badge | Loaded vs total. Tap to load. |
| ⌘K / Ctrl+K | Command palette. Yours adds Capture session + Pending approvals. |
| New work (desktop) | `/atelier/works/new`. |
| Reports / System shortcuts | Tab jumps. |
| FR / EN | Language toggle. |
| Subset banner (Inventory) | "Showing X of Y" + Load next batch. |

### 4.4 Catalogue batches

- First load: one chunk + exact total.
- Tap **Load next batch** to fetch more.
- Subset markers: `atelier-oeuvres-subset-banner`, `atelier-overview-subset-caption`, `reports-subset-note`, `atelier-themes-subset-note`, `atelier-portfolio-subset-note`.

> **Do:** load every batch before running an export or generating the Studio Bible. The subset banner is your warning.

### 4.5 Deep links

| Param | Where | Effect |
|-------|-------|--------|
| `?work=<OeuvreID>` | any portal tab | Opens drawer. Stripped after open. |
| `?exhibition=<process_id>` | `/atelier/exhibitions` | Selects exposition. |
| `?map=<uuid>` | `/atelier/constellation` | Loads cloud map (frozen mode). |
| `?contact=<ContactID>` | `/atelier/contacts` | Opens editor. |
| `?inbox=<uuid>` | `/atelier/share-triage` | Selects row. |
| `?calendar=*_ok` / `*_err` | `/atelier/exhibitions` | OAuth banner. |
| `?next=<path>` | `/login` | Post-login redirect. |
| `?mode=doc` / `?mode=card` | `/atelier/capture` | Scan / business card. |
| `?session=<id>&date=<YYYY-MM-DD>` | `/atelier/session/new` | Specific session. |
| `?shareInbox=<uuid>` | `/atelier/works/new` | Pre-fill from inbox. |

### 4.6 Session-storage triggers

| Key | Effect |
|-----|--------|
| `pem_sales_open_new_order` = `1` | Auto-opens new sale on `/atelier/sales` mount. |
| `pem_open_contact` = `<id>` | Auto-opens contact editor. |
| `pem_curation_trigger` = `true` | Triggers Constellation custom layout. |

---

## 5. Command palette — ⌘K / Ctrl+K — ✓ Live (admin sections enabled)

| Section | Threshold | Yours? |
|---------|-----------|:---:|
| **Actions** | always | ✓ + **Regenerate Bible** |
| **Actions — admin** | always | ✓ — **Capture session**, **Pending approvals** |
| **Tabs** | always | ✓ + Audit, Broadcast |
| **Works** | ≥ 2 | ✓ |
| **Contacts** | ≥ 2 | ✓ |
| **Semantic** | ≥ 3 | ✓ |

Semantic states: loading / pending / unavailable. Pending often means a recently-saved work hasn't been embedded yet.

> **Do:** when reviewing a batch of pending changes, use `Capture session` action to drop into `/atelier/session/new` then back — confirms the day's row exists.

> **Advanced — keyboard:** ↑↓ navigate, Enter run, Esc close.

---

## 6. Work drawer — encyclopedia (admin POV)

Drawer opens from Inventory row, work card, map pin, constellation node, Curation dock hit, palette work result, or `?work=<OeuvreID>`.

Modes: **Panel** (desktop ~ 35 vw, expand 55 vw) / **Overlay** (100 vw, mobile, sticky footer).

### 6.1 Header chrome

| Control | Behaviour |
|---------|-----------|
| Work ID | Top-left, always visible. |
| Close (×) | Unsaved guard if dirty. |
| Panel expand | Widens to 55 vw on desktop. |
| Image zoom (wheel) | 1 × to 2 × eased; drag to pan. |
| Image reset | Wheel down. |

### 6.2 Images section — full admin powers — ✓ Live

**Accepted:** JPEG / PNG / WebP / GIF / AVIF / **HEIC**. Server normalises to 2100 px long-side AVIF q=50 with Artist/Copyright EXIF.

**Key format:** `paintings/W_{OeuvreID}_{SeqNo}_{hash8}.avif`. `hash8` = first 8 hex of SHA-256 of raw input bytes. Re-uploads are idempotent.

| Control | Admin behaviour |
|---------|------------------|
| Gallery list | Ordered by `SeqNo` asc. Last image = cover. |
| Reorder | Drag handle / arrows. Persists immediately. |
| Set cover | Moves to end of sequence; cache-busts. |
| Add image | Multi-file batched upload, per-file progress + cancel. |
| Retouch / replace | Replaces same `SeqNo` with fresh hash. Old R2 file → `recycle/`. |
| Zoom / pan | Wheel + drag. |
| Download original | R2 link. |
| **Delete** | ✓ for you. Calls `deleteWorkImage`. R2 originals + AVIF thumbs soft-deleted to `recycle/<YYYY-MM-DD>/`. |

**Soft-delete chain on image delete** ([`works/actions.ts`](../app/atelier/works/actions.ts)):
1. `tblImage` row removed.
2. R2 original `paintings/W_..._..._....avif` → `recycle/<date>/paintings/...`
3. R2 thumb `thumbs/W_..._..._....avif` → `recycle/<date>/thumbs/...`
4. `storage_object_ledger` row stamped with classification = `recycle`.

> **Do:** before deleting an image used as the **cover**, set another image as cover first. Otherwise the cover momentarily becomes empty until the next image lands.

> **Don't:** edit `Oeuvres.txtImageNameLink` directly — the trigger `tblimage_cover_sync` owns it. (CLAUDE.md hard rule.)

> **Advanced:** `r2SoftDelete(filename)` is the helper. Recycle lifecycle: 90 days (Cloudflare console). After that, gone.

### 6.3 QR block — ✓ Live

Copy / print certificate URL via `workPhysicalBridgeUrl(oeuvreId)`. Survives soft-delete (URL is stable per OeuvreID).

### 6.4 Title — `Oeuvres.Titre`

Inline edit. For you, all drawer field saves apply **immediately** (no pending queue).

### 6.5 Status bar

Computed from production (`Catalogué` + `NeedsPhotograph`) and ownership (`statusId`).

**Public-flipping status IDs:** `2, 4, 6, 7, 8, 11` — handled by trigger `sync_is_public_from_status()`. Reference: `lib/data.ts` `STATUS_IDS_PUBLIC`.

### 6.6 Production pipeline — ✓ Live

| Stage | DB |
|-------|------|
| Atelier | `Catalogué = false` |
| Catalogued | `Catalogué = true` + `NeedsPhotograph = true` |
| Available | `Catalogué = true` + `NeedsPhotograph = false` |

Ownership stages: Artist · Reserved · Consigned · Loan · Sold · Gift · Artist archive · Private archive.

Contact label rotation: Pem (artist/archive), Buyer intent (reserved), Custodian (consigned/loan), Acquirer (sold/gift).

`work_action` syncing: server action `syncPipelineWithBooleans()` keeps `work_action` rows in sync with the booleans on save (action IDs: 6 = Photographier, 9 = Cataloguer).

> **Do:** as admin, you can update production toggles on sold works in the rare reset case — the section greys but the underlying field still mutates. Only do this if you really need to.

> **Pitfall:** `anonymity_level` + `admin_override_anonymity` — set the override when you want to publish a work that would normally be redacted.

### 6.7 Identity section

| Field | Column | Notes |
|-------|--------|-------|
| Year | `Année` | DATE `YYYY-01-01`. |
| Technique | FK + type-to-add (`saveLookup`). |
| Support | FK + type-to-add; circular pattern detection. |
| H × W × D | numeric cm. |
| Digital (Technique 19) | px + cm @300 dpi. |
| Framed / Mounted | `Encadree` / `montee` booleans. |
| Broadcast ready | `broadcast_ready` boolean; unlocks caption seed. |
| Caption seed | `broadcast_caption_seed` (≤ 2000). |
| Presentation | `PresentationID` FK. |
| Themes | Multi-select pill chips. |

### 6.8 Finance

`Prix`, `Discount`, `tva_rate`, computed final price, `is_paid`. Gift stage locks all but `is_paid` stays editable.

### 6.9 Working groups

Pill toggles → `working_group_members(oeuvre_id, group_id)`.

### 6.10 Work sessions (drawer side panel)

Lists `work_session` rows linked to this work. **You** can delete entries inline (the button is admin-only via `canCaptureWorkSession`).

### 6.11 Notes

`Commentaires` (free) + `Historique` (append convention). `historiqueLinesForOeuvreUpdate()` formats new lines on save.

### 6.12 Version history — 🔒 admin only

The drawer renders a `WorkVersionHistory` panel for you. Reads from `oeuvre_versions` via [`fetchOeuvreVersions(oeuvreId, limit = 50)`](../app/atelier/(portal)/audit/version-actions.ts).

The DB trigger snapshots OLD on every `Oeuvres` UPDATE. Restore via §24.3.

### 6.13 Footer actions (admin)

| Button | Behaviour |
|--------|-----------|
| Save | **Immediate.** All fields. |
| Add photo (narrow) | File picker; immediate. |
| Pipeline bump (narrow) | Quick stage advance; immediate. |
| Add to selection / In selection | Toggles in Curation dock. |
| Gift | Opens gift modal — recipient + date + notes. Calls `markAsGift`. |
| Delete | Two-step → soft-delete (`deleted_at = now()`) + Undo toast (~ 8 s). |

For permanent delete use §27.

### 6.14 Sale return banner

When work is `Sold`, fetches `getReturnWindowHintForOeuvre`. States: Skipped / No start date / Active days remaining. Cron `app/api/cron/return-window/route.ts` archives expired sales.

### 6.15 Pending-changes flow (you are the consumer)

For team: drawer save on existing work → row in `pending_changes`. You see them in Audit. See §24.2.

---

## 7. Curation dock

Appears when ≥ 1 work is selected. Hidden on `/atelier/constellation`.

| Button | Opens |
|--------|-------|
| Modify | Batch edit modal — applies immediately. |
| Export | Export modal — HTML / PDF. |
| Attach | Catalog persist (bulk theme/group). |
| Compare | Side-by-side compare. |
| `+ Group name` | Save selection as new working group. |
| Curate → | Constellation with selection (`pem_curation_trigger`). |
| Clear | Deselect all. |

### 7.1 Batch edit — full field list (tri-state booleans, themes/groups add/remove)

Title, year, technique, support, format, dimensions, status, contact, location, price, discount, year, comments (overwrite/append), historique append, exposable, montée, encadrée, cataloguée, commission, gift, paid, needs photo, broadcast-ready. Theme/group multi-select + inline create.

### 7.2 Export modal

Layout picker (catalogue list / grid / single-work sheet). Server-side pdfkit.

### 7.3 Compare modal

Long-text fields load async on expand.

> **Pitfall — Export PDF cap.** Vercel function timeout ~ 60 s. Limit to ~ 16 works at full quality.

---

## 8. Hub `/hub` — phone field launcher

### 8.1 Field pulse

| Metric | What |
|--------|-----|
| Past due | Open reminders with `due_at < today`. |
| Today | Reminders + deadlines for today. |
| **Pending review** | Open `pending_changes` count — tap → `/atelier/audit`. |
| Share inbox | Unprocessed `share_inbox`. |
| First card | Suggested next action. |
| Open inbox | `/atelier/field-inbox`. |

### 8.2 Field verbs

| Verb | Destination | Notes |
|------|-------------|-------|
| From Lightroom | `/atelier/share-triage` | |
| Session | `/atelier/session/new` with today's date | **You** open the full capture wizard. |
| Voice note | `VoiceNoteSheet` | |
| Scan document | `/atelier/capture?mode=doc` | |
| Pipeline | `/atelier/pipeline` | |
| New sale | `/atelier/sale/new` | |
| Triage | `/atelier/triage` | broadcast triage deck |
| Business card | `/atelier/capture?mode=card` | |
| Document | `/atelier/documents/new` | β (COA today) |
| Report issue | `/atelier/issue/new` | |

### 8.3 Studio room tiles

Field → Inventory · Studio → Overview · Commercial → Pipeline · Admin → Contacts.

### 8.4 Mobile bottom bar

| Button | Admin destination |
|--------|---------------------|
| Session | `/atelier/session/new` |
| Scan | `/atelier/scan` |
| Voice note | VoiceNoteSheet |
| Reminders | Overview reminders |
| New work | `/atelier/works/new` |

### 8.5 Desktop

`/hub` may redirect to `/atelier/overview`. Hub is the field tool.

---

## 9. Field workflow routes

### 9.1 Field inbox `/atelier/field-inbox` — ✓ Live

Focused mirror of Hub field pulse.

### 9.2 Share triage `/atelier/share-triage` — ✓ Live

Lists `share_inbox` rows. Actions: manual import form, open row (`?inbox=<uuid>`), dismiss/delete, attach to existing work, new work / split, return-session banner.

Return-session banner: appears after a Lightroom roundtrip — if you have a session open today, click to link the shots into the session items.

### 9.3 Share receive `/atelier/share-receive` — ✓ Live (HTTP route)

PWA POST handler. Multipart form with `title`, `text`, `url`, files. Persists to `share_inbox` + R2 → 303 to `/atelier/share-triage`. Requires `supabase/sql/share_inbox.sql`.

### 9.4 Session `/atelier/session/new` — ✓ Live for you

This is yours. See §26.

### 9.5 Create work `/atelier/works/new` — ✓ Live

Full WorkForm + QR block. Immediate save. `?shareInbox=<uuid>` pre-fills.

- 7-day draft TTL stored in sessionStorage; offers restore on reload.
- Undo baseline snapshot.
- Multi-file batched upload; offline queue fallback (§17.3).

### 9.6 Scan `/atelier/scan` — ✓ Live

QR camera + manual `OeuvreID` entry → drawer.

### 9.7 Capture `/atelier/capture` — ✓ Live (modes)

| URL | Behaviour |
|-----|-----------|
| `/atelier/capture` | Stub. |
| `?mode=doc` | Multi-page document scan → PDF in vault. |
| `?mode=card` | Business card capture → contact import preview → confirm → `Contact`. |

### 9.8 New sale `/atelier/sale/new` — ✓ Live

Sale-order form. Lands on order detail.

### 9.9 Documents `/atelier/documents/new` — β

Routes to COA generation via `generateFieldDocument('coa', oeuvreId)`. Writes PDF to vault.

### 9.10 Issue `/atelier/issue/new` — ✓ Live

`studio_task` row. Surfaces on Hub pulse + Overview reminders.

### 9.11 Triage `/atelier/triage` — β

Broadcast triage deck. Swipeable cards for `broadcast_ready` works. Confirmed posts go to `oeuvre_broadcasts` queue (§25).

---

## 10. Atelier tabs — Field group

### 10.1 Inventaire / Inventory — `/atelier/inventory` — ✓ Live

Views: **List** (table + side preview), **Grid**, **Pivot** (inline panel).

Search: text, paste-list-of-IDs (comma/newline separated).
Quick filters: technique, support, status, theme, working group.
Advanced filter: (field + operator + value), AND-chained.
Sort: any column.
Selection: row checkbox + select-all-filtered.
Embedding badges: pending / embedding / error.
Paging: top strip + bottom paging bar.

> **Do:** paste a list of IDs you got in chat — instantly scoped table.

> **Advanced:** virtualised rows; ID column drives stable keys.

> **Pitfall:** selection persists across tab switches (persistent shell). Clear it from Curation dock when done.

### 10.2 Production — `/atelier/production` — ✓ Live

Pipeline-incomplete works. Per-work checklist toggles `work_action` rows. Pivot export for throughput stats.

### 10.3 Stock-take — `/atelier/stock-take` — ✓ Live

Physical count surface. +/− adjusts in-UI; **Apply** modal persists corrections.

### 10.4 Journal — `/atelier/journal` — ✓ Live (admin full editor)

| Function | Admin |
|----------|:---:|
| Month calendar index | ✓ |
| Select day → session detail | ✓ |
| Edit session metadata | ✓ |
| Delete session / items | ✓ |
| Version compare on items | ✓ |
| Capture today shortcut | ✓ (`/atelier/session/new`) |

Sessions consolidate to one canonical row per calendar day (Europe/Paris). See §26.

### 10.5 Notes — `/atelier/notes` — ✓ Live

`voice_note` rows. Audio playback via R2 public URL. Filters by kind / time bucket. Edit transcript inline.

### 10.6 Map — `/atelier/map` — ✓ Live

Leaflet. Modes: Contacts / Works.
Contact pin fallback: prefer `contact_addresses` with city + country; else `Contact.Ville/Pays`; else no pin.
Geocode via `/api/geocode` with client cache.

---

## 11. Atelier tabs — Studio group

### 11.1 Vue d'ensemble / Overview — `/atelier/overview` — ✓ Live

Cards (computed on loaded subset): works this year · priced · available · missing dims/images/location · financial pulse (sold revenue YTD) · recent works · pipeline calendar · upcoming deadlines · field reminders · expenses teaser · burning concepts · technique breakdown.

**Conflict queue card 🔒 admin only** — appears on your Overview. Tap → resolves duplicates in Contacts (§28).

### 11.2 Pipeline — `/atelier/pipeline` — ✓ Live

Process types: `vente, exposition, residence, expedition, consignment, …`. Views: board / list / calendar. Modal: new process. Open process: steps + deadlines + mark complete.

Reminders: badge + list + mark read + delete.

Calendar OAuth banner appears when returning from `?calendar=*_ok`.

### 11.3 Expositions / Exhibitions — `/atelier/exhibitions` — ✓ Live

Project list: `suivi_process` with `type = 'exposition'`.

Floor plan: upload image; define **walls** (name + colour); drag works onto plan (x/y % + scale).

Per-work checklist: `suivi_etape` rows.

Calendar export: Google or Microsoft OAuth (per user; tokens in `calendar_account` encrypted with `CALENDAR_TOKEN_ENCRYPTION_KEY`).

Delete exhibition: clears `exhibition_process_id` on referencing pipeline rows first, then deletes the `exposition` row.

Deep link `?exhibition=<process_id>` selects.

> **Do:** before deleting an exhibition that has linked pipeline processes (vente, expedition), confirm the deletion is correct — the FK clearing is automatic but irreversible.

### 11.4 Concepts — `/atelier/concepts` — ✓ Live

Idea bank. CRUD on `concept` rows. Sketch upload (native camera capture allowed here). Stats: active, high energy, converted. **Promote to work** workflow turns concept → `Oeuvres` row.

---

## 12. Atelier tabs — Catalogue group

### 12.1 Rapports / Reports — `/atelier/reports` — ✓ Live

**Works table mode:** column picker, filters (search + technique + support + status + theme + group + selection-only), sort, subset note, **XLSX** export, **PDF** export (pdfkit; row cap ~ 200, [`reports/actions.ts`](../app/atelier/(portal)/reports/actions.ts)).

**Pivot Atlas mode:**
- Preset **Contacts × Themes** — grid + widget XLSX export.
- Preset **Raw edges** — flat graph edges.
- Pivot toolbar — dimensions + measures.
- **CSV Entités / Arêtes — admin only.** Triggers `GET /api/export/csv?view=entity|edge_fact` (§29). Filename `pem_{view}_{YYYY-MM-DD}.csv`, UTF-8 BOM, streamed 500 rows/page.

### 12.2 Thèmes — `/atelier/themes` — ✓ Live

Context-menu rename + Ctrl+Del confirm. Working group list. Mosaic per theme.

### 12.3 Stock — `/atelier/stock` — ✓ Live

Supplier hub. CRUD.

### 12.4 Constellation — `/atelier/constellation` — ✓ Live

See [`CONSTELLATION.md`](./CONSTELLATION.md) for the full curator contract.

Layout modes: year · theme · working group · free · custom (selection-driven).

Overlays: move · marquee · draw · line · text · erase.

Edge types: influence (gold solid) · proximity (blue dashed) · series (green solid) · diptych (magenta dashed). Server actions `insertConstellationRelation` / `deleteConstellationRelation` write `tblrelations`.

Snapshots:
- Local: `localStorage.pem_const_snapshots`.
- Cloud: server actions (`saveConstellationMap`, `listConstellationMaps`, `loadConstellationMap`, `deleteConstellationMap`).
- Positions per mode: `pem_const_pos_year`, `pem_const_pos_theme_<id>`, `pem_const_pos_wg_<id>`, `pem_const_pos_none`.

Frozen mode: cloud map loaded via `?map=<uuid>` is read-only until exited.

Caps: 10 000 relations · 50 000 theme-work memberships · 480 thumb LRU · 40/100/200 px adaptive thumb tiers.

---

## 13. Atelier tabs — Commercial group

### 13.1 Sales — `/atelier/sales` — ✓ Live

KPI strip · order list · new order modal · order detail · sold-works pivot · session storage `pem_sales_open_new_order = 1` auto-opens new order.

### 13.2 Logistics — `/atelier/logistics` — ✓ Live

Upcoming / delivered shipments. New shipment row, mark delivered.

### 13.3 Fiscal — `/atelier/fiscal` — ✓ Live

French BNC framework. Expense CRUD. Pivot on expenses. Recettes from sold works.

### 13.4 Vault — `/atelier/vault` — ✓ Live

Folder tree (document kinds). Upload, preview, search/filter, multi-select delete. **Generate COA** modal. Open Studio Bible (latest `document.kind = 'bible'` via signed URL).

**Regenerate Bible** — your admin button, see §30.

---

## 14. Atelier tabs — Public group

### 14.1 Site `/atelier/site` — ✓ Live

`PortfolioConfigShell`. Configure public sections, copy/labels, work visibility, theme assignments. Live on the public site immediately.

### 14.2 Portfolio `/atelier/portfolio` — ✓ Live

| Control | Behaviour |
|---------|-----------|
| Sections / collections | Configure |
| Manual work order | CSV import / drag |
| Modes per section | Display options |
| Generate PDF | pdfkit via [`pdf-action.ts`](../app/atelier/portfolio/pdf-action.ts) |
| Subset note | When partial catalogue |

Section source priority:
1. `raw.sections`
2. `raw.works_modes[0].collections`
3. `raw.works_collections`
4. `__all__`

Themes & groups appendix appended automatically when `tblrelations` edges exist.

Cover = first loaded image; excluded from work pages.

pdfkit gotchas (CLAUDE.md):
- **Never** 8-char alpha hex. Use `fillOpacity(N).fill('#RRGGBB').fillOpacity(1)`.
- Text without `height` may auto-page; refill background.
- 60 s function timeout. ≤ 16 works at full quality.
- A4 portrait auto-detected.

### 14.3 Analytics `/atelier/analytics` — ✓ Live

Shell-family analytics hooks + configuration. Not a visitor analytics dashboard.

---

## 15. Atelier tabs — Admin group surface

### 15.1 Contacts — `/atelier/contacts` — ✓ Live

Search / filter / open editor (name, institution, addresses, role, notes, linked works).

| Control | Admin |
|---------|:---:|
| Quick create | ✓ |
| Business card import | ✓ |
| Merge duplicates | ✓ (from conflict queue) |
| **Private contact** (`is_private`) | ✓ |
| Delete contacts | ✓ (`deleteContacts`) — also wipes `contact_addresses` |

> **Do:** prefer **archive** (`Actif = false`) over delete for contacts with sale history.

> **Don't:** mass-delete contacts with linked works — `Oeuvres.ContactID` becomes null but the sale anchor is lost.

### 15.2 Système / System — `/atelier/system` — ✓ Live

Reads `docs/SYSTEM_LEDGER.md` via [`system-reference-actions`](../app/atelier/system-reference-actions.ts). Manual `system_log` entries (`event_type = null`) are pruning-protected.

Admin actions on this tab:
- **Delete `studio_task`** ([`deleteStudioTask`](../app/atelier/(portal)/system/actions.ts)) — your button.
- **Regenerate Studio Bible** — admin only (§30).
- Read team's manual log entries.

Ledger attachment upload: R2 keys `ledger/<filename>`, 30-day lifecycle. Tolerated `onError` on thumbnails (expected after 30 d).

---

## 16. Maps index `/maps` — ✓ Live

Lists saved cloud constellation maps. Each row opens `/atelier/constellation?map=<uuid>` in frozen mode.

---

## 17. PWA & offline

### 17.1 Install — ✓ Live

iOS Safari → Share → Add to Home Screen. `/hub` opens. Touch icon: `/pwa-icon-180.png`. Manifest icons 192/512 in [`app/manifest.ts`](../app/manifest.ts).

### 17.2 Share target — ✓ Live

POST to `/atelier/share-receive`. Field names: `title`, `text`, `url`, file parts. Keep [`app/manifest.ts`](../app/manifest.ts) and [`public/manifest.webmanifest`](../public/manifest.webmanifest) in sync.

### 17.3 Offline blob queue — β

IndexedDB stores: `workSaveQueue` (FormData) + `workSaveBlobs` (binary). Legacy v1 records auto-migrated to v2 on read.

`AtelierOfflineFlush` flushes on reconnect.

> **Don't:** uninstall the PWA while saves are queued.

### 17.4 Service worker — ✓ Live

Serwist. Cache buckets ([`app/sw.ts`](../app/sw.ts)):
| Bucket | Strategy | TTL / entries |
|--------|----------|---|
| `pem-r2-images` | CacheFirst | 30 d / 128 |
| `pem-shell-pages` | StaleWhileRevalidate | 24 h / 32 |
| `/~offline` | Doc fallback | — |

### 17.5 Phone photo discipline

✓ Canonical: Lightroom Mobile → Export JPEG → Share → PEM Hub → triage.
✗ `lightroom-cc://` from PWA — iOS refuses.
✗ Native `<input capture="environment">` on work paths.
✓ Native capture allowed: `?mode=card`, session new shot upload (you), Concepts sketch.

---

## 18. Semantic search & embeddings

Backends: Vercel embed cache (primary), Ollama (`OLLAMA_ORIGIN`, port 11435 fallback).

States: ready / pending / embedding / error / unavailable.

Triggered: on every work save, on image upload. Async.

> **Admin troubleshoot:** if many rows show `error`, restart the embedding worker (or Ollama on the dev host). See `embedding-status-actions.ts`.

---

## 19. Pending edits — you are the consumer

Team save on existing work → `pending_changes` row (allow-list in [`lib/work-pending-keys.ts`](../lib/work-pending-keys.ts)):

Scalar keys: `oeuvre_id, titre, annee, technique, support, format, hauteur, largeur, profondeur, prix, discount, prix_final, status_id, contact_id, commentaires, historique, localisation_id, localisation_detail, tva_rate, broadcast_caption_seed, date_livraison, anonymity_level, presentation_id, image_existing, historique_append`.

Checkbox keys: `exposable, broadcast_ready, montee, encadree, catalogued, is_commission, needs_photograph, admin_override_anonymity, is_paid, is_gift, payment_received, is_anonymous`.

Multi: `themes, groups`.

Bypass queue (always immediate): new work, batch edit, catalog persist, constellation edges, image ops, soft-delete, gift modal.

Approve / reject flow: §24.2.

---

## 20. Mobile field tool — narrow chrome

Breakpoint `useMediaQuery('(max-width: 767px)')`. Safe-area padding via `max(<px>, env(safe-area-inset-bottom))`.

Narrow sidebar order — Field first: `inventory → production → stock-take → notes → map`.

Verified 375 px; no horizontal scroll; ≥ 44 px taps; safe-area padding on sticky bars.

Canonical phone photo flow: Lightroom → Share → PEM Hub → triage → (admin) session apply.

---

## 21. Recent features

| Feature | Badge |
|---------|:----:|
| 25 segmented tab URLs | ✓ |
| Persistent shell | ✓ |
| Constellation + graph | ✓ |
| Semantic search | β |
| Embedding badges | ✓ |
| Pivot Atlas | ✓ |
| Pivot Atlas CSV (admin) | ✓ |
| FR / EN | ✓ |
| PWA share target | ✓ |
| Work sessions + Journal | ✓ |
| Pending review queue | ✓ |
| Portfolio PDF appendix | ✓ |
| PWA offline queue | β |
| Floor plan walls | ✓ |
| Calendar export | ✓ |
| Inventory paste-ID search | ✓ |

---

## 22. Troubleshooting (team-level)

| Problem | Try |
|---------|-----|
| 500 / blank after dev change | Hard refresh; restart dev with clean `.next`. |
| Save stuck "pending" | You are the unblocker — `/atelier/audit`. |
| Semantic search empty | Wait for indexing; shorter query. |
| Share missing from Lightroom Sheet | Re-add PWA to Home Screen; share JPEG not RAW. |
| Reports don't match real archive | Load all batches first. |
| Wrong map pin | Fix `contact_addresses` row. |
| Phone OAuth bounces to prod | Use `DEV_AUTO_LOGIN_*` on LAN. |
| Drawer won't close | Unsaved guard fired; look for modal behind. |
| Curation dock didn't appear | 0 selected. |
| Theme delete blocked | Detach works first. |
| Process delete failed | Exhibitions tab clears `exhibition_process_id` first. |
| Work I created last week missing | `restoreSoftDeletedWorks([id])`. |

Admin-level troubleshooting in §35.

---

## 23. Glossary (shared)

`Oeuvre` · `OeuvreStatus` · `suivi_process` · `suivi_etape` · `suivi_reminder` · `Exposition` · `Pipeline ↔ Exhibition` (via `exhibition_process_id`) · `Consignment` · `broadcast_ready` · `broadcast_caption_seed` · `anonymity_level` · `pending_changes` · `oeuvre_versions` · `working_group` · `theme` · `OeuvreTheme` · `tblrelations` · `work_action` · `work_session` · `share_inbox` · `studio_task` · `system_log` · `vault` · `bible` · `COA` · `R2` (EU endpoint only) · `Recettes` · `BNC` · `is_team()` · `is_admin()` · persistent portal shell · subset banner · Curation dock · Semantic search · PWA share target · Lightroom roundtrip.

Admin-only terms in §36.

---

# Admin-only chapters

The remaining sections cover the surfaces and powers that are hidden from team. You are the operator of these. Every chapter:
- Names the action and its file path.
- Lists the gate (RPC / RLS / server check).
- Documents inputs, side effects, and recovery.
- Closes with Do / Don't / Use case / Pitfall.

---

## 24. Audit tab — `/atelier/audit` — ✓ Live 🔒

**Files.** [`app/atelier/(portal)/audit/actions.ts`](../app/atelier/(portal)/audit/actions.ts), [`pending-actions.ts`](../app/atelier/(portal)/audit/pending-actions.ts), [`version-actions.ts`](../app/atelier/(portal)/audit/version-actions.ts).

Three subsurfaces: system audit log, pending changes queue, version restore.

### 24.1 System audit log — `fetchSystemLogs(limit = 100)`

**Gate.** `is_admin()` RPC. Non-admin returns empty array.

**Source.** `system_log` table. Excludes:
- `event_type IS NULL` (manual ledger entries — team-readable, prune-protected).
- `event_type = 'ATELIER_VIEW'` (noisy page view events).

Enriched with user emails from `Contact.auth_user_id ↔ Email`.

**Common `event_type` buckets.**

| `event_type` | What it means |
|--------------|----------------|
| `VISIBILITY_GATE` | A surface check denied access (e.g. `is_admin()` returned false). |
| `GATE_BYPASS` | An admin overrode a normal gate (rare; investigate why). |
| `PAYMENT_GRAIN` | Fine-grained payment audit log entry on a sale order. |
| `STATUS_CHANGE` | Work status transition. |
| `VAULT_UPLOAD` | Document uploaded to vault. |
| (others) | Various server actions stamping audit rows. |

> **Do:** scan the log weekly. Unusual `GATE_BYPASS` rows are a smell.

> **Don't:** prune the log manually. The cron `audit_log_prune()` does it weekly and never deletes manual entries or error broadcasts (§32).

### 24.2 Pending changes queue — `listPendingChanges()` / `approvePendingChange(id)` / `rejectPendingChange(id, reason)`

**Gate.** `ensureAdmin()` → `is_admin()` RPC.

**`listPendingChanges()` returns:** all `pending_changes` rows with `status = 'pending'`, latest 200, ordered desc by `created_at`. Enriched with current `Oeuvres.Titre`.

```
PendingChange {
  id, oeuvre_id, payload (Record<string,string>),
  baseline (snapshot at submission), author_id, author_email,
  status: 'pending' | 'approved' | 'rejected',
  created_at, reviewed_at, reviewer_id, reject_reason,
  oeuvre_title
}
```

**Approve flow.**
1. `ensureAdmin()` gate.
2. Select the row; abort if not `pending`.
3. **`filterPendingPayloadForReplay(row.payload)`** strips unknown keys — defense against tampered queue rows. Only `ALLOWED_PENDING_SAVE_KEYS` remain.
4. **`formDataFromPendingPayload(filtered)`** rebuilds FormData with multi-value `themes` / `groups` restored from CSV-joined strings.
5. `fd.set('__skip_review', '1')` — bypasses the team-gate check inside `saveWork()`.
6. `saveWork(fd)` runs as if you saved the form yourself.
7. On success: row → `approved`, `reviewed_at`, `reviewer_id`.
8. `revalidatePath('/atelier/audit')` + `revalidatePath('/atelier')`.

**Reject flow.**
1. Same gate.
2. Update row → `status = 'rejected'`, `reviewed_at`, `reviewer_id`, `reject_reason` (or `null`).
3. **No side effects on `Oeuvres`.**
4. `revalidatePath('/atelier/audit')`.

> **Do:** read the `baseline` column when in doubt — that's the snapshot of `Oeuvres` at the moment the team member opened the drawer. Compare to the current row to know what changed under them.

> **Do:** provide a reject reason — the team member sees it in their pulse.

> **Don't:** approve without scanning the payload for sneaky keys. The `filterPendingPayloadForReplay()` strips them, but you should still verify the intent.

> **Pitfall:** if `saveWork()` returns `{ error }`, the queue row stays `pending`. Don't manually flip the row's status — fix the underlying error (likely RLS or a typo'd FK).

> **Advanced — replay loop.** If multiple team members queued edits on the same work, approve them in order; each replays the next-applicable diff against the now-updated row. Re-read the queue after each approval.

### 24.3 Version restore — `fetchOeuvreVersions(oeuvreId, limit = 50)` / `restoreOeuvreVersion(versionId)`

**Gate.** `ensureAdmin()`.

**Source.** `oeuvre_versions` table — populated by the DB trigger that snapshots OLD row before every `Oeuvres` UPDATE.

```
OeuvreVersion {
  id, oeuvre_id, snapshot (Record<string,unknown>),
  changed_by, changed_at, source
}
```

**Restore flow.**
1. Select the version row; abort if missing.
2. Strip these keys from the snapshot (trigger-owned / primary key / immutable):
   - `OeuvreID` (PK)
   - `is_public` (owned by trigger `sync_is_public_from_status`)
   - `txtImageNameLink` (owned by trigger `tblimage_cover_sync`)
   - `created_at`
3. Update via **service-role client** (`createServiceClient()`) — bypasses RLS so every remaining column is honoured.
4. The update itself fires the snapshot trigger → fresh `oeuvre_versions` row is written **of the just-overwritten state** (preserving lineage).
5. `revalidatePath('/atelier')` + `revalidatePath('/hub')`.

> **Do:** before restoring, look at the pending queue — there may be in-flight edits you'd undo unintentionally.

> **Do:** prefer restoring to a known-good version after a destructive batch edit went wrong. The fact that the restore itself snapshots OLD means you can roll back the restore too.

> **Don't:** rely on version restore for images — `tblImage` is **not** in `oeuvre_versions`. Use the R2 `recycle/` lifecycle (§27.3) for image rollback.

> **Don't:** restore an old snapshot over a work that's been re-photographed — you'll lose the new cover association. The trigger updates `txtImageNameLink` correctly on cover changes, but the work's identity fields might revert.

> **Pitfall:** "Version introuvable" → row id doesn't match. Refresh and try again.

### 24.4 Pending work sessions

The Audit tab also renders `<PendingWorkSessions />` (UI subcomponent). Lists `work_session` rows with `status = 'pending_review'`. You can approve (`status → applied`) or reject from there.

---

## 25. Broadcast tab — `/atelier/broadcast` — ✓ Live 🔒

**Files.** [`broadcast/actions.ts`](../app/atelier/(portal)/broadcast/actions.ts). [`BROADCAST.md`](./BROADCAST.md) + [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md).

### 25.1 Dashboard — `listBroadcastDashboard()`

**Gate.** `requireAdminGuard()` (auth + `is_admin()`).

Uses **service-role client** for reads (RLS on `oeuvre_broadcasts` is `using (is_admin())`; we keep a uniform admin gate at the action level too).

**Returns.**
```
BroadcastDashboard {
  queue: BroadcastQueueRow[]    // status='queued', latest 100, desc by queued_at
  posted: BroadcastPostedRow[]  // status='posted', latest 50, desc by broadcast_at
  events: BroadcastEventRow[]   // broadcast_events, latest 50, desc by created_at
  counts: { queued, posted, vipUnseen }
}
```

Each row is enriched with the work's title, thumb (via `thumbUrl()`), and `anneeYear`.

### 25.2 What drives the queue

| Trigger | Effect |
|---------|--------|
| `Oeuvres.broadcast_ready = true` | Eligible for `/api/inventory/broadcast/feed`. |
| `Oeuvres.broadcast_caption_seed` | Hint text → AI caption (outside repo). |
| `Oeuvres.status_id` in publishable IDs | Trigger flips `is_public = true`. |
| External worker (Make/n8n) | Calls `POST /queue` to mark queued, then `POST /confirm` after posting. |
| External worker | `POST /event` for VIP / standard observations. |

See [`BROADCAST.md`](./BROADCAST.md) for the HTTP contract.

### 25.3 The Make / n8n chain

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/inventory/broadcast/feed?platform=<slug>` | Bearer `INVENTORY_BROADCAST_SECRET` | Eligible works + `captionSeed`. |
| POST | `/api/inventory/broadcast/queue` | Bearer secret | Mark queued; drops from feed. |
| POST | `/api/inventory/broadcast/confirm` | Bearer secret | Posted: `externalUrl`, `captionFinal`. |
| POST | `/api/inventory/broadcast/event` | Bearer secret | Log VIP / standard event. |

Header alternative: `x-inventory-broadcast-secret` (see [`lib/inventory-broadcast-secret.ts`](../lib/inventory-broadcast-secret.ts)). Shared rate-limit at [`lib/inventory-broadcast-rate-limit.ts`](../lib/inventory-broadcast-rate-limit.ts) → HTTP 429.

### 25.4 Clear stuck queue — `clearStuckQueue(oeuvreId, platform)` 🛠

**Gate.** `requireAdminGuard()`.

**Effect.** Deletes rows from `oeuvre_broadcasts` matching `(oeuvre_id, platform, status='queued')` via service-role. The work re-enters the feed on the next poll.

> **Do:** check the events log (`broadcast_events`) before clearing — there may be a posting failure you should fix at the worker, not in the queue.

> **Don't:** clear a queued row that's mid-flight (worker has already called `/queue` but not yet `/confirm`). You'll cause a duplicate post when the worker re-fetches the feed.

> **Use case:** the AI captioning Make scenario went down for 6 hours, and 4 works are stuck in queue. Confirm via the worker's log that they were never actually posted, then `clearStuckQueue` per (oeuvre, platform) pair.

### 25.5 VIP unseen counter

`counts.vipUnseen` = number of `broadcast_events` with `priority = 'vip'` in the last 50. Today this is "VIP events in the fetched window" — a true cursor is on the wishlist.

### 25.6 Don'ts

> **Don't:** flip `broadcast_ready` on a work whose `broadcast_caption_seed` is empty unless you're ok with the AI seeing only the title. Set a seed first.

> **Don't:** post a private archive (`status_id` not in publishable set) — the feed filter excludes them, but a manual queue insert would slip through. Don't bypass.

---

## 26. Field session capture — `/atelier/session/new` — ✓ Live 🔒

**Files.** [`app/atelier/session/actions.ts`](../app/atelier/session/actions.ts), [`lib/work-session-payload.ts`](../lib/work-session-payload.ts), [`lib/field-context.ts`](../lib/field-context.ts), [`app/api/field-weather/route.ts`](../app/api/field-weather/route.ts), [`supabase/sql/work_session.sql`](../supabase/sql/work_session.sql).

### 26.1 Why team is gated

Field capture mutates `tblImage` + `Oeuvres` directly. The team is gated to read-only review so:
- Capture quality stays consistent.
- Two captures from different team members don't compete.
- The image normalisation pipeline (AVIF, EXIF) runs through your hands once.

Team gate: `canReadTeamWorkSessions()` → `rpcIsTeam()` (read team-wide).
Capture gate: `canCaptureWorkSession()` → `rpcIsAdmin()`.

### 26.2 Multi-shot staging — UI flow

Inside `SessionNewClient`:
1. Open a session for today (one canonical row per calendar day, Europe/Paris).
2. Add **items** — each item is a target (existing work via `oeuvre_id` or a new work via `title_hint`).
3. Per item, stage **shots** (image uploads). Each shot has an R2 key + optional thumb R2 key.
4. Annotate notes, width/height hints.
5. **Apply** — turns staged shots into `tblImage` rows on the target work; for new-mode items, creates an `Oeuvres` row first via `WorkForm`-style payload.
6. Submit-for-review path: keeps `status = 'pending_review'` so another admin can sanity-check before applying.

### 26.3 Weather / location snapshot — `lib/field-context.ts` → `/api/field-weather`

When the device grants geolocation, the session payload's `field_context` records:
- lat / lng
- weather conditions at session time (Open-Meteo proxy at [`/api/field-weather`](../app/api/field-weather/route.ts), Supabase session-cookie auth)
- city / country via reverse geocode

If the device denies geolocation, the context is recorded without it.

### 26.4 Apply images to catalogue

For each item with shots:
- **Existing-work item** (`mode = 'existing'`, `oeuvre_id` set): calls `addWorkImage(formData)` per shot. Image goes through `validateWorkImageBuffer`, sharp normalisation, R2 upload. `tblImage` row inserted with `SeqNo` = next.
- **New-work item** (`mode = 'new'`, `title_hint` set): creates `Oeuvres` row via `WorkForm`-style payload, then attaches shots.

### 26.5 Submit for pending review

`status = 'pending_review'` — your colleague (or you) reviews via `<PendingWorkSessions />` in the Audit tab.

### 26.6 Admin "apply now"

Skip the review queue: apply directly. Use when you're the only operator.

### 26.7 7-day draft TTL

`DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000`. After 7 days a draft session row is considered stale. Submission re-stamps `expires_at`.

### 26.8 `work_session.payload` JSON structure

```
WorkSessionPayload {
  session_at: string (ISO),
  session_day: string (YYYY-MM-DD, Europe/Paris),
  notes: string,
  title_hint, width_cm, height_cm: string,
  field_context?: WorkSessionFieldContext,
  items: WorkSessionItem[],
  shots: WorkSessionShot[]  // legacy; migrated into items
}

WorkSessionItem {
  id, mode: 'existing' | 'new',
  oeuvre_id, oeuvre_title, title_hint,
  notes, width_cm, height_cm,
  shots: WorkSessionShot[],
  applied_shot_count, status, updated_at
}

WorkSessionShot {
  sha256, r2_key, thumb_r2_key
}
```

Legacy: `payload.shots[]` is migrated into `items` on read (`migrateLegacySessionShotsToItems`).

### 26.9 Day consolidation — `consolidateSessionsForCalendarDay()`

The Europe/Paris calendar day is the canonical grouping. If multiple `work_session` rows exist for the same day, the **keeper** is picked by:
1. Highest content score (shots × 100 + items × 10 + actionable items).
2. Highest status rank (draft > applied > abandoned/rejected > pending_review).
3. Newest `updated_at`.

Donor rows are absorbed (items merged, shots deduped by `sha256`, notes appended) then deleted. `revalidatePath('/atelier', '/atelier/session/new', '/atelier/audit')`.

### 26.10 Do's / Don'ts

> **Do:** capture battery — sessions tend to be long, weather lookups + uploads drain.

> **Do:** tag location before starting shots so `field_context` is set early.

> **Don't:** create two sessions for the same day deliberately — they'll consolidate the next time the journal/session list re-loads, but during the window you may see odd duplicates.

> **Don't:** rely on geolocation in basement studios. The weather snapshot is optional context, not load-bearing.

> **Pitfall:** if applying fails part-way, re-open the session — items that succeeded are marked `applied`; the rest stay in their pre-apply state.

---

## 27. Hard delete & R2 lifecycle 🛠 admin only

**Files.** [`app/atelier/works/actions.ts`](../app/atelier/works/actions.ts), `r2SoftDelete()`, [`lib/storage-object-ledger.ts`](../lib/storage-object-ledger.ts).

### 27.1 `purgeWorkPermanently(oid)`

**Gate.** `requireAdmin()`.

**Chain.**
1. Delete `tblrelations` where `source_id = oid OR target_id = oid` (your edges to/from the work).
2. Service-role delete `oeuvre_theme` for `oeuvre_id = oid`.
3. `deleteAllImagesForOeuvres(supabase, [oid])`:
   a. Select all `tblImage.txtImageNameLink` for the work.
   b. Delete `tblImage` rows.
   c. For each, `r2SoftDelete(filename)` + `r2SoftDelete('thumbs/' + filename.avif)`.
4. Delete the `Oeuvres` row.
5. `revalidatePath('/atelier')`.

> **Don't:** purge a work mid-broadcast. Clear the queue first (§25.4).

> **Don't:** purge a work that's part of an active exhibition `suivi_etape` row — you'll orphan the etape.

> **Use case:** test data, accidental duplicate, GDPR erase request.

### 27.2 `deleteWorkImage(...)` — single image hard delete

Removes `tblImage` row + soft-deletes the R2 original + thumb.

### 27.3 `r2SoftDelete(filename)`

Implementation (paraphrased):
1. Copy `paintings/<filename>` to `recycle/<YYYY-MM-DD>/paintings/<filename>` (and thumb to `recycle/<date>/thumbs/<thumbname>`).
2. Delete the original.
3. Record in `storage_object_ledger` with classification = `recycle`.

### 27.4 `storage_object_ledger` classifications

| Classification | Meaning |
|----------------|---------|
| `recycle` | Soft-deleted; lifecycle TTL 90 d. |
| `ledger` | System ledger screenshot; lifecycle TTL 30 d. |
| (others) | As needed. |

### 27.5 Cloudflare R2 lifecycle (you configure once in the dashboard)

| Prefix | Action | After |
|--------|--------|-------|
| `recycle/` | Delete | **90 days** |
| `ledger/` | Delete | **30 days** |
| `daily/` (backups bucket) | Delete | **90 days** |
| `weekly/` (backups bucket, optional) | Delete | **365 days** |

### 27.6 Do / Don't

> **Do:** prefer soft-delete (`deleteWork`) for almost everything. Purge is for things you genuinely never want back.

> **Don't:** rely on the `recycle/` window past 90 d. Recovery is impossible after that.

> **Do:** if a single image got mistakenly deleted, re-upload from the original source — `recycle/` recovery requires R2 dashboard manual ops.

---

## 28. Contact privacy & conflict queue 🔒

**Files.** [`app/atelier/(portal)/contacts/actions.ts`](../app/atelier/(portal)/contacts/actions.ts), [`conflicts-actions.ts`](../app/atelier/(portal)/contacts/conflicts-actions.ts).

### 28.1 `Contact.is_private`

Default RLS for team `INSERT` allows `is_private = false` only — i.e. team can create public contacts but not private ones.

Service-role inserts (admin paths) **bypass RLS** so you can create private contacts (e.g. confidential collector).

### 28.2 Google CSV import — auto-private

`importGoogleContacts(contacts)` uses the **service client** to insert all imported contacts with `is_private = true` by default. Defensive choice: imported contacts haven't been vetted yet; you decide later whether to flip them public.

### 28.3 `contact_conflicts` table + `fetchContactConflicts()`

Lists unresolved rows (`resolved = false`) with FK-joined public/private contact pairs.

UI surface: Overview "Conflict queue" card + Contacts tab conflict resolver.

### 28.4 `mergeContacts(fromId, toId)` flow

Junction migration semantics:
- Update every `Oeuvres.ContactID`/`AcheteurID` reference from `fromId` → `toId`.
- Same for `contact_emails`, `contact_phones`, `contact_addresses`, `contact_websites`.
- Mark `contact_conflicts` row `resolved = true`.
- Delete or archive the `fromId` row.

### 28.5 Do / Don't

> **Do:** dry-run by reading the linked-works list for both contacts before merging. If you're unsure, leave them and use `Notes` to explain.

> **Don't:** merge a private contact into a public one without confirming the merged contact's privacy flag — the public flag wins.

> **Pitfall:** a merge that crashes mid-way may leave orphan junction rows. Re-run the merge or use the dedicated `mergeContacts` server action which is transactional.

---

## 29. CSV graph export — `GET /api/export/csv` — ✓ Live 🔒

**File.** [`app/api/export/csv/route.ts`](../app/api/export/csv/route.ts).

### 29.1 Surfaces

| Source | Action |
|--------|--------|
| Pivot Atlas → **Entités** button | Hits `?view=entity`. |
| Pivot Atlas → **Arêtes** button | Hits `?view=edge_fact`. |
| Direct URL | Same. |

### 29.2 Auth

`requireAdminExport()` checks auth user + `is_admin()` RPC. Returns 401 / 403 accordingly.

### 29.3 Behaviour

- Streaming response — paginated 500 rows/page from the underlying view (`entity` or `edge_fact`).
- UTF-8 BOM prefix (`﻿`).
- CRLF line endings.
- Filename: `pem_{view}_{YYYY-MM-DD}.csv`.
- `Cache-Control: no-store`.

### 29.4 Use cases

- External graph analytics (Gephi, Neo4j load).
- Periodic graph backup (`scripts/backup-graph-csv.sh`).
- Audit / handoff to a curator.

> **Pitfall:** the CSV uses **server-side view definitions** (`resolveGraphCsvView`). If a column was renamed in the DB without updating the view, the export breaks. Re-run `npm run gen:types` and align.

---

## 30. Studio Bible regeneration 🔒

The Studio Bible is a periodic narrative PDF: architecture, contracts, decisions. Stored in `vault` with `document.kind = 'bible'`. Public-readable via `/Atelier_Studio_Bible.pdf` (signed-URL redirect).

### 30.1 Trigger

- Atelier → **Vault** → "Open Studio Bible" (read).
- Atelier → **System** → "Regenerate Bible" (admin only).
- Command palette → `Regenerate Bible` (admin only).

### 30.2 What it produces

A new `document` row with `kind = 'bible'`; the old one is superseded but not deleted (you have versions).

### 30.3 Public consumption

`/Atelier_Studio_Bible.pdf` redirects to a short-lived signed URL for the latest `bible` document.

### 30.4 Do / Don't

> **Do:** regenerate after major doc syncs (route changes, slice completion, big architecture shifts).

> **Don't:** regenerate during active edits — the narrative will lock to that moment-in-time.

---

## 31. System tab admin actions 🔒

**File.** [`app/atelier/(portal)/system/actions.ts`](../app/atelier/(portal)/system/actions.ts).

### 31.1 `deleteStudioTask(id)` — admin only

**Gate.** Auth + `is_admin()`.

**Effect.** `DELETE FROM studio_task WHERE id = <id>`.

**Failure codes.** `not_authenticated`, `admin_required`, `delete_failed` (with `message`).

### 31.2 Manual log entry (`event_type = null`)

Team-callable. Manual entries are **prune-protected** by `audit_log_prune()`. Use for incidents, narrative notes, "we discussed this on the phone".

### 31.3 Ledger attachment upload — R2 `ledger/*`

`uploadLedgerAttachment` ([`app/atelier/system/ledger-attachment-actions.ts`](../app/atelier/system/ledger-attachment-actions.ts)). Team can upload. Metadata in `system_log.attachments` as `{ key }[]`.

Lifecycle: **30 days**. UI tolerates expired keys.

### 31.4 Do / Don't

> **Do:** when a tricky incident drops, screenshot → upload → manual log entry with a paragraph of context.

> **Don't:** rely on attachments past 30 d. Save the important ones elsewhere.

---

## 32. Backups & disaster recovery

See [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) for the full operator playbook. Summary:

### 32.1 Daily pg_dump → R2 `art-db-backups`

- Workflow [`.github/workflows/backup.yml`](../.github/workflows/backup.yml).
- Cron `17 3 * * *` UTC.
- Full schema + data, gzipped, `daily/art-db-<ISO>.sql.gz`.
- Excludes `pg_*` and `information_schema`.

### 32.2 boto3 + EU endpoint only

`https://<account>.eu.r2.cloudflarestorage.com`. **Don't** try rclone or AWS CLI — they fail on R2 sigv4 nuances (memory `project_phase_e_backup`).

### 32.3 Audit prune — weekly cron

`supabase/sql/audit_log_ttl.sql` defines `audit_log_prune()`. Scheduled via [`.github/workflows/audit-prune.yml`](../.github/workflows/audit-prune.yml).

**Never auto-deletes:**
- Manual `system_log` entries (`event_type IS NULL`).
- Error broadcast events (`broadcast_events.priority = 'vip'` or `event_type LIKE '%error%'`).

### 32.4 R2 lifecycle config (Cloudflare dashboard)

| Prefix | TTL |
|--------|-----|
| `recycle/` | 90 d |
| `ledger/` | 30 d |
| `daily/` (backups) | 90 d |
| `weekly/` (backups, optional) | 365 d |

### 32.5 Graph CSV weekly backup (Slice 7 Phase 2)

Workflow [`.github/workflows/graph-csv-backup.yml`](../.github/workflows/graph-csv-backup.yml). Sundays 04:30 UTC. Uploads `weekly/pem_entity_<date>.csv` and `weekly/pem_edge_fact_<date>.csv` using the same secrets as the daily dump.

### 32.6 Recovery drill schedule

Once per quarter, do steps 1–5 of "full restore" into a throwaway project. A backup you never test is wishful thinking.

---

## 33. RLS & permissions cheat sheet

### 33.1 `is_admin()` RPC (SECURITY DEFINER)

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Contact"
    WHERE auth_user_id = (select auth.uid())
      AND is_admin = true
  );
$$;
```

### 33.2 `is_team()` RPC

Equivalent for team membership (Contact row with `is_team = true`).

### 33.3 Tables gated by `is_admin()`

| Table | Operations |
|-------|------------|
| `oeuvre_broadcasts` | SELECT / UPDATE / DELETE |
| `broadcast_events` | SELECT (admin or team for read) |
| `oeuvre_versions` | SELECT |
| `pending_changes` | UPDATE / DELETE |

### 33.4 Tables gated by `author_id = auth.uid() OR is_admin()`

| Table | Operations |
|-------|------------|
| `pending_changes` | SELECT — author can see their own queue too |

### 33.5 `work_session` team_select

Any `is_team()` user can read all sessions. Writes are session-owner or admin.

### 33.6 `Contact.is_private`

Team `INSERT` restricted to `is_private = false`. Admin imports use service-role to bypass.

### 33.7 Grant audit

After any DDL change, run [`supabase/sql/grant_audit_queries.sql`](../supabase/sql/grant_audit_queries.sql) to confirm `GRANT`s for `authenticated`, `anon`. Missing grant → 42501 despite RLS. (CLAUDE.md rule.)

### 33.8 Tables intentionally service-role only

Document in the migration comment. Don't widen the grant.

---

## 34. Calendar OAuth admin notes

**Files.** [`app/api/calendar/google/callback/route.ts`](../app/api/calendar/google/callback/route.ts), [`microsoft/callback/route.ts`](../app/api/calendar/microsoft/callback/route.ts).

### 34.1 `calendar_account` table

| Column | Purpose |
|--------|---------|
| user_id | Owner. |
| provider | `google` / `microsoft`. |
| refresh_token (encrypted) | Encrypted via `CALENDAR_TOKEN_ENCRYPTION_KEY`. |
| state secret | `CALENDAR_OAUTH_STATE_SECRET`. |
| connected_at | Timestamp. |

### 34.2 Required env

| Env | Notes |
|-----|-------|
| `NEXT_PUBLIC_SITE_URL` (or `NEXT_PUBLIC_APP_URL`) | No trailing slash. Used as the OAuth redirect base. |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Symmetric key for refresh-token encryption. |
| `CALENDAR_OAUTH_STATE_SECRET` | HMAC of OAuth state param. |
| `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` | Google OAuth credentials. |
| `MICROSOFT_CALENDAR_CLIENT_ID` / `MICROSOFT_CALENDAR_CLIENT_SECRET` | Microsoft OAuth credentials. |
| `MICROSOFT_CALENDAR_TENANT` | Microsoft tenant ID. |

### 34.3 Per-user connection

Each operator connects **their own** calendar. Tokens are not shared. Disconnecting clears the row.

### 34.4 Pitfall — bouncing to production

If `NEXT_PUBLIC_SITE_URL` is wrong (trailing slash mismatch, http/https typo), Google bounces back to production and you sign in there instead. Verify the env on deploy.

---

## 35. Admin troubleshooting

| Problem | Diagnose |
|---------|----------|
| Pending queue grows fast | Bulk approve via Audit; consider whether the team is hitting a misconfigured field that should bypass the queue (probably not — talk to them first). |
| Broadcast queue stuck | Check `broadcast_events` for worker errors; `clearStuckQueue(oeuvreId, platform)` per stuck pair. |
| Version restore fails | Check service-role client credentials; check `oeuvre_versions` row exists (`versionId` valid). |
| R2 recycle not pruning | Cloudflare console → bucket → Lifecycle rules → confirm `recycle/` rule active with TTL 90 d. |
| `ledger/` attachments 404 on old logs | Expected past 30 d (lifecycle). |
| Audit prune workflow failed | Trigger manually: `psql -c 'select audit_log_prune();'`. |
| Daily backup workflow failed | Check repo secrets (`SUPABASE_DB_URL`, `R2_BACKUP_*`); run workflow_dispatch. |
| Studio Bible can't open from `/Atelier_Studio_Bible.pdf` | Signed URL expired; reload (route generates fresh URL). |
| Pivot Atlas CSV 403 | `is_admin()` check failed; check your Contact row has `is_admin = true` linked to `auth_user_id`. |
| Conflict queue empty but you know there are duplicates | `contact_conflicts.resolved = true` for those rows; manually re-flag or merge from Contacts tab. |
| Session day shows two sessions | They'll consolidate to one canonical row on next reload (Europe/Paris); refresh Journal. |
| Image deletion left R2 file | The `tblImage` row was deleted but `r2SoftDelete` errored. Check `storage_object_ledger` for the row; manually move via Cloudflare dashboard. |
| Approving a pending change errors with RLS | The team member's edit references a row your service-role can see but the regular client can't. Check the work isn't archived/private to an unrelated owner. |

---

## 36. Glossary (admin terms)

| Term | Meaning |
|------|---------|
| `pending_changes.payload` | JSON allow-listed snapshot of FormData keys. Filtered on replay. |
| `pending_changes.baseline` | Snapshot of the `Oeuvres` row at submission. |
| `oeuvre_versions` | Snapshot table; trigger writes OLD on every `Oeuvres` UPDATE. |
| `oeuvre_broadcasts` | Per-(work, platform) broadcast queue row. |
| `broadcast_events` | VIP / standard activity log for broadcast pipeline. |
| `audit_log_prune()` | Weekly cron. Never deletes manual or error rows. |
| `r2SoftDelete(filename)` | Copies to `recycle/<date>/`, deletes original, stamps ledger. |
| `storage_object_ledger` | Audit row per R2 mutation. `classification` distinguishes recycle/ledger. |
| service-role client | `createServiceClient()`. Bypasses RLS. Use sparingly; admin paths only. |
| `is_admin()` / `is_team()` | RPCs (SECURITY DEFINER) checking `Contact` membership. |
| `__skip_review = '1'` | FormData flag on `saveWork()` to bypass team-gate check during admin replay. |
| `INVENTORY_BROADCAST_SECRET` | Bearer token for the broadcast HTTP chain. |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Symmetric key for calendar refresh-token encryption. |
| `CRON_SECRET` | Bearer for `/api/cron/return-window`. |
| `clearStuckQueue` | Admin action to delete queued (not posted) `oeuvre_broadcasts` rows. |
| `restoreOeuvreVersion(versionId)` | Service-role rewrite of `Oeuvres` from a snapshot row. |
| `purgeWorkPermanently(oid)` | Hard delete + R2 soft-delete chain. |
| `contact_conflicts` | Detected duplicate pairs awaiting admin merge. |
| `consolidateSessionsForCalendarDay` | Merges multiple work_session rows per Europe/Paris day. |

---

## 37. Public site & partner portals

The public site is downstream of Atelier config. As admin you control both ends — the config and the public render — so you can break things from either side. This chapter covers every public route, the auth gates on partner portals, and the SEO surfaces. Many surfaces here use the **service-role client** (`createServiceClient()`) — pay attention to where that line lives.

### 37.1 Public surfaces at a glance

| URL | Visible | Indexable? | Login? | Auth model |
|-----|---------|:---:|:---:|------------|
| `/` | public | ✓ | — | Server metadata; portfolio config from R2. |
| `/works` | public | ✓ | — | Anon read; `is_public = true` filter. |
| `/practice` | public | ✓ | — | Static / config. |
| `/about` | public | ✓ | — | Static / config. |
| `/enquiry` | public | ✓ | — | Anon insert to `inquiry` table. |
| `/verify/[certId]` | public | — | — | **Service-role only.** Requires `SUPABASE_SERVICE_ROLE_KEY`. |
| `/card` | public | ✗ `noindex` | — | Static printable; QR via `qrserver.com`. |
| `/c/[token]` | public | ✗ `noindex` | — | **Service-role only.** Token in `private_link` table. |
| `/collection/[collector_id]` | partner | ✗ `noindex` | ✓ | `Contact.auth_user_id = auth.uid()` AND `ContactID = collector_id`. |
| `/galerie/[gallery_id]` | partner | ✗ `noindex` | ✓ | Same + `Contact.Role = 'gallery'`. |
| `/maps` | team | ✗ | ✓ | Standard auth. |
| `/robots.txt` | public | — | — | Static. |
| `/sitemap.xml` | public | — | — | Static. |
| `/manifest.webmanifest` | public | — | — | PWA manifest; declares share target. |
| `/Atelier_Studio_Bible.pdf` | public | — | — | Redirect to signed URL for latest `document.kind = 'bible'`. |

### 37.2 Landing `/` — ✓ Live

**File.** [`app/page.tsx`](../app/page.tsx) → [`components/public/LandingPage.tsx`](../components/public/LandingPage.tsx).

- `generateMetadata()` loads portfolio sections (R2-cached), resolves hero image + artist name. Indexable, OG + Twitter.
- Body renders orbits + WavingCircle + nav drawer with `hiddenNavRoutes` + `navOrder` from `config.site_blocks[]`.
- Visitor tracking: `trackView('/', referrer, null, visitorId)` on mount.
- Optional `LandingPdfPopup` modal opens when `config.landing.pdf_popup` is configured.

**Env touched:** `NEXT_PUBLIC_SITE_URL` (or `NEXT_PUBLIC_APP_URL`) drives `getMetadataBase()`. Any mismatch breaks OG image URLs.

> **Do:** sanity-check landing OG card via a sharing-debugger (Twitter / LinkedIn) after large config changes.

> **Don't:** rely on `LANDING_HERO_IMAGE_URL` default — set `config.landing.hero_image_url` explicitly so the OG image is what you want.

### 37.3 Public works `/works` — ✓ Live

**File.** [`app/works/page.tsx`](../app/works/page.tsx) → `WorksClient`.

Renders modes / collections from R2-cached portfolio config. Public works filter:
- `deleted_at IS NULL`
- `is_public = true` (synced via trigger from `status_id ∈ STATUS_IDS_PUBLIC = {2, 4, 6, 7, 8, 11}`)
- `anonymity_level` controls render redaction; admin can override via `admin_override_anonymity`.

`manual_work_order[]` per collection overrides theme default order.

Bilingual: `?lang=fr|en` (also `<link rel="alternate" hreflang>` in metadata).

> **Pitfall — work missing from /works after edit.** Most likely: status_id moved out of `STATUS_IDS_PUBLIC`, or `anonymity_level` increased. Check `Oeuvres.is_public` directly — the trigger should reconcile, but if it didn't (rare), re-saving the work re-fires it.

### 37.4 Practice `/practice` and About `/about` — ✓ Live

Static-from-config pages. Copy comes through `useI18n().t(key)` + the dictionary + portfolio config slices.

### 37.5 Enquiry `/enquiry` — ✓ Live

**Files.** [`app/enquiry/page.tsx`](../app/enquiry/page.tsx), [`components/public/EnquiryClient.tsx`](../components/public/EnquiryClient.tsx).

Anon insert into `inquiry` table (`name`, `email`, `message`, `category`, `status = 'open'`, optional `oeuvre_id`, optional `sale_order_id`).

URL params:
- `?oeuvre_id=<int>` — pre-fills the inquiry with a work reference.
- `?sale_order_id=<id>` — pre-fills the inquiry with a sale order reference (after-sales routing).

> **Admin note — RLS on `inquiry`.** Anon `INSERT` is granted by policy; `SELECT` is team-only. Check via `supabase/sql/grant_audit_queries.sql` after any DDL change.

> **Pitfall:** if `inquiry` inserts 401 / 42501, you forgot to grant anon `INSERT` after a schema change. The form silently fails — verify via the Supabase logs.

### 37.6 Verify `/verify/[certId]` — ✓ Live (QR target, service-role)

**Files.** [`app/verify/[certId]/page.tsx`](../app/verify/[certId]/page.tsx), [`lib/coa-verify.ts`](../lib/coa-verify.ts).

Server component. Reads `document` (kind = `coa`, matching `cert_id`) + `Oeuvres` + `Technique` + `Support` via **service-role**.

Verification chain:
1. Regex `^PEM-(\d+)-[A-Z0-9]+$` — `invalid_id` if not matched.
2. Env check `SUPABASE_SERVICE_ROLE_KEY` — `config` if missing.
3. Look up document row — `not_found` if absent.
4. Look up `Oeuvres` row — `not_found` if absent.
5. Recompute hash from `certId | OeuvreID | Titre | Année | techLabel | dims` (SHA-256, joined by `|`).
6. Compare to `document.cert_hash` — `tampered` if mismatch.
7. `ok` — return cert ID, OeuvreID, title, year, issued date.

Cert ID format: `PEM-<OeuvreID>-<ALNUM_SUFFIX>` (matches `generateCOA` in [`vault/actions.ts`](../app/atelier/(portal)/vault/actions.ts)).

> **Admin do:** regenerate the COA whenever you edit a field that's part of the hash (Titre, Année, Technique, Support, dimensions). Otherwise the next scan returns `tampered`.

> **Don't:** purge a work whose COA is in circulation without thinking. Verify will then return `not_found` for that QR.

> **Pitfall:** the `tampered` outcome is signal, not necessarily fraud. Re-issue COA from Vault to refresh the hash.

### 37.7 Card `/card` — ✓ Live, `noindex`

**File.** [`app/card/page.tsx`](../app/card/page.tsx).

A4 sheet with front/back card pairs. Static. QR via `qrserver.com` API (no key). `PUBLIC_CONTACT_EMAIL` env feeds the rendered email.

> **Admin note:** if you rotate the public contact email, update the env var (`PUBLIC_CONTACT_EMAIL`) — the rendered card uses it directly.

### 37.8 Private selection `/c/[token]` — ✓ Live, `noindex`, service-role 🛠

**File.** [`app/c/[token]/page.tsx`](../app/c/[token]/page.tsx).

Service-role lookups (the file's header comment makes the rule explicit: never anon).

Flow:
1. Look up `private_link` by `token`. 404 if not found.
2. Check `expires_at`. 404 if past.
3. Update `viewed_at = now()` and `view_count += 1`.
4. Load `working_group_work` joined to `Oeuvres` for `link.group_id`, ordered by `position`.

`private_link` schema (key fields):

| Column | Notes |
|--------|-------|
| `token` | Unique. Should be cryptographically random, ≥ 24 chars. |
| `group_id` | FK to `working_group.id`. |
| `recipient_name` | Optional; rendered in header. |
| `expires_at` | Optional. |
| `viewed_at` | Last access. |
| `view_count` | Increments on each visit. |

There is **no UI surface to create private links today** — you mint rows in SQL or via a script. Future product: a Curation dock action "Send as private link".

> **Admin do:** when minting a `private_link` row, generate the token with `gen_random_uuid()` or `pgcrypto` `gen_random_bytes(24)` → hex.

> **Don't:** leave `expires_at` null on links you send to anyone outside your trusted circle.

> **Pitfall:** if the working group becomes empty after sharing (you removed members), recipients see an empty list. Either add a "frozen" flag in the future or be careful about group changes after sharing.

### 37.9 Collector portal `/collection/[collector_id]` — ✓ Live, login required

**File.** [`app/collection/[collector_id]/page.tsx`](../app/collection/[collector_id]/page.tsx) → `PortalLayout`.

Standard `createClient()` (anon + auth cookies). Auth:

1. `auth.getUser()` — 404 if not signed in.
2. `Contact` lookup: `auth_user_id = user.id AND ContactID = collector_id`. 404 if no match.
3. `Oeuvres` query: `AcheteurID = collector_id AND deleted_at IS NULL`, ordered desc by `Année`.

Renders via `PortalLayout` (title "Collection Privée", subtitle = collector name, works list).

> **Admin invite flow:**
> 1. Create a `Contact` row with the collector's email and `Actif = true`.
> 2. Send the collector a login link. They Google-OAuth.
> 3. Auth callback fires. You manually update `Contact.auth_user_id` to match `auth.uid()`.
> 4. Share `/collection/<their ContactID>`. It now resolves.

> **Don't:** mass-set `auth_user_id` without verifying email matches between Contact and the Supabase auth user.

> **Pitfall:** the portal only shows `AcheteurID` matches. If a collector also bought via a partner gallery and the gallery is the `AcheteurID`, the work won't appear in the collector's portal. Consider that when assigning ownership on sale.

### 37.10 Gallery portal `/galerie/[gallery_id]` — ✓ Live, login required

**File.** [`app/galerie/[gallery_id]/page.tsx`](../app/galerie/[gallery_id]/page.tsx) → `PortalLayout`.

Standard `createClient()`. Auth:

1. `auth.getUser()` — 404 if not signed in.
2. `Contact` lookup: `auth_user_id = user.id AND ContactID = gallery_id AND Role = 'gallery'`. 404 otherwise.
3. `consignment` rows: `gallery_contact_id = gallery_id AND ended_at IS NULL`, joined to `Oeuvres`. Ordered desc by `since`.

> **Admin do:** set `Contact.Role = 'gallery'` on partner gallery contacts. Without it the portal 404s even with valid auth_user_id.

> **Don't:** ship a work to a gallery without creating the `consignment` row — the portal won't show it.

> **Pitfall:** ending a consignment (`ended_at = now()`) hides the work from the gallery portal immediately. Use thoughtfully; perhaps a "preview before mark ended" UX would help.

### 37.11 SEO — `/sitemap.xml`, `/robots.txt`

**Files.** [`app/sitemap.ts`](../app/sitemap.ts), [`app/robots.ts`](../app/robots.ts).

Sitemap: only `/`, `/works`, `/about`, `/practice`, `/enquiry`. Robots disallows `/atelier`, `/hub`, `/galerie`, `/collection`, `/maps`, `/login`, `/card`, `/c/`, `/api/`, `/auth`, `/_next/`.

> **Admin do:** if you add a public route, edit `sitemap.ts` (allow-list new path) and consider whether `robots.ts` needs updating.

### 37.12 PWA manifest — `/manifest.webmanifest` + static mirror

**Files.** [`app/manifest.ts`](../app/manifest.ts), [`public/manifest.webmanifest`](../public/manifest.webmanifest).

Keep both in sync. Notable:

- `start_url`: `/hub`.
- `icons`: 192 / 512.
- `share_target`: POST to `/atelier/share-receive`, fields `title`, `text`, `url`, files.
- Apple touch icon: `/pwa-icon-180.png` ([`app/layout.tsx`](../app/layout.tsx)).

> **Admin pitfall:** iOS caches manifests aggressively. To test a manifest change on iPhone, delete the PWA from Home Screen + reinstall.

### 37.13 Studio Bible redirect `/Atelier_Studio_Bible.pdf`

Server-side route that 302/307s to a **short-lived signed URL** for the latest `document.kind = 'bible'` in the vault.

Used by:
- External shares (publicly stable URL).
- Atelier → Vault "Open Studio Bible" button.
- Atelier → System "Open Studio Bible" link.

Regen flow: §30.

### 37.14 How Atelier config drives the public site

| Atelier tab | Config slice | Public surface affected |
|-------------|--------------|--------------------------|
| Site | `site_blocks[]`, `general.*` | `/`, nav drawer, all public meta |
| Portfolio | `sections`, `works_modes[].collections`, `manual_work_order` | `/works`, PDF portfolio |
| Analytics | tracking config | `trackView()` payloads |
| Vault | `document.kind = 'bible'` | `/Atelier_Studio_Bible.pdf` redirect target |

Cached via `loadPortfolioSectionsFromR2` + `cache()`. Edits trigger `revalidatePath()` of `/`, `/works`, etc. Force a hard reload if stale.

### 37.15 Visitor tracking

| Helper | What |
|--------|------|
| `getOrCreatePublicVisitorId()` | Persistent visitor id (cookie / localStorage). |
| `trackView(path, referrer, oeuvreId, visitorId)` | Inserts a view event row. |
| Atelier → Analytics | Aggregates events. |

> **Admin compliance note:** visitor id is pseudonymous but persistent. Disclose in your privacy notice. EU GDPR requires consent for non-essential tracking — review whether `trackView` is necessary or analytical.

### 37.16 Admin Do's / Don'ts / Pitfalls — chapter summary

> **Do:** treat `STATUS_IDS_PUBLIC` and the `is_public` trigger as load-bearing. Any change there can suddenly publish or unpublish many works at once.

> **Do:** after editing a field that's part of the COA hash (title, year, technique, support, dims), regenerate the COA so `/verify/<certId>` stays green.

> **Do:** maintain `auth_user_id` on partner contacts. The portals are useless without it.

> **Don't:** edit the i18n dictionary to change public copy — use Site / Portfolio config instead. Dictionary edits affect more than just one page.

> **Don't:** purge a work whose COA is in the wild. The QR will resolve to `not_found`.

> **Pitfall — service-role files.** `/verify/[certId]` and `/c/[token]` both use service-role. If you accidentally swap to anon, you'll see RLS-shaped 404s (the queries return null). Read the header comments before refactoring those files.

> **Pitfall — manual_work_order gaps.** Soft-deleting a work doesn't remove it from collection `manual_work_order` arrays. Periodically audit (or build a future cleanup helper).

---

## 38. Optional reading + engineer handoffs

| Doc | For |
|-----|-----|
| [`TEAM_MEMBER_GUIDE.md`](./TEAM_MEMBER_GUIDE.md) | Team's-eye view of the same surfaces. Useful for explaining a feature to a teammate. |
| [`CONSTELLATION.md`](./CONSTELLATION.md) | Constellation curator contract. |
| [`BROADCAST.md`](./BROADCAST.md) + [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) | Broadcast pipeline + Make scenarios. |
| [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) | Backup playbook. |
| [`PROJECT_SYNTHESIS.md`](./PROJECT_SYNTHESIS.md) | Stack overview. |
| [`SITE_MAP.md`](../SITE_MAP.md) | Engineer route index + RSC loaders. |
| [`SYSTEM_LEDGER.md`](./SYSTEM_LEDGER.md) | System tab's MD source. |
| `docs/archive/HANDOFF_*.md` | Slice handoffs (Slice 3, 3B, 4, etc.). |
| [`CLAUDE.md`](../CLAUDE.md) | Hard rules + workflow discipline. |

— end —
