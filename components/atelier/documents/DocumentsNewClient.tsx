'use client'

import Link from 'next/link'
import { useState, useTransition, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { generateFieldDocument } from '@/app/atelier/documents/actions'

export function DocumentsNewClient() {
  const { t } = useI18n()
  const [oeuvreId, setOeuvreId] = useState('')
  const [busy, startBusy] = useTransition()

  const inputStyle: CSSProperties = {
    minHeight: 44,
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    background: 'var(--bg0)',
    color: 'var(--tx)',
  }

  const submit = () => {
    const id = parseInt(oeuvreId, 10)
    if (!Number.isFinite(id) || id <= 0) {
      toast.error(t('error_prefix'))
      return
    }
    startBusy(async () => {
      const res = await generateFieldDocument('coa', id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(t('documents_new_ok'))
      window.location.href = res.href
    })
  }

  return (
    <main
      data-testid="documents-new-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(80px, calc(24px + env(safe-area-inset-bottom)))',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22 }}>{t('documents_new_title')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('documents_new_intro')}
      </p>

      <div className="btn ghost sm primary" style={{ minHeight: 44, justifyContent: 'flex-start', marginBottom: 16 }}>
        {t('documents_new_type_coa')}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 12 }}>
        <span>{t('documents_new_oeuvre_label')}</span>
        <input
          type="number"
          inputMode="numeric"
          value={oeuvreId}
          onChange={(e) => setOeuvreId(e.target.value)}
          style={inputStyle}
        />
      </label>

      <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 16 }}>{t('documents_new_preview')}</p>

      <button type="button" className="btn primary" style={{ minHeight: 44, width: '100%' }} disabled={busy} onClick={submit}>
        {t('documents_new_generate')}
      </button>

      <div
        className="t-mono-sm"
        style={{
          marginTop: 18,
          padding: 14,
          border: '1px solid var(--bd)',
          borderRadius: 6,
          background: 'var(--bg1)',
          color: 'var(--tx2)',
          fontSize: 11,
          lineHeight: 1.55,
        }}
      >
        {t('documents_new_order_guidance')}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Link href="/atelier/pipeline" className="btn ghost" style={{ minHeight: 44, flex: 1, textAlign: 'center' }}>
          {t('documents_new_pipeline_link')}
        </Link>
        <Link href="/atelier/vault" className="btn ghost" style={{ minHeight: 44, flex: 1, textAlign: 'center' }}>
          {t('documents_new_vault_link')}
        </Link>
      </div>

      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 12, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
