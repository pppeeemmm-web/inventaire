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
  Année: string | null
  statusId: number | null
  LocalisationID: number | null
  place_id: number | null
  Catalogué: boolean
  NeedsPhotograph: boolean
  production_completed_on: string | null
  production_completed_precision: 'year' | 'month' | 'day' | null
  edited_at: string | null
}

/** « Ancienne — retrouvée » answers (FoundWorkFlow.md, Pem 2026-11-27): the year when known, « Terminée ? » required. */
export type FoundAnswers = { finished: boolean; year: number | null }

// « Nouvelle / Ancienne — retrouvée » on an existing work (TODO: « Retrouvée » on a work). Admin only, like the
// dates. « Retrouvée » means the start is unknown, so the start that came with « Nouvelle » (set automatically at
// creation) is cleared; a start on a work that was not « Nouvelle » stays. Returns what was saved.
// With `found` (FoundWorkFlow.md): the year goes to « Année »; « Terminée ? Oui » ends production that year
// (precision year, never today) and catalogues the work when it has a photo (rule 2: no photo → it stays
// « En production », `needsPhoto` tells the screen to say « Ajoutez une photo pour la cataloguer »); « Non » leaves
// the stage as it is. The Historique line is written by the database (oeuvre_history, found_work_history_line.sql).
export async function setProductionOrigin(
  oeuvreId: number,
  origin: 'new' | 'found',
  found?: FoundAnswers,
): Promise<{ ok: true; saved: OriginSaved; needsPhoto?: true } | { error: string }> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'oeuvre_id' }
  if (origin !== 'new' && origin !== 'found') return { error: 'origin' }
  const parisYear = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 4))
  if (found && (typeof found.finished !== 'boolean' || (found.year != null && (!Number.isInteger(found.year) || found.year < 1900 || found.year > parisYear)))) {
    return { error: 'year' }
  }

  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'admin_only' }

  // The stage moves the status and Pem's place (database triggers): returned so the card and the list follow.
  const cols = 'production_origin, production_started_on, production_started_precision, "Année", "Catalogué", "NeedsPhotograph", production_completed_on, production_completed_precision, edited_at, "statusId", "LocalisationID", place_id'
  const { data: cur, error: readErr } = await supabase.from('Oeuvres').select(cols).eq('OeuvreID', oeuvreId).is('deleted_at', null).maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!cur) return { error: 'not_found' }

  const patch: Record<string, unknown> = { production_origin: origin }
  if (origin === 'found' && cur.production_origin === 'new') {
    patch.production_started_on = null
    patch.production_started_precision = null
  }
  let needsPhoto = false
  if (origin === 'found' && found) {
    // A full date already there (1999-10-31) is kept when its year is the one given; only an empty or other year is set.
    if (found.year != null && String(cur['Année'] ?? '').slice(0, 4) !== String(found.year)) patch['Année'] = `${found.year}-01-01`
    if (found.finished) {
      if (found.year != null) {
        patch.production_completed_on = `${found.year}-01-01`
        patch.production_completed_precision = 'year'
      }
      if (!cur['Catalogué']) {
        const { count, error: imgErr } = await supabase.from('tblImage').select('ImageID', { count: 'exact', head: true }).eq('OeuvreID', oeuvreId)
        if (imgErr) return { error: imgErr.message }
        if ((count ?? 0) > 0) {
          patch['Catalogué'] = true
          patch['NeedsPhotograph'] = true
        } else needsPhoto = true
      }
    }
  }
  const { data, error } = await supabase.from('Oeuvres').update(patch).eq('OeuvreID', oeuvreId).is('deleted_at', null).select(cols)
  if (error) {
    await logError('Production origin update failed', error, { source: 'production.setProductionOrigin', metadata: { oeuvreId, origin, found } })
    return { error: error.message }
  }
  // Nothing updated (row gone, or refused by RLS): never « ok ».
  if (!data?.length) return { error: 'not_found' }
  const row = data[0] as Omit<OriginSaved, 'Catalogué' | 'NeedsPhotograph'> & { Catalogué: boolean | null; NeedsPhotograph: boolean | null }
  const saved: OriginSaved = { ...row, Catalogué: !!row.Catalogué, NeedsPhotograph: !!row.NeedsPhotograph }
  return needsPhoto ? { ok: true, saved, needsPhoto: true } : { ok: true, saved }
}
