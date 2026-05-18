'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  savePortfolioConfig,
  loadPortfolioConfig,
  setWorkPublic,
} from '@/app/atelier/portfolio/actions'
import { PORTFOLIO_SAVE_ERR } from '@/lib/portfolio-save-errors'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import PdfExportDrawer from '@/components/portfolio/PdfExportDrawer'
import {
  type PortfolioConfig, type CollectionItem, type WorksMode, type ThemeWork,
  type PortfolioTabProps,
  DEFAULT_CONFIG, migrate, reorder,
} from '@/lib/portfolio-config-types'

import { SiteEditorPanel } from '@/components/atelier/site/SiteEditorPanel'
import { AnalyticsPanel } from '@/components/atelier/analytics/AnalyticsPanel'
import { PortfolioCollectionsPanel } from '@/components/atelier/portfolio/PortfolioCollectionsPanel'
import { PageSection } from '@/components/atelier/portfolio/shared/PageSection'
import { CollectionRow } from '@/components/atelier/portfolio/shared/CollectionRow'
import { SourceItem } from '@/components/atelier/portfolio/shared/SourceItem'

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

  const themeNamePrivateWorksMap = useMemo(() => {
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

  // ── Data loading ──

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

  // ── Handlers ──

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

        {/* Left sidebar — sources */}
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
                config={config} setConfig={setConfig}
                activeMode={activeMode} setActiveMode={setActiveMode}
                activeSlot={activeSlot} setActiveSlot={setActiveSlot}
                themeNameStats={themeNameStats}
                themeNamePrivateWorks={themeNamePrivateWorksMap}
                onMakePublic={handleMakePublic}
                addMode={addMode} deleteMode={deleteMode} moveMode={moveMode} updateMode={updateMode}
                addModeCollection={addModeCollection} moveModeCollection={moveModeCollection}
                updateModeCollection={updateModeCollection} deleteModeCollection={deleteModeCollection}
              />
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
                        privateWorks={item.theme ? themeNamePrivateWorksMap[item.theme] : undefined}
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
