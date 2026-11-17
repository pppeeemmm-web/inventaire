-- Archive = the shelf: put away, out of circulation, reversible (Pem 2026-11-17).
-- Rules: docs/WORK_STATE_RULES.md § Archive.
--
--   1. A work enters Archive (statusId 3) only once it is catalogued — partial details are fine,
--      a ghost state is not. The database refuses; it no longer ticks « Catalogué » by itself
--      (that tick lived in oeuvre_production_span, oeuvres_status_location_depth_rules.sql).
--   2. Entering Archive pauses the work's open tasks (`work_action.paused_at`): kept, neither
--      done nor open. A task added while the work is archived starts paused.
--   3. Leaving Archive for the studio (En production / Disponible) brings the paused tasks back.
--      Leaving it through a destruction / loss constat keeps them paused.
--   4. Leaving Archive straight to Disponible needs the photo done (catalogued, no photo needed).
--
-- Enforced here, not in the screens, so the work card, batch edit, the phone, approved pending
-- changes, restores and scripts all follow the same rule.
--
-- No GRANT / RLS change: a column on an existing table (work_action policies: is_team()).
-- The task triggers are SECURITY DEFINER (search_path pinned) and only touch the rows of the
-- work being saved. After applying: npm run gen:types

alter table public.work_action add column if not exists paused_at timestamptz;

comment on column public.work_action.paused_at is
  'Set while the work is in Archive (statusId 3): the task is kept, neither done nor open. '
  'Cleared when the work goes back to the studio (statusId 1 / 2). Open = done false and paused_at null.';

-- 1 + 4 ── guard on the work row ─────────────────────────────────────────────────────────────

create or replace function public.oeuvre_archive_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new."statusId" = 3 and not coalesce(new."Catalogué", false) then
    raise exception 'archive_requires_catalogue' using errcode = '23514',
      detail = 'Archive: catalogue the work first (partial details are fine).';
  end if;

  if tg_op = 'UPDATE' and old."statusId" = 3 and new."statusId" = 2
     and (not coalesce(new."Catalogué", false) or coalesce(new."NeedsPhotograph", false)) then
    raise exception 'archive_exit_requires_photo' using errcode = '23514',
      detail = 'Out of Archive straight to Disponible: the photo must be done; otherwise back to En production.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_oeuvre_archive_guard on public."Oeuvres";
create trigger trg_oeuvre_archive_guard
  before insert or update of "statusId", "Catalogué", "NeedsPhotograph" on public."Oeuvres"
  for each row execute function public.oeuvre_archive_guard();

-- 1 ── production span no longer ticks « Catalogué » for an archive work ───────────────────────
-- Same function as oeuvres_status_location_depth_rules.sql minus its first block
-- (`if new."statusId" = 3 then new."Catalogué" := true`).

create or replace function public.oeuvre_production_span()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  was_catalogued boolean := coalesce(old."Catalogué", false);
  is_catalogued boolean := coalesce(new."Catalogué", false);
begin
  if tg_op = 'UPDATE' then
    if is_catalogued and not was_catalogued then
      if new.production_completed_on is null
         or new.production_completed_on is not distinct from old.production_completed_on then
        new.production_completed_on := today;
        new.production_completed_precision := null;
      end if;
    end if;

    if was_catalogued and not is_catalogued and old.production_completed_on is not null then
      new.production_completed_on := null;
      new.production_completed_precision := null;
      new."Historique" := concat_ws(
        E'\n',
        nullif(new."Historique", ''),
        '[' || to_char(today, 'YYYY/MM/DD') || '] Reprise en production (fin précédente : '
          || to_char(old.production_completed_on, 'YYYY/MM/DD') || ')'
      );
    end if;
  end if;

  if new."Année" is null and new.production_completed_on is not null then
    new."Année" := make_date(extract(year from new.production_completed_on)::int, 1, 1);
  end if;

  if new.production_started_on is not null
     and new.production_completed_on is not null
     and new.production_completed_on < new.production_started_on then
    raise exception 'production_completed_on (%) is before production_started_on (%)',
      new.production_completed_on, new.production_started_on;
  end if;

  return new;
end;
$$;

-- 2 + 3 ── tasks follow the shelf ─────────────────────────────────────────────────────────────

create or replace function public.oeuvre_archive_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new."statusId" = 3 and old."statusId" is distinct from 3 then
    update work_action
       set paused_at = now()
     where oeuvre_id = new."OeuvreID" and not done and paused_at is null;
  elsif old."statusId" = 3 and new."statusId" in (1, 2) then
    update work_action
       set paused_at = null
     where oeuvre_id = new."OeuvreID" and paused_at is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_oeuvre_archive_tasks on public."Oeuvres";
create trigger trg_oeuvre_archive_tasks
  after update of "statusId" on public."Oeuvres"
  for each row execute function public.oeuvre_archive_tasks();

create or replace function public.work_action_archive_pause()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done then
    new.paused_at := null;                 -- a ticked task is done, not paused
  elsif new.paused_at is null
        and exists (select 1 from "Oeuvres" where "OeuvreID" = new.oeuvre_id and "statusId" = 3) then
    new.paused_at := now();                -- reopened or added while the work is on the shelf
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_action_archive_pause on public.work_action;
create trigger trg_work_action_archive_pause
  before insert or update of done, paused_at, oeuvre_id on public.work_action
  for each row execute function public.work_action_archive_pause();

-- Trigger-only SECURITY DEFINER functions: not callable through the API (same as condition_report_fate_sync).
revoke execute on function public.oeuvre_archive_tasks() from public, anon, authenticated;
revoke execute on function public.work_action_archive_pause() from public, anon, authenticated;

-- Backfill: open tasks of works already on the shelf are paused (2026-11-17: 25 tasks on 25 works).
update public.work_action a
   set paused_at = now()
  from public."Oeuvres" o
 where o."OeuvreID" = a.oeuvre_id and o."statusId" = 3
   and not a.done and a.paused_at is null;
