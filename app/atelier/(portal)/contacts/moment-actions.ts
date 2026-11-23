'use server'

// One door for a touch (« moment », People.md §4): save_moment writes all or nothing and tells the truth.

import { createClient } from '@/lib/supabase/server'

export type MomentKind = 'call' | 'studio_visit' | 'meeting' | 'mail_in' | 'mail_out' | 'introduction' | 'press' | 'thanks' | 'other'
export type MomentInput = {
  corrects?: number | null
  happenedOn: string
  precision?: 'day' | 'month' | 'year'
  kind: MomentKind
  channel?: string | null
  summary: string
  isPrivate?: boolean
  people: { contactId: number; role?: string | null }[]
  works: number[]
}
export type MomentSaveResult = { ok: true; id: number } | { refused: string; detail?: string }

export async function saveMoment(input: MomentInput): Promise<MomentSaveResult> {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { refused: 'forbidden' }
  const { data, error } = await supabase.rpc('save_moment', {
    p: {
      corrects: input.corrects ?? null,
      happened_on: input.happenedOn,
      precision: input.precision ?? 'day',
      kind: input.kind,
      channel: input.channel ?? null,
      summary: input.summary,
      is_private: input.isPrivate ?? false,
      people: input.people.map((x) => ({ contact_id: x.contactId, role: x.role ?? null })),
      works: input.works,
    },
  })
  if (error) return { refused: 'error', detail: error.message }
  const r = (data ?? {}) as { ok?: boolean; id?: number; refused?: string; detail?: string }
  if (r.ok && typeof r.id === 'number') return { ok: true, id: r.id }
  return { refused: r.refused ?? 'error', detail: r.detail }
}
