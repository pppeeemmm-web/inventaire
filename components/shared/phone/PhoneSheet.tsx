'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'

/**
 * Bottom sheet of the phone pattern (PhonePattern.md): a title, « Fermer », the content, an optional footer pinned
 * at the bottom (e.g. « Voir 42 articles »). Escape and a tap outside close it (PemModalOverlay).
 */
export function PhoneSheet({ title, onClose, footer, testId, children }: {
  title: string
  onClose: () => void
  footer?: ReactNode
  testId?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <PemModalOverlay
      onClose={onClose}
      panelStyle={{
        alignSelf: 'flex-end', width: '100%', maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
        borderRadius: '16px 16px 0 0', padding: 0,
      }}
    >
      <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 4px' }}>
          <h2 style={{ fontSize: 17, margin: 0, flex: 1 }}>{title}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} style={{ minHeight: 44 }}>{t('close')}</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 16px 12px', paddingBottom: footer ? 12 : 'max(16px, env(safe-area-inset-bottom, 0px))', minHeight: 0 }}>{children}</div>
        {footer ? (
          <div style={{ padding: '8px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--bd)' }}>{footer}</div>
        ) : null}
      </div>
    </PemModalOverlay>
  )
}
