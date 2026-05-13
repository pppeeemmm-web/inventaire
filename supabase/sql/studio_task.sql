-- Studio task ledger (manual maintenance / suggestions) — split from audit-only system_log.
-- Run in Supabase SQL editor.

create table if not exists studio_task (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,
  author_id    uuid references auth.users(id) default auth.uid(),
  action       text not null,
  details      text,
  type         text check (type in ('suggestion','improvement','maintenance','backlog','bug')),
  priority     text check (priority in ('P1','P2','P3','P4')) default 'P3',
  status       text check (status in ('active','requested','in-progress','completed','dismissed')) default 'active'
);

create index if not exists idx_studio_task_status_created
  on studio_task (status, created_at desc);

-- One-shot backfill: manual rows in system_log (no machine event_type).
insert into studio_task (id, created_at, action, details, type, priority, status, author_id)
select id, created_at, action, details, type, priority, status, user_id
from system_log
where event_type is null
  and action is not null
  and (type is null or type in ('suggestion','improvement','maintenance','backlog','bug'))
  and (priority is null or priority in ('P1','P2','P3','P4'))
  and (status is null or status in ('active','requested','in-progress','completed','dismissed'))
on conflict (id) do nothing;

select setval(
  pg_get_serial_sequence('studio_task', 'id'),
  greatest((select coalesce(max(id), 0) from studio_task), 1)
);

alter table studio_task enable row level security;

drop policy if exists "studio_task_team_read" on studio_task;
drop policy if exists "studio_task_team_insert" on studio_task;
drop policy if exists "studio_task_team_update" on studio_task;
drop policy if exists "studio_task_admin_delete" on studio_task;

create policy "studio_task_team_read"
  on studio_task for select
  using (auth.uid() is not null);

create policy "studio_task_team_insert"
  on studio_task for insert
  with check (auth.uid() is not null);

create policy "studio_task_team_update"
  on studio_task for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "studio_task_admin_delete"
  on studio_task for delete
  using (is_admin());

create or replace function studio_task_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists studio_task_touch on studio_task;
create trigger studio_task_touch
  before update on studio_task
  for each row
  execute function studio_task_touch();

comment on table studio_task is
  'Manual studio ledger (tasks/suggestions). Audit trail stays in system_log.';
