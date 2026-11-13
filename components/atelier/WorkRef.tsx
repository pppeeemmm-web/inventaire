'use client'

// `#1234` work link with a preview (owner 2026-11-12): hover ~300 ms on desktop, hold ~450 ms on a
// phone — thumbnail, title, year, technique, status — without opening the drawer. A click / tap
// still goes where each place sent it before (`href`). Previews are cached for the session.

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { fetchWorkPreview, type WorkPreview } from '@/app/atelier/works/preview-actions'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'

const cache = new Map<number, Promise<WorkPreview | null>>()
function loadPreview(id: number) {
  let p = cache.get(id)
  if (!p) {
    p = fetchWorkPreview(id).catch(() => null)
    cache.set(id, p)
  }
  return p
}

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
}: {
  id: number
  href?: string
  className?: string
  style?: CSSProperties
  /** Defaults to `#id`. */
  children?: ReactNode
  testId?: string
  ariaLabel?: string
  /** Inside a clickable row: the link opens the work, not the row. */
  stopPropagation?: boolean
}) {
  const [open, setOpen] = useState<'hover' | 'hold' | null>(null)
  const [data, setData] = useState<WorkPreview | null | undefined>(undefined)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swallowClick = useRef(false)
  const anchor = useRef<HTMLAnchorElement | null>(null)

  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }

  const show = useCallback(
    (mode: 'hover' | 'hold') => {
      const r = anchor.current?.getBoundingClientRect()
      if (r) setPos({ x: r.left, y: r.bottom })
      setOpen(mode)
      void loadPreview(id).then(setData)
    },
    [id],
  )

  // A tap anywhere else closes the held card.
  useEffect(() => {
    if (open !== 'hold') return
    const close = () => setOpen(null)
    const tid = window.setTimeout(() => document.addEventListener('pointerdown', close, { once: true }), 0)
    return () => {
      window.clearTimeout(tid)
      document.removeEventListener('pointerdown', close)
    }
  }, [open])
  useEffect(() => clear, [])

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
          if (open === 'hover') setOpen(null)
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
          if (open === 'hold' || swallowClick.current) e.preventDefault()
        }}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
          if (swallowClick.current) {
            e.preventDefault()
            swallowClick.current = false
          }
        }}
      >
        {children ?? `#${id}`}
      </Link>
      {open && pos ? <PreviewCard data={data} pos={pos} sheet={open === 'hold'} /> : null}
    </>
  )
}

function PreviewCard({ data, pos, sheet }: { data: WorkPreview | null | undefined; pos: { x: number; y: number }; sheet: boolean }) {
  const { t } = useI18n()
  const src = data ? thumbUrl(data.image) : null
  const box: CSSProperties = sheet
    ? { position: 'fixed', left: 12, right: 12, bottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }
    : { position: 'fixed', left: Math.min(pos.x, window.innerWidth - 300), top: Math.min(pos.y + 6, window.innerHeight - 140), width: 288 }
  return (
    <div
      role="tooltip"
      data-testid="work-ref-preview"
      style={{
        ...box,
        zIndex: 300,
        background: 'var(--bg0)',
        border: '1px solid var(--bd)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
        padding: 10,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      {data === undefined ? (
        <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>…</span>
      ) : data === null ? (
        <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('wr_not_found')}</span>
      ) : (
        <>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- R2 thumbnail, same as the inventory list
            <img src={src} alt="" width={96} height={96} style={{ width: 96, height: 96, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} />
          ) : null}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>
              #{data.id} {data.title?.trim() || t('wr_untitled')}
            </div>
            <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>
              {[data.year, data.technique].filter(Boolean).join(' · ') || '—'}
            </div>
            {data.status ? <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{data.status}</div> : null}
          </div>
        </>
      )}
    </div>
  )
}
