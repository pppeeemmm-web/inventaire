-- Saved slideshows (TODO R5, docs/PLAN_SLIDESHOW.md, Pem 2026-11-14/15): a named, ordered list of
-- works + the player's settings (background, timing, transition, loop, random, caption). Shared with
-- the whole team (Pem: "shared with the team"); no public access.
--
--   work_ids  the works in Pem's order (a work deleted later is just skipped by the player)
--   settings  lib/slideshow.ts `SlideshowSettings` (normalized when read)
--
-- Team table like `work_creation_step`: any team member reads and writes. No size limit on purpose:
-- only work numbers are stored (Pem asked "is there a technical limit?" — no).
-- After applying: npm run gen:types

create table if not exists public.slideshow (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 120),
  work_ids    integer[] not null default '{}',
  settings    jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists slideshow_updated_idx on public.slideshow (updated_at desc);

alter table public.slideshow enable row level security;
drop policy if exists slideshow_team_all on public.slideshow;
create policy slideshow_team_all on public.slideshow
  for all to authenticated using (public.is_team()) with check (public.is_team());
revoke all on public.slideshow from anon;
grant select, insert, update, delete on public.slideshow to authenticated;
