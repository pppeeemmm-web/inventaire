-- PostgREST privileges for calendar OAuth tables (companion to calendar_sync.sql).
-- Apply if grant_audit_queries.sql lists calendar_account / calendar_event_link
-- under table_missing_authenticated_select, or after first 42501 on calendar routes.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_account TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_link TO authenticated;
