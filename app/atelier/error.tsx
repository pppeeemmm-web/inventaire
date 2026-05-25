'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { isChunkLoadError, PEM_CHUNK_RELOAD_KEY } from '@/lib/is-chunk-load-error'

export default function AtelierError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()
  const chunkError = isChunkLoadError(error)

  useEffect(() => {
    if (!chunkError) return
    if (sessionStorage.getItem(PEM_CHUNK_RELOAD_KEY) === '1') return
    sessionStorage.setItem(PEM_CHUNK_RELOAD_KEY, '1')
    window.location.reload()
  }, [chunkError])

  const onRetry = () => {
    if (chunkError) {
      sessionStorage.removeItem(PEM_CHUNK_RELOAD_KEY)
      window.location.reload()
      return
    }
    reset()
  }

  return (
    <div style={{ padding: 48, maxWidth: 560, margin: '0 auto', color: 'var(--tx)' }}>
      <h1 style={{ fontSize: 18, marginBottom: 16, color: 'var(--rust)' }}>{t('atelier_error_title')}</h1>
      <p style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 12 }}>
        {chunkError ? t('atelier_error_chunk_body') : t('atelier_error_generic_body')}
      </p>
      <pre
        style={{
          fontSize: 11,
          padding: 12,
          background: 'var(--bg2)',
          border: '1px solid var(--bd)',
          borderRadius: 4,
          overflow: 'auto',
          color: 'var(--tx3)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {error.message}
      </pre>
      <button type="button" className="btn sm" style={{ marginTop: 20 }} onClick={onRetry}>
        {chunkError ? t('atelier_error_reload') : t('atelier_error_retry')}
      </button>
    </div>
  )
}
