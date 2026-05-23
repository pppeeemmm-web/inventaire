-- Remediation: Supabase advisor 0010 (security_definer_view) on graph read models.
-- Run once if 06 / 08 were applied without security_invoker (Postgres 15+).
-- Safe to re-run: ALTER VIEW SET is idempotent.

ALTER VIEW public.entity SET (security_invoker = true);
ALTER VIEW public.edge_fact SET (security_invoker = true);
