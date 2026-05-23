-- Phase C: row-level snapshot of every Oeuvres UPDATE for admin rollback.
-- Run in Supabase SQL editor.

create table if not exists oeuvre_versions (
  id          bigserial primary key,
  oeuvre_id   integer not null,
  snapshot    jsonb not null,
  changed_by  uuid references auth.users(id),
  changed_at  timestamptz not null default now(),
  source      text                              -- 'trigger' | 'restore' | future tags
);

create index if not exists idx_oeuvre_versions_oeuvre_changed
  on oeuvre_versions (oeuvre_id, changed_at desc);

create index if not exists idx_oeuvre_versions_changed_by
  on oeuvre_versions (changed_by)
  where changed_by is not null;

alter table oeuvre_versions enable row level security;

drop policy if exists "oeuvre_versions_admin_select" on oeuvre_versions;
create policy "oeuvre_versions_admin_select"
  on oeuvre_versions
  for select to authenticated
  using (is_admin());

-- INSERTs come exclusively from the trigger (security definer); no INSERT policy needed.
-- No UPDATE / DELETE policies — versions are immutable history.

create or replace function snapshot_oeuvre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into oeuvre_versions(oeuvre_id, snapshot, changed_by, source)
  values (old."OeuvreID", to_jsonb(old), auth.uid(), 'trigger');
  return new;
end;
$$;

drop trigger if exists oeuvre_version_snap on "Oeuvres";
create trigger oeuvre_version_snap
  before update on "Oeuvres"
  for each row
  execute function snapshot_oeuvre();

comment on table oeuvre_versions is
  'Phase C: pre-update snapshot of every Oeuvres row. Admin-only read; immutable history.';
