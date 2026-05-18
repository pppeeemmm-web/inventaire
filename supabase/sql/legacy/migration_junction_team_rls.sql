-- Optional: align DB RLS with other team tables (legacy/migration_v3_rls_fix.sql uses is_team()).
-- The app also writes junctions via SUPABASE_SERVICE_ROLE_KEY server-side so rows persist
-- even before these policies exist.
--
-- Run in Supabase SQL Editor once per project.

ALTER TABLE IF EXISTS public.oeuvre_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.working_group_work ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oeuvre_theme: team all" ON public.oeuvre_theme;
CREATE POLICY "oeuvre_theme: team all" ON public.oeuvre_theme
  FOR ALL TO public
  USING (public.is_team())
  WITH CHECK (public.is_team());

DROP POLICY IF EXISTS "working_group_work: team all" ON public.working_group_work;
CREATE POLICY "working_group_work: team all" ON public.working_group_work
  FOR ALL TO public
  USING (public.is_team())
  WITH CHECK (public.is_team());
