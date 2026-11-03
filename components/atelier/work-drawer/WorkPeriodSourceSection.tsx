'use client'

// Work drawer: Période & source (owner 2026-11-02). The period follows the year in the form
// (even unsaved) unless set by hand; sources are toggles. Own saves, outside the drawer's dirty
// baseline, like Constats.

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { isPeriodSourceLoaded, patchPeriodSource, usePeriodSource } from '@/lib/atelier/use-period-source'
import {
  autoPeriodFor,
  effectivePeriod,
  periodChoiceOf,
  periodRange,
  sortPeriods,
  type PeriodChoice,
} from '@/lib/work-periods'
import { setWorkPeriod, setWorkSourceNote, setWorkSources } from '@/app/atelier/works/period-source-actions'
import { PeriodSourceManager } from '@/components/atelier/PeriodSourceManager'

export function WorkPeriodSourceSection({ oeuvreId, year }: { oeuvreId: number; year: number | null }) {
  const { t } = useI18n()
  const data = usePeriodSource()
  const [busy, setBusy] = useState(false)
  const [manage, setManage] = useState(false)
  const periods = useMemo(() => sortPeriods(data.periods), [data.periods])
  const sources = useMemo(() => [...data.sources].sort((a, b) => a.name.localeCompare(b.name)), [data.sources])
  const choice = periodChoiceOf(oeuvreId, data)
  const auto = autoPeriodFor(year, periods)
  const eff = effectivePeriod(oeuvreId, year, data)
  const mine = data.sourcesByWork[oeuvreId] ?? []

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
                ? t('ps_period_auto_fmt').replace('{name}', `${auto.name} · ${periodRange(auto)}`)
                : t('ps_period_auto_empty')}
            </option>
            <option value="none">{t('ps_period_none')}</option>
            {periods.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} · {periodRange(p)}
              </option>
            ))}
          </select>
          {eff.period ? (
            <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
              {eff.overridden ? t('ps_period_by_hand') : t('ps_period_from_year')}
            </span>
          ) : null}
        </div>
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
