'use server'

// R4 (Pem 2026-11-17): « where and when » for the whole catalogue — the Carte « Création » mode and the
// Chronologie tab read this one bundle. Reads only (RLS as the signed-in team member); the shell's loaded
// batch of works is not enough here (the first keyset chunk), so the works come in full, few columns.
// Brief: docs/design/2026-11-17/R4_TimelineMap.notes.md.

import { createClient } from '@/lib/supabase/server'
import { loadPeriodSourceData } from '@/app/atelier/works/period-source-actions'
import {
  effectivePeriod,
  effectivePlace,
  whenWithSteps,
  workWhen,
  type CreationStep,
  type Place,
  type WorkPeriod,
} from '@/lib/work-periods'

const PAGE = 1000

export type TPWork = {
  id: number
  title: string | null
  image: string | null
  technique: number | null
  statusId: number | null
  /** As precise as known (production dates, a real day in `Année`, else « Création » lines). */
  day: string | null
  year: number | null
  periodId: number | null
  /** Where made: last « Création » line's place, else the period's atelier (`effectivePlace`). */
  placeId: number | null
  /** True when the place is the work's own (a « Création » line), false when read from its period. */
  precise: boolean
}

export type TPSession = { id: string; day: string; oeuvreIds: number[]; lat: number | null; lon: number | null }
/** One dated mark on the « Journal & notes » lane. */
export type TPMark = { day: string; kind: 'journal' | 'voice' | 'line'; oeuvreId: number | null }
export type TPOrder = {
  id: string
  ref: string | null
  kind: string
  /** When the works left (delivered, else out date, else signed) — null when no date is stored. */
  out: string | null
  back: string | null
  oeuvreIds: number[]
}

export type TimePlaceData = {
  works: TPWork[]
  periods: WorkPeriod[]
  places: Place[]
  steps: CreationStep[]
  sessions: TPSession[]
  marks: TPMark[]
  orders: TPOrder[]
}

type Err = { error: string }

type WorkRow = {
  OeuvreID: number
  Titre: string | null
  Année: string | null
  Technique: number | null
  statusId: number | null
  txtImageNameLink: string | null
  production_started_on: string | null
  production_completed_on: string | null
  production_started_precision: string | null
  production_completed_precision: string | null
}
const WORK_COLS =
  'OeuvreID, Titre, "Année", Technique, statusId, txtImageNameLink, production_started_on, production_completed_on, production_started_precision, production_completed_precision'

const day10 = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

export async function loadTimePlaceData(): Promise<TimePlaceData | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const [ps, sesRes, jRes, vRes, lRes, oRes, owRes] = await Promise.all([
    loadPeriodSourceData(),
    supabase.from('work_session').select('id, created_at, payload').order('created_at').limit(5000),
    supabase.from('journal_entry').select('event_on, voice_note_id').is('hidden_at', null).limit(20000),
    supabase.from('voice_note').select('id, created_at, oeuvre_id').limit(20000),
    supabase.from('note_line').select('created_at, oeuvre_id').is('discarded_at', null).limit(20000),
    supabase.from('work_order').select('id, ref, kind, status, signed_at, start_date, delivered_at, returned_at, cancelled_at').limit(5000),
    supabase.from('work_order_work').select('order_id, oeuvre_id').limit(20000),
  ])
  if ('error' in ps) return { error: ps.error }

  const rows: WorkRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('Oeuvres')
      .select(WORK_COLS as 'OeuvreID')
      .is('deleted_at', null)
      .order('OeuvreID')
      .range(from, from + PAGE - 1)
    if (error) return { error: error.message }
    rows.push(...((data ?? []) as unknown as WorkRow[]))
    if (!data || data.length < PAGE) break
  }

  const works: TPWork[] = rows.map((o) => {
    const when = whenWithSteps(workWhen(o), ps.creation[o.OeuvreID])
    const w = typeof when === 'number' ? { day: null, year: when } : (when ?? { day: null, year: null })
    const ep = effectivePlace(o.OeuvreID, workWhen(o), ps)
    return {
      id: o.OeuvreID,
      title: o.Titre?.trim() || null,
      image: o.txtImageNameLink,
      technique: o.Technique,
      statusId: o.statusId,
      day: w.day,
      year: w.year,
      periodId: effectivePeriod(o.OeuvreID, workWhen(o), ps).period?.id ?? null,
      placeId: ep.place?.id ?? null,
      precise: !!ep.place && !ep.fromPeriod,
    }
  })

  type SessionRow = { id: string; created_at: string; payload: Record<string, unknown> | null }
  const sessions: TPSession[] = ((sesRes.data ?? []) as SessionRow[]).map((s) => {
    const p = s.payload ?? {}
    const items = Array.isArray(p.items) ? (p.items as { oeuvre_id?: unknown }[]) : []
    const ctx = (p.field_context ?? {}) as { latitude?: unknown; longitude?: unknown }
    return {
      id: s.id,
      day: day10(p.session_day) ?? s.created_at.slice(0, 10),
      oeuvreIds: items.map((i) => i.oeuvre_id).filter((v): v is number => typeof v === 'number'),
      lat: typeof ctx.latitude === 'number' ? ctx.latitude : null,
      lon: typeof ctx.longitude === 'number' ? ctx.longitude : null,
    }
  })

  const marks: TPMark[] = []
  const voiceInJournal = new Set<string>()
  for (const j of (jRes.data ?? []) as { event_on: string; voice_note_id: string | null }[]) {
    if (j.voice_note_id) voiceInJournal.add(j.voice_note_id)
    const d = day10(j.event_on)
    if (d) marks.push({ day: d, kind: 'journal', oeuvreId: null })
  }
  for (const v of (vRes.data ?? []) as { id: string; created_at: string; oeuvre_id: number | null }[]) {
    if (!voiceInJournal.has(v.id)) marks.push({ day: v.created_at.slice(0, 10), kind: 'voice', oeuvreId: v.oeuvre_id })
  }
  for (const l of (lRes.data ?? []) as { created_at: string; oeuvre_id: number | null }[]) {
    marks.push({ day: l.created_at.slice(0, 10), kind: 'line', oeuvreId: l.oeuvre_id })
  }

  const worksByOrder = new Map<string, number[]>()
  for (const r of (owRes.data ?? []) as { order_id: string; oeuvre_id: number }[]) {
    const list = worksByOrder.get(r.order_id) ?? []
    list.push(r.oeuvre_id)
    worksByOrder.set(r.order_id, list)
  }
  type OrderRow = {
    id: string
    ref: string | null
    kind: string
    status: string
    signed_at: string | null
    start_date: string | null
    delivered_at: string | null
    returned_at: string | null
    cancelled_at: string | null
  }
  const orders: TPOrder[] = ((oRes.data ?? []) as OrderRow[])
    .filter((o) => !o.cancelled_at && o.status !== 'cancelled')
    .map((o) => ({
      id: o.id,
      ref: o.ref,
      kind: o.kind,
      out: day10(o.delivered_at) ?? day10(o.start_date) ?? day10(o.signed_at),
      back: day10(o.returned_at),
      oeuvreIds: worksByOrder.get(o.id) ?? [],
    }))

  const steps = Object.values(ps.creation).flat()
  return { works, periods: ps.periods, places: ps.places, steps, sessions, marks, orders }
}
