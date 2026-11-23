-- Places — phase A, three small fixes (Pem OK 2026-11-23, « yes »). Design Places.md §6i, §6j, answers 35–40.
-- 1. Labels of the creation places: motifs, and places where Pem worked.
-- 2. Rutali: the postcode was typed in the town field.
-- 3. A name is not a place: no uniqueness on place names (§6j). The app's « déjà connu ? » check replaces it later.
-- Touches only public.place (8 rows). graph_place_text_dirty fires on the town change (marks works' search text pending — harmless).

update public.place set kind = 'motif'
 where id in (7, 8, 9) and name in ('Aureille', 'Les Baux-de-Provence', 'Lac du Peiroo');

update public.place set kind = 'address'
 where id in (4, 6) and name in ('Rutali', 'Paris');

update public.place set postcode = '20239', town = 'Rutali'
 where id = 4 and name = 'Rutali' and town = '20239';

drop index if exists public.place_name_creation_uq;
