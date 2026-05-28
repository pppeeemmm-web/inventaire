'use client'

import { useMemo } from 'react'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type ExpositionRow = {
  year: string
  title: string
  venue: string
}

export type ExpositionsFields = {
  rows: ExpositionRow[]
}

export const EXPOSITIONS_DEFAULTS: ExpositionsFields = {
  rows: [],
}

/**
 * `expositions` — exhibition history. Rows of (year, title, venue), sorted
 * year-descending on render so the most recent show is on top. Empty
 * rows are filtered out. About page only.
 */
export default function ExpositionsRenderer({ fields }: BlockRendererProps<ExpositionsFields>) {
  const rows = useMemo(() => {
    return (fields.rows ?? [])
      .filter(r => r && (r.year || r.title || r.venue))
      .slice()
      .sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''))
  }, [fields.rows])

  if (rows.length === 0) return null

  return (
    <div className="sb-exp" data-block-kind="expositions">
      <style>{`
        .sb-exp {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          line-height: 1.6;
          max-width: 64ch;
        }
        .sb-exp-list { display: flex; flex-direction: column; }
        .sb-exp-row {
          display: grid;
          grid-template-columns: 60px 1fr;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid currentColor;
          border-color: rgba(0,0,0,0.08);
        }
        .sb-exp-row:first-child { border-top: none; }
        .sb-exp-year {
          font-size: 10px;
          letter-spacing: 1.5px;
          opacity: 0.6;
          padding-top: 2px;
        }
        .sb-exp-title { display: block; font-style: italic; }
        .sb-exp-venue {
          display: block;
          font-size: 10px;
          opacity: 0.7;
          margin-top: 2px;
        }
      `}</style>
      <div className="sb-exp-list">
        {rows.map((r, i) => (
          <div key={i} className="sb-exp-row">
            <div className="sb-exp-year">{r.year || ''}</div>
            <div>
              {r.title && <span className="sb-exp-title">{r.title}</span>}
              {r.venue && <span className="sb-exp-venue">{r.venue}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
