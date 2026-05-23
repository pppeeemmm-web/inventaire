-- Field Verb 2 — sketchbook (parent for future drawn pages; voice_note may link here).
-- Run before voice_note.sql. Then grant_audit_queries.sql if flagged.

create table if not exists public.sketchbook (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  user_id     uuid not null references auth.users (id) default auth.uid(),
  name        text not null default ''
);

create index if not exists idx_sketchbook_user_updated
  on public.sketchbook (user_id, updated_at desc);

comment on table public.sketchbook is
  'Operator sketchbooks (future drawing surfaces); optional parent for voice_note.sketchbook_id.';

drop trigger if exists sketchbook_touch on public.sketchbook;
create or replace function public.sketchbook_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger sketchbook_touch
  before update on public.sketchbook
  for each row execute function public.sketchbook_touch();

alter table public.sketchbook enable row level security;

drop policy if exists "sketchbook_team_select" on public.sketchbook;
create policy "sketchbook_team_select"
  on public.sketchbook
  for select
  to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()));

drop policy if exists "sketchbook_team_insert" on public.sketchbook;
create policy "sketchbook_team_insert"
  on public.sketchbook
  for insert
  to authenticated
  with check (is_team() and user_id = (select auth.uid()));

drop policy if exists "sketchbook_team_update" on public.sketchbook;
create policy "sketchbook_team_update"
  on public.sketchbook
  for update
  to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (user_id = (select auth.uid()) or is_admin()));

drop policy if exists "sketchbook_team_delete" on public.sketchbook;
create policy "sketchbook_team_delete"
  on public.sketchbook
  for delete
  to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()));

grant select, insert, update, delete on public.sketchbook to authenticated;
