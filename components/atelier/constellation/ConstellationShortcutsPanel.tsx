'use client'

import { forwardRef } from 'react'
import type { DictKey } from '@/lib/i18n/dictionary'

export type ConstellationShortcutsPanelProps = {
  t: (key: DictKey) => string
  panelId: string
}

export const ConstellationShortcutsPanel = forwardRef<HTMLDivElement, ConstellationShortcutsPanelProps>(
  function ConstellationShortcutsPanel({ t, panelId }, ref) {
    return (
      <div
        ref={ref}
        id={panelId}
        role="region"
        aria-label={t('const_toolbarShortcutsPanelTitle')}
        className="t-mono-sm"
        style={{
          position: 'absolute',
          left: 56,
          top: 8,
          zIndex: 30,
          maxWidth: 'min(300px, calc(100vw - 80px))',
          padding: '10px 12px',
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          fontSize: 10,
          lineHeight: 1.5,
          color: 'var(--tx2)',
        }}
      >
        {t('const_toolbar_hint')}
      </div>
    )
  },
)
