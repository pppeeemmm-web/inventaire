'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type ImageFields = {
  /** Fully-qualified https:// URL or /r2-proxy/... path. */
  url: string
  alt_fr: string
  alt_en: string
  caption_fr: string
  caption_en: string
}

export const IMAGE_DEFAULTS: ImageFields = {
  url: '',
  alt_fr: '',
  alt_en: '',
  caption_fr: '',
  caption_en: '',
}

/**
 * `image` — single image with optional caption. URL-paste variant (Phase 1).
 * A future phase may add R2-backed work picker as an alternative input path.
 */
export default function ImageRenderer({ fields }: BlockRendererProps<ImageFields>) {
  const { lang } = useI18n()
  if (!fields.url || !fields.url.trim()) return null

  const alt = lang === 'en'
    ? (fields.alt_en || fields.alt_fr)
    : (fields.alt_fr || fields.alt_en)
  const caption = lang === 'en'
    ? (fields.caption_en || fields.caption_fr)
    : (fields.caption_fr || fields.caption_en)

  return (
    <figure className="sb-img" data-block-kind="image">
      <style>{`
        .sb-img {
          margin: clamp(16px, 3vw, 32px) 0;
          padding: 0;
          max-width: 100%;
        }
        .sb-img-wrap {
          position: relative;
          display: block;
          width: 100%;
        }
        .sb-img-wrap img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }
        .sb-img figcaption {
          margin-top: 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 1px;
          opacity: 0.55;
          line-height: 1.5;
        }
      `}</style>
      <div className="sb-img-wrap">
        <img src={fields.url} alt={alt || ''} loading="lazy" decoding="async" />
      </div>
      {caption && caption.trim() && (
        <figcaption>{caption}</figcaption>
      )}
    </figure>
  )
}
