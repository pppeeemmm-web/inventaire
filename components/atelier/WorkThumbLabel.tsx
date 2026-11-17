'use client'

// R4 preview rule for rows that are buttons (Build v2, 2026-11-17): a link can't sit inside a button, so the row
// keeps its own click and gets the thumbnail + `#id` title (« Sans titre · year · technique » when it has none);
// the loupe with its caption sits on the thumbnail — hover (computer) / hold (phone). A hold does not also press
// the row (`ImageLoupe` swallows that click). Use `WorkChip` / `WorkRef` where the row can be a link.

import type { CSSProperties, ReactNode } from 'react'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { WorkCaption, useWorkPreview } from '@/components/atelier/WorkChip'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { untitledLine } from '@/lib/work-preview-cache'

/** The thumbnail alone, with the loupe + caption on it (lists of thumbnails, number shown elsewhere). */
export function WorkLoupeThumb({ id, image, title, px = 32, style }: { id: number; image?: string | null; title?: string | null; px?: number; style?: CSSProperties }) {
  const known = image !== undefined
  const p = useWorkPreview(id, known)
  const file = known ? image : (p?.image ?? null)
  const src = file ? thumbUrl(file) : null
  const box: CSSProperties = { width: px, height: px, borderRadius: 2, flex: 'none', ...style }
  if (!file || !src) return <span aria-hidden style={{ ...box, background: 'var(--bg3)', display: 'inline-block' }} />
  return (
    <ImageLoupe file={file} alt={title ?? `#${id}`} caption={<WorkCaption id={id} />} style={{ display: 'inline-flex', flex: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- R2 thumbnail */}
      <img src={src} alt="" width={px} height={px} loading="lazy" style={{ ...box, objectFit: 'cover', display: 'block' }} />
    </ImageLoupe>
  )
}

/**
 * Thumbnail (loupe) + `#id` + title, laid out as siblings for the caller's flex row. `title` / `image` given:
 * nothing fetched until the loupe opens, except for untitled works (one batched call for « Sans titre · … »).
 */
export function WorkThumbLabel({
  id,
  title,
  image,
  px = 32,
  sub,
  wrap = false,
  idStyle,
}: {
  id: number
  title?: string | null
  image?: string | null
  px?: number
  /** A quiet second line under the title. */
  sub?: ReactNode
  /** Let the title wrap (default: one line, ellipsis). */
  wrap?: boolean
  idStyle?: CSSProperties
}) {
  const { t } = useI18n()
  const named = !!title?.trim()
  const p = useWorkPreview(id, named && image !== undefined)
  const name = title?.trim() || p?.title || null
  const file = image !== undefined ? image : (p?.image ?? null)
  return (
    <>
      <WorkLoupeThumb id={id} image={file} title={name} px={px} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: wrap ? undefined : 'ellipsis', whiteSpace: wrap ? undefined : 'nowrap', overflowWrap: wrap ? 'anywhere' : undefined }}>
        <span style={{ fontWeight: 700, color: 'var(--tx2)', ...idStyle }}>#{id}</span>{' '}
        {/* Title not given and preview still loading → « … », not a false « Sans titre ». */}
        {name ? <span>{name}</span> : <span style={{ color: 'var(--tx3)' }}>{p === undefined && title === undefined ? '…' : untitledLine(p, t('wr_untitled'))}</span>}
        {sub ? <span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)', whiteSpace: 'normal' }}>{sub}</span> : null}
      </span>
    </>
  )
}
