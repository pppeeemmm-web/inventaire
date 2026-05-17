'use client'

import { RichEditor } from '@/components/atelier/RichEditor'
import { FileImportButton } from './FileImportButton'
import { FlamePreview } from './FlamePreview'
import { ProsePreview } from './ProsePreview'

export function DualField({ label, fr, en, onFr, onEn, rows = 1, placeholder, allowImport, rich, preview = 'flame' }: {
  label: string; fr: string; en: string
  onFr: (v: string) => void; onEn: (v: string) => void
  rows?: number; placeholder?: { fr?: string; en?: string }
  allowImport?: boolean; rich?: boolean; preview?: 'flame' | 'prose'
}) {
  const isRich = rich === true
  const minH = isRich ? 180 : undefined

  return (
    <div>
      <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{label}</div>
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
      {isRich && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>APERÇU FR</div>
            {preview === 'prose' ? <ProsePreview html={fr} /> : <FlamePreview html={fr} />}
          </div>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>APERÇU EN</div>
            {preview === 'prose' ? <ProsePreview html={en} /> : <FlamePreview html={en} />}
          </div>
        </div>
      )}
    </div>
  )
}
