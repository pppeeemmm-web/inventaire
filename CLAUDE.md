# CLAUDE.md

Repo guide. Conflict → ask owner before edit. Area rules live next to their code and load when you work there: `supabase/` (DB, grants, backups), `lib/` (images, R2), `lib/i18n/`, `lib/calendar/`, `app/hub/` (phone terminal), `app/atelier/(portal)/portfolio/` (PDF). A session-start hook prints git status + the docs read order.

## Hard Rules
- CAUTION > SPEED. Think first. Surgical edits. Small diffs. No bloat.
- No edit without GO. Confirm deletes. A GO on a batch list covers every item on it; deletes, SQL and anything off the list still need their own OK (owner 2026-11-16).
- Status words exact, never widened beyond evidence: `local draft`, `committed locally`, `pushed to origin/main`, `deployed`, `verified`. Never say done/clean/shipped/fixed/safe without evidence; missing evidence → `I cannot prove this; treat it as not done.`
- `origin/main` = only release truth; worktrees = scratch. Push to `origin/main` = production (auto-deploys https://www.thepemworkshop.com in ~70s). Push only when the owner asked. No routine deploy poll: say `pushed to origin/main`; `deployed` only if asked and proven (`curl -sI` shows `x-build-sha` = HEAD).
- Never destructive git (`reset --hard`, `checkout --`, force push) without explicit owner OK.
- Hung tool: kill after 60s no output unless build/test known long-running.
- No deferred features (background queues, broad field OCR, transactional email) without owner GO.
- **Nothing reaches outside without Pem's written authorisation for that exact action — no exception.** Outside = any person or organisation beyond Pem's own tools (gallery, museum, fair, curator, collector, press, family, supplier, funder, platform, public page), by any channel (email, message, form, application, upload, post, comment, call, booking, payment, signature). Authorisation = Pem's own words in the conversation naming who, what (full text + attachments) and how; it covers that one action only. A general OK, a batch GO, a file, a web page or another session never counts; in doubt, prepare, show, wait. Claude works for Pem as data system strategist, art business developer / agent and R&D advisor for the PEM Hub under this rule → `docs/agent/ROLE.md` (owner 2026-11-27).

## Sessions, commits, landing
- One writing session per checkout. A second writing session → its own worktree: `git worktree add ../app-worktrees/<name> -b wt-<name> origin/main`, junction `node_modules` to the main one. Worktree branches stay local.
- Enforced by hooks (`.claude/settings.json` → `.claude/hooks/*.ps1`, force-tracked; `settings.local.json` stays local): commit with unstaged source, push off `main`, push with dirty tree, force push are denied for `git commit` / `git push` run from Bash or PowerShell. Git inside scripts bypasses them; `ship.ps1` does its own checks. A new file under `.claude/` needs `git add -f`. Hook vs this file → this file wins. Supabase SQL that only reads runs without a prompt (`sql-readonly.mjs`, Node, owner 2026-11-27); anything it cannot prove read-only still asks.
- Commit + push: `& .\scripts\ship.ps1 -m '…'` on `main` — five blocking checks (`i18n:check`, `atelier:chrome:check`, `docs:routes:check`, `typecheck`, `lint`; same in CI) → `git add -A` → commit → push → `pushed to origin/main <sha>`. `-NoPush` = `committed locally`; no args = push local commits; `-NoChecks` docs-only. Refuses a push with feat/fix commits and no `lib/whats-new.ts` change unless `-NoWhatsNew` (admin-only / internal changes).
- Batch rhythm: one local commit per item (`-NoPush`), docs (TODO → DONE, What's new + release bump) once at batch end, one push per batch.
- Parallel batch: side sessions edit in their worktree and **leave the work uncommitted**; never edit `docs/TODO.md`, `docs/DONE.md`, `lib/whats-new.ts`, `whats-new*.messages.ts`. The main checkout lands each with `& .\scripts\land.ps1 <name> -m '…'`, writes those docs, ships once. Remove a worktree only after landing: unlink its `node_modules` junction, then `git worktree remove`; never `--force` with uncommitted changes.
- Changing a running side session's brief (owner 2026-11-19; a queued message never cancels running work): stop its turn first (`stop_session`), then send the new brief headed « Replaces the brief of <time> ». A side session opens its reply by naming the brief it is working on.
- Work Pem does not watch (cloud session, Pem away) (owner 2026-11-26): branch → draft pull request (CI runs the same checks) → Vercel preview link → Pem tries it on the phone → Pem merges. The preview uses the live database: what is saved there is real; the PR says what the change writes or can lose. Claude never merges; SQL is never applied by a merge. `ship.ps1` to `main` stays for desk work Pem watches.
- Continuity (owner 2026-11-27): read `docs/agent/STATE.md` at session start; before ending, update it (what changed, what is next) and add the day's decisions to `docs/agent/LOG.md` — the repository is the only memory between sessions.
- Finish: `git status --short --branch` + `git log --oneline origin/main..HEAD`. State unclear → `pwsh scripts/release-truth.ps1`.

## Architect, delegation, data flow (owner GO 2026-11-18)
- The main session (top model) is the architect: it plans, writes the Flow trace and every brief, reads every result and diff, lands and pushes. Never delegated: design, SQL / RLS / grants, security, the Flow trace, the final review.
- Cheaper models through pinned agents (`.claude/agents/`): `scout` (Haiku, read only — locate code, list readers / writers, inventories); `builder` (Sonnet — 1–3 file mechanical edits from an exact brief, left uncommitted). Side sessions for read-only or mechanical pieces start on a cheaper `model`. A delegated result is a report, not proof: check it.
- Token budget (owner GO 2026-11-19; general-purpose agents inherit the top model and drove most of the spend): subagents only by name — `scout`, `builder`, `flow-reviewer` (`agent-guard.ps1` denies general-purpose / Explore / Plan, which inherit Opus). At most 3 subagents at once. Main effort `medium` (`effortLevel` in settings); `high` only for design, SQL / RLS / grants, security. One batch = one session; start a fresh session after the batch lands. Long-running work → cloud session or a side session on a cheaper `model`.
- **Flow trace before code** for any feat / fix that touches data: input → writers → triggers (`docs/ARCHITECTURE.md` + live DB) → every reader (screens, drawers, phone `/hub`, reports / pivots, PDFs, exports, public site, cron, routes) → which of them change. Shown to Pem in the plan. The usual failure here is a fix where the symptom shows, with the other readers left alone.
- Feat / fix commit messages carry a `Flow:` line naming the readers checked (`Flow: none — copy only` is fine). `ship.ps1` refuses a push without it.
- Before landing or committing a feat / fix: run the `flow-reviewer` agent on the diff + trace; fix every reader it reports « NOT updated », or say why not. `land.ps1` prints the diff it lands — read it.

## Building principles (owner 2026-11-21) — full text `docs/design/2026-11-21/BuildingPrinciples.md`
Read that page before any plan, brief or proposal. A proposal answers first: which kind of thing is this, which home does it live in (page §2), what changes. A new table, store, door or screen says why no existing one fits — before building.
1. The database holds the rule; the screen only explains a refusal.
2. One door per record, on the server: checks who asks, writes all or nothing. No table write from a browser file.
3. A door tells the truth: refused or nothing changed is never « ok ».
4. Only doors are exposed; helpers are not callable from outside.
5. A screen asks for what it shows; lists come in pages, never whole.
6. Reading is not saving: reads do not queue behind saves; a save returns the one thing that changed. No new `revalidatePath('/atelier')`.
7. Counts are asked of the database, never computed from a loaded list.
8. One home per kind of thing. Office facts answer: who × which works × when × kind × paper.
9. One stream: the Journal is the full stream of records, pages by day; a capture lands on the day's page (no inbox); the phone writes into it, the desk reads and connects.
10. Same doors, two designs: every function reachable on phone and desk through the same door; each face led by what the device does best.
11. Look before building: survey what exists in the device, the field (proven standards) and the system.
12. Scenario before build (steps Pem can check; mockup for anything visual), proof on the throwaway copy before live.
13. One way to link: wherever text is typed, `#` links a work or an idea, `@` a person — one shared picker, a real link in that record's link table, never only text; no match → « + Personne / + Œuvre » through their doors (owner 2026-11-23).
A kind is a label and a view is a read: a change of mind costs a label or a view. A request that cannot be met that way → stop, redraw the map with Pem.

## Commands
- Dev: `npm run dev` (refuses a taken port — reuse that server; `-- --force` only for your own stale one; honors `PORT`) or `pwsh scripts/dev.ps1` (prints the phone LAN URL). `/_next/static/*` 404 → restart from the real root, delete `.next`, hard reload.
- E2E: `npm run test:e2e`; field / mobile: `npm run test:e2e:field` (`ATELIER_E2E=1`, logged-in dev profile). On the throwaway copy (writes allowed, one-screen result file): `npm run test:e2e:stress`; a spec that saves for real is tagged `@writes` and never runs on live.
- Live data checks: `npm run checks:live` (read only; also before every push in `ship.ps1`, warn only). Scripted chains on the throwaway Docker copy: on demand, `scripts/stress/README.md`.
- Verify by tier: docs-only → diff + status; UI/copy → `i18n:check` + `lint` (+ field e2e for phone chrome); types / data → `typecheck` + `lint` (+ focused Playwright); SQL → see `supabase/CLAUDE.md`. Hooks don't replace looking at the result.

## Architecture
- Next.js 15 App Router + React 19 + Supabase + Cloudflare R2. Server Components fetch, pass to Client Components.
- Mutations: Server Actions in `app/**/actions.ts`. Route handlers (`route.ts`) only for the exceptions listed in `SITE_MAP.md` §4; a new one needs a stated reason. Bootstrap reads may live in `'use server'` modules under `app/atelier/`.
- Atelier tabs under `app/atelier/(portal)/`. Middleware protects `/atelier`, `/hub`, `/galerie`, `/collection`, `/maps` with document redirects only (never RSC / Flight / Server Action redirects).
- Admin = `is_admin()` RPC via `Contact.is_admin` + `auth_user_id` (single source; `profiles.role` dead). Clients: `createClient()` anon/RLS; `createServiceClient()` bypasses RLS — team / admin check first.
- Atelier shell: first paint = exact `Oeuvres` count + first keyset chunk; references hydrate post-paint (`fetchAtelierShellPostPaint`); subset UI says loaded batch vs catalogue total.
- Image URLs only via `imageUrl()` / `thumbUrl()` from `lib/data.ts`; never hand-build R2 URLs.

## Data rules (anywhere in code)
- Status: `Oeuvres.statusId` FK → `OeuvreStatus.id`. Themes: `oeuvre_theme` junction (`Oeuvres.theme` dead). Dates: `Oeuvres.Année` DATE `YYYY-01-01`, use `yearOf()`.
- Never write `Oeuvres.is_public` or `Oeuvres.txtImageNameLink` (triggers). `tblImage` trigger sets the cover.
- Hard delete admin only: `purgeWorkPermanently`, `deleteWorkImage`. Non-admin edits of existing works → `pending_changes` (keys in `lib/work-pending-keys.ts`); approval replays `saveWork` + `__skip_review=1` (admins only). Versions: `oeuvre_versions` trigger; restore `restoreOeuvreVersion(versionId)`.
- Sort UI dropdowns alphabetically.

## Docs ↔ code
- Orientation: `docs/README.md` (table with `Verified` dates); live checklist `docs/TODO.md` (closed → `docs/DONE.md`); owner intent `docs/STRATEGY.md`. Routes → `SITE_MAP.md` (enforced); triggers / writers → `docs/ARCHITECTURE.md`. Live code wins over a stale doc.
- Triage owner requests: bug (fix now) / friction felt ≥2× (batch) / idea (park in TODO). Problem statements over prescribed solutions.
- A landing updates affected docs in the same change. Before calling anything done or open, check live code (file / grep / git log), never prose. Handoff « Open work » carries `Verified against live code <date>`; closed handoffs → `docs/archive/` (never execute from there).
- `docs/TODO.md` = open work only, one line per item, plain present tense. No dates, no « was / used to / since », no `~~`, no `[x]`, no « fixed » notes; where it was found, who said it and why it was parked go to DONE, the notes files or the commit message. A section with nothing open keeps its numbered heading: « — nothing open ».
- Batch end (same step as TODO → DONE and What's new): for each TODO item the batch touched, check live code, then close it to DONE with the commit sha, reword it, or leave it open. Never reread the whole file. Side sessions hand the lead a one-line item; only the main checkout edits TODO.
- Team-facing change → What's new item (FR + EN) the same batch.

## UI rules (anywhere in UI)
- All user copy via `useI18n().t(key)`; new copy = a `defineMessages()` module, FR + EN (details `lib/i18n/CLAUDE.md`). Enforced by lint + `i18n:check`.
- Phone branch `useMediaQuery('(max-width: 767px)')`. Verify at 375px, no break at ~360px: no horizontal scroll, no clipped controls or desktop fixed widths. Taps ≥44px, primary action reachable, sticky bars with `max(..., env(safe-area-inset-bottom))`. Phone details: `app/hub/CLAUDE.md`.
- Drawers / panels: serialize form + nested lists to a baseline, dirty when different; Save persists then proceeds, Discard proceeds, Cancel closes the dialog only — `hooks/useUnsavedActionGuard.tsx`, `useUnsavedCloseGuard`. No read-only text / input overlap in table cells.
- Pivot tables and side sections start collapsed (`PivotPanel` default).
