-- Œuvre provenance (created_by / edited_by) + admin-only direct INSERT.
-- Non-admin new works go through pending_changes (change_kind = 'create').
-- Run in Supabase SQL editor (idempotent).

-- ── Provenance on catalogue rows ───────────────────────────────────────────
alter table public."Oeuvres"
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists edited_by uuid references auth.users(id),
  add column if not exists edited_at timestamptz;

create index if not exists idx_oeuvres_created_by
  on public."Oeuvres" (created_by)
  where created_by is not null;

create index if not exists idx_oeuvres_edited_by
  on public."Oeuvres" (edited_by)
  where edited_by is not null;

comment on column public."Oeuvres".created_by is
  'auth.users id of account that created the row (admin direct or approved pending create).';
comment on column public."Oeuvres".edited_by is
  'auth.users id of last account that committed an update (admin or approved pending edit).';
comment on column public."Oeuvres".edited_at is
  'Timestamp of last committed update (edited_by).';

-- ── Pending queue: new-work proposals (oeuvre_id null until approved) ────────
alter table public.pending_changes
  add column if not exists change_kind text not null default 'edit'
  check (change_kind in ('edit', 'create'));

alter table public.pending_changes
  alter column oeuvre_id drop not null;

create index if not exists idx_pending_changes_change_kind_status
  on public.pending_changes (change_kind, status, created_at desc);

comment on column public.pending_changes.change_kind is
  'edit = change to existing Oeuvre; create = new Oeuvre proposal (oeuvre_id null until approve).';

-- ── RLS: only admin may INSERT Oeuvres (team uses pending_changes) ─────────
drop policy if exists "auth write Oeuvres" on public."Oeuvres";
drop policy if exists "oeuvres: team insert" on public."Oeuvres";
drop policy if exists "oeuvres: team all" on public."Oeuvres";
drop policy if exists "oeuvres: team write" on public."Oeuvres";
drop policy if exists "Oeuvres: team all" on public."Oeuvres";
drop policy if exists "oeuvres_admin_insert" on public."Oeuvres";

create policy "oeuvres_admin_insert"
  on public."Oeuvres"
  for insert
  to authenticated
  with check (is_admin());

-- Team UPDATE (existing edits + soft-delete via deleted_at) — idempotent
drop policy if exists "oeuvres_team_update" on public."Oeuvres";
create policy "oeuvres_team_update"
  on public."Oeuvres"
  for update
  to authenticated
  using (is_team())
  with check (is_team());
