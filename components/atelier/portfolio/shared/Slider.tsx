'use client'

import type { CSSProperties, MouseEvent } from 'react'

/**
 * Shared slider row used by SiteEditorPanel, HeroGlossEditor, PageBackgroundEditor,
 * and the Phase-2 KnobsPanel.
 *
 * layout="row"   (default) — three-column grid:  [label | range | value+reset]
 * layout="stack"           — label above range input; no value display
 */

export type SliderLayout = 'row' | 'stack'

export interface SliderProps {
  /** Already-translated label string. */
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
  /**
   * Suffix shown after the numeric value in row layout.
   * `"°"` is appended directly (no space); everything else gets a leading space.
   */
  unit?: string
  disabled?: boolean
  /**
   * When provided and `value !== defaultValue`, a ↺ reset chip is shown.
   * Clicking calls `onReset()` if supplied, otherwise `onChange(defaultValue)`.
   */
  defaultValue?: number
  onReset?: () => void
  /** Layout variant. Default 'row'. */
  layout?: SliderLayout
  /** Label column width in px — row layout only. Default 96. */
  labelWidth?: number
  /** Bottom margin in px. Default 4. */
  mb?: number
}

const rowLabelStyle: CSSProperties = {
  color: 'var(--tx2)',
  fontSize: 9,
}

const rowValueStyle: CSSProperties = {
  color: 'var(--tx3)',
  fontSize: 9,
  textAlign: 'right' as const,
  fontVariantNumeric: 'tabular-nums',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 4,
}

export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  unit,
  disabled,
  defaultValue,
  onReset,
  layout = 'row',
  labelWidth = 96,
  mb = 4,
}: SliderProps) {
  const showReset = defaultValue !== undefined && value !== defaultValue

  function handleReset(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (onReset) {
      onReset()
    } else if (defaultValue !== undefined) {
      onChange(defaultValue)
    }
  }

  function formatValue(): string {
    if (unit === undefined) return String(value)
    // degree symbol attaches directly; other units get a space
    if (unit === '°') return `${value}°`
    return `${value} ${unit}`
  }

  if (layout === 'stack') {
    return (
      <label
        className="t-label"
        style={{ display: 'block', fontSize: 9, marginBottom: mb }}
      >
        {label}
        <input
          type="range"
          className="t-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </label>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${labelWidth}px 1fr 46px`,
        alignItems: 'center',
        gap: 8,
        fontSize: 9,
        marginBottom: mb,
      }}
    >
      <span style={rowLabelStyle}>{label}</span>
      <input
        type="range"
        className="t-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
      <span style={rowValueStyle}>
        <span>{formatValue()}</span>
        {showReset && (
          <button
            type="button"
            className="t-mono-xs"
            onClick={handleReset}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--tx3)',
              cursor: 'pointer',
              fontSize: 9,
              opacity: 0.55,
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="reset"
          >
            {/* eslint-disable-next-line pem-i18n/no-hardcoded-jsx-text */}
            ↺
          </button>
        )}
      </span>
    </div>
  )
}
