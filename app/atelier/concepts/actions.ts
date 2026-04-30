'use server'

// Concept / Idea space server actions.

import { createClient } from '@/lib/supabase/server'

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

  const { data, error } = await supabase
    .from('concept')
    .insert({ titre, description, medium, themes, statut, image_note, energie, notes })
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  return { ok: true, concept: data as ConceptRow }
}

// ── Update concept ────────────────────────────────────────────────────────────

export async function updateConcept(id: string, patch: Partial<Omit<ConceptRow, 'id' | 'created_at' | 'updated_at'>>): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await supabase.from('concept').update(patch).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Delete concept ────────────────────────────────────────────────────────────

export async function deleteConcept(id: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await supabase.from('concept').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
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
