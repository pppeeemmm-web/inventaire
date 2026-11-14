-- « Création » history per work (Pem 2026-11-14: "a history for the creation where 'place' is just
-- like 'history'"). Replaces the single place a work was made (`work_place`) with dated lines, each
-- with a place, read like « Historique / Provenance »:
--
--   2021        Commencée   Tooreeney Atelier
--   2026/03     Terminée    Marseille Atelier
--
--   work_creation_step   one line: date (year / month / day, or none), kind (started / worked /
--                        resumed / finished), place (from `place`), short note; `work_session_id`
--                        when the line was added from a field session's suggestion.
--
-- A work's place = its lines' places, in order (the route); with no line, its period's place
-- (`work_period.default_place_id`, read, never written) — `effectivePlace` in lib/work-periods.ts.
-- A work's day for its period: production end, else start, else a real day in "Année", else the
-- last line dated to the day; its year falls back to the last dated line. Lines spanning two
-- periods → the card asks which (saved as `work_period_override`, like today).
--
-- Team table (like `work_place` / `work_period_override`): any team member writes straight away.
-- `work_place` is kept for now (the live app still reads it until this ships): its 2 rows are
-- copied as undated lines below; a later migration copies any newer row and drops it.

create table if not exists public.work_creation_step (
  id              bigint generated always as identity primary key,
  oeuvre_id       integer not null references public."Oeuvres" ("OeuvreID") on delete cascade,
  on_date         date,
  date_precision  text check (date_precision in ('year', 'month', 'day')),
  kind            text not null default 'worked' check (kind in ('started', 'worked', 'resumed', 'finished')),
  place_id        bigint references public.place (id) on delete set null,
  note            text check (note is null or length(note) <= 500),
  work_session_id uuid references public.work_session (id) on delete set null,
  set_by          uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  constraint work_creation_step_date_ck check ((on_date is null) = (date_precision is null)),
  -- A year is stored as 1 Jan, a month as its 1st (like "Année").
  constraint work_creation_step_precision_ck check (
    date_precision is null
    or date_precision = 'day'
    or (date_precision = 'month' and extract(day from on_date) = 1)
    or (date_precision = 'year' and to_char(on_date, 'MM-DD') = '01-01')
  )
);
create index if not exists work_creation_step_oeuvre_idx on public.work_creation_step (oeuvre_id, on_date);
create index if not exists work_creation_step_place_idx on public.work_creation_step (place_id);
create index if not exists work_creation_step_session_idx on public.work_creation_step (work_session_id) where work_session_id is not null;

alter table public.work_creation_step enable row level security;
drop policy if exists work_creation_step_team_all on public.work_creation_step;
create policy work_creation_step_team_all on public.work_creation_step
  for all to authenticated using (public.is_team()) with check (public.is_team());
revoke all on public.work_creation_step from anon;
grant select, insert, update, delete on public.work_creation_step to authenticated;

-- The lines join the work's search text: re-index the work when they change.
drop trigger if exists graph_work_creation_step_text_dirty on public.work_creation_step;
create trigger graph_work_creation_step_text_dirty
after insert or delete or update on public.work_creation_step
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');

-- ── The 2 hand-set places become a first, undated line ───────────────────────
insert into public.work_creation_step (oeuvre_id, kind, place_id, set_by, created_at)
select wp.oeuvre_id, 'worked', wp.place_id, wp.set_by, wp.set_at
  from public.work_place wp
 where not exists (
   select 1 from public.work_creation_step s where s.oeuvre_id = wp.oeuvre_id and s.place_id = wp.place_id
 );

-- ── Search text: "made in" = the route (every line's place, in order), else the period's place;
--    the period reads the last dated line when the work has no date of its own ───────────────
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
        o.production_completed_on,
        o.production_started_on,
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
