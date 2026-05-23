'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'

export default function OfflineFallbackPage() {
  const { t } = useI18n()
  const tk = (key: string) => t(key as DictKey)

  return (
    <main
      data-testid="pwa-offline-fallback"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
        background: 'var(--bg0)',
        color: 'var(--tx)',
        textAlign: 'center',
      }}
    >
      <p className="serif" style={{ fontSize: 22 }}>{tk('pwa_offline_title')}</p>
      <p style={{ fontSize: 14, color: 'var(--tx3)', maxWidth: 360 }}>{tk('pwa_offline_body')}</p>
      <Link href="/hub" className="btn" style={{ minHeight: 44, padding: '10px 20px' }}>
        {tk('pwa_offline_hub')}
      </Link>
    </main>
  )
}
