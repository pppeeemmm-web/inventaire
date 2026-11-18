-- APPLIED 2026-11-18 (live migration `theme_notes`, all three parts incl. the 4 renames; Pem « go » after reading
-- the before / after list). Checked after: 4 rows moved as listed; anon reads id + name, notes → 42501.
-- Theme notes (TODO 23, Pem 2026-11-18: « go »).
--
-- Why: `public.theme` has only `id, name`, so Pem writes the explanation into the name. On 2026-11-18,
-- 4 of the 28 names were over 40 characters (longest 166). This adds a `notes` text field so names stay short.
--
-- Three parts, each in its own transaction so Pem can run part 1 alone:
--   PART 1 — add the column (safe, nothing changes for anyone).
--   PART 2 — keep notes private: the public site (anon) keeps reading id + name only.
--   PART 3 — PROPOSAL: move the long text out of 4 names into their notes. Each row is its own guarded UPDATE:
--            it runs only if the name is still byte-for-byte what it was on 2026-11-18 (md5 check) and the notes
--            are still empty. Delete any UPDATE Pem does not want before running.
-- After PART 1 (+2): flip THEME_NOTES_SQL_LIVE to true in lib/theme-notes.ts, then `npm run gen:types`.
--
-- ── BEFORE / AFTER (live data read 2026-11-18, read-only) ────────────────────────────────────────────────────
-- id 35 · 262 works (shown on the public site — the new name is what visitors will see)
--   before: SG 0004 ἀβαρής abarés Not burdensome, light, unburdensome
--   name  : SG 0004 ἀβαρής abarés
--   notes : Not burdensome, light, unburdensome
-- id 38 · 0 works
--   before: 00014 ἀγαθοεργέω agathoergeó14 agathoergéō (from 18 /agathós, "intrinsically good" and 2041 /érgon,
--           "work") – properly, to do a good work (that is intrinsically good)
--   name  : 00014 ἀγαθοεργέω agathoergeó14 agathoergéō
--   notes : (from 18 /agathós, "intrinsically good" and 2041 /érgon, "work") – properly, to do a good work (that
--           is intrinsically good)
--   (« agathoergeó14 » looks like a paste leftover; left as is — Pem can fix it by hand on the Thèmes screen.)
-- id 31 · 0 works — MY GUESS, check: the bracket style may be on purpose.
--   before: [ [ 000001 ] Pierre Emmanuel MOULIN. Art { 1. }  ἄλφα Alpha
--   name  : 000001 ἄλφα Alpha
--   notes : [ [ 000001 ] Pierre Emmanuel MOULIN. Art { 1. }
-- id 37 · 0 works — under 40 characters (39), same pattern as id 35; optional, for consistency.
--   before: Theme: SG 0005 Ἀββᾶ Father, Daddy, Papa
--   name  : SG 0005 Ἀββᾶ
--   notes : Father, Daddy, Papa
-- Left unchanged (codes, not prose): id 48 « 2026-Roman-Principles-ThePEMWorkshop-Week-39-6 » (46),
-- id 46 « 2026_Q3_W32-7_Progressive_Retrospect_RM1 » (40), id 40 « 2026_0003-Seven-Sparque_Dynamique » (33).
--
-- The new values are cut from the live name by SQL (no retyped Greek, so no accent mismatch). Revert block at the
-- bottom (commented). Idempotent: safe to run twice — PART 3 rows skip once moved.

-- ── PART 1 — the column ─────────────────────────────────────────────────────────────────────────────────────
begin;
alter table public.theme add column if not exists notes text;
comment on column public.theme.notes is
  'Free notes about the theme (meaning, source, working text). Team only; the name stays short. TODO 23.';
commit;

-- ── PART 2 — notes stay private ─────────────────────────────────────────────────────────────────────────────
-- Today anon has table-wide SELECT on theme (the public site lists theme names), so a new column would be readable
-- by anyone. Swap that for a column grant: anon keeps id + name, loses notes. Every anon read in the code selects
-- `id, name` explicitly (lib/public-oeuvre-themes.ts, app/works/page.tsx, portfolio) — checked 2026-11-18.
-- RLS policies are unchanged (« theme: select » true; team insert / update / delete via is_team()).
-- authenticated keeps its table grants (team writes notes through RLS is_team()).
begin;
revoke select on public.theme from anon;
grant select (id, name) on public.theme to anon;
commit;

-- ── PART 3 — PROPOSAL: move the long text into notes ────────────────────────────────────────────────────────
begin;

-- id 35
update public.theme
set name  = trim(substring(name from '^(.*?) Not burdensome')),
    notes = trim(substring(name from '(Not burdensome.*)$'))
where id = 35 and md5(name) = 'a59df59957dd78638c29fb2353a367db' and coalesce(notes, '') = '';

-- id 38
update public.theme
set name  = trim(substring(name from '^(.*?) \(from ')),
    notes = trim(substring(name from '(\(from .*)$'))
where id = 38 and md5(name) = '16621a5a88b01be3e3bed675374acab1' and coalesce(notes, '') = '';

-- id 31 (my guess — check)
update public.theme
set name  = '000001 ' || trim(substring(name from '\}\s+(.*)$')),
    notes = trim(substring(name from '^(.*\})'))
where id = 31 and md5(name) = '9c4353d3e6a8775c7044013146f4ca8f' and coalesce(notes, '') = '';

-- id 37 (optional)
update public.theme
set name  = trim(substring(name from '^Theme: (.*?) Father')),
    notes = trim(substring(name from '(Father.*)$'))
where id = 37 and md5(name) = '99fce7d07a2845f0256f42801e1578c1' and coalesce(notes, '') = '';

commit;

-- Check after:
-- select id, length(name) as len, name, notes from public.theme where id in (31, 35, 37, 38) order by id;
-- select grantee, privilege_type, column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'theme' and grantee = 'anon';

-- ── REVERT PART 3 (only if needed; rebuilds the old name from name + notes) ─────────────────────────────────
-- begin;
-- update public.theme set name = name || ' ' || notes, notes = null where id = 35;
-- update public.theme set name = name || ' ' || notes, notes = null where id = 38;
-- update public.theme set name = notes || '  ' || substring(name from '^000001 (.*)$'), notes = null where id = 31;
-- update public.theme set name = 'Theme: ' || name || ' ' || notes, notes = null where id = 37;
-- commit;
