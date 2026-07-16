# Documentation index — orientation table

**Truth order:** live code → [`CLAUDE.md`](../CLAUDE.md) → [`SITE_MAP.md`](../SITE_MAP.md) → files below.
**DB schema:** always live (Supabase MCP / `lib/types/supabase.generated.ts`) — never from guides.

**Read order for a cold session:** CLAUDE.md (auto-loaded) → this table → `MOBILE_RATIONALIZATION_PLAN.md` (current workstream) → `TODO.md` (live checklist) → `STRATEGY.md` (owner intent).

| Doc | Use when | Verified |
|-----|----------|----------|
| [`MOBILE_RATIONALIZATION_PLAN.md`](./MOBILE_RATIONALIZATION_PLAN.md) | **Current workstream** — phases, owner decisions, field measurements | 2026-07-16 |
| [`STRATEGY.md`](./STRATEGY.md) | Owner long-term strategy, potentials, non-goals — the filter for new work | skeleton 2026-07-16, content pending owner exchange |
| [`TODO.md`](./TODO.md) | Live checklist (ops deadlines, open product items, roadmap) | 2026-07-16 |
| [`PROJECT_SYNTHESIS.md`](./PROJECT_SYNTHESIS.md) | Onboarding: stack boundaries, broadcast chain, where truth lives | 2026-05-25 — accurate on stack; silent on mobile field-tool era |
| [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) | Onboarding (admin): encyclopedia, every feature | 2026-05-25 — **photo/session/hub sections predate the 2026-07 mobile pass** (banner inside) |
| [`TEAM_MEMBER_GUIDE.md`](./TEAM_MEMBER_GUIDE.md) | Onboarding (non-admin team) | 2026-05-26 — same caveat as admin guide |
| [`SYSTEM_LEDGER.md`](./SYSTEM_LEDGER.md) | System tab UI contract (also loaded in-app) | 2026-05-29 |
| [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) | Off-site DB backups + restore drill | 2026-05-23 |
| [`BROADCAST.md`](./BROADCAST.md) | Broadcast HTTP API + DB columns + key files | 2026-05-23 |
| [`BROADCAST_OUTSIDE_CHAIN.md`](./BROADCAST_OUTSIDE_CHAIN.md) | Make.com → Buffer → Slack (outside this repo) | 2026-05-23 |
| [`CONSTELLATION.md`](./CONSTELLATION.md) | Constellation graph feature contract | 2026-05-25 |
| [`feature-graph.md`](./feature-graph.md) | Graph layer index (Slices 5–8 + export/backup pointers) | 2026-05-23 |
| [`GRAPHIFY_NOTES.md`](./GRAPHIFY_NOTES.md) | Graphify audit notes (2026-05-24 run) | 2026-05-25 |

**Maintenance rule:** touching a feature → update its doc **and** the `Verified` date in this table, same change.

**Archive:** [`archive/`](./archive/) — V5 programme plan, slice handoffs, superseded plans (historical; never execute from there).

**i18n copy pipeline:** [`archive/HANDOFF_SLICE4.md`](./archive/HANDOFF_SLICE4.md) (rules also in `CLAUDE.md` + `AGENTS.md`).
