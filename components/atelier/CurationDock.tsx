'use client'

// CurationDock — floating bar visible on non-constellation tabs when selection > 0.
// Shows selection count, batch-edit, export, quick-save group, and constellation jump.

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { BatchEditModal } from '@/components/atelier/BatchEditModal'
import { CatalogPersistModal } from '@/components/atelier/CatalogPersistModal'
import { ExportModal }    from '@/components/atelier/ExportModal'
import type { Oeuvre }    from '@/lib/types/database'

interface Props {
  selection:          Set<number>
  setSelection:       (s: Set<number>) => void
  oeuvres:            Oeuvre[]
  techniques:         { TechniqueID: number; Technique: string | null }[]
  supports:           { SupportID:   number; Support:   string | null }[]
  formats:            { FormatID:    number; Format:    string | null }[]
  contacts:           { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  themes:             { id: number; name: string }[]
  groups:             { id: string; name: string }[]
  tM:                 Record<number, string>
  sM:                 Record<number, string>
  statusLabelMap:     Record<number, string>
  addresses?:         { id?: number; contact_id: number; label: string; adresse: string | null; ville: string | null; pays: string | null }[]
  onGoConstellation:  () => void
  onSaveGroup:        (name: string, ids: number[]) => Promise<string | null>
  onCompare:          () => void
}

export function CurationDock({
  selection, setSelection,
  oeuvres, techniques, supports, formats, contacts, themes, groups, tM, sM, statusLabelMap,
  addresses = [],
  onGoConstellation, onSaveGroup, onCompare,
}: Props) {
  const { t } = useI18n()
  const [quickName, setQuickName] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [showBatch, setShowBatch] = useState(false)
  const [showExport,setShowExport]= useState(false)
  const [showCatalogPersist, setShowCatalogPersist] = useState(false)

  const ids = [...selection]

  async function handleSave() {
    setSaving(true)
    const nm = quickName.trim() || `${t('selectionGroup')} ${new Date().toLocaleDateString('fr-FR')}`
    const id = await onSaveGroup(nm, ids)
    if (id) {
      setSavedName(nm)
      setQuickName('')
      setTimeout(() => setSavedName(null), 3000)
    }
    setSaving(false)
  }

  return (
    <>
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        /* Above WorkDrawer overlay (z-60); below BatchEdit/Export modals (z-80) */
        zIndex: 75, background: 'var(--bg2)', border: '1px solid var(--bd2)',
        padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}>

        {/* Count */}
        <div className="row gap-sm">
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>{t('selection')}</div>
          <div style={{ fontSize: 20, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif", lineHeight: 1 }}>
            {ids.length}
          </div>
        </div>

        <div className="vline" style={{ height: 20 }} />

        {/* Batch edit */}
        <button type="button" className="btn sm ghost" data-testid="curation-open-batch" onClick={() => setShowBatch(true)}>
          {t('modify')}
        </button>

        {/* Export */}
        <button type="button" className="btn sm ghost" data-testid="curation-open-export" onClick={() => setShowExport(true)}>
          {t('export')}
        </button>

        <button
          type="button"
          className="btn sm ghost"
          data-testid="curation-open-catalog-persist"
          onClick={() => setShowCatalogPersist(true)}
          title={t('catalogAttachBlurb')}
        >
          {t('curationDockAttach')}
        </button>

        {/* Compare */}
        <button className="btn sm ghost" onClick={onCompare}>
          {t('compare')}
        </button>

        <div className="vline" style={{ height: 20 }} />

        {/* Quick group save */}
        {savedName
          ? <div className="t-mono-sm" style={{ color: 'var(--sage)', minWidth: 140 }}>✓ {savedName}</div>
          : <>
              <input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder={t('groupNamePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                style={{
                  width: 130, padding: '4px 8px',
                  background: 'var(--bg1)', border: '1px solid var(--bd)',
                  fontSize: 10, color: 'var(--tx)',
                }}
              />
              <button className="btn sm" onClick={handleSave} disabled={saving}>
                {saving ? '…' : '+'}
              </button>
            </>
        }

        {/* Constellation */}
        <button className="btn sm primary" onClick={onGoConstellation}>
          {t('curate')} →
        </button>

        {/* Clear */}
        <button className="btn ghost sm" onClick={() => setSelection(new Set())}>
          {t('clear')}
        </button>
      </div>

      {showBatch && (
        <BatchEditModal
          ids={ids}
          techniques={techniques}
          supports={supports}
          formats={formats}
          contacts={contacts}
          addresses={addresses}
          themes={themes}
          groups={groups}
          statusLabelMap={statusLabelMap}
          onClose={() => setShowBatch(false)}
          onDone={(count) => {
            setShowBatch(false)
            // Optionally clear selection after edit
          }}
        />
      )}

      {showExport && (
        <ExportModal
          ids={ids}
          oeuvres={oeuvres}
          tM={tM}
          sM={sM}
          statusLabelMap={statusLabelMap}
          catalogThemes={themes}
          catalogGroups={groups}
          onClose={() => setShowExport(false)}
        />
      )}

      {showCatalogPersist && (
        <CatalogPersistModal
          ids={ids}
          catalogThemes={themes}
          catalogGroups={groups}
          onClose={() => setShowCatalogPersist(false)}
        />
      )}
    </>
  )
}
