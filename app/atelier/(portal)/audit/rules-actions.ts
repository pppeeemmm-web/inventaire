'use server'

// Audit « Règles » (WORK_RULES batch 2): runs the work rule checks, read only, admin only.
// Same checks as supabase/sql/work_rules_checks.sql, evaluated in lib/work-rules-checks.ts.

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import {
  PEM_CONTACT,
  RULES_LIVE_SINCE,
  evaluateWorkRules,
  type CheckOrderLine,
  type CheckStatusEvent,
  type CheckTask,
  type CheckWork,
  type RuleBreak,
} from '@/lib/work-rules-checks'

export type RuleChecksResult = { error: string } | { ok: true; breaks: RuleBreak[]; works: number; ranAt: string }

type Client = Awaited<ReturnType<typeof createClient>>
const PAGE = 1000

/** Every row of a query, page by page (the API returns at most 1 000 at a time). */
async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

async function orderExists(supabase: Client, oeuvreId: number, kind: string, contact: number | null): Promise<boolean> {
  if (contact == null) return false
  const { data, error } = await supabase.rpc('oeuvre_order_exists', { p_oeuvre: oeuvreId, p_kind: kind, p_contact: contact })
  if (error) throw new Error(error.message)
  return data === true
}

export async function runWorkRuleChecks(): Promise<RuleChecksResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Accès refusé' }

  try {
    const works = await readAll<CheckWork>((a, b) =>
      supabase
        .from('Oeuvres')
        .select('OeuvreID, Titre, statusId, "Catalogué", "NeedsPhotograph", fate, ContactID, LocalisationID, localisation_address_id, production_completed_on, is_public')
        .is('deleted_at', null)
        .order('OeuvreID')
        .range(a, b),
    )
    const live = new Set(works.map((w) => w.OeuvreID))

    const [openTasks, undatedTicks, images, addresses, reports, lines, events] = await Promise.all([
      readAll<CheckTask>((a, b) =>
        supabase.from('work_action').select('id, oeuvre_id, action_type_id, done, done_at, paused_at, created_at')
          .eq('done', false).order('id').range(a, b)),
      readAll<CheckTask>((a, b) =>
        supabase.from('work_action').select('id, oeuvre_id, action_type_id, done, done_at, paused_at, created_at')
          .eq('done', true).is('done_at', null).gte('created_at', RULES_LIVE_SINCE).order('id').range(a, b)),
      readAll<{ OeuvreID: number }>((a, b) =>
        supabase.from('tblImage').select('OeuvreID').order('ImageID').range(a, b)),
      readAll<{ id: number; contact_id: number }>((a, b) =>
        supabase.from('contact_addresses').select('id, contact_id').order('id').range(a, b)),
      readAll<{ oeuvre_id: number; kind: string }>((a, b) =>
        supabase.from('condition_report').select('oeuvre_id, kind').in('kind', ['destroyed', 'lost'])
          .is('resolved_on', null).order('id').range(a, b)),
      readAll<{ oeuvre_id: number; line_status: string; work_order: { kind: string; status: string; party_id: number | null } | null }>((a, b) =>
        supabase.from('work_order_work').select('oeuvre_id, line_status, work_order!work_order_work_order_id_fkey(kind, status, party_id)')
          .order('id').range(a, b)),
      readAll<{ row_id: string; created_at: string; old_value: unknown; new_value: unknown; metadata: { source?: string } | null }>((a, b) =>
        supabase.from('system_log').select('row_id, created_at, old_value, new_value, metadata')
          .eq('event_type', 'STATUS_CHANGE').eq('table_name', 'Oeuvres').gte('created_at', RULES_LIVE_SINCE)
          .order('id').range(a, b)),
    ])

    const statusEvents: CheckStatusEvent[] = events
      .filter((e) => e.metadata?.source === 'db' && live.has(Number(e.row_id)))
      .map((e) => ({ oeuvre_id: Number(e.row_id), created_at: e.created_at, old_value: e.old_value, new_value: e.new_value }))

    // Historique only for the works with a status event to check.
    const historiqueById = new Map<number, string | null>()
    const evIds = [...new Set(statusEvents.map((e) => e.oeuvre_id))]
    for (let i = 0; i < evIds.length; i += 200) {
      const { data, error } = await supabase.from('Oeuvres').select('OeuvreID, Historique').in('OeuvreID', evIds.slice(i, i + 200))
      if (error) throw new Error(error.message)
      for (const r of data ?? []) historiqueById.set(r.OeuvreID as number, (r.Historique as string | null) ?? null)
    }

    // The database's own order test, only where a rule needs it (few works).
    const orderExistsMap = new Map<string, boolean>()
    const asks: Promise<void>[] = []
    for (const w of works) {
      const s = w.statusId
      const holder = w.LocalisationID ?? PEM_CONTACT
      const ask = (kind: string, contact: number | null) =>
        asks.push(orderExists(supabase, w.OeuvreID, kind, contact).then((ok) => { orderExistsMap.set(`${w.OeuvreID}:${kind}`, ok) }))
      if (s != null && [1, 2, 3].includes(s) && holder !== PEM_CONTACT) ask('entrusted', holder)
      if (s === 7 || s === 8) ask('custody', w.LocalisationID)
      if (s === 6) ask('paid', w.ContactID)
    }
    await Promise.all(asks)

    const openFateReports = new Map<number, Set<string>>()
    for (const r of reports) {
      const set = openFateReports.get(r.oeuvre_id) ?? new Set<string>()
      set.add(r.kind)
      openFateReports.set(r.oeuvre_id, set)
    }
    const orderLines: CheckOrderLine[] = lines
      .filter((l) => l.work_order)
      .map((l) => ({ oeuvre_id: l.oeuvre_id, line_status: l.line_status, kind: l.work_order!.kind, status: l.work_order!.status, party_id: l.work_order!.party_id }))

    const breaks = evaluateWorkRules({
      works,
      tasks: [...openTasks, ...undatedTicks].filter((tk) => live.has(tk.oeuvre_id)),
      worksWithPhoto: new Set(images.map((i) => i.OeuvreID)),
      addressOwner: new Map(addresses.map((a) => [a.id, a.contact_id])),
      orderExists: orderExistsMap,
      orderLines,
      openFateReports,
      statusEvents,
      historiqueById,
    })
    return { ok: true, breaks, works: works.length, ranAt: new Date().toISOString() }
  } catch (e) {
    await logError('Work rule checks failed', e, { source: 'runWorkRuleChecks' })
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
