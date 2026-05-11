'use server'

// Concept / Idea space server actions.

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { r2DeleteObject, r2PutObject } from '@/lib/r2-s3-object'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConceptRow {
  id:          string
  created_at:  string
  updated_at:  string
  titre:       string
  description: string | null
  medium:      string | null
  themes:      string[] | null
  statut:      string
  oeuvre_id:   number | null
  image_note:  string | null
  energie:     number | null
  notes:       string | null
  category:    string | null
}

export type ConceptResult  = { error: string } | { ok: true; concept: ConceptRow }
export type SimpleResult   = { error: string } | { ok: true }

// ── Auth guard ────────────────────────────────────────────────────────────────

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

// ── Fetch all concepts ────────────────────────────────────────────────────────

export async function fetchConcepts(): Promise<ConceptRow[]> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return []
  const { data } = await supabase
    .from('concept')
    .select('*')
    .order('energie', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
  return (data ?? []) as ConceptRow[]
}

// ── Create concept ────────────────────────────────────────────────────────────

export async function createConcept(formData: FormData): Promise<ConceptResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const titre       = (formData.get('titre') as string | null)?.trim() || 'Sans titre'
  const description = (formData.get('description') as string | null)?.trim() || null
  const medium      = (formData.get('medium') as string | null)?.trim() || null
  const themesRaw   = (formData.get('themes') as string | null)?.trim() || ''
  const themes      = themesRaw ? themesRaw.split(',').map((t) => t.trim()).filter(Boolean) : null
  const statut      = (formData.get('statut') as string | null) || 'idee'
  const image_note  = (formData.get('image_note') as string | null)?.trim() || null
  const energie     = formData.get('energie') ? Number(formData.get('energie')) : null
  const notes       = (formData.get('notes') as string | null)?.trim() || null
  const category    = (formData.get('category') as string | null) || 'artistic'

  const { data, error } = await supabase
    .from('concept')
    .insert({ titre, description, medium, themes, statut, image_note, energie, notes, category })
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  revalidatePath('/atelier')
  return { ok: true, concept: data as ConceptRow }
}

// ── Update concept ────────────────────────────────────────────────────────────

export async function updateConcept(id: string, patch: Partial<Omit<ConceptRow, 'id' | 'created_at' | 'updated_at'>>): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await supabase.from('concept').update(patch).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  return { ok: true }
}

// ── Delete concept ────────────────────────────────────────────────────────────

export async function deleteConcept(id: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: row } = await supabase.from('concept').select('image_note').eq('id', id).maybeSingle()
  const note = (row as { image_note?: string | null } | null)?.image_note?.trim()
  if (note?.startsWith('concepts/')) {
    try {
      await r2DeleteObject(note)
    } catch {
      /* best-effort */
    }
  }

  const { error } = await supabase.from('concept').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  return { ok: true }
}

/** Upload sketch / scan to R2 as AVIF; returns storage key for `concept.image_note`. */
export async function uploadConceptSketch(
  formData: FormData,
): Promise<{ error: string } | { ok: true; storagePath: string }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const file = formData.get('sketch') as File | null
  if (!file || file.size === 0) return { error: 'Missing file' }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const id = randomUUID().replace(/-/g, '').slice(0, 20)
    const filename = `concepts/C_${id}.avif`
    const avif = await sharp(buf)
      .rotate()
      .avif({ quality: 70, effort: 3, chromaSubsampling: '4:4:4' })
      .toBuffer()
    await r2PutObject(avif, filename, 'image/avif')
    revalidatePath('/atelier')
    return { ok: true, storagePath: filename }
  } catch (e) {
    return { error: String(e) }
  }
}

// ── Promote to work (just link oeuvre_id + flip statut) ──────────────────────

export async function promoteConcept(id: string, oeuvre_id: number): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await supabase
    .from('concept')
    .update({ statut: 'devenu_oeuvre', oeuvre_id })
    .eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}
