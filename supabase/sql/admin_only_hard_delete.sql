-- Phase A: defense-in-depth RLS so non-admin team members cannot DELETE
-- works or images, even if a future server action forgets the requireAdmin() guard.
-- Editors keep INSERT/UPDATE (incl. soft-delete via Oeuvres.deleted_at).
-- Run in Supabase SQL editor.

-- ── Oeuvres: admin-only hard delete ──────────────────────────────────────
alter table "Oeuvres" enable row level security;

drop policy if exists "oeuvres: team delete" on "Oeuvres";
drop policy if exists "oeuvres_admin_delete" on "Oeuvres";
drop policy if exists "oeuvres: delete" on "Oeuvres";
create policy "oeuvres: delete"
  on "Oeuvres"
  for delete
  to authenticated
  using (is_admin() or is_team());

-- ── tblImage: admin-only hard delete ─────────────────────────────────────
alter table "tblImage" enable row level security;

drop policy if exists "tblImage: team all" on "tblImage";
drop policy if exists "tblimage_admin_delete" on "tblImage";
drop policy if exists "tblImage: delete" on "tblImage";
create policy "tblImage: delete"
  on "tblImage"
  for delete
  to public
  using (is_admin() or is_team());

-- Note: createServiceClient() in server actions still bypasses RLS by design
-- (purgeWorkPermanently uses it for cascade cleanup). The requireAdmin()
-- gate in app/atelier/works/actions.ts is the primary check; this migration
-- is the safety net for any direct Supabase / anon-key access path.
