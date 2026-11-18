'use client'

// A mouse wheel over a focused number field changed its value (stress test 2026-11-18: scrolling the order
// panel turned a 300 € payment into 299 €). On wheel over the focused number input: blur it — the value
// stays and the page scrolls. One listener for every `input[type=number]` (money and quantities).

import { useEffect } from 'react'

export function NumberWheelGuard() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = e.target
      if (el instanceof HTMLInputElement && el.type === 'number' && el === document.activeElement) el.blur()
    }
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => document.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  return null
}
