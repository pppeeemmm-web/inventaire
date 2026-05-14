'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'

/** Placeholder for Ring C verb routes — avoids 404 until sessions/notes/etc. ship. */
export function FieldToolStubPage() {
  const { t } = useI18n()
  return (
    <div
      style={{
        minHeight: '100dvh',
        padding: 'max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        maxWidth: 440,
        margin: '0 auto',
        gap: 20,
        background: 'var(--bg0)',
        color: 'var(--tx)',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
        {t('field_stub_title')}
      </h1>
      <p className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 12 }}>
        {t('field_stub_body')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        <Link href="/atelier" className="btn primary" style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {t('field_stub_cta_atelier')}
        </Link>
        <Link href="/hub" className="btn ghost" style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {t('field_stub_cta_hub')}
        </Link>
      </div>
    </div>
  )
}
