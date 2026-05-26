import type { PostgrestError } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingChangeKind } from '@/lib/work-pending-keys'

/** PostgREST when `change_kind` is absent from DB or stale in schema cache (PGRST204). */
export function isChangeKindSchemaCacheError(
  err: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!err) return false
  if (err.code === 'PGRST204' && /change_kind/i.test(err.message ?? '')) return true
  const m = err.message ?? ''
  return /change_kind/i.test(m) && /schema cache|could not find/i.test(m)
}

export type PendingChangeInsertInput = {
  oeuvre_id: number | null
  change_kind: PendingChangeKind
  payload: Record<string, unknown>
  baseline: Record<string, unknown> | null
  author_id: string
  author_email: string | null
}

export type PendingChangeInsertError =
  | { kind: 'schema_migration' }
  | { kind: 'other'; message: string }

/**
 * Insert into pending_changes. Retries without `change_kind` when the column
 * is missing (pre-migration DB); stores create intent in payload instead.
 *
 * DB migration (Supabase SQL editor): `supabase/sql/pending_changes_change_kind.sql`
 * or full bundle `supabase/sql/oeuvres_provenance_and_create_gate.sql`.
 */
export async function insertPendingChange(
  supabase: SupabaseClient,
  row: PendingChangeInsertInput,
): Promise<{ error: PendingChangeInsertError | null }> {
  const first = await insertPendingChangeRow(supabase, row, true)
  if (!first.error) return { error: null }
  if (!isChangeKindSchemaCacheError(first.error)) {
    return { error: { kind: 'other', message: first.error.message } }
  }

  const retry = await insertPendingChangeRow(supabase, row, false)
  if (!retry.error) return { error: null }
  if (isChangeKindSchemaCacheError(retry.error)) {
    return { error: { kind: 'schema_migration' } }
  }
  return { error: { kind: 'other', message: retry.error.message } }
}

async function insertPendingChangeRow(
  supabase: SupabaseClient,
  row: PendingChangeInsertInput,
  withChangeKind: boolean,
): Promise<{ error: PostgrestError | null }> {
  const payload =
    !withChangeKind && row.change_kind === 'create'
      ? { ...row.payload, __pending_change_kind: 'create' as const }
      : row.payload

  const body: Record<string, unknown> = {
    oeuvre_id: row.oeuvre_id,
    payload,
    baseline: row.baseline,
    author_id: row.author_id,
    author_email: row.author_email,
  }
  if (withChangeKind) body.change_kind = row.change_kind

  const { error } = await supabase.from('pending_changes').insert(body)
  return { error }
}
