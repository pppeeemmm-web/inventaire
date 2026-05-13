'use server'

import { createClient } from '@/lib/supabase/server'

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

export type ShipmentSimpleResult = { error: string } | { ok: true }

/**
 * Mark a shipment delivered. When `shipment.sale_order_id` is set (migration),
 * DB trigger syncs `sale_order.return_window_starts_at` + `delivered`.
 */
export async function markShipmentDelivered(shipmentId: string): Promise<ShipmentSimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('shipment')
    .update({
      status: 'delivered',
      delivered_at: now,
    })
    .eq('id', shipmentId)

  if (error) return { error: error.message }
  return { ok: true }
}
