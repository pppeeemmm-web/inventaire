'use client'

import { useState } from 'react'
import { RichEditor } from '@/components/atelier/RichEditor'
import { useI18n } from '@/lib/i18n/context'
import { FileImportButton } from './FileImportButton'
import { FlamePreview } from './FlamePreview'
import { ProsePreview } from './ProsePreview'
import { EditorFadeShell } from './EditorFadeShell'

function richPlainLen(html: string): number {
  return html.replace(/<[^>]*>/g, '').trim().length
}

export function DualField({ label, fr, en, onFr, onEn, rows = 1, placeholder, allowImport, rich, preview = 'flame' }: {
  label: string; fr: string; en: string
  onFr: (v: string) => void; onEn: (v: string) => void
  rows?: number; placeholder?: { fr?: string; en?: string }
  allowImport?: boolean; rich?: boolean; preview?: 'flame' | 'prose'
}) {
  const { lang } = useI18n()
  const isRich = rich === true
  const minH = isRich ? 140 : undefined
  const frLen = richPlainLen(fr)
  const enLen = richPlainLen(en)
  const filled = frLen + enLen > 0
  // Rich fields collapse by default — empty ones become a single bar instead
  // of two tall empty editors; expand to edit.
  const [editExpanded, setEditExpanded] = useState(false)

  const Preview = preview === 'prose' ? ProsePreview : FlamePreview

  const fadePreview = filled ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 12px' }}>
      <Preview html={fr} />
      <Preview html={en} />
    </div>
  ) : null

  // At-a-glance empty/full signal beside the collapse toggle.
  const stateNote = filled
    ? `● FR ${frLen} · EN ${enLen}`
    : `○ ${lang === 'fr' ? 'vide' : 'empty'}`

  const editors = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)' }}>FR</span>
          {allowImport && isRich && <FileImportButton onText={onFr} lang="fr" />}
        </div>
        {isRich
          ? <RichEditor value={fr} onChange={onFr} minHeight={minH} />
          : <input className="input full" value={fr} onChange={e => onFr(e.target.value)}
              placeholder={placeholder?.fr || ''} style={{ width: '100%' }} />
        }
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)' }}>EN</span>
          {allowImport && isRich && <FileImportButton onText={onEn} lang="en" />}
        </div>
        {isRich
          ? <RichEditor value={en} onChange={onEn} minHeight={minH} />
          : <input className="input full" value={en} onChange={e => onEn(e.target.value)}
              placeholder={placeholder?.en || ''} style={{ width: '100%' }} />
        }
      </div>
    </div>
  )

  return (
    <div>
      {label ? <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{label}</div> : null}
      {isRich ? (
        <EditorFadeShell
          expanded={editExpanded}
          onToggle={() => setEditExpanded(v => !v)}
          preview={fadePreview}
          headerNote={stateNote}
          maxCollapsedPx={96}
        >
          {editors}
        </EditorFadeShell>
      ) : (
        editors
      )}
    </div>
  )
}
