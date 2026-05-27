import type { Lang } from '@/lib/i18n/dictionary'

/** Row shape for `stock_item` (Supabase client). */
export interface StockItemRow {
  id: number
  name: string
  category: string | null
  quantity: number
  unit: string
  min_stock: number
  supplier_id: number | null
  cost_unit: number | null
  notes: string | null
  updated_at: string
}

export interface StockContactLike {
  ContactID: number
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Role: string | null
  Email?: string | null
  IndicatifPays1?: string | null
  Téléphone1?: string | null
  Ville?: string | null
  Pays?: string | null
}

/** Optional location / email / phone for supplier list export. */
export function supplierContactSummary(c: StockContactLike): string | null {
  const parts: string[] = []
  const loc = [c.Ville?.trim(), c.Pays?.trim()].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  const email = c.Email?.trim()
  if (email) parts.push(email)
  const phoneRaw = c.Téléphone1?.trim()
  if (phoneRaw) {
    const ind = c.IndicatifPays1?.trim()
    parts.push(ind ? `${ind} ${phoneRaw}` : phoneRaw)
  }
  return parts.length > 0 ? parts.join(' — ') : null
}

/** Numbered lines for reorder lists (one supplier per line). */
export function buildSupplierOrderedListLines(
  contacts: StockContactLike[],
  orderedIds: number[],
): string[] {
  const byId = new Map(contacts.map((c) => [c.ContactID, c]))
  return orderedIds.map((id, index) => {
    const c = byId.get(id)
    const n = index + 1
    if (!c) return `${n}. #${id}`
    const name = supplierDisplayName(c)
    const extra = supplierContactSummary(c)
    return extra ? `${n}. ${name} — ${extra}` : `${n}. ${name}`
  })
}

/** Primary display name for a contact (supplier row). */
export function supplierDisplayName(c: StockContactLike): string {
  const inst = (c.NomInstitution ?? '').trim()
  if (inst) return inst
  return `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()
}

const STOCK_SUPPLIER_ROLES = new Set([
  'supplier',
  'fournisseur',
  'magasin',
  'fabricant',
])

/** Contact roles treated as material suppliers in stock UI. */
export function isStockSupplierRole(role: string | null | undefined): boolean {
  if (!role?.trim()) return false
  return STOCK_SUPPLIER_ROLES.has(role.trim().toLowerCase())
}

/** Suppliers for stock UI: supplier-like roles plus contacts linked on stock items. */
export function resolveStockSupplierContacts<T extends StockContactLike>(
  contacts: T[],
  items: Pick<StockItemRow, 'supplier_id'>[] = [],
): T[] {
  const linkedIds = new Set(
    items.map((it) => it.supplier_id).filter((id): id is number => id != null),
  )
  const seen = new Set<number>()
  const out: T[] = []
  for (const c of contacts) {
    if (!isStockSupplierRole(c.Role) && !linkedIds.has(c.ContactID)) continue
    if (seen.has(c.ContactID)) continue
    seen.add(c.ContactID)
    out.push(c)
  }
  return out
}

/** EUR formatting from viewer language (UI copy policy). */
export function formatStockCurrency(lang: Lang, value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '\u2014'
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value))
}

/** Sum of qty × unit cost for rows with a unit cost; `null` if none priced. */
export function pricedInventoryValueEur(items: StockItemRow[]): number | null {
  let sum = 0
  let n = 0
  for (const it of items) {
    const c = it.cost_unit
    if (c == null || Number.isNaN(Number(c))) continue
    const q = Number(it.quantity)
    if (Number.isNaN(q)) continue
    sum += q * Number(c)
    n += 1
  }
  return n > 0 ? sum : null
}
