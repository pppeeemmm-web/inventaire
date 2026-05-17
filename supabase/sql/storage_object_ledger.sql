-- Durable inventory of app-managed R2 objects.
-- Run in Supabase SQL Editor. Then run supabase/sql/grant_audit_queries.sql and add grants if flagged.
--
-- This table is intentionally non-destructive: classification='unidentified'
-- means "present in R2 but no known database reference", not safe to delete.

create table if not exists public.storage_object_ledger (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  provider          text not null default 'r2' check (provider in ('r2')),
  bucket            text not null,
  object_key        text not null,
  size_bytes        bigint null check (size_bytes is null or size_bytes >= 0),
  content_type      text null,
  etag              text null,
  last_modified_at  timestamptz null,
  first_seen_at     timestamptz not null default timezone('utc', now()),
  last_seen_at      timestamptz not null default timezone('utc', now()),
  status            text not null default 'present'
                    check (status in ('present', 'deleted', 'recycled', 'missing')),
  source            text not null default 'app',
  classification    text not null default 'unidentified'
                    check (classification in ('linked', 'unidentified', 'transient', 'recycle', 'backup', 'ignored')),
  linked_refs       jsonb not null default '[]'::jsonb,
  uploaded_by       uuid null references auth.users (id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  constraint storage_object_ledger_bucket_key unique (bucket, object_key),
  constraint storage_object_ledger_linked_refs_array check (jsonb_typeof(linked_refs) = 'array'),
  constraint storage_object_ledger_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_storage_object_ledger_bucket_key
  on public.storage_object_ledger (bucket, object_key);

create index if not exists idx_storage_object_ledger_classification_seen
  on public.storage_object_ledger (classification, last_seen_at desc);

create index if not exists idx_storage_object_ledger_status_seen
  on public.storage_object_ledger (status, last_seen_at desc);

create index if not exists idx_storage_object_ledger_source_seen
  on public.storage_object_ledger (source, last_seen_at desc);

drop trigger if exists storage_object_ledger_touch on public.storage_object_ledger;
create or replace function public.storage_object_ledger_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger storage_object_ledger_touch
  before update on public.storage_object_ledger
  for each row execute function public.storage_object_ledger_touch();

comment on table public.storage_object_ledger is
  'Durable inventory of app-managed R2 objects across vault, paintings, and backup buckets. Unidentified rows are investigation candidates, not deletion candidates.';

comment on column public.storage_object_ledger.linked_refs is
  'Array of known app references, e.g. [{ "table": "document", "column": "storage_path", "row_id": "123" }].';

comment on column public.storage_object_ledger.classification is
  'linked: known DB reference; unidentified: present in R2 with no known reference; transient/recycle/backup/ignored: known operational prefixes.';

alter table public.storage_object_ledger enable row level security;

drop policy if exists "storage_object_ledger_team_select" on public.storage_object_ledger;
create policy "storage_object_ledger_team_select"
  on public.storage_object_ledger
  for select
  to authenticated
  using (is_team());

drop policy if exists "storage_object_ledger_admin_insert" on public.storage_object_ledger;
create policy "storage_object_ledger_admin_insert"
  on public.storage_object_ledger
  for insert
  to authenticated
  with check (is_admin());

drop policy if exists "storage_object_ledger_admin_update" on public.storage_object_ledger;
create policy "storage_object_ledger_admin_update"
  on public.storage_object_ledger
  for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "storage_object_ledger_admin_delete" on public.storage_object_ledger;
create policy "storage_object_ledger_admin_delete"
  on public.storage_object_ledger
  for delete
  to authenticated
  using (is_admin());

grant select, insert, update, delete on public.storage_object_ledger to authenticated;
