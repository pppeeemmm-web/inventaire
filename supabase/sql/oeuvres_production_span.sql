-- Production span per work: when making started, when it ended.
--
-- Owner's model (2026-11-01):
--   * A work created as a REAL new work starts production on its creation day. A work that
--     already existed and is only now being recorded ("found") has an unknown start.
--     The caller decides which (session "new vs found" choice) — the database cannot tell.
--   * Ticking "Catalogué" ends production: `production_completed_on` = that day.
--   * Going back into production (Catalogué unticked) reopens the span: the end is cleared,
--     the start kept, and a Historique line records the end being withdrawn.
--   * Still in production = end is null ("in production since …").
--   * If the work has no year (`Année`) when production ends, the year follows the end date.
--
-- Enforced here, not in the screens, so every write path (drawer, WorkForm, approved
-- pending changes, session apply) follows the same rule.
--
-- Dates are the studio's calendar day (Europe/Paris), not UTC.
--
-- No GRANT/RLS changes: columns on an existing table, already covered by `Oeuvres` policies.
-- After applying: npm run gen:types

alter table public."Oeuvres"
  add column if not exists production_started_on date,
  add column if not exists production_completed_on date,
  add column if not exists production_origin text
    check (production_origin in ('new', 'found'));

comment on column public."Oeuvres".production_started_on is
  'Day production started. Null = unknown (found / pre-existing work) or not recorded.';
comment on column public."Oeuvres".production_completed_on is
  'Day production ended (Catalogué ticked). Null = still in production, or never recorded.';
comment on column public."Oeuvres".production_origin is
  '''new'' = created as a new work (start known); ''found'' = existing work recorded later (start unknown). Null = not stated.';

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
    -- Production ends: catalogued for the first time (or again after a reopen).
    -- An end date written explicitly in the same update wins.
    if is_catalogued and not was_catalogued then
      if new.production_completed_on is null
         or new.production_completed_on is not distinct from old.production_completed_on then
        new.production_completed_on := today;
      end if;
    end if;

    -- Back into production: reopen the span, keep a trace of the withdrawn end date.
    if was_catalogued and not is_catalogued and old.production_completed_on is not null then
      new.production_completed_on := null;
      new."Historique" := concat_ws(
        E'\n',
        nullif(new."Historique", ''),
        '[' || to_char(today, 'YYYY/MM/DD') || '] Reprise en production (fin précédente : '
          || to_char(old.production_completed_on, 'YYYY/MM/DD') || ')'
      );
    end if;
  end if;

  -- The year follows the end of production when no year was recorded.
  if new."Année" is null and new.production_completed_on is not null then
    new."Année" := make_date(extract(year from new.production_completed_on)::int, 1, 1);
  end if;

  -- An end cannot precede a known start.
  if new.production_started_on is not null
     and new.production_completed_on is not null
     and new.production_completed_on < new.production_started_on then
    raise exception 'production_completed_on (%) is before production_started_on (%)',
      new.production_completed_on, new.production_started_on;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_oeuvre_production_span on public."Oeuvres";
create trigger trg_oeuvre_production_span
  before insert or update of "Catalogué", "Année", production_started_on, production_completed_on
  on public."Oeuvres"
  for each row execute function public.oeuvre_production_span();
