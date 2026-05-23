'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface OeuvreVersion {
  id:          number
  oeuvre_id:   number
  snapshot:    Record<string, unknown>
  changed_by:  string | null
  changed_at:  string
  source:      string | null
}

export type VersionResult = { ok: true } | { error: string }

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
  return (data ?? []) as OeuvreVersion[]
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

  // Strip columns that should never be restored: trigger-owned, primary key, mutable timestamps.
  const skip = new Set([
    'OeuvreID',          // PK
    'is_public',         // trigger-owned (CLAUDE.md cemetery)
    'txtImageNameLink',  // trigger tblimage_cover_sync
    'created_at',        // immutable
  ])
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(snap)) {
    if (skip.has(k)) continue
    payload[k] = v
  }

  const { error: uErr } = await svc
    .from('Oeuvres').update(payload).eq('OeuvreID', oeuvreId)
  if (uErr) return { error: uErr.message }

  revalidatePath('/atelier')
  revalidatePath('/hub')
  return { ok: true }
}
