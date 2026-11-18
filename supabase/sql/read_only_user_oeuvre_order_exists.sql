-- Live data checks (scripts/checks/live-checks.mjs, `npm run checks:live`, run by ship.ps1 before every push) go through
-- the Management API read-only endpoint, which logs in as supabase_read_only_user (member of pg_read_all_data).
-- Work rules 9 and 10 (supabase/sql/work_rules_checks.sql) call public.oeuvre_order_exists — STABLE, SECURITY DEFINER,
-- a boolean lookup on work_order / work_order_work, which that role can already read. Without EXECUTE they failed with
-- 42501 and showed « could not run ».
-- Applied live 2026-11-18 (Pem's OK, migration read_only_user_oeuvre_order_exists). Nothing else is granted.
grant execute on function public.oeuvre_order_exists(integer, text, integer) to supabase_read_only_user;
