-- Constellation saved maps: index in Postgres, full JSON in R2 (constellation-maps/<id>.json).
-- Apply in Supabase SQL editor or via CLI migrate.

create table if not exists public.constellation_map (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  r2_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists constellation_map_user_updated_idx
  on public.constellation_map (auth_user_id, updated_at desc);

alter table public.constellation_map enable row level security;

drop policy if exists "constellation_map_select_own" on public.constellation_map;
drop policy if exists "constellation_map_insert_own" on public.constellation_map;
drop policy if exists "constellation_map_update_own" on public.constellation_map;
drop policy if exists "constellation_map_delete_own" on public.constellation_map;

create policy "constellation_map_select_own"
  on public.constellation_map for select
  using (auth.uid() = auth_user_id);

create policy "constellation_map_insert_own"
  on public.constellation_map for insert
  with check (auth.uid() = auth_user_id);

create policy "constellation_map_update_own"
  on public.constellation_map for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "constellation_map_delete_own"
  on public.constellation_map for delete
  using (auth.uid() = auth_user_id);

grant select, insert, update, delete on public.constellation_map to authenticated;

create or replace function public.constellation_map_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists constellation_map_touch on public.constellation_map;
create trigger constellation_map_touch
  before update on public.constellation_map
  for each row
  execute function public.constellation_map_touch();

comment on table public.constellation_map is
  'User-owned index rows for constellation layout JSON stored in R2 under r2_key.';
