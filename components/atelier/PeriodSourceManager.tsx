'use client'

// Periods + source values (owner 2026-11-02): add / edit / delete. Opened from Inventory
// ("Périodes") and from the work drawer's Période & source section. Saves straight away.

import { useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { isPeriodSourceLoaded, patchPeriodSource, usePeriodSource } from '@/lib/atelier/use-period-source'
import { effectivePeriod, periodRange, periodYearOf, sortPeriods, type WorkPeriod } from '@/lib/work-periods'
import { deletePeriod, deleteSource, savePeriod, saveSource } from '@/app/atelier/works/period-source-actions'

type Draft = { name: string; start: string; end: string }
const emptyDraft: Draft = { name: '', start: '', end: '' }

function toDraft(p: WorkPeriod): Draft {
  return { name: p.name, start: String(p.start_year), end: p.end_year == null ? '' : String(p.end_year) }
}

export function PeriodSourceManager({
  works,
  onClose,
}: {
  /** Loaded works, for the per-period / per-source counts. */
  works?: { OeuvreID: number; Année: string | null; production_started_on?: string | null }[]
  onClose?: () => void
}) {
  const { t } = useI18n()
  const data = usePeriodSource()
  const periods = useMemo(() => sortPeriods(data.periods), [data.periods])
  const sources = useMemo(() => [...data.sources].sort((a, b) => a.name.localeCompare(b.name)), [data.sources])
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [srcEditing, setSrcEditing] = useState<number | null>(null)
  const [srcName, setSrcName] = useState('')
  const [newSource, setNewSource] = useState('')
  const [busy, setBusy] = useState(false)

  const periodCounts = useMemo(() => {
    const c = new Map<number, number>()
    for (const w of works ?? []) {
      const p = effectivePeriod(w.OeuvreID, periodYearOf(w), data).period
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
    else toast.error(`${t('error_prefix')} ${code}`)
  }

  async function submitPeriod() {
    const start = Number(draft.start)
    const end = draft.end.trim() === '' ? null : Number(draft.end)
    setBusy(true)
    try {
      const res = await savePeriod({
        id: typeof editing === 'number' ? editing : undefined,
        name: draft.name,
        start_year: start,
        end_year: end,
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
  const yearInput: CSSProperties = { fontSize: 13, width: 84 }

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
      <input
        className="input"
        style={yearInput}
        inputMode="numeric"
        value={draft.start}
        onChange={(e) => setDraft({ ...draft, start: e.target.value.replace(/\D/g, '').slice(0, 4) })}
        placeholder={t('ps_start')}
        aria-label={t('ps_start')}
      />
      <input
        className="input"
        style={yearInput}
        inputMode="numeric"
        value={draft.end}
        onChange={(e) => setDraft({ ...draft, end: e.target.value.replace(/\D/g, '').slice(0, 4) })}
        placeholder={t('ps_end_ph')}
        aria-label={t('ps_end')}
      />
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
              <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>{periodRange(p)}</span>
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
