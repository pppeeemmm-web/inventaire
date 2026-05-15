'use client'

import { useI18n } from '@/lib/i18n/context'

type Props = {
  total: number
  loaded: number
  partial: boolean
  compact?: boolean
}

/** Catalogue row count — total always visible; loaded batch when partial. */
export function AtelierCatalogueTotalBadge({ total, loaded, partial, compact }: Props) {
  const { t } = useI18n()
  const title = partial ? t('atelier_header_works_badge_title') : undefined

  return (
    <div
      data-testid="atelier-catalogue-total"
      className="t-mono-sm"
      title={title}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'baseline',
        gap: compact ? 3 : 5,
        letterSpacing: 0.6,
        color: 'var(--tx)',
        fontWeight: 600,
        fontSize: compact ? 10 : 9,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: compact ? 14 : 12, color: 'var(--ac)', fontWeight: 700 }}>{total}</span>
      <span style={{ opacity: 0.55, textTransform: 'uppercase' }}>{t('inventoryWorksBadge')}</span>
      {partial ? (
        <span style={{ opacity: 0.45, fontWeight: 400, fontSize: compact ? 9 : 8 }}>
          ({loaded})
        </span>
      ) : null}
    </div>
  )
}
