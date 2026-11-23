-- People step 6 (People.md §5 timeline: « custody / ownership changes from work versions »).
-- A read, no write. `oeuvre_versions.snapshot` is the row BEFORE an update (snapshot_oeuvre stores OLD), so a
-- change at version i goes from snapshot i to snapshot i+1 — or to the current Oeuvres row for the last one.
-- Roles: owner = Oeuvres.ContactID, holder = LocalisationID, buyer = AcheteurID.
-- oeuvre_versions is admin-only under RLS (snapshots hold prices); these reads run as definer and return only
-- work id, role, direction, the other person and the date. Team only; a private card's history is admin only.
-- Keyset (changed_at desc, version id desc, role desc): one version can change two roles at once.

create or replace function public._person_custody_rows(p_contact integer)
returns table (at timestamptz, version_id bigint, oeuvre_id integer, role text, direction text, other_contact integer)
language sql
stable
security definer
set search_path = public
as $$
  with x as (select p_contact::text as id),
  works as (
    select v.oeuvre_id from public.oeuvre_versions v, x
    where v.snapshot->>'ContactID' = x.id or v.snapshot->>'LocalisationID' = x.id or v.snapshot->>'AcheteurID' = x.id
    union
    select o."OeuvreID" from public."Oeuvres" o
    where o."ContactID" = p_contact or o."LocalisationID" = p_contact or o."AcheteurID" = p_contact
  ),
  seq as (
    select v.id, v.oeuvre_id, v.changed_at,
      v.snapshot->>'ContactID' as o0, v.snapshot->>'LocalisationID' as h0, v.snapshot->>'AcheteurID' as b0,
      lead(v.snapshot->>'ContactID') over w as o1n,
      lead(v.snapshot->>'LocalisationID') over w as h1n,
      lead(v.snapshot->>'AcheteurID') over w as b1n,
      lead(v.id) over w as next_id
    from public.oeuvre_versions v
    where v.oeuvre_id in (select oeuvre_id from works)
    window w as (partition by v.oeuvre_id order by v.changed_at, v.id)
  ),
  pairs as (
    select s.id, s.oeuvre_id, s.changed_at, s.o0, s.h0, s.b0,
      case when s.next_id is null then o."ContactID"::text else s.o1n end as o1,
      case when s.next_id is null then o."LocalisationID"::text else s.h1n end as h1,
      case when s.next_id is null then o."AcheteurID"::text else s.b1n end as b1
    from seq s join public."Oeuvres" o on o."OeuvreID" = s.oeuvre_id
  ),
  roles as (
    select p.changed_at, p.id, p.oeuvre_id, r.role, r.was, r.now
    from pairs p
    cross join lateral (values ('owner', p.o0, p.o1), ('holder', p.h0, p.h1), ('buyer', p.b0, p.b1)) as r(role, was, now)
    where r.was is distinct from r.now
  )
  select r.changed_at, r.id, r.oeuvre_id, r.role,
    case when r.now = x.id then 'in' else 'out' end,
    nullif(case when r.now = x.id then r.was else r.now end, '')::integer
  from roles r, x
  where r.was = x.id or r.now = x.id
$$;
revoke all on function public._person_custody_rows(integer) from public, anon, authenticated;

create or replace function public._person_custody_allowed(p_contact integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_team() and (
    public.is_admin()
    or exists (select 1 from public."Contact" c where c."ContactID" = p_contact and c.is_private is not true)
  )
$$;
revoke all on function public._person_custody_allowed(integer) from public, anon, authenticated;

-- One page, newest first, strictly older than (p_before_at, p_before_id) when given.
drop function if exists public.person_custody(integer, timestamptz, bigint, integer);
create or replace function public.person_custody(p_contact integer, p_before_at timestamptz default null, p_before_id bigint default null, p_before_role text default null, p_limit integer default 20)
returns table (at timestamptz, version_id bigint, oeuvre_id integer, role text, direction text, other_contact integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._person_custody_allowed(p_contact) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.* from public._person_custody_rows(p_contact) r
    where p_before_at is null
       or (r.at, r.version_id, r.role) < (p_before_at, coalesce(p_before_id, 9223372036854775807), coalesce(p_before_role, '~'))
    order by r.at desc, r.version_id desc, r.role desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;
revoke all on function public.person_custody(integer, timestamptz, bigint, text, integer) from public, anon;
grant execute on function public.person_custody(integer, timestamptz, bigint, text, integer) to authenticated;

create or replace function public.person_custody_count(p_contact integer)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._person_custody_allowed(p_contact) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (select count(*)::integer from public._person_custody_rows(p_contact));
end;
$$;
revoke all on function public.person_custody_count(integer) from public, anon;
grant execute on function public.person_custody_count(integer) to authenticated;

-- The three roles in the index, so the read skips the snapshots (live, Pem's card: 1006 ms → 105 ms).
create index if not exists oeuvre_versions_custody_idx on public.oeuvre_versions
  (oeuvre_id, changed_at, id, (snapshot->>'ContactID'), (snapshot->>'LocalisationID'), (snapshot->>'AcheteurID'));
analyze public.oeuvre_versions;
