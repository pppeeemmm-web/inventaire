'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
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
import type { PageBackgroundConfig } from '@/lib/page-background'
import type { MessageKey } from '@/lib/i18n/messages'
import { Slider } from '@/components/atelier/portfolio/shared/Slider'

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

  function updateStop(index: number, patch: Partial<LandingGradientStop>) {
    setStops(value.bg_gradient_stops.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addStop() {
    const stops = [...value.bg_gradient_stops]
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
    setStops(stops)
  }

  function removeStop(index: number) {
    if (value.bg_gradient_stops.length <= LANDING_GRADIENT_STOP_MIN) return
    setStops(value.bg_gradient_stops.filter((_, i) => i !== index))
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
          height: 12,
          borderRadius: 4,
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
          {value.bg_gradient_stops.map((stop, index) => (
            <div
              key={`block-grad-${index}`}
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
                  disabled={value.bg_gradient_stops.length <= LANDING_GRADIENT_STOP_MIN}
                  onClick={() => removeStop(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: value.bg_gradient_stops.length <= LANDING_GRADIENT_STOP_MIN ? 0.35 : 0.7,
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
                    onChange={e => updateStop(index, { color: e.target.value })}
                    aria-label={t('site_landing_bg_stop_color_label')}
                    style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--bd)', cursor: 'pointer' }}
                  />
                  <input
                    className="input full"
                    value={stop.color}
                    onChange={e => updateStop(index, { color: e.target.value })}
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
                onChange={v => updateStop(index, { position_pct: v })}
                mb={0}
              />
            </div>
          ))}
          <button
            type="button"
            className="t-mono-xs"
            disabled={value.bg_gradient_stops.length >= LANDING_GRADIENT_STOP_MAX}
            onClick={addStop}
            style={{
              marginBottom: 12,
              background: 'none',
              border: '1px dashed var(--bd)',
              borderRadius: 4,
              padding: '8px 12px',
              width: '100%',
              cursor: 'pointer',
              opacity: value.bg_gradient_stops.length >= LANDING_GRADIENT_STOP_MAX ? 0.4 : 1,
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
              background: preview,
            }}
          />
        </>
      ) : null}
    </div>
  )
}
