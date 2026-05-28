'use client'

import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type ThemesFields = {
  /** Theme labels, displayed as a chip row. */
  themes: string[]
}

export const THEMES_DEFAULTS: ThemesFields = {
  themes: [],
}

/**
 * `themes` — recurring subjects/motifs in the practice. Displayed as a
 * row of small chips. About page.
 */
export default function ThemesRenderer({ fields }: BlockRendererProps<ThemesFields>) {
  const themes = (fields.themes ?? []).filter(t => typeof t === 'string' && t.trim().length > 0)
  if (themes.length === 0) return null
  return (
    <div className="sb-themes" data-block-kind="themes">
      <style>{`
        .sb-themes {
          display: flex; flex-wrap: wrap; gap: 8px;
        }
        .sb-themes-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
          padding: 6px 10px;
          border: 1px solid currentColor;
          opacity: 0.7;
        }
      `}</style>
      {themes.map((t, i) => (
        <span key={`${t}-${i}`} className="sb-themes-chip">{t}</span>
      ))}
    </div>
  )
}
