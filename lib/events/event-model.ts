// R6 « Expositions & événements » — the shared model (docs/design/2026-11-17/R6_Events.notes.md v2 + Round 2).
// An event = a `suivi_process` row that is accepted and involves works. Its moves are R7 orders
// (`work_order.process_id`); this file only names kinds, statuses, prep columns and step templates.

import type { DictKey } from '@/lib/i18n/dictionary'

/**
 * Supabase/sql/r6_events.sql applied? (selection = work group linked to the event, per-work prep ticks
 * and relation, people with roles, prep column switches, « sur le site »). Applied live 2026-11-17
 * (Pem: « Apply it »), migrations r6_events + r6_events_grants. With false, those parts show as
 * « waiting » and nothing reads or writes the new tables.
 */
export const R6_EVENTS_SQL_LIVE = true

export const EVENT_KINDS = ['exposition', 'collaboration', 'edition'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/** Event chips (Co for collaboration so it never mixes with the order chip C = Confié). */
export const EVENT_CHIP: Record<EventKind, string> = { exposition: 'E', collaboration: 'Co', edition: 'É' }
export const EVENT_KIND_LABEL: Record<EventKind, DictKey> = {
  exposition: 'ev_kind_exposition', collaboration: 'ev_kind_collaboration', edition: 'ev_kind_edition',
}

export function asEventKind(type: string | null | undefined): EventKind {
  return type === 'collaboration' || type === 'edition' ? type : 'exposition'
}

/** One life for an event (replaces « Prévue / Passée » vs Pipeline's « gagné / terminé »). */
export const EVENT_STATUSES = ['a_confirmer', 'prevue', 'en_cours', 'termine'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]
export const EVENT_STATUS_LABEL: Record<EventStatus, DictKey> = {
  a_confirmer: 'ev_st_a_confirmer', prevue: 'ev_st_prevue', en_cours: 'ev_st_en_cours', termine: 'ev_st_termine',
}

/** Old words read as the new ones (no rows today; a Pipeline « gagné » is an accepted, planned event). */
export function asEventStatus(statut: string | null | undefined): EventStatus {
  if (statut === 'a_confirmer' || statut === 'en_cours' || statut === 'termine') return statut
  if (statut === 'passee') return 'termine'
  return 'prevue'
}

/** Pem's own contact: an event whose place is the studio needs no order (open studio). */
export const STUDIO_CONTACT_ID = 13

// ── Prep per work (Round 2, Q10) — each tick is a date column `<key>_at` on event_work ──────────
export const PREP_KEYS = [
  'presentation', 'cartel', 'constat_out', 'packing', 'unpacked', 'hung', 'photo', 'taken_down', 'constat_back',
] as const
export type PrepKey = (typeof PREP_KEYS)[number]

/** The table's switchable columns, in moment order (before · at the venue · after). */
export const PREP_COLUMNS: PrepKey[] = ['presentation', 'cartel', 'constat_out', 'packing', 'hung', 'photo', 'constat_back']
export const PREP_LABEL: Record<PrepKey, DictKey> = {
  presentation: 'ev_prep_presentation', cartel: 'ev_prep_cartel', constat_out: 'ev_prep_constat_out',
  packing: 'ev_prep_packing', unpacked: 'ev_prep_unpacked', hung: 'ev_prep_hung', photo: 'ev_prep_photo',
  taken_down: 'ev_prep_taken_down', constat_back: 'ev_prep_constat_back',
}
export const PREP_HINT: Partial<Record<PrepKey, DictKey>> = {
  presentation: 'ev_prep_presentation_hint', cartel: 'ev_prep_cartel_hint', constat_out: 'ev_prep_constat_out_hint',
  packing: 'ev_prep_packing_hint', hung: 'ev_prep_hung_hint', photo: 'ev_prep_photo_hint', constat_back: 'ev_prep_constat_back_hint',
}

/** Defaults by kind (Round 2): exposition = the six; collaboration / open studio = 3; edition = the two constats. */
export function defaultPrepColumns(kind: EventKind, placeId: number | null): PrepKey[] {
  if (kind === 'edition') return ['constat_out', 'constat_back']
  if (kind === 'collaboration' || placeId === STUDIO_CONTACT_ID) return ['presentation', 'cartel', 'photo']
  return ['presentation', 'cartel', 'constat_out', 'hung', 'photo', 'constat_back']
}

export function prepColumnsOf(kind: EventKind, placeId: number | null, saved: string[] | null | undefined): PrepKey[] {
  if (!saved) return defaultPrepColumns(kind, placeId)
  return PREP_COLUMNS.filter((k) => saved.includes(k))
}

/** Phone at the venue (Round 2, Q11): four moments and the ticks each one shows. */
export const PHONE_MOMENTS = ['arrivee', 'accrochage', 'salle', 'decrochage'] as const
export type PhoneMoment = (typeof PHONE_MOMENTS)[number]
export const PHONE_MOMENT_LABEL: Record<PhoneMoment, DictKey> = {
  arrivee: 'ev_moment_arrivee', accrochage: 'ev_moment_accrochage', salle: 'ev_moment_salle', decrochage: 'ev_moment_decrochage',
}
export const PHONE_MOMENT_TICKS: Record<PhoneMoment, PrepKey[]> = {
  arrivee: ['unpacked', 'constat_out'],
  accrochage: ['hung', 'photo'],
  salle: [],
  decrochage: ['taken_down', 'constat_back'],
}

// ── « À préparer »: dated steps from a template per kind (suivi_etape rows) ─────────────────────
export const STEP_TEMPLATE: Record<EventKind, DictKey[]> = {
  exposition: [
    'ev_tpl_transport_out', 'ev_tpl_constats_out', 'ev_tpl_insurance', 'ev_tpl_cartels', 'ev_tpl_hanging',
    'ev_tpl_opening', 'ev_tpl_photos', 'ev_tpl_takedown', 'ev_tpl_transport_back', 'ev_tpl_constats_back',
  ],
  collaboration: ['ev_tpl_cartels', 'ev_tpl_hanging', 'ev_tpl_photos'],
  edition: ['ev_tpl_scan', 'ev_tpl_proof', 'ev_tpl_sign_number'],
}

// ── R7 order labels as the event shows them (same words as Commandes) ──────────────────────────
export const ORDER_CHIP: Record<string, string> = { sale: 'V', consignment: 'D', loan: 'P', gift: 'Do', entrusted: 'C' }

export function orderStepKey(kind: string, step: string): DictKey {
  if (step === 'cancelled') return 'ord_st_cancelled'
  if (kind === 'gift' && step === 'signed') return 'ord_st_gift_signed'
  if ((kind === 'consignment' || kind === 'loan') && step === 'signed') return 'ord_st_signed_m'
  if ((kind === 'consignment' || kind === 'loan' || kind === 'entrusted') && step === 'closed') return 'ord_st_closed_m'
  if (kind === 'entrusted' && step === 'out') return 'ord_st_entrusted_out'
  return `ord_st_${step}` as DictKey
}

/** The next step of a custody order, as the group button names it (the step itself is done in Commandes). */
export function nextGroupStep(kind: string, status: string): 'out' | 'back' | null {
  if ((kind === 'loan' || kind === 'consignment') && status === 'signed') return 'out'
  if (kind === 'entrusted' && status === 'draft') return 'out'
  if ((kind === 'loan' || kind === 'consignment' || kind === 'entrusted') && status === 'out') return 'back'
  return null
}
