'use server'

// Idées — the doors (design docs/design/2026-11-23/IdeasDesign.md, SQL supabase/sql/ideas_tree.sql, live 2026-11-23).
// The database holds the rules: anyone on the team plants and writes ideas; the stage is moved by the idea's author
// (or an admin); a branch never grows on itself; only an admin deletes, and never while moments or branches point
// to it. These doors pass the request and say a refusal in words (a code the screen translates); none answers « ok »
// when nothing changed. No whole-Atelier refresh (BuildingPrinciples 6): the screen reads the idea again.

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { createJournalEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { momentLinkedToIdea } from '@/lib/ideas/link-check'
import { r2DeleteObject } from '@/lib/r2-s3-object'

type Err = { error: string }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STAGES = ['graine', 'pousse', 'mure'] as const

/** Database refusal → a code the screen words (`idea_err_*`). */
function code(e: { message?: string; code?: string } | null): string {
  const m = e?.message ?? ''
  for (const k of ['idea_loop', 'idea_stage_not_allowed', 'idea_author_frozen', 'not_allowed', 'empty', 'not_found']) if (m.includes(k)) return k
  if (e?.code === '23503') return 'in_use'
  if (e?.code === '42501') return 'not_allowed'
  return 'failed'
}

async function signedIn() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * Plants an idea (graine): from a moment (`fromEntryId`, it stays on its day) or with a new moment written on
 * today (`body`, else the title). One database call: idea + moment + link + label Idée, all or nothing.
 */
export async function plantIdea(input: { title: string; body?: string | null; fromEntryId?: number | null; parentId?: string | null }): Promise<{ ok: true; conceptId: string; entryId: number } | Err> {
  const title = (input.title ?? '').trim()
  if (!title) return { error: 'empty' }
  if (input.parentId && !UUID_RE.test(input.parentId)) return { error: 'not_found' }
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'auth' }
  const { data, error } = await supabase.rpc('idea_plant', {
    p_title: title,
    p_body: input.body?.trim() || undefined,
    p_from_entry: input.fromEntryId ?? undefined,
    p_parent: input.parentId ?? undefined,
  })
  if (error || !data) {
    const c = code(error)
    if (c === 'failed') await logError('idea_plant failed', error, { source: 'ideas.plantIdea' })
    return { error: c }
  }
  const res = data as { concept_id: string; entry_id: number }
  return { ok: true, conceptId: res.concept_id, entryId: Number(res.entry_id) }
}

/** Writes a moment into an idea: a Journal entry on today, already linked to the idea. */
export async function writeInIdea(conceptId: string, body: string, dictated = false): Promise<{ ok: true; entryId: number } | Err> {
  if (!UUID_RE.test(conceptId)) return { error: 'not_found' }
  const res = await createJournalEntry({ day: todayCalendarDayInParis(), kind: 'note', body, dictated, conceptIds: [conceptId] })
  if ('error' in res) return res
  // The entry is on today; say so in words if its link to the idea did not hold.
  if (!(await momentLinkedToIdea(res.id, conceptId))) return { error: 'link_failed' }
  return { ok: true, entryId: res.id }
}

async function updateOne(id: string, patch: Record<string, unknown>, what: string): Promise<{ ok: true } | Err> {
  if (!UUID_RE.test(id)) return { error: 'not_found' }
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'auth' }
  const { data, error } = await supabase.from('concept').update(patch).eq('id', id).select('id')
  if (error) {
    const c = code(error)
    if (c === 'failed') await logError(`idea ${what} failed`, error, { source: 'ideas.update', metadata: { id } })
    return { error: c }
  }
  if (!data?.length) return { error: 'not_found' }
  return { ok: true }
}

/** Moves the stage (graine · pousse · mûre). The database refuses it for someone else's idea (unless admin). */
export async function setIdeaStage(id: string, stage: string): Promise<{ ok: true } | Err> {
  if (!STAGES.includes(stage as (typeof STAGES)[number])) return { error: 'failed' }
  return updateOne(id, { maturity: stage }, 'stage')
}

/** Grafts an idea onto another (`parentId`), or makes it a trunk (`null`). A loop is refused by the database. */
export async function setIdeaParent(id: string, parentId: string | null): Promise<{ ok: true } | Err> {
  if (parentId !== null && !UUID_RE.test(parentId)) return { error: 'not_found' }
  if (parentId === id) return { error: 'idea_loop' }
  return updateOne(id, { parent_id: parentId }, 'parent')
}

/** The idea's one living text (its history is kept by the database, `concept_change`). */
export async function saveIdeaText(id: string, text: string): Promise<{ ok: true } | Err> {
  return updateOne(id, { description: text.trim() ? text.slice(0, 50_000) : null }, 'text')
}

export async function renameIdea(id: string, title: string): Promise<{ ok: true } | Err> {
  const t = title.trim().slice(0, 200)
  if (!t) return { error: 'empty' }
  return updateOne(id, { titre: t }, 'title')
}

/** Admin only (database rule). Refused while moments or branches point to the idea. */
export async function deleteIdea(id: string): Promise<{ ok: true } | Err> {
  if (!UUID_RE.test(id)) return { error: 'not_found' }
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'auth' }
  const { data, error } = await supabase.from('concept').delete().eq('id', id).select('id, image_note')
  if (error) return { error: code(error) }
  if (!data?.length) return { error: 'not_allowed' }
  // Its sketch (old ideas), as the former deleteConcept did.
  const sketch = (data[0] as { image_note?: string | null }).image_note?.trim()
  if (sketch?.startsWith('concepts/')) {
    try {
      await r2DeleteObject(sketch)
    } catch (e) {
      await logError('idea sketch delete failed', e, { source: 'ideas.deleteIdea', metadata: { id, sketch } })
    }
  }
  return { ok: true }
}
