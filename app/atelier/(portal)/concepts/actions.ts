'use server'

// Idées (the concepts tab) server actions — R1 (docs/design/2026-11-17/R1_InputsFeed.notes.md).
// Ideas and concepts are one kind. The team reads them, adds discussion lines (note_line, target
// 'idea') and proposes new ones (note_line, target 'proposal'); only Pem (admin) edits an idea, its
// weight (Petite / Recherche) and maturity (Graine · Pousse · Mûre). RLS on note_line does the
// guarding (team inserts as self, never on a closed discussion); admin-only writes also check
// is_admin() here, since `concept` RLS still lets any team member write.

import { randomUUID } from 'crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { r2DeleteObject, r2PutObject } from '@/lib/r2-s3-object'
import { IDEA_MATURITIES, IDEA_WEIGHTS, type IdeaMaturity, type IdeaWeight } from '@/components/atelier/concepts/concept-constants'
import { resolveMessage } from '@/lib/i18n/resolve-message'

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
  weight:      IdeaWeight
  maturity:    IdeaMaturity
  discussion_closed_at: string | null
}

export type { IdeaWeight, IdeaMaturity }

/** One line of an idea's discussion (note_line, target_kind 'idea'). */
export interface IdeaLine {
  id:         number
  conceptId:  string
  body:       string
  author:     string | null
  createdAt:  string
  /** Discarded by Pem from the Fil: only Pem and the author still see it (RLS). */
  discarded:  boolean
  mine:       boolean
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

/** Admin-only writes: the idea itself, its weight, maturity and discussion close. */
async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'admin' as const, supabase: null }
  return { error: null, supabase }
}

function asWeight(v: unknown): IdeaWeight {
  return IDEA_WEIGHTS.includes(v as IdeaWeight) ? (v as IdeaWeight) : 'petite'
}
function asMaturity(v: unknown): IdeaMaturity {
  return IDEA_MATURITIES.includes(v as IdeaMaturity) ? (v as IdeaMaturity) : 'graine'
}

// ── Fetch all concepts ────────────────────────────────────────────────────────

export async function fetchConcepts(): Promise<ConceptRow[]> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return []
  const { data } = await supabase
    .from('concept')
    .select('*')
    .order('updated_at', { ascending: false })
  return (data ?? []) as ConceptRow[]
}

// ── Create concept ────────────────────────────────────────────────────────────

export async function createConcept(formData: FormData): Promise<ConceptResult> {
  const { error: authErr, supabase } = await guardAdmin()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const titre       = (formData.get('titre') as string | null)?.trim() || 'Sans titre'
  const description = (formData.get('description') as string | null)?.trim() || null
  const medium      = (formData.get('medium') as string | null)?.trim() || null
  const themesRaw   = (formData.get('themes') as string | null)?.trim() || ''
  const themes      = themesRaw ? themesRaw.split(',').map((t) => t.trim()).filter(Boolean) : null
  const statut      = (formData.get('statut') as string | null) || 'idee'
  const image_note  = (formData.get('image_note') as string | null)?.trim() || null
  const notes       = (formData.get('notes') as string | null)?.trim() || null
  const category    = (formData.get('category') as string | null) || 'artistic'
  const weight      = asWeight(formData.get('weight'))
  const maturity    = asMaturity(formData.get('maturity'))

  const { data, error } = await supabase
    .from('concept')
    .insert({ titre, description, medium, themes, statut, image_note, notes, category, weight, maturity })
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  revalidatePath('/atelier')
  return { ok: true, concept: data as ConceptRow }
}

// ── Update concept ────────────────────────────────────────────────────────────

export async function updateConcept(id: string, patch: Partial<Omit<ConceptRow, 'id' | 'created_at' | 'updated_at' | 'discussion_closed_at'>>): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardAdmin()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const clean = { ...patch }
  if (clean.weight !== undefined) clean.weight = asWeight(clean.weight)
  if (clean.maturity !== undefined) clean.maturity = asMaturity(clean.maturity)
  const { error } = await supabase.from('concept').update(clean).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  return { ok: true }
}

// ── Delete concept ────────────────────────────────────────────────────────────

export async function deleteConcept(id: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardAdmin()
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
  const { error: authErr, supabase } = await guardAdmin()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const file = formData.get('sketch') as File | null
  if (!file || file.size === 0) return { error: 'Missing file' }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const id = randomUUID().replace(/-/g, '').slice(0, 20)
    const filename = `concepts/C_${id}.avif`
    const avif = await sharp(buf)
      .rotate()
      .ensureAlpha()
      .avif({ quality: 70, effort: 3, chromaSubsampling: '4:4:4' })
      .toBuffer()
    await r2PutObject(avif, filename, 'image/avif', {
      source: 'concept_sketch',
      classification: 'linked',
      linkedRefs: [{ table: 'concept', column: 'image_note' }],
    })
    revalidatePath('/atelier')
    return { ok: true, storagePath: filename }
  } catch (e) {
    return { error: String(e) }
  }
}

// ── Promote to work (just link oeuvre_id + flip statut) ──────────────────────

export async function promoteConcept(id: string, oeuvre_id: number): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardAdmin()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await supabase
    .from('concept')
    .update({ statut: 'devenu_oeuvre', oeuvre_id })
    .eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Discussion on an idea (note_line, target 'idea') ─────────────────────────

async function namesFor(supabase: NonNullable<Awaited<ReturnType<typeof guardTeam>>['supabase']>, ids: string[]) {
  const names = new Map<string, string>()
  if (!ids.length) return names
  // `select('*')`: the typed select parser rejects the accented `Prénom` column name.
  const { data } = await supabase.from('Contact').select('*').in('auth_user_id', ids)
  for (const c of (data ?? []) as { auth_user_id: string | null; Prénom: string | null; Nom: string | null }[]) {
    if (c.auth_user_id) names.set(c.auth_user_id, [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—')
  }
  return names
}

/** Every idea line the reader may see (RLS: discarded ones only for Pem and their author), oldest first. */
export async function fetchIdeaLines(): Promise<IdeaLine[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('note_line')
    .select('id, concept_id, body, author_id, created_at, discarded_at')
    .eq('target_kind', 'idea')
    .order('created_at', { ascending: true })
    .limit(2000)
  if (error || !data) return []
  const names = await namesFor(supabase, [...new Set(data.map((l) => l.author_id).filter((x): x is string => !!x))])
  return data
    .filter((l) => !!l.concept_id)
    .map((l) => ({
      id: l.id,
      conceptId: l.concept_id as string,
      body: l.body,
      author: l.author_id ? names.get(l.author_id) ?? null : null,
      createdAt: l.created_at,
      discarded: l.discarded_at != null,
      mine: l.author_id === user.id,
    }))
}

/** Anyone on the team adds a line, live at once. Refused on a closed discussion (RLS too). */
export async function addIdeaLine(conceptId: string, body: string): Promise<{ error: string } | { ok: true; line: IdeaLine }> {
  const text = body.trim()
  if (!text) return { error: 'empty' }
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Auth' }

  const { data: idea } = await supabase.from('concept').select('discussion_closed_at').eq('id', conceptId).maybeSingle()
  if (!idea) return { error: 'missing' }
  if (idea.discussion_closed_at) return { error: 'closed' }

  const { data, error } = await supabase
    .from('note_line')
    .insert({ target_kind: 'idea', concept_id: conceptId, body: text, author_id: user.id })
    .select('id, concept_id, body, created_at')
    .single()
  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  const names = await namesFor(supabase, [user.id])
  revalidatePath('/hub/fil')
  return {
    ok: true,
    line: { id: data.id, conceptId, body: data.body, author: names.get(user.id) ?? null, createdAt: data.created_at, discarded: false, mine: true },
  }
}

/** Pem closes (or reopens) an idea's discussion: still readable, no new lines. */
export async function setIdeaDiscussionClosed(conceptId: string, closed: boolean): Promise<{ error: string } | { ok: true; closedAt: string | null }> {
  const { error: authErr, supabase } = await guardAdmin()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }
  const closedAt = closed ? new Date().toISOString() : null
  const { error } = await supabase.from('concept').update({ discussion_closed_at: closedAt }).eq('id', conceptId)
  if (error) return { error: error.message }
  revalidatePath('/atelier')
  return { ok: true, closedAt }
}

// ── « Proposer une idée » (note_line, target 'proposal') ─────────────────────

/** The team's creative entry: one text, optionally about one work (#1234). Goes straight to Pem's Fil. */
export async function proposeIdea(body: string, workRef: string): Promise<SimpleResult> {
  const text = body.trim()
  if (!text) return { error: 'empty' }
  const ref = workRef.trim().replace(/^#/, '')
  let oeuvreId: number | null = null
  if (ref) {
    if (!/^\d{1,9}$/.test(ref)) return { error: 'work' }
    oeuvreId = Number(ref)
  }
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Auth' }

  if (oeuvreId != null) {
    const { data: work } = await supabase.from('Oeuvres').select('OeuvreID').eq('OeuvreID', oeuvreId).maybeSingle()
    if (!work) return { error: 'work' }
  }

  const { error } = await supabase
    .from('note_line')
    .insert({ target_kind: 'proposal', oeuvre_id: oeuvreId, body: text, author_id: user.id })
  if (error) return { error: error.message }
  revalidatePath('/hub/fil')
  return { ok: true }
}

// ── Reminders with no Pipeline project (Pem 2026-11-18) ───────────────────────
// « it can go in reminders but needs to be visible in Idées »: dated notes that are not attached to a
// Pipeline project show on Idées (admin), each with « En faire une idée » (planted through idea_plant since
// 2026-11-23: its moment is on today and names the reminder's day; reminder marked read) or « Vu » (mark read).

export type LooseReminder = { id: string; message: string; remind_at: string }

export async function fetchLooseReminders(): Promise<LooseReminder[]> {
  const { error: authErr, supabase } = await guardAdmin()
  if (authErr || !supabase) return []
  // A sale's return-period reminder belongs to the sale (Pem 2026-11-28 « C »): Ventes shows its window, Aujourd'hui
  // the reminder on its day; Idées leaves it out. Its text always starts with the copy below (advanceWorkOrder).
  const coolingOff = resolveMessage('fr', 'ord_reminder_cooling_off').split('{ref}')[0].replace(/[%_]/g, '')
  const { data } = await supabase
    .from('suivi_reminder')
    .select('id, message, remind_at')
    .eq('lu', false)
    .is('process_id', null)
    .not('message', 'like', `${coolingOff}%`)
    .order('remind_at', { ascending: true })
    .limit(50)
  return (data ?? []) as LooseReminder[]
}

export async function reminderToIdea(id: string): Promise<ConceptResult> {
  const { error: authErr, supabase } = await guardAdmin()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }
  const { data: r } = await supabase
    .from('suivi_reminder')
    .select('id, message, remind_at, lu, process_id')
    .eq('id', id)
    .maybeSingle()
  if (!r || r.lu || r.process_id) return { error: 'reminder_gone' }
  const titre = (r.message ?? '').trim().slice(0, 200) || 'Sans titre'
  // Planted through the one door (Idées design 2026-11-23 §2): the idea and its moment on today, all or nothing.
  const { data: planted, error: plantErr } = await supabase.rpc('idea_plant', {
    p_title: titre,
    p_body: `${(r.message ?? '').trim() || titre}\n(rappel du ${r.remind_at})`,
  })
  if (plantErr || !planted) return { error: plantErr?.message ?? 'Insert failed' }
  const { data, error } = await supabase.from('concept').select('*').eq('id', (planted as { concept_id: string }).concept_id).single()
  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  await supabase.from('suivi_reminder').update({ lu: true }).eq('id', id)
  revalidateTag('reminders')
  revalidatePath('/atelier')
  return { ok: true, concept: data as ConceptRow }
}
