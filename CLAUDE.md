# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

🦖 CAVE-CLAUDE: STRICT RULES
CAUTION > SPEED.
THINK FIRST: <thinking> block mandatory. Plan steps. Surgical edits only.
NO AUTONOMY: No "GO" = No file edit.
KISS: Minimal code. 50 lines > 200 lines. No bloat.
CONFIRM DELETE: Always ask.
COMMIT COMPLETE: Before every commit, run git diff --stat. Stage ALL modified source files. Never partial-commit. Exclude only build artifacts (tsconfig.tsbuildinfo, .next/).
MAIN TRUTH: `origin/main` is the only release truth. Default work happens on real `main` tracking `origin/main`; checkpoint branches/worktrees are scratch only, never "done".
DONE = PUSHED: Do not say done/clean/shipped unless intended changes are committed, checks are known, and `origin/main` contains the commit. If work is not on `origin/main`, call it "local draft".
NO CHECKPOINT DRIFT: Do not create or rely on checkpoint branches/worktrees unless the repo owner explicitly asks. If temporary isolation is needed, merge/push back to `origin/main` before final.
CAVEMAN CHAT: Stop verbosity. No "I've updated..." or "Here is...". Code only. 1-3 word status max.
UI: bilingual only — obey 🌐 UI COPY when touching user-facing text.
RESPONSIVE: obey **📱 MOBILE FIELD-TOOL** below (concept + contract; authoritative).

**Agent pace (owner preference):** Parallelize independent reads/tools until the slice is done; no fake deadlines. Fast *and* correct — non‑negotiables stay non‑negotiable (RLS/grants, auth, data loss, 🌐 UI COPY).

🛠️ CMDS
Next.js 15 (port 3000). npm dev | build | lint | **typecheck** (`npm run typecheck`). **Supabase TS types:** `npm run gen:types` — writes `lib/types/supabase.generated.ts` from the hosted project (requires `SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`; see `.env.local.example`). E2E: `npm run test:e2e` (Playwright). Hub / mobile bar / field launcher (auth-gated): `npm run test:e2e:field` — sets `ATELIER_E2E=1` via [`scripts/run-atelier-e2e.mjs`](scripts/run-atelier-e2e.mjs); log in once in the dev server profile the tests use. Full suite: `npm run test:e2e` (e.g. atelier œuvres paging bar).
Real app path: C:\Users\pppee\Documents\Claude\Projects\Art db\app
Source of truth: real `main` + `origin/main`. If a temporary worktree is used for safety, it must be reconciled into `origin/main`; copying files is last-resort and must be reported.
DEV SERVER: run `pwsh scripts/dev.ps1` from real app — kills port 3000, prints LAN IP for phone testing. If `/_next/static/*` returns 404, restart dev from this root; delete `.next` and hard-reload if a stale tab outlived a rebuild.
WORKTREE START: immediately create `.claude/launch.json` = `{"version":"0.0.1","configurations":[]}` in the worktree root. This blocks the preview tool from walking up and stealing port 3000 with a no-env server.

🏗️ ARCHITECTURE
- Next.js 15 App Router + Supabase + Cloudflare R2 (images)
- Server Components fetch data, pass to Client Components
- Mutations: Server Actions ('use server') in `app/**/actions.ts` only. **Exception:** Route Handlers for OAuth callbacks (`app/auth/callback`, `app/api/calendar/*/callback`), read-only or external integration routes under `app/api/` (e.g. geocode, inventory broadcast) — not a substitute for domain mutations in actions.
- **Reads (bootstrap):** On-demand or RSC-time reads may live in other `'use server'` modules under `app/atelier/` (e.g. [`reminders-actions.ts`](app/atelier/reminders-actions.ts), [`atelier-data-actions.ts`](app/atelier/atelier-data-actions.ts)) so Server Components and the client shell do not duplicate Supabase `(as any)` queries. **Writes** for domain tables still go through `app/**/actions.ts` (or the route-handler exceptions above).
- Auth: Supabase SSR middleware enforces auth on all /atelier /hub /galerie routes. Admin = `is_admin()` RPC (joins `Contact.is_admin` via `auth_user_id`); editors = team but not admin. Old `profiles.role` is dead.
- i18n: see **🌐 UI COPY** below (non-negotiable for anything user-facing). New feature copy lives in one module under [`lib/i18n/messages/`](lib/i18n/messages/) via `defineMessages()` with FR+EN together. Legacy dictionary keys remain in [`lib/i18n/dictionary/`](lib/i18n/dictionary/) until touched; do not add new feature copy to the old three-file dictionary unless maintaining a legacy surface.
- **ESLint:** `eslint-plugin-pem-i18n` (`file:eslint-rules`) — rule `pem-i18n/no-hardcoded-jsx-text` flags sentence-like JSX literals; legacy allow-off in [`.eslintrc.json`](.eslintrc.json) overrides (SalesTab, …). **Public route metadata:** [`lib/i18n/route-metadata.ts`](lib/i18n/route-metadata.ts) `routeMetadata(route, lang)` + `dict` keys `seo_*`; do not hand-roll duplicate EN blocks on new `page.tsx`.
- Image upload: bytes validated as JPEG/PNG/WebP/GIF/AVIF/HEIC via Sharp before R2 PUT; stored originals normalized to **2100px long-side AVIF** q=50 + Artist/Copyright EXIF only (`uploadImage` in `app/atelier/works/actions.ts`); storage keys `W_{oid}_{seq}_{hash8}.avif` (hash from **raw** input bytes — `lib/image-upload.ts`). Sharp → 400px AVIF thumb → R2 via fetch + SigV4 (same pattern as AWS S3 SDK)
- Supabase clients: createClient() (anon, RLS enforced) · createServiceClient() (service_role, admin bypass)
- **🛂 SUPABASE GRANTS (PostgREST):** Supabase requires explicit **`GRANT`** on `public` tables/views for roles PostgREST uses (`authenticated`, `anon` where the public site writes). Missing privilege → **42501** from the API even when RLS policies exist. **New `public` tables:** same migration (or an adjacent `*_grants.sql` in `supabase/sql/`) must ship `ENABLE ROW LEVEL SECURITY`, policies, and the right `GRANT` lines — copy [`supabase/sql/inquiry.sql`](supabase/sql/inquiry.sql). Recent examples: `work_session`, `voice_note`, `sketchbook` (Verb 1–2 field). **Audit (pre–Oct 30 2026 / new-project deadline):** run the read-only queries in [`supabase/sql/grant_audit_queries.sql`](supabase/sql/grant_audit_queries.sql) in the SQL Editor after schema changes; add migrations for any rows returned. **Calendar tables:** if audit flags them, apply [`supabase/sql/calendar_sync_grants.sql`](supabase/sql/calendar_sync_grants.sql) after [`supabase/sql/calendar_sync.sql`](supabase/sql/calendar_sync.sql). **Consignment / logistics:** if audit lists `consignment_order` / `shipment` / `shipment_work` with RLS on and zero policies, apply [`supabase/sql/consignment_shipment_rls.sql`](supabase/sql/consignment_shipment_rls.sql). Tables intentionally **service_role–only** may appear in the audit — document them in the migration comment rather than widening `GRANT`.
- **R2 endpoint: ALL buckets are EU jurisdiction** → always use `https://<account_id>.eu.r2.cloudflarestorage.com`. Never use the global endpoint (no `.eu.` = NoSuchBucket or BadRequest). Applies to app SDK config, backup scripts, and any new tooling.

🌐 UI COPY (bilingual — non-negotiable)
All user-visible copy → `useI18n().t(key)` + `lib/i18n/messages/*.messages.ts` for new copy (FR+EN side by side). Exceptions: DB text, proper nouns, immutable data. **Scrutiny:** before finish, run `npm run i18n:check`, `npm run typecheck`, and `npm run lint`; sweep the diff for JSX string literals & `alert`/`confirm`/titles/placeholders — hardcoded FR/EN = fix.
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
- **Atelier sidebar (narrow)**: First group **Terrain / Field** — tabs `inventory` → `production` → `stock-take` → `notes` → `map`, then existing buckets (`TeamPortalClient` `GROUPS` when `atelierNarrow`).
- **Rings (shorthand):** **A** — Atelier narrow chrome (subset batch, stacked headers). **B** — Hub field launcher (`HubLauncherClient` `FIELD_ROWS`) + mobile action bar + **Verb 2** [`VoiceNoteSheet`](components/shared/VoiceNoteSheet.tsx) (record / live dictation → `voice_note`). **B.3** — PWA Web Share Target + `share_inbox` + share triage (import form on iOS). **C** — Deep-linked field verb routes that still render [`FieldToolStubPage`](components/atelier/FieldToolStubPage.tsx) for **`/atelier/capture`**, **`/atelier/documents/new`**, **`/atelier/triage`** until replaced; **`/atelier/session/new`** is [`SessionNewClient`](components/atelier/session/SessionNewClient.tsx) (Verb 1); **`/atelier/issue/new`** is [`IssueNewForm`](components/atelier/IssueNewForm.tsx).

**Drawer / panel edit guard (modals & side editors)**  
- Serialize form + nested lists → baseline string; `isDirty` when current payload ≠ baseline.  
- **Save** persists then proceeds; **Discard** proceeds without saving (loses edits); **Cancel** only closes the dialog.  
- Reuse `hooks/useUnsavedActionGuard.tsx` for any deferred navigation (`activeId`, tab, route); `useUnsavedCloseGuard` wraps it for “close overlay” (`onProceed` = `onClose`).  
- Narrow viewports: same sticky primary actions + safe-area padding as **📱 MOBILE FIELD-TOOL** contract above; `max(..., env(safe-area-inset-bottom))`. Do not stack read-only text and inputs in the same table cell (overlap).  
- Reference: `components/atelier/ContactsTab.tsx` + `ContactEditorPanel.tsx`.

📁 KEY FILES
- lib/seo/site-url.ts — `getMetadataBase()` for `metadataBase`, sitemap, robots; env: `NEXT_PUBLIC_SITE_URL` | `NEXT_PUBLIC_APP_URL` (see **App URL** under calendar block).
- app/robots.ts · app/sitemap.ts — crawler rules + indexable public URL list (keep aligned with [`SITE_MAP.md`](SITE_MAP.md)).
- app/page.tsx + components/public/LandingPage.tsx — public home: server `metadata` (title, robots index, OG/Twitter) + client shell.
- lib/i18n/dictionary.ts · context.tsx — all UI strings (fr/en)
- lib/data.ts — imageUrl(), thumbUrl(), yearOf(), statusOf(), seqFromFilename(). **Do not import `lib/i18n/dictionary` here** (this module is bundled on the client); status labels use a local FR+EN `STATUS_LABEL_MAP` → `StatusKey`, not dict keys.
- lib/image-upload.ts — server-only: validateWorkImageBuffer() (Sharp allow-list), makeImageStorageFilename() (content hash + safe ext)
- lib/types/database.ts — shared TS shapes consumed app-wide (e.g. `Oeuvre`, `SuiviReminderListRow`, `WorkSessionRow`, `VoiceNoteRow`, `SketchbookRow`); not a full Supabase dump
- lib/types/supabase.generated.ts — **generated** `Database` type for `createClient<Database>()`; refresh with **`npm run gen:types`** after applying SQL in Supabase (`scripts/gen-supabase-types.mjs`; token + URL in `.env.local`).
- lib/work-pending-keys.ts — allow-listed FormData keys for `pending_changes` queue + admin replay
- lib/supabase/client.ts — browser client
- lib/supabase/server.ts — server + service client
- lib/work-editor-model.ts — shared prod/ownership stages + `computeStatusId` for WorkForm + WorkDrawer
- app/atelier/page.tsx — **slim RSC:** exact œuvre count + **first œuvres chunk** only; reference rows ship as empty sentinels (`team-portal-types`) and hydrate after first paint via server action **`fetchAtelierShellPostPaint`** (contacts, `contact_addresses`, techniques/themes/statuses/groups/presentations in one `Promise.all`). **`atelierShellNonce`** + **`initialIsAdmin`** (`is_admin()` on load). **Not** in this bundle: `exhibition` (ExhibitionsTab self-fetches). **Carte** (`WorldMapTab`) still does its own anon `contact_addresses` read for pins. `initialReminders` + unread count from `reminders-actions`. More œuvres via `fetchOeuvresKeysetPage` in `TeamPortalClient` (no silent 5000-row cap).
- components/atelier/team-portal-types.ts — `TeamPortalClientProps`: serializable RSC → dynamic client shell props (keeps `app/atelier/page.tsx` from importing the full `TeamPortalClient` graph)
- components/atelier/TeamPortalClient.tsx — main orchestrator (tabs, selection, drawer); reads `?work=` on load (`runGuarded`); dirty drawer → unsaved prompt on Hub + `beforeunload` on tab close; **`fetchAtelierShellPostPaint`** on `atelierShellNonce` replaces empty shell props. When `oeuvresPaging.totalCount` exceeds loaded œuvres: **subset banner** (`data-testid="atelier-oeuvres-subset-banner"`), header **loaded/total** badge + tooltip, bottom **load-more** bar (`atelier-oeuvres-paging-bar`), Overview caption (`atelier-overview-subset-caption`), **Rapports** note (`reports-subset-note`), **Thèmes** / **Portfolio** notes (`atelier-themes-subset-note`, `atelier-portfolio-subset-note`); **Inventory** / **Production** + **PivotPanel** `footnote` clarify loaded batch (copy in `lib/i18n/dictionary.ts`).
- components/atelier/InventoryTab.tsx — inventory list + panel; list/grid virtualized (`@tanstack/react-virtual`)
- components/atelier/ReportsTab.tsx — **Rapports** (`?tab=reports`): filters/sorts **loaded** œuvres, XLSX export, PDF via [`generateWorksTablePdf`](app/atelier/reports/actions.ts) (pdfkit; row/column caps). Shared column model in [`lib/reports/works-table.ts`](lib/reports/works-table.ts).
- app/atelier/reports/actions.ts — `'use server'`: `generateWorksTablePdf` (team session; no duplicate domain CRUD here).
- components/atelier/WorldMapTab.tsx — **Carte** (`?tab=map`): client `contact_addresses` select + [`app/api/geocode/route.ts`](app/api/geocode/route.ts) with module **`localStorage`** cache (`pem_geo_cache`). **Contact pins:** use address rows that have `ville` or `pays`; if a contact has **no** such row, fall back to **`Contact.Ville` / `Contact.Pays`** (placeholder-only address rows must not hide the pin). **Works** mode builds a per-contact city/country map (card first, then address supplement). Toolbar **↺ Rafraîchir** clears the geocode cache.
- components/atelier/WorkDrawer.tsx — **canonical edit** for existing works: shell + zoom; image list via server action **`listWorkDrawerImages`** (no browser `tblImage` read). Inner editor under `components/atelier/work-drawer/` — `DrawerContent.tsx` (core form + themes + actions), `WorkDrawerImageArea`, `WorkDrawerPipelineSection`, `DrawerContentFinanceSection`, `DrawerContentNotesVersionSection`, `DrawerContentGroupsSection`, `drawer-content-utils.ts`, `drawer-widgets.tsx`; gift flow, `saveWork` + guards. Overlay + inventory panel modes.
- components/atelier/FieldToolStubPage.tsx — **Ring C** placeholder shell for **`/atelier/capture`**, **`/atelier/documents/new`**, **`/atelier/triage`** (verb-specific copy + deep links). Not used for `session/new` or `issue/new`.
- components/atelier/CommandPalette.tsx — **⌘K palette** (Block B): tab jump, work/contact fuzzy search, quick actions (New work, Export XLSX, Regen bible). Smoke: `tests/command-palette.spec.ts`.
- components/hub/HubLauncherClient.tsx — `/hub` thin launcher (4 tiles + CTA, zero DB queries). Narrow branch `FIELD_ROWS` = Ring B field launcher (8 verbs).
- components/shared/VoiceNoteSheet.tsx — Ring B **Verb 2** capture (mic + optional live dictation) → [`app/atelier/notes/actions.ts`](app/atelier/notes/actions.ts) `createVoiceNote`; opened from Hub + Atelier mobile bar.
- components/atelier/NotesTab.tsx — **`?tab=notes`**: chronological `voice_note` list, filters, transcript edit, `<audio>` via `imageUrl` on R2 keys. Playwright: [`tests/voice-notes.spec.ts`](tests/voice-notes.spec.ts) (`ATELIER_E2E=1`).
- app/atelier/notes/actions.ts — `'use server'`: `listVoiceNotes`, `createVoiceNote`, `updateVoiceNoteTranscript`, `deleteVoiceNote` (optional audio `voice-note/<id>/…` on R2).
- lib/voice/web-speech.ts · lib/voice-note-domain.ts — browser `MediaRecorder` + SpeechRecognition wrapper; DB allow-lists for `kind` / `bucket`.
- supabase/sql/voice_note.sql · supabase/sql/sketchbook.sql — Verb 2 tables + RLS + `GRANT` (run in Supabase, then `npm run gen:types`).
- components/shared/{LoadingShell,EmptyState}.tsx — shared placeholders; used by AuditTab, ReportsTab zero-results, WorldMapTab pre-pins. Reuse — do not roll new spinners/empty messages.
- components/atelier/WorkForm.tsx — full-page **create only** at `/atelier/works/new` (shared `saveWork`). `/atelier/works/[id]/edit` redirects to `/atelier?work=<id>` (drawer).
- components/atelier/ContactEditorPanel.tsx — Hub Contacts full editor in the right column / stacked on mobile (`ContactsTab` orchestrates selection, `useUnsavedActionGuard` on row switch / batch / merge).
- app/atelier/works/actions.ts — image upload, delete, work CRUD; `requireAdmin()` gates `purgeWorkPermanently` + `deleteWorkImage`; `saveWork` queues editor edits to `pending_changes` unless `__skip_review=1`; **`fetchOeuvresKeysetPage`** for Atelier œuvres paging; **`listWorkDrawerImages`** for drawer image rail.
- app/atelier/audit/{actions,pending-actions,version-actions}.ts — audit ledger, approval queue, version history (all admin-gated via `is_admin()` RPC)
- components/atelier/{AuditTab,PendingQueue,WorkVersionHistory}.tsx — admin protection UIs (Audit Log → Ledger / Review tabs; history panel inside WorkDrawer)
- components/atelier/BroadcastTab.tsx — Diffusion tab (Queue / Publiés / Activité subtabs); admin-only via `requireAdminGuard()`
- app/atelier/broadcast/actions.ts — `listBroadcastDashboard()`, `clearStuckQueue()`; all admin-gated
- app/api/inventory/broadcast/{feed,queue,confirm,event}/route.ts — Make/n8n API; Bearer `INVENTORY_BROADCAST_SECRET` validated with timing-safe SHA-256 compare (`lib/inventory-broadcast-secret.ts`); shared **rate limit** + 429 (`lib/inventory-broadcast-rate-limit.ts`). RLS: `broadcast_events` has admin + `is_team()` select (`supabase/sql/broadcast_phase2.sql`, `supabase/sql/broadcast_events_team_rls.sql`). `broadcast_caption_seed` flows through feed → AI caption pipeline
- app/atelier/reminders-actions.ts — `revalidateRemindersTag()`; server unread count (`getUnreadReminderCountCached`); `listUnreadSuiviReminders` / `markSuiviReminderRead` / `insertSuiviReminder` (overview + pipeline; no client `(as any)` on `suivi_reminder`)
- app/atelier/atelier-data-actions.ts — **`fetchAtelierShellPostPaint()`** — post–first-paint bundle (contacts + `contact_addresses` + reference tables); thin **`fetchAtelierContacts`** / **`fetchAtelierContactAddresses`** wrappers (deprecated; delegate to the bundle)
- app/atelier/calendar/actions.ts + `lib/calendar/*` — exhibition (`suivi_process` / `suivi_etape`) → Google Calendar / Microsoft Graph (one-way export; manual sync in UI). Env: see **📅 CALENDAR SYNC** below.
- components/atelier/SystemTab.tsx — **System** tab (`?tab=system`): manual **`system_log`** rows only (`event_type` null); CRUD + **`attachments`** jsonb (screenshots via paste/file → R2 keys `ledger/*`, `imageUrl()` in UI). Site checklist PDF, Studio Bible regen, reference MD copy/download.
- app/atelier/system/ledger-attachment-actions.ts — `uploadLedgerAttachment` (team `is_team()`, `validateWorkImageBuffer`, `r2PutObject` under `ledger/`).
- app/atelier/system-reference-actions.ts — `getSystemLedgerReferenceMarkdown()` (repo `docs/SYSTEM_LEDGER.md`).
- app/atelier/system/actions.ts — `deleteStudioTask` (admin, `studio_task` table; Hub pulse feed).
- supabase/sql/system_log_attachments.sql — adds **`system_log.attachments`** (`jsonb` default `[]`).

**Deferred integrations (no GO = do not implement)**  
- **Background jobs / queues:** long-running or retriable work off the Server Action path (timeouts, PDF at scale, bulk R2/geocode). Pointer: [`app/atelier/portfolio/pdf-action.ts`](app/atelier/portfolio/pdf-action.ts). `app/api/inventory/broadcast/` is for **external** callers, not an internal job runner.  
- **Vision / OCR:** field capture (labels, cards, forms) → draft fields + human confirm; mind EU/data sensitivity; align with **📱 MOBILE FIELD-TOOL** (same caution as Phase B — no silent commits).  
- **Transactional email (Resend/Postmark-class):** adopt when offline alerting or **external** recipients matter; if wired from DB webhooks use an **outbox + idempotency** pattern.

📅 CALENDAR SYNC (Google + Microsoft, v1)  
- **User tables:** `calendar_account`, `calendar_event_link` (migration `supabase/sql/calendar_sync.sql`). Refresh tokens: **AES-256-GCM** with key from **HKDF-SHA256** (`CALENDAR_TOKEN_ENCRYPTION_KEY` as IKM, per-row `token_salt`, info `atelier-calendar-refresh-v1`). Legacy rows with `token_salt` null still decrypt (single-key mode). Column + idempotent alter: `supabase/sql/calendar_token_salt.sql`. Implementation: `lib/calendar/token-crypto.ts`.  
- **OAuth:** `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`; `MICROSOFT_CALENDAR_CLIENT_ID` / `MICROSOFT_CALENDAR_CLIENT_SECRET`; `MICROSOFT_CALENDAR_TENANT` (often `common`). Redirect URIs: `{origin}/api/calendar/google/callback` and `{origin}/api/calendar/microsoft/callback`. Failures redirect with opaque **`calendar_err_code`** only (details server-logged); UI reads code in `ExhibitionsTab` deep-link handler.  
- **CSRF:** `CALENDAR_OAUTH_STATE_SECRET` (HMAC for `state` param).  
- **App URL:** `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL` — canonical **origin** (no trailing slash). Used for OAuth redirect allowlists, **`metadataBase`** (Open Graph / Twitter resolution), **`sitemap.xml`** / canonical URLs (`lib/seo/site-url.ts`). **Vercel Production:** set at least one of these to the live public origin (e.g. `https://<project>.vercel.app` or custom domain); if both are unset, metadata falls back to `http://localhost:3000` (wrong for prod OG/sitemap).  
- **Event copy:** sync uses viewer `lang` at click time for title/body where applicable.

## SITE MAP (routes & diagrams)

- **Audit backlog vs shipped:** [architecture.md](architecture.md) (security/architecture/UX bullets + accomplished / partial / not).
- **Canonical route list + Mermaid topology:** [`SITE_MAP.md`](SITE_MAP.md) (repo root). Update it when adding pages, Atelier `?tab=` ids, or first-party `app/api` routes.
- **Prioritised future work (non-binding):** [docs/ROADMAP.md](docs/ROADMAP.md) — aggregates deferred integrations from this file, [`architecture.md`](architecture.md), and site-map surfaces.
- **Consolidated status (2026-05-14):** `C:\Users\pppee\Desktop\DONE.md` (shipped) + pending checklist **[docs/TODO.md](docs/TODO.md)** (version-controlled). Merged from `iphone-se-plan.md`, `app/STATUS.md`, `app/PROJECT_SYNTHESIS.md`, `app/ROADMAP.md`; DB-verified. Refresh after each phase ships.
- **QA checklist PDF:** Atelier → **System** tab → **Download site map checklist** — on-demand pdfkit export (`exportSiteMapChecklistPdf` in [app/atelier/vault/actions.ts](app/atelier/vault/actions.ts), builder in [lib/site-map-checklist-pdf.ts](lib/site-map-checklist-pdf.ts)).
- **Vaulted narrative PDF:** `/Atelier_Studio_Bible.pdf` — latest `document.kind = 'bible'`; regenerate from System tab (`vaultStudioBible` in [app/atelier/vault/bible-action.ts](app/atelier/vault/bible-action.ts)).
- **System Ledger (operator doc):** [docs/SYSTEM_LEDGER.md](docs/SYSTEM_LEDGER.md) — `system_log` manual rows, `attachments`, checklist/Bible/reference UX; keep aligned with [`SITE_MAP.md`](SITE_MAP.md) when behaviour changes.

## EXHIBITIONS ↔ PIPELINE

- **Tables:** `suivi_process` (process rows: `vente`, `exposition`, `residence`, `expedition`, `consignment`, …) and `suivi_etape` (per-process steps).
- **Exhibition hub:** [ExhibitionsTab.tsx](components/atelier/ExhibitionsTab.tsx) loads `suivi_process` (and related) **client-side** — lists rows where `type = 'exposition'` (with schedule dates); steps, calendar, and floorplan tooling hang off the selected row. The Atelier RSC page does **not** ship a preloaded `exhibition` table payload.
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

**Phase B — Editor edits → approval queue.** Non-admin `saveWork` on existing oeuvres lands in `pending_changes` (jsonb payload + baseline snapshot). **Payload keys are allow-listed** (`lib/work-pending-keys.ts`); approve replays only those keys through `saveWork` with `__skip_review=1` (blocks arbitrary field injection). Admin reviews via Atelier > Audit Log > **Review** tab; reject marks row + reason. New-work creation stays unqueued (low risk). Migration: `supabase/sql/pending_changes.sql`. Files: `app/atelier/audit/pending-actions.ts`, `components/atelier/PendingQueue.tsx`.

**Phase C — Pre-update version snapshots.** Trigger `oeuvre_version_snap` writes the OLD row to `oeuvre_versions` on every `Oeuvres` UPDATE. Admin-only collapsible panel at the bottom of `WorkDrawer` lists versions, diffs vs prior, restores via service-role `restoreOeuvreVersion(versionId)`. Restore itself is logged (creates new snapshot). Excluded from restore payload: `OeuvreID`, `is_public` (trigger), `txtImageNameLink` (trigger), `created_at`. Migration: `supabase/sql/oeuvre_versions.sql`. Files: `app/atelier/audit/version-actions.ts`, `components/atelier/WorkVersionHistory.tsx`.

**Phase D — R2 image soft-delete (app-side, no Bucket Lock).**
R2 has no S3-style Object Versioning and Bucket Lock is too rigid (locks the admin too). Pattern: every R2 delete from `app/atelier/works/actions.ts` goes through `r2SoftDelete(key)` which **server-side copies** the object to `recycle/<YYYY-MM-DD>/<key>` (S3 CopyObject via `x-amz-copy-source`, no bytes flow through Node) and only then deletes the original. Falls back to direct delete if the copy fails (object already gone).
- **Cloudflare console step (one-time)**: bucket `paintings` → Object Lifecycle Rules → **Add** rule: prefix `recycle/`, action *Delete objects after 90 days*. Same on `vault` if it ever gets writes.
- **System ledger screenshots:** keys under prefix `ledger/` (see `app/atelier/system/ledger-attachment-actions.ts`). **Add** lifecycle rule: prefix `ledger/`, action *Delete objects after 30 days* (short-lived evidence; DB `system_log.attachments` may still list expired keys until edited).
- **Recovery**: copy the object back from `recycle/<date>/<key>` to its original key, or list `recycle/` via S3 API and POST back through `tblImage` if metadata also lost.
- Helpers in [app/atelier/works/actions.ts](app/atelier/works/actions.ts): `r2Copy(src, dst)`, `r2SoftDelete(key)`. Editor-side delete is already blocked by Phase A `requireAdmin()`; soft-delete is the safety net for the admin's own mistakes.
- Rotate R2 access keys yearly; document the rotation date in this section.

**Phase E — Off-site DB backups.** `.github/workflows/backup.yml` runs `scripts/backup.sh` daily at 03:17 UTC: `pg_dump` Supabase (Session Pooler URL, IPv4) → gzip → upload to `art-db-backups` R2 bucket (EU jurisdiction) via **boto3** (Python). AWS CLI v2 and rclone both produce malformed sigv4 credentials against R2 — boto3 with `region_name='auto'` + EU endpoint is the only confirmed-working upload path. No Object Lock; lifecycle rule auto-prunes `daily/*` after 90 days. GH secrets reuse main R2 credentials (`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` from `.env.local`) mapped to `R2_BACKUP_ACCOUNT_ID` / `R2_BACKUP_ACCESS_KEY` / `R2_BACKUP_SECRET_KEY`. Full setup + recovery: [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md). Quarterly recovery drill: restore latest dump into throwaway Supabase project, spot-check row counts.

**Audit / ledger TTL.** [`supabase/sql/audit_log_ttl.sql`](supabase/sql/audit_log_ttl.sql) defines `public.audit_log_prune()` (retention: 365d `oeuvre_versions` + automated `system_log`; 180d closed `pending_changes` + non-error `broadcast_events`; **never** auto-deletes `system_log` rows with `event_type IS NULL`, or `broadcast_events` with `event_type` case-insensitively `error`). Weekly GitHub Actions: [`.github/workflows/audit-prune.yml`](.github/workflows/audit-prune.yml) — same `SUPABASE_DB_URL` secret as backup; run the SQL in Supabase before enabling the workflow. **New append-only audit tables:** extend `audit_log_prune()` in the same file from day one (do not grow unbounded).

**Dev-only auto-login.** `middleware.ts` calls `signInWithPassword` when `NODE_ENV=development` AND `DEV_AUTO_LOGIN_EMAIL`/`_PASSWORD` set. Used in preview iframe to skip Google OAuth. Production never has these env vars set. Login error logs mask email-shaped substrings.

**Audit ledger actor emails.** `fetchSystemLogs` enriches `user_id` with `Contact.Email` batched by `auth_user_id` (RLS anon read; no service-role user API per row).

🚫 CEMETERY (instant fail)
**Dropped from DB 2026-05-14** (`supabase/sql/dead_columns_drop.sql`, verified): `Oeuvres.{Statut,StatutID,tags,txtImageName,Emballage,DocsValidated,UniteDimension,NomOriginal,Poids,Tirage}` + tables `OeuvreRelationships` + quoted `"tblRelations"`. Do not reintroduce. **Live & keep:** `public.tblrelations` (lowercase, constellation edges). If a view (e.g. `OeuvresComplete`) referenced dropped columns, `DROP COLUMN … CASCADE` removed it; recreate without those columns if still needed.
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
