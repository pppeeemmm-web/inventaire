-- system_log: team only (stress test 2026-11-18, S3). Applied to production 2026-11-18 on Pem's
-- « Yes, apply it » (migration `system_log_team_only`).
--
-- Before: any signed-in account could read every entry (amounts, payment methods, order refs,
-- moves, errors) and write a fake one (`authenticated_read` / `authenticated_insert` = true).
-- After: read and write need is_team(); update / delete stay admin only (unchanged).
--
-- Who writes it, checked 2026-11-18: the app as a team member (SystemTab, lib/utils/logging.ts,
-- lib/error-reporter/server.ts), the service client (app/api/system/log-error, cron) — the service
-- role bypasses RLS, so browser error reports from signed-out pages keep landing. A signed-in
-- account outside the team (none today; sign-ups are off) can no longer log or read.

drop policy if exists authenticated_read on public.system_log;
drop policy if exists authenticated_insert on public.system_log;

create policy system_log_team_read on public.system_log
  for select to authenticated
  using ((select is_team()));

create policy system_log_team_insert on public.system_log
  for insert to authenticated
  with check ((select is_team()));
