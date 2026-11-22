import 'server-only'
import type { createServiceClient } from '@/lib/supabase/server'

/**
 * A contact deleted (not merged) can still be named in an old work version or a queued proposal — the
 * merge rewrites those ids, a delete does not (docs/TODO.md §1). Writing such an id back fails on the
 * foreign key, so the restore and approve doors check first.
 */

/** Work columns that point at a contact or one of its addresses (both go when the contact is deleted). */
export const CONTACT_REF_COLUMNS = ['ContactID', 'LocalisationID', 'AcheteurID', 'localisation_address_id'] as const

function refTable(column: string): 'Contact' | 'contact_addresses' {
  return column === 'localisation_address_id' ? 'contact_addresses' : 'Contact'
}

function asId(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Ids of `table` among `ids` that no longer exist (service role: RLS must not hide a live row). */
async function missingIds(
  svc: ReturnType<typeof createServiceClient>,
  table: 'Contact' | 'contact_addresses',
  ids: number[],
): Promise<Set<number>> {
  if (!ids.length) return new Set()
  const key = table === 'Contact' ? 'ContactID' : 'id'
  const { data, error } = await svc.from(table).select(key).in(key, ids)
  if (error) throw new Error(`${table}: ${error.message}`)
  const found = new Set(((data ?? []) as unknown as Record<string, number>[]).map((r) => r[key]))
  return new Set(ids.filter((id) => !found.has(id)))
}

/**
 * Snapshot / row columns (`CONTACT_REF_COLUMNS`) whose id no longer exists. Returns the column names.
 */
export async function deletedContactColumns(
  svc: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
): Promise<string[]> {
  const byTable = new Map<'Contact' | 'contact_addresses', { column: string; id: number }[]>()
  for (const column of CONTACT_REF_COLUMNS) {
    if (!(column in row)) continue
    const id = asId(row[column])
    if (id == null) continue
    const table = refTable(column)
    byTable.set(table, [...(byTable.get(table) ?? []), { column, id }])
  }
  const out: string[] = []
  for (const [table, refs] of byTable) {
    const gone = await missingIds(svc, table, [...new Set(refs.map((r) => r.id))])
    for (const r of refs) if (gone.has(r.id)) out.push(r.column)
  }
  return out
}

/** Pending form keys (among `keys`) whose proposed id no longer exists. */
export async function deletedContactFormKeys(
  svc: ReturnType<typeof createServiceClient>,
  payload: Record<string, string>,
  keys: string[],
): Promise<string[]> {
  const row: Record<string, unknown> = {}
  const columnToKey: Record<string, string> = {
    ContactID: 'contact_id',
    LocalisationID: 'localisation_id',
    AcheteurID: 'acheteur_id',
    localisation_address_id: 'localisation_address_id',
  }
  for (const [column, key] of Object.entries(columnToKey)) {
    if (keys.includes(key) && key in payload) row[column] = payload[key]
  }
  return (await deletedContactColumns(svc, row)).map((c) => columnToKey[c])
}
