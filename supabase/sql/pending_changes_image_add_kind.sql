-- Pending queue: add `image_add` change_kind (Phase 0.2 — gate addWorkImage for non-admins).
-- image_add rows carry the R2 keys (original + thumb) of an already-uploaded image;
-- approval commits the tblImage row, rejection soft-deletes the R2 objects.
-- Apply in Supabase SQL editor. Not applied automatically by this repo.

alter table public.pending_changes
  drop constraint if exists pending_changes_change_kind_check;

alter table public.pending_changes
  add constraint pending_changes_change_kind_check
  check (change_kind in ('edit', 'create', 'image_add'));
