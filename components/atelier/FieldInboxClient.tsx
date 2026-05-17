'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { FieldPulseCard, FieldPulseData, FieldPulseMetricKey } from '@/app/atelier/field-inbox/data'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'

const metricKey: Record<FieldPulseMetricKey, DictKey> = {
  past_due: 'field_pulse_metric_past_due',
  today: 'field_pulse_metric_today',
  pending_review: 'field_pulse_metric_pending_review',
  inbox: 'field_pulse_metric_inbox',
}

function formatWhen(value: string | null, lang: 'fr' | 'en') {
  if (!value) return null
  return new Date(value).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renderCardText(card: FieldPulseCard, field: 'title' | 'detail', t: (key: DictKey) => string): string {
  const raw = field === 'title' ? card.title : card.detail
  const key = field === 'title' ? card.titleKey : card.detailKey
  const vars = field === 'title' ? card.titleVars : card.detailVars
  const template = raw ?? (key ? t(key) : '')
  return Object.entries(vars ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template,
  )
}

export function FieldInboxClient({ pulse }: { pulse: FieldPulseData }) {
  const { t, lang } = useI18n()

  return (
    <main
      data-testid="field-inbox-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        maxWidth: 560,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <h1 className="serif" style={{ fontSize: 22, margin: 0 }}>
          {t('field_inbox_title')}
        </h1>
        <p className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 12 }}>
          {t('field_inbox_intro')}
        </p>
      </div>

      <section
        aria-label={t('field_pulse_title')}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        {pulse.metrics.map((metric) => (
          <Link
            key={metric.key}
            href={metric.href}
            className="btn ghost"
            style={{
              minHeight: 64,
              alignItems: 'flex-start',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: 12,
              textAlign: 'left',
              borderColor: metric.tone === 'urgent' && metric.count > 0 ? 'var(--rust)' : 'var(--bd)',
            }}
          >
            <span className="t-eyebrow" style={{ fontSize: 9 }}>
              {t(metricKey[metric.key])}
            </span>
            <strong style={{ fontSize: 22, lineHeight: 1 }}>{metric.count}</strong>
          </Link>
        ))}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="t-eyebrow">{t('field_inbox_queue_heading')}</div>
        {pulse.cards.length === 0 ? (
          <div
            className="t-mono-sm"
            style={{
              border: '1px solid var(--bd)',
              borderRadius: 8,
              padding: 14,
              color: 'var(--tx2)',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {t('field_pulse_empty')}
          </div>
        ) : (
          pulse.cards.map((card) => {
            const when = formatWhen(card.dueAt, lang)
            const title = renderCardText(card, 'title', t)
            const detail = renderCardText(card, 'detail', t)
            return (
              <Link
                key={card.id}
                href={card.href}
                className="btn ghost"
                style={{
                  minHeight: 68,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  padding: 14,
                  textAlign: 'left',
                  whiteSpace: 'normal',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 650 }}>{title}</span>
                <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx2)', lineHeight: 1.35 }}>
                  {detail}
                  {when ? ` · ${when}` : ''}
                </span>
              </Link>
            )
          })
        )}
      </section>

      <FieldHubBackLink style={{ marginTop: 0 }} />
    </main>
  )
}
