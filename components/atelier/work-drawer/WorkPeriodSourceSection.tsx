'use client'

// Work drawer: Période & source (owner 2026-11-02). The period follows the work's date / year in
// the form (even unsaved) unless set by hand; sources are toggles. Own saves, outside the drawer's
// dirty baseline, like Constats. A3 (2026-11-14): + the place the work was made; the period may
// suggest one, the work never takes it by itself.

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { isPeriodSourceLoaded, patchPeriodSource, usePeriodSource } from '@/lib/atelier/use-period-source'
import {
  autoPeriodFor,
  effectivePeriod,
  periodChoiceOf,
  parsePlaceCoords,
  periodRange,
  placeLabel,
  sortPeriods,
  sortPlaces,
  yearIsShared,
  type PeriodChoice,
  type WorkWhen,
} from '@/lib/work-periods'
import { savePlace, setWorkPeriod, setWorkPlace, setWorkSourceNote, setWorkSources } from '@/app/atelier/works/period-source-actions'
import { PeriodSourceManager } from '@/components/atelier/PeriodSourceManager'

export function WorkPeriodSourceSection({ oeuvreId, when }: { oeuvreId: number; when: WorkWhen }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const data = usePeriodSource()
  const [busy, setBusy] = useState(false)
  const [manage, setManage] = useState(false)
  const periods = useMemo(() => sortPeriods(data.periods), [data.periods])
  const sources = useMemo(() => [...data.sources].sort((a, b) => a.name.localeCompare(b.name)), [data.sources])
  const choice = periodChoiceOf(oeuvreId, data)
  const auto = autoPeriodFor(when, periods)
  const eff = effectivePeriod(oeuvreId, when, data)
  const places = useMemo(() => sortPlaces(data.places), [data.places])
  const placeId = data.workPlaces[oeuvreId] ?? null
  const suggested = placeId == null && eff.period?.default_place_id != null
    ? (data.places.find((p) => p.id === eff.period?.default_place_id) ?? null)
    : null
  const mine = data.sourcesByWork[oeuvreId] ?? []
  /** New place typed right here (Pem 2026-11-14: the list was empty, the select offered no choice). */
  const [newPlace, setNewPlace] = useState<{ name: string; town: string; country: string; coords: string } | null>(null)

  async function addPlaceHere() {
    if (!newPlace || !newPlace.name.trim()) return
    const coords = parsePlaceCoords(newPlace.coords)
    if (coords === 'bad') {
      toast.error(t('ps_err_coords'))
      return
    }
    let addedId: number | null = null
    setBusy(true)
    try {
      const res = await savePlace({ name: newPlace.name, town: newPlace.town, country: newPlace.country, ...coords })
      if ('error' in res) {
        toast.error(res.error === 'duplicate' ? t('ps_err_place_duplicate') : `${t('error_prefix')} ${res.error}`)
        return
      }
      patchPeriodSource((d) => ({ ...d, places: [...d.places.filter((x) => x.id !== res.place.id), res.place] }))
      setNewPlace(null)
      addedId = res.place.id
    } finally {
      setBusy(false)
    }
    // The place just added is the one this work was made in.
    if (addedId != null) await choosePlace(addedId)
  }

  async function choose(next: PeriodChoice) {
    setBusy(true)
    try {
      const res = await setWorkPeriod(oeuvreId, next)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      patchPeriodSource((d) => {
        const overrides = { ...d.overrides }
        if (next === 'auto') delete overrides[oeuvreId]
        else overrides[oeuvreId] = next === 'none' ? null : next
        return { ...d, overrides }
      })
    } finally {
      setBusy(false)
    }
  }

  async function choosePlace(next: number | null) {
    setBusy(true)
    try {
      const res = await setWorkPlace(oeuvreId, next)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      patchPeriodSource((d) => {
        const workPlaces = { ...d.workPlaces }
        if (next == null) delete workPlaces[oeuvreId]
        else workPlaces[oeuvreId] = next
        return { ...d, workPlaces }
      })
    } finally {
      setBusy(false)
    }
  }

  async function toggleSource(id: number) {
    const next = mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]
    setBusy(true)
    try {
      const res = await setWorkSources(oeuvreId, next)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      patchPeriodSource((d) => {
        // An unticked source loses its link row, and its note with it.
        const notes = { ...(d.sourceNotes[oeuvreId] ?? {}) }
        for (const k of Object.keys(notes)) if (!next.includes(Number(k))) delete notes[Number(k)]
        return {
          ...d,
          sourcesByWork: { ...d.sourcesByWork, [oeuvreId]: next },
          sourceNotes: { ...d.sourceNotes, [oeuvreId]: notes },
        }
      })
    } finally {
      setBusy(false)
    }
  }

  async function saveNote(sourceId: number, text: string) {
    if ((data.sourceNotes[oeuvreId]?.[sourceId] ?? '') === text.trim()) return
    const res = await setWorkSourceNote(oeuvreId, sourceId, text)
    if ('error' in res) {
      toast.error(`${t('error_prefix')} ${res.error}`)
      return
    }
    patchPeriodSource((d) => {
      const notes = { ...(d.sourceNotes[oeuvreId] ?? {}) }
      if (res.note) notes[sourceId] = res.note
      else delete notes[sourceId]
      return { ...d, sourceNotes: { ...d.sourceNotes, [oeuvreId]: notes } }
    })
  }

  return (
    <section data-testid="work-period-source" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div className="t-eyebrow">{t('ps_heading')}</div>
        <button
          type="button"
          className="btn ghost sm"
          style={{ minHeight: 44 }}
          onClick={() => setManage((v) => !v)}
          data-testid="work-period-source-manage"
        >
          {manage ? t('ps_close') : t('ps_manage')}
        </button>
      </div>

      {manage ? <PeriodSourceManager onClose={() => setManage(false)} /> : null}

      {!isPeriodSourceLoaded() ? (
        <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0 }}>{t('ps_loading')}</p>
      ) : (
      <>
      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('ps_period')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select
            className="input"
            style={{ fontSize: 13, flex: 1, minWidth: 200, maxWidth: 380, minHeight: 44 }}
            value={choice === 'auto' ? 'auto' : choice === 'none' ? 'none' : String(choice)}
            disabled={busy}
            aria-label={t('ps_period')}
            data-testid="work-period-select"
            onChange={(e) => {
              const v = e.target.value
              void choose(v === 'auto' ? 'auto' : v === 'none' ? 'none' : Number(v))
            }}
          >
            <option value="auto">
              {auto
                ? t('ps_period_auto_fmt').replace('{name}', `${auto.name} · ${periodRange(auto, locale)}`)
                : t('ps_period_auto_empty')}
            </option>
            <option value="none">{t('ps_period_none')}</option>
            {periods.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} · {periodRange(p, locale)}
              </option>
            ))}
          </select>
          {eff.period ? (
            <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
              {eff.overridden ? t('ps_period_by_hand') : when.day ? t('ps_period_from_day') : t('ps_period_from_year')}
            </span>
          ) : null}
        </div>
        {!eff.overridden && yearIsShared(when, periods) ? (
          <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--yellow)', margin: '6px 0 0' }} data-testid="work-period-year-shared">
            {t('ps_period_year_shared_fmt').replace('{year}', String(when.year))}
          </p>
        ) : null}
      </div>

      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('ps_place_made')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="input"
            style={{ fontSize: 13, flex: '1 1 220px', maxWidth: 380, minHeight: 44 }}
            value={placeId == null ? '' : String(placeId)}
            disabled={busy}
            aria-label={t('ps_place_made')}
            data-testid="work-place-select"
            onChange={(e) => {
              if (e.target.value === '__new') return setNewPlace({ name: '', town: '', country: '', coords: '' })
              void choosePlace(e.target.value ? Number(e.target.value) : null)
            }}
          >
            <option value="">{t('ps_place_none')}</option>
            {places.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {placeLabel(p)}
              </option>
            ))}
            <option value="__new">{t('ps_place_new_option')}</option>
          </select>
          {!newPlace ? (
            <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy}
              data-testid="work-place-add" onClick={() => setNewPlace({ name: '', town: '', country: '', coords: '' })}>
              {t('ps_add_place')}
            </button>
          ) : null}
        </div>
        {places.length === 0 && !newPlace ? (
          <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: '6px 0 0' }}>{t('ps_place_list_empty')}</p>
        ) : null}
        {newPlace ? (
          <div data-testid="work-place-new" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8, maxWidth: 520 }}>
            <input className="input" autoFocus style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_place_name_ph')} aria-label={t('ps_place_name_ph')}
              value={newPlace.name} onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') void addPlaceHere() }} />
            <input className="input" style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_town_ph')} aria-label={t('ps_town_ph')}
              value={newPlace.town} onChange={(e) => setNewPlace({ ...newPlace, town: e.target.value })} />
            <input className="input" style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_country_ph')} aria-label={t('ps_country_ph')}
              value={newPlace.country} onChange={(e) => setNewPlace({ ...newPlace, country: e.target.value })} />
            <input className="input" style={{ minHeight: 44, fontSize: 13 }} placeholder={t('ps_coords_ph')} aria-label={t('ps_coords_ph')}
              title={t('ps_place_coords_hint')}
              value={newPlace.coords} onChange={(e) => setNewPlace({ ...newPlace, coords: e.target.value })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn primary sm" style={{ minHeight: 44 }} disabled={busy || !newPlace.name.trim()}
                data-testid="work-place-new-save" onClick={() => void addPlaceHere()}>{t('ps_place_add_set')}</button>
              <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy}
                onClick={() => setNewPlace(null)}>{t('cancel')}</button>
            </div>
          </div>
        ) : null}
        {suggested ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }} title={t('ps_place_from_period_hint')}>
            <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>
              {t('ps_place_suggest_fmt').replace('{name}', suggested.name)}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              style={{ minHeight: 44 }}
              disabled={busy}
              data-testid="work-place-use-suggestion"
              onClick={() => void choosePlace(suggested.id)}
            >
              {t('ps_place_use')}
            </button>
          </div>
        ) : null}
      </div>

      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('ps_source')}</div>
        {sources.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: 0 }}>{t('ps_sources_empty')}</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sources.map((s) => {
              const on = mine.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => void toggleSource(s.id)}
                  data-testid="work-source-chip"
                  style={{
                    minHeight: 44,
                    padding: '6px 12px',
                    fontSize: 13,
                    border: `1px solid ${on ? 'var(--ac)' : 'var(--bd)'}`,
                    background: on ? 'var(--ac)' : 'transparent',
                    color: on ? 'var(--bg0)' : 'var(--tx)',
                    cursor: 'pointer',
                  }}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        )}
        {/* One short line per ticked source: which place, which photo, whose memory. Saved on leaving the field. */}
        {sources.filter((s) => mine.includes(s.id)).map((s) => (
          <label key={`note-${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', minWidth: 90, flexShrink: 0 }}>{s.name}</span>
            <input
              key={`${oeuvreId}-${s.id}-${data.sourceNotes[oeuvreId]?.[s.id] ?? ''}`}
              className="input"
              defaultValue={data.sourceNotes[oeuvreId]?.[s.id] ?? ''}
              maxLength={300}
              placeholder={t('ps_source_note_placeholder')}
              aria-label={t('ps_source_note_aria_fmt').replace('{name}', s.name)}
              data-testid="work-source-note"
              onBlur={(e) => void saveNote(s.id, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              style={{ flex: 1, minWidth: 0, fontSize: 13, minHeight: 44 }}
            />
          </label>
        ))}
      </div>
      </>
      )}
    </section>
  )
}
