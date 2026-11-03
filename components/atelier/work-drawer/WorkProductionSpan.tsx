'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { setProductionStart } from '@/app/atelier/works/production-actions'

/** 'YYYY-MM-DD' as a local calendar day (no UTC shift). */
function parseDay(day: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

/**
 * Production span for a work. The end date is kept by the database trigger
 * (supabase/sql/oeuvres_production_span.sql + oeuvres_status_location_depth_rules.sql):
 * Catalogué or Archive artiste ends production, un-ticking reopens it. The start date can be
 * set by hand (admin, owner 2026-11-03), saved on its own, outside the drawer's dirty baseline.
 */
export function WorkProductionSpan({
  oeuvreId,
  startedOn,
  completedOn,
  origin,
  inProduction,
  editable = false,
}: {
  oeuvreId: number
  startedOn: string | null | undefined
  completedOn: string | null | undefined
  origin: 'new' | 'found' | null | undefined
  inProduction: boolean
  editable?: boolean
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const [savedStart, setSavedStart] = useState<string | null>(startedOn?.slice(0, 10) ?? null)
  const [draft, setDraft] = useState(savedStart ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const s = startedOn?.slice(0, 10) ?? null
    setSavedStart(s)
    setDraft(s ?? '')
  }, [oeuvreId, startedOn])

  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const start = parseDay(savedStart)
  const end = parseDay(completedOn)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let text: string | null = null
  if (start && end) {
    text = t('wf_production_span_fmt')
      .replace('{start}', fmt(start)).replace('{end}', fmt(end)).replace('{days}', String(daysBetween(start, end)))
  } else if (start) {
    text = t('wf_production_open_fmt')
      .replace('{start}', fmt(start)).replace('{days}', String(daysBetween(start, today)))
  } else if (end) {
    text = t('wf_production_end_only_fmt').replace('{end}', fmt(end))
  } else if (inProduction) {
    text = t('wf_production_unknown_open')
  }
  if (!text && !editable) return null

  async function save() {
    setBusy(true)
    try {
      const res = await setProductionStart(oeuvreId, draft || null)
      if ('error' in res) {
        const msg =
          res.error === 'start_after_end' ? t('wf_production_start_after_end')
          : res.error === 'date' ? t('wf_production_start_invalid')
          : `${t('error_prefix')} ${res.error}`
        toast.error(msg)
        return
      }
      setSavedStart(res.startedOn)
      toast.success(t('wf_production_start_saved'))
    } finally {
      setBusy(false)
    }
  }

  const dirty = draft !== (savedStart ?? '')

  return (
    <div data-testid="work-production-span" style={{ marginTop: 4 }}>
      {text ? (
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>
          <span style={{ color: 'var(--tx3)' }}>{t('wf_production_label')} · </span>
          {text}
          {origin === 'found' ? <span style={{ color: 'var(--tx3)' }}> · {t('wf_production_origin_found')}</span> : null}
        </div>
      ) : null}
      {editable ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <label className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('wf_production_start_label')}
            <input
              type="date"
              className="input"
              value={draft}
              max={completedOn?.slice(0, 10) || undefined}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              data-testid="work-production-start"
              style={{ fontSize: 12, minHeight: 44, width: 160 }}
            />
          </label>
          {dirty ? (
            <button
              type="button"
              className="btn sm"
              disabled={busy}
              onClick={() => void save()}
              data-testid="work-production-start-save"
              style={{ minHeight: 44 }}
            >
              {t('wf_production_start_save')}
            </button>
          ) : (
            <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('wf_production_start_hint')}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
