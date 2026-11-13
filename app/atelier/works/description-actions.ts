'use server'

// A2 (owner 2026-11-13): the local vision model's description of a work, shown in the drawer and
// rated for usefulness (0 useless … 4 spot on; null = not yet judged). Stored apart from the
// owner's text (`work_description`, supabase/sql/work_description_usefulness.sql) — never copied into
// Commentaires. The team may set only `usefulness`; who / when are stamped by a DB trigger.

import { createClient } from '@/lib/supabase/server'

export type WorkDescription = {
  id: number
  engine: string
  prompt: string
  body: string
  echoes: string | null
  createdAt: string
  usefulness: number | null
  ratedAt: string | null
  ratedByName: string | null
  /** Ratings of every description written with the same engine + prompt. */
  promptStats: { rated: number; total: number; avg: number | null }
}

export type DescriptionRating = { usefulness: number | null; prompt: string }

type Err = { error: string }

const PAGE = 1000

async function teamClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null }
  return { error: null, supabase }
}

/** Latest description of the work (its current cover), or null when it was never described. */
export async function getWorkDescription(oeuvreId: number): Promise<WorkDescription | null | Err> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'work' }
  const { error: authErr, supabase } = await teamClient()
  if (!supabase) return { error: authErr }
  const { data: d, error } = await supabase
    .from('work_description')
    .select('id, engine, prompt, body, echoes, created_at, usefulness, rated_at, rated_by')
    .eq('oeuvre_id', oeuvreId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!d) return null

  // PostgREST returns at most 1000 rows per request: count the total, page the ratings.
  const ratings: { usefulness: number | null }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pageErr } = await supabase
      .from('work_description')
      .select('usefulness')
      .eq('engine', d.engine)
      .eq('prompt', d.prompt)
      .not('usefulness', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1)
    if (pageErr) return { error: pageErr.message }
    ratings.push(...(page ?? []))
    if (!page || page.length < PAGE) break
  }
  const [{ count: total }, ratedBy] = await Promise.all([
    supabase.from('work_description').select('id', { count: 'exact', head: true }).eq('engine', d.engine).eq('prompt', d.prompt),
    d.rated_by
      ? supabase.from('Contact').select('*').eq('auth_user_id', d.rated_by).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const scores = ratings.map((r) => r.usefulness).filter((u): u is number => u != null)
  const who = ratedBy.data as { Prénom?: string | null; Nom?: string | null } | null
  const ratedByName = who ? [who.Prénom, who.Nom].filter(Boolean).join(' ').trim() || null : null

  return {
    id: d.id,
    engine: d.engine,
    prompt: d.prompt,
    body: d.body,
    echoes: d.echoes,
    createdAt: d.created_at,
    usefulness: d.usefulness,
    ratedAt: d.rated_at,
    ratedByName,
    promptStats: {
      rated: scores.length,
      total: total ?? scores.length,
      avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    },
  }
}

/** Set (0–4) or clear (null) the usefulness of one description. */
export async function rateWorkDescription(id: number, usefulness: number | null): Promise<{ ok: true } | Err> {
  if (!Number.isInteger(id) || id <= 0) return { error: 'id' }
  if (usefulness != null && !(Number.isInteger(usefulness) && usefulness >= 0 && usefulness <= 4)) return { error: 'value' }
  const { error: authErr, supabase } = await teamClient()
  if (!supabase) return { error: authErr }
  const { data, error } = await supabase.from('work_description').update({ usefulness }).eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'not_found' }
  return { ok: true }
}

/** Reports: the latest description's rating per work (works never described are absent). */
export async function listDescriptionRatings(): Promise<Record<number, DescriptionRating> | Err> {
  const { error: authErr, supabase } = await teamClient()
  if (!supabase) return { error: authErr }
  const out: Record<number, DescriptionRating> = {}
  // Newest first, so the first row seen per work is its latest description. Paged (1000-row cap).
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('work_description')
      .select('oeuvre_id, prompt, usefulness')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) return { error: error.message }
    for (const r of data ?? []) {
      if (!out[r.oeuvre_id]) out[r.oeuvre_id] = { usefulness: r.usefulness, prompt: r.prompt }
    }
    if (!data || data.length < PAGE) break
  }
  return out
}
