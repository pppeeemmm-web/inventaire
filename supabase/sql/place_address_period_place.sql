-- Places, continued (Pem 2026-11-14).
--   1. A place can be an address: `place.address` (street, number, postcode — free text), next to
--      name / town / country / coordinates. The coordinates feed the map.
--   2. A work's place follows its period by default ("the atelier of the time"): search text
--      "made in" reads the work's own place (`work_place`), else its period's place
--      (`work_period.default_place_id`). Same rule as `effectivePlace` in lib/work-periods.ts.
--   3. Re-index: renaming / re-dating a period, changing its place, or editing / deleting a place
--      changes the search text of works that are not tracked row by row → mark every work pending
--      (rare edits; the embed worker drains the queue).
-- RLS / grants unchanged: `place` keeps its team policies (supabase/sql/work_period_dates_places.sql).

alter table public.place add column if not exists address text;

-- ── Search text: period resolved once, its place used when the work has none ─────────────
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
    (select 'made in: ' || concat_ws(', ', pl.name, nullif(btrim(pl.address), ''), nullif(btrim(pl.town), ''), nullif(btrim(pl.country), ''))
       from public.place pl
      where pl.id = coalesce(
              (select wpl.place_id from public.work_place wpl where wpl.oeuvre_id = o."OeuvreID"),
              per_row.default_place_id)),
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
        case when to_char(o."Année", 'MM-DD') <> '01-01' then o."Année" end
      ) as day,
      coalesce(extract(year from o."Année"), extract(year from o.production_started_on))::int as yr
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

-- ── Re-index every work when a period or a place changes (statement level, rare) ─────────
create or replace function public.graph_trg_all_oeuvres_dirty()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.graph_mark_nodes_pending('oeuvre', o."OeuvreID"::text) from public."Oeuvres" o;
  return null;
end;
$$;

drop trigger if exists graph_work_period_text_dirty on public.work_period;
create trigger graph_work_period_text_dirty
after insert or delete or update of name, start_on, end_on, default_place_id on public.work_period
for each statement execute function public.graph_trg_all_oeuvres_dirty();

drop trigger if exists graph_place_text_dirty on public.place;
create trigger graph_place_text_dirty
after delete or update of name, address, town, country on public.place
for each statement execute function public.graph_trg_all_oeuvres_dirty();

revoke all on function public.graph_trg_all_oeuvres_dirty() from public, anon, authenticated;
