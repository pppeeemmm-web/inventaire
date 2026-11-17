'use client'

// R4 preview rule (Pem 2026-11-17): « a work number never travels alone ». A work named by its number shows
// its thumbnail and its title (« Sans titre · 2024 · huile » when it has none); holding it (phone) or hovering
// it (desktop) shows the picture large with its caption. A tap / click still goes where the place sent it.
// Two shapes here — `row` (40 px thumbnail, 44 px tall on the phone) and `chip` (24 px, dense places);
// inside a sentence use `WorkRef` (16 px thumbnail).

import Link from 'next/link'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { loadWorkPreview, untitledLine } from '@/lib/work-preview-cache'
import type { WorkPreview } from '@/app/atelier/works/preview-actions'

/**
 * The loupe's caption: `#id` title, then year · technique · size · status. Mounted only while the loupe is
 * open; with no preview passed it reads its own (rows that already know title + image fetch nothing until then).
 */
export function WorkCaption({ p: given, id }: { p?: WorkPreview | null; id: number }) {
  const { t } = useI18n()
  const own = useWorkPreview(id, given !== undefined)
  const p = given !== undefined ? given : own
  if (p === undefined) return <span style={{ color: 'var(--tx3)' }}>#{id} …</span>
  if (p === null) return <span style={{ color: 'var(--tx3)' }}>#{id} · {t('wr_not_found')}</span>
  const sub = [p.year, p.technique, p.size ? `${p.size} cm` : null, p.status].filter(Boolean).join(' · ')
  return (
    <>
      <b>#{p.id}</b> {p.title ?? <span style={{ color: 'var(--tx2)' }}>{t('wr_untitled')}</span>}
      {sub ? <span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{sub}</span> : null}
    </>
  )
}

/** Reads the preview from the session cache (one batched call per render burst). */
export function useWorkPreview(id: number, skip = false): WorkPreview | null | undefined {
  const [p, setP] = useState<WorkPreview | null | undefined>(undefined)
  useEffect(() => {
    if (skip) return
    let alive = true
    void loadWorkPreview(id).then((r) => {
      if (alive) setP(r)
    })
    return () => {
      alive = false
    }
  }, [id, skip])
  return p
}

export function WorkChip({
  id,
  size = 'row',
  href = `/atelier/inventory?work=${id}`,
  sub,
  title,
  image,
  stopPropagation,
  testId,
  style,
}: {
  id: number
  size?: 'row' | 'chip'
  href?: string
  /** A quiet second line (row) — e.g. the changed fields, « ✦ suggestion ». */
  sub?: ReactNode
  /** Known already (both given): shown at once, no request until the loupe opens. */
  title?: string | null
  image?: string | null
  stopPropagation?: boolean
  testId?: string
  style?: CSSProperties
}) {
  const { t } = useI18n()
  // Known title + image: nothing to fetch until the loupe opens. Untitled works still fetch (one batched
  // call) for « Sans titre · year · technique ».
  const known = title !== undefined && image !== undefined && !!title?.trim()
  const p = useWorkPreview(id, known)
  const name = p?.title ?? (title?.trim() || null)
  const file = p?.image ?? image ?? null
  const px = size === 'chip' ? 24 : 40
  const src = file ? thumbUrl(file) : null

  const thumb = src ? (
    // eslint-disable-next-line @next/next/no-img-element -- R2 thumbnail, like the Inventory row
    <img src={src} alt="" width={px} height={px} loading="lazy" style={{ width: px, height: px, objectFit: 'cover', borderRadius: 3, flex: 'none', border: '1px solid var(--bd)', background: 'var(--bg2)' }} />
  ) : (
    <span aria-hidden style={{ width: px, height: px, borderRadius: 3, flex: 'none', background: 'var(--bg2)', border: '1px solid var(--bd)' }} />
  )

  const label = (
    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: size === 'chip' ? 'ellipsis' : undefined, whiteSpace: size === 'chip' ? 'nowrap' : undefined }}>
      <span style={{ color: 'var(--tx3)', fontWeight: 600 }}>#{id}</span>{' '}
      {name ? <span>{name}</span> : <span style={{ color: 'var(--tx3)' }}>{untitledLine(p, t('wr_untitled'))}</span>}
      {sub && size === 'row' ? <span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)' }}>{sub}</span> : null}
    </span>
  )

  const link = (
    <Link
      href={href}
      data-testid={testId}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      style={{
        display: size === 'chip' ? 'inline-flex' : 'flex',
        alignItems: 'center',
        gap: size === 'chip' ? 6 : 10,
        minWidth: 0,
        maxWidth: size === 'chip' ? 240 : undefined,
        minHeight: size === 'chip' ? 28 : 44,
        fontSize: size === 'chip' ? 12 : 13,
        lineHeight: 1.3,
        color: 'var(--tx)',
        textDecoration: 'none',
        WebkitTouchCallout: 'none',
        ...style,
      }}
    >
      {thumb}
      {label}
    </Link>
  )

  if (!file) return link
  return (
    <ImageLoupe file={file} alt={name ?? `#${id}`} caption={<WorkCaption p={known ? undefined : p} id={id} />} style={{ minWidth: 0, display: size === 'chip' ? 'inline-flex' : 'block' }}>
      {link}
    </ImageLoupe>
  )
}
