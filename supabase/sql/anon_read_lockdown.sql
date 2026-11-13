-- Signed-out read lockdown (owner GO 2026-11-13).
--
-- Found 2026-11-13 by querying as `anon` (the key shipped in every page):
--   Contact       31 rows, every column (emails, phones, notes, auth_user_id, is_admin)
--   Oeuvres       836 public works, every column (Prix, Historique, Commentaires, owner /
--                 holder / buyer ids, location detail, VAT rate)
--   tblrelations  3 785 rows (owner + location of every work, public or not)
--   work_action   782 rows (production to-dos of every work)
--
-- After this file a signed-out visitor reads:
--   Oeuvres       public rows only (RLS unchanged), and only the columns listed below —
--                 what /works shows. No price (owner: "not yet"), no contacts, no notes.
--   Contact, tblrelations, work_action: nothing.
--
-- Public code checked: app/works/page.tsx selects OeuvreID, Titre, Année, Hauteur, Largeur,
-- txtImageNameLink, Support and filters on deleted_at, is_public. /c/[token], /verify and the
-- portfolio PDF use the service role. Portal pages (/collection, /galerie) are signed in and read
-- their own Contact row (kept by the policy below).
--
-- Adding a column to a signed-out page later = add it to the GRANT here, same commit.
-- Not covered: a signed-in account that is not team still reads every column of public works
-- (none exists today; matters when a collector / gallery login is created).

-- ── Contact: team, or your own row ───────────────────────────────────────────────────────────
drop policy if exists "contact: select" on public."Contact";
create policy "contact: select" on public."Contact"
  for select
  using (is_admin() or is_team() or auth_user_id = (select auth.uid()));

revoke all on public."Contact" from anon;

-- ── Oeuvres: signed-out sees chosen columns only ─────────────────────────────────────────────
revoke all on public."Oeuvres" from anon;
grant select (
  "OeuvreID", "Titre", "Année", "Hauteur", "Largeur", "Profondeur",
  "Technique", "Support", "Format", "txtImageNameLink",
  "statusId", is_public, deleted_at
) on public."Oeuvres" to anon;

-- ── Relations and production to-dos: team only ───────────────────────────────────────────────
drop policy if exists "tblrelations: select" on public.tblrelations;
create policy "tblrelations: select" on public.tblrelations
  for select using (is_team());
revoke all on public.tblrelations from anon;

drop policy if exists "work_action: select" on public.work_action;
create policy "work_action: select" on public.work_action
  for select using (is_team());
revoke all on public.work_action from anon;
