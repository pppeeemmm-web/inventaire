'use client'

import { useI18n } from '@/lib/i18n/context'

type Props = {
  loaded: number
  total: number
  hasMore: boolean
  loading: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onLoadMore: () => void
}

/** Collapsed-by-default partial-catalogue notice (Atelier shell). */
export function OeuvresSubsetBanner({
  loaded,
  total,
  hasMore,
  loading,
  expanded,
  onToggleExpanded,
  onLoadMore,
}: Props) {
  const { t } = useI18n()
  const chip = t('atelier_oeuvres_subset_chip')
    .replace('{loaded}', String(loaded))
    .replace('{total}', String(total))
  const detail = t('atelier_oeuvres_subset_banner')
    .replace('{loaded}', String(loaded))
    .replace('{total}', String(total))

  return (
    <div
      data-testid="atelier-oeuvres-subset-banner"
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--bd)',
        background: 'color-mix(in srgb, var(--warn, #c9a227) 8%, var(--bg2))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px max(12px, env(safe-area-inset-right)) 4px max(12px, env(safe-area-inset-left))',
          minHeight: 36,
          boxSizing: 'border-box',
        }}
      >
        <span
          aria-hidden
          title={chip}
          style={{
            flexShrink: 0,
            fontSize: 14,
            lineHeight: 1,
            color: 'var(--warn, #b8860b)',
          }}
        >
          ⚠
        </span>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={t('atelier_subset_batch_toggle_aria')}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: 0,
            padding: '6px 4px',
            minHeight: 44,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--tx)',
            font: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.02,
            textAlign: 'left',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chip}</span>
          <span aria-hidden style={{ flexShrink: 0, opacity: 0.55, fontSize: 10 }}>
            {expanded ? '▴' : '▾'}
          </span>
        </button>
        {hasMore ? (
          <button
            type="button"
            className="btn ghost sm"
            disabled={loading}
            aria-label={t('atelier_oeuvres_load_more')}
            onClick={() => onLoadMore()}
            style={{
              flexShrink: 0,
              minHeight: 36,
              padding: '6px 10px',
              fontSize: 9,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            {loading ? '…' : t('atelier_oeuvres_load_more_short')}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <p
          className="t-mono-sm"
          style={{
            margin: 0,
            padding: '0 max(12px, env(safe-area-inset-right)) 8px max(12px, env(safe-area-inset-left))',
            color: 'var(--tx2)',
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          {detail}
        </p>
      ) : null}
    </div>
  )
}
