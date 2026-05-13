# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

🦖 CAVE-CLAUDE: STRICT RULES
CAUTION > SPEED.
THINK FIRST: <thinking> block mandatory. Plan steps. Surgical edits only.
NO AUTONOMY: No "GO" = No file edit.
KISS: Minimal code. 50 lines > 200 lines. No bloat.
CONFIRM DELETE: Always ask.
COMMIT COMPLETE: Before every commit, run git diff --stat. Stage ALL modified source files. Never partial-commit. Exclude only build artifacts (tsconfig.tsbuildinfo, .next/).
WORKTREE CLEANUP: At session end, remove all claude/* worktrees and branches except the active one. git worktree remove --force + git branch -D + git worktree prune.
CAVEMAN CHAT: Stop verbosity. No "I've updated..." or "Here is...". Code only. 1-3 word status max.
UI: bilingual only — obey 🌐 UI COPY when touching user-facing text.
RESPONSIVE: obey **📱 MOBILE FIELD-TOOL** below (concept + contract; authoritative).

🛠️ CMDS
Next.js 15 (port 3000). npm dev | build | lint. No tests.
Real app path: C:\Users\pppee\Documents\Claude\Projects\Art db\app
Worktree edits → copy to real app (dev server runs from real app).
DEV SERVER: run `pwsh scripts/dev.ps1` from real app — kills port 3000, prints LAN IP for phone testing.
WORKTREE START: immediately create `.claude/launch.json` = `{"version":"0.0.1","configurations":[]}` in the worktree root. This blocks the preview tool from walking up and stealing port 3000 with a no-env server.

🏗️ ARCHITECTURE
- Next.js 15 App Router + Supabase + Cloudflare R2 (images)
- Server Components fetch data, pass to Client Components
- Mutations: Server Actions ('use server') in app/**/actions.ts only. **Exception:** Route Handlers for OAuth callbacks (`app/auth/callback`, `app/api/calendar/*/callback`), read-only or external integration routes under `app/api/` (e.g. geocode, inventory broadcast) — not a substitute for domain mutations in actions.
- Auth: Supabase SSR middleware enforces auth on all /atelier /hub /galerie routes. Admin = `is_admin()` RPC (joins `Contact.is_admin` via `auth_user_id`); editors = team but not admin. Old `profiles.role` is dead.
- i18n: see **🌐 UI COPY** below (non-negotiable for anything user-facing)
- Image upload: Sharp → 400px AVIF thumb → R2 via AWS S3 SDK
- Supabase clients: createClient() (anon, RLS enforced) · createServiceClient() (service_role, admin bypass)
- **R2 endpoint: ALL buckets are EU jurisdiction** → always use `https://<account_id>.eu.r2.cloudflarestorage.com`. Never use the global endpoint (no `.eu.` = NoSuchBucket or BadRequest). Applies to app SDK config, backup scripts, and any new tooling.

🌐 UI COPY (bilingual — non-negotiable)
All user-visible copy → `useI18n().t(key)` + `lib/i18n/dictionary.ts` (**DictKey** + **`dict.fr` + `dict.en`** each time). Exceptions: DB text, proper nouns, immutable data. **Scrutiny:** before finish, sweep the diff for JSX string literals & `alert`/`confirm`/titles/placeholders — hardcoded FR/EN = fix.
**Locale:** `toLocale*` / Intl → drive from **`lang`** (`fr-FR` vs `en-GB`), not a hardcoded locale.
**Label maps:** if UI showed one static language map → wrong; use **`lang`** branch or paired dict keys (see `pipelineTypeLabel`).
**Server Components:** no `useI18n` → pass translated strings down, client leaf, or `dict[lang][key]` at read time. **Speed:** add all keys for the feature in one edit; copy patterns from `TeamPortalClient` · `PipelineTab`.

📱 MOBILE FIELD-TOOL
**Concept**: Handset = **atelier field terminal** — photograph works, fix metadata, nudge pipeline on site. Desktop = primary home for heavy PR/CRM, wide dashboards, and dense boards (e.g. Concepts/constellation); phone must still **not break** there, but need not duplicate desktop power-user layout.
**Contract** (SE-class viewports):
- **Breakpoints & QA**: Use `max-width: 767px` for mobile layout branches (`useMediaQuery('(max-width: 767px)')`). Verify at **375px** (iPhone SE). Treat **~360px** as the minimum width that must not break; do not rely on narrower viewports without justification.
- **Layout**: No horizontal page scroll; no clipped controls; preserve core actions in compact layouts. No desktop-only fixed widths (`width: 460`, `padding: 60px`), multi-column grids, or side-rails without a narrow branch.
- **Touch & forms**: Minimum **44px** tap targets on primary actions (buttons, toggles, image-add). **Save** (or primary commit) must stay reachable without scrolling. Top/bottom bars and sticky footers pad for `env(safe-area-inset-*)`; use `max(..., env(safe-area-inset-bottom))` on sticky actions where needed.
- **Capture-first uploads**: On mobile, image inputs may use `capture="environment"` when appropriate.
- **Downstream check**: If `/hub` adds or changes a mobile entrypoint, smoke **WorkForm**, **WorkDrawer**, and at least **Inventory** on a small viewport.
- **Atelier sidebar (narrow)**: First group **Terrain / Field** — tabs `inventory` → `production` → `stock-take` → `overview`, then existing buckets (`TeamPortalClient` `GROUPS` when `atelierNarrow`).

**Drawer / panel edit guard (modals & side editors)**  
- Serialize form + nested lists → baseline string; `isDirty` when current payload ≠ baseline.  
- **Save** persists then proceeds; **Discard** proceeds without saving (loses edits); **Cancel** only closes the dialog.  
- Reuse `hooks/useUnsavedActionGuard.tsx` for any deferred navigation (`activeId`, tab, route); `useUnsavedCloseGuard` wraps it for “close overlay” (`onProceed` = `onClose`).  
- Narrow viewports: same sticky primary actions + safe-area padding as **📱 MOBILE FIELD-TOOL** contract above; `max(..., env(safe-area-inset-bottom))`. Do not stack read-only text and inputs in the same table cell (overlap).  
- Reference: `components/atelier/ContactsTab.tsx` + `ContactEditorPanel.tsx`.

📁 KEY FILES
- lib/i18n/dictionary.ts · context.tsx — all UI strings (fr/en)
- lib/data.ts — imageUrl(), thumbUrl(), yearOf(), statusOf(), makeFilename()
- lib/supabase/client.ts — browser client
- lib/supabase/server.ts — server + service client
- lib/work-editor-model.ts — shared prod/ownership stages + `computeStatusId` for WorkForm + WorkDrawer
- app/atelier/page.tsx — loads all reference data in parallel (up to 5000 rows), builds lookup maps
- components/atelier/TeamPortalClient.tsx — main orchestrator (tabs, selection, drawer); reads `?work=` on load (`runGuarded`); dirty drawer → unsaved prompt on Hub + `beforeunload` on tab close
- components/atelier/InventoryTab.tsx — inventory list + panel
- components/atelier/WorkDrawer.tsx — **canonical edit** for existing works: prod/ownership pipes, finance, notes, themes/groups, images (incl. delete), gift flow, `saveWork` + guards (`runGuarded`, `?work=` deep link via `TeamPortalClient`). Overlay + inventory panel modes.
- components/atelier/WorkForm.tsx — full-page **create only** at `/atelier/works/new` (shared `saveWork`). `/atelier/works/[id]/edit` redirects to `/atelier?work=<id>` (drawer).
- components/atelier/ContactEditorPanel.tsx — Hub Contacts full editor in the right column / stacked on mobile (`ContactsTab` orchestrates selection, `useUnsavedActionGuard` on row switch / batch / merge).
- app/atelier/works/actions.ts — image upload, delete, work CRUD; `requireAdmin()` gates `purgeWorkPermanently` + `deleteWorkImage`; `saveWork` queues editor edits to `pending_changes` unless `__skip_review=1`.
- app/atelier/audit/{actions,pending-actions,version-actions}.ts — audit ledger, approval queue, version history (all admin-gated via `is_admin()` RPC)
- components/atelier/{AuditTab,PendingQueue,WorkVersionHistory}.tsx — admin protection UIs (Audit Log → Ledger / Review tabs; history panel inside WorkDrawer)
- components/atelier/BroadcastTab.tsx — Diffusion tab (Queue / Publiés / Activité subtabs); admin-only via `requireAdminGuard()`
- app/atelier/broadcast/actions.ts — `listBroadcastDashboard()`, `clearStuckQueue()`; all admin-gated
- app/api/inventory/broadcast/{feed,queue,confirm,event}/route.ts — Make/n8n API; Bearer `INVENTORY_BROADCAST_SECRET`; `broadcast_caption_seed` flows through feed → AI caption pipeline
- app/atelier/calendar/actions.ts + `lib/calendar/*` — exhibition (`suivi_process` / `suivi_etape`) → Google Calendar / Microsoft Graph (one-way export; manual sync in UI). Env: see **📅 CALENDAR SYNC** below.

**Deferred integrations (no GO = do not implement)**  
- **Background jobs / queues:** long-running or retriable work off the Server Action path (timeouts, PDF at scale, bulk R2/geocode). Pointer: [`app/atelier/portfolio/pdf-action.ts`](app/atelier/portfolio/pdf-action.ts). `app/api/inventory/broadcast/` is for **external** callers, not an internal job runner.  
- **Vision / OCR:** field capture (labels, cards, forms) → draft fields + human confirm; mind EU/data sensitivity; align with **📱 MOBILE FIELD-TOOL** (same caution as Phase B — no silent commits).  
- **Transactional email (Resend/Postmark-class):** adopt when offline alerting or **external** recipients matter; if wired from DB webhooks use an **outbox + idempotency** pattern.

📅 CALENDAR SYNC (Google + Microsoft, v1)  
- **User tables:** `calendar_account`, `calendar_event_link` (migration `supabase/sql/calendar_sync.sql`). Tokens encrypted at rest (`CALENDAR_TOKEN_ENCRYPTION_KEY` = 32-byte secret, hex or raw).  
- **OAuth:** `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`; `MICROSOFT_CALENDAR_CLIENT_ID` / `MICROSOFT_CALENDAR_CLIENT_SECRET`; `MICROSOFT_CALENDAR_TENANT` (often `common`). Redirect URIs: `{origin}/api/calendar/google/callback` and `{origin}/api/calendar/microsoft/callback`.  
- **CSRF:** `CALENDAR_OAUTH_STATE_SECRET` (HMAC for `state` param).  
- **App URL:** `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL` (origin for OAuth redirect allowlists).  
- **Event copy:** sync uses viewer `lang` at click time for title/body where applicable.

## SITE MAP (routes & diagrams)

- **Canonical route list + Mermaid topology:** [docs/SITE_MAP.md](docs/SITE_MAP.md) (version control). Update it when adding pages, Atelier `?tab=` ids, or first-party `app/api` routes.
- **QA checklist PDF:** Atelier → **System** tab → **Download site map checklist** — on-demand pdfkit export (`exportSiteMapChecklistPdf` in [app/atelier/vault/actions.ts](app/atelier/vault/actions.ts), builder in [lib/site-map-checklist-pdf.ts](lib/site-map-checklist-pdf.ts)).
- **Vaulted narrative PDF:** `/Atelier_Studio_Bible.pdf` — latest `document.kind = 'bible'`; regenerate from System tab (`vaultStudioBible` in [app/atelier/vault/bible-action.ts](app/atelier/vault/bible-action.ts)).

## EXHIBITIONS ↔ PIPELINE

- **Tables:** `suivi_process` (process rows: `vente`, `exposition`, `residence`, `expedition`, `consignment`, …) and `suivi_etape` (per-process steps).
- **Exhibition hub:** Exhibitions tab lists `suivi_process` where `type = 'exposition'` (with schedule dates). Steps and calendar/floorplan tooling hang off that row.
- **Link from pipeline:** `suivi_process.exhibition_process_id` on a **commercial / pipeline** row points to the **`exposition`** row when the deal needs a full exhibition workstream (not a single étape). Created from **Pipeline** process modal: insert `exposition`, then set `exhibition_process_id` on the current process. **Pipeline drawer** → "Open exhibition project" → `/atelier?tab=exhibitions&exhibition=<id>` ([`PipelineTab.tsx`](components/atelier/PipelineTab.tsx)).
- **Delete:** Clearing an exhibition nulls `exhibition_process_id` on referencing processes before delete ([`ExhibitionsTab.tsx`](components/atelier/ExhibitionsTab.tsx)).

💾 DATA LOGIC
Status: Oeuvres.statusId (FK → OeuvreStatus.id).
Themes: OeuvreTheme junction table. Oeuvres.theme = READ-ONLY/DEAD.
Images: tblImage → trigger updates Oeuvres auto.
Dates: Oeuvres.Année = DATE (YYYY-01-01). Use yearOf() in lib/data.ts.
Sort: UI dropdowns = Alphabetical.
Image URLs: imageUrl() / thumbUrl() from lib/data.ts. Never build R2 URLs manually.

🛡️ ADMIN "LAST WORD" (data + asset protection)
**Identity:** Admin = `Contact.is_admin = true` linked via `Contact.auth_user_id = auth.uid()`. RPC `is_admin()` is the single source of truth (server actions, RLS, sidebar `TeamPortalClient`). Old `profiles.role` is dead — never read.

**Phase A — Hard delete = admin only.** `purgeWorkPermanently`, `deleteWorkImage` gated by `requireAdmin()` in `app/atelier/works/actions.ts`. RLS `DELETE` policy on `Oeuvres` + `tblImage` enforces `is_admin()` (defense-in-depth). Editors keep soft-delete (`Oeuvres.deleted_at`) — fully reversible. Migration: `supabase/sql/admin_only_hard_delete.sql`.

**Phase B — Editor edits → approval queue.** Non-admin `saveWork` on existing oeuvres lands in `pending_changes` (jsonb payload + baseline snapshot). Admin reviews via Atelier > Audit Log > **Review** tab — approve replays payload through `saveWork` with `__skip_review=1`; reject marks row + reason. New-work creation stays unqueued (low risk). Migration: `supabase/sql/pending_changes.sql`. Files: `app/atelier/audit/pending-actions.ts`, `components/atelier/PendingQueue.tsx`.

**Phase C — Pre-update version snapshots.** Trigger `oeuvre_version_snap` writes the OLD row to `oeuvre_versions` on every `Oeuvres` UPDATE. Admin-only collapsible panel at the bottom of `WorkDrawer` lists versions, diffs vs prior, restores via service-role `restoreOeuvreVersion(versionId)`. Restore itself is logged (creates new snapshot). Excluded from restore payload: `OeuvreID`, `is_public` (trigger), `txtImageNameLink` (trigger), `created_at`. Migration: `supabase/sql/oeuvre_versions.sql`. Files: `app/atelier/audit/version-actions.ts`, `components/atelier/WorkVersionHistory.tsx`.

**Phase D — R2 image soft-delete (app-side, no Bucket Lock).**
R2 has no S3-style Object Versioning and Bucket Lock is too rigid (locks the admin too). Pattern: every R2 delete from `app/atelier/works/actions.ts` goes through `r2SoftDelete(key)` which **server-side copies** the object to `recycle/<YYYY-MM-DD>/<key>` (S3 CopyObject via `x-amz-copy-source`, no bytes flow through Node) and only then deletes the original. Falls back to direct delete if the copy fails (object already gone).
- **Cloudflare console step (one-time)**: bucket `paintings` → Object Lifecycle Rules → **Add** rule: prefix `recycle/`, action *Delete objects after 90 days*. Same on `vault` if it ever gets writes.
- **Recovery**: copy the object back from `recycle/<date>/<key>` to its original key, or list `recycle/` via S3 API and POST back through `tblImage` if metadata also lost.
- Helpers in [app/atelier/works/actions.ts](app/atelier/works/actions.ts): `r2Copy(src, dst)`, `r2SoftDelete(key)`. Editor-side delete is already blocked by Phase A `requireAdmin()`; soft-delete is the safety net for the admin's own mistakes.
- Rotate R2 access keys yearly; document the rotation date in this section.

**Phase E — Off-site DB backups.** `.github/workflows/backup.yml` runs `scripts/backup.sh` daily at 03:17 UTC: `pg_dump` Supabase (Session Pooler URL, IPv4) → gzip → upload to `art-db-backups` R2 bucket (EU jurisdiction) via **boto3** (Python). AWS CLI v2 and rclone both produce malformed sigv4 credentials against R2 — boto3 with `region_name='auto'` + EU endpoint is the only confirmed-working upload path. No Object Lock; lifecycle rule auto-prunes `daily/*` after 90 days. GH secrets reuse main R2 credentials (`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` from `.env.local`) mapped to `R2_BACKUP_ACCOUNT_ID` / `R2_BACKUP_ACCESS_KEY` / `R2_BACKUP_SECRET_KEY`. Full setup + recovery: [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md). Quarterly recovery drill: restore latest dump into throwaway Supabase project, spot-check row counts.

**Dev-only auto-login.** `middleware.ts` calls `signInWithPassword` when `NODE_ENV=development` AND `DEV_AUTO_LOGIN_EMAIL`/`_PASSWORD` set. Used in preview iframe to skip Google OAuth. Production never has these env vars set.

🚫 CEMETERY (instant fail)
DEAD COLUMNS: Oeuvres.Statut, Oeuvres.StatutID, tags, txtImageName, Emballage, DocsValidated, UniteDimension
ORPHAN COLS: NomOriginal (→ Titre), Poids, Tirage
DEAD TABLES: tblRelations (→ tblrelations), OeuvreRelationships
NEVER WRITE: Oeuvres.is_public (trigger), Oeuvres.txtImageNameLink (trigger tblimage_cover_sync)
NEW TABLES: snake_case only. No tbl prefix. No CamelCase.

📄 PORTFOLIO PDF
Engine: app/atelier/portfolio/pdf-action.ts → generatePortfolioPdf(opts).
Self-contained: server action loads R2 config (portfolio_sections.json) + Supabase public works internally. No client data prep.

SOURCE PRIORITY for sections (try in order, keep FIRST that claims ≥1 work):
1. raw.sections                       (Atelier > Portfolio tab)
2. raw.works_modes[0].collections     (Atelier > Site public tab) ← user's real config lives here
3. raw.works_collections              (legacy mirror)
If all 0 claims → fallback __all__ virtual section with all public works in DB order.
DIAGNOSTIC: server logs '[portfolio-pdf] source "X": N collections → Y works claimed'. Watch dev console.

WORK ORDER inside a section: manual_work_order[] first (atelier drag order, public+image-bearing only), then theme-matched residual.

LAYOUT by orientation (page aspect × artwork H/W from DB):
- match (P/P or L/L) → full bleed + slim 22% bottom band, 60% black opacity
- mismatch P+L      → image top ~55% on off-white, text panel below
- mismatch L+P      → image left ~55% on off-white, text panel right

COVER WORK: first work whose image actually loaded. EXCLUDED from work pages (no duplication).

🪦 PDFKIT GOTCHAS
ALPHA HEX UNSUPPORTED: `#RRGGBBAA` is parsed wrong → pdfkit takes the last 6 bytes as RGB. `#00000066` → navy, `#000000aa` → royal blue, `#000000cc` → bright blue. SOLUTION: always `doc.fillOpacity(N).rect(...).fill('#RRGGBB').fillOpacity(1)`. Always reset to 1 after, else bleeds into subsequent draws.
NEVER use 8-char hex with pdfkit. Period.
TEXT OVERFLOW: doc.text(longBody, x, y, { width }) without `height` auto-paginates. New auto-pages have no background fill — re-fill if needed.

📦 SHARP / AVIF
sharp 0.34.5 has libheif 1.20 → AVIF input works via the `heif` format key. No special config. AVIF is NOT a problem for portfolio image processing.
