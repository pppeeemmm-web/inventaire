-- Applied on live 2026-11-28 (migration journal_delete_53_54); re-read: 0 rows left, both guards enabled.
-- One-off delete of two hidden test notes (Pem « delete 53 54 », 2026-11-28): Journal #53 « Test note » and #54
-- « @Natural Pigments EU tell test » (26/11). The Journal never deletes (journal_entry_guard, journal_entry_link_guard);
-- the two guards are switched off for this transaction only (DDL is transactional: no other session ever runs without
-- them) and back on before commit. Removed: link #100 (#54 → contact #10), the two entries, their two graph nodes (no
-- relations). Anything other than exactly these rows → the whole transaction is refused, nothing changes.
do $$
declare n int;
begin
  alter table public.journal_entry disable trigger trg_journal_entry_guard;
  alter table public.journal_entry_link disable trigger trg_journal_entry_link_guard;

  delete from public.journal_entry_link where id = 100 and entry_id = 54 and contact_id = 10;
  get diagnostics n = row_count; if n <> 1 then raise exception 'expected 1 link, got %', n; end if;
  if exists (select 1 from public.journal_entry_link where entry_id in (53, 54) or target_entry_id in (53, 54))
     or exists (select 1 from public.journal_entry_label where entry_id in (53, 54))
     or exists (select 1 from public.journal_entry where corrects_id in (53, 54)) then
    raise exception 'other rows point at #53 / #54';
  end if;
  delete from public.journal_entry where id in (53, 54) and hidden_at is not null;
  get diagnostics n = row_count; if n <> 2 then raise exception 'expected 2 entries, got %', n; end if;
  delete from public.nodes where node_type = 'journal_entry' and source_pk in ('53', '54');
  get diagnostics n = row_count; if n > 2 then raise exception 'expected at most 2 nodes, got %', n; end if;

  alter table public.journal_entry enable trigger trg_journal_entry_guard;
  alter table public.journal_entry_link enable trigger trg_journal_entry_link_guard;
end $$;
