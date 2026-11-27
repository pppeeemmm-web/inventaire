-- Rule 8 for found works (Pem's GO 2026-11-27 « GO 1+2 »; decided in docs/design/2026-11-27/FoundWorkFlow.md:
-- « a found work's end is its year when known; never today »). PROPOSAL — not applied; live only on Pem's own OK.
--
-- Problem: a work found again (production_origin = 'found', e.g. #2410–#2412, end 1999 precision year) waits for
-- its photo. The day the photo is validated it becomes Prêt, and oeuvre_production_span replaced its end with
-- today. Going back out of Prêt (a new photo to take) cleared it. Both lose a historical date.
-- Change: for a found work the stage never moves the end date — becoming Prêt keeps it (or leaves it empty when the
-- year is unknown: never « today »), leaving Prêt keeps it (no « Reprise en production » line: the work is not
-- being made again, only re-photographed).
-- Works made now ('new' or null) behave exactly as before.
-- Switching a work from found to new keeps its end; the 'new' rule applies from its next stage change.
-- Supersedes the oeuvre_production_span body in work_state_rules.sql. Trigger unchanged (same name, same columns).
-- No GRANT / RLS / column change. Test (any throwaway Postgres, never live): found_work_end_kept.test.sql.

create or replace function public.oeuvre_production_span()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  was_ready boolean := coalesce(old."Catalogué", false) and not coalesce(old."NeedsPhotograph", false);
  is_ready  boolean := coalesce(new."Catalogué", false) and not coalesce(new."NeedsPhotograph", false);
  -- A found work's end date is history, not a stage: the stage never moves it.
  found_work boolean := coalesce(new.production_origin, '') = 'found';
begin
  if tg_op = 'UPDATE' then
    -- Becomes Prêt: finished today, unless an end date is written in the same update; never for a found work.
    if is_ready and not was_ready and not found_work then
      if new.production_completed_on is null
         or new.production_completed_on is not distinct from old.production_completed_on then
        new.production_completed_on := today;
        new.production_completed_precision := null;
      end if;
    end if;

    -- Leaves Prêt (back to cataloguing or to a new photo): the end goes, a line says so — not for a found work.
    if was_ready and not is_ready and old.production_completed_on is not null and not found_work then
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
