'use client'

// `#1234` work link (owner 2026-11-12). R4 (Pem 2026-11-17): a work number never travels alone — a 16 px
// thumbnail before the number, and hover ~300 ms (desktop) / hold ~450 ms (phone) shows the picture large
// with its caption (`#id` title · year · technique · size · status): one gesture, the same as on a thumbnail
// (`ImageLoupe`); the small card is gone. A click / tap still goes where each place sent it before (`href`).
// Previews come from the session cache, one batched call per render burst (`lib/work-preview-cache.ts`).

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LoupeView, type LoupeOpen } from '@/components/atelier/ImageLoupe'
import { WorkCaption, useWorkPreview } from '@/components/atelier/WorkChip'
import { thumbUrl } from '@/lib/data'

const HOVER_MS = 300
const HOLD_MS = 450
const MOVE_PX = 10

export function WorkRef({
  id,
  href = `/atelier/inventory?work=${id}`,
  className,
  style,
  children,
  testId,
  ariaLabel,
  stopPropagation,
  thumb = true,
}: {
  id: number
  href?: string
  className?: string
  style?: CSSProperties
  /** Defaults to `#id` + title. */
  children?: ReactNode
  testId?: string
  ariaLabel?: string
  /** Inside a clickable row: the link opens the work, not the row. */
  stopPropagation?: boolean
  /** The 16 px thumbnail before the number (off where a picture already sits beside it). */
  thumb?: boolean
}) {
  const [open, setOpen] = useState<LoupeOpen | null>(null)
  const data = useWorkPreview(id)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swallowClick = useRef(false)
  const anchor = useRef<HTMLAnchorElement | null>(null)

  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }

  const show = useCallback((mode: 'hover' | 'hold') => {
    if (mode === 'hold') {
      setOpen({ mode: 'hold' })
      return
    }
    const r = anchor.current?.getBoundingClientRect()
    if (r) setOpen({ mode: 'hover', rect: r })
  }, [])

  // A tap anywhere else closes the held loupe.
  useEffect(() => {
    if (open?.mode !== 'hold') return
    const close = () => setOpen(null)
    const tid = window.setTimeout(() => document.addEventListener('pointerdown', close, { once: true }), 0)
    return () => {
      window.clearTimeout(tid)
      document.removeEventListener('pointerdown', close)
    }
  }, [open])
  useEffect(() => clear, [])

  const src = thumb && data?.image ? thumbUrl(data.image) : null

  return (
    <>
      <Link
        ref={anchor}
        href={href}
        className={className}
        data-testid={testId}
        aria-label={ariaLabel}
        style={{ WebkitTouchCallout: 'none', ...style }}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse') return
          clear()
          timer.current = window.setTimeout(() => show('hover'), HOVER_MS)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return
          clear()
          if (open?.mode === 'hover') setOpen(null)
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          start.current = { x: e.clientX, y: e.clientY }
          clear()
          timer.current = window.setTimeout(() => {
            swallowClick.current = true
            show('hold')
          }, HOLD_MS)
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_PX) {
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
          if (open?.mode === 'hold' || swallowClick.current) e.preventDefault()
        }}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
          if (swallowClick.current) {
            e.preventDefault()
            swallowClick.current = false
          }
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 thumbnail, 16 px before the number
          <img
            src={src}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            style={{ width: 16, height: 16, objectFit: 'cover', borderRadius: 2, verticalAlign: '-3px', marginRight: 4 }}
          />
        ) : null}
        {children ?? (
          <>
            #{id}
            {data?.title ? ` ${data.title}` : ''}
          </>
        )}
      </Link>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <LoupeView file={data?.image ?? null} alt={data?.title ?? `#${id}`} open={open} caption={<WorkCaption p={data} id={id} />} />,
            document.body,
          )
        : null}
    </>
  )
}
