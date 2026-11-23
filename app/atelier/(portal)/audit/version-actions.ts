'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { unionHistorique } from '@/lib/historique-merge'
import { provenanceTimestamp } from '@/lib/oeuvre-provenance'
import { deletedContactColumns } from '@/lib/deleted-contact-refs'
import { logError } from '@/lib/error-reporter'
import { authorIdsOf, authorOfRow, type AuthorContactRow, type ChangeAuthor } from '@/lib/journal/authors'

export interface OeuvreVersion {
  id:          number
  oeuvre_id:   number
  snapshot:    Record<string, unknown>
  changed_by:  string | null
  changed_at:  string
  source:      string | null
  /** oeuvre_version_author.sql: how `changed_by` was learned; NULL on rows older than it. */
  changed_via?: string | null
  approved_by?: string | null
  /** Who made the change at `changed_at` (badge); null = not recorded. */
  by?:         ChangeAuthor | null
}

/** `kept`: snapshot columns left at the work's current value — the contact / address they named was deleted. */
export type VersionResult = { ok: true; kept?: string[] } | { error: string }

async function ensureAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase, user: null }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Action réservée à l’administrateur' as const, supabase, user }
  return { error: null, supabase, user }
}

export async function fetchOeuvreVersions(oeuvreId: number, limit = 50): Promise<OeuvreVersion[]> {
  const gate = await ensureAdmin()
  if (gate.error || !gate.supabase) return []
  const { data, error } = await gate.supabase
    .from('oeuvre_versions')
    .select('*')
    .eq('oeuvre_id', oeuvreId)
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[versions] fetch', error.message)
    return []
  }
  const rows = (data ?? []) as OeuvreVersion[]
  const ids = authorIdsOf(rows)
  const contacts = new Map<string, AuthorContactRow>()
  if (ids.length) {
    const { data: cs } = await gate.supabase.from('Contact').select('*').in('auth_user_id', ids)
    for (const c of (cs ?? []) as AuthorContactRow[]) if (c.auth_user_id) contacts.set(c.auth_user_id, c)
  }
  return rows.map((r) => ({ ...r, by: authorOfRow(r, contacts) }))
}

/**
 * Restore an Oeuvres row to a previously-snapshotted state. Admin only.
 * Writes the snapshot back via service-role client (bypasses RLS) so all columns
 * are honored regardless of the trigger that owns is_public, txtImageNameLink, etc.
 * The restore itself triggers a fresh snapshot of the *current* row, preserving lineage.
 */
export async function restoreOeuvreVersion(versionId: number): Promise<VersionResult> {
  const gate = await ensureAdmin()
  if (gate.error) return { error: gate.error }
  const supabase = gate.supabase!
  const svc = createServiceClient()

  const { data: row, error: selErr } = await supabase
    .from('oeuvre_versions').select('*').eq('id', versionId).maybeSingle()
  if (selErr) return { error: selErr.message }
  if (!row) return { error: 'Version introuvable' }

  const snap = row.snapshot as Record<string, unknown>
  const oeuvreId = row.oeuvre_id

  // Destroyed / lost (owner 2026-11-03): close the constat first — a restore would otherwise put
  // back an "available" work while its destruction / loss report is still open.
  const { count: openFate, error: fateErr } = await supabase
    .from('condition_report')
    .select('id', { count: 'exact', head: true })
    .eq('oeuvre_id', oeuvreId)
    .in('kind', ['destroyed', 'lost', 'stolen'])
    .is('resolved_on', null)
  if (fateErr) return { error: fateErr.message }
  if ((openFate ?? 0) > 0) return { error: 'fate_open' }

  // Strip columns that should never be restored: trigger-owned, primary key, mutable timestamps.
  const skip = new Set([
    'OeuvreID',          // PK
    'is_public',         // trigger-owned (CLAUDE.md cemetery)
    'txtImageNameLink',  // trigger tblimage_cover_sync
    'created_at',        // immutable
    // The restore is a new edit (stamped below): copying the snapshot's stamp back would make an open card's
    // older stamp match again, so its next save would silently undo the restore (saveWork edited_at check).
    'edited_at',
    'edited_by',
    // Kept by the constat triggers (supabase/sql/condition_report_fate.sql).
    'fate',
    'fate_on',
    'fate_precision',
    'status_before_fate',
    // Dropped columns still present in older snapshots (work_state_drop_duplicates.sql, 2026-11-17).
    'is_gift',
    'StageProduction',
    'commercial_status',
    // Retired by Places phase B (read-only until dropped): the place is restored through `place_id` below.
    'localisation_address_id',
    'LocalisationDetail',
    'home_place_id',
  ])
  // A contact (or its address) deleted since the snapshot cannot be written back: that field keeps the
  // work's current value, the rest is restored, and the reply names what was kept.
  let kept: string[]
  try {
    kept = await deletedContactColumns(svc, snap)
  } catch (e) {
    await logError('Version restore: contact check failed', e, { source: 'restoreOeuvreVersion' })
    return { error: e instanceof Error ? e.message : String(e) }
  }
  for (const k of kept) skip.add(k)

  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(snap)) {
    if (skip.has(k)) continue
    payload[k] = v
  }

  // Places phase B: a snapshot older than the switch names an address row; the map turns it into its place.
  // A place the restored holder is no longer linked to is written back and flagged (oeuvre_place_unlinked), never dropped.
  // A snapshot that had no address restores « no place » (not today's place).
  if (!('place_id' in snap) && 'localisation_address_id' in snap) {
    if (snap.localisation_address_id == null) {
      payload.place_id = null
    } else {
      const { data: m, error: mErr } = await svc
        .from('place_address_map').select('place_id').eq('address_id', Number(snap.localisation_address_id)).maybeSingle()
      if (mErr) return { error: mErr.message }
      payload.place_id = m?.place_id ?? null
    }
  }
  payload.edited_at = provenanceTimestamp()
  payload.edited_by = gate.user!.id

  // Historique is the work's log, written by the database (docs/WORK_RULES.md rule 14): a restore
  // brings back the snapshot's text and keeps every line written since, never drops one.
  if ('Historique' in payload) {
    const { data: cur, error: curErr } = await supabase
      .from('Oeuvres').select('Historique').eq('OeuvreID', oeuvreId).maybeSingle()
    if (curErr) return { error: curErr.message }
    payload.Historique = unionHistorique(
      typeof payload.Historique === 'string' ? payload.Historique : null,
      cur?.Historique ?? null,
    )
  }

  const { error: uErr } = await svc
    .from('Oeuvres').update(payload).eq('OeuvreID', oeuvreId)
  if (uErr) return { error: uErr.message }

  revalidatePath('/atelier')
  revalidatePath('/hub')
  return kept.length ? { ok: true, kept } : { ok: true }
}
