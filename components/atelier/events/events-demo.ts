// R6 — dev-only demo of the event screens (`/atelier/exhibitions?demo=1`, development build only).
// The live DB has no event yet (0 exhibitions) and is production, so the screens are looked at on this
// fixture: real works from the shell's loaded batch (read only), placeholder events and orders,
// and an api that WRITES NOTHING — every call answers « ok » and the screen patches its own state.

import type { Oeuvre } from '@/lib/types/database'
import type { EventDetail, EventListItem, EventOrder, EventStep } from '@/app/atelier/(portal)/exhibitions/event-actions'
import type { EventContact } from './events-shared'
import type { EventsApi } from './EventsTab'

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const day = (offset: number) => {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10)
}

export function buildEventsDemo(oeuvres: Oeuvre[], contacts: EventContact[]): { events: EventListItem[]; details: Record<string, EventDetail> } {
  const ws = oeuvres.filter((o) => o.txtImageNameLink).slice(0, 9)
  const venue = contacts.find((c) => c.NomInstitution && c.ContactID !== 13) ?? contacts[0]
  const printer = contacts.filter((c) => c.ContactID !== 13 && c.ContactID !== venue?.ContactID)[0] ?? venue
  const work = (o: Oeuvre) => ({
    id: o.OeuvreID, title: o.Titre ?? null, year: (o as { Année?: string | null }).Année ?? null,
    technique: (o as { Technique?: number | null }).Technique ?? null,
    height: (o as { Hauteur?: string | null }).Hauteur ?? null, width: (o as { Largeur?: string | null }).Largeur ?? null,
    price: o.Prix == null ? null : Number(o.Prix), statusId: o.statusId ?? null, image: o.txtImageNameLink ?? null,
    holderId: o.LocalisationID ?? null, framed: (o as { Encadree?: boolean | null }).Encadree ?? null,
  })
  const ids = ws.map((w) => w.OeuvreID)
  const loan: EventOrder = {
    id: uid(101), ref: 'P-DEMO-003', kind: 'loan', status: 'out', party_id: venue?.ContactID ?? 0,
    start_date: day(-20), end_date: day(10), created_at: '2026-09-01T10:00:00Z',
    lines: ids.slice(0, 3).map((oeuvre_id) => ({ oeuvre_id, line_status: 'active', insurance_value: 4800, price: null })),
  }
  const sale: EventOrder = {
    id: uid(102), ref: 'V-DEMO-004', kind: 'sale', status: 'delivered', party_id: printer?.ContactID ?? 0,
    start_date: null, end_date: null, created_at: '2026-10-02T10:00:00Z',
    lines: ids.slice(2, 3).map((oeuvre_id) => ({ oeuvre_id, line_status: 'active', insurance_value: null, price: 4800 })),
  }
  const deposit: EventOrder = {
    id: uid(103), ref: 'D-DEMO-002', kind: 'consignment', status: 'draft', party_id: venue?.ContactID ?? 0,
    start_date: day(-20), end_date: day(10), created_at: '2026-10-05T10:00:00Z',
    lines: ids.slice(5, 6).map((oeuvre_id) => ({ oeuvre_id, line_status: 'active', insurance_value: null, price: 3000 })),
  }
  const step = (n: number, nom: string, statut: string, due: number | null): EventStep => ({
    id: uid(200 + n), process_id: uid(1), nom, statut, date_echeance: due == null ? null : day(due), position: n, notes: null, overdue_override: false,
  })
  const dunamis: EventDetail = {
    id: uid(1), nom: 'Dunamis (démo)', type: 'exposition', statut: 'en_cours', date_debut: day(-18), date_fin: day(10),
    contact_id: venue?.ContactID ?? null, localisation: null, url: null, notes: null,
    from_process: null,
    steps: [
      step(0, 'Transport aller', 'fait', -21), step(1, 'Constats départ', 'fait', -20), step(2, 'Photos d’accrochage', 'a_faire', -12),
      step(3, 'Cadre « Étude »', 'a_faire', -1), step(4, 'Démontage', 'a_faire', 10), step(5, 'Transport retour', 'a_faire', 11),
    ],
    orders: [loan, sale, deposit],
    works: ws.slice(0, 6).map(work),
    selection: { id: uid(300), name: 'Dunamis (démo) — 2026', work_ids: ids.slice(0, 5) },
    prep: [
      { oeuvre_id: ids[0], relation: null, presentation_at: '2026-09-20T10:00:00Z', cartel_at: '2026-09-21T10:00:00Z', constat_out_at: '2026-09-28T10:00:00Z', hung_at: '2026-10-01T10:00:00Z', photo_at: '2026-10-02T10:00:00Z' },
      { oeuvre_id: ids[1], relation: null, presentation_at: '2026-09-20T10:00:00Z', cartel_at: '2026-09-21T10:00:00Z', constat_out_at: '2026-09-28T10:00:00Z', hung_at: '2026-10-01T10:00:00Z' },
    ],
    people: venue ? [{ id: uid(400), contact_id: venue.ContactID, role: 'lieu', position: 0 }] : [],
    prep_columns: null, on_site: false, layouts: 0,
  }
  const blank: EventDetail = {
    id: uid(2), nom: 'Salon de printemps (démo)', type: 'exposition', statut: 'prevue', date_debut: day(150), date_fin: day(167),
    contact_id: null, localisation: null, url: null, notes: null, from_process: null, steps: [], orders: [], works: [],
    selection: null, prep: [], people: [], prep_columns: null, on_site: false, layouts: 0,
  }
  const edition: EventDetail = {
    id: uid(3), nom: '1411 — tirages (démo)', type: 'edition', statut: 'en_cours', date_debut: day(-5), date_fin: day(40),
    contact_id: printer?.ContactID ?? null, localisation: null, url: null, notes: null, from_process: null,
    steps: [step(10, 'Numérisation / prise de vue', 'fait', -4), step(11, 'Bon à tirer validé', 'a_faire', 8)],
    orders: [{
      id: uid(104), ref: 'C-DEMO-001', kind: 'entrusted', status: 'out', party_id: printer?.ContactID ?? 0,
      start_date: day(-4), end_date: day(3), created_at: '2026-11-10T10:00:00Z',
      lines: ids.slice(0, 1).map((oeuvre_id) => ({ oeuvre_id, line_status: 'active', insurance_value: 4800, price: null })),
    }],
    works: ws.slice(0, 1).map(work), selection: null, prep: [], people: [], prep_columns: null, on_site: false, layouts: 0,
  }
  const item = (e: EventDetail, extra: Partial<EventListItem>): EventListItem => ({
    id: e.id, nom: e.nom, type: e.type, statut: e.statut, date_debut: e.date_debut, date_fin: e.date_fin, contact_id: e.contact_id,
    works_total: 0, works_out: 0, works_sold: 0, next_return: null, orders_open: 0, steps_late: 0, out_party_ids: [], ...extra,
  })
  return {
    events: [
      item(dunamis, { works_total: 6, works_out: 2, works_sold: 1, next_return: day(10), orders_open: 2, steps_late: 2, out_party_ids: venue ? [venue.ContactID] : [] }),
      item(edition, { works_total: 1, works_out: 1, next_return: day(3), orders_open: 1, out_party_ids: printer ? [printer.ContactID] : [] }),
      item(blank, {}),
    ],
    details: { [dunamis.id]: dunamis, [blank.id]: blank, [edition.id]: edition },
  }
}

/** Same shape as the real actions; writes nothing. */
export function demoApi(details: Record<string, EventDetail>): EventsApi {
  const ok = async () => ({ ok: true as const })
  let n = 900
  return {
    loadEvent: async (id) => (details[id] ? { ok: true, event: details[id] } : { error: 'ev_err_not_found' }),
    patchEventField: ok,
    patchEventStep: ok,
    deleteEventStep: ok,
    addEventStep: async (eventId, nom, position) => ({ ok: true, step: { id: uid(n++), process_id: eventId, nom, statut: 'a_faire', date_echeance: null, position, notes: null, overdue_override: false } }),
    applyStepTemplate: async () => ({ ok: true, steps: [] }),
    tickEventWork: async (_e, _o, _k, on) => ({ ok: true, at: on ? new Date().toISOString() : null }),
    setEventWorkRelation: ok,
    createEventSelection: async (_e, name) => ({ ok: true, id: uid(n++), name }),
    linkEventSelection: ok,
    addWorksToSelection: ok,
    removeWorkFromSelection: ok,
    addEventPerson: async (_e, contact_id, role, position) => ({ ok: true, person: { id: uid(n++), contact_id, role, position } }),
    removeEventPerson: ok,
    setEventPrepColumns: ok,
    setEventOnSite: ok,
    createEvent: async ({ nom, type }) => ({ ok: true, event: { id: uid(n++), nom, type, statut: 'prevue', date_debut: null, date_fin: null, contact_id: null, works_total: 0, works_out: 0, works_sold: 0, next_return: null, orders_open: 0, steps_late: 0, out_party_ids: [] } }),
    deleteEvent: ok,
  }
}
