'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'

/** A filter chip: an active one shows « ✕ » and removes itself; an inactive one applies itself. `removable={false}`: a choice
 * (one of a set is always on, e.g. « En cours » / « Faites »), so no « ✕ ». */
export function PhoneChip({ label, active = false, onClick, testId, children, removable = true }: {
  label: string
  active?: boolean
  onClick: () => void
  testId?: string
  children?: ReactNode
  removable?: boolean
}) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      aria-label={active && removable ? t('phone_chip_remove_fmt').replace('{label}', label) : undefined}
      style={{
        flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px',
        borderRadius: 22, border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`, font: 'inherit', fontSize: 14,
        background: active ? 'color-mix(in srgb, var(--ac) 16%, var(--bg1))' : 'var(--bg1)', color: 'var(--tx)', cursor: 'pointer',
      }}
    >
      {label}
      {children}
      {active && removable ? <span aria-hidden="true">✕</span> : null}
    </button>
  )
}

const row: CSSProperties = { display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 8, scrollbarWidth: 'none' }

/**
 * Phone list toolbar (PhonePattern.md): the search alone on a full-width row that stays at the top while the list
 * scrolls, then a row of chips — « Filtres n » (opens the tab's filter sheet), the active filters, or a few
 * one-tap filters when none is active. The tab keeps its own filter state; this only draws it.
 */
export function PhoneListToolbar({ query, onQuery, placeholder, activeCount = 0, onOpenFilters, chips, testId }: {
  query: string
  onQuery: (q: string) => void
  placeholder: string
  activeCount?: number
  /** Omitted when the tab has no filter sheet (its chips are enough). */
  onOpenFilters?: () => void
  chips: ReactNode
  testId?: string
}) {
  const { t } = useI18n()
  return (
    <div data-testid={testId} style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg0)', padding: '6px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 10px', background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12 }}>
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{ flex: 1, minWidth: 0, border: 0, background: 'none', font: 'inherit', fontSize: 16, color: 'var(--tx)', outline: 'none' }}
        />
        {query ? (
          <button type="button" onClick={() => onQuery('')} aria-label={t('phone_search_clear')} style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 22, background: 'var(--bg2, var(--bd))', color: 'var(--tx3)', cursor: 'pointer' }}>✕</button>
        ) : null}
      </div>
      <div style={row}>
        {onOpenFilters ? (
          <PhoneChip label={t('phone_filters')} active={false} onClick={onOpenFilters} testId={testId ? `${testId}-filters` : undefined}>
            {activeCount > 0 ? <span style={{ background: 'var(--ac)', color: 'var(--bg0)', borderRadius: 9, fontSize: 12, padding: '0 6px' }}>{activeCount}</span> : null}
          </PhoneChip>
        ) : null}
        {chips}
      </div>
    </div>
  )
}
