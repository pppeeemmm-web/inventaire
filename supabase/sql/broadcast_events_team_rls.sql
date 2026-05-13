-- Allow team members (not only admin) to read broadcast_events via PostgREST — defense-in-depth
-- alongside service-role API routes. Idempotent.

drop policy if exists "broadcast_events_team_select" on broadcast_events;
create policy "broadcast_events_team_select"
  on broadcast_events
  for select to authenticated
  using (is_team());
