/**
 * Supply orders (TODO 11 + 11d): an order to a supplier, received into stock, with its expense and invoice
 * files. Design + Pem's answers: docs/design/2026-11-18/Supplies_Orders.notes.md. Tables and the receive
 * function come from `supabase/sql/supply_orders.sql`. Pem 2026-11-18: no stock history and no undo of a
 * receipt for now (Count fixes a wrong figure); receiving switches the item's supplier to the order's.
 *
 * Until the lead applies that SQL (flag false): the « Commandes » view and the Réassort « Créer la commande »
 * button are hidden, the expense form shows no file section, and every action returns `sql_waiting`.
 * Flip to true once the SQL is live, then `npm run gen:types`.
 */
export const SUPPLY_ORDERS_SQL_LIVE = false

export type SupplyOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled'

export interface SupplyOrderLine {
  id: number | null
  stock_item_id: number
  qty_ordered: number
  qty_received: number
  unit_price_ht: number | null
  /** From the stock item, for display. */
  name: string
  unit: string
  stock_qty: number
}

export interface SupplyOrderFile {
  id: string
  name: string
  storage_path: string | null
}

export interface SupplyOrderExpense {
  id: number
  date: string
  receipt_ref: string | null
  montant_ttc: number
}

export interface SupplyOrderSummary {
  id: number
  ref: string
  supplier_id: number
  status: SupplyOrderStatus
  ordered_at: string | null
  received_at: string | null
  expense_id: number | null
  lines: number
  /** Lines with less received than ordered (an open order with some received = partly delivered). */
  short_lines: number
  received_any: boolean
  total_ht: number | null
  files: number
}

export interface SupplyOrderDetail {
  id: number
  ref: string
  supplier_id: number
  status: SupplyOrderStatus
  ordered_at: string | null
  received_at: string | null
  notes: string | null
  expense: SupplyOrderExpense | null
  lines: SupplyOrderLine[]
  files: SupplyOrderFile[]
}

/** Line total HT, or null when the line has no price. */
export function lineTotalHt(l: Pick<SupplyOrderLine, 'qty_ordered' | 'unit_price_ht'>): number | null {
  return l.unit_price_ht == null ? null : l.qty_ordered * l.unit_price_ht
}

/** Order total HT over priced lines; null when no line is priced. */
export function orderTotalHt(lines: Pick<SupplyOrderLine, 'qty_ordered' | 'unit_price_ht'>[]): number | null {
  let sum = 0
  let priced = 0
  for (const l of lines) {
    const t = lineTotalHt(l)
    if (t == null) continue
    sum += t
    priced += 1
  }
  return priced > 0 ? Math.round(sum * 100) / 100 : null
}

/** What is still due on a line (never below 0). */
export function lineDue(l: Pick<SupplyOrderLine, 'qty_ordered' | 'qty_received'>): number {
  return Math.max(0, l.qty_ordered - l.qty_received)
}

/** i18n key of the status chip; an open order with some received reads « partly received ». */
export function supplyOrderStatusKey(s: { status: SupplyOrderStatus; received_any: boolean; short_lines: number }): string {
  if (s.status === 'ordered' && s.received_any) return 'so_status_partial'
  if (s.status === 'received' && s.short_lines > 0) return 'so_status_closed_short'
  return `so_status_${s.status}`
}

export function isOpenSupplyOrder(status: SupplyOrderStatus): boolean {
  return status === 'draft' || status === 'ordered'
}

/** Role given to a supplier added inline (read back by `isStockSupplierRole`). */
export const NEW_SUPPLIER_ROLE = 'Fournisseur'

/** Expense category used for supplies (matches the Fiscal list). */
export const SUPPLY_EXPENSE_CATEGORY = 'Matériaux artistiques'
