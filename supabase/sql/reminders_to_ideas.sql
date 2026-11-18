-- 9 past-due reminders that were ideas → Idées (Pem 2026-11-18, lead session form: R1–R4, R6–R10 « Idée »;
-- « Demain » and the handwriting test stay reminders). APPLIED 2026-11-18, migration reminders_to_ideas.
-- Data only: each becomes a `concept` (idee / graine / petite, like kaizen_creation_to_ideas.sql), dated on its
-- reminder's day, with its origin in `notes`; then its reminder is marked read (lu = true). Nothing deleted.
-- Skips an id already read and a title that already exists as an idea, so it is safe to run twice.

with picked (rid) as (
  values
    ('93f01562-ff67-4990-a1e4-5169d873b7ff'::uuid),  -- Inspiration globale
    ('7b9476f7-0558-40ae-9bda-71f5b25c209e'::uuid),  -- Vue sainte victoire depuis berre
    ('07d6da34-bf70-429d-b161-51fc91c9453c'::uuid),  -- Light study figure sur cadre noir
    ('e5b46a44-ea1c-4e4b-959f-37117e009994'::uuid),  -- Demi cylindre
    ('21aff635-43cf-47da-90e9-7be95de74467'::uuid),  -- Blocks of landscape
    ('d44c2a99-b2f9-47d5-b244-266dde0d8636'::uuid),  -- Cadre coffre diorama
    ('6e6221dd-c883-45c1-b2bd-84a2af76f886'::uuid),  -- Flotter
    ('c178a9e9-2323-4f0a-900e-e7105e0188f6'::uuid),  -- Use of wobbly mirror
    ('22fff4c8-0d65-41e3-809a-22726e48565a'::uuid)   -- Chaïm Soutine et l'oblique
),
src as (
  select r.id, btrim(r.message) as titre, r.remind_at
    from suivi_reminder r join picked p on p.rid = r.id
   where not r.lu
),
ins as (
  insert into concept (titre, statut, category, weight, maturity, notes, created_at, updated_at)
  select s.titre, 'idee', 'artistic', 'petite', 'graine',
         'Venue d''un rappel du ' || to_char(s.remind_at, 'YYYY-MM-DD') || ' (rappels → Idées, 2026-11-18)',
         (s.remind_at::timestamp + time '12:00') at time zone 'Europe/Paris',
         now()
    from src s
   where not exists (select 1 from concept c where lower(btrim(c.titre)) = lower(s.titre))
  returning titre
)
update suivi_reminder r set lu = true
  from src s
 where r.id = s.id;
