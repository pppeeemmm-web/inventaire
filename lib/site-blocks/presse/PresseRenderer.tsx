'use client'

import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type PresseRow = {
  source: string
  date: string
  excerpt_fr: string
  excerpt_en: string
  url: string
}

export type PresseFields = {
  rows: PresseRow[]
}

export const PRESSE_DEFAULTS: PresseFields = {
  rows: [],
}

/**
 * `presse` — press mentions / reviews. Rows of (source, date, FR/EN
 * excerpt, optional URL). Sorted date-desc on render. Empty rows
 * filtered out. About page only.
 */
export default function PresseRenderer({ fields }: BlockRendererProps<PresseFields>) {
  const { lang } = useI18n()
  const rows = useMemo(() => {
    return (fields.rows ?? [])
      .filter(r => r && (r.source || r.excerpt_fr || r.excerpt_en))
      .slice()
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [fields.rows])

  if (rows.length === 0) return null

  return (
    <div className="sb-presse" data-block-kind="presse">
      <style>{`
        .sb-presse {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          line-height: 1.6;
          max-width: 64ch;
          display: flex; flex-direction: column; gap: 18px;
        }
        .sb-presse-item {
          padding: 14px 16px;
          border-left: 2px solid currentColor;
          border-color: rgba(0,0,0,0.18);
        }
        .sb-presse-excerpt {
          font-family: 'Instrument Serif', serif;
          font-style: italic;
          font-size: 14px;
          line-height: 1.5;
          margin: 0 0 8px;
        }
        .sb-presse-attr {
          display: flex; flex-wrap: wrap; gap: 8px;
          font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
          opacity: 0.7;
        }
        .sb-presse-attr a {
          color: inherit; text-decoration: underline;
          text-underline-offset: 2px;
        }
        .sb-presse-sep { opacity: 0.5; }
      `}</style>
      {rows.map((r, i) => {
        const excerpt = lang === 'en'
          ? (r.excerpt_en || r.excerpt_fr)
          : (r.excerpt_fr || r.excerpt_en)
        return (
          <article key={i} className="sb-presse-item">
            {excerpt && <p className="sb-presse-excerpt">“{excerpt}”</p>}
            <div className="sb-presse-attr">
              {r.source && (
                r.url
                  ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.source}</a>
                  : <span>{r.source}</span>
              )}
              {r.source && r.date && <span className="sb-presse-sep">·</span>}
              {r.date && <span>{r.date}</span>}
            </div>
          </article>
        )
      })}
    </div>
  )
}
