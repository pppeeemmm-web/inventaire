'use server'

// Phone menu sheet (docs/design/2026-11-18/PhoneNav.notes.md, option A): the tile counts, the account
// line and the « #numéro ou titre » search. Read when the sheet first opens, never on first paint.
// Head counts only, team guard (RLS still applies). The Fil count is its own call: `countFil` reads the
// whole Fil (admin only), so the other tiles never wait on it.

import { createClient } from '@/lib/supabase/server'
import { getSidebarCounts, type SidebarCounts } from '@/app/atelier/sidebar-counts-actions'
import { countFil } from '@/app/atelier/fil/actions'
import { getSessionUserDisplay } from '@/lib/session-user'
import { kaizenUnseenCounts } from '@/app/atelier/(portal)/kaizen/actions'

export type PhoneMenuData = SidebarCounts & {
  works: number
  ideas: number
  ripe: number
  /** Shipments on the road (status `shipped`) — the tile's « n en route ». `logistics` (from SidebarCounts)
   *  is every shipment not delivered, boxes still being prepared included (stress test 2026-11-18). */
  inTransit: number
  /** Kaizen « opérationnel » entries others added since I last opened it — the desktop sidebar's count. */
  kaizenOps: number
  isAdmin: boolean
  name: string
}

export async function getPhoneMenuData(): Promise<PhoneMenuData | { error: string }> {
  const supabase = await createClient()
  const [{ data: isTeam }, { data: isAdmin }] = await Promise.all([supabase.rpc('is_team'), supabase.rpc('is_admin')])
  if (!isTeam) return { error: 'forbidden' }
  const [under, works, ideas, ripe, who, kaizen, transit] = await Promise.all([
    getSidebarCounts(),
    supabase.from('Oeuvres').select('OeuvreID', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('concept').select('id', { count: 'exact', head: true }),
    supabase.from('concept').select('id', { count: 'exact', head: true }).eq('maturity', 'mure'),
    getSessionUserDisplay(),
    kaizenUnseenCounts().catch(() => ({ error: 'kaizen' })),
    supabase.from('shipment').select('id', { count: 'exact', head: true }).eq('status', 'shipped'),
  ])
  if ('error' in under) return under
  const err = works.error ?? ideas.error ?? ripe.error ?? transit.error
  if (err) return { error: err.message }
  return {
    ...under,
    works: works.count ?? 0,
    ideas: ideas.count ?? 0,
    ripe: ripe.count ?? 0,
    inTransit: transit.count ?? 0,
    kaizenOps: 'error' in kaizen ? 0 : kaizen.ops,
    isAdmin: isAdmin === true,
    name: who.fullName || who.displayName,
  }
}

/** Fil tile « n à trier »; null = not admin or the read failed (the tile then shows no number). */
export async function getPhoneMenuFilCount(): Promise<number | null> {
  return countFil().catch(() => null)
}

export type MenuWork = { id: number; title: string | null; thumb: string | null }

/** « 120 », « #120 » → that number; otherwise a title match. Team only (RLS). */
export async function searchMenuWorks(q: string): Promise<MenuWork[]> {
  const term = q.trim().replace(/^#/, '').trim()
  if (!term) return []
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return []
  let query = supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').is('deleted_at', null).limit(8)
  query = /^\d+$/.test(term) ? query.eq('OeuvreID', Number(term)) : query.ilike('Titre', `%${term.replace(/[%_]/g, '')}%`)
  const { data } = await query.order('OeuvreID', { ascending: false })
  return (data ?? []).map((w) => ({ id: w.OeuvreID, title: w.Titre, thumb: w.txtImageNameLink }))
}
