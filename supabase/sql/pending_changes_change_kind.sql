-- Pending queue: distinguish edit vs new-work proposals (Phase B create gate).
-- Apply in Supabase SQL editor if saves fail with "change_kind" schema cache error.
-- Full provenance + Oeuvres RLS bundle: oeuvres_provenance_and_create_gate.sql

alter table public.pending_changes
  add column if not exists change_kind text not null default 'edit'
  check (change_kind in ('edit', 'create'));

alter table public.pending_changes
  alter column oeuvre_id drop not null;

create index if not exists idx_pending_changes_change_kind_status
  on public.pending_changes (change_kind, status, created_at desc);

comment on column public.pending_changes.change_kind is
  'edit = change to existing Oeuvre; create = new Oeuvre proposal (oeuvre_id null until approve).';
