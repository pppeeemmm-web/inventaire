-- NOT USED (Pem 2026-11-19): « Privé » hides a contact from lists / search / pickers only, in the app — no RLS.
-- Kept for reference: a full hide would break the team's orders, papers, reminders and calendar titles (8 orders, 6 works).
-- « Privé » contacts are admin-only (TODO §0, 2026-11-18). NOT APPLIED — needs Pem's OK, AFTER Pem reviews the 32 contacts marked private
-- today (the old import marked every imported contact private) and AFTER the « Contact privé » labels land (they are in branch
-- worktree-agent-a998bbdf038fdc19c, held back: before this SQL they would label contacts that are merely not loaded yet).
--
-- Before: "Contact" RLS = admin or team (anon_read_lockdown.sql, rls_merge_permissive_policies.sql);
-- nothing filtered `is_private`, so the team saw private contacts everywhere (Contacts, pickers, map,
-- work owner / holder names, reports). Child tables (contact_addresses / emails / phones / websites /
-- socials) = team FOR ALL (legacy/migration_v3_rls_fix.sql).
--
-- After:
--   "Contact"      select: admin, or team on non-private rows, or your own row (auth_user_id) — unchanged
--                          except the `is_private` filter.
--                  insert / update / delete: admin, or team on non-private rows (a team member can neither
--                          create, see, edit, mark nor delete a private contact).
--   child tables   all commands: admin, or team when the parent contact is not private.
--
-- Code shipped with this (works before and after it): the app only lets an admin set `is_private`
-- (quick add, Google / URL import, editor); new contacts take the database id (no more « max + 1 »,
-- which RLS would make collide); a work owned / held / bought by a private contact shows « Contact privé »
-- to the team; mergeContacts refuses a private contact to non-admins.
--
-- Not covered here (still read by the team): the graph `nodes` search text and embeddings of private
-- contacts, rows in other tables that name them (Oeuvres.Historique lines, order refs), and any
-- SECURITY DEFINER function that returns contact names.
--
-- Run in the Supabase SQL editor. Idempotent. Then: npm run checks:live, and check as a team login that
-- private contacts are gone from Contacts and that the team can still create / edit / delete public ones.

-- ── Helper: is this contact visible to the team? (security definer: no RLS recursion) ─────────────
create or replace function public.contact_is_public(p_contact_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public."Contact" c
    where c."ContactID" = p_contact_id
      and not coalesce(c.is_private, false)
  );
$$;

revoke all on function public.contact_is_public(bigint) from public, anon;
grant execute on function public.contact_is_public(bigint) to authenticated, service_role;

comment on function public.contact_is_public(bigint) is
  'False for a « Privé » contact (admin-only). Used by RLS on Contact child tables (contact_private_rls.sql).';

-- ── "Contact" ───────────────────────────────────────────────────────────────────────────────────
drop policy if exists "contact: select" on public."Contact";
create policy "contact: select" on public."Contact"
  for select
  using (
    is_admin()
    or (is_team() and not coalesce(is_private, false))
    or auth_user_id = (select auth.uid())
  );

drop policy if exists "contact: insert" on public."Contact";
create policy "contact: insert" on public."Contact"
  for insert to public
  with check (is_admin() or (is_team() and not coalesce(is_private, false)));

drop policy if exists "contact: update" on public."Contact";
create policy "contact: update" on public."Contact"
  for update to public
  using (is_admin() or (is_team() and not coalesce(is_private, false)))
  with check (is_admin() or (is_team() and not coalesce(is_private, false)));

drop policy if exists "contact: delete" on public."Contact";
create policy "contact: delete" on public."Contact"
  for delete to public
  using (is_admin() or (is_team() and not coalesce(is_private, false)));

-- ── Child tables: replace every existing policy with one admin / team-on-public policy ─────────
do $children$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array['contact_addresses', 'contact_emails', 'contact_phones', 'contact_websites', 'contact_socials']
  loop
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;

    execute format('alter table public.%I enable row level security', tbl);

    execute format(
      'create policy %I on public.%I for all to public
         using (is_admin() or (is_team() and public.contact_is_public(contact_id)))
         with check (is_admin() or (is_team() and public.contact_is_public(contact_id)))',
      tbl || ': team all',
      tbl
    );
  end loop;
end;
$children$;

-- ── Contact ids: the app now lets the database assign them ───────────────────────────────────────
-- ContactEditorPanel and the work drawer used to insert « max(ContactID) + 1 » themselves, which can
-- leave the sequence behind the table; move it past the highest id (no-op when there is no sequence).
select setval(
  'public.contact_id_seq',
  greatest((select max("ContactID") from public."Contact"), 1)
);

-- ── Check (read only) ───────────────────────────────────────────────────────────────────────────
-- select tablename, policyname, cmd, qual, with_check from pg_policies
--  where schemaname = 'public'
--    and tablename in ('Contact', 'contact_addresses', 'contact_emails', 'contact_phones', 'contact_websites', 'contact_socials')
--  order by tablename, policyname;
-- select count(*) filter (where is_private) as private, count(*) as total from public."Contact";
