// R7 order kinds. « Confié » (entrusted: a framer, restorer, photographer — the work keeps its stage
// and goes to the craftsperson for a while; Pem 2026-11-17). Its SQL (supabase/sql/work_order_r7_decisions.sql)
// was applied live 2026-11-17 (Pem: « Apply it »), migration work_order_r7_decisions.
export const ENTRUSTED_LIVE = true

/** Statuses of an order that is still running (not finished, not cancelled). */
export const ORDER_FINISHED = ['closed', 'cancelled', 'delivered', 'handed_over'] as const
