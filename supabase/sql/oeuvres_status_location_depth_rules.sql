-- Studio rules on works, enforced in the database so every write path follows them
-- (drawer, WorkForm, approved pending changes, sessions, share-triage). Owner 2026-11-03.
--
-- 1. Archive artiste ⇒ catalogued. Moving a work to "Archive artiste" (OeuvreStatus id 3)
--    ticks "Catalogué"; the production-span rule then ends production that day, as for any
--    catalogued work. Sold and gift do not touch the production dates.
-- 2. A work with no location is at its holder's — the artist's atelier (Contact 13, "Pem")
--    when no holder is recorded. It stays there until a transfer sets another location.
-- 3. Depth defaults to 0.1 cm for flat works: empty depth, not framed, not mounted, and the
--    technique is not a sculpture. Framed / mounted / sculpture depths are entered by hand.
--
-- Backfill (one-off, below): the 48 archive works not yet catalogued are ticked WITHOUT an
-- end date (their real end date is unknown — owner); the 4 works with no location get their
-- holder; flat works with an empty depth or the old placeholder "1" get 0.1.
--
-- No GRANT/RLS changes: triggers and data on an existing table.

-- ── 1. Archive ⇒ catalogued, inside the production-span trigger ─────────────────────────────
create or replace function public.oeuvre_production_span()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  was_catalogued boolean := coalesce(old."Catalogué", false);
  is_catalogued boolean;
begin
  -- Archive artiste is a catalogued state (owner 2026-11-03).
  if new."statusId" = 3 then
    new."Catalogué" := true;
  end if;
  is_catalogued := coalesce(new."Catalogué", false);

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
  before insert or update of "Catalogué", "statusId", "Année", production_started_on, production_completed_on
  on public."Oeuvres"
  for each row execute function public.oeuvre_production_span();

-- ── 2 + 3. Location and depth defaults ──────────────────────────────────────────────────────
create or replace function public.oeuvre_field_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No location recorded: the work is with its holder, else at the atelier (Pem, Contact 13).
  if new."LocalisationID" is null then
    new."LocalisationID" := coalesce(new."ContactID", 13);
  end if;

  -- Flat work with no depth: 0.1 cm. Framed, mounted and sculptures keep what was typed.
  if nullif(trim(coalesce(new."Profondeur", '')), '') is null
     and not coalesce(new."Encadree", false)
     and not coalesce(new."Montee", false)
     and not exists (
       select 1 from public."Technique" t
       where t."TechniqueID" = new."Technique" and t."Technique" ilike 'sculpt%'
     ) then
    new."Profondeur" := '0.1';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_oeuvre_field_defaults on public."Oeuvres";
create trigger trg_oeuvre_field_defaults
  before insert or update of "LocalisationID", "ContactID", "Profondeur", "Encadree", "Montee", "Technique"
  on public."Oeuvres"
  for each row execute function public.oeuvre_field_defaults();

-- ── Backfill ────────────────────────────────────────────────────────────────────────────────
-- Archive works: tick Catalogué without stamping today as their end of production.
alter table public."Oeuvres" disable trigger trg_oeuvre_production_span;
update public."Oeuvres"
   set "Catalogué" = true
 where "statusId" = 3 and "Catalogué" is not true;
alter table public."Oeuvres" enable trigger trg_oeuvre_production_span;

-- No location → holder / atelier (the trigger fills it in).
update public."Oeuvres" set "LocalisationID" = null where "LocalisationID" is null;

-- Flat works with empty depth or the old "1" placeholder → 0.1.
update public."Oeuvres" o
   set "Profondeur" = '0.1'
 where (nullif(trim(coalesce(o."Profondeur", '')), '') is null or trim(o."Profondeur") = '1')
   and not coalesce(o."Encadree", false)
   and not coalesce(o."Montee", false)
   and not exists (
     select 1 from public."Technique" t
     where t."TechniqueID" = o."Technique" and t."Technique" ilike 'sculpt%'
   );
