-- Periods + source per work (owner interview 2026-11-02).
--   work_period           named periods with a start and end year (end empty = still going). A work
--                         falls into one automatically from its Année (`lib/work-periods.ts` picks
--                         the period with the latest start when several overlap).
--   work_period_override  per-work exception: a chosen period, or period_id null = "no period".
--                         No row = automatic.
--   work_source           open list of what a work was made from (Mémoire, Sur le motif, Photo, Lieu…).
--   work_source_link      work ↔ source, several per work.
-- Team reads and writes all four, like themes (`theme` / `oeuvre_theme`).

create table if not exists public.work_period (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  start_year integer not null,
  end_year integer,
  created_at timestamptz not null default now(),
  check (end_year is null or end_year >= start_year)
);

create table if not exists public.work_period_override (
  oeuvre_id integer primary key references public."Oeuvres"("OeuvreID") on delete cascade,
  period_id bigint references public.work_period(id) on delete cascade,
  set_by uuid references auth.users(id) on delete set null default auth.uid(),
  set_at timestamptz not null default now()
);

create index if not exists work_period_override_period_idx on public.work_period_override (period_id);

create table if not exists public.work_source (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists work_source_name_uq on public.work_source (lower(trim(name)));

create table if not exists public.work_source_link (
  oeuvre_id integer not null references public."Oeuvres"("OeuvreID") on delete cascade,
  source_id bigint not null references public.work_source(id) on delete cascade,
  primary key (oeuvre_id, source_id)
);

create index if not exists work_source_link_source_idx on public.work_source_link (source_id);

insert into public.work_source (name)
select v from (values ('Mémoire'), ('Sur le motif'), ('Photo'), ('Lieu')) as s(v)
where not exists (select 1 from public.work_source);

alter table public.work_period enable row level security;
alter table public.work_period_override enable row level security;
alter table public.work_source enable row level security;
alter table public.work_source_link enable row level security;

drop policy if exists work_period_team_all on public.work_period;
create policy work_period_team_all on public.work_period
  for all to authenticated using (is_team()) with check (is_team());
drop policy if exists work_period_override_team_all on public.work_period_override;
create policy work_period_override_team_all on public.work_period_override
  for all to authenticated using (is_team()) with check (is_team());
drop policy if exists work_source_team_all on public.work_source;
create policy work_source_team_all on public.work_source
  for all to authenticated using (is_team()) with check (is_team());
drop policy if exists work_source_link_team_all on public.work_source_link;
create policy work_source_link_team_all on public.work_source_link
  for all to authenticated using (is_team()) with check (is_team());

grant select, insert, update, delete on public.work_period to authenticated;
grant select, insert, update, delete on public.work_period_override to authenticated;
grant select, insert, update, delete on public.work_source to authenticated;
grant select, insert, update, delete on public.work_source_link to authenticated;

-- 2026-11-03: one short line per work + source (which photo, which place, whose memory).
alter table public.work_source_link
  add column if not exists note text check (note is null or char_length(note) <= 300);
comment on column public.work_source_link.note is
  'Short detail for this source on this work (e.g. the place, the photo, the memory). Null = none.';
