# CLAUDE.md

Repo operating guide. If conflict: ask owner before edit.

## Hard Rules
- CAUTION > SPEED. Think first. Surgical edits. Small diffs. No bloat.
- No file edit without explicit GO. Confirm deletes.
- Before commit: stage all modified source files; exclude build artifacts. Do not assume local hook enforcement unless the hook file exists in this checkout.
- `origin/main` = only release truth. Checkpoint branches/worktrees = scratch only; reconcile before final.
- Done/clean/shipped only when intended change committed, checks known, and commit on `origin/main`.
- Precise wording = truth: never say done/clean/shipped/pushed/deployed/online/implemented/fixed/verified/safe unless evidence proves that exact state. If evidence is missing or a tool is blocked, say `I cannot prove this; treat it as not done.`
- Hung tool: kill after 60s no output unless build/test known long-running.
- Do not implement deferred features (background queues, broad field OCR, transactional email) without owner GO. Existing business-card capture OCR may be maintained, not expanded silently.

## Parallel Sessions and Tool Isolation
- One IDE per checkout, ever. Never Cursor + Claude (or Antigravity + Claude) in the same working directory.
- For parallel work, spin up a worktree: `git worktree add ../app-wt-<name> -b wt-<name> origin/main`. Open exactly one tool inside it.
- Worktree branches stay local. `origin/main` is the only push target. If a pre-push hook exists, it should refuse non-main pushes; still verify manually.
- Reconcile from the main checkout: `git merge --ff-only wt-<name>`, then push. Rebase the worktree onto main first if FF is impossible.
- Remove a worktree only after committing or stashing: `git worktree remove ../app-wt-<name>`. Never `--force` with uncommitted changes — that is how work vanishes.
- State unclear? `git worktree list` and `pwsh scripts/release-truth.ps1` from inside the worktree.
- CLAUDE.md is the source of truth for this workflow. If a hook or rule conflicts, this section wins.

## Commands
- Dev: `pwsh scripts/dev.ps1` from `C:\Users\pppee\Documents\Claude\Projects\Art db\app`. Prints `Phone : http://<LAN>:3000` for Wi‑Fi testing.
- Phone/LAN dev: use `DEV_AUTO_LOGIN_*` in `.env.local` and open `/hub` on the LAN URL — do not use Google OAuth on `192.168.*` unless that URL is in Supabase Auth redirect allowlist (otherwise login returns to production). Use your **real PEM account email** in `DEV_AUTO_LOGIN_EMAIL` (with a dev password on that Supabase user) if you need the same `work_session` rows as production; a separate `dev@…` user only sees its own (often empty) drafts.
- `work_session` journal: any `is_team()` user can **read** all team sessions; writes stay session-owner or admin. If journal looks empty for team members, run `supabase/sql/work_session_team_read.sql` on the project DB.
- Checks: `npm run i18n:check`, `npm run atelier:chrome:check`, `npm run typecheck`, `npm run lint`. GitHub `ci.yml` runs all four on `main`. Hooks are not a substitute for manual verification.
- `i18n:check`: fails on missing legacy dict keys **and** hardcoded UI copy outside [`scripts/i18n-check-allowlist.json`](scripts/i18n-check-allowlist.json) (keep in sync with `.eslintrc.json` `no-hardcoded-jsx-text` overrides).
- E2E: `npm run test:e2e`; field/mobile gated: `npm run test:e2e:field` (`ATELIER_E2E=1`, logged-in dev profile).
- Supabase types: `npm run gen:types` after SQL applied; needs `SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.
- Dev server: Next.js 15, port 3000. If `/_next/static/*` 404: restart dev from real root; delete `.next`; hard reload.

## Verification Tiers
- Docs-only: review diff + `git status --short --branch`; run heavier checks only if docs drive generated code or routes.
- UI/copy changes: `npm run i18n:check` (must pass — 0 blocking hotspots), `npm run lint`; add `npm run test:e2e:field` for mobile field chrome or `/hub` entry changes when a logged-in dev session is available.
- Type/data flow changes: `npm run typecheck`, `npm run lint`; add focused Playwright where user-facing behavior changed.
- SQL/RLS/storage changes: apply or review migration path, audit `GRANT` + RLS, run `npm run gen:types` after SQL is live, then `npm run typecheck`.
- Commit + push: `& .\scripts\commit-push-main.ps1 -Message '…' -Paths @('…')` — moves unrelated WIP aside (fast), commits, pushes, restores. Add `-Verify` for release-truth (slow fetch). Run in current shell, not nested `pwsh -File`.
- Before any push claim: run `pwsh scripts/release-truth.ps1` with `-Checks` when checks ran in-session.

## Final / Git Discipline
- Start: `git status --short --branch`.
- Finish: `git status --short --branch` + `git log --oneline origin/main..HEAD`.
- Before completion wording, run or derive the same fields as `pwsh scripts/release-truth.ps1`: branch, HEAD SHA, origin/main SHA, HEAD==origin/main, working tree, checks. Claiming `deployed`/`online` needs separate production evidence (not from this script).
- Push only when owner requested commit/push. If `main` is ahead but push was not requested, say `committed locally` or `local draft` as applicable. If not on `origin/main`: say local draft.
- Status words must be exact: `local draft`, `committed locally`, `pushed to origin/main`, `deployed`, or `verified`. Do not widen the claim beyond the evidence.
- Never destructive git (`reset --hard`, `checkout --`, force push) unless owner explicitly approves.

## Architecture
- Next.js 15 App Router + Supabase + Cloudflare R2.
- Server Components fetch, pass to Client Components.
- Mutations: Server Actions in `app/**/actions.ts`. Exceptions: OAuth callbacks, read-only/external `app/api/*` routes (geocode, inventory broadcast).
- Bootstrap reads may live in `'use server'` modules under `app/atelier/`. Domain writes still actions.
- Auth: Supabase SSR middleware protects `/atelier`, `/hub`, `/galerie`, `/collection`, `/maps`; document redirects only, never RSC/Flight/Server Action redirects. Admin = `is_admin()` RPC via `Contact.is_admin` + `auth_user_id`. Old `profiles.role` dead.
- Supabase clients: `createClient()` anon/RLS; `createServiceClient()` service-role/admin bypass.
- Atelier shell: first paint loads exact `Oeuvres` count + first keyset chunk; references hydrate post-paint via `fetchAtelierShellPostPaint`; subset UI must disclose loaded batch vs catalogue total.
- Keep `SITE_MAP.md`, `docs/TODO.md`, `docs/SYSTEM_LEDGER.md`, and `docs/README.md` in sync when routes/features change, but do not trust them over live code when stale.

## UI Copy / i18n
- All user copy: `useI18n().t(key)`. No hardcoded JSX/alert/confirm/title/placeholder copy.
- New copy: one module in `lib/i18n/messages/*.messages.ts` via `defineMessages()` with FR+EN together; registered in `lib/i18n/messages/index.ts`.
- Runtime: [`resolveMessage`](lib/i18n/resolve-message.ts) — feature messages first, legacy `fr.ts`/`en.ts` fallback; dev `console.warn` on miss.
- Legacy dictionary under `lib/i18n/dictionary/` stays until touched. Do not add new feature copy via old pattern unless maintaining legacy surface.
- Enforcement: ESLint `pem-i18n/no-hardcoded-jsx-text` + `npm run i18n:check` (blocking hotspots). Allowlist: `scripts/i18n-check-allowlist.json` — handoff [`docs/archive/HANDOFF_SLICE4.md`](docs/archive/HANDOFF_SLICE4.md).
- Server Components: pass translated strings, use client leaf, or `dict[lang][key]`.
- `toLocale*` / Intl locale from `lang` (`fr-FR` / `en-GB`), not hardcoded.

## Mobile Field Tool
- Phone = atelier field terminal: capture works, fix metadata, nudge pipeline. Desktop = heavy PR/CRM/dashboards.
- Mobile branch: `useMediaQuery('(max-width: 767px)')`.
- Verify at 375px; ~360px minimum no-break.
- No horizontal scroll, clipped controls, desktop fixed widths, unbranched side rails.
- Primary taps >=44px. Save/primary action reachable. Sticky bars use safe-area padding (`max(..., env(safe-area-inset-bottom))`).
- **Phone work images:** canonical path is Lightroom Mobile → Export (JPEG) → iOS Share Sheet → PWA `share_target` → `/atelier/share-receive` → `WorkForm` or **work session** (`/atelier/session/new` → Lightroom workflow steps → Share back → triage **Add to work session**). Do not use `lightroom-cc://` from the PWA (iOS often refuses). Do not use native `capture="environment"` on work paths (`WorkForm`, `WorkDrawerImageArea`).
- **Exceptions:** business-card capture at `/atelier/capture?mode=card` (`CaptureCardClient`) and session/concept native capture may still use `capture="environment"`.
- If `/hub` mobile entry changes: smoke WorkForm, WorkDrawer, Inventory small viewport.
- Narrow Atelier sidebar first group Field: `inventory` → `production` → `stock-take` → `notes` → `map`.
- Rings: A Atelier narrow chrome; B Hub field launcher + mobile bar + `VoiceNoteSheet`; B.3 PWA share target; C field verb routes/stubs plus business-card capture at `/atelier/capture?mode=card`.

## Drawer / Panel Guard
- Serialize form + nested lists to baseline; dirty when current != baseline.
- Save persists then proceeds. Discard proceeds without save. Cancel closes dialog only.
- Use `hooks/useUnsavedActionGuard.tsx`; `useUnsavedCloseGuard` for close overlay.
- Narrow: sticky primary actions + safe-area padding. No read-only text/input overlap in table cells.

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
- Live keep: lowercase `public.tblrelations`. Recreate dropped views without dead columns if needed.

## Admin / Audit Protection
- Admin identity = `Contact.is_admin = true` linked to `auth.uid()`. `is_admin()` single source.
- Hard delete admin only: `purgeWorkPermanently`, `deleteWorkImage`; RLS defense-in-depth.
- Non-admin existing-work edits -> `pending_changes`; allow-list keys in `lib/work-pending-keys.ts`; approval replays via `saveWork` + `__skip_review=1`.
- Oeuvre versions: trigger snapshots OLD row to `oeuvre_versions`; admin restore via `restoreOeuvreVersion(versionId)`.
- R2 delete: use `r2SoftDelete(key)` copy to `recycle/<YYYY-MM-DD>/<key>` before delete. Lifecycle: `recycle/` 90d; `ledger/` screenshots 30d.
- Backups: `.github/workflows/backup.yml` daily pg_dump -> R2 `art-db-backups` via boto3 EU endpoint. See `docs/BACKUP_RECOVERY.md`.
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
