-- Constats (condition reports, owner interview 2026-11-02): per work, dated, by whom, a condition
-- grade, issues with photos, an action / treatment, notes. Voice notes can be routed to a constat.
--   condition_report  one examination of one work.
--   condition_issue   issues found during it (description, where on the work, optional photo in R2
--                     under `constat/`, thumb under `thumbs/constat/`).
-- Team reads and adds; the author or admin edits; deleting a whole constat is admin only (it is a
-- record of the work's state). Issues can be removed by their author or admin.

create table if not exists public.condition_report (
  id bigint generated always as identity primary key,
  oeuvre_id integer not null references public."Oeuvres"("OeuvreID") on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  examined_on date not null default ((now() at time zone 'Europe/Paris')::date),
  -- Free text when someone else examined the work (conservator, framer…); empty = the author.
  examiner text,
  grade text check (grade in ('excellent', 'good', 'fair', 'poor', 'critical')),
  notes text,
  action text,
  action_status text not null default 'none' check (action_status in ('none', 'todo', 'done'))
);

create index if not exists condition_report_oeuvre_idx on public.condition_report (oeuvre_id, examined_on desc);
create index if not exists condition_report_author_idx on public.condition_report (author_id);

create table if not exists public.condition_issue (
  id bigint generated always as identity primary key,
  report_id bigint not null references public.condition_report(id) on delete cascade,
  created_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  description text not null check (length(trim(description)) > 0),
  location text,
  photo_key text
);

create index if not exists condition_issue_report_idx on public.condition_issue (report_id);
create index if not exists condition_issue_author_idx on public.condition_issue (author_id);

create or replace function public.condition_report_touch() returns trigger
  language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists condition_report_touch on public.condition_report;
create trigger condition_report_touch before update on public.condition_report
  for each row execute function public.condition_report_touch();

alter table public.condition_report enable row level security;
alter table public.condition_issue enable row level security;

drop policy if exists condition_report_team_select on public.condition_report;
create policy condition_report_team_select on public.condition_report
  for select to authenticated using (is_team());
drop policy if exists condition_report_team_insert on public.condition_report;
create policy condition_report_team_insert on public.condition_report
  for insert to authenticated with check (is_team() and author_id = (select auth.uid()));
drop policy if exists condition_report_author_update on public.condition_report;
create policy condition_report_author_update on public.condition_report
  for update to authenticated
  using (is_team() and (author_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (author_id = (select auth.uid()) or is_admin()));
drop policy if exists condition_report_admin_delete on public.condition_report;
create policy condition_report_admin_delete on public.condition_report
  for delete to authenticated using (is_admin());

drop policy if exists condition_issue_team_select on public.condition_issue;
create policy condition_issue_team_select on public.condition_issue
  for select to authenticated using (is_team());
drop policy if exists condition_issue_team_insert on public.condition_issue;
create policy condition_issue_team_insert on public.condition_issue
  for insert to authenticated with check (is_team() and author_id = (select auth.uid()));
drop policy if exists condition_issue_author_update on public.condition_issue;
create policy condition_issue_author_update on public.condition_issue
  for update to authenticated
  using (is_team() and (author_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (author_id = (select auth.uid()) or is_admin()));
drop policy if exists condition_issue_author_delete on public.condition_issue;
create policy condition_issue_author_delete on public.condition_issue
  for delete to authenticated using (is_team() and (author_id = (select auth.uid()) or is_admin()));

revoke all on public.condition_report from anon;
revoke all on public.condition_issue from anon;
revoke truncate on public.condition_report from authenticated;
revoke truncate on public.condition_issue from authenticated;
grant select, insert, update, delete on public.condition_report to authenticated;
grant select, insert, update, delete on public.condition_issue to authenticated;

-- Voice note → constat (Notes → Trier). Link, never copy.
alter table public.voice_note add column if not exists condition_report_id bigint
  references public.condition_report(id) on delete set null;
create index if not exists voice_note_condition_report_idx on public.voice_note (condition_report_id);
