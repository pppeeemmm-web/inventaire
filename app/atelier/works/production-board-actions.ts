'use server'

// Production board writes (docs/WORK_RULES.md, build batch 1, Pem 2026-11-17). The board used to
// write from the browser and ignored a refused work update (the task looked done, the work was not).
// Now every move goes through here, as the signed-in user (RLS applies), and a refusal comes back.
// The board only sets the stage; the database does the rest (supabase/sql/work_state_rules.sql):
// the status follows the stage in the studio, Cataloguer / Photographier follow the stage, a ticked
// task keeps its day, the finished date and the history line are written there.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

/** 9 = Cataloguer, 6 = Photographier (work_action_type). */
const CATALOGUE = 9
const PHOTOGRAPH = 6

/** What the board needs to redraw the work after a move. */
export type BoardWork = {
  OeuvreID: number
  statusId: number | null
  Catalogué: boolean | null
  NeedsPhotograph: boolean | null
  Encadree: boolean | null
  Montee: boolean | null
  Exposable: boolean | null
}
export type BoardTask = { id: number; oeuvre_id: number; action_type_id: number; done: boolean; note: string | null }
export type BoardResult = { ok: true; work: BoardWork | null; openTasks: BoardTask[] } | { error: string }

const WORK_COLS = 'OeuvreID, statusId, "Catalogué", NeedsPhotograph, Encadree, Montee, Exposable'
/** Work fields a task may set when ticked (work_action_type.field_key), stage fields excluded. */
const TASK_FIELDS = new Set(['Encadree', 'Montee', 'Exposable'])

type Supa = Awaited<ReturnType<typeof createClient>>

async function readBack(supabase: Supa, oeuvreId: number): Promise<BoardResult> {
  const [{ data: work, error: wErr }, { data: tasks, error: tErr }] = await Promise.all([
    supabase.from('Oeuvres').select(WORK_COLS).eq('OeuvreID', oeuvreId).maybeSingle(),
    supabase
      .from('work_action')
      .select('id, oeuvre_id, action_type_id, done, note')
      .eq('oeuvre_id', oeuvreId)
      .eq('done', false)
      .is('paused_at', null),
  ])
  if (wErr || tErr) return { error: (wErr ?? tErr)!.message }
  revalidatePath('/atelier')
  return { ok: true, work: (work as BoardWork | null) ?? null, openTasks: (tasks ?? []) as BoardTask[] }
}

async function signedIn(): Promise<{ supabase: Supa } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  return { supabase }
}

/** ✓ on a card: tick the task. Cataloguer / Photographier move the stage; the database follows. */
export async function completeBoardTask(oeuvreId: number, actionTypeId: number): Promise<BoardResult> {
  if (!Number.isInteger(oeuvreId) || !Number.isInteger(actionTypeId)) return { error: 'bad_input' }
  const s = await signedIn()
  if ('error' in s) return s
  const { supabase } = s

  const { data: work, error: wErr } = await supabase
    .from('Oeuvres').select('"Catalogué"').eq('OeuvreID', oeuvreId).maybeSingle()
  if (wErr) return { error: wErr.message }
  if (!work) return { error: 'not_found' }

  let patch: Record<string, boolean> | null = null
  if (actionTypeId === CATALOGUE) {
    // Catalogué needs a photo (same gate as the work card, rule 2).
    const { count, error: iErr } = await supabase
      .from('tblImage').select('ImageID', { count: 'exact', head: true }).eq('OeuvreID', oeuvreId)
    if (iErr) return { error: iErr.message }
    if (!count) return { error: 'catalogue_requires_photo' }
    patch = { 'Catalogué': true, NeedsPhotograph: true }
  } else if (actionTypeId === PHOTOGRAPH) {
    if (!work['Catalogué']) return { error: 'photo_requires_catalogue' }
    patch = { NeedsPhotograph: false }
  } else {
    const { data: type } = await supabase
      .from('work_action_type').select('field_key').eq('id', actionTypeId).maybeSingle()
    const field = type?.field_key ?? null
    if (field && TASK_FIELDS.has(field)) patch = { [field]: true }
  }

  if (patch) {
    const { error } = await supabase.from('Oeuvres').update(patch).eq('OeuvreID', oeuvreId)
    if (error) {
      await logError('Production board stage update refused', error, { source: 'production.completeBoardTask', metadata: { oeuvreId, actionTypeId } })
      return { error: error.message }
    }
  }
  // Stage tasks are ticked by the database with the stage; any other task is ticked here.
  if (actionTypeId !== CATALOGUE && actionTypeId !== PHOTOGRAPH) {
    const { error } = await supabase
      .from('work_action').update({ done: true })
      .eq('oeuvre_id', oeuvreId).eq('action_type_id', actionTypeId).eq('done', false)
    if (error) return { error: error.message }
  }
  return readBack(supabase, oeuvreId)
}

/** « + » on a column: an open task of that kind for the work. */
export async function addBoardTask(oeuvreId: number, actionTypeId: number): Promise<BoardResult> {
  if (!Number.isInteger(oeuvreId) || !Number.isInteger(actionTypeId)) return { error: 'bad_input' }
  const s = await signedIn()
  if ('error' in s) return s
  const { supabase } = s
  const { error } = await supabase
    .from('work_action')
    .upsert({ oeuvre_id: oeuvreId, action_type_id: actionTypeId, done: false }, { onConflict: 'oeuvre_id,action_type_id' })
  if (error) return { error: error.message }
  return readBack(supabase, oeuvreId)
}

/**
 * Drag back to an earlier column (desktop, owner 2026-11-12): the open task of the source column goes
 * (not ticked) and one opens on the target. Onto Cataloguer = back to the Atelier stage (the
 * database reopens Cataloguer, sets En production, clears the finished date with a history line).
 * Forward onto Photographier stays on ✓.
 */
export async function moveBoardTask(oeuvreId: number, fromType: number, toType: number): Promise<BoardResult> {
  if (![oeuvreId, fromType, toType].every(Number.isInteger)) return { error: 'bad_input' }
  if (fromType === toType) return { error: 'same_column' }
  if (toType === PHOTOGRAPH) return { error: 'forward_by_tick' }
  const s = await signedIn()
  if ('error' in s) return s
  const { supabase } = s

  if (toType === CATALOGUE) {
    const { error } = await supabase.from('Oeuvres').update({ 'Catalogué': false }).eq('OeuvreID', oeuvreId)
    if (error) {
      await logError('Production board rewind refused', error, { source: 'production.moveBoardTask', metadata: { oeuvreId, fromType } })
      return { error: error.message }
    }
    if (fromType !== PHOTOGRAPH) {
      const { error: dErr } = await supabase
        .from('work_action').delete().eq('oeuvre_id', oeuvreId).eq('action_type_id', fromType).eq('done', false)
      if (dErr) return { error: dErr.message }
    }
    return readBack(supabase, oeuvreId)
  }

  const { error: dErr } = await supabase
    .from('work_action').delete().eq('oeuvre_id', oeuvreId).eq('action_type_id', fromType).eq('done', false)
  if (dErr) return { error: dErr.message }
  const { error } = await supabase
    .from('work_action')
    .upsert({ oeuvre_id: oeuvreId, action_type_id: toType, done: false }, { onConflict: 'oeuvre_id,action_type_id' })
  if (error) return { error: error.message }
  return readBack(supabase, oeuvreId)
}
