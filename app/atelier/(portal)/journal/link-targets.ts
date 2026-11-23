'use server'

// One picker for `#` (a work or an idea) and `@` (a person), wherever text is typed (principle 13).
// Reads only. Contact RLS lets the team read private cards; this search drops them for non-admins. Team only.

import { createClient } from '@/lib/supabase/server'
import { contactListLabel } from '@/lib/contacts/contact-display'

export type LinkTarget = { kind: 'oeuvre' | 'concept' | 'contact'; id: number | string; label: string; thumb?: string | null }

const MAX_RESULTS = 8
const byLabel = (a: LinkTarget, b: LinkTarget) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })

/** Characters that would change an ilike pattern or break an `.or()` filter. */
function clean(q: string): string {
  return q.replace(/[%_,()\\*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

export async function searchLinkTargets(kind: 'hash' | 'at', q: string): Promise<LinkTarget[]> {
  const term = clean(String(q ?? ''))
  if (kind !== 'hash' && kind !== 'at') return []
  const digits = kind === 'hash' && /^\d{1,9}$/.test(term)
  if (!digits && term.length < 1) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return []

  if (kind === 'at') {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    let query = supabase
      .from('Contact')
      .select('ContactID, "Prénom", Nom, NomInstitution')
      .or(`"Prénom".ilike.%${term}%,Nom.ilike.%${term}%,NomInstitution.ilike.%${term}%`)
      .is('archived_at', null)
    // Team RLS can read private cards; only an admin may see their names.
    if (!isAdmin) query = query.or('is_private.is.null,is_private.eq.false')
    const { data } = await query.limit(MAX_RESULTS)
    return (data ?? [])
      .map((c) => ({
        kind: 'contact' as const,
        id: c.ContactID,
        label: contactListLabel({ Prénom: c.Prénom, Nom: c.Nom, NomInstitution: c.NomInstitution }),
      }))
      .sort(byLabel)
  }

  const out: LinkTarget[] = []
  if (digits) {
    const { data } = await supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').eq('OeuvreID', Number(term)).is('deleted_at', null).limit(1)
    for (const w of data ?? []) {
      out.push({ kind: 'oeuvre', id: w.OeuvreID, label: w.Titre?.trim() || `#${w.OeuvreID}`, thumb: w.txtImageNameLink ?? null })
    }
  }
  if (!digits) {
    const [works, ideas] = await Promise.all([
      supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').ilike('Titre', `%${term}%`).is('deleted_at', null).limit(5),
      supabase.from('concept').select('id, titre').ilike('titre', `%${term}%`).limit(5),
    ])
    for (const w of works.data ?? []) {
      out.push({ kind: 'oeuvre', id: w.OeuvreID, label: w.Titre?.trim() || `#${w.OeuvreID}`, thumb: w.txtImageNameLink ?? null })
    }
    out.sort(byLabel)
    const found: LinkTarget[] = (ideas.data ?? []).map((c) => ({ kind: 'concept' as const, id: c.id, label: c.titre }))
    out.push(...found.sort(byLabel))
  }
  return out.slice(0, MAX_RESULTS)
}
