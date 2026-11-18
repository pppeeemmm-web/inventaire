# Documentation index — orientation table

**Truth order:** live code → [`CLAUDE.md`](../CLAUDE.md) → [`SITE_MAP.md`](../SITE_MAP.md) → files below.
**DB schema:** always live (Supabase MCP / `lib/types/supabase.generated.ts`) — never from guides.

**Read order for a cold session:** CLAUDE.md (auto-loaded) → this table → `TODO.md` (live checklist; §0 = current bugs) → `DESIGN_DRAWER.md` (design in progress) → `STRATEGY.md` (owner intent). **No open handoff** since 2026-11-15: a new batch gets a `HANDOFF_<date>.md` here, listed in this table; a closed one moves to `archive/` the same day.

| Doc | Use when | Verified |
|-----|----------|----------|
| [`../SITE_MAP.md`](../SITE_MAP.md) | Every route and tab, the API route handlers — enforced by `npm run docs:routes:check` | 2026-11-18 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **Rules map** — fate rule, statuses, every `Oeuvres` trigger in run order, who writes what, derived values, indexing. Update in the same commit as any rule/trigger/writer change | 2026-11-18 (triggers, §7 re-read live; orders, share kit) |
| [`WORK_RULES.md`](./WORK_RULES.md) | **Work rulebook** — Pem's rules on a work's state, where each is enforced, who writes it, live breaks, what is next (batch 1 applied) | 2026-11-18 (push check via `checks:live`) |
| [`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md) | Owner / custodian / address per work stage — the rule every order, screen and trigger follows | 2026-11-12 |
| [`POLICY_NOTES.md`](./POLICY_NOTES.md) | Running list of small policy points to settle (delivery, returns, insurance, fate, COA, files) — each says where it will be written and who confirms | 2026-11-18 |
| [`COMMERCIAL_GUIDELINES.md`](./COMMERCIAL_GUIDELINES.md) | Prices, discounts, collectors' circle, commissions, editions, galleries — first draft, `[[…]]` = Pem's choices | 2026-11-18 (draft) |
| [`ENVIRONMENTAL_POLICY.md`](./ENVIRONMENTAL_POLICY.md) | Materials, packing, sending, digital, yearly measures — first draft, `[[…]]` = Pem's facts | 2026-11-18 (draft) |
| [`STRATEGY.md`](./STRATEGY.md) | Owner intent and order of aims — the filter for new work | 2026-11-15 |
| [`SITE_REVIEW_2026-11-16.md`](./SITE_REVIEW_2026-11-16.md) | Public site review (landing → works, references, daily-feed idea) — TODO R8, parked for Pem | 2026-11-16 |
| [`DESIGN_DRAWER.md`](./DESIGN_DRAWER.md) | Work drawer (TODO R3) — today's blocks, live emptiness, Pem's agreed structure; next = mockups | 2026-11-16 |
| [`TODO.md`](./TODO.md) | Live checklist — one line per open item: bugs to fix now / waiting on Pem / rethink leftovers / to build / to check once / parked | 2026-11-18 (after `747df2b`) |
| [`DONE.md`](./DONE.md) | Closed items, newest first (moved out of TODO) | 2026-11-18 |
| [`design/2026-11-17/Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html) | **Rethink board** — every R step by step, what waits on Pem | 2026-11-18 |
| [`design/2026-11-18/`](./design/2026-11-18/) | This week's designs: R7b order chain, supply orders, collector share kit (Pem's answers), human What's new, Kaizen Création → Idées, products engine | 2026-11-18 |
| [`LEGAL_POLICY.md`](./LEGAL_POLICY.md) + [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md) | Legal policy (France / EU) and the site's legal pages — drafts for a lawyer / accountant | 2026-11-17 (draft) |
| [`TODO_NOTES.md`](./TODO_NOTES.md) | Details behind each open TODO line (reference, not a list) | 2026-11-16 |
| [`TODO_REFUSED.md`](./TODO_REFUSED.md) | Items dropped on purpose, with the reason | 2026-11-13 |
| [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md) | Voice / handwriting / image-description scripts (`scripts/transcribe/`), local GPU | 2026-11-13 |
| [`lib/aide/`](../lib/aide/) | **In-app Aide** (`/atelier/aide`): team guide FR + EN — replaces the two guides below, chapter by chapter (team guide complete; admin guide 2026-11-18, admins only; the old guides and the Studio Bible retired 2026-11-18 → `archive/`). One parser (`markdown.ts`) for the page, the « ? » panel (`screen-map.ts`: screen → chapter) and the PDF guide (`pdf.ts`, `/atelier/aide/guide.pdf`) | Team 1–16 + admin 1–15 verified 2026-11-18 (complete) |
| [`SYSTEM_LEDGER.md`](./SYSTEM_LEDGER.md) | System ledger contract — screen unreachable since the Kaizen merge; `system_log` access | 2026-11-18 |
| [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) | Off-site DB backups + restore drill; image copy + readable archive (`npm run archive`) | 2026-11-13 |
| [`AI_ENGINES.md`](./AI_ENGINES.md) | Which AI engines run where (public site: none; Atelier: Ollama on the PC, optional OpenAI, Make captions) | 2026-11-18 |
| [`BROADCAST.md`](./BROADCAST.md) | Broadcast HTTP API + DB columns + key files | 2026-11-18 |
| [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) | Make.com → Buffer → Slack (outside this repo) | 2026-11-18 |
| [`CONSTELLATION.md`](./CONSTELLATION.md) | Constellation graph feature contract | 2026-11-18 |

**Maintenance rule:** touching a feature → update its doc **and** the `Verified` date in this table, same change.

**Archive:** [`archive/`](./archive/) — closed batches (handoffs up to `HANDOFF_2026-11-14_NEXT`, `HANDOFF_2026-11-13_OPUS`), done plans (`PLAN_SLIDESHOW`, `DESIGN_BRIEF_2026-11-13` + its mocks in `archive/design/2026-11-13/`), V5 programme plan, slice handoffs, superseded plans, `AUDIT_2026-11`, `JOURNAL_PROPOSAL`, `PROJECT_SYNTHESIS`, `MOBILE_RATIONALIZATION_PLAN` (2.2 / Phase 3 dropped 2026-11-13, see `TODO_REFUSED.md`), graphify notes (graph not re-run since 2026-05-24; `ARCHITECTURE.md` + `SITE_MAP.md` do that job) (historical; never execute from there).

**i18n copy pipeline:** [`archive/HANDOFF_SLICE4.md`](./archive/HANDOFF_SLICE4.md) (rules also in `CLAUDE.md` + `AGENTS.md`).
