'use client'

// ExportModal — configure and trigger selection export (HTML / PDF).
// Supports cards, grid (N cols), and quick list layouts.
// Export themes are saved to localStorage for reuse.

import { useState, useTransition, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { generateExport, type ExportConfig, type ExportFields } from '@/app/atelier/selection/actions'
import type { Oeuvre } from '@/lib/types/database'

// ── Theme persistence ─────────────────────────────────────────────────────

const THEME_KEY      = 'pem_export_themes'
const LAST_CFG_KEY   = 'pem_export_last_cfg'

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
  ids:            number[]
  oeuvres:        Oeuvre[]
  tM:             Record<number, string>
  sM:             Record<number, string>
  statusLabelMap: Record<number, string>
  onClose:        () => void
}

// ── Component ─────────────────────────────────────────────────────────────

export function ExportModal({ ids, oeuvres, tM, sM, statusLabelMap, onClose }: Props) {
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
  const [themes,       setThemes]       = useState<ExportTheme[]>([])
  const [themeName,    setThemeName]    = useState('')
  const [activeTheme,  setActiveTheme]  = useState<string | null>(null)
  const [loadedFlash,  setLoadedFlash]  = useState<string | null>(null)
  const [pending,      startExport]     = useTransition()
  const [error,        setError]        = useState<string | null>(null)
  const [progress,     setProgress]     = useState('')

  // Load themes + last-used config on mount
  useEffect(() => {
    setThemes(loadThemes())
    setCfg(loadLastCfg())
  }, [])

  // Persist config whenever it changes
  useEffect(() => {
    saveLastCfg(cfg)
  }, [cfg])

  function set<K extends keyof ExportConfig>(key: K, val: ExportConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: val }))
    setActiveTheme(null) // any manual change deactivates named theme
  }
  function setField<K extends keyof ExportFields>(key: K, val: boolean) {
    setCfg((prev) => ({ ...prev, fields: { ...prev.fields, [key]: val } }))
    setActiveTheme(null)
  }

  function handleSaveTheme() {
    const name = themeName.trim()
    if (!name) return
    const next = [{ name, config: cfg }, ...themes.filter((t) => t.name !== name)]
    setThemes(next)
    saveThemes(next)
    setThemeName('')
    setActiveTheme(name)
  }

  function handleLoadTheme(t: ExportTheme) {
    // Always spread DEFAULT_CONFIG to handle themes saved with older schemas
    const merged: ExportConfig = {
      ...DEFAULT_CONFIG,
      ...t.config,
      fields: { ...DEFAULT_CONFIG.fields, ...(t.config.fields ?? {}) },
    }
    setCfg(merged)
    setActiveTheme(t.name)
    setLoadedFlash(t.name)
    setTimeout(() => setLoadedFlash(null), 1200)
  }

  function handleDeleteTheme(name: string) {
    const next = themes.filter((t) => t.name !== name)
    setThemes(next)
    saveThemes(next)
    if (activeTheme === name) setActiveTheme(null)
  }

  function handleExport() {
    setError(null)
    const embeddedWarning = cfg.imageEmbed === 'embedded' && ids.length > 30
    if (embeddedWarning) {
      setProgress(`Récupération des images pour ${ids.length} œuvres…`)
    } else {
      setProgress('Génération…')
    }

    startExport(async () => {
      try {
        const r = await generateExport(ids, cfg, tM, sM, statusLabelMap)
        setProgress('')
        if ('error' in r) { setError(r.error); return }

        // Trigger download
        let content = r.content
        let blobType = r.mime

        if (r.mime === 'application/pdf') {
          // base64 → binary
          const binary = atob(content)
          const bytes  = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const blob = new Blob([bytes], { type: blobType })
          triggerDownload(URL.createObjectURL(blob), r.filename)
        } else {
          const blob = new Blob([content], { type: `${blobType};charset=utf-8` })
          triggerDownload(URL.createObjectURL(blob), r.filename)
        }
      } catch (e) {
        setProgress('')
        setError(String(e))
      }
    })
  }

  const isEmbedHeavy = cfg.imageEmbed === 'embedded' && cfg.fields.image && ids.length > 20

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
                <div className="row gap-sm" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="t-label">{t('columns')} :</span>
                  {([2, 3, 4, 6, 8, 10, 12] as const).map((n) => (
                    <button key={n} className={`btn sm ${cfg.columns === n ? 'primary' : 'ghost'}`}
                      onClick={() => set('columns', n as ExportConfig['columns'])}>{n}</button>
                  ))}
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
                {cfg.imageSize !== 'none' && (
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

            {/* Paper */}
            <Section label={cfg.format === 'html' ? t('displayFormat') : t('paperFormat')}>
              <ToggleRow
                options={
                  cfg.format === 'html'
                    ? [{ v: 'screen', l: t('screen') }]
                    : [{ v: 'a4', l: 'A4' }, { v: 'a3', l: 'A3' }, { v: 'screen', l: t('screen') }]
                }
                value={cfg.paper} onChange={(v) => set('paper', v as ExportConfig['paper'])}
              />
            </Section>

            {cfg.format === 'pdf' && (
              <Section label="ORIENTATION">
                <ToggleRow
                  options={[{ v: 'portrait', l: 'Portrait' }, { v: 'landscape', l: 'Paysage' }]}
                  value={cfg.orientation} onChange={(v) => set('orientation', v as ExportConfig['orientation'])}
                />
              </Section>
            )}
          </div>

          {/* ── Themes sidebar ──────────────────────────────── */}
          <div style={{ width: 210, flexShrink: 0, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
            <div className="t-label" style={{ marginBottom: 4 }}>{t('savedThemes')}</div>

            {themes.length === 0 && (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('noThemesSaved')}</div>
            )}

            {themes.map((t_item) => {
              const isActive  = activeTheme === t_item.name
              const isFlash   = loadedFlash === t_item.name
              return (
                <div key={t_item.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    style={{
                      flex: 1, textAlign: 'left', padding: '5px 8px',
                      background: isActive ? 'var(--bg2)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--ac)' : 'var(--bd)'}`,
                      color: isActive ? 'var(--ac)' : 'var(--tx)',
                      fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleLoadTheme(t_item) }}>
                    {isFlash ? '✓ ' : ''}{t_item.name}
                  </button>
                  <button
                    style={{
                      padding: '4px 7px', background: 'transparent',
                      border: '1px solid var(--bd)', color: 'var(--tx3)',
                      fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteTheme(t_item.name) }}>×</button>
                </div>
              )
            })}

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
              <input
                className="input sm"
                placeholder={t('themeNamePlaceholder')}
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSaveTheme() }}
                style={{ width: '100%', marginBottom: 6, fontSize: 11 }}
              />
              <button
                className="btn sm primary"
                style={{ width: '100%' }}
                disabled={!themeName.trim()}
                onClick={(e) => { e.stopPropagation(); handleSaveTheme() }}>
                {t('save')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
          {progress && <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8 }}>{progress}</div>}
          {error    && <div className="t-mono-sm" style={{ color: '#c0392b', marginBottom: 8 }}>{error}</div>}
          <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={onClose}>{t('cancel')}</button>
            <button className="btn primary" disabled={pending} onClick={(e) => { e.stopPropagation(); handleExport() }}>
              {pending ? `${t('generating')}…` : `${t('export')} (${cfg.format.toUpperCase()})${activeTheme ? ` · ${activeTheme}` : ''}`}
            </button>
          </div>
        </div>
      </div>
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
