-- RLS policies + GRANTs for Atelier consignment / logistics tables.
-- Production audit (`grant_audit_queries.sql` #2): RLS enabled, zero policies on
--   public.consignment_order, public.shipment, public.shipment_work
-- Apply manually in Supabase SQL editor (or migration runner).
--
-- Model: studio `is_team()` for SELECT/INSERT/UPDATE on all three; DELETE on
-- `consignment_order` admin-only (contracts / audit). `shipment` + `shipment_work`
-- DELETE allowed for any team member (operational corrections).

-- ── consignment_order ───────────────────────────────────────────────────────
ALTER TABLE public.consignment_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consignment_order_team_select" ON public.consignment_order;
CREATE POLICY "consignment_order_team_select"
  ON public.consignment_order FOR SELECT TO authenticated
  USING (is_team());

DROP POLICY IF EXISTS "consignment_order_team_insert" ON public.consignment_order;
CREATE POLICY "consignment_order_team_insert"
  ON public.consignment_order FOR INSERT TO authenticated
  WITH CHECK (is_team());

DROP POLICY IF EXISTS "consignment_order_team_update" ON public.consignment_order;
CREATE POLICY "consignment_order_team_update"
  ON public.consignment_order FOR UPDATE TO authenticated
  USING (is_team()) WITH CHECK (is_team());

DROP POLICY IF EXISTS "consignment_order_admin_delete" ON public.consignment_order;
CREATE POLICY "consignment_order_admin_delete"
  ON public.consignment_order FOR DELETE TO authenticated
  USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_order TO authenticated;

-- ── shipment ────────────────────────────────────────────────────────────────
ALTER TABLE public.shipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipment_team_select" ON public.shipment;
CREATE POLICY "shipment_team_select"
  ON public.shipment FOR SELECT TO authenticated
  USING (is_team());

DROP POLICY IF EXISTS "shipment_team_insert" ON public.shipment;
CREATE POLICY "shipment_team_insert"
  ON public.shipment FOR INSERT TO authenticated
  WITH CHECK (is_team());

DROP POLICY IF EXISTS "shipment_team_update" ON public.shipment;
CREATE POLICY "shipment_team_update"
  ON public.shipment FOR UPDATE TO authenticated
  USING (is_team()) WITH CHECK (is_team());

DROP POLICY IF EXISTS "shipment_team_delete" ON public.shipment;
CREATE POLICY "shipment_team_delete"
  ON public.shipment FOR DELETE TO authenticated
  USING (is_team());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment TO authenticated;

-- ── shipment_work ───────────────────────────────────────────────────────────
ALTER TABLE public.shipment_work ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipment_work_team_select" ON public.shipment_work;
CREATE POLICY "shipment_work_team_select"
  ON public.shipment_work FOR SELECT TO authenticated
  USING (is_team());

DROP POLICY IF EXISTS "shipment_work_team_insert" ON public.shipment_work;
CREATE POLICY "shipment_work_team_insert"
  ON public.shipment_work FOR INSERT TO authenticated
  WITH CHECK (is_team());

DROP POLICY IF EXISTS "shipment_work_team_update" ON public.shipment_work;
CREATE POLICY "shipment_work_team_update"
  ON public.shipment_work FOR UPDATE TO authenticated
  USING (is_team()) WITH CHECK (is_team());

DROP POLICY IF EXISTS "shipment_work_team_delete" ON public.shipment_work;
CREATE POLICY "shipment_work_team_delete"
  ON public.shipment_work FOR DELETE TO authenticated
  USING (is_team());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_work TO authenticated;
