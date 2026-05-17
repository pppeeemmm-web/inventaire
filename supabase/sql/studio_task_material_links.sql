-- Link phone field signalements to material work and optional production actions.
-- Run after supabase/sql/studio_task.sql.

alter table public.studio_task
  add column if not exists oeuvre_id bigint references public."Oeuvres"("OeuvreID") on delete set null,
  add column if not exists work_action_type_id bigint references public.work_action_type(id) on delete set null,
  add column if not exists due_at timestamptz;

create index if not exists idx_studio_task_field_open_created
  on public.studio_task (created_at desc)
  where kind = 'field'
    and coalesce(status, 'requested') not in ('completed', 'dismissed');

create index if not exists idx_studio_task_oeuvre_id
  on public.studio_task (oeuvre_id)
  where oeuvre_id is not null;

create index if not exists idx_studio_task_work_action_type_id
  on public.studio_task (work_action_type_id)
  where work_action_type_id is not null;

create index if not exists idx_studio_task_field_due_at
  on public.studio_task (due_at asc)
  where kind = 'field'
    and due_at is not null
    and coalesce(status, 'requested') not in ('completed', 'dismissed');

comment on column public.studio_task.oeuvre_id is
  'Optional artwork linked from a phone field signalement.';
comment on column public.studio_task.work_action_type_id is
  'Optional production action type created or referenced by a phone field signalement.';
comment on column public.studio_task.due_at is
  'Optional due date for field follow-up tasks and mobile next-action chips.';
