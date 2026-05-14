-- Field Verb 1 — work_session (draft capture + optional review before tblImage attach).
-- Run in Supabase SQL Editor. Then run supabase/sql/grant_audit_queries.sql and add grants if flagged.
--
-- Retention: optional `expires_at` (app default 7d for drafts). Prune with:
--   delete from public.work_session where expires_at < timezone('utc', now());
-- Schedule via Supabase cron / external job (not shipped in app).

create table if not exists public.work_session (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  expires_at  timestamptz not null,
  user_id     uuid not null references auth.users (id) default auth.uid(),
  oeuvre_id   integer null references public."Oeuvres" ("OeuvreID") on delete set null,
  status      text not null default 'draft'
              check (status in ('draft', 'pending_review', 'applied', 'rejected', 'abandoned')),
  payload     jsonb not null default '{}'::jsonb
);

create index if not exists idx_work_session_user_updated
  on public.work_session (user_id, updated_at desc);

create index if not exists idx_work_session_oeuvre
  on public.work_session (oeuvre_id)
  where oeuvre_id is not null;

create index if not exists idx_work_session_status_created
  on public.work_session (status, created_at desc);

comment on table public.work_session is
  'Field capture sessions: staging R2 keys in payload.shots[] until applied to an œuvre (admin) or submitted for review (non-admin).';

drop trigger if exists work_session_touch on public.work_session;
create or replace function public.work_session_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger work_session_touch
  before update on public.work_session
  for each row execute function public.work_session_touch();

alter table public.work_session enable row level security;

drop policy if exists "work_session_team_select" on public.work_session;
create policy "work_session_team_select"
  on public.work_session
  for select
  to authenticated
  using (
    is_team()
    and (user_id = auth.uid() or is_admin())
  );

drop policy if exists "work_session_team_insert" on public.work_session;
create policy "work_session_team_insert"
  on public.work_session
  for insert
  to authenticated
  with check (is_team() and user_id = auth.uid());

drop policy if exists "work_session_team_update" on public.work_session;
create policy "work_session_team_update"
  on public.work_session
  for update
  to authenticated
  using (is_team() and (user_id = auth.uid() or is_admin()))
  with check (is_team() and (user_id = auth.uid() or is_admin()));

drop policy if exists "work_session_team_delete" on public.work_session;
create policy "work_session_team_delete"
  on public.work_session
  for delete
  to authenticated
  using (
    is_team()
    and (
      is_admin()
      or (user_id = auth.uid() and status in ('draft', 'abandoned', 'rejected'))
    )
  );

grant select, insert, update, delete on public.work_session to authenticated;
