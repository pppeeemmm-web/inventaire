import 'server-only'
import type { createServiceClient } from '@/lib/supabase/server'

/**
 * A contact deleted (not merged) can still be named in an old work version or a queued proposal — the
 * merge rewrites those ids, a delete does not (docs/TODO.md §1). Writing such an id back fails on the
 * foreign key, so the restore and approve doors check first.
 */

/** Work columns that point at a contact (gone when the contact is deleted). A place is never deleted (Places phase B). */
export const CONTACT_REF_COLUMNS = ['ContactID', 'LocalisationID', 'AcheteurID'] as const

function asId(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Contact ids among `ids` that no longer exist (service role: RLS must not hide a live row). */
async function missingContactIds(svc: ReturnType<typeof createServiceClient>, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set()
  const { data, error } = await svc.from('Contact').select('ContactID').in('ContactID', ids)
  if (error) throw new Error(`Contact: ${error.message}`)
  const found = new Set(((data ?? []) as { ContactID: number }[]).map((r) => r.ContactID))
  return new Set(ids.filter((id) => !found.has(id)))
}

/**
 * Snapshot / row columns (`CONTACT_REF_COLUMNS`) whose id no longer exists. Returns the column names.
 */
export async function deletedContactColumns(
  svc: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
): Promise<string[]> {
  const refs: { column: string; id: number }[] = []
  for (const column of CONTACT_REF_COLUMNS) {
    if (!(column in row)) continue
    const id = asId(row[column])
    if (id != null) refs.push({ column, id })
  }
  const gone = await missingContactIds(svc, [...new Set(refs.map((r) => r.id))])
  return refs.filter((r) => gone.has(r.id)).map((r) => r.column)
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
  }
  for (const [column, key] of Object.entries(columnToKey)) {
    if (keys.includes(key) && key in payload) row[column] = payload[key]
  }
  return (await deletedContactColumns(svc, row)).map((c) => columnToKey[c])
}
