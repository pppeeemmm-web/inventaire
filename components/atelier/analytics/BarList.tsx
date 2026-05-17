'use client'

import { useI18n } from '@/lib/i18n/context'

export function BarList({ items, labelKey, valueKey, maxRows = 10 }: {
  items: Record<string, unknown>[]
  labelKey: string
  valueKey: string
  maxRows?: number
}) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const slice = items.slice(0, maxRows)
  const max = slice[0]?.[valueKey] as number | undefined ?? 1
  if (slice.length === 0) return (
    <div className="t-mono-xs" style={{ color: 'var(--tx3)', opacity: 0.5 }}>{t('analytics_barlist_empty')}</div>
  )
  return (
    <div className="col" style={{ gap: 12 }}>
      {slice.map((item, i) => {
        const v = item[valueKey] as number
        const label = String(item[labelKey])
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div
              className="t-mono-sm"
              title={label}
              style={{
                color: 'var(--tx2)',
                fontSize: 12,
                lineHeight: 1.4,
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--bd)', borderRadius: 3, minWidth: 0 }}>
                <div style={{
                  width: `${(v / max) * 100}%`, height: '100%', background: 'var(--ac)', borderRadius: 3,
                }} />
              </div>
              <div className="t-mono-sm" style={{
                minWidth: 52, textAlign: 'right', color: 'var(--tx)', flexShrink: 0, fontSize: 12, fontVariantNumeric: 'tabular-nums',
              }}>
                {v.toLocaleString(numLocale)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
