'use client'

// CurationDock — floating bar visible on non-constellation tabs when selection > 0.
// Shows selection count, batch-edit, export, quick-save group, and constellation jump.

import { useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { BatchEditModal } from '@/components/atelier/BatchEditModal'
import { CatalogPersistModal } from '@/components/atelier/CatalogPersistModal'
import { ExportModal }    from '@/components/atelier/ExportModal'
import { SelectionImagesDownloadModal } from '@/components/atelier/SelectionImagesDownloadModal'
import type { Oeuvre }    from '@/lib/types/database'
import { PEM_Z_INDEX, useBottomChromeHeight } from '@/components/shared/BottomStack'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { SlideshowPlayer } from '@/components/atelier/slideshow/SlideshowPlayer'
import { slideWorksFromOeuvres } from '@/components/atelier/slideshow/slide-works'
import { readRememberedSlideshowSettings, rememberSlideshowSettings } from '@/lib/slideshow'
import { saveSlideshow } from '@/app/atelier/slideshow/actions'
import { ShareKitSheet } from '@/components/atelier/kits/ShareKitSheet'

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
  /** Batch modify hides the fields the server keeps admin-only. */
  isAdmin:            boolean
  /** Theme ids per work (already loaded) — n/N counts on the batch theme chips. */
  oeuvreThemeMap?:    Map<number, number[]>
}

export function CurationDock({
  selection, setSelection,
  oeuvres, techniques, supports, formats, themes, groups, tM, sM, statusLabelMap,
  addresses = [],
  onGoConstellation, onSaveGroup, onCompare, isAdmin, oeuvreThemeMap,
}: Props) {
  const { t } = useI18n()
  const [quickName, setQuickName] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [showBatch, setShowBatch] = useState(false)
  const [showExport,setShowExport]= useState(false)
  const [showImagesZip, setShowImagesZip] = useState(false)
  const [showCatalogPersist, setShowCatalogPersist] = useState(false)
  /** Collector share kit (TODO 11b): the selection, in the order it was selected, frozen into a private link. */
  const [kitIds, setKitIds] = useState<number[] | null>(null)
  // Slides are built once when the slideshow opens (the selection can change underneath).
  const [slideshow, setSlideshow] = useState<ReturnType<typeof slideWorksFromOeuvres> | null>(null)

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

  // Phone (LayoutFixes.notes.md 2026-11-18): one slim bar docked on top of the input bar — count, clear,
  // « Actions » — the actions open in a tray above it; its height feeds --pem-selection-bar-h (toasts, padding).
  const phone = useMediaQuery('(max-width: 767px)')
  const [trayOpen, setTrayOpen] = useState(false)
  const phoneRef = useRef<HTMLDivElement>(null)
  useBottomChromeHeight(phoneRef, '--pem-selection-bar-h', phone)

  const tap: CSSProperties | undefined = phone ? { minHeight: 44 } : undefined

  const count = (
    <div className="row gap-sm" style={{ flexShrink: 0 }}>
      <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>{t('selection')}</div>
      <div style={{ fontSize: 20, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif", lineHeight: 1 }}>
        {ids.length}
      </div>
      <button
        type="button"
        className="btn ghost sm"
        data-testid="curation-clear-selection"
        onClick={() => setSelection(new Set())}
        title={t('selection_clear_title')}
        aria-label={t('selection_clear_title')}
        style={phone ? { minHeight: 44, minWidth: 44 } : undefined}
      >
        {phone ? '✕' : `✕ ${t('clear')}`}
      </button>
    </div>
  )

  const actions = (
    <>
      {/* Batch edit */}
      <button type="button" className="btn sm ghost" data-testid="curation-open-batch" onClick={() => setShowBatch(true)} style={tap}>
        {t('modify')}
      </button>

      {/* Slideshow (TODO R5): the selection, in the order it was selected. */}
      <button
        type="button"
        className="btn sm ghost"
        data-testid="curation-open-slideshow"
        onClick={() => setSlideshow(slideWorksFromOeuvres(ids, oeuvres, tM, sM))}
        title={t('ss_open_title')}
        style={tap}
      >
        {t('ss_open')}
      </button>

      {/* Export */}
      <button type="button" className="btn sm ghost" data-testid="curation-open-export" onClick={() => setShowExport(true)} style={tap}>
        {t('export')}
      </button>

      <button
        type="button"
        className="btn sm ghost"
        data-testid="curation-open-images-zip"
        onClick={() => setShowImagesZip(true)}
        title={t('selection_images_download_title')}
        style={tap}
      >
        {t('curation_dock_download_images')}
      </button>

      <button
        type="button"
        className="btn sm ghost"
        data-testid="curation-open-catalog-persist"
        onClick={() => setShowCatalogPersist(true)}
        title={t('catalogAttachBlurb')}
        style={tap}
      >
        {t('curationDockAttach')}
      </button>

      <button
        type="button"
        className="btn sm ghost"
        data-testid="curation-open-share-kit"
        onClick={() => setKitIds(ids)}
        title={t('ck_share_open')}
        style={tap}
      >
        {t('ck_share_open_short')}
      </button>

      {/* Compare */}
      <button className="btn sm ghost" onClick={onCompare} style={tap}>
        {t('compare')}
      </button>
    </>
  )

  const groupSave = savedName
    ? <div className="t-mono-sm" style={{ color: 'var(--sage)', minWidth: 140 }}>✓ {savedName}</div>
    : <>
        <input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          style={{
            width: phone ? undefined : 130, flex: phone ? 1 : undefined, minWidth: 0,
            padding: '4px 8px', minHeight: phone ? 44 : undefined,
            background: 'var(--bg1)', border: '1px solid var(--bd)',
            fontSize: 10, color: 'var(--tx)',
          }}
        />
        <button className="btn sm" onClick={handleSave} disabled={saving} style={phone ? { minHeight: 44, minWidth: 44 } : undefined}>
          {saving ? '…' : '+'}
        </button>
      </>

  const constellation = (
    <button className="btn sm primary" onClick={onGoConstellation} style={tap}>
      {t('curate')} →
    </button>
  )

  return (
    <>
      {phone ? (
        <div
          ref={phoneRef}
          data-testid="curation-dock"
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 'var(--pem-phone-bar-h)',
            zIndex: PEM_Z_INDEX.curationDock, background: 'var(--bg2)',
            borderTop: '1px solid var(--bd2)', boxShadow: '0 -6px 24px rgba(0,0,0,0.35)',
            paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
            pointerEvents: 'auto', boxSizing: 'border-box',
          }}
        >
          {trayOpen ? (
            <div data-testid="curation-dock-tray" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0 8px', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>{actions}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{groupSave}</div>
              {constellation}
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 52 }}>
            {count}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn sm"
              data-testid="curation-dock-actions"
              aria-expanded={trayOpen}
              title={t('cur_dock_actions_title')}
              onClick={() => setTrayOpen((v) => !v)}
              style={{ minHeight: 44, flexShrink: 0 }}
            >
              {t('cur_dock_actions')} {trayOpen ? '▾' : '▴'}
            </button>
          </div>
        </div>
      ) : (
        <div data-testid="curation-dock" style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          /* Above WorkDrawer (PEM_Z_INDEX.workDrawer); below portaled modals (PEM_Z_INDEX.modal) */
          zIndex: PEM_Z_INDEX.curationDock, background: 'var(--bg2)', border: '1px solid var(--bd2)',
          padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
          // Wraps instead of running off-screen on narrower windows.
          flexWrap: 'wrap', justifyContent: 'center', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          pointerEvents: 'auto',
        }}>
          {/* Count + Clear — kept together at the start so clearing is always reachable */}
          {count}
          <div className="vline" style={{ height: 20 }} />
          {actions}
          <div className="vline" style={{ height: 20 }} />
          {/* Quick group save */}
          {groupSave}
          {/* Constellation */}
          {constellation}
        </div>
      )}

      {showBatch && (
        <BatchEditModal
          ids={ids}
          oeuvres={oeuvres}
          themeIdsByWork={oeuvreThemeMap}
          isAdmin={isAdmin}
          tM={tM}
          techniques={techniques}
          supports={supports}
          formats={formats}
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

      {slideshow && (
        <SlideshowPlayer
          works={slideshow}
          initialSettings={readRememberedSlideshowSettings()}
          onSettingsChange={rememberSlideshowSettings}
          onSave={saveSlideshow}
          onClose={() => setSlideshow(null)}
        />
      )}

      {showImagesZip && (
        <SelectionImagesDownloadModal
          ids={ids}
          onClose={() => setShowImagesZip(false)}
        />
      )}

      {kitIds && (
        <ShareKitSheet source={{ kind: 'works', oeuvreIds: kitIds }} onClose={() => setKitIds(null)} />
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
