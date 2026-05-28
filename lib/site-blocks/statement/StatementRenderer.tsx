'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type StatementFields = {
  quote_fr: string
  quote_en: string
  attribution_fr: string
  attribution_en: string
}

export const STATEMENT_DEFAULTS: StatementFields = {
  quote_fr: '',
  quote_en: '',
  attribution_fr: '',
  attribution_en: '',
}

/**
 * `statement` — pulled-out quote in display-serif. Universal block,
 * landing-page-friendly for an opening manifesto or any-page emphasis
 * between paragraphs.
 */
export default function StatementRenderer({ fields }: BlockRendererProps<StatementFields>) {
  const { lang } = useI18n()
  const quote = lang === 'en'
    ? (fields.quote_en || fields.quote_fr)
    : (fields.quote_fr || fields.quote_en)
  const attribution = lang === 'en'
    ? (fields.attribution_en || fields.attribution_fr)
    : (fields.attribution_fr || fields.attribution_en)

  if (!quote || !quote.trim()) return null

  return (
    <figure className="sb-stmt" data-block-kind="statement">
      <style>{`
        .sb-stmt {
          margin: clamp(20px, 4vw, 40px) 0;
          padding: 0;
          max-width: 56ch;
        }
        .sb-stmt-q {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(18px, 2.6vw, 26px);
          line-height: 1.35;
          font-style: italic;
          margin: 0;
        }
        .sb-stmt-a {
          margin-top: 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.6;
        }
      `}</style>
      <blockquote className="sb-stmt-q">{quote}</blockquote>
      {attribution && attribution.trim() && (
        <figcaption className="sb-stmt-a">— {attribution}</figcaption>
      )}
    </figure>
  )
}
