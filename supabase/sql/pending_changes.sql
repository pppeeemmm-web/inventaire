-- Phase B: editor edits land here as pending proposals; admin reviews + applies.
-- Run in Supabase SQL editor.

create table if not exists pending_changes (
  id            bigserial primary key,
  oeuvre_id     integer not null references "Oeuvres"("OeuvreID") on delete cascade,
  payload       jsonb not null,                  -- serialized FormData entries
  baseline      jsonb,                           -- snapshot of Oeuvres row at submit time
  author_id     uuid references auth.users(id),
  author_email  text,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewer_id   uuid references auth.users(id),
  reject_reason text
);

create index if not exists idx_pending_changes_status_created
  on pending_changes (status, created_at desc);

alter table pending_changes enable row level security;

drop policy if exists "pending_changes_team_insert" on pending_changes;
create policy "pending_changes_team_insert"
  on pending_changes
  for insert to authenticated
  with check (is_team());

drop policy if exists "pending_changes_select" on pending_changes;
create policy "pending_changes_select"
  on pending_changes
  for select to authenticated
  using (author_id = auth.uid() or is_admin());

drop policy if exists "pending_changes_admin_update" on pending_changes;
create policy "pending_changes_admin_update"
  on pending_changes
  for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "pending_changes_admin_delete" on pending_changes;
create policy "pending_changes_admin_delete"
  on pending_changes
  for delete to authenticated
  using (is_admin());

comment on table pending_changes is
  'Phase B approval queue: non-admin team members submit edits here; admin approves/rejects in /atelier/audit.';
