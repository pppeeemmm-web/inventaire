'use server'

import { createClient } from '@/lib/supabase/server'

export type AtelierResearchRemoteResult = {
  id: string
  kind: 'process' | 'voice_note'
  label: string
  detail: string | null
  processType?: string | null
}

export type AtelierResearchResult =
  | { ok: true; results: AtelierResearchRemoteResult[] }
  | { error: string }

function compactText(value: string | null | undefined, max = 80): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function searchPattern(query: string): string {
  const safe = query.replace(/[%_\\]/g, (m) => `\\${m}`)
  return `%${safe}%`
}

async function guardTeam() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null }
  return { error: null, supabase }
}

export async function searchAtelierResearchSummaries(
  query: string,
  limit = 6,
): Promise<AtelierResearchResult> {
  const q = query.trim().slice(0, 80)
  if (q.length < 2) return { ok: true, results: [] }

  const { error, supabase } = await guardTeam()
  if (error || !supabase) return { error: error ?? 'forbidden' }

  const lim = Math.min(Math.max(limit, 1), 10)
  const pattern = searchPattern(q)

  const [processRes, noteSubjectRes, noteTranscriptRes] = await Promise.all([
    supabase
      .from('suivi_process')
      .select('id, nom, type, statut, localisation, date_debut, date_fin, updated_at')
      .ilike('nom', pattern)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(lim),
    supabase
      .from('voice_note')
      .select('id, subject, transcript, kind, bucket, created_at')
      .ilike('subject', pattern)
      .order('created_at', { ascending: false })
      .limit(lim),
    supabase
      .from('voice_note')
      .select('id, subject, transcript, kind, bucket, created_at')
      .ilike('transcript', pattern)
      .order('created_at', { ascending: false })
      .limit(lim),
  ])

  if (processRes.error) return { error: processRes.error.message }
  if (noteSubjectRes.error) return { error: noteSubjectRes.error.message }
  if (noteTranscriptRes.error) return { error: noteTranscriptRes.error.message }

  const results: AtelierResearchRemoteResult[] = []
  for (const p of (processRes.data ?? []) as {
    id: string
    nom: string | null
    type: string | null
    statut: string | null
    localisation: string | null
    date_debut: string | null
    date_fin: string | null
  }[]) {
    const dates = [p.date_debut, p.date_fin].filter(Boolean).join(' - ')
    const detail = [p.type, p.statut, p.localisation, dates].filter(Boolean).join(' / ')
    results.push({
      id: p.id,
      kind: 'process',
      label: compactText(p.nom, 100) ?? p.id,
      detail: compactText(detail, 120),
      processType: p.type,
    })
  }

  const seenNotes = new Set<string>()
  const noteRows = [...(noteSubjectRes.data ?? []), ...(noteTranscriptRes.data ?? [])] as {
    id: string
    subject: string | null
    transcript: string | null
    kind: string | null
    bucket: string | null
  }[]
  for (const note of noteRows) {
    if (seenNotes.has(note.id)) continue
    seenNotes.add(note.id)
    if (seenNotes.size > lim) break
    results.push({
      id: note.id,
      kind: 'voice_note',
      label: compactText(note.subject, 100) ?? compactText(note.transcript, 100) ?? note.id,
      detail: compactText([note.kind, note.bucket].filter(Boolean).join(' / '), 80),
    })
  }

  return { ok: true, results }
}
