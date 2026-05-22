-- Team-wide read on work_session (journal / day view). Writes stay owner-or-admin.
-- Run in Supabase SQL Editor after work_session.sql.

drop policy if exists "work_session_team_select" on public.work_session;
create policy "work_session_team_select"
  on public.work_session
  for select
  to authenticated
  using (is_team());
