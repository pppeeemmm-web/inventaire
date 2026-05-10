-- Commission tracking for parallel sale-through-consignment.
-- Apply manually via Supabase SQL editor.

ALTER TABLE consignment_order
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2) DEFAULT 0;

ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS consignment_order_id uuid REFERENCES consignment_order(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_amount numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_sale_order_consignment ON sale_order(consignment_order_id);
