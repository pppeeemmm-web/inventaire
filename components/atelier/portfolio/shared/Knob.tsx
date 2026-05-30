'use client'

import { type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * Compact rotary knob — a dense alternative to the full-width Slider for
 * packing many numeric controls into a grid.
 *
 * Interaction: drag vertically (up = increase), Shift = fine. Arrow keys
 * step, PageUp/Down ×10, Home/End to min/max. Double-click resets to
 * `defaultValue` (or calls `onReset`). Same prop shape as Slider so it is a
 * near drop-in.
 */

export interface KnobProps {
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
  /** `"°"` attaches directly; other units get a leading space. */
  unit?: string
  disabled?: boolean
  defaultValue?: number
  onReset?: () => void
  /** Dial diameter in px. Default 42. */
  size?: number
  /** Show the text label under the dial. Default true; matrix layouts pass false. */
  showLabel?: boolean
}

const START_ANGLE = -135 // min position (0 = pointing up)
const SWEEP = 270        // total travel in degrees
/** Vertical px of drag for a full min→max sweep. */
const FULL_TRAVEL_PX = 170

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function Knob({
  label, min, max, step = 1, value, onChange,
  unit, disabled, defaultValue, onReset, size = 42, showLabel = true,
}: KnobProps) {
  const range = max - min || 1
  const frac = clamp((value - min) / range, 0, 1)
  const angle = START_ANGLE + frac * SWEEP
  const edited = defaultValue !== undefined && value !== defaultValue

  function quantize(v: number): number {
    const snapped = Math.round((v - min) / step) * step + min
    return clamp(Number(snapped.toFixed(6)), min, max)
  }

  // Drag with window-level listeners — reliable across pointer capture / text
  // selection quirks. startY/startVal captured at press; value is absolute.
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return
    e.preventDefault() // stop the drag from starting a text selection
    e.currentTarget.focus()
    const startY = e.clientY
    const startVal = value
    const onMove = (ev: globalThis.PointerEvent) => {
      const dy = startY - ev.clientY // up = positive
      const sensitivity = (ev.shiftKey ? 0.25 : 1) * range / FULL_TRAVEL_PX
      onChange(quantize(startVal + dy * sensitivity))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    const big = step * 10
    let nv = value
    switch (e.key) {
      case 'ArrowUp': case 'ArrowRight': nv = value + step; break
      case 'ArrowDown': case 'ArrowLeft': nv = value - step; break
      case 'PageUp': nv = value + big; break
      case 'PageDown': nv = value - big; break
      case 'Home': nv = min; break
      case 'End': nv = max; break
      default: return
    }
    e.preventDefault()
    onChange(quantize(nv))
  }

  function reset() {
    if (onReset) onReset()
    else if (defaultValue !== undefined) onChange(defaultValue)
  }

  function formatValue(): string {
    const v = Number.isInteger(value) ? value : Math.round(value * 100) / 100
    if (unit === undefined) return String(v)
    if (unit === '°') return `${v}°`
    return `${v}${unit}`
  }

  const stroke = Math.max(3, size * 0.1)
  const fillDeg = frac * SWEEP
  const dialStyle: CSSProperties = {
    position: 'relative',
    width: size, height: size, borderRadius: '50%',
    background: `conic-gradient(from 225deg, var(--ac) 0deg ${fillDeg}deg, var(--bd2) ${fillDeg}deg ${SWEEP}deg, transparent ${SWEEP}deg 360deg)`,
    cursor: disabled ? 'not-allowed' : 'ns-resize',
    opacity: disabled ? 0.4 : 1,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: size + 14, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatValue()}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onKeyDown={onKey}
        onDoubleClick={reset}
        title={edited ? `${formatValue()} — double-click to reset` : formatValue()}
        style={dialStyle}
      >
        {/* inner face */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: stroke, borderRadius: '50%',
            background: 'var(--bg1)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)',
            display: 'grid', placeItems: 'center',
          }}
        >
          {edited && (
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ac)' }} />
          )}
        </div>
        {/* pointer dot at the value angle */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, transform: `rotate(${angle}deg)`, pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', left: '50%', top: stroke * 0.55,
            width: 3, height: 3, borderRadius: '50%', background: 'var(--tx)',
            transform: 'translateX(-50%)',
          }} />
        </div>
      </div>
      {showLabel && (
        <span style={{ fontSize: 8, letterSpacing: 0.3, color: 'var(--tx2)', textAlign: 'center', lineHeight: 1.1, maxWidth: size + 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
          {label}
        </span>
      )}
      <span style={{ fontSize: 8, color: edited ? 'var(--ac)' : 'var(--tx3)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {formatValue()}
      </span>
    </div>
  )
}
