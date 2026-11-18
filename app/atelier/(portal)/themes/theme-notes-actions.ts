'use server'

// Theme notes (TODO 23). Team reads and writes through RLS (theme: select true / team update is_team()).
// Notes stay out of the public site: theme_notes.sql PART 2 limits anon to id + name (applied 2026-11-18).
// Behind THEME_NOTES_SQL_LIVE: both actions return `sql_waiting` and touch nothing when it is false.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { THEME_NOTES_MAX, THEME_NOTES_SQL_LIVE } from '@/lib/theme-notes'

type Err = { error: string }

async function teamClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (isTeam !== true) return { error: 'team_only' as const, supabase: null }
  return { error: null, supabase }
}

/** Notes of every theme that has some, keyed by theme id. */
export async function loadThemeNotes(): Promise<{ notes: Record<number, string> } | Err> {
  if (!THEME_NOTES_SQL_LIVE) return { error: 'sql_waiting' }
  const { error: authErr, supabase } = await teamClient()
  if (authErr || !supabase) return { error: authErr ?? 'auth' }
  const { data, error } = await supabase.from('theme').select('id, notes').not('notes', 'is', null)
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
  const { error: authErr, supabase } = await teamClient()
  if (authErr || !supabase) return { error: authErr ?? 'auth' }
  const { error } = await supabase.from('theme').update({ notes }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atelier/themes')
  return { ok: true, notes }
}
