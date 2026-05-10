'use client'

// ExportModal — configure and trigger selection export (HTML / PDF).
// Supports cards, grid (N cols), and quick list layouts.
// Export themes are saved to localStorage for reuse.

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  generateExport,
  batchEdit,
  createTheme,
  createWorkingGroup,
  type ExportConfig,
  type ExportFields,
} from '@/app/atelier/selection/actions'
import { stringifyError } from '@/lib/error'
import type { Oeuvre } from '@/lib/types/database'

// ── Theme persistence ─────────────────────────────────────────────────────

const THEME_KEY      = 'pem_export_themes'
const LAST_CFG_KEY   = 'pem_export_last_cfg'

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

interface ExportTheme {
  name:   string
  config: ExportConfig
}

function loadThemes(): ExportTheme[] {
  try { return JSON.parse(localStorage.getItem(THEME_KEY) ?? '[]') } catch { return [] }
}
function saveThemes(themes: ExportTheme[]) {
  try { localStorage.setItem(THEME_KEY, JSON.stringify(themes)) } catch {}
}
function loadLastCfg(): ExportConfig {
  try {
    const raw = localStorage.getItem(LAST_CFG_KEY)
    if (!raw) return DEFAULT_CONFIG
    const saved = JSON.parse(raw)
    // Defensive spread — ensures any new fields added to DEFAULT_CONFIG are present
    return { ...DEFAULT_CONFIG, ...saved, fields: { ...DEFAULT_CONFIG.fields, ...(saved.fields ?? {}) } }
  } catch { return DEFAULT_CONFIG }
}
function saveLastCfg(cfg: ExportConfig) {
  try { localStorage.setItem(LAST_CFG_KEY, JSON.stringify(cfg)) } catch {}
}

// ── Default config ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ExportConfig = {
  format:       'html',
  layout:       'grid',
  columns:      4,
  cardsPerPage: 2,
  rowsPerPage:  4,
  imageSize:    'small',
  imageEmbed:   'linked',
  imageCrop:    'square',
  paper:        'a4',
  orientation:  'portrait',
  appendList:   false,
  fields: {
    image:     true,
    title:     true,
    id:        true,
    year:      true,
    technique: true,
    support:   false,
    dims:      true,
    price:     false,
    status:    false,
    notes:     false,
  },
}

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  ids:             number[]
  oeuvres:         Oeuvre[]
  tM:              Record<number, string>
  sM:              Record<number, string>
  statusLabelMap:  Record<number, string>
  catalogThemes:   { id: number; name: string }[]
  catalogGroups:   { id: string; name: string }[]
  onClose:         () => void
}

// ── Component ─────────────────────────────────────────────────────────────

type PersistMode = 'none' | 'theme' | 'group'

export function ExportModal({
  ids,
  oeuvres,
  tM,
  sM,
  statusLabelMap,
  catalogThemes: initialCatalogThemes,
  catalogGroups: initialCatalogGroups,
  onClose,
}: Props) {
  const { t } = useI18n()
  const [cfg,          setCfg]          = useState<ExportConfig>(DEFAULT_CONFIG)

  const FIELD_LABELS: Record<keyof ExportFields, string> = {
    image:     t('image'),
    title:     t('title'),
    id:        t('reference'),
    year:      t('year'),
    technique: t('technique'),
    support:   t('support'),
    dims:      'Dimensions',
    price:     t('price'),
    status:    t('status'),
    notes:     t('notes'),
  }
  const [savedPresets,   setSavedPresets]   = useState<ExportTheme[]>([])
  const [presetNameInput, setPresetNameInput] = useState('')
  const [activePresetName, setActivePresetName] = useState<string | null>(null)
  const [loadedFlash,   setLoadedFlash]   = useState<string | null>(null)
  const [pending,       startExport]      = useTransition()
  const [error,         setError]         = useState<string | null>(null)
  const [progress,      setProgress]      = useState('')
  const [persistError,  setPersistError]  = useState<string | null>(null)

  const [showSaveSelection, setShowSaveSelection] = useState(false)
  const [persistMode, setPersistMode] = useState<PersistMode>('none')
  const [localCatalogThemes, setLocalCatalogThemes] = useState(initialCatalogThemes)
  const [selectedCatalogThemeId, setSelectedCatalogThemeId] = useState<number | ''>('')
  const [newCatalogThemeName, setNewCatalogThemeName] = useState('')
  const [creatingCatalogTheme, setCreatingCatalogTheme] = useState(false)

  const [localCatalogGroups, setLocalCatalogGroups] = useState(initialCatalogGroups)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newWorkingGroupName, setNewWorkingGroupName] = useState('')
  const [creatingWorkingGroup, setCreatingWorkingGroup] = useState(false)

  useEffect(() => {
    setLocalCatalogThemes(initialCatalogThemes)
  }, [initialCatalogThemes])

  useEffect(() => {
    setLocalCatalogGroups(initialCatalogGroups)
  }, [initialCatalogGroups])

  // Load export presets + last-used config on mount
  useEffect(() => {
    setSavedPresets(loadThemes())
    setCfg(loadLastCfg())
  }, [])

  // Persist config whenever it changes
  useEffect(() => {
    saveLastCfg(cfg)
  }, [cfg])

  function set<K extends keyof ExportConfig>(key: K, val: ExportConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: val }))
    setActivePresetName(null)
  }
  function setField<K extends keyof ExportFields>(key: K, val: boolean) {
    setCfg((prev) => ({ ...prev, fields: { ...prev.fields, [key]: val } }))
    setActivePresetName(null)
  }

  function handleSaveExportPreset() {
    const name = cap(presetNameInput.trim())
    if (!name) return
    const next = [{ name, config: cfg }, ...savedPresets.filter((p) => p.name !== name)]
    setSavedPresets(next)
    saveThemes(next)
    setPresetNameInput('')
    setActivePresetName(name)
  }

  function handleLoadExportPreset(preset: ExportTheme) {
    const merged: ExportConfig = {
      ...DEFAULT_CONFIG,
      ...preset.config,
      fields: { ...DEFAULT_CONFIG.fields, ...(preset.config.fields ?? {}) },
    }
    setCfg(merged)
    setActivePresetName(preset.name)
    setLoadedFlash(preset.name)
    setTimeout(() => setLoadedFlash(null), 1200)
  }

  function handleDeleteExportPreset(name: string) {
    const next = savedPresets.filter((p) => p.name !== name)
    setSavedPresets(next)
    saveThemes(next)
    if (activePresetName === name) setActivePresetName(null)
  }

  function openSaveSelectionDialog() {
    setPersistError(null)
    setError(null)
    setPersistMode('none')
    setSelectedCatalogThemeId('')
    setNewCatalogThemeName('')
    setSelectedGroupId('')
    setNewWorkingGroupName('')
    setShowSaveSelection(true)
  }

  async function handleCreateCatalogTheme() {
    const name = newCatalogThemeName.trim()
    if (!name) return
    setCreatingCatalogTheme(true)
    const res = await createTheme(name)
    if (res.theme) {
      setLocalCatalogThemes((prev) =>
        [...prev, res.theme!].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      )
      setSelectedCatalogThemeId(res.theme.id)
      setNewCatalogThemeName('')
    } else if (res.error) {
      setError(res.error)
    }
    setCreatingCatalogTheme(false)
  }

  async function handleCreateWorkingGroup() {
    const name = newWorkingGroupName.trim()
    if (!name) return
    setCreatingWorkingGroup(true)
    const res = await createWorkingGroup(name)
    if (res.group) {
      setLocalCatalogGroups((prev) =>
        [...prev.filter((g) => g.id !== res.group!.id), res.group!].sort((a, b) =>
          a.name.localeCompare(b.name, 'fr'),
        ),
      )
      setSelectedGroupId(res.group.id)
      setNewWorkingGroupName('')
    } else if (res.error) {
      setError(res.error)
    }
    setCreatingWorkingGroup(false)
  }

  const runDownload = useCallback((r: { content: string; mime: string; filename: string }) => {
    const content = r.content
    const blobType = r.mime
    if (r.mime === 'application/pdf') {
      const binary = atob(content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: blobType })
      triggerDownload(URL.createObjectURL(blob), r.filename)
    } else {
      const blob = new Blob([content], { type: `${blobType};charset=utf-8` })
      triggerDownload(URL.createObjectURL(blob), r.filename)
    }
  }, [])

  function runExportAndPersist() {
    setError(null)
    setPersistError(null)

    if (persistMode === 'theme' && selectedCatalogThemeId === '') {
      setError(t('exportThemeRequired'))
      return
    }
    if (persistMode === 'group' && !selectedGroupId) {
      setError(t('exportGroupRequired'))
      return
    }

    const heavy = cfg.format === 'pdf' || (cfg.imageEmbed === 'embedded' && ids.length > 30)
    setProgress(heavy ? `Récupération des images pour ${ids.length} œuvres…` : t('generating'))

    startExport(async () => {
      try {
        const r = await generateExport(ids, cfg, tM, sM, statusLabelMap)
        setProgress('')
        if ('error' in r) {
          setError(stringifyError(r.error))
          return
        }

        runDownload(r)

        let persistOk = true
        if (persistMode === 'theme' && selectedCatalogThemeId !== '') {
          const br = await batchEdit(ids, { addThemeIds: [selectedCatalogThemeId as number] })
          if ('error' in br) {
            setPersistError(`${t('exportPersistError')} ${br.error}`)
            persistOk = false
          }
        } else if (persistMode === 'group' && selectedGroupId) {
          const br = await batchEdit(ids, { addGroupIds: [selectedGroupId] })
          if ('error' in br) {
            setPersistError(`${t('exportPersistError')} ${br.error}`)
            persistOk = false
          }
        }

        setShowSaveSelection(false)
        if (persistOk) onClose()
      } catch (e) {
        setProgress('')
        setError(stringifyError(e))
      }
    })
  }

  useEffect(() => {
    if (!showSaveSelection) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        ev.stopPropagation()
        setShowSaveSelection(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [showSaveSelection])

  const isEmbedHeavy = cfg.format === 'html' && cfg.imageEmbed === 'embedded' && cfg.fields.image && ids.length > 20

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', width: 680, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('exportSelection')}</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 24 }}>
            {ids.length} {t('works')}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'auto' }}>

          {/* ── Config panel ────────────────────────────────── */}
          <div style={{ flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20, borderRight: '1px solid var(--bd)', overflow: 'auto' }}>

            {/* Format */}
            <Section label="FORMAT">
              <ToggleRow
                options={[{ v: 'html', l: 'HTML' }, { v: 'pdf', l: 'PDF' }]}
                value={cfg.format} onChange={(v) => {
                  set('format', v as 'html' | 'pdf')
                  if (v === 'html') set('paper', 'screen')
                  if (v === 'pdf' && cfg.paper === 'screen') set('paper', 'a4')
                }}
              />
            </Section>

            {/* Title */}
            <Section label={t('exportTitle')}>
              <input
                className="input"
                placeholder={t('exportTitlePlaceholder')}
                value={cfg.exportTitle ?? ''}
                onChange={(e) => set('exportTitle', e.target.value || null)}
                style={{ width: '100%', fontSize: 11 }}
              />
            </Section>

            {/* Layout */}
            <Section label={t('layout')}>
              <ToggleRow
                options={[
                  { v: 'cards', l: t('fiches') },
                  { v: 'grid',  l: t('grille') },
                  { v: 'list',  l: t('listeRapide') },
                ]}
                value={cfg.layout} onChange={(v) => set('layout', v as ExportConfig['layout'])}
              />
              {cfg.layout === 'grid' && (
                <div style={{ marginTop: 10 }}>
                  <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                    <span className="t-label">Lignes / page :</span>
                    {([2, 3, 4, 5, 6, 8, 10] as const).map((n) => (
                      <button key={n} className={`btn sm ${cfg.rowsPerPage === n ? 'primary' : 'ghost'}`}
                        onClick={() => set('rowsPerPage', n)}>{n}</button>
                    ))}
                  </div>
                </div>
              )}
              {cfg.layout === 'cards' && (
                <div className="row gap-sm" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="t-label">{t('cardsPerPage')} :</span>
                  {([1, 2, 3, 4, 5, 6] as const).map((n) => (
                    <button key={n} className={`btn sm ${cfg.cardsPerPage === n ? 'primary' : 'ghost'}`}
                      onClick={() => set('cardsPerPage', n as ExportConfig['cardsPerPage'])}>{n}</button>
                  ))}
                </div>
              )}
              {cfg.layout !== 'list' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={cfg.appendList}
                    onChange={(e) => set('appendList', e.target.checked)} />
                  <span className="t-mono-sm" style={{ color: cfg.appendList ? 'var(--tx)' : 'var(--tx3)' }}>
                    {t('appendIndex')}
                  </span>
                </label>
              )}
            </Section>

            {/* Fields */}
            <Section label={t('displayedFields')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {(Object.entries(cfg.fields) as [keyof ExportFields, boolean][]).map(([k, v]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={v} onChange={(e) => setField(k, e.target.checked)} />
                    <span className="t-mono-sm" style={{ color: v ? 'var(--tx)' : 'var(--tx3)' }}>
                      {FIELD_LABELS[k]}
                    </span>
                  </label>
                ))}
              </div>
            </Section>

            {/* Image options */}
            {cfg.fields.image && (
              <>
                <Section label={t('imageSize')}>
                  <ToggleRow
                    options={[{ v: 'large', l: t('large') }, { v: 'small', l: t('small') }, { v: 'none', l: t('none') }]}
                    value={cfg.imageSize} onChange={(v) => set('imageSize', v as ExportConfig['imageSize'])}
                  />
                </Section>
                <Section label={t('imageFormat')}>
                  <ToggleRow
                    options={[{ v: 'square', l: t('square') }, { v: 'native', l: t('original') }]}
                    value={cfg.imageCrop} onChange={(v) => set('imageCrop', v as 'square' | 'native')}
                  />
                </Section>
                {cfg.format === 'html' && cfg.imageSize !== 'none' && (
                  <Section label={t('images')}>
                    <ToggleRow
                      options={[{ v: 'linked', l: t('highRes') }, { v: 'embedded', l: t('lowRes') }]}
                      value={cfg.imageEmbed} onChange={(v) => set('imageEmbed', v as 'linked' | 'embedded')}
                    />
                    {isEmbedHeavy && (
                      <div className="t-mono-sm" style={{ color: '#c8a86e', marginTop: 6 }}>
                        ⚠ {ids.length} {t('embedHeavyWarning')}
                      </div>
                    )}
                  </Section>
                )}
              </>
            )}

            {/* Paper + orientation — PDF only */}
            {cfg.format === 'pdf' && (
              <>
                <Section label={t('paperFormat')}>
                  <ToggleRow
                    options={[{ v: 'a4', l: 'A4' }, { v: 'a3', l: 'A3' }]}
                    value={cfg.paper} onChange={(v) => set('paper', v as ExportConfig['paper'])}
                  />
                </Section>
                <Section label="ORIENTATION">
                  <ToggleRow
                    options={[{ v: 'portrait', l: 'Portrait' }, { v: 'landscape', l: 'Paysage' }]}
                    value={cfg.orientation} onChange={(v) => set('orientation', v as ExportConfig['orientation'])}
                  />
                </Section>
              </>
            )}
          </div>

          {/* ── Themes sidebar ──────────────────────────────── */}
          <div style={{ width: 230, flexShrink: 0, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', background: 'rgba(0,0,0,0.1)' }}>
            <div className="t-label" style={{ marginBottom: 2 }}>{t('savedThemes')}</div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 8, marginBottom: 8, lineHeight: 1.4 }}>
              {t('savedExportPresetsBlurb')}
            </div>

            {savedPresets.length === 0 && (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('noThemesSaved')}</div>
            )}

            {savedPresets.map((preset) => {
              const isActive = activePresetName === preset.name
              const isFlash = loadedFlash === preset.name
              return (
                <div key={preset.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      flex: 1, textAlign: 'left', padding: '5px 8px',
                      background: isActive ? 'var(--bg2)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--ac)' : 'var(--bd)'}`,
                      color: isActive ? 'var(--ac)' : 'var(--tx)',
                      fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleLoadExportPreset(preset) }}>
                    {isFlash ? '✓ ' : ''}{cap(preset.name)}
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '4px 7px', background: 'transparent',
                      border: '1px solid var(--bd)', color: 'var(--tx3)',
                      fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteExportPreset(preset.name) }}>×</button>
                </div>
              )
            })}

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
              <input
                className="input sm"
                placeholder={t('exportPresetNamePlaceholder')}
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSaveExportPreset() }}
                style={{ width: '100%', marginBottom: 6, fontSize: 11 }}
              />
              <button
                type="button"
                className="btn sm primary"
                style={{ width: '100%' }}
                disabled={!presetNameInput.trim()}
                onClick={(e) => { e.stopPropagation(); handleSaveExportPreset() }}>
                {t('save')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
          {progress && <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8 }}>{progress}</div>}
          {error    && <div className="t-mono-sm" style={{ color: '#c0392b', marginBottom: 8 }}>{error}</div>}
          {persistError && <div className="t-mono-sm" style={{ color: '#c88a20', marginBottom: 8 }}>{persistError}</div>}
          {(() => {
            const nonPublicCount = oeuvres.filter(o => ids.includes(o.OeuvreID) && (o as any).anonymity_level === 2).length
            return nonPublicCount > 0 ? (
              <div className="t-mono-sm" style={{
                color: '#c88a20', marginBottom: 8,
                background: 'rgba(200,140,40,0.10)', border: '1px solid rgba(200,140,40,0.4)',
                padding: '5px 10px', borderRadius: 2,
              }}>
                ⚠ {nonPublicCount} œuvre{nonPublicCount > 1 ? 's' : ''} non publique{nonPublicCount > 1 ? 's' : ''} dans cette sélection
              </div>
            ) : null
          })()}
          <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onClose}>{t('cancel')}</button>
            <button
              type="button"
              className="btn primary"
              disabled={pending}
              data-testid="export-open-save-dialog"
              onClick={(e) => { e.stopPropagation(); openSaveSelectionDialog() }}>
              {pending ? `${t('generating')}…` : `${t('export')} (${cfg.format.toUpperCase()})${activePresetName ? ` · ${activePresetName}` : ''}`}
            </button>
          </div>
        </div>
      </div>

      {showSaveSelection && (
        <div
          data-testid="export-save-selection-dialog"
          onClick={() => { setShowSaveSelection(false); setError(null) }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg1)',
              border: '1px solid var(--bd)',
              maxWidth: 420,
              width: '100%',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div className="t-label">{t('exportSaveSelectionTitle')}</div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, lineHeight: 1.45 }}>
              {t('exportSaveSelectionBlurb')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="persistMode"
                  checked={persistMode === 'none'}
                  onChange={() => {
                    setPersistMode('none')
                    setSelectedCatalogThemeId('')
                    setNewCatalogThemeName('')
                    setSelectedGroupId('')
                    setNewWorkingGroupName('')
                    setError(null)
                  }}
                  data-testid="export-save-nothing"
                />
                <span className="t-mono-sm">{t('exportSaveNothing')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="persistMode"
                  checked={persistMode === 'theme'}
                  onChange={() => {
                    setPersistMode('theme')
                    setSelectedGroupId('')
                    setNewWorkingGroupName('')
                    setError(null)
                  }}
                  data-testid="export-save-theme"
                />
                <span className="t-mono-sm">{t('exportSaveAsCatalogTheme')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="persistMode"
                  checked={persistMode === 'group'}
                  onChange={() => {
                    setPersistMode('group')
                    setSelectedCatalogThemeId('')
                    setNewCatalogThemeName('')
                    setError(null)
                  }}
                  data-testid="export-save-group"
                />
                <span className="t-mono-sm">{t('exportSaveAsWorkingGroup')}</span>
              </label>
            </div>

            {persistMode === 'theme' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="t-label">{t('exportPickCatalogTheme')}</span>
                <select
                  className="input sm"
                  style={{ width: '100%', fontSize: 11 }}
                  value={selectedCatalogThemeId === '' ? '' : String(selectedCatalogThemeId)}
                  onChange={(e) => setSelectedCatalogThemeId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">{t('exportPickCatalogTheme')}…</option>
                  {[...localCatalogThemes]
                    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                    .map((th) => (
                      <option key={th.id} value={th.id}>{th.name}</option>
                    ))}
                </select>
                <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="input sm"
                    placeholder={t('exportNewCatalogThemePlaceholder')}
                    value={newCatalogThemeName}
                    onChange={(e) => setNewCatalogThemeName(e.target.value)}
                    style={{ flex: 1, minWidth: 120, fontSize: 11 }}
                  />
                  <button
                    type="button"
                    className="btn sm"
                    disabled={creatingCatalogTheme || !newCatalogThemeName.trim()}
                    onClick={() => void handleCreateCatalogTheme()}
                  >
                    {creatingCatalogTheme ? '…' : t('exportCreateCatalogThemeBtn')}
                  </button>
                </div>
              </div>
            )}

            {persistMode === 'group' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="t-label">{t('exportPickWorkingGroup')}</span>
                <select
                  className="input sm"
                  style={{ width: '100%', fontSize: 11 }}
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  data-testid="export-pick-working-group"
                >
                  <option value="">{t('exportPickWorkingGroup')}…</option>
                  {[...localCatalogGroups]
                    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="input sm"
                    placeholder={t('exportNewWorkingGroupPlaceholder')}
                    value={newWorkingGroupName}
                    onChange={(e) => setNewWorkingGroupName(e.target.value)}
                    style={{ flex: 1, minWidth: 120, fontSize: 11 }}
                    data-testid="export-new-working-group-name"
                  />
                  <button
                    type="button"
                    className="btn sm"
                    disabled={creatingWorkingGroup || !newWorkingGroupName.trim()}
                    onClick={() => void handleCreateWorkingGroup()}
                  >
                    {creatingWorkingGroup ? '…' : t('exportCreateCatalogThemeBtn')}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="t-mono-sm" style={{ color: '#c0392b', fontSize: 10 }}>{error}</div>}

            <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => { setShowSaveSelection(false); setError(null) }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={pending}
                data-testid="export-save-continue"
                onClick={() => runExportAndPersist()}
              >
                {pending ? `${t('generating')}…` : t('exportContinue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

function ToggleRow({ options, value, onChange }: {
  options: { v: string; l: string }[]
  value:   string
  onChange: (v: string) => void
}) {
  return (
    <div className="row gap-sm">
      {options.map(({ v, l }) => (
        <button key={v} className={`btn sm ${value === v ? 'primary' : 'ghost'}`}
          onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function triggerDownload(url: string, filename: string) {
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
