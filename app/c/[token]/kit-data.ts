import 'server-only'

// Collector kit — server-side read for /c/<token>, its PDF route and its enquiry action.
// Token check with the SERVICE ROLE (anon reads nothing on private_link). Never send the collector's email
// to the page: anyone holding the link would see it.

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { thumbUrl, imageUrl, yearOf } from '@/lib/data'
import {
  kitAvailability,
  kitSize,
  type KitAvailability,
  type KitLang,
} from '@/lib/collector-kit'

export const KIT_TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/

export interface KitLinkRow {
  token: string
  contact_id: number | null
  recipient_name: string | null
  lang: string
  message: string | null
  expires_at: string | null
  revoked_at: string | null
  pdf_key: string | null
}

/** null = unknown token; 'inactive' = revoked or expired (the neutral page). */
export async function readKitLink(token: string): Promise<KitLinkRow | 'inactive' | null> {
  if (!KIT_TOKEN_RE.test(token)) return null
  const sb = createServiceClient()
  const { data }: { data: KitLinkRow | null } = await sb
    .from('private_link')
    .select('token, contact_id, recipient_name, lang, message, expires_at, revoked_at, pdf_key')
    .eq('token', token)
    .maybeSingle()
  if (!data) return null
  if (data.revoked_at) return 'inactive'
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return 'inactive'
  return data
}

export interface KitPageWork {
  oeuvreId: number
  title: string | null
  year: number | null
  technique: string | null
  size: string
  image: string | null
  thumb: string | null
  /** Only when ticked at creation — the snapshot, not today's catalogue price. */
  price: number | null
  availability: KitAvailability
}

type KitLineRow = { oeuvre_id: number; position: number; show_price: boolean; price: number | string | null }
type KitWorkRow = {
  OeuvreID: number
  Titre: string | null
  Année: string | null
  Hauteur: string | null
  Largeur: string | null
  Profondeur: string | null
  txtImageNameLink: string | null
  Technique: number | null
  statusId: number | null
  is_public: boolean | null
  deleted_at: string | null
}

/** The kit's frozen works, in order. A work no longer public (archived, destroyed…) is left out. */
export async function readKitWorks(token: string): Promise<KitPageWork[]> {
  const sb = createServiceClient()
  const { data: lines }: { data: KitLineRow[] | null } = await sb
    .from('private_link_work')
    .select('oeuvre_id, position, show_price, price')
    .eq('token', token)
    .order('position')
  const ids = (lines ?? []).map((l) => l.oeuvre_id)
  if (!ids.length) return []
  const [{ data: works }, { data: techs }]: [{ data: KitWorkRow[] | null }, { data: { TechniqueID: number; Technique: string | null }[] | null }] = await Promise.all([
    sb.from('Oeuvres')
      .select('OeuvreID, Titre, "Année", Hauteur, Largeur, Profondeur, txtImageNameLink, Technique, statusId, is_public, deleted_at')
      .in('OeuvreID', ids),
    sb.from('Technique').select('TechniqueID, Technique'),
  ])
  const techName = new Map((techs ?? []).map((t) => [t.TechniqueID, t.Technique]))
  const byId = new Map((works ?? []).map((w) => [w.OeuvreID, w]))
  return (lines ?? []).flatMap((l) => {
    const w = byId.get(l.oeuvre_id)
    if (!w || !w.is_public || w.deleted_at) return []
    return [{
      oeuvreId: w.OeuvreID,
      title: w.Titre,
      year: yearOf(w['Année']),
      technique: w.Technique != null ? (techName.get(w.Technique) ?? null) : null,
      size: kitSize(w),
      image: imageUrl(w.txtImageNameLink),
      thumb: thumbUrl(w.txtImageNameLink),
      price: l.show_price && l.price != null ? Number(l.price) : null,
      availability: kitAvailability(w.statusId),
    }]
  })
}

/** A signed-in team member previewing the kit (or its PDF) is not counted as the collector opening it. */
export async function isTeamViewer(): Promise<boolean> {
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return false
    const { data } = await sb.rpc('is_team')
    return Boolean(data)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- no session cookie readable: treat as a visitor (counted)
  } catch {
    return false
  }
}

export function kitLang(row: { lang: string }, override: string | string[] | undefined): KitLang {
  if (override === 'en' || override === 'fr') return override
  return row.lang === 'en' ? 'en' : 'fr'
}
