# Documentation index — orientation table

**Truth order:** live code → [`CLAUDE.md`](../CLAUDE.md) → [`SITE_MAP.md`](../SITE_MAP.md) → files below.
**DB schema:** always live (Supabase MCP / `lib/types/supabase.generated.ts`) — never from guides.

**Read order for a cold session:** CLAUDE.md (auto-loaded) → this table → latest `HANDOFF_*.md` (current batch) → `TODO.md` (live checklist) → `STRATEGY.md` (owner intent).

| Doc | Use when | Verified |
|-----|----------|----------|
| [`MOBILE_RATIONALIZATION_PLAN.md`](./MOBILE_RATIONALIZATION_PLAN.md) | Mobile phases 0–2.1 done; 2.2 / Phase 3 waiting on owner decision (see TODO) | 2026-07-16 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **Rules map** — fate rule, statuses, every `Oeuvres` trigger in run order, who writes what, derived values, indexing. Update in the same commit as any rule/trigger/writer change | 2026-11-12 |
| [`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md) | Owner / custodian / address per work stage — the rule every order, screen and trigger follows | 2026-11-12 |
| [`STRATEGY.md`](./STRATEGY.md) | Owner intent and order of aims — the filter for new work | 2026-11-13 |
| [`HANDOFF_2026-11-13_OPUS.md`](./HANDOFF_2026-11-13_OPUS.md) | **Next batch, for Opus** — sign out + password, transcription from the app, description test round 2, "see again" card, docs tidy | 2026-11-13 |
| [`TODO.md`](./TODO.md) | Live checklist — open items only (ops deadlines, product, roadmap) | 2026-11-13 |
| [`DONE.md`](./DONE.md) | Closed items, newest first (moved out of TODO) | 2026-11-13 |
| [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md) | Voice / handwriting / image-description scripts (`scripts/transcribe/`), local GPU | 2026-11-13 |
| [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) | Onboarding (admin): encyclopedia, every feature | Accurate to 2026-07 (dated banner 2026-11-13; later changes → Kaizen → Nouveautés) |
| [`TEAM_MEMBER_GUIDE.md`](./TEAM_MEMBER_GUIDE.md) | Onboarding (non-admin team) | Same banner as the admin guide |
| [`SYSTEM_LEDGER.md`](./SYSTEM_LEDGER.md) | System tab UI contract (also loaded in-app) | 2026-05-29 |
| [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) | Off-site DB backups + restore drill; image copy + readable archive (`npm run archive`) | 2026-11-13 |
| [`BROADCAST.md`](./BROADCAST.md) | Broadcast HTTP API + DB columns + key files | 2026-05-23 |
| [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) | Make.com → Buffer → Slack (outside this repo) | 2026-05-23 |
| [`CONSTELLATION.md`](./CONSTELLATION.md) | Constellation graph feature contract | 2026-05-25 |

**Maintenance rule:** touching a feature → update its doc **and** the `Verified` date in this table, same change.

**Archive:** [`archive/`](./archive/) — V5 programme plan, slice handoffs, superseded plans, `AUDIT_2026-11`, `JOURNAL_PROPOSAL`, `PROJECT_SYNTHESIS`, graphify notes (graph not re-run since 2026-05-24; `ARCHITECTURE.md` + `SITE_MAP.md` do that job) (historical; never execute from there).

**i18n copy pipeline:** [`archive/HANDOFF_SLICE4.md`](./archive/HANDOFF_SLICE4.md) (rules also in `CLAUDE.md` + `AGENTS.md`).
