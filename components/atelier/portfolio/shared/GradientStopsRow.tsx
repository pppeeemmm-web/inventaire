'use client'

import { useI18n } from '@/lib/i18n/context'
import { Knob } from '@/components/atelier/portfolio/shared/Knob'
import {
  normalizeHexColor,
  LANDING_BG_TOP_DEFAULT,
  LANDING_GRADIENT_STOP_MAX,
  LANDING_GRADIENT_STOP_MIN,
  type LandingGradientStop,
} from '@/lib/landing-background'

/**
 * Compact horizontal gradient-stop editor — color chip + position knob + ×.
 * Single source of truth for every gradient control in the site editor
 * (hero, per-page background, Ambiance matrix). Dense, reads left-to-right,
 * uses both axes instead of the old stacked full-width cards.
 */
export function GradientStopsRow({
  stops,
  onChange,
  min = LANDING_GRADIENT_STOP_MIN,
  max = LANDING_GRADIENT_STOP_MAX,
}: {
  stops: LandingGradientStop[]
  onChange: (next: LandingGradientStop[]) => void
  min?: number
  max?: number
}) {
  const { t } = useI18n()

  function updateStop(i: number, patch: Partial<LandingGradientStop>) {
    onChange(stops.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  }

  function addStop() {
    if (stops.length >= max) return
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
    const last = sorted[sorted.length - 1]
    onChange([...stops, { color: last?.color ?? '#888888', position_pct: insertAt }])
  }

  function removeStop(i: number) {
    if (stops.length <= min) return
    onChange(stops.filter((_, k) => k !== i))
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
      {stops.map((stop, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            border: '1px solid var(--bd)',
            borderRadius: 4,
            padding: '6px 6px 4px',
            position: 'relative',
          }}
        >
          <input
            type="color"
            value={normalizeHexColor(stop.color) ?? LANDING_BG_TOP_DEFAULT}
            onChange={e => updateStop(i, { color: e.target.value })}
            aria-label={t('site_landing_bg_stop_color_label')}
            style={{ width: 30, height: 26, padding: 0, border: '1px solid var(--bd)', borderRadius: 2, cursor: 'pointer', background: 'none' }}
          />
          <Knob
            showLabel={false}
            size={34}
            label={t('site_landing_bg_stop_position_label')}
            min={0}
            max={100}
            step={1}
            unit="%"
            value={Math.round(stop.position_pct)}
            onChange={v => updateStop(i, { position_pct: v })}
          />
          {stops.length > min && (
            <button
              type="button"
              onClick={() => removeStop(i)}
              aria-label={t('site_landing_bg_remove_stop')}
              style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', border: 'none', background: 'rgba(255,80,80,0.18)', color: '#f88', cursor: 'pointer', fontSize: 9, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          )}
        </div>
      ))}
      {stops.length < max && (
        <button
          type="button"
          onClick={addStop}
          aria-label={t('site_landing_bg_add_stop')}
          style={{ width: 44, minHeight: 70, border: '1px dashed var(--bd)', borderRadius: 4, background: 'none', color: 'var(--tx2)', cursor: 'pointer', fontSize: 16 }}
        >+</button>
      )}
    </div>
  )
}
