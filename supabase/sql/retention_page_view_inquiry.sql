-- APPLIED live 2026-11-19 (Pem « Go »; migration retention_page_view_inquiry; dry run: 0 rows due). Legal A.2 n° 3, docs/WEBSITE_LEGAL_PAGES.md §C.3.
-- Retention for the public site's own data:
--   page_view — rows older than 25 months are deleted (CNIL audience-measurement exemption: data kept 25 months max).
--               Rows with no created_at (none expected; the column defaults to now()) are kept: their age is unknown.
--   inquiry   — enquiries older than 3 years are deleted UNLESS followed up (lead decision 2026-11-18). Followed up =
--               ANY of:
--                 • linked to a contact: the enquiry's email matches a contact's email (`Contact."Email"` or
--                   `contact_emails.email`, trimmed, case-insensitive), or it came through a share kit sent to a
--                   contact (`private_link.contact_id` set);
--                 • linked to an order (`work_order_id` set);
--                 • came through a share kit that is still live (`private_link` not revoked, not expired).
--               `status` (open / in_progress / closed) does not count as follow-up on its own.
-- Nothing references `inquiry` by foreign key (checked in lib/types/supabase.generated.ts 2026-11-18), so the delete
-- cascades nowhere. `system_log` rows that name an enquiry by id (Triage approve / archive) keep the id only.
--
-- Runner: `GET /api/cron/retention` (Vercel cron, monthly, vercel.json; Bearer CRON_SECRET) → this function through
-- the service-role client. Manual run (SQL editor): select * from public.retention_page_view_inquiry();
-- Dry run before the first apply — counts what WOULD go, deletes nothing:
--   select
--     (select count(*) from public.page_view
--       where created_at < now() - interval '25 months') as page_view_to_delete,
--     (select count(*) from public.inquiry i
--       where i.created_at < now() - interval '3 years'
--         and i.work_order_id is null
--         and not exists (select 1 from public.private_link pl where pl.token = i.private_link_token
--                         and (pl.contact_id is not null
--                              or (pl.revoked_at is null and (pl.expires_at is null or pl.expires_at > now()))))
--         and not exists (select 1 from public."Contact" c
--                         where lower(btrim(c."Email")) = lower(btrim(i.email)))
--         and not exists (select 1 from public.contact_emails ce
--                         where lower(btrim(ce.email)) = lower(btrim(i.email)))) as inquiry_to_delete;
--
-- Access: SECURITY DEFINER with a fixed search_path; EXECUTE revoked from public / anon / authenticated, granted to
-- service_role only (same shape as supabase/sql/audit_log_ttl.sql). No table, policy or grant on the tables changes.
-- Idempotent: create or replace; safe to run twice.

create or replace function public.retention_page_view_inquiry()
returns table (
  deleted_page_view bigint,
  deleted_inquiry bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n_page_view bigint;
  n_inquiry bigint;
begin
  delete from public.page_view
  where created_at is not null
    and created_at < now() - interval '25 months';
  get diagnostics n_page_view = row_count;

  delete from public.inquiry i
  where i.created_at < now() - interval '3 years'
    -- linked to an order
    and i.work_order_id is null
    -- through a kit sent to a contact, or a kit still live
    and not exists (
      select 1 from public.private_link pl
      where pl.token = i.private_link_token
        and (
          pl.contact_id is not null
          or (pl.revoked_at is null and (pl.expires_at is null or pl.expires_at > now()))
        )
    )
    -- the sender is a contact (main email or any other email of the card)
    and not exists (
      select 1 from public."Contact" c
      where lower(btrim(c."Email")) = lower(btrim(i.email))
    )
    and not exists (
      select 1 from public.contact_emails ce
      where lower(btrim(ce.email)) = lower(btrim(i.email))
    );
  get diagnostics n_inquiry = row_count;

  return query select n_page_view, n_inquiry;
end;
$$;

comment on function public.retention_page_view_inquiry() is
  'Monthly retention (legal A.2 n° 3): page_view > 25 months; inquiry > 3 years with no follow-up (contact email, order, kit sent to a contact or still live). Runner: /api/cron/retention.';

revoke all on function public.retention_page_view_inquiry() from public;
revoke all on function public.retention_page_view_inquiry() from anon;
revoke all on function public.retention_page_view_inquiry() from authenticated;
grant execute on function public.retention_page_view_inquiry() to service_role;

-- Check after:
--   select proname, prosecdef, proconfig from pg_proc where proname = 'retention_page_view_inquiry';
--   select grantee, privilege_type from information_schema.routine_privileges
--     where routine_name = 'retention_page_view_inquiry';   -- expect service_role (+ postgres as owner) only
