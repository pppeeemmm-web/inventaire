-- Soft-delete for Oeuvres (atelier trash + undo). Run in Supabase SQL editor or your migration pipeline.
alter table "Oeuvres"
  add column if not exists deleted_at timestamptz null;

create index if not exists idx_oeuvres_deleted_at on "Oeuvres" (deleted_at)
  where deleted_at is not null;

comment on column "Oeuvres".deleted_at is 'When set, work is hidden from atelier/public lists until restored or purged.';
