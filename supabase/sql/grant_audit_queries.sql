-- =============================================================================
-- Grant & RLS audit (read-only)
-- Run in Supabase SQL Editor (or psql) as a role that can read pg_catalog.
--
-- PostgREST returns 42501 when the JWT role lacks table privileges, even if
-- RLS policies exist. Supabase enforcement: new projects ~2026-05-30; existing
-- ~2026-10-30 — see 🛂 SUPABASE GRANTS in CLAUDE.md.
--
-- Remediation: add GRANT + RLS + policies in the same migration that creates
-- the table. Template: supabase/sql/inquiry.sql
-- =============================================================================

-- 1) public.base tables where role "authenticated" has no SELECT privilege
--    (typical blocker for signed-in PostgREST / SSR anon key with user JWT).
SELECT c.oid::regclass AS table_missing_authenticated_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
ORDER BY 1;

-- 2) public.base tables with RLS enabled but zero policies (locks out
--    non–service_role access until policies are added).
SELECT c.oid::regclass AS table_rls_enabled_zero_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = c.relname
  )
ORDER BY 1;
