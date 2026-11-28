'use server'

// Laboratoire — the doors (docs/design/2026-11-28/Laboratoire.md, build step 3; SQL laboratoire.sql, live 2026-11-28).
// Pem only (admin): save_recipe refuses anyone else, and concept_lab_guard / journal_link_lab_guard hold the same rule
// for the ideas and the trial links. These doors pass the request and say a refusal as a code (`lab_err_*`); none
// answers « ok » when nothing changed. No whole-Atelier refresh: the screen reads the idea again (/api/ideas).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { plantIdea, writeInIdea } from '@/app/atelier/(portal)/concepts/idea-actions'
import { addJournalLabel } from '@/app/atelier/(portal)/journal/step-b-actions'
import { LAB_CHILD_ROLES, LAB_CRITERIA, LAB_SIGNS, type LabAssessment, type LabCriterion, type LabIngredient, type LabRole, type LabSign, type LabStep } from '@/lib/lab'

type Err = { error: string }
// laboratoire.sql columns are not in the generated types until `gen:types` runs.
type Loose = SupabaseClient<any, any, any>
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function admin(): Promise<{ sb: Loose } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'forbidden' }
  return { sb: supabase as unknown as Loose }
}

/** save_recipe's answer → ok / unchanged / a refusal code. */
function answer(data: unknown): { ok: true; updatedAt: string } | Err {
  const r = (data ?? {}) as { ok?: boolean; unchanged?: boolean; refused?: string; detail?: string; updated_at?: string }
  if (r.ok && r.updated_at) return { ok: true, updatedAt: r.updated_at }
  if (r.unchanged) return { error: 'unchanged' }
  return { error: r.refused ? (r.detail ? `${r.refused}:${r.detail}` : r.refused) : 'failed' }
}

/** One recipe's lines, steps and grid of limits (each kind sent replaces that kind), stale-checked. */
export async function saveRecipe(input: {
  id: string
  readUpdatedAt: string
  version?: number | null
  ingredients?: LabIngredient[]
  steps?: LabStep[]
  assessments?: LabAssessment[]
}): Promise<{ ok: true; updatedAt: string } | Err> {
  if (!UUID_RE.test(input.id)) return { error: 'not_found' }
  const g = await admin()
  if ('error' in g) return g
  const p: Record<string, unknown> = { id: input.id, read_updated_at: input.readUpdatedAt }
  if (input.version != null) p.version = input.version
  if (input.ingredients) {
    p.ingredients = input.ingredients.map((i) => ({ stock_item_id: i.stockItemId, label: i.label, amount: i.amount, unit: i.unit, ratio_pct: i.ratioPct, note: i.note }))
  }
  if (input.steps) p.steps = input.steps.filter((s) => s.body.trim()).map((s) => ({ body: s.body, duration: s.duration, equipment_stock_item_id: s.equipmentId, warning: s.warning }))
  if (input.assessments) {
    const ok = input.assessments.every((a) => (LAB_CRITERIA as readonly string[]).includes(a.criterion) && (a.source === 'literature' || a.source === 'trials') && LAB_SIGNS.includes(a.sign))
    if (!ok) return { error: 'bad_field:assessments' }
    p.assessments = input.assessments.map((a) => ({ criterion: a.criterion, source: a.source, sign: a.sign, score: a.score, note: a.note, source_ref: a.sourceRef, journal_entry_id: a.journalEntryId }))
  }
  const { data, error } = await g.sb.rpc('save_recipe', { p })
  if (error) {
    await logError('save_recipe failed', error, { source: 'lab.saveRecipe' })
    return { error: 'failed' }
  }
  return answer(data)
}

/**
 * « + Recette », « + Conjecture »… under a field or a chapter: plants the idea (with its moment on today, as every
 * idea) under its parent, then gives it its role and the next place in the chapter. If the role cannot be set the
 * idea stays an ordinary idea and the answer says so (`role_failed`).
 */
export async function plantLabIdea(input: { parentId: string; title: string; role: LabRole }): Promise<{ ok: true; conceptId: string } | Err> {
  if (!UUID_RE.test(input.parentId)) return { error: 'not_found' }
  if (!LAB_CHILD_ROLES.includes(input.role)) return { error: 'bad_field:role' }
  const g = await admin()
  if ('error' in g) return g
  const { data: parent } = await g.sb.from('concept').select('lab_role').eq('id', input.parentId).maybeSingle()
  if (!parent || (parent.lab_role !== 'champ' && parent.lab_role !== 'chapitre')) return { error: 'not_found' }
  const planted = await plantIdea({ title: input.title, parentId: input.parentId })
  if ('error' in planted) return planted
  const { data: last } = await g.sb.from('concept').select('position').eq('parent_id', input.parentId).not('position', 'is', null).order('position', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await g.sb
    .from('concept')
    .update({ lab_role: input.role, position: (last?.position ?? 0) + 1 })
    .eq('id', planted.conceptId)
    .select('id')
  if (error || !data?.length) {
    await logError('plantLabIdea role failed', error, { source: 'lab.plantLabIdea' })
    return { error: 'role_failed' }
  }
  return { ok: true, conceptId: planted.conceptId }
}

/**
 * « Essai » (from the phone at the bench, or the desk): a Journal entry on today linked to the recipe, labelled
 * « essai »; with a criterion, the recipe's « trials » cell for it takes the sign, score and note, pointing at the entry.
 * The entry is never undone: if the label or the grid does not hold, the answer says which (`label_failed`, `grid:…`).
 */
export async function addTrial(input: {
  recipeId: string
  body: string
  criterion?: LabCriterion | null
  sign?: LabSign | null
  score?: number | null
}): Promise<{ ok: true; entryId: number } | Err> {
  if (!UUID_RE.test(input.recipeId)) return { error: 'not_found' }
  const body = input.body.trim()
  if (!body) return { error: 'empty' }
  const g = await admin()
  if ('error' in g) return g
  const wrote = await writeInIdea(input.recipeId, body)
  if ('error' in wrote) return wrote
  const label = await addJournalLabel(wrote.entryId, 'essai')
  if ('error' in label) return { error: 'label_failed' }
  if (!input.criterion || !input.sign) return { ok: true, entryId: wrote.entryId }

  const { data: me } = await g.sb.from('concept').select('updated_at').eq('id', input.recipeId).maybeSingle()
  const { data: rows } = await g.sb.from('lab_assessment').select('criterion, source, sign, score, note, source_ref, journal_entry_id').eq('subject_id', input.recipeId)
  const kept: LabAssessment[] = (rows ?? [])
    .filter((r) => !(r.criterion === input.criterion && r.source === 'trials'))
    .map((r) => ({ criterion: r.criterion, source: r.source, sign: r.sign, score: r.score, note: r.note, sourceRef: r.source_ref, journalEntryId: r.journal_entry_id }))
  const score = Number.isInteger(input.score) && Number(input.score) >= 1 && Number(input.score) <= 5 ? Number(input.score) : null
  kept.push({ criterion: input.criterion, source: 'trials', sign: input.sign, score, note: body.slice(0, 500), sourceRef: null, journalEntryId: wrote.entryId })
  const saved = await saveRecipe({ id: input.recipeId, readUpdatedAt: me?.updated_at ?? '', assessments: kept })
  if ('error' in saved) return { error: `grid:${saved.error}` }
  return { ok: true, entryId: wrote.entryId }
}
