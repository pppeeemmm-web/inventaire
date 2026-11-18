'use server'

// Sidebar badges for work that is under way (Pem 2026-11-18): open orders, works with an open task
// (Production), open Pipeline processes, events planned or running, shipments not delivered.
// Head counts only (one small read each); team guard; 0 = no badge.

import { createClient } from '@/lib/supabase/server'
import { fromSuiviProcess } from '@/lib/pipeline/suivi-client'
import { EVENT_KINDS } from '@/lib/events/event-model'
import { ORDER_FINISHED } from '@/lib/orders/kinds'

export type SidebarCounts = { orders: number; production: number; pipeline: number; events: number; logistics: number }

/** A process that is over: won, lost, finished, cancelled. */
const PROCESS_CLOSED = ['termine', 'gagne', 'perdu', 'annule']

export async function getSidebarCounts(): Promise<SidebarCounts | { error: string }> {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' }

  const eventKinds = `(${EVENT_KINDS.join(',')})`
  const [orders, tasks, pipeline, events, shipments] = await Promise.all([
    supabase.from('work_order').select('id', { count: 'exact', head: true })
      .eq('reconstituted', false).not('status', 'in', `(${ORDER_FINISHED.join(',')})`),
    supabase.from('work_action').select('oeuvre_id').eq('done', false).is('paused_at', null).limit(5000),
    fromSuiviProcess(supabase).select('id', { count: 'exact', head: true })
      .not('type', 'in', eventKinds).not('statut', 'in', `(${PROCESS_CLOSED.join(',')})`),
    fromSuiviProcess(supabase).select('id', { count: 'exact', head: true })
      .in('type', [...EVENT_KINDS]).in('statut', ['prevue', 'en_cours']),
    supabase.from('shipment').select('id', { count: 'exact', head: true }).not('status', 'in', '(delivered,cancelled)'),
  ])
  const err = orders.error ?? tasks.error ?? pipeline.error ?? events.error ?? shipments.error
  if (err) return { error: err.message }

  return {
    orders: orders.count ?? 0,
    production: new Set((tasks.data ?? []).map((r) => r.oeuvre_id)).size,
    pipeline: pipeline.count ?? 0,
    events: events.count ?? 0,
    logistics: shipments.count ?? 0,
  }
}
