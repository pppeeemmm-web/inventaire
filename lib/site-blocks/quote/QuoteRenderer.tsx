'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type QuoteFields = {
  quote_fr: string
  quote_en: string
  attribution_fr: string
  attribution_en: string
  /** Optional URL linking the attribution (source article, interview, etc.). */
  source_url: string
}

export const QUOTE_DEFAULTS: QuoteFields = {
  quote_fr: '',
  quote_en: '',
  attribution_fr: '',
  attribution_en: '',
  source_url: '',
}

/**
 * `quote` — pulled-out quote with optional source URL on the attribution.
 * Sister to `statement`: same display-serif italic, but the attribution
 * can link to an external source.
 */
export default function QuoteRenderer({ fields }: BlockRendererProps<QuoteFields>) {
  const { lang } = useI18n()
  const quote = lang === 'en'
    ? (fields.quote_en || fields.quote_fr)
    : (fields.quote_fr || fields.quote_en)
  const attribution = lang === 'en'
    ? (fields.attribution_en || fields.attribution_fr)
    : (fields.attribution_fr || fields.attribution_en)

  if (!quote || !quote.trim()) return null

  const hasUrl = fields.source_url && fields.source_url.trim()
  const attrNode = attribution && attribution.trim()
    ? (hasUrl
        ? <a href={fields.source_url} target="_blank" rel="noopener noreferrer" className="sb-q-src">
            — {attribution}
          </a>
        : <span>— {attribution}</span>
      )
    : null

  return (
    <figure className="sb-quote" data-block-kind="quote">
      <style>{`
        .sb-quote {
          margin: clamp(20px, 4vw, 40px) 0;
          padding: 0;
          max-width: 56ch;
        }
        .sb-quote-q {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(18px, 2.6vw, 26px);
          line-height: 1.35;
          font-style: italic;
          margin: 0;
        }
        .sb-quote-a {
          margin-top: 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.6;
        }
        .sb-q-src {
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 3px;
          opacity: 0.6;
        }
        .sb-q-src:hover { opacity: 1; }
      `}</style>
      <blockquote className="sb-quote-q">{quote}</blockquote>
      {attrNode && (
        <figcaption className="sb-quote-a">{attrNode}</figcaption>
      )}
    </figure>
  )
}
