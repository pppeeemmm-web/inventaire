-- People step 5 follow-up (flow review 2026-11-23): a moment that names a private person is about that person,
-- so a non-admin must not read it, wherever it is read (person timeline + its counts, Journal day, stream).
-- The rule lives in the read policy (principle 1), not in each reader.
-- The check reads moment_person from inside moment's policy; moment_person's own policy reads moment back, so the
-- check runs as definer (no policy loop). It answers yes / no for one moment and the caller only — nothing else.

create or replace function public._moment_visible(p_moment bigint, p_private boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_team()
     and (
       public.is_admin()
       or (
         not coalesce(p_private, false)
         and not exists (
           select 1
           from public.moment_person mp
           join public."Contact" c on c."ContactID" = mp.contact_id
           where mp.moment_id = p_moment and c.is_private is true
         )
       )
     )
$$;

revoke all on function public._moment_visible(bigint, boolean) from public, anon;
grant execute on function public._moment_visible(bigint, boolean) to authenticated;

drop policy if exists "moment: team read" on public.moment;
create policy "moment: team read" on public.moment for select to authenticated
  using (public._moment_visible(id, is_private));
-- moment_person / moment_work policies read through moment, so they follow.
