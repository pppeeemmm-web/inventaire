'use server'

// Journal Step B doors (design docs/design/2026-11-22/JournalDesign.md §5; SQL supabase/sql/journal_step_b.sql):
// labels beside an entry, a suite (a later note written beside the one it answers), and moving an entry to
// another day. The database holds each rule (RLS, guards, `journal_move_entry`); these doors check who asks,
// tell the truth (refused or nothing changed is never « ok ») and refresh nothing wide: the stream reads the
// changed day again itself.

import { createClient } from '@/lib/supabase/server'
import { createJournalEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { JOURNAL_LABELS } from '@/lib/journal/labels'

type Err = { error: string }


const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// The new table and function are not in the generated types until `npm run gen:types` runs after the SQL is live.
type Loose = { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any }

async function who() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, loose: supabase as unknown as Loose, user }
}

/** Adds a label to an entry (team). Already there → `already`, not « ok ». */
export async function addJournalLabel(entryId: number, label: string): Promise<{ ok: true; id: number } | Err> {
  if (!Number.isInteger(entryId) || entryId <= 0) return { error: 'not_found' }
  if (!(JOURNAL_LABELS as readonly string[]).includes(label)) return { error: 'label' }
  const { loose, user } = await who()
  if (!user) return { error: 'auth' }
  const { data, error } = await loose.from('journal_entry_label').insert({ entry_id: entryId, label, created_by: user.id }).select('id').single()
  if (error) return { error: error.code === '23505' ? 'already' : error.message }
  return { ok: true, id: Number(data.id) }
}

/** Removes a label (kept as history: removed_at / removed_by). Not there or already removed → `not_found`. */
export async function removeJournalLabel(labelId: number): Promise<{ ok: true } | Err> {
  if (!Number.isInteger(labelId) || labelId <= 0) return { error: 'not_found' }
  const { loose, user } = await who()
  if (!user) return { error: 'auth' }
  const { data, error } = await loose
    .from('journal_entry_label')
    .update({ removed_at: new Date().toISOString(), removed_by: user.id })
    .eq('id', labelId)
    .is('removed_at', null)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'not_found' }
  return { ok: true }
}

/**
 * « Ajouter une suite » (Delacroix's later remark): a new entry written today, linked to the earlier one
 * (`relation 'suite'`). It shows under the earlier entry on its day and on today's page.
 * If the link cannot be written the new entry stays (append-only) and the answer says `link_failed`.
 */
export async function addJournalSuite(entryId: number, text: string, today: string): Promise<{ ok: true; id: number } | Err> {
  if (!Number.isInteger(entryId) || entryId <= 0) return { error: 'not_found' }
  if (!DAY_RE.test(today)) return { error: 'day' }
  const { supabase, loose, user } = await who()
  if (!user) return { error: 'auth' }
  const { data: target } = await supabase.from('journal_entry').select('id, corrects_id').eq('id', entryId).maybeSingle()
  if (!target) return { error: 'not_found' }
  const rootId = target.corrects_id != null ? Number(target.corrects_id) : Number(target.id)
  const created = await createJournalEntry({ day: today, kind: 'note', body: text })
  if ('error' in created) return created
  const { error } = await loose
    .from('journal_entry_link')
    .insert({ entry_id: created.id, target_entry_id: rootId, relation: 'suite', created_by: user.id, proposed_by: 'pem', validated_at: new Date().toISOString() })
  if (error) return { error: 'link_failed' }
  return { ok: true, id: created.id }
}

/** « Placer sur un autre jour »: the author or an admin; the entry and its corrections move together. */
export async function moveJournalEntry(entryId: number, day: string, precision: 'day' | 'month' | 'year' = 'day'): Promise<{ ok: true; moved: number } | Err> {
  if (!Number.isInteger(entryId) || entryId <= 0) return { error: 'not_found' }
  if (!DAY_RE.test(day)) return { error: 'bad_day' }
  if (!['day', 'month', 'year'].includes(precision)) return { error: 'bad_day' }
  const { loose, user } = await who()
  if (!user) return { error: 'auth' }
  const { data, error } = await loose.rpc('journal_move_entry', { p_entry: entryId, p_day: day, p_precision: precision })
  if (error) {
    const m = String(error.message ?? '')
    const known = ['not_found', 'not_allowed', 'is_correction', 'bad_day', 'same_day'].find((k) => m.includes(k))
    return { error: known ?? m }
  }
  const moved = Number(data)
  if (!moved) return { error: 'not_found' }
  return { ok: true, moved }
}
