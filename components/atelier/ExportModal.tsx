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
  const [preview, setPreview] = useState<{ kind: 'html' | 'pdf'; src: string } | null>(null)
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
            setPreview({ kind: 'pdf', src: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) })
          } else {
            setPreview({ kind: 'html', src: r.content })
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

          {/* ── Config panel ────────────────────────────────── */}
          <div style={{ width: 340, flexShrink: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18, borderRight: '1px solid var(--bd)', overflow: 'auto' }}>

            {/* Format */}
            {!csvMode && <Section label="FORMAT">
              <ToggleRow
                groupLabel="FORMAT"
                options={[{ v: 'html', l: 'HTML' }, { v: 'pdf', l: 'PDF' }]}
                value={cfg.format} onChange={(v) => {
                  set('format', v as 'html' | 'pdf')
                  if (v === 'html') set('paper', 'screen')
                  if (v === 'pdf' && cfg.paper === 'screen') set('paper', 'a4')
                }}
              />
            </Section>}

            {/* Title */}
            {!csvMode && cfg.layout !== 'labels' && <Section label={t('exportTitle')}>
              <input
                className="input"
                placeholder={t('exportTitlePlaceholder')}
                value={cfg.exportTitle ?? ''}
                onChange={(e) => set('exportTitle', e.target.value || null)}
                style={{ width: '100%', fontSize: 11 }}
              />
            </Section>}

            {/* Labels: sheet preset + first free label (B3 / D2) */}
            {!csvMode && cfg.layout === 'labels' && (() => {
              const lp = labelPreset(cfg.labelPreset)
              const start = clampLabelStart(cfg.labelStart, lp)
              const sheets = Math.ceil((start - 1 + ids.length) / labelsPerSheet(lp))
              return (
                <Section label={t('ex_layout_options')}>
                  <label className="t-label" htmlFor="export-label-preset" style={{ display: 'block', marginBottom: 4 }}>{t('ex_label_preset')}</label>
                  <select id="export-label-preset" className="input" data-testid="export-label-preset" value={lp.id}
                    onChange={(e) => set('labelPreset', e.target.value as ExportConfig['labelPreset'])}
                    style={{ width: '100%', fontSize: 12, minHeight: 36 }}>
                    {LABEL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <label className="t-label" htmlFor="export-label-start" style={{ display: 'block', margin: '10px 0 4px' }}>{t('ex_label_start')}</label>
                  <input id="export-label-start" className="input" type="number" min={1} max={labelsPerSheet(lp)} value={start}
                    data-testid="export-label-start"
                    onChange={(e) => set('labelStart', clampLabelStart(Number(e.target.value), lp))}
                    style={{ width: 90, fontSize: 12, minHeight: 36 }} />
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>{t('ex_label_start_hint')}</div>
                  <div className="t-mono-sm" style={{ color: 'var(--tx2)', fontSize: 11, marginTop: 8 }}>
                    {interpolateMessage(t('ex_label_sheets_fmt'), { n: ids.length, sheets })}
                  </div>
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>{t('ex_label_fields_hint')}</div>
                </Section>
              )
            })()}

            {/* Layout options (the layout itself is the tab above) */}
            {!csvMode && cfg.layout !== 'labels' && cfg.layout !== 'list' && <Section label={t('ex_layout_options')}>
              {cfg.layout === 'grid' && (
                <div style={{ marginTop: 10 }}>
                  <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                    <span className="t-label">{t('export_rows_per_page_label')}</span>
                    {([2, 3, 4, 5, 6, 8, 10] as const).map((n) => (
                      <button key={n} className={`btn sm ${cfg.rowsPerPage === n ? 'primary' : 'ghost'}`}
                        aria-label={`${t('export_rows_per_page_label')} ${n}`}
                        aria-pressed={cfg.rowsPerPage === n}
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
                      aria-label={`${t('cardsPerPage')} ${n}`}
                      aria-pressed={cfg.cardsPerPage === n}
                      onClick={() => set('cardsPerPage', n as ExportConfig['cardsPerPage'])}>{n}</button>
                  ))}
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.appendList}
                  onChange={(e) => set('appendList', e.target.checked)} />
                <span className="t-mono-sm" style={{ color: cfg.appendList ? 'var(--tx)' : 'var(--tx3)' }}>
                  {t('appendIndex')}
                </span>
              </label>
            </Section>}

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
            {cfg.fields.image && !csvMode && cfg.layout !== 'labels' && (
              <>
                <Section label={t('imageSize')}>
                  <ToggleRow
                    groupLabel={t('imageSize')}
                    options={[{ v: 'large', l: t('large') }, { v: 'small', l: t('small') }, { v: 'none', l: t('none') }]}
                    value={cfg.imageSize} onChange={(v) => set('imageSize', v as ExportConfig['imageSize'])}
                  />
                </Section>
                <Section label={t('imageFormat')}>
                  <ToggleRow
                    groupLabel={t('imageFormat')}
                    options={[{ v: 'square', l: t('square') }, { v: 'native', l: t('original') }]}
                    value={cfg.imageCrop} onChange={(v) => set('imageCrop', v as 'square' | 'native')}
                  />
                </Section>
                {cfg.format === 'html' && cfg.imageSize !== 'none' && (
                  <Section label={t('images')}>
                    <ToggleRow
                      groupLabel={t('images')}
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

            {/* Paper + orientation — PDF only (labels are A4 sheets) */}
            {cfg.format === 'pdf' && !csvMode && cfg.layout !== 'labels' && (
              <>
                <Section label={t('paperFormat')}>
                  <ToggleRow
                    groupLabel={t('paperFormat')}
                    options={[{ v: 'a4', l: 'A4' }, { v: 'a3', l: 'A3' }]}
                    value={cfg.paper} onChange={(v) => set('paper', v as ExportConfig['paper'])}
                  />
                </Section>
                <Section label="ORIENTATION">
                  <ToggleRow
                    groupLabel="ORIENTATION"
                    options={[{ v: 'portrait', l: 'Portrait' }, { v: 'landscape', l: 'Paysage' }]}
                    value={cfg.orientation} onChange={(v) => set('orientation', v as ExportConfig['orientation'])}
                  />
                </Section>
              </>
            )}
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
        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
          {progress && <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8 }}>{progress}</div>}
          {error    && <div className="t-mono-sm" style={{ color: '#c0392b', marginBottom: 8 }}>{error}</div>}
          {persistError && <div className="t-mono-sm" style={{ color: '#c88a20', marginBottom: 8 }}>{persistError}</div>}
          {(() => {
            const nonPublicCount = oeuvres.filter(o => ids.includes(o.OeuvreID) && o.anonymity_level === 2).length
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
