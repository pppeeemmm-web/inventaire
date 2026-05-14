-- Phase 0.1 — Drop legacy Oeuvres columns + obsolete tables (CEMETERY).
-- Apply manually in Supabase SQL editor (or your migration runner).
--
-- SAFETY: Do NOT drop public.tblrelations (lowercase) — constellation + purge use it.
-- Only removes CamelCase "tblRelations" / "OeuvreRelationships" if they still exist as legacy objects.
-- Each DROP uses CASCADE so views (e.g. OeuvresComplete) referencing a column are dropped with it — recreate views in Supabase if needed.

BEGIN;

ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "Statut" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "StatutID" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "tags" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "txtImageName" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "Emballage" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "DocsValidated" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "UniteDimension" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "NomOriginal" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "Poids" CASCADE;
ALTER TABLE public."Oeuvres" DROP COLUMN IF EXISTS "Tirage" CASCADE;

DROP TABLE IF EXISTS public."OeuvreRelationships" CASCADE;
DROP TABLE IF EXISTS public."tblRelations" CASCADE;

COMMIT;
