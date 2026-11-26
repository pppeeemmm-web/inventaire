-- Works added as Journal moments (TODO §1 « Journal: each added work is a moment « Œuvre ajoutée » »;
-- Pem 2026-11-24: « they are moments as well in essence »). Design: docs/design/2026-11-26/WorksAddedMoments.md.
--
-- NOT APPLIED. Needs Pem's own OK (SQL), proof on the throwaway Docker copy first, then live.
-- Before applying: read the live constraint name (`select conname from pg_constraint where conrelid =
-- 'public.moment'::regclass and contype = 'c'`) — this file assumes the default `moment_kind_check`.
-- Re-runnable.
--
-- A. `moment.kind` accepts 'work_added'. Only the trigger below writes it: `save_moment` keeps its own list,
--    so nobody types one by hand.
-- B. A work created by a person (signed in: auth.uid() set) gets one moment « Œuvre ajoutée » dated the Paris day,
--    linked to the work (`moment_work`). Machine inserts (service role, imports, scripts) get none, so a bulk
--    import never floods a day. `source` 'oeuvre' + `external_id` = the work's number: never written twice.
--    « Nouvelle / retrouvée » is NOT stored here: the Journal reads it from the work (Oeuvres.production_origin),
--    so correcting the work corrects the Journal.
-- C. A work purged for good (admin, `purgeWorkPermanently`) takes its « Œuvre ajoutée » moment with it.
-- D. One-off for the works added since the Journal is written in (5 works on live): see the end.
-- E. A « work_added » moment cannot be corrected or replaced (save_moment's `corrects` would take the work out of
--    the Journal): refused by the database.
--
-- Same change as applying this file: docs/ARCHITECTURE.md §3 (two triggers on Oeuvres) and §7 (save_moment is no
-- longer the only writer of moment / moment_work).

-- ───────────── A. The kind ─────────────
alter table public.moment drop constraint if exists moment_kind_check;
alter table public.moment add constraint moment_kind_check
  check (kind in ('call', 'studio_visit', 'meeting', 'mail_in', 'mail_out', 'introduction',
                  'press', 'thanks', 'other', 'work_added'));

-- ───────────── B. Written at creation ─────────────
create or replace function public.moment_on_work_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    return new; -- machine insert: no moment
  end if;
  insert into public.moment (happened_on, precision, kind, summary, source, external_id, created_by)
  values ((now() at time zone 'Europe/Paris')::date, 'day', 'work_added', '', 'oeuvre', new."OeuvreID"::text, auth.uid())
  on conflict (source, external_id) where source is not null and external_id is not null do nothing
  returning id into v_id;
  if v_id is not null then
    insert into public.moment_work (moment_id, oeuvre_id) values (v_id, new."OeuvreID") on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.moment_on_work_added() from public, anon, authenticated;

drop trigger if exists oeuvre_added_moment on public."Oeuvres";
create trigger oeuvre_added_moment
  after insert on public."Oeuvres"
  for each row execute function public.moment_on_work_added();

-- ───────────── C. Gone with a purged work ─────────────
create or replace function public.moment_on_work_purged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.moment where kind = 'work_added' and source = 'oeuvre' and external_id = old."OeuvreID"::text;
  return old;
end;
$$;
revoke all on function public.moment_on_work_purged() from public, anon, authenticated;

drop trigger if exists oeuvre_purged_moment on public."Oeuvres";
create trigger oeuvre_purged_moment
  after delete on public."Oeuvres"
  for each row execute function public.moment_on_work_purged();

comment on table public.moment is
  'A touch: a dated fact between people and works (People.md §4). Written by save_moment, and by the oeuvre_added_moment trigger (kind work_added).';

-- ───────────── E. Not corrected by hand ─────────────
create or replace function public.moment_work_added_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.kind = 'work_added' and (new.replaced_by is distinct from old.replaced_by or new.kind is distinct from old.kind) then
    raise exception 'moment_work_added_locked: a « work added » moment is written by the database and is not corrected';
  end if;
  return new;
end;
$$;
revoke all on function public.moment_work_added_guard() from public, anon, authenticated;

drop trigger if exists moment_work_added_guard on public.moment;
create trigger moment_work_added_guard
  before update on public.moment
  for each row execute function public.moment_work_added_guard();

comment on function public.moment_on_work_added() is
  'One moment « Œuvre ajoutée » (kind work_added) per work created by a signed-in person; Journal reads it (day-read.ts).';

-- ───────────── D. One-off: works added since the Journal is written in ─────────────
-- Pem 2026-11-26: « since the journal exists ». First Journal entry written 2026-11-12 (live, read 2026-11-26):
-- 5 works — #2408, #2409 (22 Nov), #2410–#2412 (24 Nov). Their day = the graph index row written at their creation
-- (`nodes.created_at`, `graph_register_oeuvre_node`), Paris time — real creation days on live, not an install date.
-- Runs once; re-running writes nothing (same source + external_id).
insert into public.moment (happened_on, precision, kind, summary, source, external_id)
select (n.created_at at time zone 'Europe/Paris')::date, 'day', 'work_added', '', 'oeuvre', o."OeuvreID"::text
from public."Oeuvres" o
join public.nodes n on n.node_type = 'oeuvre' and n.source_pk = o."OeuvreID"::text
where o.deleted_at is null
  and o.created_by is not null -- added by a person, as rule B (all 5 on live, read 2026-11-26)
  and (n.created_at at time zone 'Europe/Paris')::date >= date '2026-11-12'
on conflict (source, external_id) where source is not null and external_id is not null do nothing;

insert into public.moment_work (moment_id, oeuvre_id)
select m.id, m.external_id::int
from public.moment m
where m.kind = 'work_added' and m.source = 'oeuvre'
  and not exists (select 1 from public.moment_work mw where mw.moment_id = m.id)
on conflict do nothing;
