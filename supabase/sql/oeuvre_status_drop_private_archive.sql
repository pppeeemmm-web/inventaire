-- Drop OeuvreStatus 5 "Archive privée" (owner 2026-11-03): a private holder is a gift or a
-- sale; Pem's own archive is "Archive artiste" (3). Checked before applying: 0 works,
-- 0 oeuvre_versions snapshots, 0 pending_changes use it; the only FK is Oeuvres.statusId.
-- Code references removed in the same change (lib/data.ts StatusKey 'private_archive').
--
-- No GRANT/RLS changes.

delete from public."OeuvreStatus"
 where id = 5
   and not exists (select 1 from public."Oeuvres" where "statusId" = 5);
