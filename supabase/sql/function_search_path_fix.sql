-- Fixed search_path on 6 trigger functions (owner GO 2026-11-12, Supabase advisor 0011).
--
-- Without a fixed search_path a function resolves unqualified names through the caller's path.
-- protect_admin_flags matters most (SECURITY DEFINER); the others are plain trigger functions.
-- All six only use public tables and pg_catalog built-ins (pg_catalog is always searched first),
-- so behaviour does not change. No GRANT/RLS change.

alter function public.protect_admin_flags() set search_path = public;
alter function public.enforce_anonymity_level_on_status() set search_path = public;
alter function public.sync_sale_order_return_window_from_shipment() set search_path = public;
alter function public.work_session_touch() set search_path = public;
alter function public.sketchbook_touch() set search_path = public;
alter function public.voice_note_touch() set search_path = public;
