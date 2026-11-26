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
-- D. One-off for works added before this exists (Spain, studio): see the end — fill in the numbers after reading
--    them on live with Pem.

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

comment on function public.moment_on_work_added() is
  'One moment « Œuvre ajoutée » (kind work_added) per work created by a signed-in person; Journal reads it (day-read.ts).';

-- ───────────── D. One-off (fill in, run once, with Pem's OK) ─────────────
-- The day each work was added comes from the graph index row written at its creation (`nodes.created_at`,
-- graph_register_oeuvre_node), in Paris time. Replace the numbers with the Spain and studio works.
--
-- insert into public.moment (happened_on, precision, kind, summary, source, external_id)
-- select (n.created_at at time zone 'Europe/Paris')::date, 'day', 'work_added', '', 'oeuvre', o."OeuvreID"::text
-- from public."Oeuvres" o
-- join public.nodes n on n.node_type = 'oeuvre' and n.source_pk = o."OeuvreID"::text
-- where o."OeuvreID" in (/* 2410, 2411, … */)
-- on conflict (source, external_id) where source is not null and external_id is not null do nothing;
--
-- insert into public.moment_work (moment_id, oeuvre_id)
-- select m.id, m.external_id::int from public.moment m
-- where m.kind = 'work_added' and m.source = 'oeuvre' and m.external_id::int in (/* same numbers */)
-- on conflict do nothing;
