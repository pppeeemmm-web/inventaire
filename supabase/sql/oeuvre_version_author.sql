-- DRAFT — NOT APPLIED. Design: docs/design/2026-11-23/WorkChangeBadges.md (2026-11-23, Pem's answers folded in).
-- Apply only after Pem's OK, on the throwaway Docker copy first (supabase/CLAUDE.md).
--
-- oeuvre_version_author: every version row says who made the change (and who approved it, for a proposal),
-- or says honestly that a machine did, or that nobody knows.
--
-- Live today (read 2026-11-23): snapshot_oeuvre() (BEFORE UPDATE, security definer) inserts
-- (oeuvre_id, to_jsonb(old), auth.uid(), 'trigger'). auth.uid() is NULL for every service-role write, so
-- 10 881 of the 11 445 rows of the last 90 days have changed_by NULL (bulk days 2026-11-01..03, 2026-11-15).
--
-- Rule (one place, the trigger). "stamped" = the writer set edited_at in THIS update (new.edited_at distinct
-- from old.edited_at) and edited_by is not null. The row's old edited_by is never used: it is sticky — a cron
-- touching the row would be blamed on the last person who saved the card.
--   1. signed-in admin, stamped, edited_by = someone else   → changed_by = new.edited_by, approved_by = auth.uid(),
--      changed_via = 'approval'   (approvePendingChange replays saveWork with edited_by = the proposer)
--   2. auth.uid() is set                                     → changed_by = auth.uid(),      changed_via = 'session'
--   3. no uid, stamped                                       → changed_by = new.edited_by,   changed_via = 'stamp'
--      (restoreOeuvreVersion and portfolio setWorkPublic — the only service-key Oeuvres UPDATEs a person starts,
--       build scout 2026-11-23; broadcast routes and selection write Oeuvres through the session or not at all —
--       Pem 2026-11-23 « who clicked as well »)
--   4. no uid, JWT role service_role or no JWT               → changed_by = NULL,            changed_via = 'machine'
--   5. anything else                                         → changed_by = NULL,            changed_via = 'unknown'
-- Rows written before this change keep changed_via NULL = « not recorded » (no backfill: the past is not guessed).
--
-- No-op saves (Pem 2026-11-23 « Yes, skip them »): no version row when the update changed nothing but
-- edited_at / edited_by (bulk re-writes of the same values: 5 930 such rows in the last 30 days). Compared on the
-- writer's own values (this trigger fires before the trg_* ones); a hand edit of Historique still counts.
--
-- Order: oeuvre_version_snap fires before every trg_* BEFORE trigger (names sort o < t), so `new` here is the
-- writer's own values — no other trigger has touched edited_at / edited_by yet.

alter table public.oeuvre_versions
  add column if not exists changed_via text
    check (changed_via in ('approval', 'session', 'stamp', 'machine', 'unknown')),
  add column if not exists approved_by uuid references auth.users(id);

comment on column public.oeuvre_versions.changed_via is
  'How changed_by was learned: approval = proposer (edited_by) of a proposal an admin approved (approved_by); '
  'session = auth.uid() of the save; stamp = edited_by the writer set in this update; machine = service role / '
  'no JWT (cron, script); unknown = signed request with no user. NULL = row older than oeuvre_version_author.sql.';
comment on column public.oeuvre_versions.approved_by is
  'Admin who approved the proposal (changed_via = approval); NULL otherwise.';

create or replace function public.snapshot_oeuvre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_stamped boolean := new.edited_at is distinct from old.edited_at and new.edited_by is not null;
  v_by      uuid;
  v_ok_by   uuid;
  v_via     text;
begin
  -- Nothing changed but the stamps → no version row (the update itself still goes through).
  if (to_jsonb(new) - array['edited_at', 'edited_by']) = (to_jsonb(old) - array['edited_at', 'edited_by']) then
    return new;
  end if;

  if v_uid is not null and v_stamped and new.edited_by <> v_uid and public.is_admin() then
    v_by := new.edited_by;  v_ok_by := v_uid;  v_via := 'approval';
  elsif v_uid is not null then
    v_by := v_uid;  v_via := 'session';
  elsif v_stamped then
    v_by := new.edited_by;  v_via := 'stamp';
  elsif v_role is null or v_role = 'service_role' then
    v_via := 'machine';
  else
    v_via := 'unknown';
  end if;

  insert into public.oeuvre_versions (oeuvre_id, snapshot, changed_by, approved_by, changed_via, source)
  values (old."OeuvreID", to_jsonb(old), v_by, v_ok_by, v_via, 'trigger');
  return new;
end;
$$;

revoke all on function public.snapshot_oeuvre() from public, anon;  -- trigger-only; same grant style as oeuvre_edit_stamp.sql

-- Trigger unchanged (oeuvre_version_snap BEFORE UPDATE ON "Oeuvres" FOR EACH ROW) — CREATE OR REPLACE keeps it.

-- Proof on the Docker copy (expected changed_by / approved_by / changed_via):
--   a. signed-in admin saves a work from the card                         [Pem / — / session]
--   b. team member proposes, admin approves                               [member / Pem / approval]
--   c. service-key action that stamps edited_by + edited_at (portfolio)   [Pem / — / stamp]
--   d. service-role UPDATE that does not stamp                            [— / — / machine]
--   e. psql as postgres: UPDATE "Oeuvres" SET "Commentaires" = …           [— / — / machine]
--   f. team member's own direct write (e.g. production board)             [member / — / session]
--   g. an older row                                                       [unchanged / — / NULL]
--   h. UPDATE that rewrites the same values (only edited_at moves)        [no new row]
--   select id, changed_by, approved_by, changed_via from oeuvre_versions order by id desc limit 7;
