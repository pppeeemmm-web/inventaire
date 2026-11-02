-- Kaizen badges (owner 2026-11-02): like the Audit count in the sidebar, each Kaizen entry
-- (Création, Opérations & Stratégie) shows how many entries others added since you last opened it.
-- One row per user and scope; per user, not per device, so phone and desktop agree.

create table if not exists public.kaizen_seen (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  scope text not null check (scope in ('creation', 'ops')),
  seen_at timestamptz not null default now(),
  primary key (user_id, scope)
);

alter table public.kaizen_seen enable row level security;

drop policy if exists kaizen_seen_own on public.kaizen_seen;
create policy kaizen_seen_own on public.kaizen_seen
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and is_team());

revoke all on public.kaizen_seen from anon;
grant select, insert, update on public.kaizen_seen to authenticated;
