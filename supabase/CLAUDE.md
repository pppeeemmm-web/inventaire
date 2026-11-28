# supabase/ — database rules (loaded when working here; root CLAUDE.md still applies)

- Live project: « Pem Art db », id **`mcrzsxrcoexnlwmaunte`** (eu-north-1) — pass it to the Supabase MCP tools directly; no `list_projects`.
- DB schema: read live (Supabase MCP or `lib/types/supabase.generated.ts`), never from guides.
- New public tables: snake_case, no `tbl` prefix; RLS + policies + explicit `GRANT` for PostgREST roles (`authenticated`, `anon` where public writes). Missing grant => 42501 despite RLS.
- Audit grants after schema changes: `supabase/sql/grant_audit_queries.sql`. Service-role-only tables: say so in the migration comment; don't widen the grant.
- After SQL is live: `npm run gen:types` (needs `SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`), then `npm run typecheck`.
- Triggers, DB functions, who writes what → `docs/ARCHITECTURE.md` (read the live DB when touching, update it in the same commit).
- Live keep: lowercase `public.tblrelations`. Recreate dropped views without dead columns if needed.
- `work_session` journal: any `is_team()` user reads all team sessions; writes = session owner or admin. Journal empty for team members → run `supabase/sql/work_session_team_read.sql`.
- Audit prune: `supabase/sql/audit_log_ttl.sql`; never auto-delete manual `system_log` (`event_type IS NULL`) or error broadcast events.
- Backups: DB daily — `.github/workflows/backup.yml` pg_dump → R2 `art-db-backups` (boto3, EU endpoint). Images + Vault: weekly mirror to this PC (`npm run archive`, task « PEM archive export » → `%USERPROFILE%\PEM-Archive`). See `docs/BACKUP_RECOVERY.md`.
