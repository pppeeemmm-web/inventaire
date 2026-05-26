'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { MessageKey } from '@/lib/i18n/messages'
import type { PortfolioConfig } from '@/lib/portfolio-config-types'
import { EditorFadeShell } from '@/components/atelier/portfolio/shared/EditorFadeShell'
import {
  heroGlossEditorStartsExpanded,
  LANDING_HERO_GLOSS_BLEND_VALUES,
  migrateHeroGlossBlend,
  migrateHeroGlossPct,
  LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
  type LandingHeroGlossBlend,
} from '@/lib/landing-hero-gloss'

const HERO_GLOSS_BLEND_MSG: Record<LandingHeroGlossBlend, MessageKey> = {
  off: 'site_hero_gloss_blend_off',
  'color-dodge': 'site_hero_gloss_blend_color_dodge',
  'soft-light': 'site_hero_gloss_blend_soft_light',
  overlay: 'site_hero_gloss_blend_overlay',
  multiply: 'site_hero_gloss_blend_multiply',
  screen: 'site_hero_gloss_blend_screen',
}

type HeroGlossEditorProps = {
  landing: PortfolioConfig['landing']
  onLandingPatch: (patch: Partial<PortfolioConfig['landing']>) => void
}

export function HeroGlossEditor({ landing, onLandingPatch }: HeroGlossEditorProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(() => heroGlossEditorStartsExpanded(landing))

  const blend = migrateHeroGlossBlend(landing.hero_gloss_blend)
  const strength = migrateHeroGlossPct(
    landing.hero_gloss_strength_pct,
    LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
  )
  const glossDisabled = blend === 'off' || strength <= 0

  const summary = t('site_hero_gloss_summary')
    .replace('{blend}', t(HERO_GLOSS_BLEND_MSG[blend]))
    .replace('{strength}', String(strength))

  const glossControls = (
    <>
      <p className="t-mono-xs" style={{ opacity: 0.55, marginBottom: 12, lineHeight: 1.5 }}>
        {t('site_hero_gloss_help')}
      </p>
      <label className="t-label" style={{ display: 'block', fontSize: 9, marginBottom: 12 }}>
        {t('site_hero_gloss_blend_label')}
        <select
          className="input full"
          value={landing.hero_gloss_blend}
          onChange={e => onLandingPatch({
            hero_gloss_blend: e.target.value as LandingHeroGlossBlend,
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
          value={landing.hero_gloss_strength_pct}
          onChange={e => onLandingPatch({
            hero_gloss_strength_pct: Number(e.target.value),
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
          value={landing.hero_gloss_position_pct}
          disabled={glossDisabled}
          onChange={e => onLandingPatch({
            hero_gloss_position_pct: Number(e.target.value),
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
          value={landing.hero_gloss_falloff_pct}
          disabled={glossDisabled}
          onChange={e => onLandingPatch({
            hero_gloss_falloff_pct: Number(e.target.value),
          })}
          style={{ display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>
    </>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{t('site_hero_gloss_label')}</div>
      <EditorFadeShell
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
        preview={(
          <div style={{ padding: '10px 12px', fontSize: 10, lineHeight: 1.6, color: 'var(--tx2)' }}>
            <span>{summary}</span>
          </div>
        )}
        maxCollapsedPx={48}
        expandLabelKey="site_hero_gloss_expand"
        collapseLabelKey="site_hero_gloss_collapse"
      >
        {glossControls}
      </EditorFadeShell>
    </div>
  )
}
