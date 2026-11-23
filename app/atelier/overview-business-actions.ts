'use server'

// Overview strip — the parts that were missing (Pem 2026-11-18: « why not? »): orders and shipments
// under way, events, and for the admin the system (errors of the last 7 days + the last rule check).
// Head counts only; team guard. The rule-check result needs supabase/sql/work_rule_runs.sql
// (applied 2026-11-18, RULE_RUNS_LIVE in lib/overview/signal-strip.ts).

import { createClient } from '@/lib/supabase/server'
import { getSidebarCounts } from '@/app/atelier/sidebar-counts-actions'
import { RULE_RUNS_LIVE } from '@/lib/overview/signal-strip'

export type OverviewBusiness = {
  orders: number
  /** Boxes still to send: not « Expédié », « Livré » or « Annulé » (stress test round 3 — the sidebar
   *  Logistique badge also counts boxes already on their way; this one does not). */
  shipments: number
  events: number
  /** Works at a place their holder is not linked to (`oeuvre_place_unlinked`, Places phase B — flagged, never moved). */
  placeUnlinked: number
  /** Admin only, else null. */
  errors7d: number | null
  /** Admin only and once work_rule_run exists, else null. */
  lastRuleRun: { ranAt: string; breaks: number; source: string; error: string | null } | null
}

/** A box already on its way or finished — nothing left to do before it goes (same rule as `notGone` in
 *  app/atelier/(portal)/sales/cascade-actions.ts). */
const SHIPMENT_GONE = ['shipped', 'delivered', 'cancelled']

export async function getOverviewBusiness(): Promise<OverviewBusiness | null> {
  const counts = await getSidebarCounts()
  if ('error' in counts) return null
  const supabase = await createClient()
  const [{ data: isAdmin }, toShip, unlinked] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.from('shipment').select('id', { count: 'exact', head: true }).not('status', 'in', `(${SHIPMENT_GONE.join(',')})`),
    supabase.from('oeuvre_place_unlinked').select('oeuvre_id', { count: 'exact', head: true }),
  ])

  // A failed count must not read as « 0 envoi » (flow review): the Overview shows « … » instead.
  if (toShip.error || unlinked.error) return null

  let errors7d: number | null = null
  let lastRuleRun: OverviewBusiness['lastRuleRun'] = null
  if (isAdmin === true) {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { count } = await supabase.from('system_log').select('id', { count: 'exact', head: true })
      .eq('event_type', 'RUNTIME_ERROR').gte('created_at', since)
    errors7d = count ?? 0
    if (RULE_RUNS_LIVE) {
      const { data } = await supabase.from('work_rule_run').select('ran_at, breaks, source, error').order('ran_at', { ascending: false }).limit(1)
      const r = data?.[0]
      if (r) lastRuleRun = { ranAt: r.ran_at, breaks: r.breaks, source: r.source, error: r.error }
    }
  }
  return { orders: counts.orders, shipments: toShip.count ?? 0, events: counts.events, placeUnlinked: unlinked.count ?? 0, errors7d, lastRuleRun }
}
