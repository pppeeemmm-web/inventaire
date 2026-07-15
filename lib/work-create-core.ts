import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'

// Single source for Oeuvres creation (new-work insert path).
// Callers: saveWork (app/atelier/works/actions.ts), session workflow, share-triage.

type OeuvreInsert = Database['public']['Tables']['Oeuvres']['Insert']

/** Column payload for a new Oeuvres row — provenance stamps are added by insertOeuvreRow. */
export type OeuvreCreateColumns = Partial<
  Omit<OeuvreInsert, 'OeuvreID' | 'created_by' | 'edited_by' | 'edited_at'>
>

/**
 * Compute the next OeuvreID (no DB sequence — max(OeuvreID)+1 pattern).
 * Note: race condition possible if two inserts run simultaneously; acceptable
 * for single-artist studio usage. A unique constraint on OeuvreID surfaces as
 * a Postgres error from the subsequent insert if it happens.
 * Returns { error } if the max(OeuvreID) SELECT itself fails.
 */
export async function allocateOeuvreId(
  svc: SupabaseClient,
): Promise<number | { error: string }> {
  const { data: maxRow, error } = await svc
    .from('Oeuvres')
    .select('OeuvreID')
    .order('OeuvreID', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { error: `OeuvreID alloc: ${error.message}` }
  return ((maxRow?.OeuvreID as number | undefined) ?? 2337) + 1
}

/**
 * Insert a new Oeuvres row with the given OeuvreID and columns, stamping
 * provenance fields (created_by, edited_by, edited_at) exactly as the
 * saveWork insert branch does.
 */
export async function insertOeuvreRow(
  svc: SupabaseClient,
  oid: number,
  columns: OeuvreCreateColumns,
  provenance: { actorId: string | null; editedAt: string },
): Promise<{ error: string } | { ok: true }> {
  const { error: insertErr } = await svc.from('Oeuvres').insert({
    OeuvreID: oid,
    ...columns,
    created_by: provenance.actorId,
    edited_by:  provenance.actorId,
    edited_at:  provenance.editedAt,
  })

  if (insertErr) return { error: insertErr.message }
  return { ok: true }
}
