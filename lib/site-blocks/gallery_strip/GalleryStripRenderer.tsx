'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type GalleryStripItem = {
  url: string
}

export type GalleryStripFields = {
  items: GalleryStripItem[]
  caption_fr: string
  caption_en: string
}

export const GALLERY_STRIP_DEFAULTS: GalleryStripFields = {
  items: [],
  caption_fr: '',
  caption_en: '',
}

/**
 * `gallery_strip` — horizontal scrollable row of images.
 *
 * Phase 1: URL-paste per image. Each item holds a URL; the strip renders as a
 * scrollable flex row. A future phase may replace URL inputs with an R2-backed
 * work picker (see HANDOFF_SITE_BLOCKS_2.md §4 item 1).
 */
export default function GalleryStripRenderer({ fields }: BlockRendererProps<GalleryStripFields>) {
  const { lang } = useI18n()

  const visibleItems = (fields.items ?? []).filter(it => it.url && it.url.trim())
  if (visibleItems.length === 0) return null

  const caption = lang === 'en'
    ? (fields.caption_en || fields.caption_fr)
    : (fields.caption_fr || fields.caption_en)

  return (
    <figure className="sb-gs" data-block-kind="gallery_strip">
      <style>{`
        .sb-gs {
          margin: clamp(16px, 3vw, 32px) 0;
          padding: 0;
        }
        .sb-gs-track {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          /* hide scrollbar in WebKit while keeping scroll */
          scrollbar-width: thin;
          scrollbar-color: var(--bd2) transparent;
          padding-bottom: 4px;
        }
        .sb-gs-track::-webkit-scrollbar {
          height: 4px;
        }
        .sb-gs-track::-webkit-scrollbar-track {
          background: transparent;
        }
        .sb-gs-track::-webkit-scrollbar-thumb {
          background: var(--bd2);
        }
        .sb-gs-item {
          flex: 0 0 auto;
          height: 220px;
        }
        .sb-gs-item img {
          display: block;
          height: 100%;
          width: auto;
          max-width: 400px;
          object-fit: cover;
        }
        .sb-gs figcaption {
          margin-top: 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 1px;
          opacity: 0.55;
          line-height: 1.5;
        }
      `}</style>
      <div className="sb-gs-track">
        {visibleItems.map((item, i) => (
          <div key={i} className="sb-gs-item">
            <img src={item.url} alt="" loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
      {caption && caption.trim() && (
        <figcaption>{caption}</figcaption>
      )}
    </figure>
  )
}
