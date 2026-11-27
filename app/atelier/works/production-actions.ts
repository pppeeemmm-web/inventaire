'use server'

// Production start / end set by hand (start: owner 2026-11-03; end + partial dates: TODO 3–4,
// 2026-11-14). A date is a year, a month or a day ("2021", "06/2024", "22/08/2026"), stored like
// "Année" with a precision column (supabase/sql/oeuvres_production_precision.sql). Becoming Prêt
// (catalogued + photo validated) writes the end as today (trigger, WORK_RULES rule 8). Admin only, like other direct edits to an existing work;
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

type OriginSaved = {
  production_origin: 'new' | 'found' | null
  production_started_on: string | null
  production_started_precision: 'year' | 'month' | 'day' | null
}

// « Nouvelle / Ancienne — retrouvée » on an existing work (TODO: « Retrouvée » on a work). Admin only, like the
// dates. « Retrouvée » means the start is unknown, so the start that came with « Nouvelle » (set automatically at
// creation) is cleared; a start on a work that was not « Nouvelle » stays. Returns what was saved.
export async function setProductionOrigin(
  oeuvreId: number,
  origin: 'new' | 'found',
): Promise<{ ok: true; saved: OriginSaved } | { error: string }> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'oeuvre_id' }
  if (origin !== 'new' && origin !== 'found') return { error: 'origin' }

  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'admin_only' }

  const cols = 'production_origin, production_started_on, production_started_precision'
  const { data: cur, error: readErr } = await supabase.from('Oeuvres').select(cols).eq('OeuvreID', oeuvreId).is('deleted_at', null).maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!cur) return { error: 'not_found' }

  const patch: Partial<OriginSaved> = { production_origin: origin }
  if (origin === 'found' && cur.production_origin === 'new') {
    patch.production_started_on = null
    patch.production_started_precision = null
  }
  const { data, error } = await supabase.from('Oeuvres').update(patch).eq('OeuvreID', oeuvreId).is('deleted_at', null).select(cols)
  if (error) {
    await logError('Production origin update failed', error, { source: 'production.setProductionOrigin', metadata: { oeuvreId, origin } })
    return { error: error.message }
  }
  // Nothing updated (row gone, or refused by RLS): never « ok ».
  if (!data?.length) return { error: 'not_found' }
  return { ok: true, saved: data[0] as OriginSaved }
}
