-- APPLIED 2026-11-18 (live, migration payments_refunded_at; checked in information_schema).
-- R7 review (Pem 2026-11-18, « SQL OK »): mark the money of a returned / cancelled sale as refunded.
-- One nullable column; additive, nothing else changes.
--
-- Grants: unchanged on purpose. `payments` already has its table grants and RLS
-- (payments_team_select / _insert / _update = is_team(), payments_admin_delete = is_admin()),
-- and a new column inherits the table-level grants — no column grant is added.
-- The app writes it through the team update policy (orders-actions.ts `markSaleRefunded`), for
-- every payment of the order that has none yet. The app moves no money: this is the record of
-- Pem's own transfer to the buyer.
--
-- After applying: set REFUNDED_AT_LIVE = true in lib/orders/kinds.ts, `npm run gen:types`,
-- `npm run typecheck`.

alter table public.payments
  add column if not exists refunded_at timestamptz;

comment on column public.payments.refunded_at is
  'When this payment was refunded to the buyer (returned / cancelled sale). Null = not refunded. Set from Commandes (« Marquer remboursé »); the app moves no money.';
