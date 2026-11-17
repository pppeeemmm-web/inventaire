// R7 order kinds. « Confié » (entrusted: a framer, restorer, photographer — the work keeps its stage
// and goes to the craftsperson for a while; Pem 2026-11-17) needs its SQL first
// (supabase/sql/work_order_r7_decisions.sql, own OK). Until it is applied the kind stays hidden in the
// forms: flip ENTRUSTED_LIVE to true in the same change that records the SQL as applied.
export const ENTRUSTED_LIVE = false

/** Statuses of an order that is still running (not finished, not cancelled). */
export const ORDER_FINISHED = ['closed', 'cancelled', 'delivered', 'handed_over'] as const
