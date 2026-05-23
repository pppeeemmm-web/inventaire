-- =============================================================================
-- Grant & RLS audit (read-only)
-- Supabase SQL Editor: run the COMBINED REPORT below, or run A / B one at a time.
--
-- Success = zero rows for that check.
-- PostgREST error 42501 often means a table failed check A and/or B.
-- Deadline context: CLAUDE.md (Supabase GRANT enforcement ~Oct 2026).
--
-- Fix templates:
--   supabase/sql/inquiry.sql
--   supabase/sql/consignment_shipment_rls.sql
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- COMBINED REPORT (recommended — one result grid)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  audit_check,
  table_name,
  what_to_do
FROM (
  -- A — logged-in users (role authenticated) cannot SELECT this table
  SELECT
    1 AS sort_key,
    'A · no SELECT for logged-in users' AS audit_check,
    c.oid::regclass::text AS table_name,
    'GRANT SELECT ON table TO authenticated; add RLS policies if rows must be restricted' AS what_to_do
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')

  UNION ALL

  -- B — RLS is ON but there are zero policies (blocks everyone except service_role)
  SELECT
    2 AS sort_key,
    'B · RLS on, zero policies' AS audit_check,
    c.oid::regclass::text AS table_name,
    'Add RLS policies, OR revoke client grants and document as service-role-only worker table' AS what_to_do
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
) audit
ORDER BY sort_key, table_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- A alone — copy from here to the semicolon, then Run
-- Question: which tables can a signed-in user not read at all?
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT c.oid::regclass::text AS table_name
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
-- ORDER BY 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- B alone — uncomment and run
-- Question: which tables have RLS enabled but no policy rows?
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT c.oid::regclass::text AS table_name
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND c.relrowsecurity
--   AND NOT EXISTS (
--     SELECT 1
--     FROM pg_policies p
--     WHERE p.schemaname = 'public'
--       AND p.tablename = c.relname
--   )
-- ORDER BY 1;
