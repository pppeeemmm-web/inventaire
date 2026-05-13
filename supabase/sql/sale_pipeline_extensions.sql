-- Sale pipeline extensions: return window, shipment↔order link, inquiry after-sales fields.
-- Apply manually via Supabase SQL editor.
--
-- If `relation "inquiry" does not exist`: run `supabase/sql/inquiry.sql` first, then re-run this file.

-- ── sale_order: cooling-off / return window (see work.md) ─────────────────
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS return_window_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS return_window_starts_at date,
  ADD COLUMN IF NOT EXISTS return_window_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN sale_order.return_window_days IS 'B2C-style cooling-off length; override per contract (0 = skip auto transition).';
COMMENT ON COLUMN sale_order.return_window_starts_at IS 'Authoritative start date for return window (usually physical delivery).';
COMMENT ON COLUMN sale_order.return_window_skipped IS 'When true, cron will not auto-move sold works to archive (e.g. B2B).';
COMMENT ON COLUMN sale_order.completed_at IS 'First transition to statut completed (set by app).';

-- ── shipment: optional link to commercial order (return window sync) ──────
ALTER TABLE shipment
  ADD COLUMN IF NOT EXISTS sale_order_id uuid REFERENCES sale_order(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_sale_order ON shipment(sale_order_id);

CREATE OR REPLACE FUNCTION sync_sale_order_return_window_from_shipment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sale_order_id IS NOT NULL AND NEW.status = 'delivered' THEN
    UPDATE sale_order
    SET
      return_window_starts_at = COALESCE(
        return_window_starts_at,
        (COALESCE(NEW.delivered_at, timezone('utc', now())))::date
      ),
      delivered = true
    WHERE id = NEW.sale_order_id
      AND statut = 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipment_return_window ON shipment;
CREATE TRIGGER trg_shipment_return_window
  AFTER INSERT OR UPDATE OF status, delivered_at, sale_order_id ON shipment
  FOR EACH ROW
  EXECUTE PROCEDURE sync_sale_order_return_window_from_shipment();

-- ── inquiry: after-sales / routing (public inserts stay allowed if RLS permits) ─
ALTER TABLE inquiry
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS oeuvre_id integer REFERENCES "Oeuvres"("OeuvreID") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_order_id uuid REFERENCES sale_order(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

ALTER TABLE inquiry
  DROP CONSTRAINT IF EXISTS inquiry_category_check;
ALTER TABLE inquiry
  ADD CONSTRAINT inquiry_category_check
  CHECK (category IN ('general', 'question', 'complaint', 'shipping', 'other'));

ALTER TABLE inquiry
  DROP CONSTRAINT IF EXISTS inquiry_status_check;
ALTER TABLE inquiry
  ADD CONSTRAINT inquiry_status_check
  CHECK (status IN ('open', 'in_progress', 'closed'));

CREATE INDEX IF NOT EXISTS idx_inquiry_sale_order ON inquiry(sale_order_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_oeuvre ON inquiry(oeuvre_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_status ON inquiry(status);
