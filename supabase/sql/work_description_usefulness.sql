-- A2 (owner 2026-11-13): AI descriptions shown in the work drawer, rated for usefulness instead of
-- right / wrong. 0 useless · 1 · 2 · 3 · 4 spot on; null = not yet judged. `verification` stays.
-- Team may update ONLY `usefulness` (column grant); `rated_by` / `rated_at` are set by the trigger
-- below from auth.uid() / now(), so nobody can rate in someone else's name.
-- Use: rated 0 → the description leaves the work's search text (oeuvre_search_text); the average per
-- prompt tells whether a prompt is worth re-running. Never copied into "Oeuvres"."Commentaires".

alter table public.work_description
  add column if not exists usefulness smallint,
  add column if not exists rated_by   uuid references auth.users (id) on delete set null,
  add column if not exists rated_at   timestamptz;

alter table public.work_description drop constraint if exists work_description_usefulness_ck;
alter table public.work_description
  add constraint work_description_usefulness_ck check (usefulness is null or usefulness between 0 and 4);

-- Who / when: stamped server-side whenever the rating changes.
create or replace function public.work_description_stamp_rating()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.usefulness is distinct from old.usefulness then
    new.rated_by := case when new.usefulness is null then null else auth.uid() end;
    new.rated_at := case when new.usefulness is null then null else now() end;
  else
    new.rated_by := old.rated_by;
    new.rated_at := old.rated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists work_description_stamp_rating on public.work_description;
create trigger work_description_stamp_rating
before update on public.work_description
for each row execute function public.work_description_stamp_rating();

drop policy if exists work_description_team_rate on public.work_description;
create policy work_description_team_rate on public.work_description
  for update to authenticated using (public.is_team()) with check (public.is_team());
grant update (usefulness) on public.work_description to authenticated;

-- Re-index the work only when its search text can change: a new / removed description, a new body
-- or echoes, or a rating moving to or from 0. A 1 → 3 change touches nothing searchable.
drop trigger if exists graph_work_description_text_dirty on public.work_description;
drop trigger if exists graph_work_description_text_dirty_ins_del on public.work_description;
create trigger graph_work_description_text_dirty_ins_del
after insert or delete on public.work_description
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');
drop trigger if exists graph_work_description_text_dirty_upd on public.work_description;
create trigger graph_work_description_text_dirty_upd
after update on public.work_description
for each row
when (
  old.body is distinct from new.body
  or old.echoes is distinct from new.echoes
  or old.oeuvre_id is distinct from new.oeuvre_id
  or (old.usefulness = 0) is distinct from (new.usefulness = 0)
)
execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');

-- Search text: same as supabase/sql/work_description.sql, except the latest description is left out
-- when it was rated 0 (useless). Unrated or 1–4 stays in.
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
      else (select wp.name from public.work_period wp
             where y.yr is not null and wp.start_year <= y.yr and (wp.end_year is null or wp.end_year >= y.yr)
             order by wp.start_year desc, coalesce(wp.end_year, 9999) - wp.start_year asc
             limit 1)
    end,
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
    select coalesce(extract(year from o."Année"), extract(year from o.production_started_on))::int as yr
  ) y
  where o."OeuvreID" = p_oid;
$$;
