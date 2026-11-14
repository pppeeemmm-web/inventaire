-- Production start / end as partial dates (TODO 3–4, owner 2026-11-03 / 2026-11-14): a year, a
-- month or a day, like the fate date and the « Création » lines. Stored like "Année" and
-- `work_creation_step`: a year as 1 Jan, a month as its 1st, plus a precision column.
-- Null precision = a full day (every existing row, and every date the trigger writes).
--
--   production_started_precision    'year' | 'month' | 'day' | null (= day)
--   production_completed_precision  'year' | 'month' | 'day' | null (= day)
--
-- The end can now be set by hand (admin, like the start since 2026-11-03). Ticking Catalogué still
-- writes today as a full day; un-ticking still clears it — both also reset its precision.
-- Period reading (`workWhen` in lib/work-periods.ts and `oeuvre_search_text` here): a day reads
-- as itself, a month as its 15th, a year gives the year only (no day).
--
-- No GRANT/RLS changes: columns on an existing table, already covered by `Oeuvres` policies.
-- After applying: npm run gen:types

alter table public."Oeuvres"
  add column if not exists production_started_precision text
    check (production_started_precision in ('year', 'month', 'day')),
  add column if not exists production_completed_precision text
    check (production_completed_precision in ('year', 'month', 'day'));

alter table public."Oeuvres" drop constraint if exists oeuvres_production_started_precision_ck;
alter table public."Oeuvres" add constraint oeuvres_production_started_precision_ck check (
  production_started_precision is null
  or production_started_on is null
  or production_started_precision = 'day'
  or (production_started_precision = 'month' and extract(day from production_started_on) = 1)
  or (production_started_precision = 'year' and to_char(production_started_on, 'MM-DD') = '01-01')
);
alter table public."Oeuvres" drop constraint if exists oeuvres_production_completed_precision_ck;
alter table public."Oeuvres" add constraint oeuvres_production_completed_precision_ck check (
  production_completed_precision is null
  or production_completed_on is null
  or production_completed_precision = 'day'
  or (production_completed_precision = 'month' and extract(day from production_completed_on) = 1)
  or (production_completed_precision = 'year' and to_char(production_completed_on, 'MM-DD') = '01-01')
);

comment on column public."Oeuvres".production_started_precision is
  'How precise production_started_on is: year (stored 1 Jan), month (stored the 1st), day. Null = day.';
comment on column public."Oeuvres".production_completed_precision is
  'How precise production_completed_on is: year (stored 1 Jan), month (stored the 1st), day. Null = day.';

-- Same trigger as live (oeuvres_status_location_depth_rules.sql), plus: a date the trigger writes
-- or clears is a full day, so its precision is reset with it.
create or replace function public.oeuvre_production_span()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
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
$function$;

-- The trigger must also fire when only a precision changes (it reads and resets them).
drop trigger if exists trg_oeuvre_production_span on public."Oeuvres";
create trigger trg_oeuvre_production_span
  before insert or update of "Catalogué", "statusId", "Année", production_started_on, production_completed_on,
    production_started_precision, production_completed_precision
  on public."Oeuvres"
  for each row execute function public.oeuvre_production_span();

-- ── Search text: the period's day respects the precision (body otherwise = work_creation_steps.sql) ──
create or replace function public.oeuvre_search_text(p_oid integer)
returns text
language sql
stable
set search_path to 'public'
as $$
  select concat_ws(
    '. ',
    nullif(btrim(o."Titre"), ''),
    nullif(btrim(o."Commentaires"), ''),
    nullif(concat_ws(', ', tech."Technique", sup."Support", y.yr::text), ''),
    (select string_agg(t.name, ', ' order by t.name)
       from public.oeuvre_theme ot join public.theme t on t.id = ot.theme_id
      where ot.oeuvre_id = o."OeuvreID" and t.name !~ '^\d{4}[_-]'),
    per_row.name,
    coalesce(
      (select 'made in: ' || string_agg(r.label, ' → ' order by r.pos)
         from (
           select concat_ws(', ', pl.name, nullif(btrim(pl.address), ''), nullif(btrim(pl.town), ''), nullif(btrim(pl.country), '')) as label,
                  min(s.pos) as pos
             from (
               select st.place_id, row_number() over (order by st.on_date asc nulls first, st.id) as pos
                 from public.work_creation_step st
                where st.oeuvre_id = o."OeuvreID" and st.place_id is not null
             ) s
             join public.place pl on pl.id = s.place_id
            group by pl.id, pl.name, pl.address, pl.town, pl.country
         ) r),
      (select 'made in: ' || concat_ws(', ', pl.name, nullif(btrim(pl.address), ''), nullif(btrim(pl.town), ''), nullif(btrim(pl.country), ''))
         from public.place pl
        where pl.id = per_row.default_place_id)
    ),
    (select string_agg(concat_ws(' — ', ws.name, nullif(btrim(wsl.note), '')), ', ' order by ws.name)
       from public.work_source_link wsl join public.work_source ws on ws.id = wsl.source_id
      where wsl.oeuvre_id = o."OeuvreID"),
    (select 'colours: ' || string_agg(replace(f.family, '_', ' '), ', ' order by f.share desc)
       from (
         select p ->> 'family' as family, (p ->> 'share')::numeric as share
           from public."tblImage" i, jsonb_array_elements(i.palette) p
          where i."OeuvreID" = o."OeuvreID" and i.is_cover and jsonb_typeof(i.palette) = 'array'
            and (p ->> 'share')::numeric >= 0.08
          order by 2 desc
          limit 4
       ) f),
    (select concat_ws('. ', 'seen (AI): ' || d.body, 'echoes (AI): ' || nullif(btrim(d.echoes), ''))
       from (
         select d0.body, d0.echoes, d0.usefulness
           from public.work_description d0
          where d0.oeuvre_id = o."OeuvreID"
          order by d0.created_at desc
          limit 1
       ) d
      where d.usefulness is distinct from 0)
  )
  from public."Oeuvres" o
  left join public."Technique" tech on tech."TechniqueID" = o."Technique"
  left join public."Support" sup on sup."SupportID" = o."Support"
  left join public.work_period_override ov on ov.oeuvre_id = o."OeuvreID"
  cross join lateral (
    select
      coalesce(
        case coalesce(o.production_completed_precision, 'day')
          when 'day' then o.production_completed_on
          when 'month' then o.production_completed_on + 14
        end,
        case coalesce(o.production_started_precision, 'day')
          when 'day' then o.production_started_on
          when 'month' then o.production_started_on + 14
        end,
        case when to_char(o."Année", 'MM-DD') <> '01-01' then o."Année" end,
        (select st.on_date from public.work_creation_step st
          where st.oeuvre_id = o."OeuvreID" and st.date_precision = 'day'
          order by st.on_date desc, st.id desc limit 1)
      ) as day,
      coalesce(
        extract(year from o."Année"),
        extract(year from o.production_started_on),
        (select extract(year from max(st.on_date)) from public.work_creation_step st where st.oeuvre_id = o."OeuvreID")
      )::int as yr
  ) y
  cross join lateral (
    select case
      when ov.oeuvre_id is not null then ov.period_id
      when y.day is not null then (select wp.id from public.work_period wp
             where wp.start_on <= y.day and (wp.end_on is null or wp.end_on >= y.day)
             order by wp.start_on desc, coalesce(wp.end_on, date '9999-12-31') - wp.start_on asc
             limit 1)
      else (select wp.id from public.work_period wp
             where y.yr is not null and wp.start_year <= y.yr and (wp.end_year is null or wp.end_year >= y.yr)
             order by wp.start_on desc, coalesce(wp.end_on, date '9999-12-31') - wp.start_on asc
             limit 1)
    end as pid
  ) per
  left join public.work_period per_row on per_row.id = per.pid
  where o."OeuvreID" = p_oid;
$$;
