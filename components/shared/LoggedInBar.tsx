'use client'

import { useI18n } from '@/lib/i18n/context'

type Props = {
  /** Pill text (often acronym for team members). */
  displayName: string
  /** Full name for tooltip / accessibility; defaults to displayName. */
  fullName?: string
}

/** Fixed corner hint — no layout shift, does not capture clicks. */
export function LoggedInBar({ displayName, fullName }: Props) {
  const { t } = useI18n()
  if (!displayName) return null

  const resolvedFull = fullName?.trim() || displayName
  const fullLabel = `${t('portal_connected_as')} ${resolvedFull}`

  return (
    <div
      data-testid="logged-in-bar"
      role="status"
      aria-label={fullLabel}
      title={fullLabel}
      style={{
        position: 'fixed',
        top: 'max(6px, env(safe-area-inset-top, 0px))',
        right: 'max(8px, env(safe-area-inset-right, 0px))',
        zIndex: 120,
        pointerEvents: 'none',
        maxWidth: 'min(42vw, 160px)',
        padding: '2px 7px',
        borderRadius: 999,
        border: '1px solid var(--bd)',
        background: 'color-mix(in srgb, var(--bg0) 88%, transparent)',
        backdropFilter: 'blur(6px)',
        color: 'var(--tx2)',
        fontSize: 9,
        letterSpacing: 0.3,
        lineHeight: 1.25,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        opacity: 0.92,
      }}
    >
      {displayName}
    </div>
  )
}
