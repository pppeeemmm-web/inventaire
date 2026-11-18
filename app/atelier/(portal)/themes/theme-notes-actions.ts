'use server'

// Theme notes (TODO 23). Team reads and writes through RLS (theme: select true / team update is_team()).
// Notes stay out of the public site: theme_notes.sql PART 2 limits anon to id + name.
// Behind THEME_NOTES_SQL_LIVE until the lead applies supabase/sql/theme_notes.sql: both actions return
// `sql_waiting` and touch nothing.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { THEME_NOTES_MAX, THEME_NOTES_SQL_LIVE } from '@/lib/theme-notes'

type Err = { error: string }

// `notes` is not in lib/types/supabase.generated.ts until the SQL runs + `npm run gen:types`.
// This narrow shape stands in for it; replace with the generated table type afterwards.
type ThemeNotesTable = {
  select(cols: 'id, notes'): PromiseLike<{
    data: { id: number; notes: string | null }[] | null
    error: { message: string } | null
  }>
  update(v: { notes: string | null }): {
    eq(col: 'id', id: number): PromiseLike<{ error: { message: string } | null }>
  }
}

async function teamClient(): Promise<{ error: 'auth' | 'team_only' } | { table: ThemeNotesTable }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (isTeam !== true) return { error: 'team_only' }
  return { table: supabase.from('theme') as unknown as ThemeNotesTable }
}

/** Notes of every theme that has some, keyed by theme id. */
export async function loadThemeNotes(): Promise<{ notes: Record<number, string> } | Err> {
  if (!THEME_NOTES_SQL_LIVE) return { error: 'sql_waiting' }
  const who = await teamClient()
  if (!('table' in who)) return { error: who.error }
  const { data, error } = await who.table.select('id, notes')
  if (error) return { error: error.message }
  const notes: Record<number, string> = {}
  for (const r of data ?? []) {
    if (r.notes && r.notes.trim()) notes[r.id] = r.notes
  }
  return { notes }
}

/** Saves one theme's notes. Empty text clears them. */
export async function saveThemeNotes(id: number, text: string): Promise<{ ok: true; notes: string | null } | Err> {
  if (!THEME_NOTES_SQL_LIVE) return { error: 'sql_waiting' }
  if (!Number.isInteger(id) || id <= 0) return { error: 'bad_id' }
  const trimmed = text.trim()
  if (trimmed.length > THEME_NOTES_MAX) return { error: 'too_long' }
  const notes = trimmed || null
  const who = await teamClient()
  if (!('table' in who)) return { error: who.error }
  const { error } = await who.table.update({ notes }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atelier/themes')
  return { ok: true, notes }
}
