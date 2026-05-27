'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  savePortfolioConfig,
  loadPortfolioConfig,
  getPortfolioConfigEtag,
  setWorkPublic,
} from '@/app/atelier/(portal)/portfolio/actions'
import { PORTFOLIO_SAVE_ERR } from '@/lib/portfolio-save-errors'
import {
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  LANDING_HERO_BEVEL_PX_DEFAULT,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_CAST_SHADOW_BLUR_DEFAULT,
  WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
} from '@/lib/works-mode-light'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import PdfExportDrawer from '@/components/portfolio/PdfExportDrawer'
import {
  type PortfolioConfig, type CollectionItem, type WorksMode, type ThemeWork,
  type PortfolioTabProps,
  DEFAULT_CONFIG, migrate, reorder,
} from '@/lib/portfolio-config-types'
import type { PdfCollectionCandidate, PdfCollectionStatement, PdfFormat, PdfProfileSettings, PdfPurpose, PdfWorkCandidate } from '@/lib/portfolio-pdf-types'

import { SiteEditorPanel } from '@/components/atelier/site/SiteEditorPanel'
import { AnalyticsPanel } from '@/components/atelier/analytics/AnalyticsPanel'
import { PortfolioCollectionsPanel } from '@/components/atelier/portfolio/PortfolioCollectionsPanel'
import { PageSection } from '@/components/atelier/portfolio/shared/PageSection'
import { CollectionRow } from '@/components/atelier/portfolio/shared/CollectionRow'
import { SourceItem } from '@/components/atelier/portfolio/shared/SourceItem'
import { buildPublicPreviewUrl } from '@/lib/open-public-preview-tab'
import {
  canonicalCollectionTheme,
  normalizeTheme,
  themeWorksForCollectionLabel,
} from '@/components/public/works-utils'

// ── Component ─────────────────────────────────────────────────────────────

export function PortfolioConfigShell({
  tab: activeTab,
  oeuvres,
  themes,
  themePublicStats = {},
  themePrivateWorks = {},
  oeuvresCatalogueTotal,
}: PortfolioTabProps & { tab: 'site' | 'portfolio' | 'analytics' }) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const router = useRouter()
  const [config,     setConfig]     = useState<PortfolioConfig>(DEFAULT_CONFIG)
  const [loading,    setLoading]    = useState(true)
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
  const [storageStale, setStorageStale] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await loadPortfolioConfig()
    if ('ok' in result) {
      setConfig(migrate(result.config))
      setPortfolioEtag(result.etag)
      setStorageStale(false)
    }
    setLoading(false)
  }, [])

  const handlePortfolioEtagConflict = useCallback(async () => {
    if (window.confirm(t('portfolio_save_etag_conflict_confirm'))) {
      await loadData()
      alert(t('portfolio_save_etag_reloaded'))
    } else {
      alert(t('portfolio_save_etag_conflict'))
    }
  }, [loadData, t])

  const savePdfProfile = useCallback(async (purpose: PdfPurpose, format: PdfFormat, settings: PdfProfileSettings) => {
    const next: PortfolioConfig = {
      ...config,
      pdf_profiles: {
        ...(config.pdf_profiles ?? {}),
        [purpose]: {
          ...(config.pdf_profiles?.[purpose] ?? {}),
          [format]: settings,
        },
      },
    }
    setConfig(next)
    setSaveBusy(true)
    const result = await savePortfolioConfig(next, { ifMatch: portfolioEtag })
    setSaveBusy(false)
    if ('ok' in result) {
      setPortfolioEtag(result.etag)
      setStorageStale(false)
      alert(t('portfolio_config_saved'))
    } else if (result.error === PORTFOLIO_SAVE_ERR.ETAG_MISMATCH) {
      await handlePortfolioEtagConflict()
    } else if (result.error === PORTFOLIO_SAVE_ERR.OBJECT_EXISTS) {
      alert(t('portfolio_save_object_exists'))
    } else {
      alert(`${t('error_prefix')} ${result.error}`)
    }
  }, [config, portfolioEtag, t, handlePortfolioEtagConflict])

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

  const privateWorksForThemeLabel = useCallback(
    (label: string | null | undefined): ThemeWork[] | undefined => {
      const ws = themeWorksForCollectionLabel(label, themes, themePrivateWorks, oeuvreThemeLite)
      return ws.length > 0 ? ws : undefined
    },
    [themes, themePrivateWorks, oeuvreThemeLite],
  )

  const workById = useMemo(() => new Map(oeuvres.map(o => [o.OeuvreID, o])), [oeuvres])

  const worksForCollectionItem = useCallback((item: CollectionItem): PdfWorkCandidate[] => {
    const manualIds = Array.isArray(item.manual_work_order)
      ? item.manual_work_order.map(Number).filter(Number.isFinite)
      : []
    const visible = item.theme
      ? themeWorksForCollectionLabel(item.theme, themes, themePrivateWorks, oeuvreThemeLite).filter(w => w.isPublic)
      : []
    const seen = new Set<number>()
    const orderedIds: number[] = []
    const themeWorkIds = new Set(visible.map(w => w.OeuvreID))
    for (const id of manualIds) {
      if (!themeWorkIds.has(id)) continue
      const work = workById.get(id)
      const isPublic = !!(work as { is_public?: boolean } | undefined)?.is_public
      if (work?.txtImageNameLink && isPublic && !seen.has(id)) {
        seen.add(id)
        orderedIds.push(id)
      }
    }
    for (const w of visible) {
      if (!seen.has(w.OeuvreID)) {
        seen.add(w.OeuvreID)
        orderedIds.push(w.OeuvreID)
      }
    }
    return orderedIds.flatMap(id => {
      const work = workById.get(id)
      if (!work?.txtImageNameLink) return []
      return [{
        OeuvreID: work.OeuvreID,
        Titre: work.Titre,
        Annee: work.Année,
        Hauteur: work.Hauteur,
        Largeur: work.Largeur,
        txtImageNameLink: work.txtImageNameLink,
      }]
    })
  }, [themes, themePrivateWorks, oeuvreThemeLite, workById])

  const pdfCollectionItems = activeTab === 'portfolio'
    ? config.sections
    : (config.works_modes[activeMode]?.collections ?? [])
  const initialPdfCollectionId = pdfCollectionItems[0]?.id ?? null
  const initialPdfCollections: PdfCollectionCandidate[] = pdfCollectionItems
    .map(collection => ({
      id: collection.id,
      title: lang === 'en'
        ? collection.title_en || collection.title_fr || collection.id
        : collection.title_fr || collection.title_en || collection.id,
      worksCount: worksForCollectionItem(collection).length,
    }))
  const initialPdfWorksByCollection = Object.fromEntries(
    pdfCollectionItems
      .map(collection => [collection.id, worksForCollectionItem(collection)])
  )
  const initialPdfStatementsByCollection: Record<string, Record<'fr' | 'en', PdfCollectionStatement>> = Object.fromEntries(
    pdfCollectionItems
      .map(collection => [
        collection.id,
        {
          fr: {
            id: collection.id,
            title: collection.title_fr || collection.title_en || collection.id,
            intro: collection.intro_fr || collection.intro_en || '',
            description: collection.description_fr || collection.description_en || '',
          },
          en: {
            id: collection.id,
            title: collection.title_en || collection.title_fr || collection.id,
            intro: collection.intro_en || collection.intro_fr || '',
            description: collection.description_en || collection.description_fr || '',
          },
        },
      ])
  )

  // ── Data loading ──

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || loading) return
      const result = await getPortfolioConfigEtag()
      if ('ok' in result && result.etag !== portfolioEtag) {
        setStorageStale(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loading, portfolioEtag])

  // ── Handlers ──

  const handleSave = async () => {
    setSaveBusy(true)
    const result = await savePortfolioConfig(config, { ifMatch: portfolioEtag })
    setSaveBusy(false)
    if ('ok' in result) {
      setPortfolioEtag(result.etag)
      setStorageStale(false)
      alert(t('portfolio_config_saved'))
    } else if (result.error === PORTFOLIO_SAVE_ERR.ETAG_MISMATCH) {
      await handlePortfolioEtagConflict()
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
      const prev = next.sections[index]
      const canonical =
        canonicalCollectionTheme(
          { theme: value, title_fr: prev.title_fr, title_en: prev.title_en },
          themes,
        ) ?? value
      next.sections[index] = {
        ...prev,
        theme: canonical,
        ...(normalizeTheme(prev.theme) !== normalizeTheme(canonical)
          ? { manual_work_order: [] }
          : {}),
      }
    } else {
      const m = modeIdx ?? activeMode
      const modes = next.works_modes.slice()
      const cols = modes[m].collections.slice()
      const prev = cols[index]
      const canonical =
        canonicalCollectionTheme(
          { theme: value, title_fr: prev.title_fr, title_en: prev.title_en },
          themes,
        ) ?? value
      cols[index] = {
        ...prev,
        theme: canonical,
        ...(normalizeTheme(prev.theme) !== normalizeTheme(canonical)
          ? { manual_work_order: [] }
          : {}),
      }
      modes[m] = { ...modes[m], collections: cols }
      next.works_modes = modes
    }
    setConfig(next)
    setActiveSlot(null)
  }

  const handleMakePublic = async (oeuvreId: number) => {
    const res = await setWorkPublic(oeuvreId)
    if ('error' in res) {
      alert(`${t('error_prefix')} ${res.error}`)
      return
    }
    router.refresh()
  }

  // ── Mode helpers ──

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
      layout: 'carousel',
      collections: [],
      outro_fr: '', outro_en: '',
      bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
      bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
      light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
      light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
      light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
      light_circadian: false,
      cast_shadow_enabled: true,
      cast_shadow_distance_px: WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
      cast_shadow_blur_px: WORKS_CAST_SHADOW_BLUR_DEFAULT,
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

  // ── Collection helpers (portfolio sections) ──

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

      {/* ── Action bar ── */}
      {activeTab !== 'analytics' && (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: narrow ? 8 : 12,
          padding: narrow
            ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))'
            : '8px 40px',
          borderBottom: '1px solid var(--bd)',
          background: 'var(--bg1)',
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 8 : 12, flexWrap: 'wrap', justifyContent: narrow ? 'flex-end' : 'flex-start' }}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            title={t('portfolio_open_public_site_title')}
            onClick={(e) => { e.currentTarget.href = buildPublicPreviewUrl('/') }}
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
            referrerPolicy="no-referrer"
            className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            title={t('portfolio_catalog_tooltip')}
            onClick={(e) => { e.currentTarget.href = buildPublicPreviewUrl('/works') }}
          >
            /works
          </a>
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
        </div>
        {storageStale ? (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 10,
              padding: '8px 12px',
              fontSize: 10,
              lineHeight: 1.45,
              border: '1px solid var(--bd)',
              borderRadius: 4,
              background: 'var(--bg2)',
            }}
          >
            <span>{t('portfolio_storage_stale_banner')}</span>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => void loadData()}
              style={{ fontSize: 9, letterSpacing: 1, flexShrink: 0, minHeight: 36 }}
            >
              {t('portfolio_storage_stale_reload')}
            </button>
          </div>
        ) : null}
      </div>
      )}

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

        {/* Theme picker — only while assigning a collection slot */}
        {activeSlot && activeTab !== 'analytics' ? (
        <div
          style={{
            width: narrow ? '100%' : 280,
            maxHeight: narrow ? 'min(44vh, 320px)' : undefined,
            borderRight: narrow ? 'none' : '1px solid var(--bd)',
            borderBottom: narrow ? '1px solid var(--bd)' : 'none',
            background: 'var(--bg1)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            minHeight: 0,
            order: narrow ? 0 : 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('portfolio_panel_sources')}</div>
            <p className="t-mono-xs" style={{ opacity: 0.4 }}>
              {t('portfolio_sources_hint_pick')}
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
                      active
                      onClick={() => handleTransfer(name)}
                      badge={s ? `${s.pub}/${s.total}` : undefined}
                      badgeWarn={hasPrivate} />
                  )
                })}
              </div>
            </div>
          </div>
          <div style={{ padding: 16, paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'var(--ac)', color: 'white', textAlign: 'center' }}>
            <p className="t-mono-sm" style={{ fontWeight: 600, marginBottom: 8 }}>{t('portfolio_slot_click_target')}</p>
            <button type="button" className="btn sm ghost" style={{ color: 'white', borderColor: 'white', minHeight: 44 }} onClick={() => setActiveSlot(null)}>{t('cancel')}</button>
          </div>
        </div>
        ) : null}

        {/* Main content */}
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
            className={activeTab === 'site' ? 'portfolio-site-public' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: activeTab === 'analytics' ? 0 : activeTab === 'site' ? 32 : 48,
              flex: activeTab === 'analytics' ? 1 : undefined,
              minHeight: activeTab === 'analytics' ? 0 : undefined,
            }}
          >

            {activeTab === 'site' && (
              <SiteEditorPanel
                oeuvres={oeuvres}
                config={config} setConfig={setConfig}
                activeMode={activeMode} setActiveMode={setActiveMode}
                activeSlot={activeSlot} setActiveSlot={setActiveSlot}
                themeNameStats={themeNameStats}
                privateWorksForThemeLabel={privateWorksForThemeLabel}
                onMakePublic={handleMakePublic}
                addMode={addMode} deleteMode={deleteMode} moveMode={moveMode} updateMode={updateMode}
                addModeCollection={addModeCollection} moveModeCollection={moveModeCollection}
                updateModeCollection={updateModeCollection} deleteModeCollection={deleteModeCollection}
              />
            )}

            {activeTab === 'portfolio' && (
              <>
                <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 24, maxWidth: 720, lineHeight: 1.5 }}>
                  {t('portfolio_tab_intro')}
                </p>
                <PortfolioCollectionsPanel>
                <PageSection title={t('portfolio_sections_title')} icon="◪"
                  action={<button className="btn sm ghost" onClick={() => addItem('sections')}>{t('portfolio_add_section_btn')}</button>}>
                  <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 20 }}>
                    {t('portfolio_sections_data_hint')}
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
                        privateWorks={item.theme ? privateWorksForThemeLabel(item.theme) : undefined}
                        onMakePublic={handleMakePublic} />
                    ))}
                    {config.sections.length === 0 && (
                      <div className="t-mono-xs" style={{ opacity: 0.3, padding: '24px 0' }}>{t('portfolio_sections_empty')}</div>
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

      <PdfExportDrawer
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        initialCollectionId={initialPdfCollectionId}
        initialCollections={initialPdfCollections}
        initialWorksByCollection={initialPdfWorksByCollection}
        initialStatementsByCollection={initialPdfStatementsByCollection}
        pdfProfiles={config.pdf_profiles}
        onSaveProfile={savePdfProfile}
      />
    </div>
  )
}
