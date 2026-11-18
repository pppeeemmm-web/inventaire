-- Tidy-up after order_race_guards.sql (applied 2026-11-18): its two trigger functions kept the default EXECUTE for
-- PUBLIC / anon / authenticated. Harmless (a trigger function can't be called through the API), but house style
-- revokes it. Postgres checks EXECUTE on a trigger function only at CREATE TRIGGER, not when the trigger fires, so
-- both guards keep firing for every role. Pem OK 2026-11-18 (« If it's fine, we go ahead »).

revoke execute on function public.work_order_line_one_open() from public, anon, authenticated;
revoke execute on function public.payments_within_price() from public, anon, authenticated;
