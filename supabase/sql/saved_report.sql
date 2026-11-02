-- Saved reports (owner 2026-11-02): Access-style named reports in Studio → Rapports.
--   source: which section the report reads ('works' = whole catalogue, 'production', 'kaizen',
--           'sales', 'contacts').
--   config: shown fields (ordered), per-field filters, sort, free search, pivot (lib/reports/engine.ts).
-- Team reads all saved reports; the author (or admin) renames, updates or deletes.

create table if not exists public.saved_report (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  source text not null default 'works' check (source in ('works', 'production', 'kaizen', 'sales', 'contacts')),
  config jsonb not null default '{}'::jsonb
);

create index if not exists saved_report_owner_idx on public.saved_report (owner_id);

create or replace function public.saved_report_touch() returns trigger
  language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_report_touch on public.saved_report;
create trigger saved_report_touch before update on public.saved_report
  for each row execute function public.saved_report_touch();

alter table public.saved_report enable row level security;

drop policy if exists saved_report_team_select on public.saved_report;
create policy saved_report_team_select on public.saved_report
  for select to authenticated using (is_team());

drop policy if exists saved_report_team_insert on public.saved_report;
create policy saved_report_team_insert on public.saved_report
  for insert to authenticated with check (is_team() and owner_id = (select auth.uid()));

drop policy if exists saved_report_owner_update on public.saved_report;
create policy saved_report_owner_update on public.saved_report
  for update to authenticated
  using (is_team() and (owner_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (owner_id = (select auth.uid()) or is_admin()));

drop policy if exists saved_report_owner_delete on public.saved_report;
create policy saved_report_owner_delete on public.saved_report
  for delete to authenticated
  using (is_team() and (owner_id = (select auth.uid()) or is_admin()));

revoke all on public.saved_report from anon;
revoke truncate on public.saved_report from authenticated;
grant select, insert, update, delete on public.saved_report to authenticated;

-- Sources widened after the first pilot (works, production) — idempotent for databases created before.
alter table public.saved_report drop constraint if exists saved_report_source_check;
alter table public.saved_report add constraint saved_report_source_check
  check (source in ('works', 'production', 'kaizen', 'sales', 'contacts'));
