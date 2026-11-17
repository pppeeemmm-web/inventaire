'use client'

// Work card R3 hover captions (docs/design/2026-11-16/WorkCard.notes.md « Hover captions everywhere »):
// one small bubble — mouse hover / keyboard focus on desktop, long-press on touch, an ⓘ to tap where
// a hover can't exist. Rendered in a portal (position: fixed, clamped to the viewport) so it is never
// clipped by the panel and never adds a horizontal scroll. Copy comes from `work-card.messages.ts`.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'

const LONG_PRESS_MS = 450
const HOVER_DELAY_MS = 250
const BUBBLE_W = 260

type Pos = { left: number; top: number; above: boolean }

/** Handlers to spread on the element that carries the caption. */
export type CaptionBind = {
  onPointerEnter: (e: React.PointerEvent<HTMLElement>) => void
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onFocus: (e: React.FocusEvent<HTMLElement>) => void
  onBlur: () => void
  onClickCapture: (e: SyntheticEvent) => void
  onContextMenu: (e: SyntheticEvent) => void
  'aria-description'?: string
}

export function useCaption(text?: string | null): { bind: CaptionBind | Record<string, never>; node: ReactNode; toggleFrom: (el: HTMLElement) => void } {
  const [pos, setPos] = useState<Pos | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressedAt = useRef(0)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const showAt = useCallback((el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const above = r.bottom + 90 > vh
    const w = Math.min(BUBBLE_W, vw - 16)
    setPos({ left: Math.max(8, Math.min(r.left, vw - w - 8)), top: above ? r.top - 6 : r.bottom + 6, above })
  }, [])
  const hide = useCallback(() => {
    clear()
    setPos(null)
  }, [])

  // Touch-shown bubble: next touch anywhere, a scroll or 4 s hides it.
  useEffect(() => {
    if (!pos) return
    const off = () => hide()
    window.addEventListener('scroll', off, true)
    window.addEventListener('resize', off)
    return () => {
      window.removeEventListener('scroll', off, true)
      window.removeEventListener('resize', off)
    }
  }, [pos, hide])
  useEffect(() => () => {
    clear()
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const toggleFrom = useCallback(
    (el: HTMLElement) => {
      if (pos) {
        hide()
        return
      }
      showAt(el)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(hide, 4000)
    },
    [pos, hide, showAt],
  )

  if (!text) return { bind: {}, node: null, toggleFrom }

  const bind: CaptionBind = {
    onPointerEnter: (e) => {
      if (e.pointerType !== 'mouse') return
      const el = e.currentTarget
      clear()
      timer.current = setTimeout(() => showAt(el), HOVER_DELAY_MS)
    },
    onPointerLeave: (e) => {
      if (e.pointerType === 'mouse') hide()
    },
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') {
        hide()
        return
      }
      const el = e.currentTarget
      clear()
      timer.current = setTimeout(() => {
        pressedAt.current = Date.now()
        showAt(el)
        if (hideTimer.current) clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(hide, 4000)
      }, LONG_PRESS_MS)
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onFocus: (e) => {
      if (e.currentTarget.matches(':focus-visible')) showAt(e.currentTarget)
    },
    onBlur: hide,
    // A long-press shows the caption; it must not also press the chip.
    onClickCapture: (e) => {
      if (Date.now() - pressedAt.current < 900) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    onContextMenu: (e) => {
      if (Date.now() - pressedAt.current < 900) e.preventDefault()
    },
    'aria-description': text,
  }

  const st: CSSProperties | null = pos
    ? {
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        transform: pos.above ? 'translateY(-100%)' : undefined,
        width: 'max-content',
        maxWidth: `min(${BUBBLE_W}px, calc(100vw - 16px))`,
        zIndex: 10050,
        background: 'var(--bg2)',
        border: '1px solid var(--bd3)',
        borderRadius: 4,
        padding: '6px 8px',
        fontSize: 11,
        lineHeight: 1.35,
        color: 'var(--tx2)',
        boxShadow: '0 6px 18px rgba(0,0,0,.45)',
        pointerEvents: 'none',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        textAlign: 'left',
        fontWeight: 400,
        letterSpacing: 0,
        textTransform: 'none',
      }
    : null
  const node = st && typeof document !== 'undefined'
    ? createPortal(<span role="tooltip" data-testid="wc-caption" style={st}>{text}</span>, document.body)
    : null
  return { bind, node, toggleFrom }
}

/** Render-prop form for elements built in a loop: `<WithCaption text>{(bind) => <button {...bind} />}</WithCaption>`. */
export function WithCaption({ text, children }: { text?: string | null; children: (bind: CaptionBind | Record<string, never>) => ReactNode }) {
  const { bind, node } = useCaption(text)
  return (
    <>
      {children(bind)}
      {node}
    </>
  )
}

/** ⓘ to tap (touch) or hover (desktop) — for labels that are not themselves a control. */
export function InfoDot({ text, narrow }: { text: string; narrow?: boolean }) {
  const { bind, node, toggleFrom } = useCaption(text)
  return (
    <>
      <button
        type="button"
        aria-label={text}
        {...bind}
        onClick={(e) => {
          e.stopPropagation()
          toggleFrom(e.currentTarget)
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: narrow ? '0 6px' : '0 2px',
          minHeight: narrow ? 32 : undefined,
          color: 'var(--tx3)',
          fontSize: 11,
          fontWeight: 400,
          cursor: 'help',
          fontFamily: 'inherit',
          verticalAlign: 'baseline',
        }}
      >
        ⓘ
      </button>
      {node}
    </>
  )
}
