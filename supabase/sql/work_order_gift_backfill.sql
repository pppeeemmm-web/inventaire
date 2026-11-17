-- Orders (R7) step 2 of 3 — the works already given get a reconstituted gift order
-- (Pem 2026-11-17: « Yes, they should. And I cannot give you all the details »).
--
-- APPLIED 2026-11-17 (Pem: « Yes, run step 2 ») as migrations work_order_r7_step2_gift_backfill
-- + work_order_r7_step2_clear_stamped_dates. Do not run again (it stops if the orders exist).
--
-- Live 2026-11-17: 7 works in « Gift » (statusId 11), all owned and held by someone other than Pem.
--   #287  made through the gift dialog: one slip in the Vault (gifts/BORDEREAU_DON_287_…), no folder.
--   #302, #1653, #2124, #2162, #2339, #2341  set by hand: no slip, no date. (#2339 has is_gift = false.)
-- Each gets one order: kind gift, status handed_over (owner and custodian are already the recipient),
-- reconstituted, ref G-R-001… in work number order, recipient = the work's current owner. Dates
-- stay empty when nothing records them. The work rows are NOT touched (prices stay as they are —
-- the gift price is still an open question).
-- #287's slip is linked to its order and filed in « Commandes/Dons » (one Vault folder per kind).

begin;

do $$
declare
  w record;
  n int := 0;
  v_order uuid;
  v_doc record;
begin
  if (select count(*) from "Oeuvres" where "statusId" = 11 and deleted_at is null) <> 7 then
    raise exception 'Expected 7 works in Gift; the data changed since 2026-11-17 — re-check before running.';
  end if;
  if exists (select 1 from work_order where reconstituted and kind = 'gift') then
    raise exception 'Reconstituted gift orders already exist — this file has run before.';
  end if;

  for w in
    select "OeuvreID" as id, "ContactID" as owner
      from "Oeuvres"
     where "statusId" = 11 and deleted_at is null
     order by "OeuvreID"
  loop
    n := n + 1;
    select d.id, d.created_at, d.notes into v_doc
      from document d
     where d.oeuvre_id = w.id and d.storage_path like 'gifts/%'
     order by d.created_at limit 1;

    insert into work_order (kind, status, ref, reconstituted, party_id, signed_at, delivered_at, paper_path, notes)
    values (
      'gift', 'handed_over', 'G-R-' || lpad(n::text, 3, '0'), true, w.owner,
      v_doc.created_at, null,
      (select storage_path from document where id = v_doc.id),
      case when v_doc.id is null
        then 'Reconstitué le 2026-11 à partir de la fiche (statut Don). Date et détails inconnus.'
        else 'Reconstitué le 2026-11 à partir de la fiche et du bordereau de don existant.'
      end
    )
    returning id into v_order;

    insert into work_order_work (order_id, oeuvre_id) values (v_order, w.id);

    if v_doc.id is not null then
      update document set work_order_id = v_order, folder = 'Commandes/Dons' where id = v_doc.id;
    end if;
  end loop;
end $$;

-- work_order_before_write stamps delivered_at = now() on an insert with status handed_over; the
-- real hand-over dates are unknown → empty. (Run 2026-11-17 as its own migration
-- work_order_r7_step2_clear_stamped_dates, after the insert above.)
update work_order set delivered_at = null where reconstituted and kind = 'gift';

-- The Vault folder marker, so « Commandes/Dons » shows even when empty (same as createFolder).
insert into document (name, kind, folder, notes, mime_type)
select '.keep', 'system', 'Commandes/Dons', 'Folder marker', 'application/x-directory'
where not exists (select 1 from document where folder = 'Commandes/Dons' and name = '.keep');

commit;

-- Check (read-only):
--   select o.ref, l.oeuvre_id, o.party_id, o.signed_at, o.paper_path from work_order o
--     join work_order_work l on l.order_id = o.id where o.reconstituted order by o.ref;   -- 7 rows
--   select name, folder, work_order_id from document where storage_path like 'gifts/%';  -- 1 row, Commandes/Dons
