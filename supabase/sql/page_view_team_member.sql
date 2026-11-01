-- Analytics by team member (2026-11-01). Owner: "collaborator is a team member" — and only the
-- admin may see who viewed what.
--
-- `team_contact_id` = the Contact linked to the signed-in team member (`Contact.auth_user_id`),
-- written by `lib/track.ts` only when `is_team()` is true. Public visitors stay anonymous.
-- Past rows cannot be attributed (only `is_team_session` was stored).
--
-- Reads: Analytics uses the service role and returns the per-person breakdown to admins only.
-- Direct reads are narrowed from "any signed-in user" to admin, so the new column is not
-- readable by other team members through the API. Inserts unchanged (service role / anon policy).
-- After applying: npm run gen:types

alter table public.page_view
  add column if not exists team_contact_id integer
    references public."Contact"("ContactID") on delete set null;

comment on column public.page_view.team_contact_id is
  'Team member (Contact) who viewed the page while signed in; null for public visitors and rows before 2026-11-01.';

create index if not exists page_view_team_contact_idx
  on public.page_view (team_contact_id, created_at)
  where team_contact_id is not null;

drop policy if exists auth_select on public.page_view;
drop policy if exists page_view_admin_select on public.page_view;
create policy page_view_admin_select on public.page_view
  for select to authenticated using (public.is_admin());
