'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type {
  PortfolioConfig,
  CollectionItem,
  WorksMode,
  ThemeWork,
  SiteBlockKind,
  SiteBlock,
} from '@/lib/portfolio-config-types'
import {
  pageBackgroundFromLanding,
  type PageBackgroundConfig,
} from '@/lib/page-background'
import { PageBackgroundEditor } from '@/components/atelier/site/PageBackgroundEditor'
import { isHttpsHeroUrl, reorder } from '@/lib/portfolio-config-types'
import {
  applyLandingBlendTransition,
  normalizeHexColor,
  resolveLandingBackground,
  LANDING_BG_BOTTOM_DEFAULT,
  LANDING_BG_TOP_DEFAULT,
  LANDING_GRADIENT_STOP_MAX,
  LANDING_GRADIENT_STOP_MIN,
  type LandingGradientStop,
} from '@/lib/landing-background'
import {
  LANDING_HERO_GLOSS_BLEND_VALUES,
  resolveHeroGloss,
  type LandingHeroGlossBlend,
} from '@/lib/landing-hero-gloss'
import type { MessageKey } from '@/lib/i18n/messages'
import { SitePublicSection } from '@/components/atelier/portfolio/shared/SitePublicSection'
import { Slot } from '@/components/atelier/portfolio/shared/Slot'
import { DualField } from '@/components/atelier/portfolio/shared/DualField'
import { CollectionRow } from '@/components/atelier/portfolio/shared/CollectionRow'
import { moveBtnStyle } from '@/components/atelier/portfolio/shared/moveBtnStyle'

interface SiteEditorProps {
  config: PortfolioConfig
  setConfig: (c: PortfolioConfig) => void
  activeMode: number
  setActiveMode: (i: number) => void
  activeSlot: { type: 'theme'; page: 'works' | 'sections'; index: number; modeIdx?: number } | null
  setActiveSlot: (s: SiteEditorProps['activeSlot']) => void
  themeNameStats: Record<string, { total: number; pub: number }>
  themeNamePrivateWorks: Record<string, ThemeWork[]>
  onMakePublic: (id: number) => void
  addMode: () => void
  deleteMode: (i: number) => void
  moveMode: (from: number, to: number) => void
  updateMode: (i: number, patch: Partial<WorksMode>) => void
  addModeCollection: (m: number) => void
  moveModeCollection: (m: number, from: number, to: number) => void
  updateModeCollection: (m: number, i: number, patch: Partial<CollectionItem>) => void
  deleteModeCollection: (m: number, id: string) => void
}

const BLOCK_ICONS: Record<SiteBlockKind, string> = {
  hero: '◎',
  identity: '◈',
  about: '✎',
  practice: '◉',
  works_modes: '▤',
}

const BLOCK_LABEL_KEYS: Record<SiteBlockKind, string> = {
  hero: 'site_block_hero',
  identity: 'site_block_identity',
  about: 'site_block_about',
  practice: 'site_block_practice',
  works_modes: 'site_block_works_modes',
}

const HERO_GLOSS_BLEND_MSG: Record<LandingHeroGlossBlend, MessageKey> = {
  off: 'site_hero_gloss_blend_off',
  'color-dodge': 'site_hero_gloss_blend_color_dodge',
  'soft-light': 'site_hero_gloss_blend_soft_light',
  overlay: 'site_hero_gloss_blend_overlay',
  multiply: 'site_hero_gloss_blend_multiply',
  screen: 'site_hero_gloss_blend_screen',
}

export function SiteEditorPanel({
  config, setConfig,
  activeMode, setActiveMode,
  activeSlot, setActiveSlot,
  themeNameStats, themeNamePrivateWorks,
  onMakePublic,
  addMode, deleteMode, moveMode, updateMode,
  addModeCollection, moveModeCollection, updateModeCollection, deleteModeCollection,
}: SiteEditorProps) {
  const { t } = useI18n()
  const blocks = config.site_blocks
  const [collapsed, setCollapsed] = useState<Set<SiteBlockKind>>(new Set())
  const [bgGradientOpen, setBgGradientOpen] = useState(false)

  function setLandingGradientStops(stops: LandingGradientStop[]) {
    setConfig({
      ...config,
      landing: { ...config.landing, bg_gradient_stops: stops },
    })
  }

  function updateGradientStop(index: number, patch: Partial<LandingGradientStop>) {
    setLandingGradientStops(
      config.landing.bg_gradient_stops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    )
  }

  function addGradientStop() {
    const stops = [...config.landing.bg_gradient_stops]
    if (stops.length >= LANDING_GRADIENT_STOP_MAX) return
    const sorted = [...stops].sort((a, b) => a.position_pct - b.position_pct)
    let insertAt = 50
    let maxGap = 0
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].position_pct - sorted[i].position_pct
      if (gap > maxGap) {
        maxGap = gap
        insertAt = Math.round((sorted[i].position_pct + sorted[i + 1].position_pct) / 2)
      }
    }
    stops.push({ color: sorted[sorted.length - 1].color, position_pct: insertAt })
    setLandingGradientStops(stops)
  }

  function removeGradientStop(index: number) {
    if (config.landing.bg_gradient_stops.length <= LANDING_GRADIENT_STOP_MIN) return
    setLandingGradientStops(config.landing.bg_gradient_stops.filter((_, i) => i !== index))
  }

  function applyBlendTransition(positionPct: number, softnessPct: number) {
    setConfig({
      ...config,
      landing: {
        ...config.landing,
        bg_blend_position_pct: positionPct,
        bg_blend_softness_pct: softnessPct,
        bg_gradient_stops: applyLandingBlendTransition(
          config.landing.bg_gradient_stops,
          positionPct,
          softnessPct,
        ),
      },
    })
  }

  function moveBlock(from: number, to: number) {
    setConfig({ ...config, site_blocks: reorder(blocks, from, to) })
  }

  function toggleVisible(idx: number) {
    const next = blocks.map((b, i) => i === idx ? { ...b, visible: !b.visible } : b)
    setConfig({ ...config, site_blocks: next })
  }

  function findBlock(kind: SiteBlockKind): SiteBlock {
    return blocks.find(b => b.kind === kind) ?? { kind, visible: true }
  }

  function blockBgFields(kind: SiteBlockKind): PageBackgroundConfig {
    return findBlock(kind).page_bg ?? pageBackgroundFromLanding(config.landing)
  }

  function setBlockPageBg(kind: SiteBlockKind, next: PageBackgroundConfig) {
    setConfig({
      ...config,
      site_blocks: blocks.map(b => (b.kind === kind ? { ...b, page_bg: next } : b)),
    })
  }

  function clearBlockPageBg(kind: SiteBlockKind) {
    setConfig({
      ...config,
      site_blocks: blocks.map(b => {
        if (b.kind !== kind) return b
        const { page_bg: _removed, ...rest } = b
        return rest
      }),
    })
  }

  function setWorksNavTransparent(transparent: boolean) {
    setConfig({
      ...config,
      site_blocks: blocks.map(b =>
        b.kind === 'works_modes'
          ? { ...b, nav_bar_style: transparent ? 'transparent' : 'bar' }
          : b,
      ),
    })
  }

  function toggleCollapsed(kind: SiteBlockKind) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function renderBlockContent(kind: SiteBlockKind) {
    const heroGloss = resolveHeroGloss(config.landing)
    switch (kind) {
      case 'hero':
        return (
          <>
            <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>{t('atelier_pub_landing_behavior_help')}</p>
            <label className="t-label" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, fontSize: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.landing.enquiry_portfolio_pdf}
                onChange={e => setConfig({
                  ...config,
                  landing: { ...config.landing, enquiry_portfolio_pdf: e.target.checked },
                })}
                style={{ marginTop: 2 }}
              />
              <span>
                <span style={{ display: 'block', marginBottom: 4 }}>{t('site_enquiry_portfolio_pdf_label')}</span>
                <span className="t-mono-xs" style={{ opacity: 0.55, lineHeight: 1.5 }}>{t('site_enquiry_portfolio_pdf_help')}</span>
              </span>
            </label>
            <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>{t('atelier_pub_hero_url_help')}</p>
            <p className="t-mono-xs" style={{ opacity: 0.4, marginBottom: 8, fontSize: 9 }}>{t('atelier_pub_hero_r2_followup')}</p>
            <p className="t-mono-xs" style={{ opacity: 0.45, marginBottom: 16, fontSize: 9 }}>{t('atelier_pub_hero_url_full_res_hint')}</p>
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
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginTop: 16,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={config.landing.hero_white_key}
                onChange={e => setConfig({
                  ...config,
                  landing: { ...config.landing, hero_white_key: e.target.checked },
                })}
              />
              <span>
                <span style={{ display: 'block', marginBottom: 4 }}>{t('site_hero_white_key_label')}</span>
                <span className="t-mono-xs" style={{ opacity: 0.55, lineHeight: 1.5 }}>{t('site_hero_white_key_help')}</span>
              </span>
            </label>
            {isHttpsHeroUrl(config.landing.hero_image_url) && (
              <div style={{ marginTop: 16 }}>
                <div className="t-label" style={{ marginBottom: 4, fontSize: 9 }}>{t('atelier_pub_hero_preview_label')}</div>
                <p className="t-mono-xs" style={{ opacity: 0.45, marginBottom: 12, fontSize: 9, wordBreak: 'break-all' }}>
                  {config.landing.hero_image_url.trim().replace(/^https?:\/\/[^/]+/, '')}
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', marginBottom: 6 }}>CERCLE</div>
                    <div
                      style={{
                        position: 'relative',
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid var(--bd)',
                      }}
                    >
                      {config.landing.hero_white_key ? (
                        <div
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: resolveLandingBackground(config.landing).backgroundCss,
                          }}
                        />
                      ) : null}
                      <img
                        src={config.landing.hero_image_url.trim()}
                        alt=""
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          ...(config.landing.hero_white_key
                            ? { mixBlendMode: 'darken' as const }
                            : {}),
                        }}
                      />
                      {heroGloss.enabled ? (
                        <div
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            pointerEvents: 'none',
                            background: heroGloss.background,
                            mixBlendMode: heroGloss.mixBlendMode,
                          }}
                        />
                      ) : null}
                    </div>
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
            <div style={{ marginTop: 24 }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{t('site_hero_gloss_label')}</div>
              <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>
                {t('site_hero_gloss_help')}
              </p>
              <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 12 }}>
                {t('site_hero_gloss_blend_label')}
                <select
                  className="input full"
                  value={config.landing.hero_gloss_blend}
                  onChange={e => setConfig({
                    ...config,
                    landing: {
                      ...config.landing,
                      hero_gloss_blend: e.target.value as LandingHeroGlossBlend,
                    },
                  })}
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                >
                  {LANDING_HERO_GLOSS_BLEND_VALUES.map(mode => (
                    <option key={mode} value={mode}>{t(HERO_GLOSS_BLEND_MSG[mode])}</option>
                  ))}
                </select>
              </label>
              <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 6 }}>
                {t('site_hero_gloss_strength_label')}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.landing.hero_gloss_strength_pct}
                  onChange={e => setConfig({
                    ...config,
                    landing: {
                      ...config.landing,
                      hero_gloss_strength_pct: Number(e.target.value),
                    },
                  })}
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                />
              </label>
              <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 6 }}>
                {t('site_hero_gloss_position_label')}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.landing.hero_gloss_position_pct}
                  disabled={config.landing.hero_gloss_blend === 'off' || config.landing.hero_gloss_strength_pct <= 0}
                  onChange={e => setConfig({
                    ...config,
                    landing: {
                      ...config.landing,
                      hero_gloss_position_pct: Number(e.target.value),
                    },
                  })}
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                />
              </label>
              <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 12 }}>
                {t('site_hero_gloss_falloff_label')}
                <input
                  type="range"
                  min={28}
                  max={85}
                  value={config.landing.hero_gloss_falloff_pct}
                  disabled={config.landing.hero_gloss_blend === 'off' || config.landing.hero_gloss_strength_pct <= 0}
                  onChange={e => setConfig({
                    ...config,
                    landing: {
                      ...config.landing,
                      hero_gloss_falloff_pct: Number(e.target.value),
                    },
                  })}
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                />
              </label>
            </div>
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className="t-label"
                onClick={() => setBgGradientOpen(open => !open)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginBottom: 8,
                  fontSize: 9,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span>{t('site_landing_bg_label')}</span>
                <span style={{ opacity: 0.55, fontSize: 8 }}>
                  {bgGradientOpen ? t('site_landing_bg_toggle_hide') : t('site_landing_bg_toggle_show')}
                </span>
              </button>
              <div
                aria-hidden
                style={{
                  height: 12,
                  borderRadius: 4,
                  border: '1px solid var(--bd)',
                  marginBottom: bgGradientOpen ? 12 : 0,
                  background: resolveLandingBackground(config.landing).backgroundCss,
                }}
              />
              {bgGradientOpen ? (
                <>
                  <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 10, lineHeight: 1.5 }}>
                    {t('site_landing_bg_blend_transition_hint')}
                  </p>
                  <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 6 }}>
                    {t('site_landing_bg_blend_position_label')}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.landing.bg_blend_position_pct}
                      onChange={e => applyBlendTransition(Number(e.target.value), config.landing.bg_blend_softness_pct)}
                      style={{ display: 'block', width: '100%', marginTop: 6 }}
                    />
                  </label>
                  <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 12 }}>
                    {t('site_landing_bg_blend_hardness_label')}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.landing.bg_blend_softness_pct}
                      onChange={e => applyBlendTransition(config.landing.bg_blend_position_pct, Number(e.target.value))}
                      style={{ display: 'block', width: '100%', marginTop: 6 }}
                    />
                  </label>
                  {config.landing.bg_gradient_stops.map((stop, index) => (
                    <div
                      key={`grad-stop-${index}`}
                      style={{
                        marginBottom: 12,
                        padding: 10,
                        border: '1px solid var(--bd)',
                        borderRadius: 4,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <span className="t-label" style={{ fontSize: 9 }}>
                          {t('site_landing_bg_stop_heading').replace('{n}', String(index + 1))}
                        </span>
                        <button
                          type="button"
                          className="t-mono-xs"
                          disabled={config.landing.bg_gradient_stops.length <= LANDING_GRADIENT_STOP_MIN}
                          onClick={() => removeGradientStop(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: config.landing.bg_gradient_stops.length <= LANDING_GRADIENT_STOP_MIN ? 0.35 : 0.7,
                          }}
                        >
                          {t('site_landing_bg_remove_stop')}
                        </button>
                      </div>
                      <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 8 }}>
                        {t('site_landing_bg_stop_color_label')}
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                          <input
                            type="color"
                            value={normalizeHexColor(stop.color) ?? LANDING_BG_TOP_DEFAULT}
                            onChange={e => updateGradientStop(index, { color: e.target.value })}
                            aria-label={t('site_landing_bg_stop_color_label')}
                            style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--bd)', cursor: 'pointer' }}
                          />
                          <input
                            className="input full"
                            value={stop.color}
                            onChange={e => updateGradientStop(index, { color: e.target.value })}
                            style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }}
                          />
                        </div>
                      </label>
                      <label className="t-label" style={{ display: 'block', fontSize: 9 }}>
                        {t('site_landing_bg_stop_position_label')}
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={stop.position_pct}
                          onChange={e => updateGradientStop(index, { position_pct: Number(e.target.value) })}
                          style={{ display: 'block', width: '100%', marginTop: 6 }}
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="t-mono-xs"
                    disabled={config.landing.bg_gradient_stops.length >= LANDING_GRADIENT_STOP_MAX}
                    onClick={addGradientStop}
                    style={{
                      marginBottom: 12,
                      background: 'none',
                      border: '1px dashed var(--bd)',
                      borderRadius: 4,
                      padding: '8px 12px',
                      width: '100%',
                      cursor: 'pointer',
                      opacity: config.landing.bg_gradient_stops.length >= LANDING_GRADIENT_STOP_MAX ? 0.4 : 1,
                    }}
                  >
                    {t('site_landing_bg_add_stop')}
                  </button>
                  <div className="t-label" style={{ marginBottom: 6, fontSize: 9 }}>{t('site_landing_bg_preview_label')}</div>
                  <div
                    aria-hidden
                    style={{
                      height: 48,
                      borderRadius: 4,
                      border: '1px solid var(--bd)',
                      background: resolveLandingBackground(config.landing).backgroundCss,
                    }}
                  />
                </>
              ) : null}
            </div>
            <div style={{ marginTop: 24 }}>
              <DualField
                label={t('site_hero_caption_label')}
                fr={config.landing.hero_caption_fr}
                en={config.landing.hero_caption_en}
                onFr={v => setConfig({
                  ...config,
                  landing: { ...config.landing, hero_caption_fr: v },
                })}
                onEn={v => setConfig({
                  ...config,
                  landing: { ...config.landing, hero_caption_en: v },
                })}
              />
            </div>
          </>
        )

      case 'identity':
        return (
          <>
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
              {/* eslint-disable pem-i18n/no-hardcoded-jsx-text */}
              <Slot label="Téléphone">
                <input className="input full" value={config.general.phone}
                  onChange={e => setConfig({ ...config, general: { ...config.general, phone: e.target.value } })} />
              </Slot>
              {/* eslint-enable pem-i18n/no-hardcoded-jsx-text */}
            </div>
            <DualField label="Accroche médiums"
              fr={config.general.media_tagline_fr} en={config.general.media_tagline_en}
              onFr={v => setConfig({ ...config, general: { ...config.general, media_tagline_fr: v } })}
              onEn={v => setConfig({ ...config, general: { ...config.general, media_tagline_en: v } })}
              placeholder={{ fr: 'Peinture · Dessin · Sculpture', en: 'Painting · Drawing · Sculpture' }} />
          </>
        )

      case 'about':
        return (
          <>
            <PageBackgroundEditor
              labelKey="site_block_page_bg_about"
              inheritHintKey="site_block_page_bg_inherit_hint"
              value={blockBgFields('about')}
              onChange={next => setBlockPageBg('about', next)}
              showReset={Boolean(findBlock('about').page_bg)}
              onResetToLanding={() => clearBlockPageBg('about')}
            />
            <DualField label="Texte d'introduction" rich allowImport preview="prose"
              fr={config.about.intro_fr} en={config.about.intro_en}
              onFr={v => setConfig({ ...config, about: { ...config.about, intro_fr: v } })}
              onEn={v => setConfig({ ...config, about: { ...config.about, intro_en: v } })} />
          </>
        )

      case 'practice':
        return (
          <>
            <PageBackgroundEditor
              labelKey="site_block_page_bg_practice"
              inheritHintKey="site_block_page_bg_inherit_hint"
              value={blockBgFields('practice')}
              onChange={next => setBlockPageBg('practice', next)}
              showReset={Boolean(findBlock('practice').page_bg)}
              onResetToLanding={() => clearBlockPageBg('practice')}
            />
            <DualField label="Approche / statement" rich allowImport preview="prose"
              fr={config.practice.approach_fr} en={config.practice.approach_en}
              onFr={v => setConfig({ ...config, practice: { ...config.practice, approach_fr: v } })}
              onEn={v => setConfig({ ...config, practice: { ...config.practice, approach_en: v } })} />
            <div style={{ marginTop: 20 }}>
              <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>
                {/* eslint-disable-next-line pem-i18n/no-hardcoded-jsx-text */}
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
          </>
        )

      case 'works_modes': {
        const mode = config.works_modes[activeMode]
        const worksBlock = findBlock('works_modes')
        const navTransparent = worksBlock.nav_bar_style !== 'bar'
        return (
          <>
            <PageBackgroundEditor
              labelKey="site_block_page_bg_works"
              inheritHintKey="site_block_page_bg_inherit_hint"
              value={blockBgFields('works_modes')}
              onChange={next => setBlockPageBg('works_modes', next)}
              showReset={Boolean(worksBlock.page_bg)}
              onResetToLanding={() => clearBlockPageBg('works_modes')}
            />
            <label
              className="t-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 9,
                marginBottom: 20,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={navTransparent}
                onChange={e => setWorksNavTransparent(e.target.checked)}
              />
              {t('site_block_works_nav_transparent')}
            </label>
            {config.works_modes.length <= 1 && (
              <>
                <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 8, maxWidth: 720, lineHeight: 1.45 }}>
                  {t('site_block_works_modes_landing_hint')}
                </p>
                <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 16, maxWidth: 720, lineHeight: 1.45 }}>
                  {`Séquences de la page `}<code style={{ opacity: 0.85 }}>/works</code>{` et carte de clôture.`}
                </p>
              </>
            )}

            {/* Layout selector — always visible */}
            {mode && (
              <div style={{ marginBottom: 20 }}>
                <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{t('site_works_layout_label').toUpperCase()}</div>
                <div style={{ display: 'inline-flex', border: '1px solid var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
                  {(['carousel', 'grid'] as const).map(v => {
                    const active = (mode.layout || 'carousel') === v
                    return (
                      <button key={v} type="button"
                        className="t-mono-xs"
                        onClick={() => updateMode(activeMode, { layout: v })}
                        style={{
                          padding: '6px 14px', minHeight: 36,
                          fontSize: 9, letterSpacing: 1, fontFamily: 'inherit', textTransform: 'uppercase',
                          border: 'none', cursor: 'pointer',
                          background: active ? 'var(--ac)' : 'var(--bg1)',
                          color: active ? '#fff' : 'var(--tx2)',
                          transition: 'background 0.15s, color 0.15s',
                        }}>
                        {t(v === 'carousel' ? 'site_works_layout_carousel' : 'site_works_layout_grid')}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {/* eslint-disable pem-i18n/no-hardcoded-jsx-text */}
            {config.works_modes.length > 1 && (
              <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 16 }}>
                Chaque mode devient un sous-onglet sur <code>/works</code>, avec ses collections et sa carte de cl&#xF4;ture.
              </p>
            )}
            {/* eslint-enable pem-i18n/no-hardcoded-jsx-text */}

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
                        title={t('site_mode_move_left')} style={{ ...moveBtnStyle(i === 0), width: 16, height: 16, fontSize: 9 }}>{'←'}</button>
                      <button onClick={() => moveMode(i, i + 1)} disabled={i === config.works_modes.length - 1}
                        title={t('site_mode_move_right')} style={{ ...moveBtnStyle(i === config.works_modes.length - 1), width: 16, height: 16, fontSize: 9 }}>{'→'}</button>
                    </div>
                  )
                })}
              </div>
            )}

            {mode && (
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
                      {/* eslint-disable pem-i18n/no-hardcoded-jsx-text */}
                      Supprimer mode
                      {/* eslint-enable pem-i18n/no-hardcoded-jsx-text */}
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
                        onMakePublic={onMakePublic} />
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
            )}

            {config.works_modes.length <= 1 && (
              <button type="button" className="t-mono-xs" onClick={addMode}
                style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 9, letterSpacing: 1, opacity: 0.6 }}>
                + Ajouter un mode (sous-onglets)
              </button>
            )}
          </>
        )
      }
    }
  }

  return (
    <div className="col gap-lg" style={{ gap: 24 }}>
      {blocks.map((block, idx) => {
        const isHidden = !block.visible
        const isCollapsed = isHidden && collapsed.has(block.kind)
        const title = t(BLOCK_LABEL_KEYS[block.kind] as any)
        const icon = BLOCK_ICONS[block.kind]

        const actionBar = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isHidden && (
              <span className="t-mono-xs" style={{
                fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--rust)', opacity: 0.8,
              }}>
                {t('site_block_hidden_badge')}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleVisible(idx)}
              title={t('site_block_toggle_visible')}
              style={{
                ...moveBtnStyle(false),
                opacity: isHidden ? 0.5 : 1,
                fontSize: 13,
              }}
              aria-label={t('site_block_toggle_visible')}
            >
              {isHidden ? '◻' : '◼'}
            </button>
            <button
              type="button"
              onClick={() => moveBlock(idx, idx - 1)}
              disabled={idx === 0}
              title={t('site_block_move_up')}
              style={moveBtnStyle(idx === 0)}
              aria-label={t('site_block_move_up')}
            >↑</button>
            <button
              type="button"
              onClick={() => moveBlock(idx, idx + 1)}
              disabled={idx === blocks.length - 1}
              title={t('site_block_move_down')}
              style={moveBtnStyle(idx === blocks.length - 1)}
              aria-label={t('site_block_move_down')}
            >↓</button>
          </div>
        )

        const worksAction = block.kind === 'works_modes' && config.works_modes.length > 1
          ? <button className="btn sm ghost" onClick={addMode}>+ Mode</button>
          : undefined

        return (
          <div key={block.kind} style={{ opacity: isHidden ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            <SitePublicSection
              title={block.kind === 'works_modes'
                ? (config.works_modes.length > 1 ? `${title} — Modes` : `${title} — Collections`)
                : title}
              icon={icon}
              testId={`atelier-pub-block-${block.kind}`}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {worksAction}
                  {actionBar}
                </div>
              }
            >
              {isHidden ? (
                <button
                  type="button"
                  className="t-mono-xs"
                  onClick={() => toggleCollapsed(block.kind)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--tx3)',
                    cursor: 'pointer', fontSize: 9, letterSpacing: 1, opacity: 0.6,
                  }}
                >
                  {isCollapsed ? '▸ …' : '▾ …'}
                </button>
              ) : null}
              {(!isHidden || !isCollapsed) && renderBlockContent(block.kind)}
            </SitePublicSection>
          </div>
        )
      })}
    </div>
  )
}
