'use server'

// R3 step 3 — phone recording drawer (docs/design/2026-11-16/WorkCard.notes.md « Phone recording drawer »).
// Read-only lookup for « Reprise d'une œuvre » and « peinte sur l'ancien support de… »: a work by
// number (« 2233 », « #2233 ») or by title. Team reads (RLS on Oeuvres).

import { createClient } from '@/lib/supabase/server'

export type RecordWorkHit = {
  id: number
  title: string | null
  /** Cover file (`txtImageNameLink`) — the client builds the URL with `thumbUrl()`. */
  cover: string | null
  year: string | null
}

export async function searchWorksForRecord(query: string): Promise<{ hits: RecordWorkHit[] } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const q = query.trim().replace(/^#/, '').slice(0, 80)
  if (!q) return { hits: [] }
  const base = supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink, "Année"').is('deleted_at', null)
  const res = /^\d{1,7}$/.test(q)
    ? await base.eq('OeuvreID', Number(q)).limit(1)
    : await base.ilike('Titre', `%${q.replace(/[%_]/g, '')}%`).order('OeuvreID', { ascending: false }).limit(12)
  if (res.error) return { error: res.error.message }
  return {
    hits: (res.data ?? []).map((r) => ({
      id: r.OeuvreID as number,
      title: (r.Titre as string | null) ?? null,
      cover: (r.txtImageNameLink as string | null) ?? null,
      year: r['Année'] ? String(r['Année']).slice(0, 4) : null,
    })),
  }
}
