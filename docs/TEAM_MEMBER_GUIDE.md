# PEM Studio — Team Member Guide (Encyclopedia)

**Audience.** You are a **team member** (signed in, `is_team()` returns `true`) — not an admin. This guide covers **every** team-accessible function in Hub and Atelier as of the 2025–2026 release: every field, every button, every query parameter, every keyboard shortcut, every saved state, every pitfall.

**Companion guide.** [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) covers admin-only chapters (Audit, Broadcast, version restore, hard purge, conflict queue, field session capture). Read that one if you have admin rights.

**Engineer references.** Routes, RSC loaders, hooks: [`SITE_MAP.md`](../SITE_MAP.md). Project synthesis: [`PROJECT_SYNTHESIS.md`](./PROJECT_SYNTHESIS.md).

---

## 1. How to use this guide

### 1.1 Status badges

Every feature is tagged so you know what to expect.

| Badge | Meaning |
|-------|---------|
| ✓ Live | Production, verified. Works on phone and desktop. |
| β Beta | Works, but rough — expect missing polish or edge cases. |
| ▲ Stub | Placeholder page. UI exists but the workflow is not finished. Use the linked alternative. |
| ⚠ Admin-blocked | Button may appear in the UI; the server rejects with an admin-only error. |
| 🔒 Admin only | Tab or section hidden from you entirely. |

### 1.2 Conventions

- **FR / EN.** App labels are bilingual. This guide shows the French label first when the UI surface is French-first (e.g. `Inventaire / Inventory`, `Vue d'ensemble / Overview`). Inline you switch via the **FR / EN** toggle in the header (desktop) or the public site banner.
- **Tables** show fields/controls; the **callouts** below each table explain how to use them.
- **Callouts** are the most important part of each chapter:
  - **Do:** what you should do, and why.
  - **Don't:** what to avoid, and what breaks if you do.
  - **Use case:** real scenario where the feature shines.
  - **Advanced:** hidden modes, query parameters, side effects, keyboard shortcuts.
  - **Pitfall:** exact gotcha + how to recover.

### 1.3 Install on phone

iOS Safari (or Chrome) → open the app on the production URL → **Share** → **Add to Home Screen**. The PWA opens at `/hub` and registers as a **Share target**: from Lightroom or Photos, you can pick **PEM Hub** in the Share Sheet to import images directly into Atelier.

### 1.4 Where help lives

- This guide — exhaustive.
- [`CONSTELLATION.md`](./CONSTELLATION.md) — Constellation canvas curator contract.
- [`BROADCAST.md`](./BROADCAST.md) + [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) — broadcast pipeline (admin operator).
- [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) — backup playbook.
- **System tab → Reference** — copy the live `SYSTEM_LEDGER.md` from inside Atelier.
- **Studio Bible** — the latest narrative architecture PDF (Vault tab).

---

## 2. Team vs admin — what you can and can't do

| Capability | Team | Admin |
|------------|:----:|:----:|
| Read every tab (except 🔒) | ✓ | ✓ |
| Open & filter Inventory, Reports, Themes, Map, Pipeline, Sales | ✓ | ✓ |
| Create a new work (`/atelier/works/new`) — **immediate save** | ✓ | ✓ |
| Edit an existing work in the drawer — **goes to pending queue** for review | ✓ | — (saves immediately) |
| Batch edit selection — applies **immediately** | ✓ | ✓ |
| Theme / working-group junction edits | ✓ | ✓ |
| Constellation edge edits | ✓ | ✓ |
| Soft-delete a work (8-second Undo toast) | ✓ | ✓ |
| Permanently purge a work (`purgeWorkPermanently`) | ⚠ | ✓ |
| Delete a work image | ⚠ | ✓ |
| Restore old work version (`oeuvre_versions`) | 🔒 | ✓ |
| Open `Audit` tab (`/atelier/audit`) | 🔒 | ✓ |
| Open `Broadcast` tab (`/atelier/broadcast`) | 🔒 | ✓ |
| Approve someone else's pending edit | 🔒 | ✓ |
| Full field session capture (`/atelier/session/new`) | β read-only review | ✓ full multi-shot + apply |
| Pivot Atlas CSV download (Entités / Arêtes) | 🔒 | ✓ |
| Regenerate Studio Bible | ⚠ | ✓ |
| Set `Contact.is_private = true` | 🔒 | ✓ |
| Overview "Contact conflict" queue | 🔒 | ✓ |
| Connect your own Google / Microsoft calendar | ✓ | ✓ |
| Read the System Ledger MD + download QA checklist PDF | ✓ | ✓ |
| Upload screenshot to System ledger (`ledger/*` R2) | ✓ | ✓ |
| Manual entry in `system_log` | ✓ | ✓ |
| Delete a `studio_task` (Hub pulse) | 🔒 | ✓ |

> **Why the gating exists.** `Oeuvres` rows are the canonical history of every artwork. Most existing-work edits go through **`pending_changes`** so two team members can't silently overwrite each other and so the admin sees the change before it lands. New works skip the queue because nothing is at risk yet. Batch edit also skips the queue — it's already an explicit multi-select action by the operator. The allow-list of pending-able fields lives in [`lib/work-pending-keys.ts`](../lib/work-pending-keys.ts) and is mirrored in §19 of this guide.

> **What "admin-blocked" really means.** ⚠ buttons may render — you might see "Delete image" in the work drawer even though the server will reject. This is intentional defense in depth: RLS plus runtime check plus UI hint. If a click 403s, the toast tells you to ask the admin. You won't break anything by trying.

---

## 3. Sign-in, sessions, devices

### 3.1 Sign-in surfaces — ✓ Live

| URL | Use |
|-----|-----|
| `/login` | Google OAuth. `?next=` returns you to the deep-linked page after login. |
| `/auth/callback` | OAuth handler. You never visit directly. |

### 3.2 Phone / LAN dev access

For local-network testing, [`scripts/dev.ps1`](../scripts/dev.ps1) prints both `Local : http://localhost:3000` and `Phone : http://<LAN-IP>:3000`. Open the **LAN URL** on the phone — but be aware:

- **Don't** use Google OAuth on `192.168.*` unless that exact host is in your Supabase Auth redirect allow-list — it bounces back to production.
- Use the `DEV_AUTO_LOGIN_*` env vars in `.env.local` to skip OAuth for dev. **Use your real PEM account email** for `DEV_AUTO_LOGIN_EMAIL` (with a dev password set on that Supabase user) so the field session journal shows the same `work_session` rows you'd see in prod.
- A separate `dev@…` user only sees its own (often empty) drafts.

> **Pitfall:** A team-member-created `work_session` is visible to all teammates via RLS policy `work_session_team_select`. If the journal looks empty, either (a) RLS migration `supabase/sql/work_session_team_read.sql` was never applied to the project DB, or (b) you're signed in as a non-team account.

### 3.3 PWA install — ✓ Live

| Platform | Steps |
|----------|-------|
| iOS Safari | Open production URL → Share → **Add to Home Screen** → name "PEM Hub" |
| Android Chrome | Three-dot menu → **Install app** |
| Desktop Chrome / Edge | Address bar install icon |

After install:
- App opens at `/hub` (manifest `start_url`).
- iOS home-screen icon comes from `/pwa-icon-180.png` (180×180).
- **Share target** is registered: the OS Share Sheet shows **PEM Hub** as a destination.

### 3.4 Sign-out

Header → user menu → **Sign out**. Clears Supabase session cookies and the persistent shell state. Returns to `/login`.

> **Do:** sign out before lending the phone to anyone.
> **Don't:** rely on browser private mode — the PWA does not respect it on iOS; the session lives in the same cookie jar.

---

## 4. Navigation & global chrome

### 4.1 Entry points

| URL | When to use |
|-----|-------------|
| `/hub` | Phone launcher. Field verbs + field pulse + Studio room tiles. |
| `/atelier/overview` | Default desktop landing. |
| `/atelier/<tab>` | Every tab has its own bookmarkable segment route. |
| `/atelier?tab=<id>` | Legacy. **308 redirects** to `/atelier/<id>` keeping every other query param ([`lib/atelier/tab-routes.ts`](../lib/atelier/tab-routes.ts)). |

The full segment-route table is in §10–§15. The 25 tabs live under `/atelier/<tab>` segments.

### 4.2 Sidebar — 6 groups, same order on phone and desktop

1. **Terrain / Field** — `inventory` → `production` → `stock-take` → `notes` → `map` *(narrow ordering specifically optimised for phone)*
2. **Studio** — `overview`, `pipeline`, `exhibitions`, `concepts`
3. **Catalogue** — `reports`, `themes`, `stock` (suppliers), `constellation`
4. **Commercial** — `sales`, `logistics`, `fiscal`, `vault`
5. **Public** — `site`, `portfolio`, `analytics`
6. **Admin** — `contacts`, `system` *(plus `audit` and `broadcast` 🔒 for admins)*

On phone, tap **☰** to open the sidebar. The header always shows the active tab title.

### 4.3 Header (every tab)

| Control | What it does |
|---------|---------------|
| **Hub** link | Back to `/hub`. If the work drawer has unsaved changes, triggers the unsaved guard first. |
| **Catalogue badge** | Shows **loaded** count vs **total** in DB when the catalogue is paged. Tap to load more. |
| **⌘K / Ctrl+K** | Opens the **Command palette** (see §5). |
| **New work** (desktop only) | Jumps to `/atelier/works/new`. |
| **Reports / System** shortcuts (desktop) | Tab jumps. |
| **FR / EN** | Language toggle. Persists in session. |
| **Subset banner** (Inventory) | "Showing X of Y" + **Load next batch**. |

### 4.4 Catalogue batches — important for every tab

Why this matters: every tab's stats (Overview cards, Reports, Themes mosaic counts, Portfolio sections) read from the **loaded works only**.

- First load: **one chunk** of works + **exact total count** from `Oeuvres`.
- Tap **Load next batch** (top strip or bottom paging bar) to fetch more.
- Subset notices appear with these `data-testid` markers when partial: `atelier-oeuvres-subset-banner`, `atelier-overview-subset-caption`, `reports-subset-note`, `atelier-themes-subset-note`, `atelier-portfolio-subset-note`.

> **Do:** load every batch before exporting a report or generating a portfolio PDF if you need the full catalogue. The subset banner is your warning that "5 works in 2023" might really mean "5 of the 50 in 2023".

> **Don't:** assume Overview's "Works this year" matches an external spreadsheet unless the catalogue badge says you've loaded everything.

> **Pitfall:** the persistent shell keeps your loaded batch in memory across tab switches. If you reload the page (Ctrl-R), the batch resets to the first chunk.

### 4.5 Deep links table

| Query param | Where | Effect | Cleaned from URL? |
|-------------|--------|--------|--------------------|
| `?work=<OeuvreID>` | any portal tab | Opens the work drawer for that work. | ✓ stripped after open |
| `?exhibition=<process_id>` | `/atelier/exhibitions` | Selects that exposition project. | ✓ |
| `?map=<uuid>` | `/atelier/constellation` (canonical) or bare `/atelier?map=` | Loads cloud constellation map in frozen mode. | ✓ |
| `?contact=<ContactID>` | `/atelier/contacts` | Opens contact editor. | ✓ |
| `?inbox=<uuid>` | `/atelier/share-triage` | Selects inbox row detail. | — (kept for navigation) |
| `?calendar=google_ok` / `microsoft_ok` / `*_err` | `/atelier/exhibitions` | OAuth return banner. | ✓ |
| `?next=<path>` | `/login` | Post-login destination. | — |
| `?mode=doc` / `?mode=card` | `/atelier/capture` | Doc scan vs business card capture. | — |
| `?session=<id>` / `?date=<YYYY-MM-DD>` | `/atelier/session/new` | Specific session review (team read-only). | — |
| `?shareInbox=<uuid>` | `/atelier/works/new` | Pre-fill new work from inbox attachment. | — |

### 4.6 Session-storage triggers — hidden but very useful

Three session-storage keys you'll occasionally see (or want to set manually with DevTools):

| Key | Effect |
|-----|--------|
| `pem_sales_open_new_order` = `1` | Next time `/atelier/sales` mounts, auto-opens the new sale order modal. Cleared after open. |
| `pem_open_contact` = `<ContactID>` | Next time `/atelier/contacts` mounts, auto-opens that editor. Cleared after open. |
| `pem_curation_trigger` = `true` | Next time `/atelier/constellation` mounts, layouts the current selection. Cleared after consumption. |

These are written by the command palette and Curation dock; you rarely set them by hand. If a tab is "stuck" opening a modal you didn't ask for, clear these keys in DevTools → Application → Session Storage.

> **Advanced:** persistent portal shell keeps `localStorage.pem_team_tab` updated with the last visited tab — but it's now mostly a legacy hint since segment routes own the URL.

---

## 5. Command palette — ⌘K / Ctrl+K — ✓ Live

The fastest way to do almost anything. Hit **⌘K** (macOS) or **Ctrl+K** (Windows / Linux).

### 5.1 Sections

| Section | Threshold | What you get |
|---------|-----------|---------------|
| **Actions** | always | Scan QR, field note, reminders, new work, new sale, stock-take tab, export XLSX (→ Reports), regenerate Studio Bible (⚠ admin) |
| **Actions — admin** | always | Capture session, Pending approvals — visible to you but ⚠ rejected by the server |
| **Tabs** | always | Jump to any tab you can see (filtered by your role) |
| **Works** | ≥ 2 chars | Title text search; up to 6 hits → opens work drawer |
| **Contacts** | ≥ 2 chars | Name search; opens Contacts tab + sets `pem_open_contact` |
| **Semantic** | ≥ 3 chars | AI meaning search across works + contacts |

### 5.2 Semantic search states

The semantic row replies with one of three states:

- **Loading** — embeddings are warm; results land in a beat.
- **Pending** — your most recent works haven't been indexed yet. Try again in a minute or use exact-title search.
- **Unavailable** — embedding service is down (Ollama offline / Vercel embed cache unreachable). Falls back to title-only search.

> **Do:** for an unknown work, type the **mood or topic** (e.g. "northern light water reflection"). The semantic results sometimes beat trying to remember the title.

> **Don't:** type the exact title in semantic mode — it's slower than the **Works** section, which uses indexed Postgres.

> **Pitfall:** if the embedding service has been down for a while, semantic returns nothing. Switch your query to ≥2 chars and let the **Works** section take over (title prefix).

### 5.3 Keyboard reference

| Key | Action |
|-----|--------|
| ⌘K / Ctrl+K | Toggle palette |
| ↑ / ↓ | Move selection |
| Enter | Run / jump to selected |
| Esc | Close |
| Tab | (default) Skip to next field |

---

## 6. Work drawer — encyclopedia

The work drawer is the single most-used surface in Atelier. Open it from Inventory rows, work cards, map pins, constellation nodes, Curation dock, palette work-hits, or `?work=<OeuvreID>` deep link.

It has two layout modes:
- **Panel** (desktop) — inline ~35 % width, expandable to ~55 vw.
- **Overlay** (mobile or narrow) — 100 vw modal with sticky save footer and safe-area padding.

### 6.1 Header chrome

| Control | Behaviour |
|---------|-----------|
| Work ID | Inline, top-left, always visible. |
| Close (×) | Triggers **Unsaved guard** if any field is dirty → `Save / Discard / Cancel`. |
| Panel expand | Widens to 55 vw on desktop; not available in overlay mode. |
| Image zoom (wheel) | 1 × to 2 ×, eased; click + drag to pan when zoomed. |
| Image reset | Wheel down to 1 ×; reset on close. |

> **Do:** widen the panel on a big monitor before doing dimension data entry — desktop comfortably edits 4 fields per row.

> **Don't:** zoom-and-drag is **visual only** — it doesn't change the stored image. To replace, use **Retouch** in the Images section.

> **Pitfall:** if the close button seems unresponsive, the unsaved guard caught a hidden dirty state. Look for the modal that just opened behind it.

### 6.2 Images section — ✓ Live (delete is ⚠ admin-blocked)

**Accepted formats.** JPEG, PNG, WebP, GIF, AVIF, **HEIC** (iPhone direct).

**On upload** the server (Sharp 0.34.5 / libheif 1.20) normalises every original to **2100 px long-side AVIF q=50**, stamps EXIF (Artist / Copyright), and stores:
- `paintings/W_{oid}_{seq}_{hash8}.avif` — original-normalised
- `thumbs/W_{oid}_{seq}_{hash8}.avif` — 400 px (auto-generated)

Where `oid` is `Oeuvres.OeuvreID`, `seq` is the gallery sequence (`tblImage.SeqNo`), and `hash8` is the first 8 hex of the SHA-256 of the **raw input bytes** (so re-uploading the same file is idempotent).

| Control | Behaviour |
|---------|-----------|
| Gallery list | Ordered by `SeqNo` ascending. Last image is the **cover** (`txtImageNameLink` synced by trigger). |
| Reorder | Drag handle on desktop; up/down arrows on phone. Persists immediately. |
| Set cover | Moves to end of sequence → cover. Cache busts via `imageCacheKeys`. |
| Add image | File picker. Multi-select → batched upload, per-file progress + cancel. |
| Retouch / replace | Replaces the file at the same `SeqNo` with a fresh hash. Old R2 object soft-deletes to `recycle/`. |
| Zoom / pan | Wheel + drag (see §6.1). |
| Download original | Direct R2 link to the AVIF file. |
| Delete | ⚠ admin-only. UI button shows; server rejects via [`works/actions.ts`](../app/atelier/works/actions.ts) `deleteWorkImage`. |

> **Do:** for a phone photo session, use the canonical pipeline — Lightroom Mobile → Export JPEG → Share Sheet → **PEM Hub** PWA → `/atelier/share-receive` → triage → attach. This survives Lightroom edits and EXIF-strips correctly.

> **Don't:** use the native `<input capture="environment">` on work paths (`WorkForm`, `WorkDrawerImageArea`). iOS sometimes downsamples to 1.5 MP and the EXIF orientation is lost. Exception: business-card capture at `/atelier/capture?mode=card` and `Concepts` sketch upload **do** use native capture.

> **Don't:** try `lightroom-cc://` deep links from the PWA. iOS often refuses to open the protocol when the source is a PWA.

> **Pitfall:** if the cover image refuses to update on the public site, the cache key `imageCacheKeys` map needs to refresh. Reload the public page once — the trigger `tblimage_cover_sync` has already corrected `Oeuvres.txtImageNameLink`; the browser is just cached.

> **Pitfall:** Replacing the cover image bumps the same `SeqNo`. If you want to **add** an alternate angle, use **Add image** instead of Retouch.

#### 6.2.1 Cover image

The last `tblImage` row (highest `SeqNo`) is the cover. Setting cover and reordering both go through `reorderWorkImages()` server action. The trigger on `tblImage` keeps `Oeuvres.txtImageNameLink` in sync — **never edit that column by hand** (CLAUDE.md hard rule).

### 6.3 QR block — ✓ Live (most surfaces)

Visible primarily in `/atelier/works/new` and `/atelier/works/[id]/edit`; not always rendered in the drawer.

| Action | Behaviour |
|--------|-----------|
| Copy link | Copies `workPhysicalBridgeUrl(oeuvreId)` to clipboard (the public verify URL — `/verify/<certId>` reroute). |
| Print label | Opens a new window with title + QR + URL in monospace; print via browser. |

> **Use case:** print a sticker for the back of a physical work. Once stuck on, the QR survives soft-delete of the work (the URL is stable per OeuvreID).

> **Pitfall:** if you cleared `tblImage` rows manually (admin op) the QR still points at the public bridge — it just won't show a thumbnail until you re-upload images.

### 6.4 Title — `Oeuvres.Titre`

Inline text input at the top of the drawer. Free string, no length cap enforced client-side. Existing-work edit goes to **pending queue**; new work saves immediately.

### 6.5 Status bar (computed)

Reads from two axes:
1. **Production** — `Catalogué` boolean + `NeedsPhotograph` flag.
2. **Ownership** — `statusId` FK → `OeuvreStatus.label`.

The bar collapses both into a human label: `Atelier` → `Catalogued` → `Available`, plus ownership state (Artist, Reserved, Consigned, Loan, Sold, Gift, Artist archive, Private archive).

> **Important — status IDs that flip `is_public`:** `2, 4, 6, 7, 8, 11` — these are the ownership stages that the trigger `sync_is_public_from_status()` treats as publicly visible. See `lib/data.ts`'s `STATUS_IDS_PUBLIC`. You **never** write `Oeuvres.is_public` directly — the trigger owns it.

### 6.6 Production pipeline section — ✓ Live

Three stages and an ownership stage selector.

| Stage | DB | Meaning |
|-------|-----|---------|
| **Atelier** | `Catalogué = false` | Still in the studio, not documented. |
| **Catalogued** | `Catalogué = true` + `NeedsPhotograph = true` | Documented but needs photo. |
| **Available** | `Catalogué = true` + `NeedsPhotograph = false` | Ready for catalogue / public. |

The "Needs photograph" toggle sits inside the section. The label is informational on phone and a checkbox on desktop.

**Ownership stages** (the radio / dropdown set):

| Stage | Effect | Contact field label |
|-------|--------|----------------------|
| Artist | Pem retains. | "Pem" (read-only) |
| Reserved | Pre-sale hold; not yet sold. | "Buyer intent" |
| Consigned | At a gallery; ownership not transferred. | "Custodian" |
| Loan | At an institution; ownership not transferred. | "Custodian" |
| Sold | Ownership transferred + payment expected. | "Acquirer" |
| Gift | No payment; recipient is owner. | "Acquirer" |
| Artist archive | Withdrawn; Pem retains. | "Pem" (read-only) |
| Private archive | Confidential hold; not public. | "Pem" |

> **Locking rules — important.** When the ownership is `Sold` / `Gift` / `Artist archive`, the **production section greys out (opacity ~0.55)** and production toggles disable. Why: once a work has shipped or been gifted, you shouldn't be re-marking it "needs photograph". To re-photograph a sold work, reset ownership first (admin path) or take the photo into a fresh session that does not edit pipeline.

> **Anonymity level.** Integer field `anonymity_level` (0..N). Controls how the work appears on the public site. Specifics: 0 = full attribution; higher numbers progressively redact title / dimensions / contact. Admins can override via `admin_override_anonymity`.

> **New contact modal.** The "+" button next to the contact field opens a creation modal: institution, last/first name, role, primary email + phone + address. The new contact appears in your existing options instantly. Doesn't go to the pending queue.

> **Do:** select the ownership stage **before** filling the contact field — the contact-label rotation tells you what to look for.

> **Don't:** edit the Production toggles after ownership is `Sold` / `Gift` — they're locked for a reason.

> **Pitfall:** Reserved → Sold transition does **not** auto-mark `is_paid`. Toggle Payment received separately in Finance.

### 6.7 Identity section — ✓ Live

| Field | Column | Format | Notes |
|-------|--------|--------|-------|
| Year | `Année` | DATE `YYYY-01-01` | Type the year; year-only date stored at January 1. Use `yearOf()` to extract. |
| Technique | `Technique` FK | dropdown + **type-to-add** | Creating a new technique via `saveLookup('Technique', name)` is allowed. |
| Support | `Support` FK | dropdown + **type-to-add** | If the support label matches a circle pattern, dimension mode flips to ∅. |
| Hauteur × Largeur × Profondeur | `Hauteur` / `Largeur` / `Profondeur` | numeric cm | H × W × D. |
| Circular ∅ | (same fields) | one input + diameter symbol | Triggered automatically when support label contains "rond", "circle", "tondo", … |
| Digital works | (Technique = 19) | px input + cm at 300 dpi hint | UI shows computed cm: `cm = px / (300 / 2.54)`. |
| Encadrée / Framed | `Encadree` | boolean | |
| Montée / Mounted | `montee` | boolean | |
| Broadcast ready | `broadcast_ready` | boolean | Unlocks the caption seed textarea below. Used by the admin Broadcast tab. |
| Caption seed | `broadcast_caption_seed` | textarea (≤ 2000 chars, sliced) | Operator hint → AI caption generator outside repo (see [`BROADCAST.md`](./BROADCAST.md)). |
| Présentation | `PresentationID` | dropdown | Optional. |
| Themes | (junction `OeuvreTheme`) | multi-select pill chips | Toggles. New theme created from Themes tab or batch edit — not here. |

> **Do:** use type-to-add for technique and support to avoid duplicates — the dropdown is searchable.

> **Don't:** type a year as "2023-05-12" expecting May 12 — it's stored at January 1 of that year and rendered as the year only.

> **Advanced — digital works.** Technique ID 19 means digital. The drawer shows a px → cm conversion line so you can confirm the print equivalent at 300 dpi before posting.

> **Pitfall — circular detection.** If your custom support label doesn't contain a circular keyword the diameter mode won't trigger. Either: name the support clearly, or just put the diameter in `Hauteur` and leave `Largeur` blank.

> **Pitfall — caption seed.** It's truncated to 2000 chars by the textarea. Test long captions in a scratch field first.

### 6.8 Finance section — ✓ Live

| Field | Column | Notes |
|-------|--------|-------|
| Prix / Price | `Prix` | EUR; integer or decimal. Disabled if ownership = Gift. |
| Discount % | `Discount` | 0..100. Disabled if Gift. |
| TVA rate | `tva_rate` | 0..100 decimal allowed. Disabled if Gift. |
| Final price | computed `Prix × (1 − Discount/100)` | Read-only display; locale-aware formatting (`fr-FR` or `en-GB`). |
| Payment received | `is_paid` / `PaymentDone` | boolean. Disabled if Gift. |

> **Do:** set TVA before saving — the computed final price uses it. If you change TVA after save, the recomputation is correct but the historical export PDF shows the snapshot at save time.

> **Don't:** zero out price on a gift unless ownership stage actually is `Gift`. The price column is also used by KPIs.

### 6.9 Working groups — ✓ Live

A pill-button toggle group. Each button is a `working_group` row; toggling adds/removes the `working_group_members(oeuvre_id, group_id)` row.

> **Use case:** working groups are looser than themes — you might mark a set of paintings as "Spring 2024 selection" without committing to a theme. They appear in Constellation as a layout option.

> **Pitfall:** group changes save when you press Save like any other field, and **go to pending** for existing-work edits. To bulk-attach without queueing, use **Curation dock → Attach** (Catalog persist modal) which applies immediately.

### 6.10 Work sessions section — read-only for team

Lists every `work_session` row that has applied images to this work. Each row shows the calendar day, status (draft / pending_review / applied / abandoned / rejected), shot count, and notes.

> **Do:** open Journal (`/atelier/journal`) to review session history for the date. You can read every team member's session via the RLS policy `work_session_team_select`.

> **Don't:** look for a delete or edit button here — sessions are immutable in this view. Admins manage capture in `/atelier/session/new`.

### 6.11 Notes section — ✓ Live

| Field | Column | Notes |
|-------|--------|-------|
| Commentaires | `Commentaires` | Free textarea. No length cap UI-side. |
| Historique | `Historique` | Append-only convention: add lines, don't rewrite. New lines prefixed `[YYYY-MM-DD HH:MM] User:`. |

Server action `historiqueLinesForOeuvreUpdate()` can auto-format lines on save. The textarea is editable so you can prune typos.

> **Do:** treat `Historique` as the audit narrative — what changed and why. The audit tab also exists, but `Historique` is human-readable.

> **Don't:** replace existing `Historique` content. Append.

### 6.12 Version history — 🔒 admin only

The version-history button is hidden from team. Admin uses it to restore `oeuvre_versions` snapshots (DB trigger snapshots OLD on every UPDATE). See [`ADMIN_GUIDE.md §24.3`](./ADMIN_GUIDE.md).

### 6.13 Footer actions

| Button | Behaviour for you (team) |
|--------|--------------------------|
| **Save** | New work → immediate. Existing work → queued in `pending_changes` for admin review. |
| **Add photo** (narrow) | Opens file picker. Upload is immediate (not queued). |
| **Pipeline bump** (narrow) | Quick advance through Production stages. Goes to pending for existing works. |
| **Add to selection / In selection** | Toggles the work in the Curation dock selection. |
| **Gift** | Modal: recipient contact, delivery date, notes. Calls `markAsGift()`. Hidden if stage is already Sold / Gift / Artist archive. |
| **Delete** | Two-step confirm → soft-delete (`deleted_at = now()`) + Undo toast (~ 8 s). |

> **Do:** use Save then watch the toast. If it says "Changes queued for admin review", your edits are not live yet.

> **Don't:** double-click Save. The first click already debounces via `useTransition`.

> **Pitfall:** soft-delete sets `deleted_at` and revalidates `/atelier`, `/hub`, `/works`. Public site hides the work within seconds. If you change your mind after the Undo toast vanishes, ask an admin to `restoreSoftDeletedWorks([id])`.

### 6.14 Sale return banner — ✓ Live

When the work is `Sold`, the drawer fetches `getReturnWindowHintForOeuvre(oeuvreId)`. Banner states:

- **Skipped** — return window has been waived (admin set).
- **No start date** — sale exists but the return clock isn't ticking.
- **Active — X days remaining** — within the window; the work hasn't fully transferred.

After the window expires, the cron in `app/api/cron/return-window/route.ts` archives the sold work (moves to `Artist archive` if your buyer hasn't returned it).

### 6.15 Pending-changes flow at a glance

| Action | What happens for you |
|--------|----------------------|
| New work save (`/atelier/works/new`) | **Immediate.** Insert into `Oeuvres`. |
| Existing-work field edit in drawer | **Queued.** Row inserted into `pending_changes`; admin replays via Audit. |
| Theme / group junction edit (in drawer save) | **Queued** with the rest of the payload. |
| **Batch edit** (Curation dock) | **Immediate** — bypasses queue intentionally. |
| **Catalog persist** (Curation dock) — bulk theme/group attach | **Immediate.** |
| Constellation edge insert / delete | **Immediate** (server actions). |
| Soft-delete a work | **Immediate** (`deleted_at` set). |
| Add / replace / reorder image | **Immediate** (file upload). |

Full allow-list of fields the queue actually persists: §19.

---

## 7. Curation dock — when 1+ works are selected

Appears as a floating bottom-centre bar whenever the selection set is non-empty. **Hidden on `/atelier/constellation`** — selection is used to drive the layout there, not to expose batch actions.

### 7.1 Buttons

| Button | Opens |
|--------|-------|
| Selection count | Static label |
| **Modify** | Batch edit modal — §7.2 |
| **Export** | Export modal — §7.3 |
| **Attach** | Catalog persist modal — §7.4 |
| **Compare** | Compare modal — §7.5 |
| Group name + **+** | Save selection as a new working group |
| **Curate →** | Go to Constellation with this selection; sets `pem_curation_trigger=true` |
| **Clear** | Deselect all |

### 7.2 Batch edit modal — applies **immediately**, no pending queue

Fields you can change in bulk (tri-state checkbox: `null` = unchanged, `true` / `false`):

- **Identity:** title (templated), year, technique, support, format, dimensions.
- **Status / pipeline:** status, contact, location, exposable, montée, encadrée, cataloguée, needs photo, broadcast-ready, commission, gift, paid.
- **Finance:** price, discount, TVA.
- **Notes:** comments (overwrite or append), historique append.
- **Themes:** add / remove (including **create theme inline** by typing).
- **Working groups:** add / remove.

> **Do:** use batch edit to bulk-mark `broadcast_ready` before the admin runs a publication round.

> **Don't:** use batch edit to set TVA to 0 across a 200-work selection unless you really mean it — there's no undo at the batch level.

> **Pitfall:** Comments field has two modes — overwrite and append. Pick the right one. The default is overwrite if the textarea has content.

### 7.3 Export modal — ✓ Live

Generates a printable HTML or PDF of the selection using a chosen layout (catalogue list, grid, single-work sheet). The pdfkit engine is the same as Portfolio (see §14.2).

> **Pitfall:** Export PDF caps at ~ 60 s function time on Vercel. ≤ 16 works at full image quality keep within the budget; beyond that the layout downsamples thumbnails.

### 7.4 Catalog persist modal (Attach) — ✓ Live

Bulk-attach themes + working groups to the selection. Applies immediately. Useful when you've batch-selected 30 works in Inventory and want them all in the `Spring 2025` group without going work-by-work.

### 7.5 Compare modal — ✓ Live

Side-by-side comparison of selected works on: ID, title, year, technique, support, format, dimensions, status, contact, location, prices, flags, confidentiality, commission, notes, history. Long-text fields load async on expand.

### 7.6 Save selection as working group

Type a name in the input next to the "+" button. The selection becomes a new `working_group` row + member rows. Immediate.

### 7.7 Curate → Constellation handoff

Sets `pem_curation_trigger=true` in session storage and navigates to `/atelier/constellation`. When the tab mounts, it consumes the trigger and arranges the works.

> **Use case:** "I want to visualise the relationship between the 12 works I just batch-selected." Curate → Constellation → drag, draw, save snapshot.

---

## 8. Hub `/hub` — phone field launcher

### 8.1 Field pulse — top-of-Hub status row

Four metrics, each tappable for a deep link.

| Metric | Calculation | Tap to |
|--------|--------------|---------|
| **Past due** | Open reminders with deadline < today | `/atelier/pipeline?filter=past-due` |
| **Today** | Reminders + deadlines due today | Pipeline today view |
| **Pending review** (admin metric) | Open `pending_changes` count | `/atelier/audit` (admin only) |
| **Share inbox** | Unprocessed `share_inbox` rows | `/atelier/share-triage` |
| **First card** | Suggested next action (from `studio_task`) | Inline link |
| **Open inbox** | Field inbox button | `/atelier/field-inbox` |

> **Pitfall:** "Pending review" shows you a number but you can't actually open Audit. Ask an admin or focus your work elsewhere.

### 8.2 Field verbs — the 10-tile grid

| Verb | Destination | Status |
|------|-------------|--------|
| From Lightroom | `/atelier/share-triage` | ✓ |
| Session | Team → `/atelier/journal`. Admin → `/atelier/session/new` | ✓ |
| Voice note | `VoiceNoteSheet` modal | ✓ |
| Scan document | `/atelier/capture?mode=doc` | ✓ |
| Pipeline | `/atelier/pipeline` | ✓ |
| New sale | `/atelier/sale/new` | ✓ |
| Triage | `/atelier/triage` (broadcast triage deck) | β |
| Business card | `/atelier/capture?mode=card` | ✓ |
| Document | `/atelier/documents/new` | β (limited to COA path today) |
| Report issue | `/atelier/issue/new` | ✓ |

### 8.3 Studio room tiles — 4 jump shortcuts

| Tile | Tab |
|------|-----|
| Field | Inventory |
| Studio | Overview |
| Commercial | Pipeline |
| Admin | Contacts |

### 8.4 Mobile bottom bar — narrow Atelier, drawer closed

| Button | Team behaviour | Admin behaviour |
|--------|----------------|------------------|
| Session | Journal | `/atelier/session/new` |
| Scan | `/atelier/scan` | same |
| Voice note | Opens VoiceNoteSheet | same |
| Reminders | Scrolls Overview reminders | same |
| New work | `/atelier/works/new` | same |

### 8.5 Desktop behaviour

On a desktop browser, `/hub` may redirect you toward `/atelier/overview` — Hub is the field tool, the portal is the studio tool. Use Hub on phone; use Overview on desktop.

### 8.6 PWA / Lightroom intro modal

First visit on phone shows an intro modal explaining Share to PEM Hub. Dismiss to never see it again (preference in localStorage).

---

## 9. Field workflow routes (Ring B & C)

### 9.1 Field inbox `/atelier/field-inbox` — ✓ Live

Mirror of Hub's field pulse with the inbox surfaced top. Use when you want a focused field-tasks view without distraction.

### 9.2 Share triage `/atelier/share-triage` — ✓ Live

The destination of every PWA share. Lists `share_inbox` rows: title, text, URL, attached files.

| Action | What it does |
|--------|--------------|
| Manual import (form) | Add files + title/text/URL → POST `/atelier/share-receive` (same handler as PWA share). |
| Open row (`?inbox=<uuid>`) | Detail view with thumbnails + meta. |
| Dismiss / delete | Removes the inbox row (R2 file kept short-term per lifecycle). |
| **Attach to existing work** | Search by title → link inbox to work. Optionally apply the file as an image. |
| **New work** | Creates one work with prefilled context (`/atelier/works/new?shareInbox=<uuid>`). |
| **Split** | Creates multiple works from a multi-file share. |
| Return-session banner | Appears after a Lightroom roundtrip — links shots to an admin session if open. |

> **Use case:** export 5 finished JPEGs from Lightroom Mobile → Share → PEM Hub → triage → Split → 5 new work drafts. Each opens WorkForm with the right inbox attached.

> **Don't:** rely on the return-session banner unless the admin is actually capturing a session for today. The banner is informational, not a workflow gate.

### 9.3 Share receive `/atelier/share-receive` — ✓ Live (HTTP route)

The PWA `share_target` POST target. Stores the multipart payload in `share_inbox` + uploads files to R2, then **303** redirects to `/atelier/share-triage`. You never visit this URL manually; the OS does.

A GET request redirects to triage as a courtesy.

> **Requires** `supabase/sql/share_inbox.sql` applied to the project DB. If shares 500, that migration is missing.

### 9.4 Session `/atelier/session/new` — β read-only for team

Multi-shot capture is **admin only**. Team members see:

| Context | What you see |
|---------|--------------|
| Bare URL | Gated message: "Capture réservée aux administrateurs" + link to `/atelier/journal`. |
| `?session=<id>&date=<YYYY-MM-DD>` | Review view: read the day's session payload (items, shots, notes). Cannot apply images. |
| Draft you started (rare) | Submit-for-review path. |

> **Why team is gated.** Field capture mutates `tblImage` / `Oeuvres` directly and stamps EXIF / weather / location. The admin owns the apply step to keep image quality consistent and to prevent two captures from competing.

> **Workaround:** use **WorkForm** (`/atelier/works/new`) to create works with photos immediately. Use `Notes` to record observations the admin should know about.

### 9.5 Create work `/atelier/works/new` — ✓ Live

Full **WorkForm** — all drawer fields, plus QR block. Saves **immediately**. Optional `?shareInbox=<uuid>` pre-fills from a share inbox attachment.

- **Drafts:** the form stores a draft to sessionStorage with 7-day TTL. If you reload mid-edit, the form offers to restore.
- **Undo baseline:** initial snapshot is captured; you can revert before save.
- **Image upload:** multi-file batched, with cancel + retry + offline queue fallback.

> **Do:** use this surface to record a new work as soon as it exists, before it gets buried in the studio.

> **Don't:** create a placeholder work just to attach a photo — use `/atelier/share-triage` instead, which is built for that.

### 9.6 Scan `/atelier/scan` — ✓ Live

| Function | Behaviour |
|----------|-----------|
| Camera QR scan | Reads physical labels → opens work drawer via `?work=<id>`. |
| Manual ID entry | Type the `OeuvreID` → opens drawer. |
| Back | Hub. |

### 9.7 Capture `/atelier/capture` — ✓ Live (modes) / ▲ stub (default)

| URL | Behaviour |
|-----|-----------|
| `/atelier/capture` | Stub page with links to the modes. |
| `/atelier/capture?mode=doc` | Multi-page document scan → assembles into a PDF stored in `vault`. |
| `/atelier/capture?mode=card` | Business card capture (photo or paste text) → contact import preview → confirm → new `Contact` row. |

> **Use case (card):** at an opening, snap the back of a business card. Card capture extracts the email/phone/institution and shows a preview. Confirm to add to your Contacts.

> **Don't:** expect AI extraction perfection — review the preview before confirming.

### 9.8 New sale `/atelier/sale/new` — ✓ Live

Sale-order form (buyer, line items, works, prices, return window options). On save, you land on the order detail.

> **Advanced:** `pem_sales_open_new_order` = `1` triggers this form automatically when you arrive on `/atelier/sales`. Useful in shortcut chains.

### 9.9 Documents `/atelier/documents/new` — β

Today this surface routes to the COA (certificate of authenticity) generator for a chosen work, via `generateFieldDocument('coa', oeuvreId)`. It writes the PDF into `vault` and returns you to the vault tab.

> **Status:** Full paperwork hub (commission contracts, consignment agreements, …) is planned. For now use this to generate COAs from anywhere.

### 9.10 Issue `/atelier/issue/new` — ✓ Live

| Field | Notes |
|-------|-------|
| Title | Required. |
| Optional work link | Tie the issue to an `OeuvreID`. |
| Severity | low / normal / high. |
| Notes | Free text. |

Saves a row into `studio_task`. Surfaces on Hub field pulse and Overview reminders.

> **Use case:** at a gallery installation you notice a frame has a crack. New issue → severity high → link to the work → save. Admin sees it on next Overview load.

### 9.11 Triage `/atelier/triage` — β

The **broadcast triage deck** — distinct from share triage. Used to make publish/don't-publish decisions for works that are `broadcast_ready`. The deck shows a swipeable card UI. Confirmed posts go to the admin Broadcast queue.

> **Don't confuse** with `/atelier/share-triage`. Naming overlap is a known wart.

---

## 10. Atelier tabs — Field group

### 10.1 Inventaire / Inventory — `/atelier/inventory` — ✓ Live

The catalogue's primary surface.

#### Views

| View | When |
|------|------|
| **List** | Default. Table rows + side preview drawer (clickable row opens preview; click again opens full drawer). |
| **Grid** | Thumbnail mosaic. Best for visual browsing. |
| **Pivot** | Inline pivot panel (hidden on `< 768 px`). Quick crosstab on the loaded subset. |
| Graph (placeholder) | Reserved code path; not user-facing yet. |

#### Filters & search

| Control | Behaviour |
|---------|-----------|
| Text search | Free text; matches title, optional fuzzy across multiple fields. |
| **Paste list of IDs** | Search field also accepts comma- or newline-separated IDs. Filters the table to that exact set. |
| Quick filters | Technique, support, status, theme, working group. |
| Advanced filter builder | (field + operator + value), AND-chained. Clear all in one click. |
| Selection-only toggle | Show only selected works. |

#### Sort

Click any column header. Sortable: ID, title, year, price, status, stage, contact, custodian, commission flag, broadcast_ready, etc.

#### Selection

Row checkbox or **Select all filtered**. Selection drives the Curation dock.

#### Embedding badges

Each row shows the semantic-index state on a tiny pill:
- **pending** — not yet indexed.
- **embedding** — being indexed now.
- **error** — index failed. If you see many, ping the admin.

#### Paging

Top strip + bottom paging bar. Both call the global `oeuvresPaging.loadNextBatch()`.

#### Embedded preview drawer

In list view, clicking a row pops a slim **preview** panel to the right (desktop). Click again on the same row to open the full work drawer.

> **Do:** use paste-IDs to triage a list someone shared in chat — "check works 1234, 1240, 1311".

> **Don't:** assume Inventory shows the whole catalogue. The subset banner (when partial) tells you "Showing X of Y". Tap to load.

> **Advanced:** virtualised row rendering keeps the list smooth at thousands of rows; offscreen rows aren't in the DOM.

> **Pitfall — selection persistence.** Selection persists across tabs via the persistent portal shell. If you toggle to Reports and back, the selection is still active. Clear it from the Curation dock when you're done.

### 10.2 Production — `/atelier/production` — ✓ Live

Works that are in a production-related status: in-atelier, needs photograph, needs catalogue.

| Feature | Behaviour |
|---------|-----------|
| Filtered list | Works whose pipeline is incomplete. |
| Text filter | Title / ID search. |
| Material overview | Field issues (`studio_task`) tied to works. |
| Per-work checklist | Toggle production action steps (Photographier, Cataloguer). |
| Pivot export | Throughput-style XLSX from the tab. |
| Open work | Drawer. |

> **Do:** start your week here — work through `pending` actions on each row.

> **Pitfall:** if the action row doesn't appear (e.g. Photographier missing), the `work_action` rows are out of sync. Saving the work re-syncs via `syncPipelineWithBooleans()`.

### 10.3 Stock-take — `/atelier/stock-take` — ✓ Live

Physical count surface for the supplier-side materials catalogue.

| Control | Behaviour |
|---------|-----------|
| Supplier / material rows | Expected qty vs counted qty. |
| Search | Filter rows. |
| Show discrepancies only | Toggle. |
| +/- buttons | Adjust counts in-UI; not yet persisted. |
| Apply | Modal → persists corrections to stock + writes audit entry. |

> **Use case:** quarterly inventory check on canvas, frames, varnishes. Tap +/− as you count, then **Apply**.

### 10.4 Journal sessions — `/atelier/journal` — ✓ Live

Calendar index of field sessions. Team has full read access; admin manages capture.

| Function | Team | Admin |
|----------|:---:|:---:|
| Month calendar index | ✓ | ✓ |
| Select day → view session detail | ✓ | ✓ |
| Intro banner explaining read-only capture | ✓ | — |
| View session (`session/new?session=&date=`) | review | full editor |
| Browse shots | ✓ | ✓ |
| Edit session metadata | — | ✓ |
| Delete session / items | — | ✓ |
| Version compare on items | — | ✓ |
| Capture today shortcut | — | ✓ |

> **Pitfall:** if the journal is empty for a date you remember capturing, RLS `work_session_team_select` may not be enabled in the project — that policy is what gives team-wide read access. See [`supabase/sql/work_session_team_read.sql`](../supabase/sql/work_session_team_read.sql).

### 10.5 Notes — `/atelier/notes` — ✓ Live

Voice notes captured from Hub / Command palette / Mobile bar / VoiceNoteSheet.

| Control | Behaviour |
|---------|-----------|
| List | Chronological. |
| Filters | Kind, time bucket. |
| Search | Transcript text. |
| Row | Play audio (R2 public URL), edit transcript, delete. |
| Create | From Hub, palette, mobile bar. |

> **Do:** dictate observations while walking the studio — faster than typing, and the transcript ends up in `Historique` if you paste it into the right work later.

> **Pitfall:** transcription is best-effort. Review before relying on it.

### 10.6 Carte / Map — `/atelier/map` — ✓ Live

Leaflet map. Two modes via toggle: **Contacts** vs **Works**.

| Control | Behaviour |
|---------|-----------|
| Mode toggle | Contacts (default) / Works. |
| Pan, zoom | Standard Leaflet. |
| Pin click | Contact card popup (or work drawer in Works mode). |
| Geocode | Server-assisted via [`/api/geocode`](../app/api/geocode/route.ts); client cache hits common addresses. |

**Contact pin fallback:** the tab prefers `contact_addresses` rows that include city + country. If none exist, it falls back to the `Contact.Ville` / `Contact.Pays` columns on the contact card. If both are blank, no pin.

> **Pitfall — wrong pin location.** Fix the underlying `contact_addresses` or `Contact.Ville/Pays` row. The geocode cache may still serve the old result for a couple minutes.

---

## 11. Atelier tabs — Studio group

### 11.1 Vue d'ensemble / Overview — `/atelier/overview` — ✓ Live

The Atelier landing page. Every card is built from the **loaded subset** of works.

| Card | What it shows | Subset note? |
|------|----------------|-------------|
| Works this year | Count of `Oeuvres` with `Année` = current year. | ✓ |
| Priced | Works with `Prix > 0`. | ✓ |
| Available / exposable | `Catalogué`, `Exposable`, available status. | ✓ |
| Missing dims / images / location | Quality checks. | ✓ |
| **Financial pulse** | Sold revenue this calendar year. | from sold works |
| **Recent works** | Last 6 by ID; click → drawer. | ✓ |
| **Pipeline calendar** | Week-view snippet. | from `suivi_process` |
| **Upcoming deadlines** | Pipeline reminders. | from `suivi_reminder` |
| **Field reminders** | Unread `suivi_reminder`; mark read in-line. | — |
| **Expenses teaser** | Total from bootstrap. | from `expense` |
| **Burning concepts** | Top concepts by energy. | from `concept` |
| **Technique breakdown** | Top 5 techniques. | ✓ |
| Conflict queue | 🔒 admin only |

> **Pitfall:** if "Works this year" feels too low, check the subset banner above the cards. Tap to load more batches.

### 11.2 Pipeline — `/atelier/pipeline` — ✓ Live

The commercial / production pipeline. Each row is a `suivi_process` with a `type` (vente, exposition, residence, expedition, consignment, …) and a chain of `suivi_etape` steps.

| Control | Behaviour |
|---------|-----------|
| Views | Board / list / calendar-style pulse. |
| Filters | Process type, group, status. |
| New process modal | Creates a `suivi_process` row. |
| Open process | Steps, deadlines, mark complete, edit dates. |
| Exhibition link | "Open exhibition project" deep-links to `/atelier/exhibitions?exhibition=<id>`. |
| Reminders | Badge, list, mark read, delete. |
| Open work / contact | From process row. |
| Calendar OAuth banner | When `?calendar=*_ok` returns. |

> **Use case:** a gallery contacts you about a sale. Create a `vente` process → add steps (prepare COA, ship, invoice, follow-up) → set deadlines → mark each done as you go. Reminders appear on Hub / Overview.

> **Don't:** delete a process row that has an `exhibition_process_id`. Use the Exhibitions tab's delete which clears the FK first.

### 11.3 Expositions / Exhibitions — `/atelier/exhibitions` — ✓ Live

Manages exhibition projects (`suivi_process` rows with `type = 'exposition'`).

| Control | Behaviour |
|---------|-----------|
| Project list | All expositions. |
| Select project | Detail workspace. |
| Per-work checklist | `suivi_etape` steps for each included work. |
| **Floor plan** | Upload plan image, define **walls** (name + colour), drag works onto plan (x / y % positions, scale). |
| Schedule / notes | Edit and save. |
| Calendar export | Connect Google or Microsoft; push events; disconnect. |
| **Delete exhibition** | Clears `exhibition_process_id` on referencing rows first, then deletes. |
| Deep link | `?exhibition=<process_id>` selects. |

> **Use case:** plan a 12-work exhibition. Upload the floor plan → define 4 walls in the gallery colours → drag works onto walls → export to Google calendar so the install date appears in your phone calendar.

> **Pitfall — calendar OAuth bounce.** If `NEXT_PUBLIC_SITE_URL` is missing a trailing-slash mismatch, the OAuth return URL doesn't validate and Google/Microsoft sends you back to login. Check the env var on the deployment.

### 11.4 Concepts — `/atelier/concepts` — ✓ Live

Idea bank that lives before catalogue works exist.

| Control | Behaviour |
|---------|-----------|
| List | All concepts. |
| Filters | Status, category. |
| Sort | By energy, status, date. |
| Create / edit / delete | Concept records. |
| Sketch upload | Image attached to the concept (uses native camera capture path). |
| Stats | Active, high energy, converted counts. |
| **Promote to work** | Workflow that turns the concept into an `Oeuvres` row when ready. |

> **Use case:** capture a sketch of an idea on Sunday → "high energy" status → promote to work two months later when you start the canvas.

> **Don't:** delete concepts you promoted — they're useful in the history.

---

## 12. Atelier tabs — Catalogue group

### 12.1 Rapports / Reports — `/atelier/reports` — ✓ Live

Two modes: **Works table** + **Pivot Atlas**.

#### Works table

| Control | Behaviour |
|---------|-----------|
| Column picker | Show / hide columns. Persisted per device. |
| Filters | Search, technique, support, status, theme, group, selection-only. |
| Sort | Column header click. |
| Subset note | Visible when the catalogue is partial. |
| **Export XLSX** | Spreadsheet of filtered rows. |
| **Export PDF** | pdfkit table with a row cap (≈ 200). |

#### Pivot Atlas

| Control | Team | Admin |
|---------|:---:|:---:|
| Preset **Contacts × Themes** | ✓ + widget XLSX export | ✓ |
| Preset **Raw edges** | ✓ | ✓ |
| Pivot toolbar (dimensions / measures) | ✓ | ✓ |
| **CSV Entités / Arêtes** | 🔒 | ✓ — full graph snapshot |

> **Use case:** Contacts × Themes lets you spot which collectors gravitate toward which themes — useful when planning who to invite to an exhibition.

> **Pitfall:** the Pivot reflects the loaded subset only. Load all batches before exporting if you need totals.

### 12.2 Thèmes / Themes — `/atelier/themes` — ✓ Live

| Control | Behaviour |
|---------|-----------|
| Theme list | Rename via context menu; delete with Ctrl+Del confirm; add new. |
| Working group list | Same. |
| Select theme / group | Mosaic of member works. |
| Analytics panel | Counts on the loaded subset. |
| Subset note | When partial. |
| Assign works | Through the work drawer or Constellation (not bulk here). |

> **Do:** rename themes for clarity. The slug stays — only the display label changes.

> **Don't:** delete a theme that is referenced on the public site without checking — the public site uses the theme for routing.

### 12.3 Stock fournisseurs / Supplier stock — `/atelier/stock` — ✓ Live

Supplier hub: suppliers, their materials, stock levels.

| Control | Behaviour |
|---------|-----------|
| CRUD | Add / edit suppliers and material lines. |
| Link to stock-take | Cross-references the physical count tab. |

### 12.4 Constellation — `/atelier/constellation` — ✓ Live

Visual curation canvas. See [`CONSTELLATION.md`](./CONSTELLATION.md) for the full curator contract.

#### Layout modes

| Mode | What it does |
|------|--------------|
| **Year** | Clusters by `Année`. |
| **Theme** | Clusters by `OeuvreTheme` membership. |
| **Working group** | Clusters by `working_group_members`. |
| **Free** | No clustering; manual placement. |
| **Custom** | Driven by the current selection (Curate → handoff). |

#### Overlays (left toolbar)

| Tool | What it does |
|------|--------------|
| Move | Drag nodes around. |
| Marquee | Multi-select by drag rectangle. |
| Draw | Freehand sketch overlay. |
| Line | Straight annotation lines. |
| Text | Stick a text label on the canvas. |
| Erase | Remove overlay shapes. |

#### Edges (relations)

Drag from one node's circle to another's to create an edge. Right-click an edge to delete. Edge **types** (each with its own colour):

| Type | Colour | Style | Meaning |
|------|--------|-------|---------|
| Influence | gold | solid | "A inspired B" |
| Proximity | blue | dashed | "A and B are conceptually adjacent" |
| Series | green | solid | "A and B belong to the same series" |
| Diptych | magenta | dashed | "A and B should be displayed together" |

Edges write to `tblrelations` via the **server actions** `insertConstellationRelation` / `deleteConstellationRelation` ([`app/atelier/constellation/actions.ts`](../app/atelier/constellation/actions.ts)) — there's no browser `createClient()` on `tblrelations`.

#### Snapshots

| Layer | Storage | Purpose |
|-------|---------|---------|
| Local snapshots | `localStorage.pem_const_snapshots` | Fast browser-side scratch saves. |
| Cloud maps | Server actions (`saveConstellationMap`, `listConstellationMaps`, `loadConstellationMap`, `deleteConstellationMap`) | Shared, persistent, deep-linkable via `?map=<uuid>`. |
| Node positions | `localStorage.pem_const_pos_year` / `pem_const_pos_theme_<id>` / `pem_const_pos_wg_<id>` / `pem_const_pos_none` | Per-mode positions; don't sync across modes. |

#### Frozen mode (cloud-map deep link)

When you open `?map=<uuid>`, the canvas enters **frozen** mode: read-only until you exit. Edge edits and overlay edits don't apply to the live graph; they're scoped to the loaded snapshot only.

#### Performance ceilings

| Limit | Value | What happens at the edge |
|-------|-------|--------------------------|
| `tblrelations` cached | 10 000 rows | Beyond this, the graph subsamples; load via Pivot Atlas for the rest. |
| Theme/group memberships | 50 000 rows | Same. |
| Thumbnail LRU | 480 images | Older offscreen thumbnails drop first. |
| Thumb resolution tiers | 40 / 100 / 200 px adaptive | Picks based on zoom. |

> **Do:** save a cloud map before sending the link to your gallerist — frozen maps survive browser cache clears.

> **Don't:** expect node positions to follow you when you flip from Year to Theme mode — each mode has its own storage key. That's a feature.

> **Pitfall — Curation dock hidden:** intentional. Selection still drives layout (Custom mode), but bulk actions stay in the other tabs.

---

## 13. Atelier tabs — Commercial group

### 13.1 Ventes / Sales — `/atelier/sales` — ✓ Live

| Control | Behaviour |
|---------|-----------|
| KPI strip | Summary stats: this month, this year, average. |
| Order list | Filter, sort. |
| New order | Modal, or `/atelier/sale/new`, or palette action. |
| Order detail | Lines, works, buyer, prices, return window, status. |
| **Sold-works pivot** | Crosstab export. |
| Session storage | `pem_sales_open_new_order` auto-opens new order on tab entry. |

> **Use case:** end of month — open Sales → KPIs → revenue YTD → sold-works pivot → XLSX → send to accountant.

### 13.2 Logistique / Logistics — `/atelier/logistics` — ✓ Live

Shipments table.

| Section | Behaviour |
|---------|-----------|
| Upcoming | Future shipments. |
| Delivered | Historical. |
| **New shipment** | Create a row (link to a work + contact). |
| **Mark delivered** | Per-row action. |
| Edit fields | Per-row form. |

### 13.3 Revenus & Dépenses / Fiscal — `/atelier/fiscal` — ✓ Live

French BNC (Bénéfices Non Commerciaux) tax framework.

| Section | Behaviour |
|---------|-----------|
| Dashboard | Summary stats + category breakdown. |
| Expenses | Add / edit / delete `expense` rows. |
| BNC framework | French tax reference panel — categories, rules. |
| Pivot | On expenses; XLSX export. |
| Recettes | Revenue from sold works. |

> **Use case:** quarterly tax prep — Expenses by category → export to your accountant.

### 13.4 Coffre / Vault — `/atelier/vault` — ✓ Live

Document storage.

| Control | Behaviour |
|---------|-----------|
| Folder tree | Browse document kinds (contracts, COAs, bible, etc.). |
| Upload | New files. Multipart upload to R2. |
| Preview | In-browser where supported. |
| Search / filter | Kind, text. |
| Multi-select delete | Soft-delete files. |
| **Generate COA** | Modal for certificate PDF (calls `generateCOA`). |
| Link to works | For document types that bind to an `OeuvreID`. |
| Open Studio Bible | Latest `document.kind = 'bible'` opens via short-lived signed URL (`/Atelier_Studio_Bible.pdf` redirect). |
| Regenerate Bible | ⚠ admin (System tab). |

> **Do:** generate a COA the moment a sale is confirmed — it's traceable, dated, and stored with the order.

> **Don't:** rely on the bible PDF for live workflows — it's a periodic snapshot. The Atelier UI is the live source.

---

## 14. Atelier tabs — Public group

### 14.1 Site public — `/atelier/site` — ✓ Live

Uses `PortfolioConfigShell` to control the public site (`/works`, `/practice`, `/about`).

| Control | Behaviour |
|---------|-----------|
| Public sections | Configure site structure. |
| Copy / labels | Bilingual content. |
| Work visibility | What appears on `/works`. |
| Theme assignments | Public groupings. |
| Preview | Open public site in a new tab. |

> **Pitfall:** changes here are immediate on the public site. Preview before saving.

### 14.2 Portfolio — `/atelier/portfolio` — ✓ Live

Same shell family as Site. Drives the PDF portfolio output.

| Control | Behaviour |
|---------|-----------|
| Portfolio sections / collections | Configure |
| **Manual work order** | CSV-imported / drag-ordered list overriding theme order. |
| Modes per section | Display modes (grid, list, deck). |
| **Generate portfolio PDF** | pdfkit-driven server action. |
| Subset note | When the catalogue is partial. |

#### PDF section sources (priority)

The engine ([`app/atelier/portfolio/pdf-action.ts`](../app/atelier/portfolio/pdf-action.ts)) chooses what to render in this order:

1. `raw.sections` — explicit sections defined in config.
2. `raw.works_modes[0].collections` — first mode's collections.
3. `raw.works_collections` — legacy collections.
4. `__all__` — everything.

#### Themes & groups appendix

If `tblrelations` edges exist, an appendix is appended automatically with a graph visualisation of themes/groups.

#### Cover

The first loaded image is the cover; it's excluded from work pages.

#### Limits & gotchas

| Limit | Value | Notes |
|-------|-------|-------|
| Vercel function timeout | 60 s | Hard cap. |
| Full-quality works | ≤ 16 | Above this, thumbnails downsample. |
| Page format | A4 portrait | Auto-detected. |
| pdfkit colour | **No 8-char alpha hex** (e.g. `#RRGGBBAA`). | Use `fillOpacity(N).fill('#RRGGBB').fillOpacity(1)` instead. (CLAUDE.md rule.) |
| Background refill | After text without explicit `height`, you may auto-page; refill background. | |
| AVIF input | Sharp 0.34.5 / libheif 1.20 supports AVIF input. | |

> **Use case:** quarterly portfolio for a residency application — Portfolio → arrange manual_work_order → generate PDF → email.

> **Don't:** include 50 works in one portfolio if you also want full image quality. Split into two PDFs.

### 14.3 Analytics — `/atelier/analytics` — ✓ Live

Same shell family — analytics hooks and configuration. Not a visitor analytics dashboard (use your hosting provider's analytics for that).

---

## 15. Atelier tabs — Admin group (partial team access)

### 15.1 Contacts — `/atelier/contacts` — ✓ Live

| Control | Behaviour |
|---------|-----------|
| Search / filter | List. |
| **Open editor** | Name, institution, addresses (multi), role, notes. |
| Linked works | See relationships from the editor. |
| Merge duplicates | When a conflict is flagged (admin queue). |
| Quick create | Inline + drawer's "new contact". |
| **Business card import** | From Hub `/atelier/capture?mode=card`. |
| `?contact=<id>` | Auto-opens that editor. |
| **Private contact** flag | 🔒 admin only. |

Each contact has its own subtables: `contact_emails`, `contact_phones`, `contact_addresses`, `contact_websites`.

> **Do:** keep one `Contact` per real person/institution. Duplicates create conflict-queue work for admin.

> **Don't:** hard-delete a contact that owns sold works — even if `ContactID` becomes null on `Oeuvres`, the sale history loses its anchor. Use **archive** semantics (set `Actif = false`) instead. The team-callable `deleteContacts` does delete the contact rows; prefer not to use it for contacts with work history.

### 15.2 Système / System — `/atelier/system` — ✓ Live (mostly)

| Control | Team | Admin |
|---------|:---:|:---:|
| Read system ledger MD (`SYSTEM_LEDGER.md`) | ✓ | ✓ |
| Manual log entry (`event_type IS NULL`) | ✓ | ✓ |
| Screenshot attachment (R2 `ledger/*`) | ✓ | ✓ |
| Download QA checklist PDF | ✓ | ✓ |
| Copy SYSTEM_LEDGER.md | ✓ | ✓ |
| Open Studio Bible PDF | ✓ | ✓ |
| **Regenerate Bible** | ⚠ blocked | ✓ |

Attachments live at R2 keys `ledger/<filename>` with a **30-day TTL** (Cloudflare lifecycle). Screenshots survive long enough to bridge a debugging session.

> **Use case:** during a tricky incident, screenshot the broken state, attach to a manual log entry with context. Admin reads on next sweep.

### 15.3 Hidden admin tabs

| Tab | URL | Why hidden from team |
|-----|-----|------------------------|
| Audit | `/atelier/audit` | Pending approvals, audit log, version restore. See [`ADMIN_GUIDE.md §24`](./ADMIN_GUIDE.md). |
| Broadcast | `/atelier/broadcast` | Social diffusion queue. [`ADMIN_GUIDE.md §25`](./ADMIN_GUIDE.md). |

---

## 16. Maps index — `/maps` — ✓ Live

Index of saved cloud constellation maps. Each row opens `/atelier/constellation?map=<uuid>` in frozen mode.

> **Use case:** share the index URL with a collaborator who doesn't want to navigate Atelier. They can preview the maps you saved.

---

## 17. PWA & offline (Slice 1 Phase 1)

### 17.1 Install on iPhone — ✓ Live

See §3.3. App opens at `/hub`. Apple touch icon comes from [`public/pwa-icon-180.png`](../public/pwa-icon-180.png) (180 × 180 PNG, generated from `pwa-icon-192.png` via Sharp). Manifest icons (`/manifest.webmanifest`) stay at 192 / 512.

### 17.2 Share target — ✓ Live

The PWA manifest declares a `share_target` POST handler at `/atelier/share-receive`. Field names: `title`, `text`, `url`, plus file parts. When you Share from Lightroom / Photos, the OS POSTs to this handler.

> Static mirror exists at [`public/manifest.webmanifest`](../public/manifest.webmanifest) — keep in sync with the dynamic one in [`app/manifest.ts`](../app/manifest.ts) when fields change.

### 17.3 Offline blob queue — ✓ Live

When the network is down, the WorkForm save path falls back to an **IndexedDB queue**.

Data stores:
- `workSaveQueue` — FormData snapshots.
- `workSaveBlobs` — extracted binary files keyed as `blob-<index>`.

Legacy v1 records (string arrays) are auto-migrated to v2 (Blob objects) on read.

On reconnect, **`AtelierOfflineFlush`** drains the queue and re-submits each save in order. You see toasts as each flushes.

> **Don't:** uninstall the PWA while saves are queued — IndexedDB lives in the PWA storage scope. Reinstall doesn't restore it.

### 17.4 Service worker cache buckets — ✓ Live

Serwist-driven. Buckets (defined in [`app/sw.ts`](../app/sw.ts)):

| Bucket | Strategy | TTL / entries |
|--------|----------|----------------|
| `pem-r2-images` | CacheFirst | 30 days, 128 entries |
| `pem-shell-pages` | StaleWhileRevalidate | 24 h, 32 entries |
| `/~offline` | Document fallback | — |

When a navigation fails offline, the fallback page is served.

### 17.5 Phone photo do's and don'ts

> **Do — canonical path:** Lightroom Mobile → Export JPEG → iOS Share Sheet → **PEM Hub** PWA → `/atelier/share-receive` → triage → attach.

> **Don't:** invoke `lightroom-cc://` URLs from inside the PWA. iOS refuses with no error.

> **Don't:** use native `<input capture="environment">` on the work paths (`WorkForm`, `WorkDrawerImageArea`). Exception: business-card capture at `/atelier/capture?mode=card` and Concepts sketch upload **do** use it.

---

## 18. Semantic search & embeddings

### 18.1 Where it appears

- Command palette `Semantic` section (≥ 3 chars).
- Inventory row badges (pending / embedding / error).

### 18.2 When indexing triggers

- On every work save (admin + team).
- On image upload (the cover image may seed the visual embedding).
- Asynchronously: queued in background; you may see **pending** briefly.

### 18.3 Pipeline backends

The app prefers a Vercel embed cache; if unreachable, falls back to a local **Ollama** server (`OLLAMA_ORIGIN`, port 11435 by default).

### 18.4 States in detail

| State | Meaning | What to do |
|-------|---------|-------------|
| ready | All recent works indexed. | Use semantic freely. |
| pending | Some rows are waiting. | Wait or use title search. |
| embedding | The current row is being indexed now. | Same. |
| error | Backend failed for the row. | Ping admin if many rows are errored. |
| unavailable | Embed service down. | Use title search; semantic returns empty. |

---

## 19. Pending edits — what gets queued for admin

The allow-list lives in [`lib/work-pending-keys.ts`](../lib/work-pending-keys.ts) — single source of truth.

### 19.1 Scalar fields that go to the queue

`oeuvre_id, titre, annee, technique, support, format, hauteur, largeur, profondeur, prix, discount, prix_final, status_id, contact_id, commentaires, historique, localisation_id, localisation_detail, tva_rate, broadcast_caption_seed, date_livraison, anonymity_level, presentation_id, image_existing, historique_append`

### 19.2 Checkbox fields

`exposable, broadcast_ready, montee, encadree, catalogued, is_commission, needs_photograph, admin_override_anonymity, is_paid, is_gift, payment_received, is_anonymous`

### 19.3 Multi-value (CSV-joined)

`themes, groups`

### 19.4 Actions that **bypass** the queue (apply immediately)

| Action | Why |
|--------|-----|
| New work via `/atelier/works/new` | No prior state to protect. |
| Batch edit (Curation dock) | Explicit operator multi-select. |
| Catalog persist (Curation dock) | Bulk theme/group attach. |
| Constellation edge insert / delete | Server-action protected. |
| Image upload / replace / reorder / set cover | File operations, not field mutations. |
| Soft-delete a work | Reversible. |
| Mark gift modal | One-shot transition. |

### 19.5 How you know your save was queued

A toast tells you: "Changes queued for admin review" (or French equivalent). The save result is `{ ok: true, pending: true }`. The drawer closes; the underlying `Oeuvres` row is unchanged until admin approves.

### 19.6 If your edit "disappears"

Rejected pending changes don't apply. You'll see the rejection (with reason) in your Hub field pulse / Overview reminders if your admin entered a reason. Ask the admin for context — usually it's because someone else committed a conflicting change first.

---

## 20. Mobile field tool — narrow Atelier chrome

### 20.1 Breakpoint

`useMediaQuery('(max-width: 767px)')` is the trigger. Below 767 px the narrow rules engage.

### 20.2 Safe-area padding

Sticky bars use `max(<n>px, env(safe-area-inset-bottom))` to clear the iPhone home indicator.

### 20.3 Narrow sidebar order — Field group first

`inventory → production → stock-take → notes → map` — phone-first ordering, optimised for studio walkthroughs.

### 20.4 Sticky primary actions, mobile bar, voice note sheet

- Drawer save footer sticky (mobile only).
- Mobile bottom bar always visible when no drawer is open.
- VoiceNoteSheet pops from the bottom and recordes via the platform mic.

### 20.5 Layout constraints

- Verified at **375 px**; minimum no-break at **~ 360 px**.
- No horizontal scroll, no clipped controls.
- Tap targets ≥ **44 px**.
- Primary action always reachable without scrolling on a one-handed phone hold.

### 20.6 Phone work-image canonical flow

Lightroom Mobile → Export JPEG → iOS Share Sheet → **PEM Hub** → `/atelier/share-receive` → `/atelier/share-triage` → **Add to work session** *(admin)* / **New work** *(team)*.

Exceptions where native `capture="environment"` is allowed:
- `/atelier/capture?mode=card` (business cards).
- Field session new-shot upload (admin path).
- Concepts sketch upload.

---

## 21. Recent features (with status)

| Feature | Badge | Use |
|---------|:----:|-----|
| Tab URLs (25 segmented) | ✓ | Bookmark every tab. |
| Persistent shell | ✓ | Tab switches keep state. |
| Constellation + graph | ✓ | Constellation + Reports → Pivot Atlas. |
| Semantic search | β | ⌘K, ≥ 3 chars. |
| Embedding badges | ✓ | Inventory rows. |
| Pivot Atlas | ✓ | Reports → Pivot. |
| FR / EN UI | ✓ | Header toggle. |
| PWA share target | ✓ | Lightroom → Share → PEM Hub. |
| Work sessions + Journal | ✓ (team read) | Hub Session → Journal. |
| Pending review for safer edits | ✓ | Drawer save → admin Audit. |
| Portfolio PDF themes appendix | ✓ | Portfolio → Generate. |
| PWA offline queue | β | Saves while offline; flush on reconnect. |
| Floor plan walls (Exhibitions) | ✓ | Drag works onto walls. |
| Calendar export (Google / Microsoft) | ✓ | Exhibitions tab. |
| Inventory paste-ID search | ✓ | Inventory search field. |

---

## 22. Troubleshooting

| Problem | Try |
|---------|-----|
| 500 / blank after dev change | Hard refresh; admin restarts dev with clean `.next`. |
| Save stuck "pending" | Admin → `/atelier/audit` → Review. |
| Semantic search empty | Shorter query; exact title in `Works` palette section; wait for indexing. |
| Share missing from Lightroom Sheet | Re-add PWA to Home Screen; share **JPEG** not RAW. |
| Reports don't match the "real" archive | Load all catalogue batches first (the subset banner shows when partial). |
| Delete image fails | Expected for team — ⚠ admin only. |
| Wrong map pin | Fix `contact_addresses` row's city/country; or update `Contact.Ville/Pays`. |
| Phone image upload loses detail | Use the canonical Lightroom → Share pipeline (§17.5). |
| Offline queue not flushing | Reload after reconnect; IndexedDB might be locked by another tab. |
| Calendar OAuth bounced back to login | Likely `NEXT_PUBLIC_SITE_URL` mismatch; ask admin to verify env. |
| Phone OAuth bounces to production | Use `DEV_AUTO_LOGIN_*` on LAN; don't OAuth from `192.168.*`. |
| Drawer won't close | Unsaved guard fired; look for the modal behind the drawer. |
| Curation dock didn't appear | You have 0 works selected. |
| Theme delete blocked | Theme still referenced; un-attach works first. |
| Process delete failed | Check `exhibition_process_id` — use Exhibitions tab's delete which clears the FK. |
| Work I created last week missing | Was it soft-deleted? Ask admin to `restoreSoftDeletedWorks([id])`. |

---

## 23. Glossary

| Term | Meaning |
|------|---------|
| **Oeuvre** | A row in `Oeuvres` — a single artwork. |
| **OeuvreStatus** | Lookup table for ownership stage (Artist, Reserved, Sold, …). |
| **suivi_process** | A pipeline row: vente, exposition, residence, expedition, consignment, … |
| **suivi_etape** | A step inside a `suivi_process`. |
| **suivi_reminder** | A reminder linked to a process or work. |
| **Exposition** | A `suivi_process` row with `type = 'exposition'`. |
| **Pipeline ↔ Exhibition** | Pipeline rows can reference an exposition via `exhibition_process_id`. |
| **Consignment** | Work placed at a gallery — ownership not transferred. |
| **broadcast_ready** | Boolean flag on a work — operator-set; gates inclusion in the social diffusion feed. |
| **broadcast_caption_seed** | Operator hint text for AI caption generation outside the app. |
| **anonymity_level** | 0..N; controls how much is shown on the public site. |
| **pending_changes** | Queue table where team-member existing-work edits land for admin review. |
| **oeuvre_versions** | Snapshot table — DB trigger writes OLD row on every `Oeuvres` UPDATE. Used for admin version restore. |
| **working_group** | A reusable curated set of works. |
| **theme** | Public-facing grouping; drives portfolio sections. |
| **OeuvreTheme** | Junction table — many-to-many works ↔ themes. |
| **tblrelations** | Edge table for the Constellation graph. |
| **work_action** | Per-work pipeline action rows (Photographier = 6, Cataloguer = 9). |
| **work_session** | Field session row; payload JSON; team-readable, admin-writable. |
| **share_inbox** | Inbox of incoming shares from the PWA share target. |
| **studio_task** | Issues / tasks surfaced on Hub field pulse. |
| **system_log** | Audit log + manual operator ledger entries. |
| **vault** | Document storage (contracts, COAs, bibles, …). |
| **bible** | `document.kind = 'bible'` — the latest narrative architecture PDF. |
| **COA** | Certificate of authenticity. Generated as PDF, stored in vault. |
| **R2** | Cloudflare object storage. EU endpoint only (`https://<account>.eu.r2.cloudflarestorage.com`). |
| **Recettes** | French for "revenues" — the income side of Fiscal. |
| **BNC** | Bénéfices Non Commerciaux — French tax regime for visual artists. |
| **`is_team()`** | Supabase RPC; returns true if your Contact row has `is_team = true`. |
| **`is_admin()`** | Supabase RPC; returns true if your Contact row has `is_admin = true`. |
| **Persistent portal shell** | The Atelier app keeps catalogue state in memory across tab switches. |
| **Subset banner** | UI warning that the loaded catalogue is partial. |
| **Curation dock** | Floating bar with batch actions when 1+ works are selected. |
| **Semantic search** | Embedding-based meaning search in the command palette. |
| **PWA share target** | The OS Share Sheet entry for PEM Hub. |
| **Lightroom roundtrip** | Edit in Lightroom Mobile → export JPEG → Share → PEM Hub. |

---

## 24. Public site & partner portals

Atelier and Hub are the **back office**. The pages in this chapter are what the outside world sees: indexable marketing pages, the certificate verifier that QR labels point at, printable card sheets, and the two login-gated **partner portals** (collector + gallery). Some of this is "you configure it in Atelier and forget about it" — but knowing what's there saves you from "wait, where does that link go?" moments.

### 24.1 Public surfaces at a glance

| URL | Visible | Indexable? | Login? | What it is |
|-----|---------|:---:|:---:|------------|
| `/` | public | ✓ | — | Landing page (orbits + language toggle + optional portfolio PDF popup). |
| `/works` | public | ✓ | — | Public portfolio — collections from Atelier → Site / Portfolio config. |
| `/practice` | public | ✓ | — | Artist practice / démarche. |
| `/about` | public | ✓ | — | Biography / CV. |
| `/enquiry` | public | ✓ | — | Visitor contact form. Optional `?oeuvre_id=` / `?sale_order_id=` routes the inquiry. |
| `/verify/[certId]` | public | — (no robots block, but no inbound links) | — | COA verify (QR target). Service-role read, no anon key. |
| `/card` | public | ✗ `noindex` | — | Printable business-card sheet (two cards per page, front + back). |
| `/c/[token]` | public | ✗ `noindex` | — | **Private selection link** — token-validated server-side, never anon-readable. |
| `/collection/[collector_id]` | partner | ✗ `noindex` | ✓ | Collector portal. RLS: `Contact.auth_user_id = auth.uid()` AND `ContactID = collector_id`. |
| `/galerie/[gallery_id]` | partner | ✗ `noindex` | ✓ | Gallery partner portal. Same RLS plus `Contact.Role = 'gallery'`. |
| `/maps` | team | ✗ | ✓ | Cloud constellation map index — §16. |
| `/robots.txt` | public | — | — | Blocks `/atelier`, `/hub`, `/galerie`, `/collection`, `/maps`, `/login`, `/card`, `/c/`, `/api/`, `/auth`, `/_next/`. |
| `/sitemap.xml` | public | — | — | Lists `/`, `/works`, `/about`, `/practice`, `/enquiry`. |
| `/manifest.webmanifest` | public | — | — | PWA manifest + share-target declaration. |
| `/Atelier_Studio_Bible.pdf` | public | — | — | Signed-URL redirect to latest `document.kind = 'bible'`. |

> **Why /verify isn't in the sitemap.** Cert IDs are owner-only knowledge; we don't broadcast them. The QR-printed label is the entry point.

### 24.2 Landing `/` — ✓ Live

**File.** [`app/page.tsx`](../app/page.tsx) → [`components/public/LandingPage.tsx`](../components/public/LandingPage.tsx).

| Surface | Behaviour |
|---------|-----------|
| Hero image | Loaded from R2 (`config.landing.hero_image_url`), falls back to `LANDING_HERO_IMAGE_URL`. |
| Orbits | Animated rings; `WavingCircle` component. |
| Wordmark | Top-left; artist name from `config.general.artist_name`. |
| Language toggle | Top-right FR / EN; persists in your i18n context. |
| Nav drawer | Hamburger → links to `/works`, `/about`, `/practice`, `/enquiry`. Hidden routes from `config.site_blocks` are filtered. |
| Optional **Portfolio PDF popup** | If configured in landing config, opens `LandingPdfPopup`. |
| **Visitor tracking** | `trackView('/', referrer, null, visitorId)` fires on mount; visitor id from `getOrCreatePublicVisitorId()` (cookie-based). |
| **SEO** | `generateMetadata()` writes title / description / OG image / Twitter card. `robots: index, follow`. |

> **Do:** keep `config.general.artist_name` accurate — it lands in Open Graph + Twitter Card metadata.

> **Don't:** rely on landing for discovery if you've hidden `/works` via `site_blocks` — drawer will be empty.

> **Advanced — nav order.** `config.site_blocks[]` has both `hidden` and `order` semantics — Atelier → Site tab is where you control these.

### 24.3 Public works `/works` — ✓ Live

**File.** [`app/works/page.tsx`](../app/works/page.tsx) → `WorksClient` component.

Renders the **portfolio collections** you configured in Atelier → Portfolio / Site. The data model:

| Concept | What it holds |
|---------|----------------|
| **Mode** (`WorksMode`) | Top-level container (e.g. "Paintings 2024"). Layout: `carousel` or `grid`. |
| **Collection** (`WorksCollection`) | Theme-bound subset. Has FR/EN titles, descriptions, intro/outro, `manual_work_order[]`. |
| **manual_work_order** | Array of `OeuvreID`s overriding theme default order. |
| **Theme link** | Falls back to `OeuvreTheme` junction when `manual_work_order` empty. |

URL params:
- `?lang=fr` / `?lang=en` — language override (also linked from `<link rel="alternate" hreflang>`).
- `?mode=<id>` — open a specific mode.

Public works are filtered by:
- `deleted_at IS NULL`
- `is_public = true` (status_id in `STATUS_IDS_PUBLIC = {2, 4, 6, 7, 8, 11}` — see §6.5).
- `anonymity_level` filters / redacts depending on flag (admin override possible).

> **Use case:** the moment you flip a work to a publishable status_id, it appears here within the next page revalidation.

> **Don't:** publish a work that's still missing dimensions or a cover image — the public layout pages look odd without them. The Atelier Overview "missing dims / images / location" card catches this.

> **Pitfall:** `manual_work_order` is by `OeuvreID` only. If you soft-delete a work in the array, its slot becomes a gap on the public page until you remove the ID.

### 24.4 Practice `/practice` and About `/about` — ✓ Live

Static / config-driven copy pages. Bilingual via `useI18n().t(key)`. The content lives in your portfolio config + i18n dictionaries.

> **Do:** edit through Atelier → Site / Portfolio config rather than touching the i18n dictionary directly.

### 24.5 Enquiry `/enquiry` — ✓ Live

**File.** [`app/enquiry/page.tsx`](../app/enquiry/page.tsx) → [`components/public/EnquiryClient.tsx`](../components/public/EnquiryClient.tsx).

| Field | Notes |
|-------|-------|
| Name, email | Required. |
| Message | Required. |
| Category | `general` / others. Drives where the message routes server-side. |
| `?oeuvre_id=<id>` | Pre-filled; submission writes `inquiry.oeuvre_id`. Use case: a visitor on `/works/[id]` clicks "Enquire about this work". |
| `?sale_order_id=<id>` | After-sales enquiry. Pre-fills `inquiry.sale_order_id`. |
| Contact email + phone | Loaded from `config.general` and rendered alongside the form. |
| Tracking | `trackView('/enquiry', ...)` on mount. |

On submit, a row goes into the `inquiry` table. Admins / team see it via the appropriate Atelier surface (or via direct DB read; the team-facing inbox for `inquiry` lives in the field-inbox flow).

> **Do:** test the link from `/works` → enquiry with a real `?oeuvre_id` before sending it to a collector — the form should show the work context.

> **Don't:** send a sale-order-id link via insecure channels; it's not authentication but it does pre-fill the form with the order reference.

> **Pitfall:** if `contact_email` is missing in `config.general`, the form still sends — but the rendered contact block is empty.

### 24.6 Verify `/verify/[certId]` — ✓ Live (QR target)

**File.** [`app/verify/[certId]/page.tsx`](../app/verify/[certId]/page.tsx) → [`lib/coa-verify.ts`](../lib/coa-verify.ts).

This is where a physical QR sticker resolves. The page is **server-rendered with service-role**:

1. `verifyCoaByCertId(certId)` validates the format (`PEM-<digits>-<alnum>`).
2. Reads `document` where `kind = 'coa'` and `cert_id = <certId>` (service-role bypasses RLS).
3. Reads the matching `Oeuvres` row + Technique + Support.
4. **Recomputes the cert hash** from `certId | OeuvreID | Titre | Année | techLabel | dims` via SHA-256.
5. Compares against the stored `document.cert_hash`.

Possible outcomes:

| Reason | Meaning |
|--------|---------|
| `ok` | Hash matches. Page shows OeuvreID, Title, Year, issued date. |
| `invalid_id` | Cert ID format doesn't match `PEM-<digits>-<alnum>`. |
| `not_found` | No matching `document` row, or its `oeuvre_id` is null. |
| `tampered` | Document row exists but recomputed hash ≠ stored hash. The fields on the work were changed after the COA was issued. |
| `config` | Server missing `SUPABASE_SERVICE_ROLE_KEY`. |

> **Use case:** a collector scans the QR on the back of a painting. The page tells them: "Yes, this is work #1234 by Pem, issued 2024-03-15." If a field was edited after issuance, they see "tampered" — that's a deliberate signal that someone updated the data after the certificate was minted.

> **Don't:** treat `tampered` as fraud detection. It commonly means you legitimately edited a field (e.g. fixed a typo in the title) after the COA PDF was generated. Re-issue the COA via Vault to refresh the hash.

> **Pitfall:** the QR URL is stable per `OeuvreID`. Soft-deleting a work breaks the verify (`not_found`) — restore via admin if needed.

### 24.7 Card `/card` — ✓ Live, ✗ `noindex`

**File.** [`app/card/page.tsx`](../app/card/page.tsx).

Print-only business-card sheet (two cards per A4 page, front + back). QR code via `api.qrserver.com` pointing at `/works`. Email pulled from `PUBLIC_CONTACT_EMAIL` env.

> **Use case:** print on cardstock, cut, hand out.

> **Don't:** rely on the QR's `qrserver.com` provenance for long-term archive — the URL embedded is what matters; the renderer is a thin proxy.

### 24.8 Private selection `/c/[token]` — ✓ Live, ✗ `noindex`

**File.** [`app/c/[token]/page.tsx`](../app/c/[token]/page.tsx).

Token-validated private link. Designed for sharing a curated working group with a named recipient (e.g. a gallerist, a curator) without an account.

| Behaviour | Detail |
|-----------|--------|
| Auth | **Service-role only** — anon key is forbidden in this file (comment makes the rule explicit). |
| Token check | `private_link` row by `token`. 404 if not found. |
| Expiry | `expires_at`. If past, 404. |
| Tracking | Each visit increments `view_count` and updates `viewed_at`. |
| Works listed | `working_group_work` joined to `Oeuvres` for `link.group_id`, ordered by `position`. |
| Layout | `PRIVATE_LINK_SELECTION_CSS` — print-friendly serif layout, thumbnail + title + year + dims + "Price on request". |
| Language | `?lang=en` (default `fr`). |
| Recipient | `link.recipient_name` rendered as "For <name>" in the header. |
| Footer | "Do not share" reminder. |

There is **no admin tab** to create private links from the UI today — see the admin guide's note (the table exists, the creation flow is operator-only). Working groups created in Curation dock + Themes are the source of `group_id`.

> **Use case:** present a sub-selection to one collector by name, time-boxed (expire in 30 days), with view tracking to know when they opened it.

> **Don't:** share the URL on a public channel — though indexing is blocked, the URL is the auth.

> **Pitfall:** if the working group becomes empty (you removed all members), the page renders an empty list — verify before sending.

### 24.9 Collector portal `/collection/[collector_id]` — ✓ Live, login required

**File.** [`app/collection/[collector_id]/page.tsx`](../app/collection/[collector_id]/page.tsx) → `PortalLayout`.

Login-gated portal showing **works the collector owns** (their `AcheteurID` on `Oeuvres`).

Auth chain:
1. `auth.getUser()` — must be signed in.
2. `Contact.auth_user_id = user.id AND ContactID = collector_id` — 404 if not the collector themselves.
3. Loads `Oeuvres` where `AcheteurID = collector_id AND deleted_at IS NULL`, ordered by year desc.

| Element | Behaviour |
|---------|-----------|
| Title | "Collection Privée" |
| Subtitle | Collector first + last name |
| User name | Their auth email |
| Works | List with thumb + meta |

> **Use case:** the collector signs in (via Google with the email you've set on their `Contact` row) and sees their pieces. Stable URL — bookmark-friendly.

> **Don't:** create a `/collection/<id>` link before adding the collector's `auth_user_id` — they'll 404. The flow: invite by email → they sign in once (OAuth callback) → admin links `auth_user_id` on their Contact row → portal works.

> **Pitfall:** soft-deleted works (`deleted_at IS NOT NULL`) are filtered out — if a sold work shows missing, check `Oeuvres.deleted_at`.

### 24.10 Gallery portal `/galerie/[gallery_id]` — ✓ Live, login required

**File.** [`app/galerie/[gallery_id]/page.tsx`](../app/galerie/[gallery_id]/page.tsx) → `PortalLayout`.

Login-gated portal for **galleries holding works on consignment**.

Auth chain:
1. `auth.getUser()` — must be signed in.
2. `Contact.auth_user_id = user.id AND ContactID = gallery_id AND Role = 'gallery'` — 404 otherwise.
3. Loads `consignment` rows for `gallery_contact_id = gallery_id AND ended_at IS NULL`, joined to `Oeuvres`.

| Element | Behaviour |
|---------|-----------|
| Title | "Espace Galerie" |
| Subtitle | Institution name |
| User name | Auth email or "Admin" |
| Works | Active consignments |

> **Use case:** the gallery's admin signs in to see what's currently with them. Useful for sales conversations, stocktakes.

> **Don't:** mark a consignment `ended_at` until the work is physically back — the portal stops showing it the moment that field is set.

### 24.11 SEO surfaces — `/sitemap.xml` and `/robots.txt`

**Files.** [`app/sitemap.ts`](../app/sitemap.ts), [`app/robots.ts`](../app/robots.ts).

**Sitemap** lists only: `/`, `/works`, `/about`, `/practice`, `/enquiry`. `lastModified = now`, `changeFrequency = 'weekly'`. Priority 1.0 on `/`, 0.8 on others.

**Robots** allows root, **disallows** `/atelier`, `/hub`, `/galerie`, `/collection`, `/maps`, `/login`, `/card`, `/c/`, `/api/`, `/auth`, `/_next/`.

> **Do:** if you add a new public page (e.g. `/series/[id]`), edit both files. Otherwise crawlers won't find it.

> **Don't:** add `/card` or `/c/` to the sitemap — they're intentionally `noindex`.

### 24.12 PWA manifest — `/manifest.webmanifest`

**Files.** [`app/manifest.ts`](../app/manifest.ts) (dynamic, authoritative) + [`public/manifest.webmanifest`](../public/manifest.webmanifest) (static mirror — keep in sync).

Notable fields:

| Field | Value |
|-------|-------|
| `start_url` | `/hub` — PWA opens there. |
| `icons` | 192 / 512. |
| `share_target` | POST to `/atelier/share-receive`, fields `title`, `text`, `url`, files. This is what registers PEM Hub in the OS Share Sheet. |
| Apple touch icon | `/pwa-icon-180.png` (referenced from [`app/layout.tsx`](../app/layout.tsx)). |

> **Do:** test the share target on a real device after any change to either manifest file — iOS caches manifests aggressively (you may need to delete + re-add the home-screen entry).

### 24.13 Studio Bible redirect — `/Atelier_Studio_Bible.pdf`

A pseudo-route that redirects to a **short-lived signed URL** for the latest `document.kind = 'bible'` in the vault.

> **Use case:** share the static URL with a collaborator — it always resolves to the most recent bible.

### 24.14 How Atelier config drives the public site

| Atelier tab | Config slice | Affects |
|-------------|--------------|---------|
| **Site** (`/atelier/site`) | `site_blocks[]`, `general.*` | Nav drawer order, hidden routes, artist name, contact info. |
| **Portfolio** (`/atelier/portfolio`) | `sections`, `works_modes[].collections`, `manual_work_order` | `/works` layout, PDF portfolio. |
| **Analytics** (`/atelier/analytics`) | Tracking config | What `trackView()` reports. |

The public pages read from R2-cached config via `loadPortfolioSectionsCached()` — changes propagate after next revalidation or `revalidatePath('/')` on save.

> **Pitfall:** if the public site looks stale after you edited config, force a hard reload (Ctrl+F5) — the cache may still serve the previous payload for a beat.

### 24.15 Visitor tracking

| Helper | What |
|--------|------|
| `getOrCreatePublicVisitorId()` | Long-lived cookie / localStorage visitor id. |
| `trackView(path, referrer, oeuvreId, visitorId)` | Sends a public view event. |
| Atelier → Analytics | Consumes the events. |

> **Don't:** assume EU GDPR compliance is automatic — the visitor id is pseudonymous but persistent. Document its lifetime in your privacy notice.

### 24.16 Do's, Don'ts, Pitfalls — chapter summary

> **Do:** treat the public site as a downstream of Atelier config. The truth is in your Site / Portfolio tabs; the public render is a consequence.

> **Do:** test `/verify/<certId>` after every COA regen — it's the one public surface where data drift causes a `tampered` outcome.

> **Don't:** edit i18n dictionaries to change public copy — use the Site config in Atelier.

> **Don't:** share a `/c/<token>` link in any context where it could be archived publicly (Twitter / public Slack / mailing list). The token IS the access control.

> **Pitfall:** the partner portals (`/collection`, `/galerie`) depend on the partner having an `auth_user_id` linked on their `Contact` row. Without that link they can sign in but the portal 404s.

---

## 25. Optional reading

| Doc | For |
|-----|-----|
| [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) | Admin-only chapters (Audit, Broadcast, restore, purge, conflict queue, capture). |
| [`CONSTELLATION.md`](./CONSTELLATION.md) | Constellation canvas curator contract. |
| [`BROADCAST.md`](./BROADCAST.md) | Broadcast pipeline contract. |
| [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) | Make / n8n orchestration outside the repo. |
| [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) | Daily pg_dump + R2 lifecycle. |
| [`PROJECT_SYNTHESIS.md`](./PROJECT_SYNTHESIS.md) | Stack and architecture overview. |
| [`SITE_MAP.md`](../SITE_MAP.md) | Engineer reference — all routes, RSC loaders, hooks. |
| [`SYSTEM_LEDGER.md`](./SYSTEM_LEDGER.md) | System tab's MD source. |

*Admin engineering handoffs (Slice plans) live in `docs/archive/`.*

— end —
