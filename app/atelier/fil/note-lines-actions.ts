'use server'

// R1 step 6 slice 4b (docs/design/2026-11-17/R1_InputsFeed.notes.md, open question 3 « Chosen: (a)
// separate lines »): a comment on a work is one note_line (target 'work'), with author + date, live at
// once; Pem's Fil reads it. Append-only (supabase/sql/r1_feed.sql): no edit, no delete here.
// RLS hides a line Pem took out of the Fil from everyone but Pem and its author — that is the
// author's notification, read by `listMyNoteLines` in their Overview « Pour vous ».

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

export type WorkNoteLine = {
  id: number
  body: string
  author: string | null
  createdAt: string
  flagged: boolean
  /** Taken out of the Fil by Pem: only Pem and the author still see it (RLS). */
  discarded: boolean
  mine: boolean
}

export type MyNoteLine = {
  id: number
  kind: 'work' | 'idea' | 'proposal'
  body: string
  createdAt: string
  flagged: boolean
  /** When Pem took it out of the Fil (null = still standing). */
  discardedAt: string | null
  work: { id: number; title: string | null } | null
  idea: { id: string; title: string } | null
}

type Err = { error: string }
type Supa = Awaited<ReturnType<typeof createClient>>

const BODY_MAX = 20000

async function gateTeam(): Promise<{ supabase: Supa; userId: string } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (isTeam !== true) return { error: 'team' }
  return { supabase, userId: user.id }
}

async function namesFor(supabase: Supa, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (!ids.length) return names
  // `select('*')`: the typed select parser rejects the accented `Prénom` column name.
  const { data } = await supabase.from('Contact').select('*').in('auth_user_id', ids)
  for (const c of (data ?? []) as { auth_user_id: string | null; Prénom: string | null; Nom: string | null }[]) {
    if (c.auth_user_id) names.set(c.auth_user_id, [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—')
  }
  return names
}

/** A work's lines the reader may see, oldest first. */
export async function listWorkNoteLines(oeuvreId: number): Promise<{ lines: WorkNoteLine[] } | Err> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'work' }
  const g = await gateTeam()
  if ('error' in g) return g
  const { supabase, userId } = g
  const { data, error } = await supabase
    .from('note_line')
    .select('id, body, author_id, created_at, flagged_for_pem, discarded_at')
    .eq('target_kind', 'work')
    .eq('oeuvre_id', oeuvreId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) {
    await logError('work note lines list failed', error, { source: 'note-lines.listWorkNoteLines', metadata: { oeuvreId } })
    return { error: error.message }
  }
  const rows = data ?? []
  const names = await namesFor(supabase, [...new Set(rows.map((r) => r.author_id).filter((x): x is string => !!x))])
  return {
    lines: rows.map((r) => ({
      id: r.id,
      body: r.body,
      author: r.author_id ? names.get(r.author_id) ?? null : null,
      createdAt: r.created_at,
      flagged: r.flagged_for_pem,
      discarded: r.discarded_at != null,
      mine: r.author_id === userId,
    })),
  }
}

/** Anyone on the team adds a line to a work, live at once. `flagForPem` = the « Une idée pour Pem ? » nudge. */
export async function addWorkNoteLine(oeuvreId: number, body: string, flagForPem: boolean): Promise<{ ok: true; line: WorkNoteLine } | Err> {
  const text = body.trim()
  if (!text) return { error: 'empty' }
  if (text.length > BODY_MAX) return { error: 'long' }
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'work' }
  const g = await gateTeam()
  if ('error' in g) return g
  const { supabase, userId } = g

  // Pem's own lines never enter his Fil: the flag means nothing on them.
  const { data: isAdmin } = await supabase.rpc('is_admin')
  const flagged = flagForPem && isAdmin !== true

  const { data, error } = await supabase
    .from('note_line')
    .insert({ target_kind: 'work', oeuvre_id: oeuvreId, body: text, author_id: userId, flagged_for_pem: flagged })
    .select('id, body, created_at, flagged_for_pem')
    .single()
  if (error || !data) {
    if (error) await logError('work note line insert failed', error, { source: 'note-lines.addWorkNoteLine', metadata: { oeuvreId } })
    return { error: error?.message ?? 'insert' }
  }
  const names = await namesFor(supabase, [userId])
  revalidatePath('/hub/fil')
  return {
    ok: true,
    line: {
      id: data.id,
      body: data.body,
      author: names.get(userId) ?? null,
      createdAt: data.created_at,
      flagged: data.flagged_for_pem,
      discarded: false,
      mine: true,
    },
  }
}

/** A team member's own lines (works, ideas, proposals), newest first, with what happened to each. */
export async function listMyNoteLines(limit = 60): Promise<{ lines: MyNoteLine[] } | Err> {
  const g = await gateTeam()
  if ('error' in g) return g
  const { supabase, userId } = g
  const { data, error } = await supabase
    .from('note_line')
    .select('id, target_kind, oeuvre_id, concept_id, body, created_at, flagged_for_pem, discarded_at')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)))
  if (error) {
    await logError('my note lines list failed', error, { source: 'note-lines.listMyNoteLines' })
    return { error: error.message }
  }
  const rows = data ?? []
  const workIds = [...new Set(rows.map((r) => r.oeuvre_id).filter((x): x is number => typeof x === 'number'))]
  const ideaIds = [...new Set(rows.map((r) => r.concept_id).filter((x): x is string => !!x))]
  const [worksRes, ideasRes] = await Promise.all([
    workIds.length ? supabase.from('Oeuvres').select('OeuvreID, Titre').in('OeuvreID', workIds) : Promise.resolve({ data: [] as Array<{ OeuvreID: number; Titre: string | null }> }),
    ideaIds.length ? supabase.from('concept').select('id, titre').in('id', ideaIds) : Promise.resolve({ data: [] as Array<{ id: string; titre: string }> }),
  ])
  const workTitle = new Map((worksRes.data ?? []).map((w) => [w.OeuvreID, w.Titre]))
  const ideaTitle = new Map((ideasRes.data ?? []).map((c) => [c.id, c.titre]))
  return {
    lines: rows.map((r) => ({
      id: r.id,
      kind: r.target_kind === 'idea' ? 'idea' : r.target_kind === 'proposal' ? 'proposal' : 'work',
      body: r.body,
      createdAt: r.created_at,
      flagged: r.flagged_for_pem,
      discardedAt: r.discarded_at,
      work: r.oeuvre_id != null ? { id: r.oeuvre_id, title: workTitle.get(r.oeuvre_id) ?? null } : null,
      idea: r.concept_id ? { id: r.concept_id, title: ideaTitle.get(r.concept_id) ?? '' } : null,
    })),
  }
}
