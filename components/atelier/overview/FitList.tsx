'use client'

// A region that never scrolls (Pem 2026-11-23, docs/design/2026-11-23/OverviewGlance.md §3.3a):
// it shows the items its height allows and says « + n autres » for the rest. The container must get its
// height from the layout (flex: 1 / min-height: 0 / a grid cell) — not from its content.
// `enabled = false` (the page itself scrolls: short screens, tablets): every item is shown, nothing is cut.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'

export function FitList({
  items, enabled = true, showMore = true, contents = false, style, className, testId, onMore, onFit,
}: {
  items: ReactNode[]
  enabled?: boolean
  /** Say « + n autres » under the cut. Off for small cards whose count and chart are the summary. */
  showMore?: boolean
  /** Items are cells of the container's own grid (the thumbnails): the wrapper does not make a box. */
  contents?: boolean
  style?: CSSProperties
  className?: string
  testId?: string
  onMore?: () => void
  /** How many items are shown (the rest are hidden) — so a keyboard never acts on a row nobody sees. */
  onFit?: (visible: number) => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(0)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const wraps = Array.from(el.querySelectorAll<HTMLElement>(':scope > [data-fit-item]'))
    const shown = contents ? 'contents' : ''
    for (const w of wraps) w.style.display = shown
    if (!enabled) {
      setHidden(0)
      return
    }
    const box = (w: HTMLElement) => (contents ? (w.firstElementChild as HTMLElement | null) ?? w : w).getBoundingClientRect()
    const bottom = el.getBoundingClientRect().bottom + 0.5
    let cut = wraps.findIndex((w) => box(w).bottom > bottom)
    if (cut >= 0 && showMore) {
      const limit = bottom - 22 // room for the « + n autres » line
      cut = wraps.findIndex((w) => box(w).bottom > limit)
    }
    wraps.forEach((w, i) => {
      w.style.display = cut >= 0 && i >= cut ? 'none' : shown
    })
    setHidden(cut >= 0 ? wraps.length - cut : 0)
  }, [enabled, showMore, contents])

  useLayoutEffect(() => {
    measure()
  })
  useEffect(() => {
    onFit?.(items.length - hidden)
  }, [onFit, items.length, hidden])
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div ref={ref} data-testid={testId} className={className} style={{ minHeight: 0, overflow: 'hidden', ...style }}>
      {items.map((node, i) => (
        <div key={i} data-fit-item style={contents ? { display: 'contents' } : undefined}>
          {node}
        </div>
      ))}
      {enabled && showMore && hidden > 0 ? (
        onMore ? (
          <button type="button" onClick={onMore} style={MORE}>{interpolateMessage(t('fit_more'), { n: hidden })}</button>
        ) : (
          <div style={MORE}>{interpolateMessage(t('fit_more'), { n: hidden })}</div>
        )
      ) : null}
    </div>
  )
}

const MORE: CSSProperties = {
  display: 'block', width: '100%', padding: '4px 12px', fontSize: 11, color: 'var(--tx3)',
  background: 'none', border: 0, font: 'inherit', textAlign: 'left',
}
