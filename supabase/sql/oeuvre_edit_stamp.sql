-- NOT LIVE. Applied 2026-11-19 and dropped the same day (Pem « Yes, drop it now »): with today's app it caused false
-- `work_changed` refusals (production board, Inventory broadcast toggle, constat from the card, production dates,
-- contact merge / delete remap, « Annuler ») and the phone offline queue drops a refused edit. Before re-applying:
-- every writer and list row must carry the new stamp, the card's undo must reset its form, the offline queue must keep
-- a refused edit, the Journal badge must ignore system stamps. Findings: TODO §1, the flow review of 2026-11-19.
--
-- oeuvre_edit_stamp: every real change to a work moves its edited_at (TODO §1 « Data safety », 2026-11-19).
--
-- Why: the work card refuses a save when the work changed since it opened (saveWork compares `edited_at`,
-- docs/ARCHITECTURE.md §5). Only saveWork and restoreOeuvreVersion moved `edited_at`, so an order step, a batch
-- edit, the production board, a portfolio publish, an undo… changed status / owner / price without it, and a card
-- left open could then post its old values over them.
--
-- Rule: BEFORE UPDATE, after the other BEFORE triggers that change fields (name sorts after trg_sync_is_public,
-- before trg_zz_oeuvre_history). When the writer set edited_at itself (saveWork, restore) nothing happens.
-- Otherwise, if any field changed apart from the ones the database keeps by itself, edited_at = now() and
-- edited_by = the signed-in user (NULL for the service role).
-- Not counted as an edit: edited_at, edited_by, is_public, txtImageNameLink (cover, from tblImage), Historique
-- (lines the database appends; the card merges them), anonymity_level (forced by status), production_completed_on /
-- _precision (set by trg_oeuvre_production_span), fate, fate_on, fate_precision, status_before_fate (constat triggers).
-- App side in the same change: writers the card itself calls outside saveWork (revertWorkSnapshot,
-- setProductionDate) return the new edited_at so the card keeps saving.

create or replace function public.oeuvre_edit_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_skip text[] := array['edited_at', 'edited_by', 'is_public', 'txtImageNameLink', 'Historique', 'anonymity_level',
                         'production_completed_on', 'production_completed_precision',
                         'fate', 'fate_on', 'fate_precision', 'status_before_fate'];
begin
  if new.edited_at is distinct from old.edited_at then
    return new;
  end if;
  if (to_jsonb(new) - v_skip) is distinct from (to_jsonb(old) - v_skip) then
    new.edited_at := now();
    new.edited_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.oeuvre_edit_stamp() from public, anon;

drop trigger if exists trg_zy_oeuvre_edit_stamp on public."Oeuvres";
create trigger trg_zy_oeuvre_edit_stamp
  before update on public."Oeuvres"
  for each row execute function public.oeuvre_edit_stamp();
