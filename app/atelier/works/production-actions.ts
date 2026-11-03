'use server'

// Production start date, set by hand (owner 2026-11-03). The end date stays automatic
// (supabase/sql/oeuvres_production_span.sql: ticking Catalogué or archiving ends production).
// Admin only, like other direct edits to an existing work; the trigger refuses a start after the end.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

type Result = { ok: true; startedOn: string | null } | { error: string }

export async function setProductionStart(oeuvreId: number, day: string | null): Promise<Result> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'oeuvre_id' }
  const value = day?.trim() || null
  if (value !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return { error: 'date' }
    const year = Number(value.slice(0, 4))
    if (year < 1900 || year > 2200) return { error: 'date' }
  }

  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'admin_only' }

  const { error } = await supabase
    .from('Oeuvres')
    .update({ production_started_on: value })
    .eq('OeuvreID', oeuvreId)
  if (error) {
    if (error.message.includes('before production_started_on')) return { error: 'start_after_end' }
    await logError('Production start update failed', error, { source: 'production.setProductionStart', metadata: { oeuvreId } })
    return { error: error.message }
  }
  revalidatePath('/atelier')
  return { ok: true, startedOn: value }
}
