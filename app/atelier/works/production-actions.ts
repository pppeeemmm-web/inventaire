'use server'

// Production start / end set by hand (start: owner 2026-11-03; end + partial dates: TODO 3–4,
// 2026-11-14). A date is a year, a month or a day ("2021", "06/2024", "22/08/2026"), stored like
// "Année" with a precision column (supabase/sql/oeuvres_production_precision.sql). Ticking Catalogué
// still writes the end as today (trigger). Admin only, like other direct edits to an existing work;
// the trigger refuses an end before the start.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { parseStepDate, type DatePrecision } from '@/lib/work-periods'

type Result = { ok: true; on: string | null; precision: DatePrecision | null } | { error: string }

export async function setProductionDate(oeuvreId: number, which: 'start' | 'end', input: string): Promise<Result> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'oeuvre_id' }
  if (which !== 'start' && which !== 'end') return { error: 'date' }
  const parsed = parseStepDate(input ?? '')
  if (parsed === 'bad') return { error: 'date' }
  // A full day keeps a null precision, like every date the trigger writes.
  const precision = parsed.date_precision === 'day' ? null : parsed.date_precision

  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'admin_only' }

  const patch =
    which === 'start'
      ? { production_started_on: parsed.on_date, production_started_precision: precision }
      : { production_completed_on: parsed.on_date, production_completed_precision: precision }
  const { error } = await supabase.from('Oeuvres').update(patch).eq('OeuvreID', oeuvreId)
  if (error) {
    if (error.message.includes('before production_started_on')) return { error: 'start_after_end' }
    await logError('Production date update failed', error, { source: 'production.setProductionDate', metadata: { oeuvreId, which } })
    return { error: error.message }
  }
  revalidatePath('/atelier')
  return { ok: true, on: parsed.on_date, precision: parsed.date_precision }
}
