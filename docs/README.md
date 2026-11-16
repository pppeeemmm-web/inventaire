# Documentation index — orientation table

**Truth order:** live code → [`CLAUDE.md`](../CLAUDE.md) → [`SITE_MAP.md`](../SITE_MAP.md) → files below.
**DB schema:** always live (Supabase MCP / `lib/types/supabase.generated.ts`) — never from guides.

**Read order for a cold session:** CLAUDE.md (auto-loaded) → this table → `TODO.md` (live checklist; §0 = current bugs) → `RETHINK_2026-11-14.md` + `DESIGN_DRAWER.md` (design in progress) → `STRATEGY.md` (owner intent). **No open handoff** since 2026-11-15: a new batch gets a `HANDOFF_<date>.md` here, listed in this table; a closed one moves to `archive/` the same day.

| Doc | Use when | Verified |
|-----|----------|----------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **Rules map** — fate rule, statuses, every `Oeuvres` trigger in run order, who writes what, derived values, indexing. Update in the same commit as any rule/trigger/writer change | 2026-11-15 |
| [`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md) | Owner / custodian / address per work stage — the rule every order, screen and trigger follows | 2026-11-12 |
| [`STRATEGY.md`](./STRATEGY.md) | Owner intent and order of aims — the filter for new work | 2026-11-15 |
| [`RETHINK_2026-11-14.md`](./RETHINK_2026-11-14.md) | **Pem's rethink — what comes next** — inputs → outputs (R1), mobile terminal + his annotated phone mockups for Claude Design (R2), work drawer (R3), timeline / map / previews (R4); slideshow done. Design first, not a GO | 2026-11-15 |
| [`SITE_REVIEW_2026-11-16.md`](./SITE_REVIEW_2026-11-16.md) | Public site review (landing → works, references, daily-feed idea) — TODO R8, parked for Pem | 2026-11-16 |
| [`DESIGN_DRAWER.md`](./DESIGN_DRAWER.md) | Work drawer (TODO R3) — today's blocks, live emptiness, Pem's agreed structure; next = mockups | 2026-11-16 |
| [`TODO.md`](./TODO.md) | Live checklist — one line per open item: bugs to fix now / waiting on Pem / rethink (design first) / to build / to check once / parked | 2026-11-16 |
| [`DONE.md`](./DONE.md) | Closed items, newest first (moved out of TODO) | 2026-11-16 |
| [`TODO_NOTES.md`](./TODO_NOTES.md) | Details behind each open TODO line (reference, not a list) | 2026-11-16 |
| [`TODO_REFUSED.md`](./TODO_REFUSED.md) | Items dropped on purpose, with the reason | 2026-11-13 |
| [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md) | Voice / handwriting / image-description scripts (`scripts/transcribe/`), local GPU | 2026-11-13 |
| [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) | Onboarding (admin): encyclopedia, every feature | Accurate to 2026-07 (dated banner 2026-11-13; later changes → Kaizen → Nouveautés) |
| [`TEAM_MEMBER_GUIDE.md`](./TEAM_MEMBER_GUIDE.md) | Onboarding (non-admin team) | Same banner as the admin guide |
| [`SYSTEM_LEDGER.md`](./SYSTEM_LEDGER.md) | System tab UI contract (also loaded in-app) | 2026-05-29 |
| [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) | Off-site DB backups + restore drill; image copy + readable archive (`npm run archive`) | 2026-11-13 |
| [`BROADCAST.md`](./BROADCAST.md) | Broadcast HTTP API + DB columns + key files | 2026-05-23 |
| [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) | Make.com → Buffer → Slack (outside this repo) | 2026-05-23 |
| [`CONSTELLATION.md`](./CONSTELLATION.md) | Constellation graph feature contract | 2026-05-25 |

**Maintenance rule:** touching a feature → update its doc **and** the `Verified` date in this table, same change.

**Archive:** [`archive/`](./archive/) — closed batches (handoffs up to `HANDOFF_2026-11-14_NEXT`, `HANDOFF_2026-11-13_OPUS`), done plans (`PLAN_SLIDESHOW`, `DESIGN_BRIEF_2026-11-13` + its mocks in `archive/design/2026-11-13/`), V5 programme plan, slice handoffs, superseded plans, `AUDIT_2026-11`, `JOURNAL_PROPOSAL`, `PROJECT_SYNTHESIS`, `MOBILE_RATIONALIZATION_PLAN` (2.2 / Phase 3 dropped 2026-11-13, see `TODO_REFUSED.md`), graphify notes (graph not re-run since 2026-05-24; `ARCHITECTURE.md` + `SITE_MAP.md` do that job) (historical; never execute from there).

**i18n copy pipeline:** [`archive/HANDOFF_SLICE4.md`](./archive/HANDOFF_SLICE4.md) (rules also in `CLAUDE.md` + `AGENTS.md`).
