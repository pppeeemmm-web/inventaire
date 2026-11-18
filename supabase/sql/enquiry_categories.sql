-- APPLIED 2026-11-18 (live migration `enquiry_categories`, by the lead; 4 rows unchanged, no « Motif : » row moved).
-- Enquiry reasons as real categories (R8, Pem 2026-11-18: « Go »).
-- The public form (/enquiry, components/public/EnquiryClient.tsx) offers Acquérir une œuvre / Commande /
-- Exposition / Presse. Until this runs, `inquiry_category_check` refuses those values, so the form stores them
-- as `general` with « Motif : … » / « Topic: … » as the message's first line.
-- After this runs: flip ENQUIRY_CATEGORIES_SQL_LIVE in lib/enquiry-categories.ts → the form writes
-- buy / commission / show / press and the message stays as the visitor typed it.
--
-- Access is unchanged: anon and authenticated keep INSERT (policies inquiry_anon_insert /
-- inquiry_authenticated_insert, WITH CHECK true); team SELECT / UPDATE (is_team()). Only the CHECK widens.
-- No new table, so no new policy. The GRANT below only restates what supabase/sql/inquiry.sql gave.
--
-- Existing rows: on 2026-11-18 no row carried a « Motif : » / « Topic: » first line (0 of 4 rows). The UPDATE
-- below moves any that arrive before this runs: it sets the category only when the first line is exactly one
-- of the form's own labels, and leaves the message text as it is (nothing removed).
-- Idempotent: safe to run twice.

begin;

alter table public.inquiry drop constraint if exists inquiry_category_check;
alter table public.inquiry add constraint inquiry_category_check check (
  category in ('general', 'question', 'complaint', 'shipping', 'other', 'buy', 'commission', 'show', 'press')
);

update public.inquiry
set category = case split_part(message, E'\n', 1)
  when 'Motif : Acquérir une œuvre' then 'buy'
  when 'Topic: Buy a work' then 'buy'
  when 'Motif : Commande' then 'commission'
  when 'Topic: Commission' then 'commission'
  when 'Motif : Exposition' then 'show'
  when 'Topic: Exhibition' then 'show'
  when 'Motif : Presse' then 'press'
  when 'Topic: Press' then 'press'
end
where category = 'general'
  and split_part(message, E'\n', 1) in (
    'Motif : Acquérir une œuvre', 'Topic: Buy a work',
    'Motif : Commande', 'Topic: Commission',
    'Motif : Exposition', 'Topic: Exhibition',
    'Motif : Presse', 'Topic: Press'
  );

grant insert on public.inquiry to anon;
grant select, insert, update on public.inquiry to authenticated;

commit;

-- Check after: should list the new values.
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'inquiry_category_check';
