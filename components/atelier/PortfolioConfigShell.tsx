'use client'

import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import PdfExportDrawer from '@/components/portfolio/PdfExportDrawer'
import {
  type CollectionItem, type PortfolioTabProps,
} from '@/lib/portfolio-config-types'
import type { PdfCollectionCandidate, PdfCollectionStatement } from '@/lib/portfolio-pdf-types'
import { buildPublicPreviewUrl } from '@/lib/open-public-preview-tab'

import { SiteEditorPanel } from '@/components/atelier/site/SiteEditorPanel'
import { AnalyticsPanel } from '@/components/atelier/analytics/AnalyticsPanel'
import { PortfolioCollectionsPanel } from '@/components/atelier/portfolio/PortfolioCollectionsPanel'
import { PageSection } from '@/components/atelier/portfolio/shared/PageSection'
import { CollectionRow } from '@/components/atelier/portfolio/shared/CollectionRow'
import { SourceItem } from '@/components/atelier/portfolio/shared/SourceItem'
import { usePortfolioConfig } from '@/components/atelier/portfolio/usePortfolioConfig'

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

  const {
    config, setConfig,
    loading,
    activeMode, setActiveMode,
    activeSlot, setActiveSlot,
    saveBusy,
    pdfOpen, setPdfOpen,
    isDirty,
    savedAt,
    storageStale,
    themeNames,
    themeNameStats,
    privateWorksForThemeLabel,
    worksForCollectionItem,
    handleSave,
    savePdfProfile,
    handleTransfer,
    handleMakePublic,
    loadData,
    updateMode, addMode, deleteMode, moveMode,
    addModeCollection, moveModeCollection, updateModeCollection, deleteModeCollection,
    addItem, moveCollection,
  } = usePortfolioConfig({ oeuvres, themes, themePublicStats, themePrivateWorks })

  // ── PDF derived data ───────────────────────────────────────────────────

  const pdfCollectionItems: CollectionItem[] = activeTab === 'portfolio'
    ? config.sections
    : (config.works_modes[activeMode]?.collections ?? [])

  const initialPdfCollectionId = pdfCollectionItems[0]?.id ?? null

  const initialPdfCollections: PdfCollectionCandidate[] = pdfCollectionItems.map(c => ({
    id: c.id,
    title: lang === 'en' ? c.title_en || c.title_fr || c.id : c.title_fr || c.title_en || c.id,
    worksCount: worksForCollectionItem(c).length,
  }))

  const initialPdfWorksByCollection = Object.fromEntries(
    pdfCollectionItems.map(c => [c.id, worksForCollectionItem(c)])
  )

  const initialPdfStatementsByCollection: Record<string, Record<'fr' | 'en', PdfCollectionStatement>> =
    Object.fromEntries(pdfCollectionItems.map(c => [
      c.id,
      {
        fr: { id: c.id, title: c.title_fr || c.title_en || c.id, intro: c.intro_fr || c.intro_en || '', description: c.description_fr || c.description_en || '' },
        en: { id: c.id, title: c.title_en || c.title_fr || c.id, intro: c.intro_en || c.intro_fr || '', description: c.description_en || c.description_fr || '' },
      },
    ]))

  // ── Loading gate ───────────────────────────────────────────────────────

  if (loading) return <div className="pad-lg t-mono-sm">{t('loading')}</div>

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg0)', overflow: 'hidden' }}>

      {/* ── Action bar ── */}
      {activeTab !== 'analytics' && (
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end',
          gap: narrow ? 8 : 12,
          padding: narrow
            ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))'
            : '8px 40px',
          borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', flexShrink: 0, minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 8 : 12, flexWrap: 'wrap', justifyContent: narrow ? 'flex-end' : 'flex-start' }}>
          <a
            href="/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
            className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            title={t('portfolio_open_public_site_title')}
            onClick={(e) => { e.currentTarget.href = buildPublicPreviewUrl('/') }}
          >
            Site
          </a>
          <button type="button" onClick={() => setPdfOpen(true)} className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, minHeight: 44 }}
            title={t('portfolio_pdf_preview_tooltip')}
          >
            ↓ PDF
          </button>
          <a
            href="/works" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
            className="btn ghost sm"
            style={{ fontSize: 9, letterSpacing: 2, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            title={t('portfolio_catalog_tooltip')}
            onClick={(e) => { e.currentTarget.href = buildPublicPreviewUrl('/works') }}
          >
            /works
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <button
              type="button" className="btn primary sm"
              title={t('portfolio_save_config_tooltip')}
              onClick={handleSave} disabled={saveBusy}
              style={{ fontSize: 9, letterSpacing: 1.5, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isDirty && !saveBusy && (
                <span
                  aria-label={t('portfolio_unsaved_indicator')}
                  style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: 'currentColor', opacity: 0.9,
                    animation: 'publier-dot-blink 1.2s ease-in-out infinite', flexShrink: 0,
                  }}
                />
              )}
              <span>{saveBusy ? t('portfolio_publishing_label') : `${t('portfolio_publier_label')} →`}</span>
            </button>
            <style>{`
              @keyframes publier-dot-blink { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.25; } }
            `}</style>
            <div style={{ fontSize: 8, letterSpacing: 0.5, opacity: 0.45, whiteSpace: 'nowrap' }}>
              {savedAt
                ? `${t('portfolio_last_published')} ${savedAt.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : t('portfolio_never_published')}
            </div>
          </div>
        </div>

        {storageStale && (
          <div
            role="status"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginTop: 10, padding: '8px 12px',
              fontSize: 10, lineHeight: 1.45,
              border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--bg2)',
            }}
          >
            <span>{t('portfolio_storage_stale_banner')}</span>
            <button type="button" className="btn ghost sm" onClick={() => void loadData()}
              style={{ fontSize: 9, letterSpacing: 1, flexShrink: 0, minHeight: 36 }}
            >
              {t('portfolio_storage_stale_reload')}
            </button>
          </div>
        )}
      </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: narrow ? 'column' : 'row', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>

        {/* Theme picker — only while assigning a collection slot */}
        {activeSlot && activeTab !== 'analytics' && (
        <div
          style={{
            width: narrow ? '100%' : 280,
            maxHeight: narrow ? 'min(44vh, 320px)' : undefined,
            borderRight: narrow ? 'none' : '1px solid var(--bd)',
            borderBottom: narrow ? '1px solid var(--bd)' : 'none',
            background: 'var(--bg1)',
            display: 'flex', flexDirection: 'column', flexShrink: 0,
            minHeight: 0, order: 0, overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('portfolio_panel_sources')}</div>
            <p className="t-mono-xs" style={{ opacity: 0.4 }}>{t('portfolio_sources_hint_pick')}</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: narrow ? '12px 14px' : 16 }} className="col gap-lg">
            <div>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10 }}>{t('portfolio_themes_groups_heading')}</div>
              <div className="col gap-xs">
                {themeNames.map(name => {
                  const s = themeNameStats[name]
                  return (
                    <SourceItem key={name} label={name} active
                      onClick={() => handleTransfer(name)}
                      badge={s ? `${s.pub}/${s.total}` : undefined}
                      badgeWarn={s ? s.pub < s.total : false} />
                  )
                })}
              </div>
            </div>
          </div>
          <div style={{ padding: 16, paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'var(--ac)', color: 'white', textAlign: 'center' }}>
            <p className="t-mono-sm" style={{ fontWeight: 600, marginBottom: 8 }}>{t('portfolio_slot_click_target')}</p>
            <button type="button" className="btn sm ghost"
              style={{ color: 'white', borderColor: 'white', minHeight: 44 }}
              onClick={() => setActiveSlot(null)}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
        )}

        {/* Main content */}
        <div
          style={{
            flex: 1, minHeight: 0, minWidth: 0,
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
              display: 'flex', flexDirection: 'column',
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
                    action={<button className="btn sm ghost" onClick={() => addItem('sections')}>{t('portfolio_add_section_btn')}</button>}
                  >
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
                          onMakePublic={handleMakePublic}
                        />
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
                <AnalyticsPanel themes={themes} oeuvres={oeuvres} themePublicStats={themePublicStats} />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .full { width: 100%; }
        :global(.portfolio-site-public) .site-pub-grid-2 {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        }
        :global(.portfolio-site-public) .site-pub-grid-mode {
          display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 12px; align-items: end;
        }
        @media (max-width: 767px) {
          :global(.portfolio-site-public) .site-pub-grid-2 { grid-template-columns: 1fr; }
          :global(.portfolio-site-public) .site-pub-grid-mode { grid-template-columns: 1fr; }
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
