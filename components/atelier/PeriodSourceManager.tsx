'use client'

// Periods + source values (owner 2026-11-02): add / edit / delete. Opened from Inventory
// ("Périodes") and from the work drawer's Période & source section. Saves straight away.
// A3 (2026-11-14): periods have start / end DATES and may suggest a place; the places list lives here.

import { useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { isPeriodSourceLoaded, patchPeriodSource, usePeriodSource } from '@/lib/atelier/use-period-source'
import { parsePlaceCoords, effectivePeriod, effectivePlace, periodRange, placeLabel, sortPeriods, sortPlaces, workWhen, type Place, type WorkPeriod } from '@/lib/work-periods'
import { deletePeriod, deletePlace, deleteSource, findPlaceCoords, savePeriod, savePlace, saveSource } from '@/app/atelier/works/period-source-actions'

type Draft = { name: string; start: string; end: string; place: string }
const emptyDraft: Draft = { name: '', start: '', end: '', place: '' }

function toDraft(p: WorkPeriod): Draft {
  return { name: p.name, start: p.start_on, end: p.end_on ?? '', place: p.default_place_id == null ? '' : String(p.default_place_id) }
}

type PlaceDraft = { name: string; address: string; town: string; country: string; coords: string }
const emptyPlace: PlaceDraft = { name: '', address: '', town: '', country: '', coords: '' }

function toPlaceDraft(p: Place): PlaceDraft {
  return {
    name: p.name,
    address: p.address ?? '',
    town: p.town ?? '',
    country: p.country ?? '',
    coords: p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : '',
  }
}

/** "43.29, 5.38" → numbers; '' → nulls; anything else → 'bad'. */
export function PeriodSourceManager({
  works,
  onClose,
}: {
  /** Loaded works, for the per-period / per-source counts. */
  works?: { OeuvreID: number; Année: string | null; production_started_on?: string | null; production_completed_on?: string | null }[]
  onClose?: () => void
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const data = usePeriodSource()
  const periods = useMemo(() => sortPeriods(data.periods), [data.periods])
  const sources = useMemo(() => [...data.sources].sort((a, b) => a.name.localeCompare(b.name)), [data.sources])
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [srcEditing, setSrcEditing] = useState<number | null>(null)
  const [srcName, setSrcName] = useState('')
  const [newSource, setNewSource] = useState('')
  const [busy, setBusy] = useState(false)
  const places = useMemo(() => sortPlaces(data.places), [data.places])
  const [placeEditing, setPlaceEditing] = useState<number | 'new' | null>(null)
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft>(emptyPlace)
  /** Works at each place: their « Création » lines (each place counted once per work), else their period's (Pem 2026-11-14). */
  const placeCounts = useMemo(() => {
    const c = new Map<number, number>()
    if (works) {
      for (const w of works) {
        for (const pl of effectivePlace(w.OeuvreID, workWhen(w), data).route) c.set(pl.id, (c.get(pl.id) ?? 0) + 1)
      }
    } else {
      for (const steps of Object.values(data.creation)) {
        for (const id of new Set(steps.map((s) => s.place_id).filter((x): x is number => x != null))) c.set(id, (c.get(id) ?? 0) + 1)
      }
    }
    return c
  }, [works, data])

  const periodCounts = useMemo(() => {
    const c = new Map<number, number>()
    for (const w of works ?? []) {
      const p = effectivePeriod(w.OeuvreID, workWhen(w), data).period
      if (p) c.set(p.id, (c.get(p.id) ?? 0) + 1)
    }
    return c
  }, [works, data])
  const sourceCounts = useMemo(() => {
    const c = new Map<number, number>()
    for (const ids of Object.values(data.sourcesByWork)) for (const id of ids) c.set(id, (c.get(id) ?? 0) + 1)
    return c
  }, [data.sourcesByWork])

  function fail(code: string) {
    if (code === 'start_year' || code === 'end_year' || code === 'end_before_start') toast.error(t('ps_err_years'))
    else if (code === 'name') toast.error(t('ps_err_name'))
    else if (code === 'duplicate') toast.error(t('ps_err_duplicate'))
    else if (code === 'coords') toast.error(t('ps_err_coords'))
    else toast.error(`${t('error_prefix')} ${code}`)
  }

  async function submitPeriod() {
    setBusy(true)
    try {
      const res = await savePeriod({
        id: typeof editing === 'number' ? editing : undefined,
        name: draft.name,
        start_on: draft.start,
        end_on: draft.end.trim() === '' ? null : draft.end,
        default_place_id: draft.place ? Number(draft.place) : null,
      })
      if ('error' in res) return fail(res.error)
      patchPeriodSource((d) => ({
        ...d,
        periods: [...d.periods.filter((p) => p.id !== res.period.id), res.period],
      }))
      setEditing(null)
      setDraft(emptyDraft)
    } finally {
      setBusy(false)
    }
  }

  async function removePeriod(p: WorkPeriod) {
    if (!window.confirm(t('ps_confirm_delete_period_fmt').replace('{name}', p.name))) return
    setBusy(true)
    try {
      const res = await deletePeriod(p.id)
      if ('error' in res) return fail(res.error)
      patchPeriodSource((d) => ({
        ...d,
        periods: d.periods.filter((x) => x.id !== p.id),
        overrides: Object.fromEntries(Object.entries(d.overrides).filter(([, v]) => v !== p.id)),
      }))
    } finally {
      setBusy(false)
    }
  }

  async function submitPlace() {
    const coords = parsePlaceCoords(placeDraft.coords)
    if (coords === 'bad') return fail('coords')
    setBusy(true)
    try {
      const res = await savePlace({
        id: typeof placeEditing === 'number' ? placeEditing : undefined,
        name: placeDraft.name,
        address: placeDraft.address,
        town: placeDraft.town,
        country: placeDraft.country,
        ...coords,
      })
      if ('error' in res) return res.error === 'duplicate' ? toast.error(t('ps_err_place_duplicate')) : fail(res.error)
      patchPeriodSource((d) => ({ ...d, places: [...d.places.filter((x) => x.id !== res.place.id), res.place] }))
      setPlaceEditing(null)
      setPlaceDraft(emptyPlace)
    } finally {
      setBusy(false)
    }
  }

  /** Coordinates from the address (for the map), on request only. */
  async function fillCoords() {
    setBusy(true)
    try {
      const res = await findPlaceCoords({ address: placeDraft.address, town: placeDraft.town, country: placeDraft.country })
      if ('error' in res) return toast.error(t(res.error === 'empty' ? 'ps_find_coords_empty' : 'ps_find_coords_none'))
      setPlaceDraft((d) => ({ ...d, coords: `${res.latitude}, ${res.longitude}` }))
    } finally {
      setBusy(false)
    }
  }

  async function removePlace(p: Place) {
    const n = placeCounts.get(p.id) ?? 0
    if (!window.confirm(t('ps_confirm_delete_place_fmt').replace('{name}', p.name).replace('{n}', String(n)))) return
    setBusy(true)
    try {
      const res = await deletePlace(p.id)
      if ('error' in res) return fail(res.error)
      patchPeriodSource((d) => ({
        ...d,
        places: d.places.filter((x) => x.id !== p.id),
        periods: d.periods.map((x) => (x.default_place_id === p.id ? { ...x, default_place_id: null } : x)),
        // The lines stay (dated, with their note); only the place goes (on delete set null).
        creation: Object.fromEntries(
          Object.entries(d.creation).map(([k, steps]) => [k, steps.map((st) => (st.place_id === p.id ? { ...st, place_id: null } : st))]),
        ),
      }))
    } finally {
      setBusy(false)
    }
  }

  async function submitSource(id: number | undefined, name: string) {
    setBusy(true)
    try {
      const res = await saveSource({ id, name })
      if ('error' in res) {
        fail(res.error)
        return false
      }
      patchPeriodSource((d) => ({ ...d, sources: [...d.sources.filter((s) => s.id !== res.source.id), res.source] }))
      return true
    } finally {
      setBusy(false)
    }
  }

  async function removeSource(id: number, name: string) {
    const n = sourceCounts.get(id) ?? 0
    if (!window.confirm(t('ps_confirm_delete_source_fmt').replace('{name}', name).replace('{n}', String(n)))) return
    setBusy(true)
    try {
      const res = await deleteSource(id)
      if ('error' in res) return fail(res.error)
      patchPeriodSource((d) => ({
        ...d,
        sources: d.sources.filter((s) => s.id !== id),
        sourcesByWork: Object.fromEntries(
          Object.entries(d.sourcesByWork).map(([k, ids]) => [k, ids.filter((x) => x !== id)]),
        ),
      }))
    } finally {
      setBusy(false)
    }
  }

  const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minHeight: 44 }
  const dateInput: CSSProperties = { fontSize: 13, width: 150, minHeight: 44 }

  const periodForm = (
    <div style={row} data-testid="ps-period-form">
      <input
        className="input"
        style={{ fontSize: 13, flex: 1, minWidth: 160 }}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder={t('ps_period_name_ph')}
        aria-label={t('ps_period_name_ph')}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ps_start')}</span>
        <input
          className="input"
          type="date"
          style={dateInput}
          value={draft.start}
          onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          aria-label={t('ps_start')}
          data-testid="ps-period-start"
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ps_end')}</span>
        <input
          className="input"
          type="date"
          style={dateInput}
          value={draft.end}
          onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          aria-label={t('ps_end')}
          title={t('ps_end_ph')}
          data-testid="ps-period-end"
        />
      </label>
      <select
        className="input"
        style={{ fontSize: 13, minHeight: 44, minWidth: 160, flex: '1 1 160px' }}
        value={draft.place}
        onChange={(e) => setDraft({ ...draft, place: e.target.value })}
        aria-label={t('ps_default_place')}
        title={t('ps_place_from_period_hint')}
      >
        <option value="">{t('ps_default_place_none')}</option>
        {places.map((pl) => (
          <option key={pl.id} value={String(pl.id)}>
            {pl.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => void submitPeriod()}>
        {t('ps_save')}
      </button>
      <button
        type="button"
        className="btn ghost sm"
        style={{ minHeight: 44 }}
        disabled={busy}
        onClick={() => {
          setEditing(null)
          setDraft(emptyDraft)
        }}
      >
        {t('ps_close')}
      </button>
    </div>
  )

  const placeForm = (
    <div style={row} data-testid="ps-place-form">
      <input
        className="input"
        style={{ fontSize: 13, flex: '2 1 160px', minWidth: 140 }}
        value={placeDraft.name}
        onChange={(e) => setPlaceDraft({ ...placeDraft, name: e.target.value })}
        placeholder={t('ps_place_name_ph')}
        aria-label={t('ps_place_name_ph')}
      />
      <input
        className="input"
        style={{ fontSize: 13, flex: '2 1 200px', minWidth: 160 }}
        value={placeDraft.address}
        onChange={(e) => setPlaceDraft({ ...placeDraft, address: e.target.value })}
        placeholder={t('ps_address_ph')}
        aria-label={t('ps_address_ph')}
      />
      <input
        className="input"
        style={{ fontSize: 13, flex: '1 1 110px', minWidth: 100 }}
        value={placeDraft.town}
        onChange={(e) => setPlaceDraft({ ...placeDraft, town: e.target.value })}
        placeholder={t('ps_town_ph')}
        aria-label={t('ps_town_ph')}
      />
      <input
        className="input"
        style={{ fontSize: 13, flex: '1 1 100px', minWidth: 90 }}
        value={placeDraft.country}
        onChange={(e) => setPlaceDraft({ ...placeDraft, country: e.target.value })}
        placeholder={t('ps_country_ph')}
        aria-label={t('ps_country_ph')}
      />
      <input
        className="input"
        style={{ fontSize: 13, flex: '1 1 140px', minWidth: 130 }}
        value={placeDraft.coords}
        onChange={(e) => setPlaceDraft({ ...placeDraft, coords: e.target.value })}
        placeholder={t('ps_coords_ph')}
        aria-label={t('ps_coords_ph')}
        inputMode="decimal"
      />
      <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} title={t('ps_find_coords_hint')}
        data-testid="ps-place-find-coords" onClick={() => void fillCoords()}>
        {t('ps_find_coords')}
      </button>
      <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => void submitPlace()}>
        {t('ps_save')}
      </button>
      <button
        type="button"
        className="btn ghost sm"
        style={{ minHeight: 44 }}
        disabled={busy}
        onClick={() => {
          setPlaceEditing(null)
          setPlaceDraft(emptyPlace)
        }}
      >
        {t('ps_close')}
      </button>
    </div>
  )

  return (
    <section
      data-testid="period-source-manager"
      style={{ border: '1px solid var(--bd)', background: 'var(--bg1)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div className="t-eyebrow">{t('ps_manage')}</div>
        {onClose ? (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={onClose}>
            {t('ps_close')}
          </button>
        ) : null}
      </div>
      <p style={{ fontSize: 12, color: 'var(--tx2)', margin: 0 }}>{t('ps_overlap_hint')}</p>
      {!isPeriodSourceLoaded() ? (
        <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0 }}>{t('ps_loading')}</p>
      ) : null}

      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('ps_period')}</div>
        {periods.length === 0 && editing !== 'new' && isPeriodSourceLoaded() ? (
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '0 0 6px' }}>{t('ps_periods_empty')}</p>
        ) : null}
        {periods.map((p) =>
          editing === p.id ? (
            <div key={p.id}>{periodForm}</div>
          ) : (
            <div key={p.id} style={{ ...row, borderBottom: '1px solid var(--bd)' }} data-testid="ps-period-row">
              <span style={{ fontSize: 13, flex: 1, minWidth: 140 }}>{p.name}</span>
              <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>{periodRange(p, locale)}</span>
              {p.default_place_id != null ? (
                <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }} title={t('ps_default_place')}>
                  → {places.find((pl) => pl.id === p.default_place_id)?.name ?? '?'}
                </span>
              ) : null}
              {works ? (
                <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', minWidth: 64 }}>
                  {t('ps_works_fmt').replace('{n}', String(periodCounts.get(p.id) ?? 0))}
                </span>
              ) : null}
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44 }}
                disabled={busy}
                onClick={() => {
                  setEditing(p.id)
                  setDraft(toDraft(p))
                }}
              >
                {t('ps_rename')}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44, color: 'var(--rust)' }}
                disabled={busy}
                onClick={() => void removePeriod(p)}
              >
                {t('ps_delete')}
              </button>
            </div>
          ),
        )}
        {editing === 'new' ? (
          periodForm
        ) : (
          <button
            type="button"
            className="btn ghost sm"
            style={{ minHeight: 44, marginTop: 4 }}
            disabled={busy || editing != null}
            data-testid="ps-add-period"
            onClick={() => {
              setEditing('new')
              setDraft(emptyDraft)
            }}
          >
            {t('ps_add_period')}
          </button>
        )}
      </div>

      <div data-testid="ps-places">
        <div className="t-label" style={{ marginBottom: 6 }}>{t('ps_places')}</div>
        {places.length === 0 && placeEditing !== 'new' && isPeriodSourceLoaded() ? (
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '0 0 6px' }}>{t('ps_places_empty')}</p>
        ) : null}
        {places.map((pl) =>
          placeEditing === pl.id ? (
            <div key={pl.id}>{placeForm}</div>
          ) : (
            <div key={pl.id} style={{ ...row, borderBottom: '1px solid var(--bd)' }} data-testid="ps-place-row">
              <span style={{ fontSize: 13, flex: 1, minWidth: 140 }} title={pl.address ?? undefined}>
                {placeLabel(pl)}
                {pl.address ? <span className="t-mono-sm" style={{ display: 'block', fontSize: 10, color: 'var(--tx3)' }}>{pl.address}</span> : null}
              </span>
              {pl.latitude != null && pl.longitude != null ? (
                <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
                  {pl.latitude.toFixed(2)}, {pl.longitude.toFixed(2)}
                </span>
              ) : null}
              <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', minWidth: 64 }}>
                {t('ps_works_fmt').replace('{n}', String(placeCounts.get(pl.id) ?? 0))}
              </span>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44 }}
                disabled={busy}
                onClick={() => {
                  setPlaceEditing(pl.id)
                  setPlaceDraft(toPlaceDraft(pl))
                }}
              >
                {t('ps_rename')}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44, color: 'var(--rust)' }}
                disabled={busy}
                onClick={() => void removePlace(pl)}
              >
                {t('ps_delete')}
              </button>
            </div>
          ),
        )}
        {placeEditing === 'new' ? (
          placeForm
        ) : (
          <button
            type="button"
            className="btn ghost sm"
            style={{ minHeight: 44, marginTop: 4 }}
            disabled={busy || placeEditing != null}
            data-testid="ps-add-place"
            onClick={() => {
              setPlaceEditing('new')
              setPlaceDraft(emptyPlace)
            }}
          >
            {t('ps_add_place')}
          </button>
        )}
      </div>

      <div>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('ps_source')}</div>
        {sources.length === 0 && isPeriodSourceLoaded() ? (
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '0 0 6px' }}>{t('ps_sources_empty')}</p>
        ) : null}
        {sources.map((s) => (
          <div key={s.id} style={{ ...row, borderBottom: '1px solid var(--bd)' }} data-testid="ps-source-row">
            {srcEditing === s.id ? (
              <>
                <input
                  className="input"
                  style={{ fontSize: 13, flex: 1, minWidth: 140 }}
                  value={srcName}
                  onChange={(e) => setSrcName(e.target.value)}
                  aria-label={t('ps_rename')}
                />
                <button
                  type="button"
                  className="btn sm"
                  style={{ minHeight: 44 }}
                  disabled={busy}
                  onClick={() => void submitSource(s.id, srcName).then((ok) => { if (ok) setSrcEditing(null) })}
                >
                  {t('ps_save')}
                </button>
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setSrcEditing(null)}>
                  {t('ps_close')}
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, flex: 1, minWidth: 140 }}>{s.name}</span>
                <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', minWidth: 64 }}>
                  {t('ps_works_fmt').replace('{n}', String(sourceCounts.get(s.id) ?? 0))}
                </span>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ minHeight: 44 }}
                  disabled={busy}
                  onClick={() => {
                    setSrcEditing(s.id)
                    setSrcName(s.name)
                  }}
                >
                  {t('ps_rename')}
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ minHeight: 44, color: 'var(--rust)' }}
                  disabled={busy}
                  onClick={() => void removeSource(s.id, s.name)}
                >
                  {t('ps_delete')}
                </button>
              </>
            )}
          </div>
        ))}
        <div style={{ ...row, marginTop: 4 }}>
          <input
            className="input"
            style={{ fontSize: 13, flex: 1, minWidth: 140, maxWidth: 280 }}
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder={t('ps_source_name_ph')}
            aria-label={t('ps_source_name_ph')}
          />
          <button
            type="button"
            className="btn ghost sm"
            style={{ minHeight: 44 }}
            disabled={busy || !newSource.trim()}
            data-testid="ps-add-source"
            onClick={() => void submitSource(undefined, newSource).then((ok) => { if (ok) setNewSource('') })}
          >
            {t('ps_add_source')}
          </button>
        </div>
      </div>
    </section>
  )
}
