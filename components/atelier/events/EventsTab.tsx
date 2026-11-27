'use client'

// R6 « Expositions & événements » (Studio group, the former Exhibitions tab, route /atelier/exhibitions).
// Brief: docs/design/2026-11-17/R6_Events.notes.md (v2 + Round 2). An event's moves are R7 orders.
//
// Speed: the list loads once (names, dates, counts); an event loads its own detail once (cached while the tab
// is open); every save is one field patch and updates the row in place — no list re-fetch after a save or a click.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { emitCatalogueListsChanged } from '@/lib/atelier/catalogue-lists-bus'
import type { Oeuvre } from '@/lib/types/database'
import type { DictKey } from '@/lib/i18n/dictionary'
import { ExhibitionsTabSkeleton } from '@/components/atelier/ExhibitionsTabSkeleton'
import type { ExhibitionGroupsCtx } from '@/components/atelier/exhibitions/exhibitions-types'
import {
  addEventPerson, addEventStep, addWorksToSelection, applyStepTemplate, createEvent, createEventSelection,
  linkEventSelection, listEvents, loadEvent, patchEventField, patchEventStep, removeEventPerson,
  removeWorkFromSelection, setEventOnSite, setEventPrepColumns, setEventWorkRelation, tickEventWork, deleteEventStep,
  type EventDetail, type EventListItem,
} from '@/app/atelier/(portal)/exhibitions/event-actions'
import { deleteExhibitionProcess } from '@/app/atelier/(portal)/exhibitions/actions'
import { R6_EVENTS_SQL_LIVE, asEventKind, type EventKind, type PrepKey } from '@/lib/events/event-model'
import { EventList } from './EventList'
import { EventView } from './EventView'
import { EventPhone } from './EventPhone'
import type { EventContact } from './events-shared'
import { EventsSqlLiveContext } from './events-sql-live'

const realApi = {
  loadEvent, patchEventField, patchEventStep, deleteEventStep, addEventStep, applyStepTemplate, tickEventWork,
  setEventWorkRelation, createEventSelection, linkEventSelection, addWorksToSelection, removeWorkFromSelection,
  addEventPerson, removeEventPerson, setEventPrepColumns, setEventOnSite, createEvent, deleteEvent: deleteExhibitionProcess,
}
export type EventsApi = typeof realApi

type EventField = 'nom' | 'type' | 'statut' | 'date_debut' | 'date_fin' | 'contact_id' | 'localisation' | 'url' | 'notes'

/** What the event screens can do; each returns an error text or null. */
export interface EventHandlers {
  patchField: (field: EventField, value: string | number | null) => Promise<string | null>
  toggleStep: (id: string, done: boolean) => void
  patchStep: (id: string, field: 'nom' | 'date_echeance', value: string | null) => Promise<string | null>
  addStep: (nom: string) => Promise<string | null>
  deleteStep: (id: string) => void
  applyTemplate: () => Promise<string | null>
  tick: (oeuvreId: number, key: PrepKey, on: boolean) => void
  setRelation: (oeuvreId: number, relation: string | null) => Promise<string | null>
  createSelection: (ids: number[]) => Promise<string | null>
  linkGroup: (groupId: string) => Promise<string | null>
  addWorks: (ids: number[]) => Promise<string | null>
  removeWork: (id: number) => Promise<string | null>
  addPerson: (contactId: number, role: string) => Promise<string | null>
  removePerson: (id: string) => Promise<string | null>
  setPrepColumns: (cols: PrepKey[] | null) => Promise<string | null>
  setOnSite: (on: boolean) => Promise<string | null>
  openWork: (id: number) => void
  deleteEvent: () => void
}

interface Props {
  oeuvres: Oeuvre[]
  contacts: EventContact[]
  themes: { id: number; name: string }[]
  tM: Record<number, string>
  statusLabelMap: Record<number, string>
  selection: Set<number>
  groupsCtx: ExhibitionGroupsCtx
}

export function EventsTab({ oeuvres, contacts, themes, tM, statusLabelMap, selection, groupsCtx }: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [events, setEvents] = useState<EventListItem[] | null>(null)
  const [listErr, setListErr] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, EventDetail>>({})
  const [detailErr, setDetailErr] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [groupWorkCount, setGroupWorkCount] = useState(groupsCtx.groupWorkCount)
  useEffect(() => setGroupWorkCount(groupsCtx.groupWorkCount), [groupsCtx.groupWorkCount])

  const errText = useCallback((e: string) => (e.startsWith('ev_err_') ? t(e as DictKey) : `${t('error_prefix')} ${e}`), [t])
  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.ContactID, c])), [contacts])

  const [api, setApi] = useState<EventsApi>(realApi)
  const [demo, setDemo] = useState(false)
  const demoBuilt = useRef(false)

  // List: once. Deep link ?exhibition=<id> (Pipeline drawer) or ?event=<id>.
  useEffect(() => {
    let alive = true
    // Dev-only demo (`?demo=1`): placeholder events on real works, nothing written (events-demo.ts).
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('demo') === '1') {
      setDemo(true)
      return () => { alive = false }
    }
    void listEvents().then((r) => {
      if (!alive) return
      if ('error' in r) { setListErr(r.error); setEvents([]); return }
      setEvents(r.events)
      const sp = new URLSearchParams(window.location.search)
      const deep = sp.get('event') ?? sp.get('exhibition')
      const first = deep && r.events.some((e) => e.id === deep) ? deep : null
      if (first) setSelectedId(first)
      else if (!window.matchMedia('(max-width: 767px)').matches && r.events.length) setSelectedId(r.events[0].id)
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once on open (the demo reads the batch already loaded)
  }, [])

  // The demo waits for the shell's contacts and works (they hydrate after first paint).
  useEffect(() => {
    if (!demo || demoBuilt.current || contacts.length === 0 || oeuvres.length === 0) return
    demoBuilt.current = true
    void import('./events-demo').then((m) => {
      const d = m.buildEventsDemo(oeuvres, contacts)
      setApi(m.demoApi(d.details)); setEvents(d.events)
      if (!window.matchMedia('(max-width: 767px)').matches) setSelectedId(d.events[0].id)
    })
  }, [demo, contacts, oeuvres])

  // Calendar OAuth return banner (CalendarExportStrip connects through /api/calendar/*).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const c = sp.get('calendar')
    if (!c) return
    if (c === 'google_ok') setBanner(t('calendar_oauth_ok_google'))
    else if (c === 'microsoft_ok') setBanner(t('calendar_oauth_ok_microsoft'))
    else {
      const code = sp.get('calendar_err_code') ?? sp.get('calendar_detail')
      setBanner(code ? `${t('calendar_oauth_err')} (${code})` : t('calendar_oauth_err'))
    }
    const u = new URL(window.location.href)
    for (const k of ['calendar', 'calendar_err_code', 'calendar_detail']) u.searchParams.delete(k)
    window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
  }, [t])

  // Detail: loaded once per event while the tab is open.
  useEffect(() => {
    if (!selectedId || details[selectedId]) return
    let alive = true
    setDetailErr(null)
    void api.loadEvent(selectedId).then((r) => {
      if (!alive) return
      if ('error' in r) setDetailErr(errText(r.error))
      else setDetails((d) => ({ ...d, [selectedId]: r.event }))
    })
    return () => { alive = false }
  }, [selectedId, details, errText, api])

  const event = selectedId ? details[selectedId] ?? null : null

  const patchDetail = useCallback((id: string, fn: (e: EventDetail) => EventDetail) => {
    setDetails((d) => (d[id] ? { ...d, [id]: fn(d[id]) } : d))
  }, [])
  const patchListRow = useCallback((id: string, patch: Partial<EventListItem>) => {
    setEvents((l) => l?.map((e) => (e.id === id ? { ...e, ...patch } : e)) ?? l)
  }, [])

  const openWork = useCallback((id: number) => {
    const o = oeuvres.find((w) => w.OeuvreID === id)
    if (o) groupsCtx.onOpen(o)
    else window.location.assign(`/atelier?work=${id}`)
  }, [oeuvres, groupsCtx])

  const handlers: EventHandlers | null = useMemo(() => {
    if (!event) return null
    const id = event.id
    const err = (r: { error: string } | { ok: true }) => ('error' in r ? errText(r.error) : null)
    return {
      async patchField(field, value) {
        const r = await api.patchEventField(id, field, value)
        if ('error' in r) return errText(r.error)
        const v = typeof value === 'string' && value.trim() === '' ? null : value
        patchDetail(id, (e) => ({ ...e, [field]: v }))
        if (['nom', 'type', 'statut', 'date_debut', 'date_fin', 'contact_id'].includes(field)) patchListRow(id, { [field]: v } as Partial<EventListItem>)
        return null
      },
      toggleStep(stepId, done) {
        const next = done ? 'fait' : 'a_faire'
        patchDetail(id, (e) => ({ ...e, steps: e.steps.map((s) => (s.id === stepId ? { ...s, statut: next } : s)) }))
        void api.patchEventStep(stepId, 'statut', next).then((r) => {
          if ('error' in r) {
            patchDetail(id, (e) => ({ ...e, steps: e.steps.map((s) => (s.id === stepId ? { ...s, statut: done ? 'a_faire' : 'fait' } : s)) }))
            alert(errText(r.error))
          }
        })
      },
      async patchStep(stepId, field, value) {
        const r = await api.patchEventStep(stepId, field, value)
        if ('error' in r) return errText(r.error)
        patchDetail(id, (e) => ({ ...e, steps: e.steps.map((s) => (s.id === stepId ? { ...s, [field]: value } : s)) }))
        return null
      },
      async addStep(nom) {
        const r = await api.addEventStep(id, nom, event.steps.length)
        if ('error' in r) return errText(r.error)
        patchDetail(id, (e) => ({ ...e, steps: [...e.steps, r.step] }))
        return null
      },
      deleteStep(stepId) {
        void api.deleteEventStep(stepId).then((r) => {
          if ('error' in r) alert(errText(r.error))
          else patchDetail(id, (e) => ({ ...e, steps: e.steps.filter((s) => s.id !== stepId) }))
        })
      },
      async applyTemplate() {
        const r = await api.applyStepTemplate(id, asEventKind(event.type), lang, event.steps.length)
        if ('error' in r) return errText(r.error)
        patchDetail(id, (e) => ({ ...e, steps: [...e.steps, ...r.steps] }))
        return null
      },
      tick(oeuvreId, key, on) {
        const col = `${key}_at` as const
        const prev = event.prep.find((p) => p.oeuvre_id === oeuvreId)?.[col] ?? null
        const setAt = (at: string | null) => patchDetail(id, (e) => {
          const has = e.prep.some((p) => p.oeuvre_id === oeuvreId)
          const prep = has ? e.prep.map((p) => (p.oeuvre_id === oeuvreId ? { ...p, [col]: at } : p)) : [...e.prep, { oeuvre_id: oeuvreId, relation: null, [col]: at }]
          return { ...e, prep }
        })
        setAt(on ? new Date().toISOString() : null)
        void api.tickEventWork(id, oeuvreId, key, on).then((r) => {
          if ('error' in r) { setAt(prev); alert(errText(r.error)) }
        })
      },
      async setRelation(oeuvreId, relation) {
        const r = await api.setEventWorkRelation(id, oeuvreId, relation)
        if ('error' in r) return errText(r.error)
        patchDetail(id, (e) => ({
          ...e,
          prep: e.prep.some((p) => p.oeuvre_id === oeuvreId)
            ? e.prep.map((p) => (p.oeuvre_id === oeuvreId ? { ...p, relation } : p))
            : [...e.prep, { oeuvre_id: oeuvreId, relation }],
        }))
        return null
      },
      async createSelection(ids) {
        const place = event.contact_id ? contactsById.get(event.contact_id) : undefined
        const year = (event.date_debut ?? new Date().toISOString()).slice(0, 4)
        const name = [event.nom, [place?.NomInstitution ?? null, year].filter(Boolean).join(' ')].join(' — ')
        const r = await api.createEventSelection(id, name, ids)
        if ('error' in r) return errText(r.error)
        emitCatalogueListsChanged({ oeuvreIds: ids })
        // The works' details come with a fresh load of this event only.
        const fresh = await api.loadEvent(id)
        if ('ok' in fresh) setDetails((d) => ({ ...d, [id]: fresh.event }))
        patchListRow(id, { works_total: ids.length })
        return null
      },
      async linkGroup(groupId) {
        const r = await api.linkEventSelection(id, groupId)
        if ('error' in r) return errText(r.error)
        emitCatalogueListsChanged()
        const fresh = await api.loadEvent(id)
        if ('ok' in fresh) setDetails((d) => ({ ...d, [id]: fresh.event }))
        return null
      },
      async addWorks(ids) {
        if (!event.selection) return errText('ev_err_sql_waiting')
        const r = await api.addWorksToSelection(event.selection.id, ids, event.selection.work_ids.length)
        if ('error' in r) return errText(r.error)
        emitCatalogueListsChanged({ oeuvreIds: ids })
        const fresh = await api.loadEvent(id)
        if ('ok' in fresh) setDetails((d) => ({ ...d, [id]: fresh.event }))
        return null
      },
      async removeWork(oeuvreId) {
        if (!event.selection) return null
        const r = await api.removeWorkFromSelection(event.selection.id, oeuvreId)
        if ('error' in r) return errText(r.error)
        emitCatalogueListsChanged({ oeuvreIds: [oeuvreId] })
        patchDetail(id, (e) => (e.selection ? { ...e, selection: { ...e.selection, work_ids: e.selection.work_ids.filter((w) => w !== oeuvreId) } } : e))
        return null
      },
      async addPerson(contactId, role) {
        const r = await api.addEventPerson(id, contactId, role, event.people.length)
        if ('error' in r) return errText(r.error)
        patchDetail(id, (e) => ({ ...e, people: [...e.people, r.person] }))
        return null
      },
      async removePerson(personId) {
        const r = await api.removeEventPerson(personId)
        if ('error' in r) return errText(r.error)
        patchDetail(id, (e) => ({ ...e, people: e.people.filter((p) => p.id !== personId) }))
        return null
      },
      async setPrepColumns(cols) {
        const r = await api.setEventPrepColumns(id, cols)
        if (!('error' in r)) patchDetail(id, (e) => ({ ...e, prep_columns: cols }))
        return err(r)
      },
      async setOnSite(on) {
        const r = await api.setEventOnSite(id, on)
        if (!('error' in r)) patchDetail(id, (e) => ({ ...e, on_site: on }))
        return err(r)
      },
      openWork,
      deleteEvent() {
        if (!confirm(t('exhib_delete_confirm_fmt').replace(/\{name\}/g, event.nom))) return
        void api.deleteEvent(id).then((r) => {
          if ('error' in r) { alert(errText(r.error)); return }
          setEvents((l) => l?.filter((e) => e.id !== id) ?? l)
          setSelectedId(null)
        })
      },
    }
  }, [event, errText, patchDetail, patchListRow, contactsById, lang, openWork, t, api])

  async function create(nom: string, kind: EventKind): Promise<string | null> {
    const r = await api.createEvent({ nom, type: kind })
    if ('error' in r) return errText(r.error)
    setEvents((l) => [r.event, ...(l ?? [])])
    setSelectedId(r.event.id)
    return null
  }

  if (events === null) return <ExhibitionsTabSkeleton />

  const detailPane = !selectedId ? (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 12, padding: 20 }}>{t('ev_select_or_create')}</div>
  ) : detailErr ? (
    <div role="alert" style={{ flex: 1, padding: 20, color: 'var(--rust)', fontSize: 12 }}>{detailErr}</div>
  ) : !event || !handlers ? (
    <div style={{ flex: 1, padding: 20, color: 'var(--tx3)', fontSize: 12 }}>{t('ev_loading')}</div>
  ) : narrow ? (
    <EventPhone event={event} contactsById={contactsById} tM={tM} statusLabelMap={statusLabelMap} onBack={() => setSelectedId(null)} h={handlers} />
  ) : (
    <EventView
      event={event} contacts={contacts} contactsById={contactsById} inventorySelection={selection}
      groupsCtx={groupsCtx} groupWorkCount={groupWorkCount} oeuvres={oeuvres} themes={themes} tM={tM} h={handlers}
    />
  )

  return (
    <EventsSqlLiveContext.Provider value={demo || R6_EVENTS_SQL_LIVE}>
    <div data-testid="exhibitions-root" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%' }}>
      {banner && (
        <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12 }}>{banner}</span>
          <button type="button" className="btn ghost sm" onClick={() => setBanner(null)} style={{ minHeight: 32 }}>{t('close')}</button>
        </div>
      )}
      {listErr && <div role="alert" style={{ padding: '8px 12px', color: 'var(--rust)', fontSize: 12 }}>{errText(listErr)}</div>}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflowY: narrow ? 'auto' : 'hidden' }}>
        {narrow ? (selectedId ? detailPane : (
          <EventList events={events} contactsById={contactsById} selectedId={selectedId} narrow onSelect={setSelectedId} onCreate={create} />
        )) : (
          <>
            <EventList events={events} contactsById={contactsById} selectedId={selectedId} narrow={false} onSelect={setSelectedId} onCreate={create} />
            {detailPane}
          </>
        )}
      </div>
    </div>
    </EventsSqlLiveContext.Provider>
  )
}
