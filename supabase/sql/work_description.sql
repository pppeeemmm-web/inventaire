-- Image descriptions by the local vision model (owner GO 2026-11-13: Gemma, with an "echoes" line).
-- Stored APART from the owner's text: never in "Oeuvres"."Commentaires". Marked AI (engine named)
-- and unverified. Written only by scripts/transcribe/describe_batch.py with the service role.
-- Read: team. No anon. Added to the work's search text (oeuvre_search_text) → re-indexed by the
-- embed worker (a row change marks the work's node pending).

create table if not exists public.work_description (
  id           bigint generated always as identity primary key,
  oeuvre_id    integer not null references public."Oeuvres" ("OeuvreID") on delete cascade,
  image_key    text not null,
  engine       text not null,
  prompt       text not null,
  body         text not null,
  echoes       text,
  verification text not null default 'unverified',
  created_at   timestamptz not null default now(),
  constraint work_description_verification_ck check (verification in ('verified', 'unverified')),
  constraint work_description_one_per_image unique (oeuvre_id, image_key, engine, prompt)
);
create index if not exists work_description_oeuvre_idx on public.work_description (oeuvre_id, created_at desc);

alter table public.work_description enable row level security;
drop policy if exists work_description_team_select on public.work_description;
create policy work_description_team_select on public.work_description
  for select to authenticated using (public.is_team());
revoke all on public.work_description from anon, authenticated;
grant select on public.work_description to authenticated;

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
    -- Image descriptions by the local vision model (AI, unverified; see work_description below).
    (select concat_ws('. ', 'seen (AI): ' || d.body, 'echoes (AI): ' || nullif(btrim(d.echoes), ''))
       from public.work_description d
      where d.oeuvre_id = o."OeuvreID"
      order by d.created_at desc
      limit 1)
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

drop trigger if exists graph_work_description_text_dirty on public.work_description;
create trigger graph_work_description_text_dirty
after insert or update or delete on public.work_description
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');
