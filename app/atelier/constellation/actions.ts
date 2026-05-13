'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { r2PutObject, r2DeleteObject } from '@/lib/r2-s3-object'
import { r2GetObjectBuffer } from '@/lib/r2-s3-object-get'
import {
  CONSTELLATION_MAP_VERSION,
  type ConstellationMapDocument,
  isConstellationMapDocument,
} from '@/lib/constellation-map-document'

export interface ConstellationMapRow {
  id: string
  title: string
  updated_at: string
}

export type ConstellationMapListResult =
  | { error: string }
  | { ok: true; maps: ConstellationMapRow[] }

export type ConstellationMapSaveResult =
  | { error: string }
  | { ok: true; id: string }

export type ConstellationMapLoadResult =
  | { error: string }
  | { ok: true; document: ConstellationMapDocument }

export type SimpleResult = { error: string } | { ok: true }

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null, user: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null, user: null }
  return { error: null, supabase, user }
}

function r2KeyForMap(id: string) {
  return `constellation-maps/${id}.json`
}

export async function listConstellationMaps(): Promise<ConstellationMapListResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }
  const { data, error } = await supabase
    .from('constellation_map')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
  if (error) return { error: error.message }
  return { ok: true, maps: (data ?? []) as ConstellationMapRow[] }
}

export async function saveConstellationMap(
  title: string,
  document: ConstellationMapDocument,
): Promise<ConstellationMapSaveResult> {
  const { error: authErr, supabase, user } = await guardTeam()
  if (authErr || !supabase || !user) return { error: authErr ?? 'Auth' }

  const id = randomUUID()
  const r2_key = r2KeyForMap(id)
  const ttl = (title || '').trim() || 'Constellation map'

  const body: ConstellationMapDocument = {
    ...document,
    version: CONSTELLATION_MAP_VERSION,
  }
  const buf = Buffer.from(JSON.stringify(body), 'utf8')

  const { error: insErr } = await supabase.from('constellation_map').insert({
    id,
    auth_user_id: user.id,
    title: ttl,
    r2_key,
  })
  if (insErr) return { error: insErr.message }

  try {
    await r2PutObject(buf, r2_key, 'application/json')
  } catch (e) {
    await supabase.from('constellation_map').delete().eq('id', id)
    return { error: e instanceof Error ? e.message : 'R2 upload failed' }
  }

  revalidatePath('/atelier')
  return { ok: true, id }
}

export async function loadConstellationMap(mapId: string): Promise<ConstellationMapLoadResult> {
  const { error: authErr, supabase, user } = await guardTeam()
  if (authErr || !supabase || !user) return { error: authErr ?? 'Auth' }

  const { data: row, error } = await supabase
    .from('constellation_map')
    .select('r2_key, auth_user_id')
    .eq('id', mapId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!row || row.auth_user_id !== user.id) return { error: 'Introuvable' }

  const buf = await r2GetObjectBuffer(row.r2_key as string)
  if (!buf) return { error: 'Fichier introuvable' }

  let parsed: unknown
  try {
    parsed = JSON.parse(buf.toString('utf8'))
  } catch {
    return { error: 'JSON invalide' }
  }
  if (!isConstellationMapDocument(parsed)) return { error: 'Format de carte invalide' }
  return { ok: true, document: parsed }
}

export async function deleteConstellationMap(mapId: string): Promise<SimpleResult> {
  const { error: authErr, supabase, user } = await guardTeam()
  if (authErr || !supabase || !user) return { error: authErr ?? 'Auth' }

  const { data: row, error } = await supabase
    .from('constellation_map')
    .select('r2_key, auth_user_id')
    .eq('id', mapId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!row || row.auth_user_id !== user.id) return { error: 'Introuvable' }

  const key = row.r2_key as string
  try {
    await r2DeleteObject(key)
  } catch {
    /* orphan object acceptable; still delete row */
  }

  const { error: delErr } = await supabase.from('constellation_map').delete().eq('id', mapId)
  if (delErr) return { error: delErr.message }
  revalidatePath('/atelier')
  return { ok: true }
}
