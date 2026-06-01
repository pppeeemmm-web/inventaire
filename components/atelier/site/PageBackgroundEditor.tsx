'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  applyLandingBlendTransition,
  resolveLandingBackground,
  type LandingGradientStop,
} from '@/lib/landing-background'
import type { PageBackgroundConfig } from '@/lib/page-background'
import type { MessageKey } from '@/lib/i18n/messages'
import { Slider } from '@/components/atelier/portfolio/shared/Slider'
import { GradientStopsRow } from '@/components/atelier/portfolio/shared/GradientStopsRow'

type Props = {
  labelKey: MessageKey
  inheritHintKey?: MessageKey
  value: PageBackgroundConfig
  onChange: (next: PageBackgroundConfig) => void
  onResetToLanding?: () => void
  showReset?: boolean
}

export function PageBackgroundEditor({
  labelKey,
  inheritHintKey,
  value,
  onChange,
  onResetToLanding,
  showReset,
}: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  function setStops(stops: LandingGradientStop[]) {
    onChange({ ...value, bg_gradient_stops: stops })
  }

  function applyBlendTransition(positionPct: number, softnessPct: number) {
    onChange({
      ...value,
      bg_blend_position_pct: positionPct,
      bg_blend_softness_pct: softnessPct,
      bg_gradient_stops: applyLandingBlendTransition(
        value.bg_gradient_stops,
        positionPct,
        softnessPct,
      ),
    })
  }

  const preview = resolveLandingBackground(value).backgroundCss

  return (
    <div style={{ marginTop: 20, marginBottom: 20 }}>
      <button
        type="button"
        className="t-label"
        onClick={() => setOpen(o => !o)}
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
        <span>{t(labelKey)}</span>
        <span style={{ opacity: 0.55, fontSize: 8 }}>
          {open ? t('site_landing_bg_toggle_hide') : t('site_landing_bg_toggle_show')}
        </span>
      </button>
      {inheritHintKey ? (
        <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 10, lineHeight: 1.5 }}>
          {t(inheritHintKey)}
        </p>
      ) : null}
      <div
        aria-hidden
        style={{
          height: 30,
          borderRadius: 6,
          border: '1px solid var(--bd)',
          marginBottom: open ? 12 : 0,
          background: preview,
        }}
      />
      {showReset && onResetToLanding ? (
        <button
          type="button"
          className="t-mono-xs"
          onClick={onResetToLanding}
          style={{
            marginBottom: open ? 12 : 0,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            opacity: 0.65,
            textDecoration: 'underline',
          }}
        >
          {t('site_block_page_bg_reset')}
        </button>
      ) : null}
      {open ? (
        <>
          <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 10, lineHeight: 1.5 }}>
            {t('site_landing_bg_blend_transition_hint')}
          </p>
          <Slider
            layout="stack"
            label={t('site_landing_bg_blend_position_label')}
            min={0}
            max={100}
            value={value.bg_blend_position_pct}
            onChange={v => applyBlendTransition(v, value.bg_blend_softness_pct)}
            mb={6}
          />
          <Slider
            layout="stack"
            label={t('site_landing_bg_blend_hardness_label')}
            min={0}
            max={100}
            value={value.bg_blend_softness_pct}
            onChange={v => applyBlendTransition(value.bg_blend_position_pct, v)}
            mb={12}
          />
          {/* Compact horizontal stop chips — shared with hero + Ambiance matrix */}
          <div style={{ marginBottom: 12 }}>
            <GradientStopsRow stops={value.bg_gradient_stops} onChange={setStops} />
          </div>
          <div className="t-label" style={{ marginBottom: 6, fontSize: 9 }}>{t('site_landing_bg_preview_label')}</div>
          <div
            aria-hidden
            style={{
              height: 'clamp(72px, 12vh, 120px)',
              borderRadius: 4,
              border: '1px solid var(--bd)',
              background: preview,
            }}
          />
        </>
      ) : null}
    </div>
  )
}
