'use client'

import { useMemo, useState } from 'react'
import { RichEditor } from '@/components/atelier/RichEditor'
import { useI18n } from '@/lib/i18n/context'
import { FileImportButton } from './FileImportButton'
import { FlamePreview } from './FlamePreview'
import { ProsePreview } from './ProsePreview'
import { EditorFadeShell } from './EditorFadeShell'

const COLLAPSE_PLAIN_MIN = 120

function richPlainLen(html: string): number {
  return html.replace(/<[^>]*>/g, '').trim().length
}

export function DualField({ label, fr, en, onFr, onEn, rows = 1, placeholder, allowImport, rich, preview = 'flame' }: {
  label: string; fr: string; en: string
  onFr: (v: string) => void; onEn: (v: string) => void
  rows?: number; placeholder?: { fr?: string; en?: string }
  allowImport?: boolean; rich?: boolean; preview?: 'flame' | 'prose'
}) {
  const isRich = rich === true
  const minH = isRich ? 180 : undefined
  const collapsible = useMemo(
    () => isRich && (richPlainLen(fr) + richPlainLen(en) > COLLAPSE_PLAIN_MIN),
    [isRich, fr, en],
  )
  const [editExpanded, setEditExpanded] = useState(!collapsible)

  const Preview = preview === 'prose' ? ProsePreview : FlamePreview

  const fadePreview = collapsible ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 12px' }}>
      <Preview html={fr} />
      <Preview html={en} />
    </div>
  ) : null

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
      <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{label}</div>
      {isRich && collapsible ? (
        <EditorFadeShell
          expanded={editExpanded}
          onToggle={() => setEditExpanded(v => !v)}
          preview={fadePreview}
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
