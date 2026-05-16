# CLAUDE.md

Repo operating guide. If conflict: ask owner before edit.

## Hard Rules
- CAUTION > SPEED. Think first. Surgical edits.
- No file edit without explicit GO.
- KISS. Small diffs. No bloat.
- Confirm deletes.
- Before commit: `git diff --stat`; stage all modified source files; exclude build artifacts (`.next/`, `tsconfig.tsbuildinfo`).
- `origin/main` = only release truth. Work on real `main` tracking `origin/main` by default.
- Done/clean/shipped only when intended change committed, checks known, and commit on `origin/main`.
- Checkpoint branches/worktrees = scratch only. Do not create/use unless owner explicitly asks. If temp isolation used, reconcile to `origin/main` before final.
- UI copy bilingual. Mobile contract obey.

## Commands
- Dev: `pwsh scripts/dev.ps1` from `C:\Users\pppee\Documents\Claude\Projects\Art db\app`.
- Checks: `npm run i18n:check`, `npm run typecheck`, `npm run lint`.
- E2E: `npm run test:e2e`; field/mobile gated: `npm run test:e2e:field` (`ATELIER_E2E=1`, logged-in dev profile).
- Supabase types: `npm run gen:types` after SQL applied; needs `SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.
- Dev server: Next.js 15, port 3000. If `/_next/static/*` 404: restart dev from real root; delete `.next`; hard reload.
- Temp worktree only if explicitly needed: create `.claude/launch.json` = `{"version":"0.0.1","configurations":[]}`.

## Final / Git Discipline
- Start: `git status --short --branch`.
- Finish: `git status --short --branch` + `git log --oneline origin/main..HEAD`.
- If `main` ahead: push. If not on `origin/main`: say local draft.
- Never call checkpoint/worktree clean as release truth.
- Never destructive git (`reset --hard`, `checkout --`, force push) unless owner explicitly approves.

## Architecture
- Next.js 15 App Router + Supabase + Cloudflare R2.
- Server Components fetch, pass to Client Components.
- Mutations: Server Actions in `app/**/actions.ts`. Exceptions: OAuth callbacks, read-only/external `app/api/*` routes (geocode, inventory broadcast).
- Bootstrap reads may live in `'use server'` modules under `app/atelier/` (`reminders-actions.ts`, `atelier-data-actions.ts`). Domain writes still actions.
- Auth: Supabase SSR middleware protects `/atelier`, `/hub`, `/galerie`. Admin = `is_admin()` RPC via `Contact.is_admin` + `auth_user_id`. Old `profiles.role` dead.
- Supabase clients: `createClient()` anon/RLS; `createServiceClient()` service-role/admin bypass.

## UI Copy / i18n
- All user copy: `useI18n().t(key)`.
- New copy: one module in `lib/i18n/messages/*.messages.ts` via `defineMessages()` with FR+EN together.
- Legacy dictionary under `lib/i18n/dictionary/` stays until touched. Do not add new feature copy via old `keys.ts` + `fr.ts` + `en.ts` unless maintaining legacy surface.
- Run `npm run i18n:check`, `npm run typecheck`, `npm run lint` after copy work.
- No hardcoded JSX/alert/confirm/title/placeholder copy.
- Server Components: pass translated strings, use client leaf, or `dict[lang][key]`.
- `toLocale*` / Intl locale from `lang` (`fr-FR` / `en-GB`), not hardcoded.

## Mobile Field Tool
- Phone = atelier field terminal: capture works, fix metadata, nudge pipeline. Desktop = heavy PR/CRM/dashboards.
- Mobile branch: `useMediaQuery('(max-width: 767px)')`.
- Verify at 375px; ~360px minimum no-break.
- No horizontal scroll, clipped controls, desktop fixed widths, unbranched side rails.
- Primary taps >=44px. Save/primary action reachable. Sticky bars use safe-area padding (`max(..., env(safe-area-inset-bottom))`).
- Mobile image capture may use `capture="environment"`.
- If `/hub` mobile entry changes: smoke WorkForm, WorkDrawer, Inventory small viewport.
- Narrow Atelier sidebar first group Field: `inventory` → `production` → `stock-take` → `notes` → `map`.
- Rings: A Atelier narrow chrome; B Hub field launcher + mobile bar + `VoiceNoteSheet`; B.3 PWA share target; C field verb routes/stubs.

## Drawer / Panel Guard
- Serialize form + nested lists to baseline; dirty when current != baseline.
- Save persists then proceeds. Discard proceeds without save. Cancel closes dialog only.
- Use `hooks/useUnsavedActionGuard.tsx`; `useUnsavedCloseGuard` for close overlay.
- Narrow: sticky primary actions + safe-area padding. No read-only text/input overlap in table cells.
- Reference: `ContactsTab.tsx`, `ContactEditorPanel.tsx`.

## Data / Storage Rules
- New public tables: RLS + policies + explicit `GRANT` for PostgREST roles (`authenticated`, `anon` where public writes). Missing grant => 42501 despite RLS.
- Audit grants after schema changes: `supabase/sql/grant_audit_queries.sql`.
- Tables intentionally service-role only: document in migration comment; do not widen grant.
- R2 endpoint: EU jurisdiction only: `https://<account_id>.eu.r2.cloudflarestorage.com`. No global endpoint.
- Image upload: validate JPEG/PNG/WebP/GIF/AVIF/HEIC via Sharp; normalize originals to 2100px long-side AVIF q=50 + Artist/Copyright EXIF.
- Storage keys: `W_{oid}_{seq}_{hash8}.avif`, hash from raw input bytes (`lib/image-upload.ts`).
- Image URLs only via `imageUrl()` / `thumbUrl()` from `lib/data.ts`. Never hand-build R2 URLs.

## DB Logic
- Status: `Oeuvres.statusId` FK → `OeuvreStatus.id`.
- Themes: `OeuvreTheme` junction. `Oeuvres.theme` read-only/dead.
- Images: `tblImage` trigger updates Oeuvres cover.
- Dates: `Oeuvres.Année` DATE (`YYYY-01-01`); use `yearOf()`.
- Sort UI dropdowns alphabetically.
- Never write `Oeuvres.is_public` or `Oeuvres.txtImageNameLink` (triggers).
- New tables: snake_case only. No `tbl` prefix. No CamelCase.

## Key Files
- `app/atelier/page.tsx`: slim RSC, first œuvres chunk, post-paint shell via `fetchAtelierShellPostPaint`, keyset paging via `fetchOeuvresKeysetPage`.
- `components/atelier/TeamPortalClient.tsx`: main Atelier shell, tabs, selection, drawer, dirty guard, post-paint hydration.
- `components/atelier/WorkDrawer.tsx`: canonical edit for existing works; images via `listWorkDrawerImages`.
- `components/atelier/WorkForm.tsx`: create-only `/atelier/works/new`.
- `app/atelier/works/actions.ts`: work CRUD, image upload/delete, pending editor queue, drawer images, paging.
- `app/atelier/notes/actions.ts` + `components/shared/VoiceNoteSheet.tsx` + `components/atelier/NotesTab.tsx`: voice notes.
- `components/hub/HubLauncherClient.tsx`: `/hub` mobile field launcher; desktop redirects to Atelier overview.
- `components/atelier/FieldToolStubPage.tsx`: stubs for `/atelier/capture`, `/atelier/documents/new`, `/atelier/triage`.
- `components/atelier/session/SessionNewClient.tsx`: `/atelier/session/new` Verb 1.
- `components/atelier/IssueNewForm.tsx`: `/atelier/issue/new`.
- `components/shared/{LoadingShell,EmptyState}.tsx`: reuse placeholders.
- `lib/i18n/messages/`: new copy modules.
- `lib/types/database.ts`: shared app shapes, not full Supabase dump.
- `lib/types/supabase.generated.ts`: generated Supabase Database type.
- `SITE_MAP.md`, `docs/ROADMAP.md`, `docs/TODO.md`, `docs/SYSTEM_LEDGER.md`: keep in sync when routes/features change.

## Admin / Audit Protection
- Admin identity = `Contact.is_admin = true` linked to `auth.uid()`. `is_admin()` single source.
- Hard delete admin only: `purgeWorkPermanently`, `deleteWorkImage`; RLS defense-in-depth.
- Non-admin existing-work edits -> `pending_changes`; allow-list keys in `lib/work-pending-keys.ts`; approval replays via `saveWork` + `__skip_review=1`.
- Oeuvre versions: trigger snapshots OLD row to `oeuvre_versions`; admin restore via `restoreOeuvreVersion(versionId)`.
- R2 delete: use `r2SoftDelete(key)` copy to `recycle/<YYYY-MM-DD>/<key>` before delete. Lifecycle: `recycle/` 90d; `ledger/` screenshots 30d.
- Backups: `.github/workflows/backup.yml` daily pg_dump -> R2 `art-db-backups` via boto3 EU endpoint. See `docs/BACKUP_RECOVERY.md`.
- Audit prune: `supabase/sql/audit_log_ttl.sql`; never auto-delete manual `system_log` (`event_type IS NULL`) or error broadcast events.

## Calendar Sync
- Tables: `calendar_account`, `calendar_event_link`; migration `supabase/sql/calendar_sync.sql`.
- Refresh tokens: AES-256-GCM, HKDF-SHA256, `CALENDAR_TOKEN_ENCRYPTION_KEY`, per-row `token_salt`; see `lib/calendar/token-crypto.ts`.
- OAuth env: Google/Microsoft client IDs/secrets, `MICROSOFT_CALENDAR_TENANT`, `CALENDAR_OAUTH_STATE_SECRET`.
- Origin env: `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`, no trailing slash. Required for OAuth, metadata, sitemap.

## Deferred / No GO
- Background jobs/queues for long/retriable work.
- Vision/OCR field capture -> draft + human confirm.
- Transactional email -> outbox + idempotency.
- Do not implement deferred integrations without owner GO.

## Cemetery
- Dropped 2026-05-14: `Oeuvres.{Statut,StatutID,tags,txtImageName,Emballage,DocsValidated,UniteDimension,NomOriginal,Poids,Tirage}`, `OeuvreRelationships`, quoted `"tblRelations"`.
- Live keep: lowercase `public.tblrelations`.
- Recreate dropped views without dead columns if needed.

## Portfolio PDF
- Engine: `app/atelier/portfolio/pdf-action.ts` → `generatePortfolioPdf(opts)`.
- Server action loads R2 config + public works. No client data prep.
- Section source priority: `raw.sections`, then `raw.works_modes[0].collections`, then `raw.works_collections`, else `__all__`.
- Work order: `manual_work_order[]` first, then theme residual.
- Cover = first loaded image; exclude from work pages.
- Pdfkit: never use 8-char alpha hex. Use `fillOpacity(N).fill('#RRGGBB').fillOpacity(1)`. Text without `height` can auto-page; refill background.
- Sharp 0.34.5/libheif 1.20 supports AVIF input.
