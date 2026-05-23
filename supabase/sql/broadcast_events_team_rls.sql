-- Allow team members (not only admin) to read broadcast_events via PostgREST — defense-in-depth
-- alongside service-role API routes. Idempotent.
-- On existing DBs, rls_merge_permissive_policies.sql merges admin + team into broadcast_events_select.

drop policy if exists "broadcast_events_team_select" on broadcast_events;
drop policy if exists "broadcast_events_admin_select" on broadcast_events;
drop policy if exists "broadcast_events_select" on broadcast_events;
create policy "broadcast_events_select"
  on broadcast_events
  for select to authenticated
  using (is_admin() or is_team());
