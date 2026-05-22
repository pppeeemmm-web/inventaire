-- Capture writes: administrators only. All team members can still read (journal).
-- Run after work_session_team_read.sql.

drop policy if exists "work_session_team_insert" on public.work_session;
create policy "work_session_team_insert"
  on public.work_session
  for insert
  to authenticated
  with check (is_team() and is_admin());

drop policy if exists "work_session_team_update" on public.work_session;
create policy "work_session_team_update"
  on public.work_session
  for update
  to authenticated
  using (is_team() and is_admin())
  with check (is_team() and is_admin());
