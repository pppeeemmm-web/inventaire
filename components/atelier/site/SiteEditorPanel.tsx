'use client'

import { useRef, useState, useTransition, type ChangeEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type {
  Block,
  PortfolioConfig,
  CollectionItem,
  WorksMode,
  ThemeWork,
  SiteBlockKind,
  SiteBlock,
  WorksLayout,
} from '@/lib/portfolio-config-types'
import type { KnobFamilyOverrides } from '@/lib/site-blocks'
import { WORKS_LAYOUT_VALUES, WORKS_LAYOUT_PLACEHOLDERS } from '@/lib/portfolio-config-types'
import {
  pageBackgroundFromLanding,
  type PageBackgroundConfig,
} from '@/lib/page-background'
import { PageBackgroundEditor } from '@/components/atelier/site/PageBackgroundEditor'
import { reorder } from '@/lib/portfolio-config-types'
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
import { resolveHeroGloss } from '@/lib/landing-hero-gloss'
import {
  resolveWorksMobileLayout,
} from '@/lib/works-mode-light'
import { SitePublicSection } from '@/components/atelier/portfolio/shared/SitePublicSection'
import PagesEditor from '@/components/atelier/site/PagesEditor'
import { Slider } from '@/components/atelier/portfolio/shared/Slider'
import { Slot } from '@/components/atelier/portfolio/shared/Slot'
import { DualField } from '@/components/atelier/portfolio/shared/DualField'
import { CollectionRow } from '@/components/atelier/portfolio/shared/CollectionRow'
import { moveBtnStyle } from '@/components/atelier/portfolio/shared/moveBtnStyle'
import { PracticeBlockExtras } from '@/components/atelier/site/PracticeBlockExtras'
import { HeroGlossEditor } from '@/components/atelier/site/HeroGlossEditor'
import { KnobsPanel } from '@/components/atelier/site/KnobsPanel'
import { MapPinEditor } from '@/components/atelier/site/MapPinEditor'
import { uploadPanoramaImage } from '@/app/atelier/(portal)/portfolio/actions'
import { imageUrl } from '@/lib/data'
import { DEFAULT_KNOBS_CONFIG } from '@/lib/site-blocks'
import {
  LandingHeroWorkPicker,
  landingHeroPreviewSrc,
  type LandingHeroWorkLite,
} from '@/components/atelier/site/LandingHeroWorkPicker'

// ── MapLayoutSection — panorama upload widget ─────────────────────────────────
function MapLayoutSection({
  mode, activeMode, updateMode, oeuvres,
}: {
  mode: WorksMode
  activeMode: number
  updateMode: (i: number, patch: Partial<WorksMode>) => void
  oeuvres: LandingHeroWorkLite[]
}) {
  const { t, lang } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [isUploading, startUpload] = useTransition()
  const panoramaUrl = imageUrl(mode.forest_panorama_r2_key)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr(null)
    const fd = new FormData()
    fd.append('file', file)
    startUpload(async () => {
      const res = await uploadPanoramaImage(fd)
      if ('error' in res) { setUploadErr(res.error); return }
      updateMode(activeMode, { forest_panorama_r2_key: res.key })
    })
    e.target.value = ''
  }

  return (
    <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid var(--bd)' }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)', marginBottom: 8 }}>
        {t('site_works_map_r2_key_label')}
      </div>

      {/* Panorama preview + upload row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {/* Thumbnail */}
        <div style={{
          width: 80, height: 45, flexShrink: 0, borderRadius: 2,
          border: '1px solid var(--bd)',
          background: panoramaUrl
            ? undefined
            : 'repeating-linear-gradient(45deg, var(--bg1) 0, var(--bg1) 6px, var(--bg2) 6px, var(--bg2) 12px)',
          overflow: 'hidden',
        }}>
          {panoramaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={panoramaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {mode.forest_panorama_r2_key && (
            <div style={{
              fontSize: 7, color: 'var(--tx2)', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 4,
            }}>
              {mode.forest_panorama_r2_key}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileRef.current?.click()}
            style={{
              fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
              padding: '4px 10px', border: '1px solid var(--bd)', borderRadius: 2,
              background: 'var(--bg2)', color: 'var(--tx)', cursor: 'pointer',
              fontFamily: 'inherit', opacity: isUploading ? 0.6 : 1,
            }}
          >
            {isUploading
              ? (lang === 'fr' ? 'Envoi…' : 'Uploading…')
              : mode.forest_panorama_r2_key
                ? (lang === 'fr' ? 'Changer' : 'Change')
                : (lang === 'fr' ? 'Choisir une image' : 'Choose image')}
          </button>
          {mode.forest_panorama_r2_key && (
            <button
              type="button"
              onClick={() => updateMode(activeMode, { forest_panorama_r2_key: undefined })}
              style={{
                fontSize: 8, marginLeft: 4, padding: '4px 8px',
                border: '1px solid var(--bd)', borderRadius: 2,
                background: 'none', color: 'var(--tx2)', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {uploadErr && (
        <div style={{ fontSize: 8, color: '#f88', marginBottom: 6 }}>{uploadErr}</div>
      )}

      {/* Existing key — editable so they can paste an R2 key without re-uploading */}
      <input
        type="text"
        value={mode.forest_panorama_r2_key ?? ''}
        onChange={e => updateMode(activeMode, { forest_panorama_r2_key: e.target.value || undefined })}
        placeholder={lang === 'fr' ? 'Clé R2 existante (ex: panoramas/abc.avif)' : 'Existing R2 key (e.g. panoramas/abc.avif)'}
        style={{
          width: '100%', boxSizing: 'border-box',
          fontFamily: 'monospace', fontSize: 7,
          padding: '4px 8px', background: 'var(--bg2)', color: 'var(--tx2)',
          border: '1px solid var(--bd2)', borderRadius: 2, marginBottom: 10,
        }}
      />

      {/* Base size slider — max size at z=0 */}
      {mode.forest_panorama_r2_key && (
        <div style={{ marginBottom: 10 }}>
          <Slider
            label={lang === 'fr' ? 'Taille par défaut' : 'Default size'}
            min={2} max={40} step={1}
            value={mode.forest_panorama_pin_size ?? 16}
            onChange={v => updateMode(activeMode, { forest_panorama_pin_size: v })}
            defaultValue={16}
            onReset={() => updateMode(activeMode, { forest_panorama_pin_size: undefined })}
            unit="%"
          />
        </div>
      )}

      <MapPinEditor
        works={oeuvres}
        panoramaKey={mode.forest_panorama_r2_key}
        pinSize={mode.forest_panorama_pin_size}
        collections={mode.collections}
      />
    </div>
  )
}

function hasHeroPreviewUrl(src: string): boolean {
  const u = src.trim()
  return /^https:\/\//i.test(u) || u.startsWith('/r2-proxy/')
}

interface SiteEditorProps {
  oeuvres: LandingHeroWorkLite[]
  config: PortfolioConfig
  setConfig: (c: PortfolioConfig) => void
  activeMode: number
  setActiveMode: (i: number) => void
  activeSlot: { type: 'theme'; page: 'works' | 'sections'; index: number; modeIdx?: number } | null
  setActiveSlot: (s: SiteEditorProps['activeSlot']) => void
  themeNameStats: Record<string, { total: number; pub: number }>
  privateWorksForThemeLabel: (label: string) => ThemeWork[] | undefined
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

export function SiteEditorPanel({
  oeuvres,
  config, setConfig,
  activeMode, setActiveMode,
  activeSlot, setActiveSlot,
  themeNameStats, privateWorksForThemeLabel,
  onMakePublic,
  addMode, deleteMode, moveMode, updateMode,
  addModeCollection, moveModeCollection, updateModeCollection, deleteModeCollection,
}: SiteEditorProps) {
  const { t, tDynamic, lang } = useI18n()
  const blocks = config.site_blocks
  const [collapsed, setCollapsed] = useState<Set<SiteBlockKind>>(new Set())
  const [bgGradientOpen, setBgGradientOpen] = useState(false)
  // §4.3 — block scope for KnobsPanel: tracks which PagesEditor block is selected
  const [selectedBlockUid, setSelectedBlockUid] = useState<string | null>(null)

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
      case 'hero': {
        const heroPreviewSrc = landingHeroPreviewSrc(config.landing)
        return (
          <>
            <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>{t('atelier_pub_landing_behavior_help')}</p>
            <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>{t('atelier_pub_hero_url_help')}</p>
            <p className="t-mono-xs" style={{ opacity: 0.4, marginBottom: 8, fontSize: 9 }}>{t('atelier_pub_hero_r2_followup')}</p>
            <p className="t-mono-xs" style={{ opacity: 0.45, marginBottom: 16, fontSize: 9 }}>{t('atelier_pub_hero_url_full_res_hint')}</p>
            <LandingHeroWorkPicker
              oeuvres={oeuvres}
              landing={config.landing}
              onApply={patch => setConfig({
                ...config,
                landing: { ...config.landing, ...patch },
              })}
            />
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
                landing: {
                  ...config.landing,
                  hero_image_url: e.target.value,
                  hero_image_key: '',
                  hero_oeuvre_id: null,
                  hero_image_id: null,
                },
              })}
            />
            {hasHeroPreviewUrl(heroPreviewSrc) && (
              <div style={{ marginTop: 16 }}>
                <div className="t-label" style={{ marginBottom: 4, fontSize: 9 }}>{t('atelier_pub_hero_preview_label')}</div>
                <p className="t-mono-xs" style={{ opacity: 0.45, marginBottom: 12, fontSize: 9, wordBreak: 'break-all' }}>
                  {(config.landing.hero_image_key || heroPreviewSrc).trim().replace(/^https?:\/\/[^/]+/, '').replace(/^\/r2-proxy\//, '')}
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
                      <img
                        src={heroPreviewSrc}
                        alt=""
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          objectPosition: 'center',
                          display: 'block',
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
                    <img src={heroPreviewSrc} alt="1:1 crop"
                      style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                  </div>
                </div>
              </div>
            )}
            <HeroGlossEditor
              landing={config.landing}
              onLandingPatch={patch => setConfig({
                ...config,
                landing: { ...config.landing, ...patch },
              })}
            />
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
                  <Slider
                    layout="stack"
                    label={t('site_landing_bg_blend_position_label')}
                    min={0}
                    max={100}
                    value={config.landing.bg_blend_position_pct}
                    onChange={v => applyBlendTransition(v, config.landing.bg_blend_softness_pct)}
                    mb={6}
                  />
                  <Slider
                    layout="stack"
                    label={t('site_landing_bg_blend_hardness_label')}
                    min={0}
                    max={100}
                    value={config.landing.bg_blend_softness_pct}
                    onChange={v => applyBlendTransition(config.landing.bg_blend_position_pct, v)}
                    mb={12}
                  />
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
                      <Slider
                        layout="stack"
                        label={t('site_landing_bg_stop_position_label')}
                        min={0}
                        max={100}
                        value={stop.position_pct}
                        onChange={v => updateGradientStop(index, { position_pct: v })}
                        mb={0}
                      />
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
                      height: 'clamp(72px, 12vh, 120px)',
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
      }

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
            <PracticeBlockExtras
              practice={config.practice}
              onThemes={themes => setConfig({ ...config, practice: { ...config.practice, themes } })}
              onMaterialsFr={v => setConfig({ ...config, practice: { ...config.practice, materials_fr: v } })}
              onMaterialsEn={v => setConfig({ ...config, practice: { ...config.practice, materials_en: v } })}
            />
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {WORKS_LAYOUT_VALUES.map(v => {
                    const active = (mode.layout || 'carousel') === v
                    const placeholder = WORKS_LAYOUT_PLACEHOLDERS.has(v)
                    return (
                      <button key={v} type="button"
                        className="t-mono-xs"
                        onClick={() => updateMode(activeMode, { layout: v as WorksLayout })}
                        title={placeholder ? t('site_works_layout_placeholder_badge') : undefined}
                        style={{
                          padding: '6px 12px', minHeight: 32,
                          fontSize: 9, letterSpacing: 1, fontFamily: 'inherit', textTransform: 'uppercase',
                          border: '1px solid ' + (active ? 'var(--ac)' : 'var(--bd)'),
                          borderRadius: 4, cursor: 'pointer',
                          background: active ? 'var(--ac)' : 'var(--bg1)',
                          color: active ? '#fff' : 'var(--tx2)',
                          opacity: placeholder ? 0.75 : 1,
                          transition: 'background 0.15s, color 0.15s',
                        }}>
                        {tDynamic(`site_works_layout_${v}`)}
                        {placeholder && (
                          <span style={{ marginLeft: 6, fontSize: 7, opacity: 0.7 }}>
                            {/* eslint-disable-next-line pem-i18n/no-hardcoded-jsx-text */}
                            ◌
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {/* Mobile fallback row — compact select below layout buttons */}
            {mode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span className="t-label" style={{ fontSize: 9, whiteSpace: 'nowrap' }}>
                  {t('site_works_mode_mobile_fallback_label')}
                </span>
                <select
                  value={mode.mobile_fallback ?? 'auto'}
                  onChange={e => updateMode(activeMode, { mobile_fallback: e.target.value as WorksLayout | 'auto' })}
                  style={{
                    flex: 1,
                    fontFamily: 'inherit', fontSize: 9, padding: '5px 8px',
                    background: 'var(--bg2)', color: 'var(--tx)',
                    border: '1px solid var(--bd2)', borderRadius: 0,
                  }}
                >
                  <option value="auto">
                    {t('site_works_mode_mobile_fallback_auto')}
                    {' '}({tDynamic(`site_works_layout_${resolveWorksMobileLayout(mode.layout ?? 'carousel', 'auto')}`)})
                  </option>
                  {WORKS_LAYOUT_VALUES.map(v => (
                    <option key={v} value={v}>{tDynamic(`site_works_layout_${v}`)}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Per-mode light / shadow / bevel controls removed — these now live
             *  in the global Ambiance knobs panel (config.knobs), which is the
             *  source of truth for the works render. The legacy mode.* fields are
             *  no longer edited here. */}
            {/* ── Map layout — panorama upload + pin editor ── */}
            {mode?.layout === 'map' && (
              <MapLayoutSection
                mode={mode}
                activeMode={activeMode}
                updateMode={updateMode}
                oeuvres={oeuvres}
              />
            )}

            {/* ── Motion interior layout — R2 key ── */}
            {mode?.layout === 'motion_interior' && (
              <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid var(--bd)' }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)', marginBottom: 8 }}>
                  {t('site_works_motion_r2_key_label')}
                </div>
                <input
                  type="text"
                  value={mode.motion_interior_r2_key ?? ''}
                  onChange={e => updateMode(activeMode, { motion_interior_r2_key: e.target.value || undefined })}
                  placeholder={t('site_works_motion_r2_key_hint')}
                  style={{
                    width: '100%', fontFamily: 'inherit', fontSize: 9,
                    padding: '5px 8px', background: 'var(--bg2)', color: 'var(--tx)',
                    border: '1px solid var(--bd2)', borderRadius: 0, marginBottom: 2,
                  }}
                />
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
                        privateWorks={item.theme ? privateWorksForThemeLabel(item.theme) : undefined}
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
      {/* Phase 1 — block-composition editor. Sits above the legacy
       * kind-by-kind sections so authors can add/reorder text + future
       * universal blocks per page without leaving this panel. */}
      <SitePublicSection
        title={t('site_composition_title')}
        icon="◳"
        testId="atelier-pub-block-composition"
      >
        <PagesEditor
          config={config}
          setConfig={setConfig}
          onBlockSelect={uid => setSelectedBlockUid(uid)}
        />
      </SitePublicSection>
      <SitePublicSection
        title={t('site_knobs_panel_title')}
        icon="◑"
        testId="atelier-pub-knobs"
      >
        <KnobsPanel
          knobs={config.knobs ?? DEFAULT_KNOBS_CONFIG}
          onChange={next => setConfig({ ...config, knobs: next })}
          selectedBlockUid={selectedBlockUid ?? undefined}
          selectedBlockOverride={(() => {
            if (!selectedBlockUid) return undefined
            const allBlocks = Object.values(config.pages ?? {}).flat() as Block[]
            return allBlocks.find(b => b.uid === selectedBlockUid)?.knob_override
          })()}
          onBlockOverrideChange={override => {
            if (!selectedBlockUid) return
            const pages = config.pages ?? {}
            const updatedPages = Object.fromEntries(
              Object.entries(pages).map(([page, blocks]) => [
                page,
                (blocks as Block[]).map(b =>
                  b.uid === selectedBlockUid ? { ...b, knob_override: override } : b,
                ),
              ]),
            )
            setConfig({ ...config, pages: updatedPages })
          }}
        />
      </SitePublicSection>
      {blocks.map((block, idx) => {
        const isHidden = !block.visible
        const isCollapsed = isHidden && collapsed.has(block.kind)
        const title = tDynamic(BLOCK_LABEL_KEYS[block.kind])
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
