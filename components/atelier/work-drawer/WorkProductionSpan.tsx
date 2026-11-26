'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { setProductionDate, setProductionOrigin } from '@/app/atelier/works/production-actions'
import { stepDateInput, stepDateLabel, type DatePrecision } from '@/lib/work-periods'

type PDate = { on: string | null; precision: DatePrecision }

function toPartial(on: string | null | undefined, precision: string | null | undefined): PDate {
  const p: DatePrecision = precision === 'year' || precision === 'month' ? precision : 'day'
  return { on: on?.slice(0, 10) || null, precision: p }
}

/** 'YYYY-MM-DD' as a local calendar day (no UTC shift). */
function parseDay(day: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

const asField = (d: PDate) => stepDateInput({ on_date: d.on, date_precision: d.precision })

/**
 * Production span for a work. Ticking Catalogué or Archive artiste ends production (trigger,
 * supabase/sql/oeuvres_production_span.sql), un-ticking reopens it. Start and end can be set by hand
 * (admin; start owner 2026-11-03, end + year / month / day TODO 3–4 2026-11-14), each saved on its
 * own, outside the drawer's dirty baseline. Days are counted only when both ends are full days.
 */
export function WorkProductionSpan({
  oeuvreId,
  startedOn,
  startedPrecision,
  completedOn,
  completedPrecision,
  origin,
  inProduction,
  editable = false,
  onSaved,
}: {
  oeuvreId: number
  startedOn: string | null | undefined
  startedPrecision?: string | null
  completedOn: string | null | undefined
  completedPrecision?: string | null
  origin: 'new' | 'found' | null | undefined
  inProduction: boolean
  editable?: boolean
  /** The new / found door's saved fields, for the open work's list (no page refresh). */
  onSaved?: (saved: { production_origin: 'new' | 'found' | null; production_started_on: string | null; production_started_precision: 'year' | 'month' | 'day' | null }) => void
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const [start, setStart] = useState<PDate>(() => toPartial(startedOn, startedPrecision))
  const [end, setEnd] = useState<PDate>(() => toPartial(completedOn, completedPrecision))
  const [startDraft, setStartDraft] = useState(() => asField(toPartial(startedOn, startedPrecision)))
  const [endDraft, setEndDraft] = useState(() => asField(toPartial(completedOn, completedPrecision)))
  const [busy, setBusy] = useState(false)
  const [org, setOrg] = useState(origin ?? null)
  useEffect(() => setOrg(origin ?? null), [oeuvreId, origin])

  useEffect(() => {
    const s = toPartial(startedOn, startedPrecision)
    const e = toPartial(completedOn, completedPrecision)
    setStart(s)
    setEnd(e)
    setStartDraft(asField(s))
    setEndDraft(asField(e))
  }, [oeuvreId, startedOn, startedPrecision, completedOn, completedPrecision])

  const label = (d: PDate) => stepDateLabel({ on_date: d.on, date_precision: d.precision }, locale)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDay = start.precision === 'day' ? parseDay(start.on) : null
  const endDay = end.precision === 'day' ? parseDay(end.on) : null

  let text: string | null = null
  if (start.on && end.on) {
    text = startDay && endDay
      ? t('wf_production_span_fmt').replace('{start}', label(start)).replace('{end}', label(end)).replace('{days}', String(daysBetween(startDay, endDay)))
      : t('wf_production_span_nodays_fmt').replace('{start}', label(start)).replace('{end}', label(end))
  } else if (start.on) {
    text = startDay
      ? t('wf_production_open_fmt').replace('{start}', label(start)).replace('{days}', String(daysBetween(startDay, today)))
      : t('wf_production_open_nodays_fmt').replace('{start}', label(start))
  } else if (end.on) {
    text = t('wf_production_end_only_fmt').replace('{end}', label(end))
  } else if (inProduction) {
    text = t('wf_production_unknown_open')
  }
  if (!text && !editable && org !== 'found') return null

  async function saveOrigin(next: 'new' | 'found') {
    setBusy(true)
    try {
      const res = await setProductionOrigin(oeuvreId, next)
      if ('error' in res) return void toast.error(`${t('error_prefix')} ${res.error}`)
      setOrg(res.saved.production_origin)
      const s = toPartial(res.saved.production_started_on, res.saved.production_started_precision)
      setStart(s)
      setStartDraft(asField(s))
      onSaved?.(res.saved)
      toast.success(t('wf_origin_saved'))
    } finally {
      setBusy(false)
    }
  }

  async function save(which: 'start' | 'end') {
    setBusy(true)
    try {
      const res = await setProductionDate(oeuvreId, which, which === 'start' ? startDraft : endDraft)
      if ('error' in res) {
        const msg =
          res.error === 'start_after_end' ? t('wf_production_start_after_end')
          : res.error === 'date' ? t('wf_production_start_invalid')
          : `${t('error_prefix')} ${res.error}`
        toast.error(msg)
        return
      }
      const saved: PDate = { on: res.on, precision: res.precision ?? 'day' }
      if (which === 'start') {
        setStart(saved)
        setStartDraft(asField(saved))
      } else {
        setEnd(saved)
        setEndDraft(asField(saved))
      }
      toast.success(t(which === 'start' ? 'wf_production_start_saved' : 'wf_production_end_saved'))
    } finally {
      setBusy(false)
    }
  }

  const field = (which: 'start' | 'end') => {
    const draft = which === 'start' ? startDraft : endDraft
    const dirty = draft.trim() !== asField(which === 'start' ? start : end)
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <label className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ minWidth: 110 }}>{t(which === 'start' ? 'wf_production_start_label' : 'wf_production_end_label')}</span>
          <input
            type="text"
            inputMode="numeric"
            className="input"
            value={draft}
            placeholder={t('wf_production_date_ph')}
            disabled={busy}
            onChange={(e) => (which === 'start' ? setStartDraft : setEndDraft)(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty) {
                e.preventDefault()
                void save(which)
              }
            }}
            data-testid={which === 'start' ? 'work-production-start' : 'work-production-end'}
            style={{ fontSize: 12, minHeight: 44, width: 170 }}
          />
        </label>
        {dirty ? (
          <button
            type="button"
            className="btn sm"
            disabled={busy}
            onClick={() => void save(which)}
            data-testid={which === 'start' ? 'work-production-start-save' : 'work-production-end-save'}
            style={{ minHeight: 44 }}
          >
            {t('wf_production_start_save')}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div data-testid="work-production-span" style={{ marginTop: 4 }}>
      {text || org === 'found' ? (
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>
          <span style={{ color: 'var(--tx3)' }}>{t('wf_production_label')} · </span>
          {text}
          {org === 'found' ? <span style={{ color: 'var(--tx3)' }}>{text ? ' · ' : ''}{t('wf_production_origin_found')}</span> : null}
        </div>
      ) : null}
      {editable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <div role="group" aria-label={t('session_origin_label')} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: 520 }}>
            {(['new', 'found'] as const).map((o) => (
              <button
                key={o}
                type="button"
                className="btn ghost sm"
                aria-pressed={org === o}
                disabled={busy || org === o}
                data-testid={`work-production-origin-${o}`}
                onClick={() => void saveOrigin(o)}
                style={{ minHeight: 44, whiteSpace: 'normal', background: org === o ? 'var(--ac)' : undefined, color: org === o ? 'var(--bg0)' : undefined }}
              >
                {t(o === 'new' ? 'wf_origin_new' : 'wf_origin_found')}
              </button>
            ))}
          </div>
          {field('start')}
          {field('end')}
          <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('wf_production_start_hint')}</span>
        </div>
      ) : null}
    </div>
  )
}
