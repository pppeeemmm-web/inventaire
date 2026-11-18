'use server'

// Overview strip — the parts that were missing (Pem 2026-11-18: « why not? »): orders and shipments
// under way, events, and for the admin the system (errors of the last 7 days + the last rule check).
// Head counts only; team guard. The rule-check result needs supabase/sql/work_rule_runs.sql
// (RULE_RUNS_LIVE in lib/overview/signal-strip.ts): until then it stays null.

import { createClient } from '@/lib/supabase/server'
import { getSidebarCounts } from '@/app/atelier/sidebar-counts-actions'
import { RULE_RUNS_LIVE } from '@/lib/overview/signal-strip'

export type OverviewBusiness = {
  orders: number
  shipments: number
  events: number
  /** Admin only, else null. */
  errors7d: number | null
  /** Admin only and once work_rule_run exists, else null. */
  lastRuleRun: { ranAt: string; breaks: number; source: string; error: string | null } | null
}

export async function getOverviewBusiness(): Promise<OverviewBusiness | null> {
  const counts = await getSidebarCounts()
  if ('error' in counts) return null
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')

  let errors7d: number | null = null
  let lastRuleRun: OverviewBusiness['lastRuleRun'] = null
  if (isAdmin === true) {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { count } = await supabase.from('system_log').select('id', { count: 'exact', head: true })
      .eq('event_type', 'RUNTIME_ERROR').gte('created_at', since)
    errors7d = count ?? 0
    if (RULE_RUNS_LIVE) {
      // Table typed once work_rule_runs.sql is applied and types regenerated.
      const { data } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: { ran_at: string; breaks: number; source: string; error: string | null }[] | null }> } } } })
        .from('work_rule_run').select('ran_at, breaks, source, error').order('ran_at', { ascending: false }).limit(1)
      const r = data?.[0]
      if (r) lastRuleRun = { ranAt: r.ran_at, breaks: r.breaks, source: r.source, error: r.error }
    }
  }
  return { orders: counts.orders, shipments: counts.logistics, events: counts.events, errors7d, lastRuleRun }
}
