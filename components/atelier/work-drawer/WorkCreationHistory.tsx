'use client'

// Work drawer: « Historique de création » (Pem 2026-11-14: "a history for the creation where 'place'
// is just like 'history'"). Dated lines, each with a step and a place, read like « Historique /
// Provenance »; replaces the single "Place made" select. A field session held at a saved place
// offers a line (« Ajouter »), never added by itself. Own saves, outside the drawer's dirty baseline.

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { patchPeriodSource, usePeriodSource } from '@/lib/atelier/use-period-source'
import {
  CREATION_KINDS,
  effectivePlace,
  nearestPlace,
  parsePlaceCoords,
  parseStepDate,
  placeLabel,
  sortPlaces,
  sortSteps,
  stepDateInput,
  stepDateLabel,
  type CreationKind,
  type CreationStep,
  type Place,
  type WorkWhen,
} from '@/lib/work-periods'
import {
  deleteCreationStep,
  fetchWorkSessionLocations,
  findPlaceCoords,
  saveCreationStep,
  savePlace,
  type SessionLocation,
} from '@/app/atelier/works/period-source-actions'

type Draft = { id?: number; date: string; kind: CreationKind; placeId: string; note: string }
type NewPlace = { name: string; address: string; town: string; country: string; coords: string }

const emptyNewPlace: NewPlace = { name: '', address: '', town: '', country: '', coords: '' }

export function WorkCreationHistory({ oeuvreId, when }: { oeuvreId: number; when: WorkWhen }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const data = usePeriodSource()
  const steps = useMemo(() => data.creation[oeuvreId] ?? [], [data.creation, oeuvreId])
  const places = useMemo(() => sortPlaces(data.places), [data.places])
  const placeById = useMemo(() => new Map(data.places.map((p) => [p.id, p])), [data.places])
  /** With no line, the work is read at its period's place (Pem 2026-11-14) — shown, never written. */
  const periodPlace = steps.length ? null : effectivePlace(oeuvreId, when, data).place
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [newPlace, setNewPlace] = useState<NewPlace | null>(null)

  /** Where the phone was at this work's field sessions (earliest first). */
  const [sessionLocs, setSessionLocs] = useState<SessionLocation[]>([])
  useEffect(() => {
    let live = true
    setSessionLocs([])
    void fetchWorkSessionLocations(oeuvreId).then((res) => {
      if (live && 'ok' in res) setSessionLocs(res.locations)
    })
    return () => {
      live = false
    }
  }, [oeuvreId])
  /** First located session at a saved place (≤ 2 km) not yet in the history (same session, or same place on the same day). */
  const suggestion = useMemo(() => {
    for (const l of sessionLocs) {
      const place = nearestPlace(l.latitude, l.longitude, data.places)
      if (!place) continue
      const known = steps.some((s) => s.work_session_id === l.sessionId || (s.place_id === place.id && l.day != null && s.on_date === l.day))
      if (!known) return { ...l, place }
    }
    return null
  }, [sessionLocs, data.places, steps])

  function dayLabel(iso: string | null): string {
    return iso ? stepDateLabel({ on_date: iso, date_precision: 'day' }, locale) : ''
  }

  function putStep(step: CreationStep) {
    patchPeriodSource((d) => {
      const others = (d.creation[oeuvreId] ?? []).filter((s) => s.id !== step.id)
      return { ...d, creation: { ...d.creation, [oeuvreId]: sortSteps([...others, step]) } }
    })
  }

  async function save() {
    if (!draft) return
    const date = parseStepDate(draft.date)
    if (date === 'bad') return void toast.error(t('cr_err_date'))
    const placeId = draft.placeId ? Number(draft.placeId) : null
    if (!date.on_date && placeId == null && !draft.note.trim()) return void toast.error(t('cr_err_empty'))
    setBusy(true)
    try {
      const res = await saveCreationStep({ id: draft.id, oeuvre_id: oeuvreId, ...date, kind: draft.kind, place_id: placeId, note: draft.note })
      if ('error' in res) return void toast.error(`${t('error_prefix')} ${res.error}`)
      putStep(res.step)
      setDraft(null)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    if (!window.confirm(t('cr_confirm_delete'))) return
    setBusy(true)
    try {
      const res = await deleteCreationStep(id)
      if ('error' in res) return void toast.error(`${t('error_prefix')} ${res.error}`)
      patchPeriodSource((d) => ({ ...d, creation: { ...d.creation, [oeuvreId]: (d.creation[oeuvreId] ?? []).filter((s) => s.id !== id) } }))
      setDraft(null)
    } finally {
      setBusy(false)
    }
  }

  async function addFromSession() {
    if (!suggestion) return
    setBusy(true)
    try {
      const res = await saveCreationStep({
        oeuvre_id: oeuvreId,
        on_date: suggestion.day,
        date_precision: suggestion.day ? 'day' : null,
        kind: 'worked',
        place_id: suggestion.place.id,
        note: null,
        work_session_id: suggestion.sessionId,
      })
      if ('error' in res) return void toast.error(`${t('error_prefix')} ${res.error}`)
      putStep(res.step)
    } finally {
      setBusy(false)
    }
  }

  async function fillNewPlaceCoords() {
    if (!newPlace) return
    setBusy(true)
    try {
      const res = await findPlaceCoords({ address: newPlace.address, town: newPlace.town, country: newPlace.country })
      if ('error' in res) return void toast.error(t(res.error === 'empty' ? 'ps_find_coords_empty' : 'ps_find_coords_none'))
      setNewPlace((d) => (d ? { ...d, coords: `${res.latitude}, ${res.longitude}` } : d))
    } finally {
      setBusy(false)
    }
  }

  /** A place typed right here goes into the list and onto the line being edited. */
  async function addPlaceHere() {
    if (!newPlace || !newPlace.name.trim()) return
    const coords = parsePlaceCoords(newPlace.coords)
    if (coords === 'bad') return void toast.error(t('ps_err_coords'))
    setBusy(true)
    try {
      const res = await savePlace({ name: newPlace.name, address: newPlace.address, town: newPlace.town, country: newPlace.country, ...coords })
      if ('error' in res) {
        toast.error(res.error === 'duplicate' ? t('ps_err_place_duplicate') : `${t('error_prefix')} ${res.error}`)
        return
      }
      patchPeriodSource((d) => ({ ...d, places: [...d.places.filter((x) => x.id !== res.place.id), res.place] }))
      setNewPlace(null)
      setDraft((d) => (d ? { ...d, placeId: String(res.place.id) } : d))
    } finally {
      setBusy(false)
    }
  }

  function openNew() {
    setNewPlace(null)
    setDraft({ date: '', kind: steps.length ? 'worked' : 'started', placeId: '', note: '' })
  }

  function openEdit(s: CreationStep) {
    setNewPlace(null)
    setDraft({ id: s.id, date: stepDateInput(s), kind: s.kind, placeId: s.place_id == null ? '' : String(s.place_id), note: s.note ?? '' })
  }

  const kindLabel = (k: CreationKind) => t(`cr_kind_${k}` as 'cr_kind_worked')
  const muted: React.CSSProperties = { fontSize: 11, color: 'var(--tx3)', margin: 0 }

  return (
    <div data-testid="work-creation-history">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div className="t-label">{t('cr_heading')}</div>
        {!draft ? (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} data-testid="work-creation-add" onClick={openNew}>
            {t('cr_add')}
          </button>
        ) : null}
      </div>

      {steps.length === 0 && !draft ? (
        <p className="t-mono-sm" style={muted} title={periodPlace ? t('ps_place_from_period_hint') : undefined}>
          {periodPlace ? t('cr_empty_period_fmt').replace('{name}', placeLabel(periodPlace)) : t('cr_empty')}
        </p>
      ) : null}

      {steps.length ? (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--bd)' }}>
          {steps.map((s) => {
            const place: Place | undefined = s.place_id == null ? undefined : placeById.get(s.place_id)
            const editing = draft?.id === s.id
            return (
              <li key={s.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                <button
                  type="button"
                  data-testid="work-creation-line"
                  aria-label={t('cr_edit_aria_fmt').replace('{date}', stepDateLabel(s, locale) || t('cr_undated'))}
                  aria-expanded={editing}
                  disabled={busy}
                  onClick={() => (editing ? setDraft(null) : openEdit(s))}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(84px, max-content) 1fr',
                    columnGap: 12,
                    alignItems: 'baseline',
                    width: '100%',
                    minHeight: 44,
                    padding: '8px 2px',
                    background: editing ? 'var(--bg2)' : 'none',
                    border: 0,
                    color: 'var(--tx)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <span className="t-mono-sm" style={{ fontSize: 12, color: s.on_date ? 'var(--tx2)' : 'var(--tx3)', fontStyle: s.on_date ? 'normal' : 'italic' }}>
                    {stepDateLabel(s, locale) || t('cr_undated')}
                  </span>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <span style={{ color: 'var(--tx2)' }}>{kindLabel(s.kind)}</span>
                    {place ? <> · {placeLabel(place)}</> : null}
                    {s.note ? <span style={{ color: 'var(--tx3)' }}> — {s.note}</span> : null}
                    {s.work_session_id ? <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}> · {t('cr_from_session')}</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : null}

      {draft ? (
        <div data-testid="work-creation-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 8, maxWidth: 560 }}>
          <input
            className="input"
            autoFocus
            inputMode="numeric"
            style={{ minHeight: 44, fontSize: 13 }}
            placeholder={t('cr_date_ph')}
            aria-label={t('cr_date_label')}
            data-testid="work-creation-date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
          />
          <select className="input" style={{ minHeight: 44, fontSize: 13 }} aria-label={t('cr_kind_label')} data-testid="work-creation-kind"
            value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CreationKind })}>
            {CREATION_KINDS.map((k) => (
              <option key={k} value={k}>{kindLabel(k)}</option>
            ))}
          </select>
          <select
            className="input"
            style={{ minHeight: 44, fontSize: 13 }}
            aria-label={t('cr_place_label')}
            data-testid="work-creation-place"
            value={draft.placeId}
            onChange={(e) => {
              if (e.target.value === '__new') return setNewPlace({ ...emptyNewPlace })
              setDraft({ ...draft, placeId: e.target.value })
            }}
          >
            <option value="">{t('cr_place_none')}</option>
            {places.map((p) => (
              <option key={p.id} value={String(p.id)}>{placeLabel(p)}</option>
            ))}
            <option value="__new">{t('ps_place_new_option')}</option>
          </select>
          <input className="input" style={{ minHeight: 44, fontSize: 13 }} maxLength={500} placeholder={t('cr_note_ph')} aria-label={t('cr_note_ph')}
            data-testid="work-creation-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }} />

          {newPlace ? (
            <div data-testid="work-place-new" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: 8, border: '1px solid var(--bd)' }}>
              <input className="input" autoFocus style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_place_name_ph')} aria-label={t('ps_place_name_ph')}
                value={newPlace.name} onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') void addPlaceHere() }} />
              <input className="input" style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_address_ph')} aria-label={t('ps_address_ph')}
                value={newPlace.address} onChange={(e) => setNewPlace({ ...newPlace, address: e.target.value })} />
              <input className="input" style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_town_ph')} aria-label={t('ps_town_ph')}
                value={newPlace.town} onChange={(e) => setNewPlace({ ...newPlace, town: e.target.value })} />
              <input className="input" style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_country_ph')} aria-label={t('ps_country_ph')}
                value={newPlace.country} onChange={(e) => setNewPlace({ ...newPlace, country: e.target.value })} />
              <input className="input" style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_coords_ph')} aria-label={t('ps_coords_ph')}
                title={t('ps_place_coords_hint')} value={newPlace.coords} onChange={(e) => setNewPlace({ ...newPlace, coords: e.target.value })} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} title={t('ps_find_coords_hint')}
                  onClick={() => void fillNewPlaceCoords()}>{t('ps_find_coords')}</button>
                <button type="button" className="btn primary sm" style={{ minHeight: 44 }} disabled={busy || !newPlace.name.trim()}
                  data-testid="work-place-new-save" onClick={() => void addPlaceHere()}>{t('ps_place_add_set')}</button>
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy}
                  onClick={() => setNewPlace(null)}>{t('cancel')}</button>
              </div>
            </div>
          ) : null}

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn primary sm" style={{ minHeight: 44 }} disabled={busy || !!newPlace} data-testid="work-creation-save"
              onClick={() => void save()}>{t('ps_save')}</button>
            <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => { setDraft(null); setNewPlace(null) }}>
              {t('cancel')}
            </button>
            {draft.id != null ? (
              <button type="button" className="btn ghost sm" style={{ minHeight: 44, marginLeft: 'auto', color: 'var(--rust)' }} disabled={busy}
                data-testid="work-creation-delete" onClick={() => void remove(draft.id as number)}>{t('cr_delete')}</button>
            ) : null}
          </div>
          {places.length === 0 && !newPlace ? <p className="t-mono-sm" style={{ ...muted, gridColumn: '1 / -1' }}>{t('ps_place_list_empty')}</p> : null}
        </div>
      ) : null}

      {suggestion && !draft ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }} data-testid="work-creation-session-suggest">
          <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', overflowWrap: 'anywhere' }} title={t('cr_session_hint')}>
            {t('cr_session_suggest_fmt').replace('{date}', dayLabel(suggestion.day)).replace('{name}', placeLabel(suggestion.place))}
          </span>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} data-testid="work-creation-session-add"
            onClick={() => void addFromSession()}>
            {t('cr_session_add')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
