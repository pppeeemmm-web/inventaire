'use client'

import Link from 'next/link'
import { useState, useTransition, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { generateFieldDocument, type FieldDocType } from '@/app/atelier/documents/actions'

export function DocumentsNewClient() {
  const { t } = useI18n()
  const [docType, setDocType] = useState<FieldDocType>('coa')
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
      const res = await generateFieldDocument(docType, id)
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {(
          [
            ['coa', 'documents_new_type_coa'],
            ['consignment', 'documents_new_type_consignment'],
            ['invoice', 'documents_new_type_invoice'],
          ] as const
        ).map(([val, key]) => (
          <button
            key={val}
            type="button"
            className={`btn ghost sm${docType === val ? ' primary' : ''}`}
            style={{ minHeight: 44, justifyContent: 'flex-start' }}
            onClick={() => setDocType(val)}
          >
            {t(key)}
          </button>
        ))}
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

      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 12, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
