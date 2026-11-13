-- A3 (owner 2026-11-13, bug-level): periods by DATE + the place each work was made.
-- Pem came back to France on 2024-06-13: 2024 works before that are Galway, after are Marseille —
-- a year cannot say that. Live data 2026-11-14: 54 of the 114 works of 2024 carry a real day
-- (production end / start, or an "Année" that is not 1 Jan): 23 before 13 June, 31 after.
--
--   work_period.start_on / end_on   the period's span; start_year / end_year are kept in sync by a
--                                   trigger for any reader still on years. Backfilled from the years
--                                   (a year alone = 1 Jan / 31 Dec).
--   work_period.default_place_id    the period may SUGGEST a place; never set on works by itself.
--   place                           small list of places (name, town, country, optional coordinates).
--   work_place                      the place a work was made (one per work). Its own table, like
--                                   work_period_override, so the team sets it straight away (no review).
--
-- A work's day = production end, else production start, else "Année" when it is not 1 Jan
-- (`lib/work-periods.ts` workWhen). A day picks the period containing it; a year alone keeps the old
-- rule (latest start wins) — a 2024 work with no day still lands in Marseille until set by hand.

-- ── Periods: dates ───────────────────────────────────────────────────────────
alter table public.work_period
  add column if not exists start_on date,
  add column if not exists end_on   date;

update public.work_period
   set start_on = coalesce(start_on, make_date(start_year, 1, 1)),
       end_on   = coalesce(end_on, case when end_year is null then null else make_date(end_year, 12, 31) end)
 where start_on is null or (end_on is null and end_year is not null);

alter table public.work_period alter column start_on set not null;
alter table public.work_period drop constraint if exists work_period_dates_ck;
alter table public.work_period add constraint work_period_dates_ck check (end_on is null or end_on >= start_on);

create or replace function public.work_period_sync_years()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Dates are the truth; a writer that only sends years gets whole years.
  if new.start_on is null then new.start_on := make_date(new.start_year, 1, 1); end if;
  if new.end_on is null and new.end_year is not null and (tg_op = 'INSERT' or old.end_year is distinct from new.end_year) then
    new.end_on := make_date(new.end_year, 12, 31);
  end if;
  new.start_year := extract(year from new.start_on)::int;
  new.end_year := case when new.end_on is null then null else extract(year from new.end_on)::int end;
  return new;
end;
$$;

drop trigger if exists work_period_sync_years on public.work_period;
create trigger work_period_sync_years
before insert or update on public.work_period
for each row execute function public.work_period_sync_years();

-- ── Places ───────────────────────────────────────────────────────────────────
create table if not exists public.place (
  id         bigint generated always as identity primary key,
  name       text not null check (length(trim(name)) > 0),
  town       text,
  country    text,
  latitude   double precision check (latitude is null or latitude between -90 and 90),
  longitude  double precision check (longitude is null or longitude between -180 and 180),
  created_at timestamptz not null default now()
);
create unique index if not exists place_name_uq on public.place (lower(trim(name)));

alter table public.work_period
  add column if not exists default_place_id bigint references public.place (id) on delete set null;

create table if not exists public.work_place (
  oeuvre_id integer primary key references public."Oeuvres" ("OeuvreID") on delete cascade,
  place_id  bigint not null references public.place (id) on delete cascade,
  set_by    uuid references auth.users (id) on delete set null default auth.uid(),
  set_at    timestamptz not null default now()
);
create index if not exists work_place_place_idx on public.work_place (place_id);

alter table public.place enable row level security;
alter table public.work_place enable row level security;
drop policy if exists place_team_all on public.place;
create policy place_team_all on public.place
  for all to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists work_place_team_all on public.work_place;
create policy work_place_team_all on public.work_place
  for all to authenticated using (public.is_team()) with check (public.is_team());
revoke all on public.place, public.work_place from anon;
grant select, insert, update, delete on public.place to authenticated;
grant select, insert, update, delete on public.work_place to authenticated;

-- The place joins the work's search text: re-index the work when it changes.
drop trigger if exists graph_work_place_text_dirty on public.work_place;
create trigger graph_work_place_text_dirty
after insert or delete or update on public.work_place
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');

-- ── Search text: period by date + place made (keeps A2's rule: AI rated 0 left out) ──
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
    case
      when ov.oeuvre_id is not null then (select wp.name from public.work_period wp where wp.id = ov.period_id)
      when y.day is not null then (select wp.name from public.work_period wp
             where wp.start_on <= y.day and (wp.end_on is null or wp.end_on >= y.day)
             order by wp.start_on desc, coalesce(wp.end_on, date '9999-12-31') - wp.start_on asc
             limit 1)
      else (select wp.name from public.work_period wp
             where y.yr is not null and wp.start_year <= y.yr and (wp.end_year is null or wp.end_year >= y.yr)
             order by wp.start_on desc, coalesce(wp.end_on, date '9999-12-31') - wp.start_on asc
             limit 1)
    end,
    (select 'made in: ' || concat_ws(', ', pl.name, nullif(btrim(pl.town), ''), nullif(btrim(pl.country), ''))
       from public.work_place wpl join public.place pl on pl.id = wpl.place_id
      where wpl.oeuvre_id = o."OeuvreID"),
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
  where o."OeuvreID" = p_oid;
$$;

-- ── Pem's dates (brief A3, 2026-11-13): back in France on 2024-06-13 ─────────
update public.work_period set end_on = date '2024-06-12' where id = 4 and name = 'Galway';
update public.work_period set start_on = date '2024-06-13' where id = 5 and name = 'Marseille';

-- Works whose period can change (dated, in a year two periods share): re-index their search text.
select public.graph_mark_nodes_pending('oeuvre', o."OeuvreID"::text)
  from public."Oeuvres" o
 where coalesce(o.production_completed_on, o.production_started_on,
                case when to_char(o."Année", 'MM-DD') <> '01-01' then o."Année" end) is not null;
