'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  savePortfolioConfig,
  loadPortfolioConfig,
  extractDocumentText,
  setWorkPublic,
} from '@/app/atelier/portfolio/actions'
import { PORTFOLIO_SAVE_ERR } from '@/lib/portfolio-save-errors'
import { getAnalyticsStats, type AnalyticsComparison, type AnalyticsResult } from '@/app/atelier/analytics/actions'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { RichEditor, htmlToPlain } from '@/components/atelier/RichEditor'
import { thumbUrl } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb, MissingThumb } from './WorkThumb'
import PdfExportDrawer from '@/components/portfolio/PdfExportDrawer'
import { PortfolioLandingPanel } from '@/components/atelier/portfolio/PortfolioLandingPanel'
import { PortfolioCollectionsPanel } from '@/components/atelier/portfolio/PortfolioCollectionsPanel'
import { PortfolioWorksManager } from '@/components/atelier/portfolio/PortfolioWorksManager'

// ── Types ─────────────────────────────────────────────────────────────────

interface CollectionItem {
  id:              string
  title_fr:        string
  title_en:        string
  /** Optional: shown before works on /works when site mode is “intro” */
  intro_fr:        string
  intro_en:        string
  description_fr:  string
  description_en:  string
  theme:           string | null
  sort_order:      number
  is_active:       boolean
  manual_work_order?: number[]
}

// Reorder helper — returns a new array with element moved from→to.
function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const next = arr.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

interface WorksMode {
  id:           string
  label_fr:     string
  label_en:     string
  is_active:    boolean
  sort_order:   number
  collections:  CollectionItem[]
  outro_fr:     string
  outro_en:     string
}

interface LandingConfig {
  /**
   * Full public `https://…` URL for the landing circle hero; empty → default asset.
   * Future: optional vault/R2 upload (same validation path as work images).
   */
  hero_image_url: string
}

interface PortfolioConfig {
  general: {
    artist_name:       string
    contact_email:     string
    instagram:         string
    phone:             string
    media_tagline_fr:  string
    media_tagline_en:  string
  }
  about: {
    intro_fr: string
    intro_en: string
  }
  practice: {
    approach_fr:  string
    approach_en:  string
    themes:       string[]
    materials_fr: string
    materials_en: string
  }
  landing:           LandingConfig
  sections:          CollectionItem[]
  works_collections: CollectionItem[]   // legacy mirror of works_modes[0].collections
  works_modes:       WorksMode[]
}

type ThemeWork = { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }

interface Props {
  oeuvres: Oeuvre[]
  themes:  { id: number; name: string }[]
  themePublicStats?: Record<number, { total: number; pub: number }>
  themePrivateWorks?: Record<number, number[]>
  /** When set and greater than `oeuvres.length`, show partial-catalogue note. */
  oeuvresCatalogueTotal?: number
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PortfolioConfig = {
  general: { artist_name: '', contact_email: '', instagram: '', phone: '', media_tagline_fr: '', media_tagline_en: '' },
  about:   { intro_fr: '', intro_en: '' },
  practice:{ approach_fr: '', approach_en: '', themes: [], materials_fr: '', materials_en: '' },
  landing: { hero_image_url: '' },
  sections: [],
  works_collections: [],
  works_modes: [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    is_active: true, sort_order: 0,
    collections: [], outro_fr: '', outro_en: '',
  }],
}

// Migrate old single-field config to dual-field
function migrate(raw: any): PortfolioConfig {
  const isOldArray = Array.isArray(raw)
  const oldSections = isOldArray ? raw : (raw.sections || [])
  const oldWorks    = isOldArray ? raw : (raw.works_collections || [])

  function migrateCollection(c: any): CollectionItem {
    return {
      id:             c.id || Math.random().toString(36).slice(2),
      title_fr:       c.title_fr || c.title || '',
      title_en:       c.title_en || '',
      intro_fr:       c.intro_fr || '',
      intro_en:       c.intro_en || '',
      description_fr: c.description_fr || c.description || '',
      description_en: c.description_en || '',
      theme:          c.theme ?? null,
      sort_order:     c.sort_order ?? 0,
      is_active:      c.is_active ?? true,
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : undefined,
    }
  }

  return {
    general: {
      artist_name:      raw.general?.artist_name      || '',
      contact_email:    raw.general?.contact_email    || '',
      instagram:        raw.general?.instagram        || '',
      phone:            raw.general?.phone            || '',
      media_tagline_fr: raw.general?.media_tagline_fr || '',
      media_tagline_en: raw.general?.media_tagline_en || '',
    },
    about: {
      intro_fr: raw.about?.intro_fr || raw.about?.intro || raw.general?.about_intro || '',
      intro_en: raw.about?.intro_en || '',
    },
    practice: {
      approach_fr:  raw.practice?.approach_fr  || raw.practice?.approach  || '',
      approach_en:  raw.practice?.approach_en  || '',
      themes:       raw.practice?.themes       || [],
      materials_fr: raw.practice?.materials_fr || raw.practice?.materials || '',
      materials_en: raw.practice?.materials_en || '',
    },
    landing: {
      hero_image_url: String(raw.landing?.hero_image_url ?? '').trim(),
    },
    sections:          oldSections.map(migrateCollection),
    works_collections: oldWorks.map(migrateCollection),
    works_modes:       migrateModes(raw, oldWorks.map(migrateCollection)),
  }
}

function migrateModes(raw: any, fallbackCollections: CollectionItem[]): WorksMode[] {
  const list = Array.isArray(raw.works_modes) ? raw.works_modes : []
  if (list.length === 0) {
    return [{
      id: 'default', label_fr: 'Œuvres', label_en: 'Works',
      is_active: true, sort_order: 0,
      collections: fallbackCollections,
      outro_fr: raw.works_outro_fr ?? '',
      outro_en: raw.works_outro_en ?? '',
    }]
  }
  return list.map((m: any, i: number): WorksMode => ({
    id:          m.id || Math.random().toString(36).slice(2),
    label_fr:    m.label_fr || m.label || (i === 0 ? 'Œuvres' : `Mode ${i + 1}`),
    label_en:    m.label_en || m.label || (i === 0 ? 'Works'  : `Mode ${i + 1}`),
    is_active:   m.is_active ?? true,
    sort_order:  m.sort_order ?? i,
    collections: Array.isArray(m.collections) ? m.collections.map((c: any) => ({
      id:             c.id || Math.random().toString(36).slice(2),
      title_fr:       c.title_fr || c.title || '',
      title_en:       c.title_en || '',
      intro_fr:       c.intro_fr || '',
      intro_en:       c.intro_en || '',
      description_fr: c.description_fr || c.description || '',
      description_en: c.description_en || '',
      theme:          c.theme ?? null,
      sort_order:     c.sort_order ?? 0,
      is_active:      c.is_active ?? true,
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : undefined,
    })) : [],
    outro_fr:    m.outro_fr || '',
    outro_en:    m.outro_en || '',
  }))
}

// ── FlamePreview ───────────────────────────────────────────────────────────

function FlamePreview({ html }: { html: string }) {
  const plain = htmlToPlain(html)
  return (
    <div style={{
      border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
      background: '#f0ede8', fontFamily: 'var(--font-ui)',
      fontSize: 11, lineHeight: 2.0, letterSpacing: '0.15em',
      textTransform: 'uppercase', color: '#8a8680',
      textAlign: 'justify', wordSpacing: '0.3em',
      whiteSpace: 'pre-wrap', minHeight: 60,
    }}>
      {plain
        ? plain.replace(/\./g, ' /').replace(/\n/g, ' █ ')
        : <span style={{ opacity: 0.25 }}>—</span>
      }
    </div>
  )
}

function ProsePreview({ html }: { html: string }) {
  if (!html) return (
    <div style={{
      border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
      background: '#f0ede8', minHeight: 60, display: 'flex', alignItems: 'center',
    }}>
      <span style={{ opacity: 0.25, fontSize: 11 }}>—</span>
    </div>
  )
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
        background: '#f0ede8', fontSize: 12, lineHeight: 1.8,
        color: 'var(--tx2)', minHeight: 60,
      }}
    />
  )
}

function isHttpsHeroUrl(s: string): boolean {
  const u = (s ?? '').trim()
  return /^https:\/\//i.test(u)
}

function SitePublicSection({ title, icon, children, action, testId }: {
  title: string
  icon: string
  children: React.ReactNode
  action?: React.ReactNode
  testId?: string
}) {
  return (
    <section
      data-testid={testId}
      style={{
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        borderRadius: 8,
        padding: 24,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div className="row between" style={{
        paddingBottom: 14,
        marginBottom: 20,
        alignItems: 'center',
        borderBottom: '1px solid var(--bd)',
      }}>
        <div className="row gap-md center">
          <span style={{ fontSize: 18, color: 'var(--ac)' }}>{icon}</span>
          <h3 className="serif" style={{ fontSize: 20 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

// ── Component ─────────────────────────────────────────────────────────────

export function PortfolioTab({
  oeuvres,
  themes,
  themePublicStats = {},
  themePrivateWorks = {},
  oeuvresCatalogueTotal,
}: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const router = useRouter()
  const [config,     setConfig]     = useState<PortfolioConfig>(DEFAULT_CONFIG)
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<'website' | 'portfolio' | 'analytics'>('website')
  const [activeMode, setActiveMode] = useState(0)
  const [activeSlot, setActiveSlot] = useState<{
    type: 'theme'
    page: 'works' | 'sections'
    index: number
    modeIdx?: number
  } | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [pdfOpen,  setPdfOpen]  = useState(false)
  const [portfolioEtag, setPortfolioEtag] = useState<string | null>(null)

  const themeNames = themes.map(t => t.name).sort((a, b) => a.localeCompare(b, 'fr'))

  const themeNameStats = useMemo(() => {
    const map: Record<string, { total: number; pub: number }> = {}
    for (const t of themes) {
      const s = themePublicStats[t.id]
      if (s) map[t.name] = s
    }
    return map
  }, [themes, themePublicStats])

  const oeuvreThemeLite = useMemo(() => {
    const m = new Map<number, ThemeWork>()
    for (const o of oeuvres) {
      m.set(o.OeuvreID, {
        OeuvreID: o.OeuvreID,
        txtImageNameLink: o.txtImageNameLink ?? null,
        isPublic: !!(o as { is_public?: boolean }).is_public,
      })
    }
    return m
  }, [oeuvres])

  const themeNamePrivateWorks = useMemo(() => {
    const map: Record<string, ThemeWork[]> = {}
    for (const t of themes) {
      const ids = themePrivateWorks[t.id]
      if (!ids?.length) continue
      const ws: ThemeWork[] = []
      for (const id of ids) {
        const w = oeuvreThemeLite.get(id)
        if (w) ws.push(w)
      }
      if (ws.length) map[t.name] = ws
    }
    return map
  }, [themes, themePrivateWorks, oeuvreThemeLite])

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await loadPortfolioConfig()
    if ('ok' in result) {
      setConfig(migrate(result.config))
      setPortfolioEtag(result.etag)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    setSaveBusy(true)
    const result = await savePortfolioConfig(config, { ifMatch: portfolioEtag })
    setSaveBusy(false)
    if ('ok' in result) {
      setPortfolioEtag(result.etag)
      alert(t('portfolio_config_saved'))
    } else if (result.error === PORTFOLIO_SAVE_ERR.ETAG_MISMATCH) {
      alert(t('portfolio_save_etag_conflict'))
    } else if (result.error === PORTFOLIO_SAVE_ERR.OBJECT_EXISTS) {
      alert(t('portfolio_save_object_exists'))
    } else {
      alert(`${t('error_prefix')} ${result.error}`)
    }
  }

  const handleTransfer = (value: string) => {
    if (!activeSlot) return
    const { page, index, modeIdx } = activeSlot
    const next = { ...config }
    if (page === 'sections') {
      next.sections[index] = { ...next.sections[index], theme: value }
    } else {
      const m = modeIdx ?? activeMode
      const modes = next.works_modes.slice()
      const cols = modes[m].collections.slice()
      cols[index] = { ...cols[index], theme: value }
      modes[m] = { ...modes[m], collections: cols }
      next.works_modes = modes
    }
    setConfig(next)
    setActiveSlot(null)
  }

  // Mode helpers
  const updateMode = (i: number, patch: Partial<WorksMode>) => {
    const modes = config.works_modes.slice()
    modes[i] = { ...modes[i], ...patch }
    setConfig({ ...config, works_modes: modes })
  }
  const addMode = () => {
    const newMode: WorksMode = {
      id: Math.random().toString(36).slice(2),
      label_fr: `Mode ${config.works_modes.length + 1}`,
      label_en: `Mode ${config.works_modes.length + 1}`,
      is_active: true,
      sort_order: config.works_modes.length,
      collections: [],
      outro_fr: '', outro_en: '',
    }
    setConfig({ ...config, works_modes: [...config.works_modes, newMode] })
    setActiveMode(config.works_modes.length)
  }
  const deleteMode = (i: number) => {
    if (config.works_modes.length <= 1) {
      alert(t('portfolio_one_mode_required'))
      return
    }
    const label =
      lang === 'en'
        ? config.works_modes[i].label_en || config.works_modes[i].label_fr
        : config.works_modes[i].label_fr || config.works_modes[i].label_en
    if (!confirm(t('portfolio_confirm_delete_mode_fmt').replace(/\{label\}/g, label))) return
    const modes = config.works_modes.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sort_order: idx }))
    setConfig({ ...config, works_modes: modes })
    setActiveMode(Math.max(0, Math.min(activeMode, modes.length - 1)))
  }
  const moveMode = (from: number, to: number) => {
    if (to < 0 || to >= config.works_modes.length) return
    const modes = reorder(config.works_modes, from, to).map((m, i) => ({ ...m, sort_order: i }))
    setConfig({ ...config, works_modes: modes })
    if (activeMode === from) setActiveMode(to)
    else if (from < activeMode && to >= activeMode) setActiveMode(activeMode - 1)
    else if (from > activeMode && to <= activeMode) setActiveMode(activeMode + 1)
  }
  const addModeCollection = (m: number) => {
    const modes = config.works_modes.slice()
    const newItem: CollectionItem = {
      id: Math.random().toString(36).slice(2),
      title_fr: '', title_en: '',
      intro_fr: '', intro_en: '',
      description_fr: '', description_en: '',
      theme: null,
      sort_order: modes[m].collections.length,
      is_active: true,
    }
    modes[m] = { ...modes[m], collections: [...modes[m].collections, newItem] }
    setConfig({ ...config, works_modes: modes })
  }
  const moveModeCollection = (m: number, from: number, to: number) => {
    const list = config.works_modes[m].collections
    if (to < 0 || to >= list.length) return
    const cols = reorder(list, from, to).map((c, i) => ({ ...c, sort_order: i }))
    updateMode(m, { collections: cols })
  }
  const updateModeCollection = (m: number, i: number, patch: Partial<CollectionItem>) => {
    const cols = config.works_modes[m].collections.slice()
    cols[i] = { ...cols[i], ...patch }
    updateMode(m, { collections: cols })
  }
  const deleteModeCollection = (m: number, id: string) => {
    updateMode(m, { collections: config.works_modes[m].collections.filter(c => c.id !== id) })
  }

  const handleMakePublic = async (oeuvreId: number) => {
    const res = await setWorkPublic(oeuvreId)
    if ('error' in res) {
      alert(`${t('error_prefix')} ${res.error}`)
      return
    }
    router.refresh()
  }

  const addItem = (target: 'sections' | 'works_collections') => {
    const newItem: CollectionItem = {
      id: Math.random().toString(36).slice(2),
      title_fr: '', title_en: '',
      intro_fr: '', intro_en: '',
      description_fr: '', description_en: '',
      theme: null,
      sort_order: config[target].length,
      is_active: true
    }
    setConfig({ ...config, [target]: [...config[target], newItem] })
  }

  const moveCollection = (target: 'sections' | 'works_collections', from: number, to: number) => {
    const list = config[target]
    if (to < 0 || to >= list.length) return
    const next = reorder(list, from, to).map((c, i) => ({ ...c, sort_order: i }))
    setConfig({ ...config, [target]: next })
  }

  if (loading) return <div className="pad-lg t-mono-sm">{t('loading')}</div>

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg0)', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: narrow ? 10 : 0,
          padding: narrow
            ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))'
            : '0 40px',
          paddingTop: narrow ? 'max(10px, env(safe-area-inset-top))' : undefined,
          borderBottom: '1px solid var(--bd)',
          background: 'var(--bg1)',
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: narrow ? 4 : 0, minWidth: 0 }}>
          {(['website', 'portfolio', 'analytics'] as const).map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
              padding: narrow ? '12px 14px' : '16px 24px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--ac)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--ac)' : 'var(--tx3)',
              cursor: 'pointer', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase',
              fontFamily: 'inherit', fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.2s',
              minHeight: 44,
            }}>
              {tab === 'website' ? t('portfolio_subtab_website') : tab === 'portfolio' ? t('portfolio_subtab_portfolio') : t('portfolio_subtab_analytics')}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 8 : 12, flexWrap: 'wrap', justifyContent: narrow ? 'flex-end' : 'flex-start' }}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            title="Ouvrir la page d'accueil (site public)"
          >
            Site
          </a>
          <button
            type="button"
            onClick={() => setPdfOpen(true)}
            className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, minHeight: 44 }}
            title={t('portfolio_pdf_preview_tooltip')}
          >
            ↓ PDF
          </button>
          <a
            href="/works"
            target="_blank"
            rel="noopener noreferrer"
            className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            title={t('portfolio_catalog_tooltip')}
          >
            /works
          </a>
          {activeTab !== 'analytics' && (
            <button
              type="button"
              className="btn primary sm"
              title={t('portfolio_save_config_tooltip')}
              onClick={handleSave}
              disabled={saveBusy}
              style={{ fontSize: 9, letterSpacing: 1.5, minHeight: 44 }}
            >
              {saveBusy ? t('savingRecord') : t('save')}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          overflow: 'hidden',
          minHeight: 0,
          minWidth: 0,
        }}
      >

        {/* Left sidebar — sources (hidden on analytics tab); below main on narrow */}
        <div
          style={{
            width: activeTab === 'analytics' ? 0 : narrow ? '100%' : 280,
            maxHeight: activeTab === 'analytics' ? 0 : narrow ? 'min(38vh, 260px)' : undefined,
            borderRight: activeTab === 'analytics' || narrow ? 'none' : '1px solid var(--bd)',
            borderBottom: activeTab === 'analytics' || !narrow ? 'none' : '1px solid var(--bd)',
            background: 'var(--bg1)',
            display: activeTab === 'analytics' ? 'none' : 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            minHeight: 0,
            order: narrow ? 2 : 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('portfolio_panel_sources')}</div>
            <p className="t-mono-xs" style={{ opacity: 0.4 }}>
              {activeSlot ? t('portfolio_sources_hint_pick') : t('portfolio_sources_hint_click')}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: narrow ? '12px 14px' : 16 }} className="col gap-lg">
            <div>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10 }}>{t('portfolio_themes_groups_heading')}</div>
              <div className="col gap-xs">
                {themeNames.map(name => {
                  const s = themeNameStats[name]
                  const hasPrivate = s ? s.pub < s.total : false
                  return (
                    <SourceItem key={name} label={name}
                      active={!!activeSlot}
                      onClick={() => activeSlot && handleTransfer(name)}
                      badge={s ? `${s.pub}/${s.total}` : undefined}
                      badgeWarn={hasPrivate} />
                  )
                })}
              </div>
            </div>
          </div>
          {activeSlot && (
            <div style={{ padding: 16, paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'var(--ac)', color: 'white', textAlign: 'center' }}>
              <p className="t-mono-sm" style={{ fontWeight: 600, marginBottom: 8 }}>{t('portfolio_slot_click_target')}</p>
              <button type="button" className="btn sm ghost" style={{ color: 'white', borderColor: 'white', minHeight: 44 }} onClick={() => setActiveSlot(null)}>{t('cancel')}</button>
            </div>
          )}
        </div>

        {/* Main content — no maxWidth constraint (analytics: single viewport, no scroll) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflowY: activeTab === 'analytics' ? 'hidden' : 'auto',
            overflowX: 'hidden',
            padding:
              activeTab === 'analytics'
                ? narrow
                  ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))'
                  : '10px 14px'
                : narrow
                  ? '16px max(12px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))'
                  : '32px 40px',
            display: activeTab === 'analytics' ? 'flex' : 'block',
            flexDirection: 'column',
            order: narrow ? 1 : 0,
          }}
        >
          <div
            className={activeTab === 'website' ? 'portfolio-site-public' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: activeTab === 'analytics' ? 0 : activeTab === 'website' ? 32 : 48,
              flex: activeTab === 'analytics' ? 1 : undefined,
              minHeight: activeTab === 'analytics' ? 0 : undefined,
            }}
          >

            {activeTab === 'website' && (
              <>
                <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 0, maxWidth: 720, lineHeight: 1.5 }}>
                  Onglet <strong>Site public</strong> : identité, pages <strong>À propos</strong> et <strong>Pratique</strong>, et les <strong>modes /works</strong> (chaque mode = un sous-onglet sur la page <code style={{ opacity: 0.85 }}>/works</code>). Les sections dédiées au flux portfolio sont dans l&apos;onglet <strong>Portfolio</strong>.
                </p>

                <PortfolioLandingPanel>
                <SitePublicSection title={t('atelier_pub_hero_section_title')} icon="◎" testId="atelier-pub-hero-section">
                  <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>{t('atelier_pub_hero_url_help')}</p>
                  <p className="t-mono-xs" style={{ opacity: 0.4, marginBottom: 16, fontSize: 9 }}>{t('atelier_pub_hero_r2_followup')}</p>
                  <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{t('atelier_pub_hero_url_label')}</label>
                  <input
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    className="input full"
                    placeholder={t('atelier_pub_hero_url_placeholder')}
                    value={config.landing.hero_image_url}
                    onChange={e => setConfig({
                      ...config,
                      landing: { ...config.landing, hero_image_url: e.target.value },
                    })}
                  />
                  {isHttpsHeroUrl(config.landing.hero_image_url) && (
                    <div style={{ marginTop: 16 }}>
                      <div className="t-label" style={{ marginBottom: 4, fontSize: 9 }}>{t('atelier_pub_hero_preview_label')}</div>
                      <p className="t-mono-xs" style={{ opacity: 0.45, marginBottom: 12, fontSize: 9, wordBreak: 'break-all' }}>
                        {config.landing.hero_image_url.trim().replace(/^https?:\/\/[^/]+/, '')}
                      </p>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>CERCLE</div>
                          <img src={config.landing.hero_image_url.trim()} alt="circle crop"
                            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--bd)' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>1:1</div>
                          <img src={config.landing.hero_image_url.trim()} alt="1:1 crop"
                            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>4:3</div>
                          <img src={config.landing.hero_image_url.trim()} alt="4:3 crop"
                            style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>3:4</div>
                          <img src={config.landing.hero_image_url.trim()} alt="3:4 crop"
                            style={{ width: 90, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </SitePublicSection>

                <SitePublicSection title="Identité générale" icon="◈">
                  <div className="site-pub-grid-2" style={{ marginBottom: 20 }}>
                    <Slot label="Nom de l'artiste">
                      <input className="input full" value={config.general.artist_name}
                        onChange={e => setConfig({ ...config, general: { ...config.general, artist_name: e.target.value } })} />
                    </Slot>
                    <Slot label="Email public">
                      <input className="input full" value={config.general.contact_email}
                        onChange={e => setConfig({ ...config, general: { ...config.general, contact_email: e.target.value } })} />
                    </Slot>
                    <Slot label="Instagram">
                      <input className="input full" value={config.general.instagram}
                        onChange={e => setConfig({ ...config, general: { ...config.general, instagram: e.target.value } })} />
                    </Slot>
                    <Slot label="Téléphone">
                      <input className="input full" value={config.general.phone}
                        onChange={e => setConfig({ ...config, general: { ...config.general, phone: e.target.value } })} />
                    </Slot>
                  </div>
                  <DualField label="Accroche médiums"
                    fr={config.general.media_tagline_fr} en={config.general.media_tagline_en}
                    onFr={v => setConfig({ ...config, general: { ...config.general, media_tagline_fr: v } })}
                    onEn={v => setConfig({ ...config, general: { ...config.general, media_tagline_en: v } })}
                    placeholder={{ fr: 'Peinture · Dessin · Sculpture', en: 'Painting · Drawing · Sculpture' }} />
                </SitePublicSection>

                <SitePublicSection title="Page À propos" icon="✎">
                  <DualField label="Texte d'introduction" rich allowImport preview="prose"
                    fr={config.about.intro_fr} en={config.about.intro_en}
                    onFr={v => setConfig({ ...config, about: { ...config.about, intro_fr: v } })}
                    onEn={v => setConfig({ ...config, about: { ...config.about, intro_en: v } })} />
                </SitePublicSection>

                <SitePublicSection title="Page Pratique" icon="◉">
                  <DualField label="Approche / statement" rich allowImport preview="prose"
                    fr={config.practice.approach_fr} en={config.practice.approach_en}
                    onFr={v => setConfig({ ...config, practice: { ...config.practice, approach_fr: v } })}
                    onEn={v => setConfig({ ...config, practice: { ...config.practice, approach_en: v } })} />
                  <div style={{ marginTop: 20 }}>
                    <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>
                      THÈMES CENTRAUX (un par ligne)
                    </label>
                    <textarea
                      className="input full"
                      rows={5}
                      value={(config.practice.themes ?? []).join('\n')}
                      onChange={e => setConfig({
                        ...config,
                        practice: {
                          ...config.practice,
                          themes: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean)
                        }
                      })}
                      placeholder="La physiologie de la perception…"
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <DualField label="Médiums & matériaux"
                      fr={config.practice.materials_fr} en={config.practice.materials_en}
                      onFr={v => setConfig({ ...config, practice: { ...config.practice, materials_fr: v } })}
                      onEn={v => setConfig({ ...config, practice: { ...config.practice, materials_en: v } })} />
                  </div>
                </SitePublicSection>

                </PortfolioLandingPanel>

                <PortfolioWorksManager>
                <SitePublicSection title={config.works_modes.length > 1 ? 'Page /works — Modes' : 'Page /works — Collections'} icon="▤"
                  action={config.works_modes.length > 1 ? <button className="btn sm ghost" onClick={addMode}>+ Mode</button> : undefined}>
                  {config.works_modes.length <= 1 && (
                    <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 16, maxWidth: 720, lineHeight: 1.45 }}>
                      {`Séquences de la page `}<code style={{ opacity: 0.85 }}>/works</code>{` et carte de clôture.`}
                    </p>
                  )}
                  {config.works_modes.length > 1 && (
                    <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 16 }}>
                      Chaque mode devient un sous-onglet sur <code>/works</code>, avec ses collections et sa carte de cl&#xF4;ture.
                    </p>
                  )}

                  {config.works_modes.length > 1 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--bd)', marginBottom: 24, paddingBottom: 8 }}>
                      {config.works_modes.map((m, i) => {
                        const isActive = i === activeMode
                        return (
                          <div key={m.id} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 10px', borderRadius: 4,
                            background: isActive ? 'var(--ac)' : 'var(--bg1)',
                            border: '1px solid ' + (isActive ? 'var(--ac)' : 'var(--bd)'),
                            color: isActive ? '#fff' : 'var(--tx2)',
                            opacity: m.is_active ? 1 : 0.5,
                          }}>
                            <button onClick={() => setActiveMode(i)} className="t-mono-xs"
                              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 10, letterSpacing: 1, fontFamily: 'inherit', textTransform: 'uppercase' }}>
                              {m.label_fr || m.label_en || `Mode ${i + 1}`}
                            </button>
                            <span className="t-mono-xs" style={{ fontSize: 8, opacity: 0.6 }}>{i + 1}/{config.works_modes.length}</span>
                            <button onClick={() => moveMode(i, i - 1)} disabled={i === 0}
                              title="D&#xE9;placer &#xE0; gauche" style={{ ...moveBtnStyle(i === 0), width: 16, height: 16, fontSize: 9 }}>{'←'}</button>
                            <button onClick={() => moveMode(i, i + 1)} disabled={i === config.works_modes.length - 1}
                              title="D&#xE9;placer &#xE0; droite" style={{ ...moveBtnStyle(i === config.works_modes.length - 1), width: 16, height: 16, fontSize: 9 }}>{'→'}</button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {config.works_modes[activeMode] && (() => {
                    const mode = config.works_modes[activeMode]
                    return (
                      <div className="col gap-lg" style={{ gap: 28 }}>
                        {config.works_modes.length > 1 && (
                          <div className="site-pub-grid-mode">
                            <div>
                              <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{`LIBELLÉ ONGLET FR`}</label>
                              <input className="input full" value={mode.label_fr} onChange={e => updateMode(activeMode, { label_fr: e.target.value })} />
                            </div>
                            <div>
                              <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{`LIBELLÉ ONGLET EN`}</label>
                              <input className="input full" value={mode.label_en} onChange={e => updateMode(activeMode, { label_en: e.target.value })} />
                            </div>
                            <label className="row gap-xs pointer center" style={{ paddingBottom: 6 }}>
                              <input type="checkbox" checked={mode.is_active} onChange={e => updateMode(activeMode, { is_active: e.target.checked })} />
                              <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIF</span>
                            </label>
                            <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', paddingBottom: 6, fontSize: 11 }}
                              onClick={() => deleteMode(activeMode)}
                              disabled={config.works_modes.length <= 1}
                              title={config.works_modes.length <= 1 ? 'Au moins un mode requis' : 'Supprimer ce mode'}>
                              Supprimer mode
                            </button>
                          </div>
                        )}

                        <div>
                          {config.works_modes.length > 1 && (
                            <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>COLLECTIONS DU MODE ({mode.collections.length})</div>
                          )}
                          <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 12, maxWidth: 720, lineHeight: 1.45 }}>
                            {`Glisser ⦂⦂ ou ↑↓ pour réordonner.`}
                          </p>
                          <div className="col gap-md">
                            {mode.collections.map((item, i) => (
                              <CollectionRow key={item.id} item={item}
                                index={i} total={mode.collections.length}
                                sequenceLabel={`Séquence ${i + 1}`}
                                onMove={(from, to) => moveModeCollection(activeMode, from, to)}
                                isTarget={activeSlot?.page === 'works' && activeSlot?.modeIdx === activeMode && activeSlot?.index === i}
                                onAssign={() => setActiveSlot({ type: 'theme', page: 'works', index: i, modeIdx: activeMode })}
                                onUpdate={p => updateModeCollection(activeMode, i, p)}
                                onDelete={() => deleteModeCollection(activeMode, item.id)}
                                themeStats={themeNameStats}
                                privateWorks={item.theme ? themeNamePrivateWorks[item.theme] : undefined}
                                onMakePublic={handleMakePublic} />
                            ))}
                            <button className="btn sm ghost" onClick={() => addModeCollection(activeMode)} style={{ alignSelf: 'flex-start' }}>
                              + Collection
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>CARTE DE CLÔTURE — texte affiché après la dernière œuvre</div>
                          <DualField label="" rich allowImport preview="prose"
                            fr={mode.outro_fr} en={mode.outro_en}
                            onFr={v => updateMode(activeMode, { outro_fr: v })}
                            onEn={v => updateMode(activeMode, { outro_en: v })} />
                        </div>
                      </div>
                    )
                  })()}
                  {config.works_modes.length <= 1 && (
                    <button type="button" className="t-mono-xs" onClick={addMode}
                      style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 9, letterSpacing: 1, opacity: 0.6 }}>
                      + Ajouter un mode (sous-onglets)
                    </button>
                  )}
                </SitePublicSection>
                </PortfolioWorksManager>
              </>
            )}

            {activeTab === 'portfolio' && (
              <>
                <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 24, maxWidth: 720, lineHeight: 1.5 }}>
                  Onglet <strong>Portfolio</strong> : sections enregistrées dans le JSON (R2). Elles alimentent le <strong>PDF téléchargeable</strong> (lien sur la page d&apos;accueil et bouton <code>↓ PDF</code> ci-dessus). Utiliser <code>/works</code> pour l&apos;aperçu du catalogue défilant.
                </p>
                <PortfolioCollectionsPanel>
                <PageSection title="Sections Portfolio" icon="◪"
                  action={<button className="btn sm ghost" onClick={() => addItem('sections')}>+ Ajouter</button>}>
                  <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 20 }}>
                    Données de section (titres, textes, thème, ordre des œuvres) — consommées par le PDF (titre · intro · œuvres dans l&apos;ordre choisi).
                  </p>
                  <div className="col gap-md">
                    {config.sections.map((item, i) => (
                      <CollectionRow key={item.id} item={item}
                        index={i} total={config.sections.length}
                        onMove={(from, to) => moveCollection('sections', from, to)}
                        isTarget={activeSlot?.page === 'sections' && activeSlot?.index === i}
                        onAssign={() => setActiveSlot({ type: 'theme', page: 'sections', index: i })}
                        onUpdate={p => {
                          const next = [...config.sections]; next[i] = { ...item, ...p }
                          setConfig({ ...config, sections: next })
                        }}
                        onDelete={() => setConfig({ ...config, sections: config.sections.filter(x => x.id !== item.id) })}
                        themeStats={themeNameStats}
                        privateWorks={item.theme ? themeNamePrivateWorks[item.theme] : undefined}
                        onMakePublic={handleMakePublic} />
                    ))}
                    {config.sections.length === 0 && (
                      <div className="t-mono-xs" style={{ opacity: 0.3, padding: '24px 0' }}>Aucune section. Cliquer &quot;+ Ajouter&quot;.</div>
                    )}
                  </div>
                </PageSection>
                </PortfolioCollectionsPanel>
              </>
            )}

            {activeTab === 'analytics' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <AnalyticsPanel
                  themes={themes}
                  oeuvres={oeuvres}
                  themePublicStats={themePublicStats}
                />
              </div>
            )}

          </div>
        </div>
      </div>

      <style jsx>{`
        .full { width: 100%; }
        :global(.portfolio-site-public) .site-pub-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        :global(.portfolio-site-public) .site-pub-grid-mode {
          display: grid;
          grid-template-columns: 1fr 1fr auto auto;
          gap: 12px;
          align-items: end;
        }
        @media (max-width: 767px) {
          :global(.portfolio-site-public) .site-pub-grid-2 {
            grid-template-columns: 1fr;
          }
          :global(.portfolio-site-public) .site-pub-grid-mode {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <PdfExportDrawer open={pdfOpen} onClose={() => setPdfOpen(false)} />
    </div>
  )
}

// ── AnalyticsPanel ────────────────────────────────────────────────────────

function BarList({ items, labelKey, valueKey, maxRows = 10 }: {
  items: Record<string, unknown>[]
  labelKey: string
  valueKey: string
  maxRows?: number
}) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const slice = items.slice(0, maxRows)
  const max = slice[0]?.[valueKey] as number | undefined ?? 1
  if (slice.length === 0) return (
    <div className="t-mono-xs" style={{ color: 'var(--tx3)', opacity: 0.5 }}>{t('analytics_barlist_empty')}</div>
  )
  return (
    <div className="col" style={{ gap: 12 }}>
      {slice.map((item, i) => {
        const v = item[valueKey] as number
        const label = String(item[labelKey])
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div
              className="t-mono-sm"
              title={label}
              style={{
                color: 'var(--tx2)',
                fontSize: 12,
                lineHeight: 1.4,
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--bd)', borderRadius: 3, minWidth: 0 }}>
                <div style={{
                  width: `${(v / max) * 100}%`, height: '100%', background: 'var(--ac)', borderRadius: 3,
                }} />
              </div>
              <div className="t-mono-sm" style={{
                minWidth: 52, textAlign: 'right', color: 'var(--tx)', flexShrink: 0, fontSize: 12, fontVariantNumeric: 'tabular-nums',
              }}>
                {v.toLocaleString(numLocale)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function trendDayMonth(iso: string) {
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  const [, m, d] = parts
  return `${d}/${m}`
}

/** SVG sparkline: uniform scaling + inset so edge value/date labels are not clipped. */
function Sparkline({ trend }: { trend: { date: string; views: number }[] }) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  if (trend.length === 0) return null
  const max = Math.max(...trend.map(d => d.views), 1)
  const padL = 44
  const padR = 44
  const padT = 22
  const dateBand = 20
  const chartH = 52
  const vbW = 400
  const vbH = padT + chartH + dateBand
  const innerW = vbW - padL - padR
  const denom = Math.max(trend.length - 1, 1)

  const xAt = (i: number) => padL + (i / denom) * innerW
  const yAt = (views: number) =>
    padT + chartH - (views / max) * (chartH - 12) - 4

  const pts = trend.map((d, i) => `${xAt(i)},${yAt(d.views)}`).join(' ')

  const labelCount = Math.min(9, trend.length)
  const labelIdx = new Set<number>()
  if (labelCount === 1) {
    labelIdx.add(0)
  } else {
    for (let k = 0; k < labelCount; k++) {
      const j = Math.round((k * (trend.length - 1)) / (labelCount - 1))
      labelIdx.add(j)
    }
  }

  const dateY = padT + chartH + 13

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', minHeight: 112, display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--ac)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {trend.map((d, i) => {
        const x = xAt(i)
        const y = yAt(d.views)
        return (
          <g key={d.date + i}>
            <title>{t('analytics_sparkline_point_title_fmt')
              .replace('{date}', d.date)
              .replace('{views}', d.views.toLocaleString(numLocale))}</title>
            <circle
              cx={x}
              cy={y}
              r={labelIdx.has(i) ? 3.2 : 2}
              fill="var(--ac)"
              stroke="var(--bg0)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
      {trend.map((d, i) => {
        if (!labelIdx.has(i)) return null
        const x = xAt(i)
        const y = yAt(d.views)
        const n = d.views.toLocaleString(numLocale)
        const dm = trendDayMonth(d.date)
        const valY = Math.max(y - 10, 12)
        return (
          <g key={`t-${d.date}-${i}`}>
            <text
              x={x}
              y={valY}
              textAnchor="middle"
              fill="var(--tx)"
              fontSize="11"
              fontFamily="var(--font-ui)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {n}
            </text>
            <text
              x={x}
              y={dateY}
              textAnchor="middle"
              fill="var(--tx3)"
              fontSize="9"
              fontFamily="var(--font-ui)"
            >
              {dm}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function AnalyticsMetricCard({
  label,
  value,
  comparison,
  hint,
}: {
  label: string
  value: string
  comparison?: AnalyticsComparison
  hint?: string
}) {
  const { t } = useI18n()
  const delta = comparison?.deltaPercent
  const deltaText =
    delta == null
      ? t('analytics_delta_no_baseline')
      : t('analytics_delta_previous_period').replace('{delta}', `${delta > 0 ? '+' : ''}${delta}%`)
  const deltaColor = delta == null || delta === 0 ? 'var(--tx3)' : delta > 0 ? 'var(--sage)' : 'var(--rust)'

  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg0)',
      border: '1px solid var(--bd)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: 0,
    }}>
      <div className="t-label" style={{ marginBottom: 6, fontSize: 10 }}>
        {label}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 300,
        lineHeight: 1,
        color: 'var(--tx)',
        fontFamily: 'var(--font-serif, serif)',
        letterSpacing: -0.5,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {comparison && (
        <div className="t-mono-xs" style={{ color: deltaColor, marginTop: 6, lineHeight: 1.35, fontSize: 9 }}>
          {deltaText}
        </div>
      )}
      {hint && (
        <div className="t-mono-xs" style={{ color: 'var(--tx3)', marginTop: 6, lineHeight: 1.3, fontSize: 9 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function SourceQualityList({
  items,
}: {
  items: { referrer: string; views: number; netVisitors: number; viewsPerVisitor: number | null }[]
}) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  if (items.length === 0) return (
    <div className="t-mono-xs" style={{ color: 'var(--tx3)', opacity: 0.5 }}>{t('analytics_barlist_empty')}</div>
  )

  return (
    <div className="col" style={{ gap: 10 }}>
      {items.map((item) => (
        <div key={item.referrer} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'baseline' }}>
          <div className="t-mono-sm" title={item.referrer} style={{ color: 'var(--tx2)', fontSize: 12, overflowWrap: 'anywhere' }}>
            {item.referrer}
          </div>
          <div className="t-mono-xs" style={{ color: 'var(--tx3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {t('analytics_source_quality_row_fmt')
              .replace('{visitors}', item.netVisitors.toLocaleString(numLocale))
              .replace('{viewsPerVisitor}', item.viewsPerVisitor == null ? '—' : item.viewsPerVisitor.toLocaleString(numLocale))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BrowsingDepthList({
  items,
}: {
  items: { bucket: '1' | '2_3' | '4_7' | '8_plus'; visitors: number }[]
}) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const labels = {
    '1': t('analytics_depth_1'),
    '2_3': t('analytics_depth_2_3'),
    '4_7': t('analytics_depth_4_7'),
    '8_plus': t('analytics_depth_8_plus'),
  }
  const max = Math.max(...items.map((item) => item.visitors), 1)

  return (
    <div className="col" style={{ gap: 10 }}>
      {items.map((item) => (
        <div key={item.bucket} style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr) 44px', gap: 8, alignItems: 'center' }}>
          <div className="t-mono-xs" style={{ color: 'var(--tx3)' }}>{labels[item.bucket]}</div>
          <div style={{ height: 6, background: 'var(--bd)', borderRadius: 3, minWidth: 0 }}>
            <div style={{ width: `${(item.visitors / max) * 100}%`, height: '100%', background: 'var(--ac)', borderRadius: 3 }} />
          </div>
          <div className="t-mono-xs" style={{ color: 'var(--tx)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {item.visitors.toLocaleString(numLocale)}
          </div>
        </div>
      ))}
    </div>
  )
}

function AnalyticsPanel({
  themes,
  oeuvres,
  themePublicStats,
}: {
  themes: { id: number; name: string }[]
  oeuvres: Oeuvre[]
  themePublicStats: Record<number, { total: number; pub: number }>
}) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const narrow = useMediaQuery('(max-width: 767px)')
  const periods = useMemo(
    () => [
      { days: 7 as const, label: t('analytics_period_7d') },
      { days: 30 as const, label: t('analytics_period_30d') },
      { days: 90 as const, label: t('analytics_period_90d') },
    ],
    [t],
  )
  const [days, setDays] = useState(30)
  const [scope, setScope] = useState<'public_site' | 'all'>('public_site')
  const [result, setResult] = useState<AnalyticsResult | null>(null)
  const [loading, setLoading] = useState(false)

  const cataloguePublic = useMemo(
    () => oeuvres.filter((o) => o.is_public === true).length,
    [oeuvres]
  )

  const themeRows = useMemo(() => {
    return [...themes]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((th) => {
        const s = themePublicStats[th.id]
        return { id: th.id, name: th.name, pub: s?.pub ?? 0, total: s?.total ?? 0 }
      })
      .filter((r) => r.total > 0)
  }, [themes, themePublicStats])

  const load = useCallback(async (d: number, sc: 'public_site' | 'all') => {
    setLoading(true)
    setResult(await getAnalyticsStats(d, { scope: sc, lang }))
    setLoading(false)
  }, [lang])

  useEffect(() => { load(days, scope) }, [load, days, scope, lang])

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflow: 'hidden',
      maxWidth: '100%',
    }}>
      {/* Toolbar — catalogue + filters on one band */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 10px',
        padding: narrow
          ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))'
          : '8px 10px',
        background: 'var(--bg0)',
        border: '1px solid var(--bd)',
        flexShrink: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <span className="t-mono-xs" style={{ color: 'var(--tx3)', letterSpacing: 1 }}>{t('analytics_toolbar_catalogue')}</span>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-serif, serif)' }}>
          {cataloguePublic.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')} / {oeuvres.length.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
        </span>
        <span className="t-mono-xs" style={{ color: 'var(--tx3)' }}>
          {' · '}
          {themeRows.length === 1
            ? t('analytics_themes_one').replace('{n}', String(themeRows.length))
            : t('analytics_themes_other').replace('{n}', String(themeRows.length))}
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--bd)', flexShrink: 0 }} aria-hidden />
        <span className="t-mono-xs" style={{ color: 'var(--tx3)', letterSpacing: 1 }}>{t('analytics_toolbar_traffic')}</span>
        {(['public_site', 'all'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} style={{
            padding: narrow ? '10px 12px' : '6px 12px', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--bd)',
            background: scope === s ? 'var(--ac)' : 'none',
            color: scope === s ? 'white' : 'var(--tx3)',
            borderColor: scope === s ? 'var(--ac)' : 'var(--bd)',
            minHeight: 44,
          }}>
            {s === 'public_site' ? t('analytics_scope_public_site') : t('analytics_scope_all_raw')}
          </button>
        ))}
        {periods.map((p) => (
          <button key={p.days} type="button" onClick={() => setDays(p.days)} style={{
            padding: narrow ? '10px 12px' : '6px 12px', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--bd)',
            background: days === p.days ? 'var(--ac)' : 'none',
            color: days === p.days ? 'white' : 'var(--tx3)',
            borderColor: days === p.days ? 'var(--ac)' : 'var(--bd)',
            minHeight: 44,
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: 12 }}>{t('loading')}</div>
      )}

      {!loading && result && 'error' in result && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--bg0)',
          border: '1px solid var(--bd)',
          color: 'var(--tx3)',
          fontSize: 12,
          flexShrink: 0,
        }}>
          {result.error}
        </div>
      )}

      {!loading && result && 'ok' in result && (
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{
            display: narrow ? 'flex' : 'grid',
            flexDirection: narrow ? 'column' : undefined,
            gridTemplateColumns: narrow ? undefined : 'repeat(4, minmax(104px, 1fr))',
            gap: 8,
            flexShrink: 0,
            minHeight: narrow ? undefined : 132,
          }}>
            <AnalyticsMetricCard
              label={result.scope === 'public_site' ? t('analytics_page_views_site') : t('analytics_page_views_raw')}
              value={result.pageviews.toLocaleString(numLocale)}
              comparison={result.comparisons.pageviews}
              hint={
                result.scope === 'public_site' && result.offSitePageviews != null && result.offSitePageviews > 0
                  ? t('analytics_off_routes_plus_fmt').replace('{count}', result.offSitePageviews.toLocaleString(numLocale))
                  : undefined
              }
            />
            <AnalyticsMetricCard
              label={t('analytics_net_visitors')}
              value={result.netUniqueVisitors.toLocaleString(numLocale)}
              comparison={result.comparisons.netUniqueVisitors}
              hint={t('analytics_net_visitors_hint')}
            />
            <AnalyticsMetricCard
              label={t('analytics_views_per_net_visitor')}
              value={result.viewsPerNetVisitor == null ? '—' : result.viewsPerNetVisitor.toLocaleString(numLocale)}
              comparison={result.comparisons.viewsPerNetVisitor}
            />
            <AnalyticsMetricCard
              label={t('analytics_returning_visitors')}
              value={result.returningVisitorRate == null ? '—' : `${result.returningVisitorRate.toLocaleString(numLocale)}%`}
              hint={t('analytics_returning_visitors_hint').replace('{count}', result.returningVisitors.toLocaleString(numLocale))}
            />
          </div>

          <div style={{
            display: narrow ? 'flex' : 'grid',
            flexDirection: narrow ? 'column' : undefined,
            gridTemplateColumns: narrow ? undefined : 'minmax(148px, 1fr) minmax(148px, 1fr) minmax(220px, 2fr)',
            gap: 8,
            flexShrink: 0,
          }}>
            <AnalyticsMetricCard
              label={t('analytics_one_page_visitors')}
              value={result.onePageVisitorRate == null ? '—' : `${result.onePageVisitorRate.toLocaleString(numLocale)}%`}
              hint={t('analytics_one_page_visitors_hint').replace('{count}', result.onePageVisitors.toLocaleString(numLocale))}
            />
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
            }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10 }}>{t('analytics_browsing_depth')}</div>
              <BrowsingDepthList items={result.browsingDepth} />
            </div>
            <div style={{
              padding: '8px 12px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
            }}>
              <div className="t-label" style={{ marginBottom: 6, fontSize: 10, flexShrink: 0 }}>{t('analytics_trend_views_per_day')}</div>
              <div style={{ flex: 1, minHeight: 112, overflow: 'visible', padding: '2px 4px 0' }}>
                <Sparkline trend={result.trend} />
              </div>
            </div>
          </div>
          {result.pageviews > 0 && result.uniqueVisitors === 0 && (
            <div className="t-mono-xs" style={{ color: 'var(--tx3)', padding: '0 2px', lineHeight: 1.35 }}>
              {t('analytics_visitor_coverage_note')}
            </div>
          )}

          <div style={{
            flex: '1 1 0',
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
            gap: 8,
          }}>
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10, flexShrink: 0 }}>{t('analytics_top_pages')}</div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <BarList items={result.topPages} labelKey="path" valueKey="views" maxRows={10} />
              </div>
            </div>
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10, flexShrink: 0 }}>{t('analytics_landing_pages')}</div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <BarList items={result.topLandingPages} labelKey="path" valueKey="visitors" maxRows={8} />
              </div>
            </div>
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10, flexShrink: 0 }}>{t('analytics_top_countries')}</div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <BarList items={result.topCountries} labelKey="country" valueKey="views" maxRows={10} />
              </div>
            </div>
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10, flexShrink: 0 }}>{t('analytics_top_sources')}</div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <BarList items={result.topReferrers} labelKey="referrer" valueKey="views" maxRows={10} />
              </div>
            </div>
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
              gridColumn: narrow ? undefined : '1 / -1',
            }}>
              <div className="t-label" style={{ marginBottom: 4, fontSize: 10, flexShrink: 0 }}>{t('analytics_source_quality')}</div>
              <div className="t-mono-xs" style={{ color: 'var(--tx3)', marginBottom: 8, lineHeight: 1.35 }}>
                {t('analytics_source_quality_hint')}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <SourceQualityList items={result.sourceQuality} />
              </div>
            </div>
          </div>

          <div
            className="t-mono-xs"
            style={{
              color: 'var(--tx3)',
              opacity: 0.55,
              flexShrink: 0,
              lineHeight: 1.35,
              fontSize: 10,
            }}
          >
            {t('analytics_data_footnote')}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg0)', border: '1px solid var(--bd)' }}>
      <div className="t-label" style={{ marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--tx)', fontFamily: 'var(--font-serif, serif)', letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  )
}

// ── UI sub-components ──────────────────────────────────────────────────────

function FileImportButton({ onText, lang: _lang }: { onText: (v: string) => void; lang: 'fr' | 'en' }) {
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

function DualField({ label, fr, en, onFr, onEn, rows = 1, placeholder, allowImport, rich, preview = 'flame' }: {
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
      {/* Editors side by side */}
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
      {/* FlameText previews side by side — only for rich fields */}
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

function SourceItem({ label, active, onClick, badge, badgeWarn }: {
  label: string; active: boolean; onClick: () => void
  badge?: string; badgeWarn?: boolean
}) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 12px', borderRadius: 4, border: '1px solid var(--bd)',
      background: active ? 'var(--bg2)' : 'var(--bg1)',
      cursor: active ? 'pointer' : 'default', transition: 'all 0.15s',
      display: 'flex', alignItems: 'center', gap: 8,
      opacity: active ? 1 : 0.55,
      transform: active ? 'scale(1.01)' : 'none',
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? 'var(--ac)' : 'var(--bd)', flexShrink: 0 }} />
      <span className="t-mono-xs" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{label}</span>
      {badge && (
        <span className="t-mono-xs" style={{ fontSize: 9, flexShrink: 0, color: badgeWarn ? 'var(--rust)' : 'var(--tx3)' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function PageSection({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="row between bb" style={{ paddingBottom: 14, marginBottom: 24, alignItems: 'center' }}>
        <div className="row gap-md center">
          <span style={{ fontSize: 18, color: 'var(--ac)' }}>{icon}</span>
          <h3 className="serif" style={{ fontSize: 20 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{label}</label>
      {children}
    </div>
  )
}


function CollectionRow({ item, index, total, sequenceLabel, onMove, isTarget, onAssign, onUpdate, onDelete, themeStats, privateWorks, onMakePublic }: {
  item: CollectionItem
  index: number
  total: number
  /** Website works collections: show sequence badge + intro fields for /works “intro” mode */
  sequenceLabel?: string
  onMove: (from: number, to: number) => void
  isTarget: boolean
  onAssign: () => void
  onUpdate: (p: Partial<CollectionItem>) => void
  onDelete: () => void
  themeStats?: Record<string, { total: number; pub: number }>
  privateWorks?: ThemeWork[]
  onMakePublic?: (id: number) => void
}) {
  const [dragging, setDragging] = useState(false)
  const hasTextContent = !!(htmlToPlain(item.intro_fr) || htmlToPlain(item.intro_en) || htmlToPlain(item.description_fr) || htmlToPlain(item.description_en))
  const [textExpanded, setTextExpanded] = useState(hasTextContent)
  return (
    <div
      className="panel pad-md col gap-md"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/x-collection-from', String(index))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => {
        e.preventDefault()
        const raw = e.dataTransfer.getData('text/x-collection-from')
        const from = Number(raw)
        if (Number.isFinite(from) && from !== index) onMove(from, index)
        setDragging(false)
      }}
      style={{
        border: isTarget ? '1px solid var(--ac)' : undefined,
        background: isTarget ? 'rgba(200,168,110,0.03)' : undefined,
        opacity: dragging ? 0.5 : 1,
      }}
    >
      {/* Reorder header */}
      <div className="row gap-md" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span title="Glisser pour réordonner" style={{
            cursor: 'grab', color: 'var(--tx3)', fontSize: 14, lineHeight: 1,
            padding: '2px 6px', borderRadius: 3, userSelect: 'none',
          }}>⋮⋮</span>
          {sequenceLabel && (
            <span className="t-mono-xs" style={{
              fontSize: 9, letterSpacing: 2, color: 'var(--ac)', fontWeight: 700,
              padding: '3px 8px', borderRadius: 3, border: '1px solid var(--ac)',
            }}>{sequenceLabel}</span>
          )}
          <span className="t-mono-xs" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 1 }}>
            {index + 1} / {total}
          </span>
          <button onClick={() => onMove(index, index - 1)} disabled={index === 0}
            title="Monter"
            style={moveBtnStyle(index === 0)}>↑</button>
          <button onClick={() => onMove(index, index + 1)} disabled={index === total - 1}
            title="Descendre"
            style={moveBtnStyle(index === total - 1)}>↓</button>
        </div>
        <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', fontSize: 11 }} onClick={onDelete}>
          Supprimer
        </button>
      </div>

      {/* Titles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TITRE FR</label>
          <input className="input full" value={item.title_fr} onChange={e => onUpdate({ title_fr: e.target.value })} />
        </div>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TITRE EN</label>
          <input className="input full" value={item.title_en} onChange={e => onUpdate({ title_en: e.target.value })} />
        </div>
      </div>

      {/* Theme + active toggle (always visible) */}
      <div className="row gap-md" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{'THÈME / GROUPE ASSIGNÉ'}</label>
          <div onClick={onAssign} style={{
            height: 36, border: `1px ${item.theme ? 'solid' : 'dashed'} ${isTarget ? 'var(--ac)' : 'var(--bd)'}`,
            borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer',
            background: item.theme ? 'var(--bg0)' : undefined
          }}>
            <span className="t-mono-sm" style={{ fontSize: 11, color: item.theme ? 'var(--ac)' : 'var(--tx3)' }}>
              {item.theme || (isTarget ? 'PRÊT POUR THÈME' : 'CLIQUER POUR CHOISIR')}
            </span>
          </div>
        </div>
        <label className="row gap-xs pointer center" style={{ paddingBottom: 6 }}>
          <input type="checkbox" checked={item.is_active} onChange={e => onUpdate({ is_active: e.target.checked })} />
          <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIF</span>
        </label>
      </div>

      {/* Works thumbnail strip — primary reorder interface */}
      {privateWorks && privateWorks.length > 0 && (
        <WorksReorder
          privateWorks={privateWorks}
          orderIds={item.manual_work_order ?? []}
          onReorder={ids => onUpdate({ manual_work_order: ids })}
          onMakePublic={onMakePublic}
        />
      )}

      {/* Text fields — collapsed by default when empty */}
      <button
        type="button"
        onClick={() => setTextExpanded(!textExpanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx3)', fontSize: 9, letterSpacing: 1,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 10, transition: 'transform .15s', transform: textExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>{'▸'}</span>
        {textExpanded ? 'MASQUER TEXTES' : hasTextContent ? 'TEXTES (remplis)' : 'AJOUTER INTRO / TEXTE'}
      </button>

      {textExpanded && (
        <>
          {sequenceLabel && (
            <>
              <div className="t-label" style={{ fontSize: 9, opacity: 0.75 }}>{'INTRO (optionnel)'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="t-label" style={{ fontSize: 9 }}>INTRO FR</span>
                    <FileImportButton onText={v => onUpdate({ intro_fr: v })} lang="fr" />
                  </div>
                  <RichEditor value={item.intro_fr} onChange={v => onUpdate({ intro_fr: v })} minHeight={100} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="t-label" style={{ fontSize: 9 }}>INTRO EN</span>
                    <FileImportButton onText={v => onUpdate({ intro_en: v })} lang="en" />
                  </div>
                  <RichEditor value={item.intro_en} onChange={v => onUpdate({ intro_en: v })} minHeight={100} />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="t-label" style={{ fontSize: 9 }}>{sequenceLabel ? 'TEXTE FR' : 'TEXTE FR'}</span>
                <FileImportButton onText={v => onUpdate({ description_fr: v })} lang="fr" />
              </div>
              <RichEditor value={item.description_fr} onChange={v => onUpdate({ description_fr: v })} minHeight={120} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="t-label" style={{ fontSize: 9 }}>{sequenceLabel ? 'TEXTE EN' : 'TEXTE EN'}</span>
                <FileImportButton onText={v => onUpdate({ description_en: v })} lang="en" />
              </div>
              <RichEditor value={item.description_en} onChange={v => onUpdate({ description_en: v })} minHeight={120} />
            </div>
          </div>

          {(htmlToPlain(item.description_fr) || htmlToPlain(item.description_en)) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>{'APERÇU FR'}</div>
                <FlamePreview html={item.description_fr} />
              </div>
              <div>
                <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>{'APERÇU EN'}</div>
                <FlamePreview html={item.description_en} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Shared style for arrow buttons used in collection/work reordering.
function moveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 22, height: 22, padding: 0,
    background: disabled ? 'transparent' : 'var(--bg0)',
    border: '1px solid var(--bd)', borderRadius: 3,
    color: disabled ? 'var(--bd)' : 'var(--tx2)',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11, lineHeight: 1, fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }
}

// Reorderable strip of public works for a collection.
// Shows hidden (non-public) works as warnings on the right.
function WorksReorder({ privateWorks, orderIds, onReorder, onMakePublic }: {
  privateWorks: ThemeWork[]
  orderIds: number[]
  onReorder: (ids: number[]) => void
  onMakePublic?: (id: number) => void
}) {
  const visible = privateWorks.filter(w => w.isPublic)
  const hidden  = privateWorks.filter(w => !w.isPublic)

  // Compute current order: known IDs first (in saved order, only if still public),
  // then any new public works appended at the end.
  const visibleMap = new Map(visible.map(w => [w.OeuvreID, w]))
  const seen = new Set<number>()
  const ordered: ThemeWork[] = []
  for (const id of orderIds) {
    const w = visibleMap.get(id)
    if (w && !seen.has(id)) { ordered.push(w); seen.add(id) }
  }
  for (const w of visible) if (!seen.has(w.OeuvreID)) ordered.push(w)

  const setOrder = (next: ThemeWork[]) => onReorder(next.map(w => w.OeuvreID))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length) return
    setOrder(reorder(ordered, from, to))
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {ordered.length > 0 && (
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="t-mono-xs" style={{ color: 'var(--tx3)', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>
            PUBLIQUES ({ordered.length}) — glisser ou ↑↓ pour réordonner
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ordered.map((w, i) => (
              <ReorderableThumb key={w.OeuvreID} w={w} index={i} total={ordered.length} onMove={move}
                onDropFrom={(from, to) => setOrder(reorder(ordered, from, to))} />
            ))}
          </div>
        </div>
      )}
      {hidden.length > 0 && (
        <div>
          <div className="t-mono-xs" style={{ color: 'var(--rust)', fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
            ⚠ NON-PUBLIQUES ({hidden.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hidden.map(w => (
              <div key={w.OeuvreID} style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: 64, height: 64, overflow: 'hidden', flexShrink: 0,
                  background: 'repeating-linear-gradient(45deg, var(--bg2), var(--bg2) 6px, var(--bg1) 6px, var(--bg1) 12px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--rust)', boxSizing: 'border-box', position: 'relative',
                }}>
                  {w.txtImageNameLink
                    ? <WorkThumb file={w.txtImageNameLink} size={128} alt="" />
                    : <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--tx3)', opacity: 0.4, lineHeight: 1 }}>{w.OeuvreID}</span>
                  }
                </div>
                <div className="t-mono-xs" style={{ fontSize: 9, color: 'var(--rust)', fontWeight: 700 }}>#{w.OeuvreID}</div>
                {onMakePublic && (
                  <button onClick={() => onMakePublic(w.OeuvreID)} title={`Rendre #${w.OeuvreID} public`}
                    style={{
                      width: '100%', background: 'var(--rust)', color: '#fff',
                      border: 'none', borderRadius: 2, fontSize: 8, padding: '2px 0',
                      cursor: 'pointer', letterSpacing: 0.3, fontWeight: 600,
                    }}>→ publier</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReorderableThumb({ w, index, total, onMove, onDropFrom }: {
  w: ThemeWork
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onDropFrom: (from: number, to: number) => void
}) {
  const [hover,    setHover]    = useState(false)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/x-work-from', String(index))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => {
        e.preventDefault()
        const from = Number(e.dataTransfer.getData('text/x-work-from'))
        if (Number.isFinite(from) && from !== index) onDropFrom(from, index)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 80, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        opacity: dragging ? 0.4 : 1, cursor: 'grab', position: 'relative',
      }}
    >
      <div style={{
        width: 80, height: 80, overflow: 'hidden', position: 'relative',
        background: 'var(--bg2)',
        border: '2px solid transparent', boxSizing: 'border-box',
      }}>
        {w.txtImageNameLink
          ? <WorkThumb file={w.txtImageNameLink} size={160} alt="" />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 20, fontWeight: 900, color: 'var(--tx3)', opacity: 0.4 }}>{w.OeuvreID}</div>
        }
        {/* Position badge */}
        <div className="t-mono-xs" style={{
          position: 'absolute', top: 2, left: 2,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          fontSize: 9, padding: '1px 4px', borderRadius: 2, letterSpacing: 0.5,
        }}>{index + 1}</div>
        {/* Arrow controls on hover */}
        {hover && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            display: 'flex', gap: 2,
          }}>
            <button onClick={e => { e.stopPropagation(); onMove(index, index - 1) }} disabled={index === 0}
              title="← précédent" style={{ ...moveBtnStyle(index === 0), width: 18, height: 18, fontSize: 9, background: 'rgba(255,255,255,0.9)' }}>←</button>
            <button onClick={e => { e.stopPropagation(); onMove(index, index + 1) }} disabled={index === total - 1}
              title="suivant →" style={{ ...moveBtnStyle(index === total - 1), width: 18, height: 18, fontSize: 9, background: 'rgba(255,255,255,0.9)' }}>→</button>
          </div>
        )}
      </div>
      <div className="t-mono-xs" style={{ fontSize: 9, color: 'var(--tx3)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        #{w.OeuvreID}
      </div>
    </div>
  )
}
