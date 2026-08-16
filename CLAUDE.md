# CLAUDE.md

Repo guide. Conflict → ask owner before edit.

## Hard Rules
- CAUTION > SPEED. Think first. Surgical edits. Small diffs. No bloat.
- No edit without GO. Confirm deletes.
- Before commit: stage modified source; exclude build artifacts. No assume hook unless file exists in checkout.
- `origin/main` = only release truth. Checkpoint branches/worktrees = scratch; reconcile before final.
- Done/clean/shipped only when change committed, checks known, commit on `origin/main`.
- Precise wording = truth: never say done/clean/shipped/pushed/deployed/online/implemented/fixed/verified/safe without evidence. Missing evidence or blocked tool → say `I cannot prove this; treat it as not done.`
- Hung tool: kill after 60s no output unless build/test known long-running.
- No deferred features (background queues, broad field OCR, transactional email) without owner GO. Business-card OCR may be maintained, not expanded silently.

## Parallel Sessions and Tool Isolation
- One IDE per checkout, ever. No Cursor + Claude (or Antigravity + Claude) in same dir.
- Parallel work → worktree: `git worktree add ../app-wt-<name> -b wt-<name> origin/main`. One tool inside.
- Worktree branches stay local. `origin/main` only push target. Pre-push hook should refuse non-main; verify manually.
- Reconcile from main checkout: `git merge --ff-only wt-<name>`, then push. Rebase onto main first if FF impossible.
- Remove worktree only after committing or stashing: `git worktree remove ../app-wt-<name>`. Never `--force` with uncommitted changes.
- State unclear? `git worktree list` and `pwsh scripts/release-truth.ps1` from inside worktree.
- CLAUDE.md = source of truth. Hook/rule conflict → this section wins.

## Commands
- Dev: `pwsh scripts/dev.ps1` from `C:\Users\pppee\Documents\Claude\Projects\Art db\app`. Prints `Phone : http://<LAN>:3000` for Wi‑Fi testing.
- Phone/LAN dev: use `DEV_AUTO_LOGIN_*` in `.env.local`, open `/hub` on LAN URL. No Google OAuth on `192.168.*` unless in Supabase Auth redirect allowlist. Use real PEM account email in `DEV_AUTO_LOGIN_EMAIL` (dev password on that Supabase user) for same `work_session` rows as prod; separate `dev@…` user sees own (often empty) drafts.
- `work_session` journal: any `is_team()` user can read all team sessions; writes = session-owner or admin. Journal empty for team members → run `supabase/sql/work_session_team_read.sql` on project DB.
- Checks: `npm run i18n:check`, `npm run atelier:chrome:check`, `npm run typecheck`, `npm run lint`. GitHub `ci.yml` runs all four on `main`. Hooks not substitute for manual verification.
- `i18n:check`: fails on missing legacy dict keys and hardcoded UI copy outside [`scripts/i18n-check-allowlist.json`](scripts/i18n-check-allowlist.json) (keep in sync with `.eslintrc.json` `no-hardcoded-jsx-text` overrides).
- E2E: `npm run test:e2e`; field/mobile gated: `npm run test:e2e:field` (`ATELIER_E2E=1`, logged-in dev profile).
- Supabase types: `npm run gen:types` after SQL applied; needs `SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.
- Dev server: Next.js 15, port 3000. `/_next/static/*` 404 → restart dev from real root; delete `.next`; hard reload.

## Verification Tiers
- Docs-only: review diff + `git status --short --branch`; heavier checks only if docs drive generated code or routes.
- UI/copy: `npm run i18n:check` (must pass — 0 blocking hotspots), `npm run lint`; add `npm run test:e2e:field` for mobile field chrome or `/hub` entry changes when logged-in dev session available.
- Type/data flow: `npm run typecheck`, `npm run lint`; add focused Playwright where user-facing behavior changed.
- SQL/RLS/storage: apply or review migration path, audit `GRANT` + RLS, run `npm run gen:types` after SQL live, then `npm run typecheck`.
- Commit + push: `& .\scripts\commit-push-main.ps1 -Message '…' -Paths @('…')` — moves unrelated WIP aside (fast), commits, pushes, restores. Add `-Verify` for release-truth (slow fetch). Run in current shell, not nested `pwsh -File`.
- Before any push claim: run `pwsh scripts/release-truth.ps1` with `-Checks` when checks ran in-session.

## Final / Git Discipline
- Start: `git status --short --branch`.
- Finish: `git status --short --branch` + `git log --oneline origin/main..HEAD`.
- Before completion wording, run or derive same fields as `pwsh scripts/release-truth.ps1`: branch, HEAD SHA, origin/main SHA, HEAD==origin/main, working tree, checks. `deployed`/`online` needs separate production evidence.
- Push only when owner requested commit/push. `main` ahead but no push request → say `committed locally` or `local draft`. Not on `origin/main` → say local draft.
- Status words exact: `local draft`, `committed locally`, `pushed to origin/main`, `deployed`, `verified`. No widening beyond evidence.
- Never destructive git (`reset --hard`, `checkout --`, force push) unless owner explicitly approves.

## Architecture
- Next.js 15 App Router + Supabase + Cloudflare R2.
- Server Components fetch, pass to Client Components.
- Mutations: Server Actions in `app/**/actions.ts`. Exceptions: OAuth callbacks, read-only/external `app/api/*` routes (geocode, inventory broadcast).
- Bootstrap reads may live in `'use server'` modules under `app/atelier/`. Domain writes still actions.
- Auth: Supabase SSR middleware protects `/atelier`, `/hub`, `/galerie`, `/collection`, `/maps`; document redirects only, never RSC/Flight/Server Action redirects. Admin = `is_admin()` RPC via `Contact.is_admin` + `auth_user_id`. Old `profiles.role` dead.
- Supabase clients: `createClient()` anon/RLS; `createServiceClient()` service-role/admin bypass.
- Atelier shell: first paint loads exact `Oeuvres` count + first keyset chunk; references hydrate post-paint via `fetchAtelierShellPostPaint`; subset UI must disclose loaded batch vs catalogue total.
- Keep `SITE_MAP.md`, `docs/TODO.md`, `docs/SYSTEM_LEDGER.md`, `docs/README.md` in sync when routes/features change; don't trust over live code when stale.

## Docs ↔ Code Currency
- Session bootstrap: `docs/README.md` = orientation table with freshness stamps; current workstream = `docs/MOBILE_RATIONALIZATION_PLAN.md`; owner strategy/non-goals = `docs/STRATEGY.md`.
- DB schema: read live (Supabase MCP or `lib/types/supabase.generated.ts`), never from guides.
- Owner requests triage: bug (fix now) / lived friction ≥2× (batch) / idea (park in TODO). Problem statements over prescribed solutions.
- Refactor/feature landing → update affected docs IN THE SAME change (handoff "Open work", `docs/TODO.md`, `SITE_MAP.md`, `docs/SYSTEM_LEDGER.md` as relevant). A change with stale docs is not done.
- Before marking any item done/shipped/complete in a handoff or TODO, VERIFY against live code (read the file / grep the symbol) — never from memory or prior handoff prose. Same evidence bar as the git status words.
- Handoff "Open work" sections carry a `Verified against live code <YYYY-MM-DD>` stamp. Touch the feature → re-verify + re-stamp. Unstamped, or stamp older than the code it describes → treat as suspect; re-check before acting or quoting "done".
- Completed handoffs move to `docs/archive/` (historical; never execute from there). Live checklist = `docs/TODO.md`.
- All user copy: `useI18n().t(key)`. No hardcoded JSX/alert/confirm/title/placeholder copy.
- New copy: one module in `lib/i18n/messages/*.messages.ts` via `defineMessages()` with FR+EN together; register in `lib/i18n/messages/index.ts`.
- Runtime: [`resolveMessage`](lib/i18n/resolve-message.ts) — feature messages first, legacy `fr.ts`/`en.ts` fallback; dev `console.warn` on miss.
- Legacy dict under `lib/i18n/dictionary/` stays until touched. No new feature copy via old pattern unless maintaining legacy surface.
- Enforcement: ESLint `pem-i18n/no-hardcoded-jsx-text` + `npm run i18n:check` (blocking hotspots). Allowlist: `scripts/i18n-check-allowlist.json` — handoff [`docs/archive/HANDOFF_SLICE4.md`](docs/archive/HANDOFF_SLICE4.md).
- Server Components: pass translated strings, use client leaf, or `dict[lang][key]`.
- `toLocale*` / Intl locale from `lang` (`fr-FR` / `en-GB`), not hardcoded.

## Mobile Field Tool
- Phone = atelier field terminal: capture, fix metadata, nudge pipeline. Desktop = heavy PR/CRM/dashboards.
- Mobile branch: `useMediaQuery('(max-width: 767px)')`.
- Verify at 375px; ~360px min no-break.
- No horizontal scroll, clipped controls, desktop fixed widths, unbranched side rails.
- Primary taps >=44px. Save/primary action reachable. Sticky bars use safe-area padding (`max(..., env(safe-area-inset-bottom))`).
- **Phone work images:** canonical path is Lightroom Mobile → Export (JPEG) → iOS Share Sheet → PWA `share_target` → `/atelier/share-receive` → `WorkForm` or **work session** (`/atelier/session/new` → Lightroom workflow steps → Share back → triage **Add to work session**). No `lightroom-cc://` from PWA (iOS often refuses). No native `capture="environment"` on work paths (`WorkForm`, `WorkDrawerImageArea`).
- **Exceptions:** business-card capture at `/atelier/capture?mode=card` (`CaptureCardClient`) and session/concept native capture may still use `capture="environment"`.
- `/hub` mobile entry changes → smoke WorkForm, WorkDrawer, Inventory small viewport.
- Narrow Atelier sidebar first group Field: `inventory` → `production` → `stock-take` → `notes` → `map`.
- Rings: A Atelier narrow chrome; B Hub field launcher + mobile bar + `VoiceNoteSheet`; B.3 PWA share target; C field verb routes/stubs + business-card capture at `/atelier/capture?mode=card`.

## Drawer / Panel Guard
- Serialize form + nested lists to baseline; dirty when current != baseline.
- Save persists then proceeds. Discard proceeds without save. Cancel closes dialog only.
- Use `hooks/useUnsavedActionGuard.tsx`; `useUnsavedCloseGuard` for close overlay.
- Narrow: sticky primary actions + safe-area padding. No read-only text/input overlap in table cells.

## Data / Storage Rules
- New public tables: RLS + policies + explicit `GRANT` for PostgREST roles (`authenticated`, `anon` where public writes). Missing grant => 42501 despite RLS.
- Audit grants after schema changes: `supabase/sql/grant_audit_queries.sql`.
- Service-role-only tables: document in migration comment; don't widen grant.
- R2 endpoint: EU only: `https://<account_id>.eu.r2.cloudflarestorage.com`. No global endpoint.
- Image upload: validate JPEG/PNG/WebP/GIF/AVIF/HEIC via Sharp; normalize **every** input (AVIF included) to AVIF q=50 + Artist/Copyright EXIF, long side 2100 (session shot) / 4000 (work image). One re-encode at upload, never on read.
- No AVIF pass-through. Tried and removed: a phone export at q80 is ~5.8x the stored size for ~230ms saved. Storage wins across the archive. If revisited: libvips reports AVIF as `heif` + `compression: 'av1'`, so `meta.format === 'avif'` never matches.
- Mobile client shrinks before upload (`downscaleImageFileForMobileIfNeeded`): re-encode when long side > maxEdge **or** bytes > `MOBILE_MAX_UPLOAD_BYTES`. Vercel caps a Server Action body at 4.5MB — above it the platform returns HTML 413 and Next reports "An unexpected response was received from the server" before any app code runs.
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
- Live keep: lowercase `public.tblrelations`. Recreate dropped views without dead columns if needed.

## Admin / Audit Protection
- Admin identity = `Contact.is_admin = true` linked to `auth.uid()`. `is_admin()` single source.
- Hard delete admin only: `purgeWorkPermanently`, `deleteWorkImage`; RLS defense-in-depth.
- Non-admin existing-work edits → `pending_changes`; allow-list keys in `lib/work-pending-keys.ts`; approval replays via `saveWork` + `__skip_review=1`.
- Oeuvre versions: trigger snapshots OLD row to `oeuvre_versions`; admin restore via `restoreOeuvreVersion(versionId)`.
- R2 delete: use `r2SoftDelete(key)` copy to `recycle/<YYYY-MM-DD>/<key>` before delete. Lifecycle: `recycle/` 90d; `ledger/` screenshots 30d.
- Backups: `.github/workflows/backup.yml` daily pg_dump → R2 `art-db-backups` via boto3 EU endpoint. See `docs/BACKUP_RECOVERY.md`.
- Audit prune: `supabase/sql/audit_log_ttl.sql`; never auto-delete manual `system_log` (`event_type IS NULL`) or error broadcast events.

## Calendar Sync
- Tables: `calendar_account`, `calendar_event_link`. Env: `CALENDAR_TOKEN_ENCRYPTION_KEY`, `CALENDAR_OAUTH_STATE_SECRET`, Google/Microsoft OAuth secrets, `MICROSOFT_CALENDAR_TENANT`.
- Origin env: `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`, no trailing slash. Required for OAuth, metadata, sitemap.

## Portfolio PDF
- Engine: `app/atelier/portfolio/pdf-action.ts` → `generatePortfolioPdf(opts)`.
- Server action loads R2 config + public works. No client data prep.
- Section source priority: `raw.sections`, then `raw.works_modes[0].collections`, then `raw.works_collections`, else `__all__`.
- Work order: `manual_work_order[]` first, then theme residual.
- Cover = first loaded image; exclude from work pages.
- Pdfkit: never use 8-char alpha hex. Use `fillOpacity(N).fill('#RRGGBB').fillOpacity(1)`. Text without `height` can auto-page; refill background.
- Sharp 0.34.5/libheif 1.20 supports AVIF input.