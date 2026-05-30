'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

const CS133_HZ = BigInt(9_192_631_770) // SI second = 9,192,631,770 Cs-133 hyperfine cycles
const THOUSAND = BigInt(1000)

/** Group a decimal string into 3-digit clusters with a thin space (sci-fi readout). */
function group(s: string) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Time rendered as units of vibration: the visitor's local clock plus a live
 * count of Cs-133 hyperfine cycles elapsed since local midnight (the physical
 * definition of the SI second). The low digits churn each animation frame — the
 * second is not ticking, it is *vibrating*.
 *
 * Client-only: renders nothing on the server and on first client paint (no
 * hydration mismatch from new Date()), then updates per frame. Respects
 * prefers-reduced-motion (1s ticks, no flow).
 */
export function LandingAtomicClock({ style }: { style?: CSSProperties }) {
  const [state, setState] = useState<{ hms: string; cycles: string } | null>(null)
  const raf = useRef<number | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const p = (n: number) => String(n).padStart(2, '0')
    const read = () => {
      const d = new Date()
      const h = d.getHours()
      const m = d.getMinutes()
      const s = d.getSeconds()
      const msSinceMidnight =
        h * 3_600_000 + m * 60_000 + s * 1_000 + d.getMilliseconds()
      const cycles = (BigInt(msSinceMidnight) * CS133_HZ) / THOUSAND
      setState({ hms: `${p(h)}:${p(m)}:${p(s)}`, cycles: group(cycles.toString()) })
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      read()
      timer.current = window.setInterval(read, 1000)
      return () => { if (timer.current) window.clearInterval(timer.current) }
    }
    const loop = () => { read(); raf.current = requestAnimationFrame(loop) }
    raf.current = requestAnimationFrame(loop)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [])

  if (!state) return null

  return (
    <div
      aria-hidden
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1.1,
        ...style,
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 3, opacity: 0.85 }}>{state.hms}</span>
      <span
        style={{
          fontSize: 9,
          letterSpacing: 0.5,
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 6px rgba(120,150,180,0.45)',
        }}
      >
        {state.cycles}
      </span>
      <span style={{ fontSize: 6.5, letterSpacing: 2, opacity: 0.4, textTransform: 'uppercase' }}>
        Cs&#8209;133 &middot; Hz since midnight
      </span>
    </div>
  )
}
