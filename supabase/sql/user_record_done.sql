-- Per-user completion marks on internal records (private UI only).
-- Apply in Supabase SQL editor or via CLI migrate.

create table if not exists public.user_record_done (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  record_id text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, scope, record_id)
);

create index if not exists user_record_done_user_scope_idx
  on public.user_record_done (user_id, scope);

alter table public.user_record_done enable row level security;

create policy "user_record_done_select_own"
  on public.user_record_done for select
  using ((select auth.uid()) = user_id);

create policy "user_record_done_insert_own"
  on public.user_record_done for insert
  with check ((select auth.uid()) = user_id);

create policy "user_record_done_update_own"
  on public.user_record_done for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_record_done_delete_own"
  on public.user_record_done for delete
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_record_done to authenticated;
