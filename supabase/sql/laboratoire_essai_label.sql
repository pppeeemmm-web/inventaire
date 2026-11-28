-- Laboratoire « Essai » (docs/design/2026-11-28/Laboratoire.md, build step 3; Pem « Build … Laboratoire step 3 »).
-- A trial is a Journal entry with the label « essai », linked to its recipe (journal_entry_link, admin only through
-- journal_link_lab_guard). The label list gains 'essai' — same list as lib/journal/labels.ts JOURNAL_LABELS.
alter table public.journal_entry_label drop constraint if exists journal_entry_label_label_ck;
alter table public.journal_entry_label add constraint journal_entry_label_label_ck
  check (label in ('process', 'materials', 'spark', 'trigger', 'reflection', 'note', 'idea', 'research', 'essai'));
