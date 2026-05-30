'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

/**
 * Visitor's local ("atomic") time with flowing milliseconds. Client-only — it
 * renders nothing on the server and first client paint (so there is no
 * hydration mismatch from new Date()), then updates each animation frame so the
 * millisecond digits flow. Respects prefers-reduced-motion (ticks per second,
 * no flowing).
 */
export function LandingAtomicClock({ style }: { style?: CSSProperties }) {
  const [time, setTime] = useState<{ hms: string; ms: string } | null>(null)
  const raf = useRef<number | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const p = (n: number, l = 2) => String(n).padStart(l, '0')
    const read = () => {
      const d = new Date()
      setTime({
        hms: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
        ms: p(d.getMilliseconds(), 3),
      })
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

  if (!time) return null

  return (
    <div
      aria-hidden
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
        fontSize: 10,
        letterSpacing: 3,
        display: 'inline-flex',
        alignItems: 'baseline',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span>{time.hms}</span>
      <span style={{ opacity: 0.45, fontSize: 8, marginLeft: 1 }}>.{time.ms}</span>
    </div>
  )
}
