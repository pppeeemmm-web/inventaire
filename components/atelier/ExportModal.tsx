'use client'

// ExportModal — configure and trigger selection export (HTML / PDF).
// Supports cards, grid (N cols), and quick list layouts.
// Export themes are saved to localStorage for reuse.
// B3 (design pass 2026-11-13, D2 answered 2026-11-14): type tabs (Cards / Grid / Quick list / Labels /
// CSV-XLSX) and a live preview that is the real output — `generateExport` run on the first works of
// the selection (HTML in a sandboxed frame, PDF in the browser's viewer). CSV / XLSX are built here
// from the rows already loaded.

import { useState, useTransition, useEffect, useCallback, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { LABEL_PRESETS, DEFAULT_LABEL_PRESET, clampLabelStart, labelPreset, labelsPerSheet } from '@/lib/export/labels'
import {
  DPI_FOR_DESTINATION,
  EXPORT_DPIS,
  colourOf,
  destinationOf,
  dpiOf,
  exportImageFrame,
  exportImageTarget,
  frameCm,
  type ExportDestination,
} from '@/lib/export/image-quality'
import { useI18n } from '@/lib/i18n/context'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { PEM_Z_INDEX } from '@/components/shared/BottomStack'
import {
  generateExport,
  batchEdit,
  createTheme,
  createWorkingGroup,
  type ExportConfig,
  type ExportFields,
} from '@/app/atelier/selection/actions'
import { stringifyError } from '@/lib/error'
import { reloadAtelierAfterBatchSuccess } from '@/lib/atelier/reload-after-batch'
import type { Oeuvre } from '@/lib/types/database'

// ── Theme persistence ─────────────────────────────────────────────────────

const THEME_KEY      = 'pem_export_themes'
const LAST_CFG_KEY   = 'pem_export_last_cfg'

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

/** Live preview size: enough to judge a page, small enough to stay quick. */
const PREVIEW_WORKS = 6
const PREVIEW_LABELS = 24
const PREVIEW_DEBOUNCE_MS = 450

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
  const { t, lang } = useI18n()
  const [cfg,          setCfg]          = useState<ExportConfig>(DEFAULT_CONFIG)
  /** CSV / XLSX tab (not an ExportConfig layout: built in the browser). */
  const [csvMode,      setCsvMode]      = useState(false)

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

  // ── Live preview: the real export on the first works (B3) ─────────────────
  // Keyed on the ids' content: the dock hands over a new array on every render (it re-renders while
  // the catalogue loads), and a new array would restart the preview each time.
  const previewKey = ids.slice(0, cfg.layout === 'labels' ? PREVIEW_LABELS : PREVIEW_WORKS).join(',')
  const previewIds = useMemo(() => (previewKey ? previewKey.split(',').map(Number) : []), [previewKey])
  const total = ids.length
  /** `bytes` / `n`: the preview file's size and how many works it holds → the full file's estimate. */
  const [preview, setPreview] = useState<{ kind: 'html' | 'pdf'; src: string; bytes: number; n: number } | null>(null)
  const [previewErr, setPreviewErr] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const previewSeq = useRef(0)
  useEffect(() => {
    if (csvMode || previewIds.length === 0) return
    const seq = ++previewSeq.current
    const timer = setTimeout(() => {
      setPreviewBusy(true)
      void generateExport(previewIds, cfg, tM, sM, statusLabelMap, lang, total)
        .then((r) => {
          if (seq !== previewSeq.current) return
          if ('error' in r) {
            setPreviewErr(stringifyError(r.error))
            return
          }
          setPreviewErr(null)
          if (r.mime === 'application/pdf') {
            const binary = atob(r.content)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            setPreview({ kind: 'pdf', src: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), bytes: bytes.length, n: previewIds.length })
          } else {
            setPreview({ kind: 'html', src: r.content, bytes: new Blob([r.content]).size, n: previewIds.length })
          }
        })
        .catch((e) => { if (seq === previewSeq.current) setPreviewErr(stringifyError(e)) })
        .finally(() => { if (seq === previewSeq.current) setPreviewBusy(false) })
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [csvMode, previewIds, cfg, tM, sM, statusLabelMap, lang, total])
  // Free the previous PDF blob when a new preview replaces it.
  useEffect(() => () => { if (preview?.kind === 'pdf') URL.revokeObjectURL(preview.src) }, [preview])

  // ── CSV / XLSX: rows already loaded, columns = ticked fields (no image) ───
  const csvTable = useMemo(() => {
    if (!csvMode) return null
    const byId = new Map(oeuvres.map((o) => [o.OeuvreID, o]))
    const f = cfg.fields
    const cols: { label: string; get: (o: Oeuvre) => string | number | null }[] = []
    if (f.id) cols.push({ label: FIELD_LABELS.id, get: (o) => o.OeuvreID })
    if (f.title) cols.push({ label: FIELD_LABELS.title, get: (o) => o.Titre ?? '' })
    if (f.year) cols.push({ label: FIELD_LABELS.year, get: (o) => (o.Année ? o.Année.slice(0, 4) : '') })
    if (f.technique) cols.push({ label: FIELD_LABELS.technique, get: (o) => (o.Technique != null ? tM[o.Technique] ?? '' : '') })
    if (f.support) cols.push({ label: FIELD_LABELS.support, get: (o) => (o.Support != null ? sM[o.Support] ?? '' : '') })
    if (f.dims) cols.push({ label: FIELD_LABELS.dims, get: (o) => (o.Hauteur && o.Largeur ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''}` : '') })
    if (f.price) cols.push({ label: FIELD_LABELS.price, get: (o) => (o.PrixFinal ?? o.Prix ?? null) as number | null })
    if (f.status) cols.push({ label: FIELD_LABELS.status, get: (o) => (o.statusId != null ? statusLabelMap[o.statusId] ?? '' : '') })
    if (f.notes) cols.push({ label: FIELD_LABELS.notes, get: (o) => (o.Commentaires ?? '').replace(/\s+/g, ' ').trim() })
    const rows = ids.map((id) => byId.get(id)).filter((o): o is Oeuvre => !!o).map((o) => cols.map((c) => c.get(o)))
    return { headers: cols.map((c) => c.label), rows }
    // FIELD_LABELS is rebuilt each render from t(); its content only changes with the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvMode, oeuvres, ids, cfg.fields, tM, sM, statusLabelMap, lang])

  function downloadCsv() {
    if (!csvTable) return
    const esc = (v: string | number | null) => {
      const s = v == null ? '' : String(v)
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const text = [csvTable.headers, ...csvTable.rows].map((r) => r.map(esc).join(';')).join('\r\n')
    // BOM so Excel opens the accents right.
    triggerDownload(URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' })), `export_${new Date().toISOString().slice(0, 10)}.csv`)
  }
  function downloadXlsx() {
    if (!csvTable) return
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([csvTable.headers, ...csvTable.rows]), 'Export')
    XLSX.writeFile(wb, `export_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const tab: ExportConfig['layout'] | 'csv' = csvMode ? 'csv' : cfg.layout
  function chooseTab(next: ExportConfig['layout'] | 'csv') {
    if (next === 'csv') { setCsvMode(true); return }
    setCsvMode(false)
    set('layout', next)
    if (next === 'labels' && !cfg.labelPreset) set('labelPreset', DEFAULT_LABEL_PRESET)
  }

  function set<K extends keyof ExportConfig>(key: K, val: ExportConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: val }))
    setActivePresetName(null)
  }
  /** Screen / print: sets the density (screen 72, print 300) and, for HTML, the page size. */
  function chooseDestination(d: ExportDestination) {
    set('destination', d)
    set('dpi', DPI_FOR_DESTINATION[d])
    if (cfg.format === 'html') set('paper', d === 'print' ? (cfg.paper === 'screen' ? 'a4' : cfg.paper) : 'screen')
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
        const r = await generateExport(ids, cfg, tM, sM, statusLabelMap, lang)
        setProgress('')
        if ('error' in r) {
          setError(stringifyError(r.error))
          return
        }

        runDownload(r)

        let persistOk = true
        let junctionPersisted = false
        if (persistMode === 'theme' && selectedCatalogThemeId !== '') {
          const br = await batchEdit(ids, { addThemeIds: [selectedCatalogThemeId as number] })
          if ('error' in br) {
            setPersistError(`${t('exportPersistError')} ${br.error}`)
            persistOk = false
          } else {
            junctionPersisted = true
          }
        } else if (persistMode === 'group' && selectedGroupId) {
          const br = await batchEdit(ids, { addGroupIds: [selectedGroupId] })
          if ('error' in br) {
            setPersistError(`${t('exportPersistError')} ${br.error}`)
            persistOk = false
          } else {
            junctionPersisted = true
          }
        }

        setShowSaveSelection(false)
        if (junctionPersisted) {
          reloadAtelierAfterBatchSuccess()
          return
        }
        if (persistOk) onClose()
      } catch (e) {
        setProgress('')
        setError(stringifyError(e))
      }
    })
  }

  useEscapeClose(showSaveSelection, () => setShowSaveSelection(false))

  const isEmbedHeavy = cfg.format === 'html' && cfg.imageEmbed === 'embedded' && cfg.fields.image && ids.length > 20

  return (
    <PemModalOverlay
      onClose={onClose}
      panelStyle={{
        width: 'min(1440px, 96vw)',
        height: '92vh',
        maxWidth: '96vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="export-modal-title" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Header: title + type tabs (B3) */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div id="export-modal-title" style={{ fontFamily: 'var(--font-serif, serif)', fontSize: 22, lineHeight: 1.1 }}>
            {interpolateMessage(t('ex_title_fmt'), { n: ids.length })}
          </div>
          <div role="tablist" aria-label={t('ex_tabs')} style={{ display: 'flex', border: '1px solid var(--bd)' }}>
            {([
              ['cards', t('fiches')],
              ['grid', t('grille')],
              ['list', t('listeRapide')],
              ['labels', t('ex_tab_labels')],
              ['csv', t('ex_tab_csv')],
            ] as const).map(([k, label], i) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                data-testid={`export-tab-${k}`}
                onClick={() => chooseTab(k)}
                style={{
                  minHeight: 34, padding: '0 14px', border: 'none', borderLeft: i ? '1px solid var(--bd)' : 'none',
                  background: tab === k ? 'var(--ac)' : 'transparent', color: tab === k ? 'var(--bg0)' : 'var(--tx)',
                  fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ── Config panel: no scroll at 1280 × 800 (owner 2026-11-14) — Page / Fields / Image
              blocks, related settings side by side, compact segmented toggles. ── */}
          <div data-testid="export-options" style={{ width: 460, flexShrink: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderRight: '1px solid var(--bd)', overflow: 'auto' }}>

            {/* ── Page ── */}
            {!csvMode && <Block label={t('ex_block_page')}>
              <Pair>
                <Mini label="FORMAT">
                  <Seg groupLabel="FORMAT"
                    options={[{ v: 'html', l: 'HTML' }, { v: 'pdf', l: 'PDF' }]}
                    value={cfg.format} onChange={(v) => {
                      set('format', v as 'html' | 'pdf')
                      // HTML stays on its page size when it is meant for print (owner 2026-11-14).
                      if (v === 'html' && destinationOf({ ...cfg, format: 'html' }) === 'screen') set('paper', 'screen')
                      if (cfg.paper === 'screen' && (v === 'pdf' || destinationOf({ ...cfg, format: 'html' }) === 'print')) set('paper', 'a4')
                    }} />
                </Mini>
                {cfg.layout !== 'labels' && <Mini label={t('ex_output')}>
                  <Seg groupLabel={t('ex_output')} title={t('ex_output_hint')}
                    options={[{ v: 'screen', l: t('ex_output_screen') }, { v: 'print', l: t('ex_output_print') }]}
                    value={destinationOf(cfg)} onChange={(v) => chooseDestination(v as ExportDestination)} />
                </Mini>}
              </Pair>

              {cfg.layout !== 'labels' && (
                <input
                  className="input"
                  aria-label={t('exportTitle')}
                  placeholder={`${t('exportTitle')} — ${t('exportTitlePlaceholder')}`}
                  value={cfg.exportTitle ?? ''}
                  onChange={(e) => set('exportTitle', e.target.value || null)}
                  style={{ width: '100%', fontSize: 11, minHeight: 30 }}
                />
              )}

              {/* Labels: sheet preset + first free label (B3 / D2) */}
              {cfg.layout === 'labels' && (() => {
                const lp = labelPreset(cfg.labelPreset)
                const start = clampLabelStart(cfg.labelStart, lp)
                const sheets = Math.ceil((start - 1 + ids.length) / labelsPerSheet(lp))
                return (
                  <div>
                    <label className="t-label" htmlFor="export-label-preset" style={{ display: 'block', marginBottom: 4, fontSize: 9.5 }}>{t('ex_label_preset')}</label>
                    <select id="export-label-preset" className="input" data-testid="export-label-preset" value={lp.id}
                      onChange={(e) => set('labelPreset', e.target.value as ExportConfig['labelPreset'])}
                      style={{ width: '100%', fontSize: 12, minHeight: 32 }}>
                      {LABEL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <label className="t-label" htmlFor="export-label-start" style={{ fontSize: 9.5 }}>{t('ex_label_start')}</label>
                      <input id="export-label-start" className="input" type="number" min={1} max={labelsPerSheet(lp)} value={start}
                        data-testid="export-label-start"
                        onChange={(e) => set('labelStart', clampLabelStart(Number(e.target.value), lp))}
                        style={{ width: 70, fontSize: 12, minHeight: 30 }} />
                      <span className="t-mono-sm" style={{ color: 'var(--tx2)', fontSize: 11 }}>
                        {interpolateMessage(t('ex_label_sheets_fmt'), { n: ids.length, sheets })}
                      </span>
                    </div>
                    <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>{t('ex_label_start_hint')}</div>
                    <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>{t('ex_label_fields_hint')}</div>
                  </div>
                )
              })()}

              {/* Per page (the layout itself is the tab above) + index */}
              {(cfg.layout === 'cards' || cfg.layout === 'grid') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="t-label" style={{ fontSize: 9.5 }}>{cfg.layout === 'grid' ? t('export_rows_per_page_label') : `${t('cardsPerPage')} :`}</span>
                  {cfg.layout === 'grid' ? (
                    <Seg groupLabel={t('export_rows_per_page_label')}
                      options={([2, 3, 4, 5, 6, 8, 10] as const).map((n) => ({ v: String(n), l: String(n), aria: `${t('export_rows_per_page_label')} ${n}` }))}
                      value={String(cfg.rowsPerPage)} onChange={(v) => set('rowsPerPage', Number(v))} />
                  ) : (
                    <Seg groupLabel={t('cardsPerPage')}
                      options={([1, 2, 3, 4, 5, 6] as const).map((n) => ({ v: String(n), l: String(n), aria: `${t('cardsPerPage')} ${n}` }))}
                      value={String(cfg.cardsPerPage)} onChange={(v) => set('cardsPerPage', Number(v) as ExportConfig['cardsPerPage'])} />
                  )}
                </div>
              )}
              {(cfg.layout === 'cards' || cfg.layout === 'grid') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={cfg.appendList}
                    onChange={(e) => set('appendList', e.target.checked)} />
                  <span className="t-mono-sm" style={{ color: cfg.appendList ? 'var(--tx)' : 'var(--tx3)' }}>
                    {t('appendIndex')}
                  </span>
                </label>
              )}

              {/* Paper + orientation — PDF, or HTML meant for print (labels are A4 sheets) */}
              {(cfg.format === 'pdf' || destinationOf(cfg) === 'print') && cfg.layout !== 'labels' && (
                <Pair>
                  <Mini label={t('paperFormat')}>
                    <Seg groupLabel={t('paperFormat')}
                      options={[{ v: 'a4', l: 'A4' }, { v: 'a3', l: 'A3' }]}
                      value={cfg.paper} onChange={(v) => set('paper', v as ExportConfig['paper'])} />
                  </Mini>
                  <Mini label={t('ex_orientation')}>
                    <Seg groupLabel={t('ex_orientation')}
                      options={[{ v: 'portrait', l: t('ex_portrait') }, { v: 'landscape', l: t('ex_landscape') }]}
                      value={cfg.orientation} onChange={(v) => set('orientation', v as ExportConfig['orientation'])} />
                  </Mini>
                </Pair>
              )}
            </Block>}

            {/* ── Fields ── */}
            <Block label={t('displayedFields')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px' }}>
                {(Object.entries(cfg.fields) as [keyof ExportFields, boolean][]).map(([k, v]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 0 }}>
                    <input type="checkbox" checked={v} onChange={(e) => setField(k, e.target.checked)} />
                    <span className="t-mono-sm" style={{ color: v ? 'var(--tx)' : 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {FIELD_LABELS[k]}
                    </span>
                  </label>
                ))}
              </div>
            </Block>

            {/* ── Image: the frame (size, crop — set by the layout) and what fills it (resolution,
                colour). Resolution never changes the frame (owner question 2026-11-14). ── */}
            {!csvMode && cfg.layout !== 'labels' && (() => {
              const frame = exportImageFrame(cfg)
              const target = exportImageTarget(cfg)
              const cm = frame ? frameCm(frame, cfg) : null
              const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })
              const pxStr = target ? (target.w === target.h ? String(target.w) : `${target.w} × ${target.h}`) : ''
              const showImage = cfg.fields.image && !(cfg.format === 'pdf' && cfg.layout === 'list')
              return (
                <Block label={t('ex_block_image')}>
                  {showImage && (
                    <Pair>
                      <Mini label={t('imageSize')}>
                        <Seg groupLabel={t('imageSize')}
                          options={[{ v: 'large', l: t('large') }, { v: 'small', l: t('small') }, { v: 'none', l: t('none') }]}
                          value={cfg.imageSize} onChange={(v) => set('imageSize', v as ExportConfig['imageSize'])} />
                      </Mini>
                      <Mini label={t('imageFormat')}>
                        <Seg groupLabel={t('imageFormat')}
                          options={[{ v: 'square', l: t('square') }, { v: 'native', l: t('original') }]}
                          value={cfg.imageCrop} onChange={(v) => set('imageCrop', v as 'square' | 'native')} />
                      </Mini>
                    </Pair>
                  )}
                  <Pair>
                    {target ? (
                      <Mini label={t('ex_dpi')}>
                        <Seg groupLabel={t('ex_dpi')}
                          options={EXPORT_DPIS.map((d) => ({ v: String(d), l: `${d} dpi` }))}
                          value={String(dpiOf(cfg))} onChange={(v) => set('dpi', Number(v) as ExportConfig['dpi'])} />
                      </Mini>
                    ) : <span />}
                    <Mini label={t('ex_colour')}>
                      <Seg groupLabel={t('ex_colour')} title={t('ex_colour_hint')}
                        options={[{ v: 'colour', l: t('ex_colour_colour') }, { v: 'mono', l: t('ex_colour_mono') }, { v: 'light', l: t('ex_colour_light') }]}
                        value={colourOf(cfg)} onChange={(v) => set('colour', v as ExportConfig['colour'])} />
                    </Mini>
                  </Pair>
                  {frame && target && (
                    <div className="t-mono-sm" data-testid="export-dpi-px" style={{ color: 'var(--tx2)', fontSize: 10.5 }}>
                      {cm
                        ? interpolateMessage(t('ex_frame_cm_fmt'), { w: nf.format(cm.w), h: nf.format(cm.h), px: pxStr })
                        : interpolateMessage(t('ex_frame_screen_fmt'), { w: Math.round(frame.w), h: Math.round(frame.h), px: pxStr })}
                    </div>
                  )}
                  {cfg.format === 'html' && target && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className="t-label" style={{ fontSize: 9.5 }}>{t('images')}</span>
                      <Seg groupLabel={t('images')}
                        options={[{ v: 'linked', l: t('ex_img_linked') }, { v: 'embedded', l: t('ex_img_embedded') }]}
                        value={cfg.imageEmbed} onChange={(v) => set('imageEmbed', v as 'linked' | 'embedded')} />
                      {isEmbedHeavy && (
                        <span className="t-mono-sm" title={t('embedHeavyWarning')} style={{ color: '#c8a86e', fontSize: 10 }}>⚠ {ids.length}</span>
                      )}
                    </div>
                  )}
                </Block>
              )
            })()}
          </div>

          {/* ── Live preview (B3): the real output on the first works, or the CSV table ── */}
          <div data-testid="export-preview" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
            <div className="t-mono-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--bd)', color: 'var(--tx3)', fontSize: 11, flexShrink: 0 }}>
              <span className="t-label" style={{ color: 'var(--tx2)' }}>{t('ex_preview')}</span>
              <span>
                {csvMode
                  ? interpolateMessage(t('ex_csv_rows_fmt'), { n: csvTable?.rows.length ?? 0 })
                  : interpolateMessage(t('ex_preview_of_fmt'), { n: previewIds.length, total: ids.length })}
              </span>
              {/* Size estimate only when images go into the file (they make the size; without them
                  the preview's fixed part, multiplied, overstates it). */}
              {!csvMode && !previewBusy && preview && preview.n > 0 && exportImageTarget(cfg) && (cfg.format === 'pdf' || cfg.imageEmbed === 'embedded') ? (
                <span data-testid="export-size-estimate" title={t('ex_size_hint')} style={{ marginLeft: 'auto', color: 'var(--tx2)' }}>
                  {interpolateMessage(t('ex_size_fmt'), { size: formatBytes((preview.bytes * ids.length) / preview.n, lang) })}
                </span>
              ) : null}
              {!csvMode && previewBusy ? <span style={{ marginLeft: 'auto' }}>{t('ex_preview_loading')}</span> : null}
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: csvMode ? 'auto' : 'hidden' }}>
              {csvMode && csvTable ? (
                <table className="t-mono-sm" style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', background: 'var(--bg0)' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg1)' }}>
                    <tr>{csvTable.headers.map((h) => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {csvTable.rows.slice(0, 200).map((r, i) => (
                      <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: '4px 8px', borderBottom: '1px solid var(--bd)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c == null ? '' : String(c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {csvMode && csvTable && csvTable.rows.length > 200 ? (
                <div className="t-mono-sm" style={{ padding: 8, color: 'var(--tx3)' }}>{interpolateMessage(t('ex_csv_more_fmt'), { n: csvTable.rows.length - 200 })}</div>
              ) : null}
              {!csvMode && previewErr ? (
                <div className="t-mono-sm" style={{ padding: 14, color: 'var(--rust)' }}>{t('ex_preview_error')} {previewErr}</div>
              ) : null}
              {!csvMode && !previewErr && preview?.kind === 'html' ? (
                <iframe title={t('ex_preview')} sandbox="" srcDoc={preview.src} style={{ width: '100%', height: '100%', border: 0, background: '#fff', opacity: previewBusy ? 0.6 : 1 }} />
              ) : null}
              {!csvMode && !previewErr && preview?.kind === 'pdf' ? (
                <iframe title={t('ex_preview')} src={preview.src} style={{ width: '100%', height: '100%', border: 0, opacity: previewBusy ? 0.6 : 1 }} />
              ) : null}
            </div>
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
                    aria-pressed={isActive}
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
                    aria-label={`${t('delete')} ${preset.name}`}
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
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
          {progress && <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8 }}>{progress}</div>}
          {error    && <div className="t-mono-sm" style={{ color: '#c0392b', marginBottom: 8 }}>{error}</div>}
          {persistError && <div className="t-mono-sm" style={{ color: '#c88a20', marginBottom: 8 }}>{persistError}</div>}
          <div className="row gap-sm" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
            {/* Non-public warning on the buttons' line: the options panel keeps the height. */}
            {(() => {
              const nonPublicCount = oeuvres.filter(o => ids.includes(o.OeuvreID) && o.anonymity_level === 2).length
              return nonPublicCount > 0 ? (
                <div className="t-mono-sm" style={{
                  color: '#c88a20', marginRight: 'auto',
                  background: 'rgba(200,140,40,0.10)', border: '1px solid rgba(200,140,40,0.4)',
                  padding: '5px 10px', borderRadius: 2,
                }}>
                  ⚠ {nonPublicCount} œuvre{nonPublicCount > 1 ? 's' : ''} non publique{nonPublicCount > 1 ? 's' : ''} dans cette sélection
                </div>
              ) : null
            })()}
            <button type="button" className="btn ghost" onClick={onClose}>{t('cancel')}</button>
            {csvMode ? (
              <>
                <button type="button" className="btn secondary" data-testid="export-download-csv" onClick={downloadCsv}>{t('ex_download_csv')}</button>
                <button type="button" className="btn primary" data-testid="export-download-xlsx" onClick={downloadXlsx}>{t('ex_download_xlsx')}</button>
              </>
            ) : <button
              type="button"
              className="btn primary"
              disabled={pending}
              data-testid="export-open-save-dialog"
              onClick={(e) => { e.stopPropagation(); openSaveSelectionDialog() }}>
              {pending ? `${t('generating')}…` : `${t('export')} (${cfg.format.toUpperCase()})${activePresetName ? ` · ${activePresetName}` : ''}`}
            </button>}
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
            zIndex: PEM_Z_INDEX.modal + 1,
            background: 'rgba(0,0,0,0.55)',
            pointerEvents: 'auto',
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
    </PemModalOverlay>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

/** Options block: small heading + rule, then its rows (mixing-desk density). */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="t-label" style={{ fontSize: 10, letterSpacing: '0.12em', borderBottom: '1px solid var(--bd)', paddingBottom: 3 }}>{label}</div>
      {children}
    </div>
  )
}

/** Two settings side by side. */
function Pair({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'flex-start' }}>{children}</div>
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="t-label" style={{ fontSize: 9.5, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

/** Compact segmented toggle (same look as the type tabs). */
function Seg({ options, value, onChange, groupLabel, title }: {
  options: { v: string; l: string; aria?: string }[]
  value: string
  onChange: (v: string) => void
  groupLabel?: string
  title?: string
}) {
  return (
    <div role="group" aria-label={groupLabel} title={title} style={{ display: 'inline-flex', flexWrap: 'wrap', border: '1px solid var(--bd)', maxWidth: '100%' }}>
      {options.map(({ v, l, aria }, i) => (
        <button key={v} type="button" aria-pressed={value === v} aria-label={aria}
          onClick={() => onChange(v)}
          style={{
            minHeight: 28, padding: '0 9px', border: 'none', borderLeft: i ? '1px solid var(--bd)' : 'none',
            background: value === v ? 'var(--ac)' : 'transparent', color: value === v ? 'var(--bg0)' : 'var(--tx)',
            fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer',
          }}>{l}</button>
      ))}
    </div>
  )
}

/** "27 Mo" / "27 MB" (Intl units follow the language). */
function formatBytes(n: number, lang: string): string {
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [v, unit] = n >= 1024 * 1024 ? [n / (1024 * 1024), 'megabyte'] : [Math.max(1, n / 1024), 'kilobyte']
  return new Intl.NumberFormat(loc, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: v < 10 ? 1 : 0 }).format(v)
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

function ToggleRow({ options, value, onChange, groupLabel }: {
  options: { v: string; l: string }[]
  value:   string
  onChange: (v: string) => void
  groupLabel?: string
}) {
  return (
    <div role="group" aria-label={groupLabel} className="row gap-sm">
      {options.map(({ v, l }) => (
        <button key={v} className={`btn sm ${value === v ? 'primary' : 'ghost'}`}
          aria-pressed={value === v}
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
