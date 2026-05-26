'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { MessageKey } from '@/lib/i18n/messages'

const FADE_MASK =
  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)'

const toggleBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 0',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--tx3)',
  fontSize: 9,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  minHeight: 44,
}

type EditorFadeShellProps = {
  expanded: boolean
  onToggle: () => void
  /** Clipped preview while collapsed (fade at bottom). */
  preview?: ReactNode
  /** Full editor / fields when expanded. */
  children: ReactNode
  maxCollapsedPx?: number
  expandLabelKey?: MessageKey
  collapseLabelKey?: MessageKey
}

export function EditorFadeShell({
  expanded,
  onToggle,
  preview,
  children,
  maxCollapsedPx = 88,
  expandLabelKey = 'editor_fade_expand',
  collapseLabelKey = 'editor_fade_collapse',
}: EditorFadeShellProps) {
  const { t } = useI18n()

  return (
    <div>
      {!expanded && preview ? (
        <div
          style={{
            position: 'relative',
            maxHeight: maxCollapsedPx,
            overflow: 'hidden',
            marginBottom: 6,
            borderRadius: 4,
            border: '1px solid var(--bd)',
            background: 'var(--bg0)',
          }}
        >
          <div style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}>
            {preview}
          </div>
        </div>
      ) : null}
      {expanded ? children : null}
      <button type="button" className="t-mono-xs" style={toggleBtnStyle} onClick={onToggle}>
        <span
          style={{
            fontSize: 10,
            transition: 'transform .15s',
            transform: expanded ? 'rotate(90deg)' : 'none',
            display: 'inline-block',
          }}
        >
          ▸
        </span>
        {expanded ? t(collapseLabelKey) : t(expandLabelKey)}
      </button>
    </div>
  )
}
