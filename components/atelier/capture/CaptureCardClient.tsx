'use client'

import Link from 'next/link'
import { useState, useTransition, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { ingestBusinessCardText } from '@/app/atelier/capture/card-actions'

export function CaptureCardClient() {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [busy, startBusy] = useTransition()

  const inputStyle: CSSProperties = {
    minHeight: 120,
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    background: 'var(--bg0)',
    color: 'var(--tx)',
    fontFamily: 'inherit',
  }

  const submit = () => {
    const raw = text.trim()
    if (!raw) {
      toast.error(t('capture_card_err_empty'))
      return
    }
    startBusy(async () => {
      const res = await ingestBusinessCardText(raw)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(t('capture_card_ok'))
      window.location.href = res.href
    })
  }

  return (
    <main
      data-testid="capture-card-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(80px, calc(24px + env(safe-area-inset-bottom)))',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22 }}>{t('capture_card_title')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('capture_card_intro')}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('capture_card_placeholder')}
        rows={8}
        style={inputStyle}
        aria-label={t('capture_card_placeholder')}
      />
      <button
        type="button"
        className="btn primary"
        style={{ minHeight: 44, width: '100%', marginTop: 16 }}
        disabled={busy}
        onClick={submit}
      >
        {t('capture_card_submit')}
      </button>
      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 12, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
