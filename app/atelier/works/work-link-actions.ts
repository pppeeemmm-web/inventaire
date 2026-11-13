'use server'

// Work ↔ work links from the drawer (agreed in principle, docs/archive/JOURNAL_PROPOSAL.md "Work or
// version"): a full cover = new work "painted on" the old one; a new support = "derived from";
// a reply = "answers"; plus the Constellation's own types. Stored in `tblrelations` (source = this
// work, target = the other), written like the Constellation does. Human links only.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { deleteConstellationRelation, insertConstellationRelation } from '@/app/atelier/(portal)/constellation/actions'
import { WORK_LINK_TYPES, type WorkLinkType } from '@/lib/work-links'


export type WorkLink = {
  id: string
  type: string
  /** 'out' = this work → other (e.g. this one is painted on #other). */
  dir: 'out' | 'in'
  other: { id: number; title: string | null }
}
type Err = { error: string }

export async function listWorkLinks(oeuvreId: number): Promise<WorkLink[] | Err> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tblrelations')
    .select('id, source_id, target_id, relation_type')
    .in('relation_type', [...WORK_LINK_TYPES])
    .or(`source_id.eq.${oeuvreId},target_id.eq.${oeuvreId}`)
  if (error) return { error: error.message }
  const rows = (data ?? []).filter((r) => r.source_id != null && r.target_id != null)
  const otherIds = [...new Set(rows.map((r) => (r.source_id === oeuvreId ? r.target_id : r.source_id) as number))]
  const titles = new Map<number, string | null>()
  if (otherIds.length) {
    const { data: works } = await supabase.from('Oeuvres').select('OeuvreID, Titre').in('OeuvreID', otherIds)
    for (const w of works ?? []) titles.set(w.OeuvreID, w.Titre)
  }
  return rows.map((r) => {
    const out = r.source_id === oeuvreId
    const other = (out ? r.target_id : r.source_id) as number
    return { id: r.id, type: r.relation_type ?? '', dir: out ? 'out' : 'in', other: { id: other, title: titles.get(other) ?? null } }
  })
}

export async function addWorkLink(oeuvreId: number, otherId: number, type: WorkLinkType): Promise<{ ok: true } | Err> {
  if (!WORK_LINK_TYPES.includes(type)) return { error: 'type' }
  if (!Number.isInteger(otherId) || otherId <= 0 || otherId === oeuvreId) return { error: 'work' }
  const supabase = await createClient()
  const { data: other } = await supabase.from('Oeuvres').select('OeuvreID').eq('OeuvreID', otherId).maybeSingle()
  if (!other) return { error: 'work_not_found' }
  const res = await insertConstellationRelation({ source_id: oeuvreId, target_id: otherId, relation_type: type })
  if ('error' in res) return { error: res.error }
  revalidatePath('/atelier/constellation')
  return { ok: true }
}

export async function removeWorkLink(relationId: string): Promise<{ ok: true } | Err> {
  const res = await deleteConstellationRelation(relationId)
  if ('error' in res && res.error) return { error: res.error }
  revalidatePath('/atelier/constellation')
  return { ok: true }
}
