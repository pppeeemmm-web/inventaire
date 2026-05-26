'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { MessageKey } from '@/lib/i18n/messages'

const FADE_MASK =
  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)'

type EditorFadeShellProps = {
  expanded: boolean
  onToggle: () => void
  /** Clipped preview while collapsed (fades toward bottom). */
  preview?: ReactNode
  /** Full editor / fields when expanded. */
  children: ReactNode
  maxCollapsedPx?: number
  expandLabelKey?: MessageKey
  collapseLabelKey?: MessageKey
  /** Optional note beside the toggle label (e.g. live preview). */
  headerNote?: string
}

export function EditorFadeShell({
  expanded,
  onToggle,
  preview,
  children,
  maxCollapsedPx = 88,
  expandLabelKey = 'editor_fade_expand',
  collapseLabelKey = 'editor_fade_collapse',
  headerNote,
}: EditorFadeShellProps) {
  const { t } = useI18n()

  const headerBtnStyle: CSSProperties = {
    width: '100%',
    background: expanded ? 'var(--bg1)' : 'var(--bg0)',
    border: 'none',
    borderBottom: expanded || (!expanded && preview) ? '1px solid var(--bd)' : 'none',
    cursor: 'pointer',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--tx2)',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'inherit',
    minHeight: 44,
    textAlign: 'left',
  }

  return (
    <div
      style={{
        border: '1px solid var(--bd)',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--bg0)',
      }}
    >
      <button type="button" className="t-mono-xs" style={headerBtnStyle} onClick={onToggle}>
        <span
          style={{
            fontSize: 10,
            transition: 'transform .15s',
            transform: expanded ? 'rotate(90deg)' : 'none',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          ▸
        </span>
        <span style={{ flex: 1 }}>
          {expanded ? t(collapseLabelKey) : t(expandLabelKey)}
        </span>
        {headerNote ? (
          <span style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 0.5, textTransform: 'none' }}>
            {headerNote}
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div style={{ padding: '12px 14px' }}>{children}</div>
      ) : preview ? (
        <div
          style={{
            position: 'relative',
            maxHeight: maxCollapsedPx,
            overflow: 'hidden',
          }}
        >
          <div style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}>
            {preview}
          </div>
        </div>
      ) : null}
    </div>
  )
}
