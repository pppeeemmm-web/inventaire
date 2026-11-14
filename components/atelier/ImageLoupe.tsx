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
}: {
  file: string
  alt: string
  children: ReactNode
  style?: CSSProperties
  tapOpens?: boolean
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

  // Held loupe: any tap closes it (registered after the press that opened it).
  useEffect(() => {
    if (open?.mode !== 'hold') return
    const close = () => setOpen(null)
    const id = window.setTimeout(() => document.addEventListener('pointerdown', close, { once: true }), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', close)
    }
  }, [open])

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
        if (e.pointerType === 'mouse') return
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
        ? createPortal(<LoupeView file={file} alt={alt} open={open} />, document.body)
        : null}
    </div>
  )
}

function LoupeView({ file, alt, open }: { file: string; alt: string; open: { mode: 'hover'; rect: DOMRect } | { mode: 'hold' } }) {
  const src = imageUrl(file) ?? undefined
  const placeholder = thumbUrl(file)
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (open.mode === 'hold') {
    return (
      <div
        data-testid="image-loupe"
        style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- R2 image, full size for the loupe */}
        <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: placeholder ? `center / contain no-repeat url("${placeholder}")` : undefined }} />
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
    <div data-testid="image-loupe" style={{ ...area, zIndex: 400, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: onRight ? 'flex-start' : 'flex-end' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- R2 image, full size for the loupe */}
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          border: '1px solid var(--bd)',
          background: placeholder ? `var(--bg0) center / contain no-repeat url("${placeholder}")` : 'var(--bg0)',
        }}
      />
    </div>
  )
}
