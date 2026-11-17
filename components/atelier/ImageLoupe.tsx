'use client'

// Loupe on a work thumbnail (owner 2026-11-13). Computer: hover ~350 ms → the picture as large as the
// screen allows on the free side of the thumbnail, never cropped, gone when the pointer leaves.
// Phone: long press ~450 ms → the picture almost full screen; a tap anywhere closes it, and the tap
// that ends the press does not also open the work. Full image via `imageUrl()`, thumb as placeholder.
// `tapOpens` (Pem 2026-11-14, Journal « À revoir »): a tap / click shows the picture full screen too,
// instead of following a link — for places where leaving the page is not wanted.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { imageUrl, thumbUrl } from '@/lib/data'

const HOVER_MS = 350
const HOLD_MS = 450
const MOVE_PX = 10
const GAP = 16

export function ImageLoupe({
  file,
  alt,
  children,
  style,
  tapOpens = false,
  caption,
}: {
  file: string
  alt: string
  children: ReactNode
  style?: CSSProperties
  tapOpens?: boolean
  /** R4 (Pem 2026-11-17): the picture comes with its caption (`#id` · title · year · technique…). */
  caption?: ReactNode
}) {
  const [open, setOpen] = useState<null | { mode: 'hover'; rect: DOMRect } | { mode: 'hold' }>(null)
  const box = useRef<HTMLDivElement | null>(null)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swallow = useRef(false)

  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])

  // Held loupe: any tap closes it (registered after the press that opened it). B13 (Pem 2026-11-16): the list
  // under it must not scroll while it is up — a finger still down after the hold used to scroll the Inventory
  // underneath; and if anything scrolls anyway, the loupe closes.
  useEffect(() => {
    if (open?.mode !== 'hold') return
    const close = () => setOpen(null)
    const freeze = (e: TouchEvent) => e.preventDefault()
    const id = window.setTimeout(() => document.addEventListener('pointerdown', close, { once: true }), 0)
    document.addEventListener('touchmove', freeze, { passive: false })
    window.addEventListener('scroll', close, { capture: true, passive: true })
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('touchmove', freeze)
      window.removeEventListener('scroll', close, { capture: true })
    }
  }, [open])

  // B13: the loupe is a portal, so React bubbles its events into this box. Only events on the thumbnail itself
  // count — a tap on the open loupe used to re-arm the long press, and the loupe came back 450 ms after closing.
  const own = (e: { target: EventTarget }) => box.current?.contains(e.target as Node) ?? false

  return (
    <div
      ref={box}
      style={{ WebkitTouchCallout: 'none', userSelect: 'none', ...(tapOpens ? { cursor: 'zoom-in' } : {}), ...style }}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        clear()
        timer.current = window.setTimeout(() => {
          const rect = box.current?.getBoundingClientRect()
          if (rect) setOpen({ mode: 'hover', rect })
        }, HOVER_MS)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return
        clear()
        setOpen((o) => (o?.mode === 'hover' ? null : o))
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' || !own(e)) return
        swallow.current = false
        start.current = { x: e.clientX, y: e.clientY }
        clear()
        timer.current = window.setTimeout(() => {
          swallow.current = true
          setOpen({ mode: 'hold' })
        }, HOLD_MS)
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_PX) {
          clear()
          start.current = null
        }
      }}
      onPointerUp={() => {
        clear()
        start.current = null
      }}
      onPointerCancel={() => {
        clear()
        start.current = null
      }}
      onContextMenu={(e) => {
        if (swallow.current || open) e.preventDefault()
      }}
      onClickCapture={(e) => {
        if (!own(e)) return
        if (swallow.current) {
          e.preventDefault()
          e.stopPropagation()
          swallow.current = false
          return
        }
        if (tapOpens) {
          e.preventDefault()
          e.stopPropagation()
          clear()
          setOpen({ mode: 'hold' })
        }
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {children}
      {open && typeof document !== 'undefined'
        ? createPortal(<LoupeView file={file} alt={alt} open={open} caption={caption} />, document.body)
        : null}
    </div>
  )
}

const CAPTION: CSSProperties = {
  background: 'var(--bg0)',
  border: '1px solid var(--bd)',
  color: 'var(--tx)',
  padding: '7px 10px',
  fontSize: 13,
  lineHeight: 1.35,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

export type LoupeOpen = { mode: 'hover'; rect: DOMRect } | { mode: 'hold' }

/** The picture as large as the screen allows (+ its caption). Shared by `ImageLoupe` and `WorkRef`. */
export function LoupeView({ file, alt, open, caption }: { file: string | null; alt: string; open: LoupeOpen; caption?: ReactNode }) {
  const src = file ? (imageUrl(file) ?? undefined) : undefined
  const placeholder = file ? thumbUrl(file) : null
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (open.mode === 'hold') {
    return (
      <div
        data-testid="image-loupe"
        style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 'max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px))' }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 image, full size for the loupe
          <img src={src} alt={alt} style={{ maxWidth: '100%', minHeight: 0, flex: '0 1 auto', maxHeight: caption ? 'calc(100% - 80px)' : '100%', objectFit: 'contain', background: placeholder ? `center / contain no-repeat url("${placeholder}")` : undefined }} />
        ) : null}
        {caption ? <div data-testid="image-loupe-caption" style={{ ...CAPTION, width: 'min(100%, 520px)' }}>{caption}</div> : null}
      </div>
    )
  }

  // Hover: the larger free side (right or left of the thumbnail), full height, picture contained.
  const r = open.rect
  const rightRoom = vw - r.right - GAP * 2
  const leftRoom = r.left - GAP * 2
  const onRight = rightRoom >= leftRoom
  const width = Math.max(onRight ? rightRoom : leftRoom, 200)
  const area: CSSProperties = {
    position: 'fixed',
    top: GAP,
    height: vh - GAP * 2,
    width,
    left: onRight ? r.right + GAP : Math.max(GAP, r.left - GAP - width),
  }
  return (
    <div data-testid="image-loupe" style={{ ...area, zIndex: 400, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: onRight ? 'flex-start' : 'flex-end', gap: 8 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- R2 image, full size for the loupe
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: '100%',
            minHeight: 0,
            maxHeight: caption ? 'calc(100% - 80px)' : '100%',
            objectFit: 'contain',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
            border: '1px solid var(--bd)',
            background: placeholder ? `var(--bg0) center / contain no-repeat url("${placeholder}")` : 'var(--bg0)',
          }}
        />
      ) : null}
      {caption ? <div data-testid="image-loupe-caption" style={{ ...CAPTION, maxWidth: 'min(100%, 520px)' }}>{caption}</div> : null}
    </div>
  )
}
