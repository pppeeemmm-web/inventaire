-- Audit / ledger TTL — bounded growth for high-churn tables.
-- Apply in Supabase SQL editor. Weekly runner: `.github/workflows/audit-prune.yml` (secret `SUPABASE_DB_URL`, same as backup).
--
-- Retention (locked with product owner):
--   oeuvre_versions     — 365 days (changed_at)
--   pending_changes     — 180 days for approved/rejected only (coalesce(reviewed_at, created_at)); pending rows kept
--   broadcast_events    — 180 days for non-error rows; event_type = error (case-insensitive) never auto-deleted
--   system_log          — 365 days for machine rows (event_type IS NOT NULL); manual operator rows (event_type IS NULL) never deleted
--
-- Phase 3+ logging tables: add matching DELETE branches here from day one.

create or replace function public.audit_log_prune()
returns table (
  deleted_oeuvre_versions bigint,
  deleted_pending_changes bigint,
  deleted_broadcast_events bigint,
  deleted_system_log bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  n1 bigint;
  n2 bigint;
  n3 bigint;
  n4 bigint;
begin
  delete from oeuvre_versions
  where changed_at < timezone('utc', now()) - interval '365 days';
  get diagnostics n1 = row_count;

  delete from pending_changes
  where status in ('approved', 'rejected')
    and coalesce(reviewed_at, created_at) < timezone('utc', now()) - interval '180 days';
  get diagnostics n2 = row_count;

  delete from broadcast_events
  where created_at < timezone('utc', now()) - interval '180 days'
    and lower(coalesce(event_type, '')) <> 'error';
  get diagnostics n3 = row_count;

  delete from system_log
  where event_type is not null
    and created_at is not null
    and created_at < timezone('utc', now()) - interval '365 days';
  get diagnostics n4 = row_count;

  return query select n1, n2, n3, n4;
end;
$$;

comment on function public.audit_log_prune() is
  'Weekly housekeeping: prune old oeuvre_versions, closed pending_changes, non-error broadcast_events, automated system_log rows. Extend for new audit tables.';

revoke all on function public.audit_log_prune() from public;
grant execute on function public.audit_log_prune() to postgres;
grant execute on function public.audit_log_prune() to service_role;
