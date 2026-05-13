-- Public contact / after-sales enquiries (`/enquiry`, `EnquiryClient` → `from('inquiry')`).
-- Run this before `sale_pipeline_extensions.sql` if you see: relation "inquiry" does not exist.
-- Apply manually in Supabase SQL editor (or via migration runner).

CREATE TABLE IF NOT EXISTS public.inquiry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open',
  oeuvre_id integer REFERENCES public."Oeuvres" ("OeuvreID") ON DELETE SET NULL,
  sale_order_id uuid REFERENCES public.sale_order (id) ON DELETE SET NULL,
  CONSTRAINT inquiry_category_check CHECK (
    category IN ('general', 'question', 'complaint', 'shipping', 'other')
  ),
  CONSTRAINT inquiry_status_check CHECK (status IN ('open', 'in_progress', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_inquiry_sale_order ON public.inquiry (sale_order_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_oeuvre ON public.inquiry (oeuvre_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_status ON public.inquiry (status);

COMMENT ON TABLE public.inquiry IS 'Public site enquiries; optional oeuvre_id / sale_order_id for after-sales routing.';

ALTER TABLE public.inquiry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiry_anon_insert" ON public.inquiry;
CREATE POLICY "inquiry_anon_insert"
  ON public.inquiry
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "inquiry_authenticated_insert" ON public.inquiry;
CREATE POLICY "inquiry_authenticated_insert"
  ON public.inquiry
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "inquiry_team_select" ON public.inquiry;
CREATE POLICY "inquiry_team_select"
  ON public.inquiry
  FOR SELECT
  TO authenticated
  USING (is_team());

DROP POLICY IF EXISTS "inquiry_team_update" ON public.inquiry;
CREATE POLICY "inquiry_team_update"
  ON public.inquiry
  FOR UPDATE
  TO authenticated
  USING (is_team())
  WITH CHECK (is_team());

GRANT INSERT ON public.inquiry TO anon;
GRANT SELECT, INSERT, UPDATE ON public.inquiry TO authenticated;
