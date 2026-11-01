'use client'

import { useI18n } from '@/lib/i18n/context'

/** 'YYYY-MM-DD' as a local calendar day (no UTC shift). */
function parseDay(day: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

/**
 * Read-only production span for a work. The dates are kept by the database trigger
 * (supabase/sql/oeuvres_production_span.sql): Catalogué ends production, un-ticking reopens it.
 */
export function WorkProductionSpan({
  startedOn,
  completedOn,
  origin,
  inProduction,
}: {
  startedOn: string | null | undefined
  completedOn: string | null | undefined
  origin: 'new' | 'found' | null | undefined
  inProduction: boolean
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const start = parseDay(startedOn)
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
  if (!text) return null

  return (
    <div className="t-mono-sm" data-testid="work-production-span" style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 4 }}>
      <span style={{ color: 'var(--tx3)' }}>{t('wf_production_label')} · </span>
      {text}
      {origin === 'found' ? <span style={{ color: 'var(--tx3)' }}> · {t('wf_production_origin_found')}</span> : null}
    </div>
  )
}
