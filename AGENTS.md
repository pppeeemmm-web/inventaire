# Agent Instructions

- **Frameworks:** Next.js 15, Tailwind, Supabase.
- **Testing:** Write Playwright tests for new UI components. Hub / mobile bar / field launcher specs are gated on `ATELIER_E2E=1`; run **`npm run test:e2e:field`** (see `scripts/run-atelier-e2e.mjs`) with a logged-in dev session, or `npm run test:e2e` for the full suite.
- **Style:** Functional components; avoid `any` in TypeScript.
- **Verification:** Before finishing a task, run `npm run lint`. UI/copy changes: also `npm run i18n:check` (must pass; blocking hardcoded strings fail CI). Atelier shell / `BottomStack` / curation modals: `npm run atelier:chrome:check` (CI blocking).

## Source Of Truth

- **`origin/main` is release truth.** Work from real `main` tracking `origin/main` by default; checkpoint branches/worktrees are scratch only and never count as done.
- **Done means on `origin/main`.** Do not report a task as done/clean/shipped unless intended changes are committed, checks are known, and the commit is on `origin/main`. Push only when the repo owner asks; until then say `committed locally`.
- **Precise wording = truth.** Do not say done/clean/shipped/pushed/deployed/online/implemented/fixed/verified/safe unless evidence proves that exact state. If evidence is missing or a tool is blocked, say `I cannot prove this; treat it as not done.`
- **Worktrees are scratch.** One writing session per checkout; a second writing session works in its own worktree (`CLAUDE.md` → Sessions), leaves its work uncommitted, and the main checkout lands it. Worktree branches stay local and never count as done.
- **Final git sanity:** before finishing, check `git status --short --branch` and `git log --oneline origin/main..HEAD`; if ahead, report it as committed locally, not production truth, until the owner asks for the push.
- **Release evidence:** before completion wording, run or derive the fields from `pwsh scripts/release-truth.ps1`: branch, HEAD SHA, origin/main SHA, HEAD==origin/main, working tree, checks. `deployed`/`online` requires separate production evidence.
- **New UI copy:** use `lib/i18n/messages/*.messages.ts` with `defineMessages()` for FR+EN together; wire in `lib/i18n/messages/index.ts`. Do not add new feature copy through the legacy `keys.ts` + `fr.ts` + `en.ts` triple path unless maintaining old legacy copy.
- **i18n allowlist:** `scripts/i18n-check-allowlist.json` must match `.eslintrc.json` `no-hardcoded-jsx-text: off` paths. See `docs/archive/HANDOFF_SLICE4.md`.

## Working agreement (repo owner)

- **Caution over speed** (`CLAUDE.md`): ship when the slice is right, not when a clock says so; never trade RLS, auth, bilingual copy rules or data-safety checks for speed.
