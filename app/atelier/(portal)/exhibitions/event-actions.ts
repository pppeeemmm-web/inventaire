'use server'

// R6 « Expositions & événements » — reads and writes of the event screen
// (docs/design/2026-11-17/R6_Events.notes.md v2 + Round 2; SQL draft supabase/sql/r6_events.sql).
//
// Speed (notes « Speed of the tab »): the list loads names, dates and counts only; the event loads its own
// selection and order lines by id (not the shell's loaded batch); every write is ONE field patch and
// returns nothing to re-fetch — the client updates its row in place.
//
// Movements are R7 orders only: this file never moves a work. « Créer la commande » opens the R7 form
// prefilled (Commandes `?new=…&process=<event>`); the order steps are done there.

import { createClient } from '@/lib/supabase/server'
import { fromSuiviEtape, fromSuiviProcess } from '@/lib/pipeline/suivi-client'
import { EXHIBITION_HIDDEN_STATUTS } from '@/lib/data'
import { resolveMessage } from '@/lib/i18n/resolve-message'
import type { Lang } from '@/lib/i18n/dictionary'
import type { Database } from '@/lib/types/supabase.generated'
import {
  EVENT_KINDS, EVENT_STATUSES, PREP_KEYS, R6_EVENTS_SQL_LIVE, STEP_TEMPLATE,
  type EventKind, type PrepKey,
} from '@/lib/events/event-model'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const FINISHED = ['closed', 'cancelled', 'delivered', 'handed_over']

type Supa = Awaited<ReturnType<typeof createClient>>
type Ok = { ok: true }
type Err = { error: string }

async function guardTeam(): Promise<{ supabase: Supa } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }
  return { supabase }
}

// ── List ──────────────────────────────────────────────────────────────────────────────────────

export interface EventListItem {
  id: string
  nom: string
  type: string
  statut: string
  date_debut: string | null
  date_fin: string | null
  contact_id: number | null
  /** Works on the event (selection ∪ works on its orders). */
  works_total: number
  /** Works out now through one of its open custody orders (loan, deposit, Confié). */
  works_out: number
  works_sold: number
  /** Earliest end date of an open custody order (when works are due back). */
  next_return: string | null
  orders_open: number
  steps_late: number
  /** Who holds the works out now (order parties), for the top strip. */
  out_party_ids: number[]
}

export type EventListResult = { ok: true; events: EventListItem[] } | Err

export async function listEvents(): Promise<EventListResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g

  const { data: processes, error } = await fromSuiviProcess(supabase)
    .select('id, nom, type, statut, date_debut, date_fin, contact_id')
    .in('type', [...EVENT_KINDS])
    .not('statut', 'in', `(${EXHIBITION_HIDDEN_STATUTS.join(',')})`)
    .order('date_debut', { ascending: false, nullsFirst: true })
  if (error) return { error: error.message }
  const rows = processes ?? []
  if (rows.length === 0) return { ok: true, events: [] }
  const ids = rows.map((p) => p.id)
  const today = new Date().toISOString().slice(0, 10)

  const [ordersRes, stepsRes, groupsRes] = await Promise.all([
    supabase.from('work_order').select('id, kind, status, end_date, process_id, party_id').in('process_id', ids).neq('status', 'cancelled'),
    fromSuiviEtape(supabase).select('process_id, statut, date_echeance').in('process_id', ids).neq('statut', 'fait').lt('date_echeance', today),
    supabase.from('working_group').select('id, process_id').in('process_id', ids),
  ])
  if (ordersRes.error) return { error: ordersRes.error.message }
  if (stepsRes.error) return { error: stepsRes.error.message }
  if (groupsRes.error) return { error: groupsRes.error.message }
  const orders = ordersRes.data ?? []
  const groups = (groupsRes.data ?? []) as { id: string; process_id: string }[]

  const [linesRes, groupWorksRes] = await Promise.all([
    orders.length
      ? supabase.from('work_order_work').select('order_id, oeuvre_id, line_status').in('order_id', orders.map((o) => o.id))
      : Promise.resolve({ data: [] as { order_id: string; oeuvre_id: number; line_status: string }[], error: null }),
    groups.length
      ? supabase.from('working_group_work').select('group_id, oeuvre_id').in('group_id', groups.map((x) => x.id))
      : Promise.resolve({ data: [] as { group_id: string; oeuvre_id: number }[], error: null }),
  ])
  if (linesRes.error) return { error: linesRes.error.message }
  if (groupWorksRes.error) return { error: groupWorksRes.error.message }
  const lines = linesRes.data ?? []
  const groupWorks = (groupWorksRes.data ?? []) as { group_id: string; oeuvre_id: number }[]

  const events: EventListItem[] = rows.map((p) => {
    const evOrders = orders.filter((o) => o.process_id === p.id)
    const works = new Set<number>()
    for (const gr of groups.filter((x) => x.process_id === p.id)) {
      for (const w of groupWorks) if (w.group_id === gr.id) works.add(w.oeuvre_id)
    }
    const out = new Set<number>()
    const sold = new Set<number>()
    const outParties = new Set<number>()
    let nextReturn: string | null = null
    for (const o of evOrders) {
      const oLines = lines.filter((l) => l.order_id === o.id)
      oLines.forEach((l) => works.add(l.oeuvre_id))
      for (const l of oLines) {
        if (l.line_status === 'sold' || (o.kind === 'sale' && o.status !== 'draft' && l.line_status !== 'removed')) sold.add(l.oeuvre_id)
      }
      if (o.status === 'out' && ['loan', 'consignment', 'entrusted'].includes(o.kind)) {
        const active = oLines.filter((l) => l.line_status === 'active')
        active.forEach((l) => out.add(l.oeuvre_id))
        if (active.length) outParties.add(o.party_id)
        if (o.end_date && (!nextReturn || o.end_date < nextReturn)) nextReturn = o.end_date
      }
    }
    return {
      id: p.id,
      nom: p.nom,
      type: p.type,
      statut: p.statut,
      date_debut: p.date_debut,
      date_fin: p.date_fin,
      contact_id: p.contact_id,
      works_total: works.size,
      works_out: out.size,
      works_sold: sold.size,
      next_return: nextReturn,
      orders_open: evOrders.filter((o) => !FINISHED.includes(o.status)).length,
      steps_late: (stepsRes.data ?? []).filter((s) => s.process_id === p.id).length,
      out_party_ids: [...outParties],
    }
  })
  return { ok: true, events }
}

// ── One event ─────────────────────────────────────────────────────────────────────────────────

export interface EventStep {
  id: string
  process_id: string
  nom: string
  statut: string
  date_echeance: string | null
  position: number
  notes: string | null
  overdue_override: boolean | null
}

export interface EventOrderLine {
  oeuvre_id: number
  line_status: string
  insurance_value: number | null
  price: number | null
}

export interface EventOrder {
  id: string
  ref: string | null
  kind: string
  status: string
  party_id: number
  start_date: string | null
  end_date: string | null
  created_at: string
  lines: EventOrderLine[]
}

export interface EventWork {
  id: number
  title: string | null
  year: string | null
  technique: number | null
  height: string | null
  width: string | null
  price: number | null
  statusId: number | null
  image: string | null
  holderId: number | null
  framed: boolean | null
}

export type EventPrepRow = { oeuvre_id: number; relation: string | null } & Partial<Record<`${PrepKey}_at`, string | null>>

export interface EventPerson { id: string; contact_id: number; role: string; position: number }

export interface EventDetail {
  id: string
  nom: string
  type: string
  statut: string
  date_debut: string | null
  date_fin: string | null
  contact_id: number | null
  localisation: string | null
  url: string | null
  notes: string | null
  /** The Pipeline process it came from (`suivi_process.exhibition_process_id` → this event). */
  from_process: { id: string; nom: string } | null
  steps: EventStep[]
  orders: EventOrder[]
  works: EventWork[]
  /** null until the SQL runs (R6_EVENTS_SQL_LIVE) or when no group is linked yet. */
  selection: { id: string; name: string; work_ids: number[] } | null
  prep: EventPrepRow[]
  people: EventPerson[]
  prep_columns: string[] | null
  on_site: boolean
  /** Floor plans owned by the event (`exhibition_layout.process_id`). */
  layouts: number
}

export type EventDetailResult = { ok: true; event: EventDetail } | Err

const WORK_COLS = 'OeuvreID, Titre, "Année", Technique, Hauteur, Largeur, Prix, statusId, txtImageNameLink, LocalisationID, Encadree'

async function fetchWorks(supabase: Supa, ids: number[]): Promise<EventWork[] | Err> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('Oeuvres').select(WORK_COLS).in('OeuvreID', ids).is('deleted_at', null)
  if (error) return { error: error.message }
  return (data ?? []).map((w) => ({
    id: w.OeuvreID, title: w.Titre, year: w.Année, technique: w.Technique, height: w.Hauteur, width: w.Largeur,
    price: w.Prix == null ? null : Number(w.Prix), statusId: w.statusId, image: w.txtImageNameLink,
    holderId: w.LocalisationID, framed: w.Encadree,
  }))
}

export async function loadEvent(id: string): Promise<EventDetailResult> {
  if (!UUID_RE.test(id)) return { error: 'ev_err_not_found' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g

  const [pRes, stepsRes, ordersRes, fromRes, layoutsRes, groupRes, prepRes, peopleRes, extraRes] = await Promise.all([
    fromSuiviProcess(supabase).select('id, nom, type, statut, date_debut, date_fin, contact_id, localisation, url, notes').eq('id', id).maybeSingle(),
    fromSuiviEtape(supabase).select('id, process_id, nom, statut, date_echeance, position, notes, overdue_override').eq('process_id', id).order('position'),
    supabase.from('work_order').select('id, ref, kind, status, party_id, start_date, end_date, created_at').eq('process_id', id).order('created_at', { ascending: true }),
    fromSuiviProcess(supabase).select('id, nom').eq('exhibition_process_id', id).limit(1),
    supabase.from('exhibition_layout').select('id', { count: 'exact', head: true }).eq('process_id', id),
    supabase.from('working_group').select('id, name').eq('process_id', id).maybeSingle(),
    supabase.from('event_work').select('*').eq('process_id', id),
    supabase.from('event_contact').select('id, contact_id, role, position').eq('process_id', id).order('position'),
    supabase.from('suivi_process').select('prep_columns, on_site').eq('id', id).maybeSingle(),
  ])
  for (const r of [pRes, stepsRes, ordersRes, fromRes, groupRes, prepRes, peopleRes, extraRes]) {
    if (r.error) return { error: r.error.message }
  }
  if (!pRes.data) return { error: 'ev_err_not_found' }
  const orders = ordersRes.data ?? []
  const group = groupRes.data as { id: string; name: string } | null

  const [linesRes, groupWorksRes] = await Promise.all([
    orders.length
      ? supabase.from('work_order_work').select('order_id, oeuvre_id, line_status, insurance_value, price, position').in('order_id', orders.map((o) => o.id)).order('position')
      : Promise.resolve({ data: [] as { order_id: string; oeuvre_id: number; line_status: string; insurance_value: number | null; price: number | null; position: number }[], error: null }),
    group
      ? supabase.from('working_group_work').select('oeuvre_id, position').eq('group_id', group.id).order('position')
      : Promise.resolve({ data: [] as { oeuvre_id: number; position: number }[], error: null }),
  ])
  if (linesRes.error) return { error: linesRes.error.message }
  if (groupWorksRes.error) return { error: groupWorksRes.error.message }
  const lines = linesRes.data ?? []
  const selectionIds = ((groupWorksRes.data ?? []) as { oeuvre_id: number }[]).map((w) => w.oeuvre_id)

  const workIds = [...new Set([...selectionIds, ...lines.map((l) => l.oeuvre_id)])]
  const works = await fetchWorks(supabase, workIds)
  if ('error' in works) return works
  const extra = extraRes.data as { prep_columns: string[] | null; on_site: boolean } | null

  return {
    ok: true,
    event: {
      ...pRes.data,
      from_process: fromRes.data?.[0] ?? null,
      steps: (stepsRes.data ?? []) as EventStep[],
      orders: orders.map((o) => ({
        ...o,
        lines: lines.filter((l) => l.order_id === o.id).map((l) => ({
          oeuvre_id: l.oeuvre_id, line_status: l.line_status,
          insurance_value: l.insurance_value == null ? null : Number(l.insurance_value),
          price: l.price == null ? null : Number(l.price),
        })),
      })),
      works,
      selection: group ? { id: group.id, name: group.name, work_ids: selectionIds } : null,
      prep: (prepRes.data ?? []) as EventPrepRow[],
      people: (peopleRes.data ?? []) as EventPerson[],
      prep_columns: extra?.prep_columns ?? null,
      on_site: extra?.on_site ?? false,
      layouts: layoutsRes.count ?? 0,
    },
  }
}

// ── Event row: create + one field per save ────────────────────────────────────────────────────

export async function createEvent(payload: { nom: string; type: string }): Promise<{ ok: true; event: EventListItem } | Err> {
  const nom = payload.nom.trim()
  if (!nom) return { error: 'ev_err_name' }
  const type = (EVENT_KINDS as readonly string[]).includes(payload.type) ? payload.type : 'exposition'
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await fromSuiviProcess(g.supabase)
    .insert({ nom, type, statut: 'prevue' })
    .select('id, nom, type, statut, date_debut, date_fin, contact_id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  return {
    ok: true,
    event: { ...data, works_total: 0, works_out: 0, works_sold: 0, next_return: null, orders_open: 0, steps_late: 0, out_party_ids: [] },
  }
}

const EVENT_FIELDS = ['nom', 'type', 'statut', 'date_debut', 'date_fin', 'contact_id', 'localisation', 'url', 'notes'] as const
type EventField = (typeof EVENT_FIELDS)[number]

/** One field of the event, saved on blur (no list re-fetch: the client patches its row). */
export async function patchEventField(id: string, field: EventField, value: string | number | null): Promise<Ok | Err> {
  if (!UUID_RE.test(id) || !EVENT_FIELDS.includes(field)) return { error: 'ev_err_field' }
  let v: string | number | null = typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value
  if (field === 'nom' && !v) return { error: 'ev_err_name' }
  if ((field === 'date_debut' || field === 'date_fin') && v != null && !ISO_DAY.test(String(v))) return { error: 'ev_err_field' }
  if (field === 'type' && !(EVENT_KINDS as readonly string[]).includes(String(v))) return { error: 'ev_err_field' }
  if (field === 'statut' && !(EVENT_STATUSES as readonly string[]).includes(String(v))) return { error: 'ev_err_field' }
  if (field === 'contact_id') v = v == null ? null : Number(v)
  const g = await guardTeam()
  if ('error' in g) return g
  const patch = { [field]: v } as Database['public']['Tables']['suivi_process']['Update']
  const { error } = await fromSuiviProcess(g.supabase).update(patch).eq('id', id)
  return error ? { error: error.message } : { ok: true }
}

// ── « À préparer »: one step per write ────────────────────────────────────────────────────────

export async function addEventStep(eventId: string, nom: string, position: number): Promise<{ ok: true; step: EventStep } | Err> {
  if (!UUID_RE.test(eventId) || !nom.trim()) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await fromSuiviEtape(g.supabase)
    .insert({ process_id: eventId, nom: nom.trim(), statut: 'a_faire', position })
    .select('id, process_id, nom, statut, date_echeance, position, notes, overdue_override')
    .single()
  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  return { ok: true, step: data as EventStep }
}

/** A step from the kind's template, all in one insert (only the names missing from the event). */
export async function applyStepTemplate(eventId: string, kind: EventKind, lang: Lang, from: number): Promise<{ ok: true; steps: EventStep[] } | Err> {
  if (!UUID_RE.test(eventId)) return { error: 'ev_err_field' }
  const names = (STEP_TEMPLATE[kind] ?? []).map((k) => resolveMessage(lang, k))
  const g = await guardTeam()
  if ('error' in g) return g
  const { data: existing } = await fromSuiviEtape(g.supabase).select('nom').eq('process_id', eventId)
  const have = new Set((existing ?? []).map((s) => s.nom.trim().toLowerCase()))
  const rows = names.filter((n) => !have.has(n.toLowerCase())).map((nom, i) => ({ process_id: eventId, nom, statut: 'a_faire', position: from + i }))
  if (rows.length === 0) return { ok: true, steps: [] }
  const { data, error } = await fromSuiviEtape(g.supabase)
    .insert(rows)
    .select('id, process_id, nom, statut, date_echeance, position, notes, overdue_override')
  if (error) return { error: error.message }
  return { ok: true, steps: (data ?? []) as EventStep[] }
}

const STEP_FIELDS = ['nom', 'statut', 'date_echeance', 'notes'] as const
type StepField = (typeof STEP_FIELDS)[number]

/** One field of one step (a tick = one update, not every step rewritten). */
export async function patchEventStep(stepId: string, field: StepField, value: string | null): Promise<Ok | Err> {
  if (!UUID_RE.test(stepId) || !STEP_FIELDS.includes(field)) return { error: 'ev_err_field' }
  const v = value == null || value.trim() === '' ? null : value.trim()
  if (field === 'nom' && !v) return { error: 'ev_err_name' }
  if (field === 'statut' && !['a_faire', 'en_cours', 'fait', 'bloque'].includes(String(v))) return { error: 'ev_err_field' }
  if (field === 'date_echeance' && v != null && !ISO_DAY.test(v)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const patch = { [field]: v } as Database['public']['Tables']['suivi_etape']['Update']
  const { error } = await fromSuiviEtape(g.supabase).update(patch).eq('id', stepId)
  return error ? { error: error.message } : { ok: true }
}

export async function deleteEventStep(stepId: string): Promise<Ok | Err> {
  if (!UUID_RE.test(stepId)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await fromSuiviEtape(g.supabase).delete().eq('id', stepId)
  return error ? { error: error.message } : { ok: true }
}

// ── Needs supabase/sql/r6_events.sql (R6_EVENTS_SQL_LIVE) ─────────────────────────────────────

function sqlWaiting(): Err | null {
  return R6_EVENTS_SQL_LIVE ? null : { error: 'ev_err_sql_waiting' }
}

/** « Créer la sélection »: a new work group named after the event, already linked, with the given works. */
export async function createEventSelection(eventId: string, name: string, oeuvreIds: number[]): Promise<{ ok: true; id: string; name: string } | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(eventId) || !name.trim()) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await g.supabase.from('working_group').insert({ name: name.trim(), process_id: eventId }).select('id, name').single()
  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  const group = data as { id: string; name: string }
  const ids = [...new Set(oeuvreIds.filter((n) => Number.isInteger(n) && n !== 0))]
  if (ids.length) {
    const { error: wErr } = await g.supabase.from('working_group_work').insert(ids.map((oeuvre_id, position) => ({ group_id: group.id, oeuvre_id, position })))
    if (wErr) return { error: wErr.message }
  }
  return { ok: true, id: group.id, name: group.name }
}

/** « Lier un groupe existant »: the group becomes this event's selection (one per event). */
export async function linkEventSelection(eventId: string, groupId: string): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(eventId) || !UUID_RE.test(groupId)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('working_group').update({ process_id: eventId }).eq('id', groupId)
  return error ? { error: error.message } : { ok: true }
}

/** Unlink (the group and its works stay as a plain work group). */
export async function unlinkEventSelection(groupId: string): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(groupId)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('working_group').update({ process_id: null }).eq('id', groupId)
  return error ? { error: error.message } : { ok: true }
}

export async function addWorksToSelection(groupId: string, oeuvreIds: number[], from: number): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  const ids = [...new Set(oeuvreIds.filter((n) => Number.isInteger(n) && n !== 0))]
  if (!UUID_RE.test(groupId) || ids.length === 0) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('working_group_work')
    .upsert(ids.map((oeuvre_id, i) => ({ group_id: groupId, oeuvre_id, position: from + i })), { onConflict: 'group_id,oeuvre_id' })
  return error ? { error: error.message } : { ok: true }
}

/** Take a work out of the selection (the work itself is untouched). */
export async function removeWorkFromSelection(groupId: string, oeuvreId: number): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(groupId) || !Number.isInteger(oeuvreId)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('working_group_work').delete().eq('group_id', groupId).eq('oeuvre_id', oeuvreId)
  return error ? { error: error.message } : { ok: true }
}

/** One prep tick: the date it was done, or cleared. */
export async function tickEventWork(eventId: string, oeuvreId: number, key: PrepKey, on: boolean): Promise<{ ok: true; at: string | null } | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(eventId) || !Number.isInteger(oeuvreId) || !PREP_KEYS.includes(key)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { data: { user } } = await g.supabase.auth.getUser()
  const at = on ? new Date().toISOString() : null
  const { error } = await g.supabase.from('event_work').upsert(
    { process_id: eventId, oeuvre_id: oeuvreId, [`${key}_at`]: at, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
    { onConflict: 'process_id,oeuvre_id' },
  )
  return error ? { error: error.message } : { ok: true, at }
}

/** The free relation of a work to the event (collaborations: « faite ensemble », « prêtée »…). */
export async function setEventWorkRelation(eventId: string, oeuvreId: number, relation: string | null): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(eventId) || !Number.isInteger(oeuvreId)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('event_work').upsert(
    { process_id: eventId, oeuvre_id: oeuvreId, relation: relation?.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: 'process_id,oeuvre_id' },
  )
  return error ? { error: error.message } : { ok: true }
}

export async function addEventPerson(eventId: string, contactId: number, role: string, position: number): Promise<{ ok: true; person: EventPerson } | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(eventId) || !Number.isInteger(contactId) || !role.trim()) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await g.supabase.from('event_contact')
    .insert({ process_id: eventId, contact_id: contactId, role: role.trim(), position })
    .select('id, contact_id, role, position').single()
  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  return { ok: true, person: data as EventPerson }
}

export async function removeEventPerson(personId: string): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(personId)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('event_contact').delete().eq('id', personId)
  return error ? { error: error.message } : { ok: true }
}

export async function setEventPrepColumns(eventId: string, cols: PrepKey[] | null): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(eventId)) return { error: 'ev_err_field' }
  const clean = cols == null ? null : PREP_KEYS.filter((k) => cols.includes(k))
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('suivi_process').update({ prep_columns: clean }).eq('id', eventId)
  return error ? { error: error.message } : { ok: true }
}

export async function setEventOnSite(eventId: string, on: boolean): Promise<Ok | Err> {
  const w = sqlWaiting(); if (w) return w
  if (!UUID_RE.test(eventId)) return { error: 'ev_err_field' }
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.supabase.from('suivi_process').update({ on_site: on }).eq('id', eventId)
  return error ? { error: error.message } : { ok: true }
}
