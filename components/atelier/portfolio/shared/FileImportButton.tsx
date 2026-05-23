'use client'

import { useState, useRef } from 'react'
import { extractDocumentText } from '@/app/atelier/(portal)/portfolio/actions'
import { useI18n } from '@/lib/i18n/context'

export function FileImportButton({ onText, lang: _lang }: { onText: (v: string) => void; lang: 'fr' | 'en' }) {
  const ref      = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { t } = useI18n()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    const result = await extractDocumentText(fd)
    setBusy(false)
    if ('ok' in result) onText(result.text)
    else alert(`${t('error_prefix')} ${result.error}`)
    e.target.value = ''
  }

  return (
    <>
      <input ref={ref} type="file" accept=".txt,.docx" style={{ display: 'none' }} onChange={handleFile} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        title="Importer depuis fichier (.txt ou .docx)"
        style={{
          background: 'none', border: '1px solid var(--bd)', borderRadius: 3,
          padding: '2px 7px', fontSize: 8, cursor: busy ? 'default' : 'pointer',
          color: 'var(--tx3)', letterSpacing: 1, opacity: busy ? 0.5 : 1,
          fontFamily: 'var(--font-ui)',
        }}
      >
        {busy ? '…' : '↑ fichier'}
      </button>
    </>
  )
}
