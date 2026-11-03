'use client'

// Inventory → Couleurs: pick up to 5 colour-wheel families the cover image must contain,
// colours it must not contain ("Sans"), widen to nearby shades, and rank by coverage or
// monochrome first. Logic in `lib/colour-filter.ts`.

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { ColourFamily, ColourTone } from '@/lib/colour-families'
import {
  FAMILY_SWATCH,
  FILTER_FAMILIES,
  MAX_INCLUDED,
  type ColourQuery,
} from '@/lib/colour-filter'

export type ColourRank = 'match' | 'mono' | 'off'

export function ColourFilterPanel({
  query,
  setQuery,
  rank,
  setRank,
  catalogueMatches,
  loading,
  narrow,
}: {
  query: ColourQuery
  setQuery: (q: ColourQuery) => void
  rank: ColourRank
  setRank: (r: ColourRank) => void
  /** Matches across the whole catalogue (null while palettes load or when no filter). */
  catalogueMatches: number | null
  loading: boolean
  narrow: boolean
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'include' | 'exclude'>('include')

  function tap(f: ColourFamily) {
    const inc = query.include.includes(f)
    const exc = query.exclude.includes(f)
    if (mode === 'include') {
      if (inc) {
        const tones = { ...(query.tones ?? {}) }
        delete tones[f]
        setQuery({ ...query, include: query.include.filter((x) => x !== f), tones })
      } else if (query.include.length < MAX_INCLUDED) {
        setQuery({ ...query, include: [...query.include, f], exclude: query.exclude.filter((x) => x !== f) })
        if (rank === 'off') setRank('match')
      }
    } else if (exc) {
      setQuery({ ...query, exclude: query.exclude.filter((x) => x !== f) })
    } else {
      setQuery({ ...query, exclude: [...query.exclude, f], include: query.include.filter((x) => x !== f) })
    }
  }

  const full = mode === 'include' && query.include.length >= MAX_INCLUDED
  const segBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: 12,
    minHeight: narrow ? 44 : 36,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--bg2)' : 'transparent',
    color: active ? 'var(--tx)' : 'var(--tx3)',
  })

  return (
    <div
      data-testid="inv-colour-panel"
      style={{
        padding: narrow ? '10px 12px' : '12px 28px',
        borderBottom: '1px solid var(--bd)',
        background: 'var(--bg1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div role="group" aria-label={t('inv_colour_mode_aria')} style={{ display: 'flex', border: '1px solid var(--bd)' }}>
          <button type="button" aria-pressed={mode === 'include'} style={segBtn(mode === 'include')} onClick={() => setMode('include')}>
            {t('inv_colour_mode_include')}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'exclude'}
            data-testid="inv-colour-exclude-mode"
            style={{ ...segBtn(mode === 'exclude'), borderLeft: '1px solid var(--bd)', color: mode === 'exclude' ? 'var(--rust)' : 'var(--tx3)' }}
            onClick={() => setMode('exclude')}
          >
            {t('inv_colour_mode_exclude')}
          </button>
        </div>
        <label title={t('inv_colour_nearby_title')} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={query.nearby} onChange={(e) => setQuery({ ...query, nearby: e.target.checked })} />
          {t('inv_colour_nearby')}
        </label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--tx2)' }}>
          {t('inv_colour_rank_label')}
          <select className="input" style={{ fontSize: 12 }} value={rank} onChange={(e) => setRank(e.target.value as ColourRank)}>
            <option value="match">{t('inv_colour_rank_match')}</option>
            <option value="mono">{t('inv_colour_rank_mono')}</option>
            <option value="off">{t('inv_colour_rank_off')}</option>
          </select>
        </label>
        <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: narrow ? 0 : 'auto' }}>
          {loading
            ? t('inv_colour_loading')
            : catalogueMatches != null
              ? t('inv_colour_count_fmt').replace('{n}', String(catalogueMatches))
              : t('inv_colour_hint')}
        </span>
        {query.include.length + query.exclude.length > 0 ? (
          <button type="button" className="btn ghost sm" onClick={() => setQuery({ ...query, include: [], exclude: [], tones: {} })}>
            {t('inv_colour_clear')}
          </button>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {FILTER_FAMILIES.map((f) => {
          const inc = query.include.includes(f)
          const exc = query.exclude.includes(f)
          const label = t(`colour_family_${f}` as Parameters<typeof t>[0])
          return (
            <button
              key={f}
              type="button"
              data-testid={`inv-colour-chip-${f}`}
              aria-pressed={inc || exc}
              disabled={full && !inc && !exc}
              title={exc ? t('inv_colour_chip_without_fmt').replace('{c}', label) : label}
              onClick={() => tap(f)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                minHeight: narrow ? 44 : 36,
                fontSize: 12,
                cursor: 'pointer',
                background: inc ? 'var(--bg2)' : 'transparent',
                color: exc ? 'var(--tx3)' : 'var(--tx)',
                border: inc ? '1px solid var(--ac)' : exc ? '1px dashed var(--rust)' : '1px solid var(--bd)',
                textDecoration: exc ? 'line-through' : undefined,
                opacity: full && !inc && !exc ? 0.4 : 1,
              }}
            >
              <span
                aria-hidden
                style={{ width: 12, height: 12, borderRadius: '50%', background: FAMILY_SWATCH[f], border: '1px solid var(--bd)', flexShrink: 0 }}
              />
              {exc ? `− ${label}` : label}
            </button>
          )
        })}
      </div>

      {/* Refine: light or dark shades of an included colour (neutrals are already a lightness). */}
      {query.include.some((f) => !NEUTRALS.has(f)) ? (
        <div data-testid="inv-colour-refine" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span className="t-label" title={t('inv_colour_refine_title')}>{t('inv_colour_refine')}</span>
          {query.include.filter((f) => !NEUTRALS.has(f)).map((f) => {
            const cur = query.tones?.[f] ?? 'any'
            const label = t(`colour_family_${f}` as Parameters<typeof t>[0])
            const pick = (v: 'any' | ColourTone) => {
              const tones = { ...(query.tones ?? {}) }
              if (v === 'any') delete tones[f]
              else tones[f] = v
              setQuery({ ...query, tones })
            }
            return (
              <div key={f} role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--bd)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 8px', fontSize: 12 }}>
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: FAMILY_SWATCH[f] }} />
                  {label}
                </span>
                {(['any', 'light', 'dark'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={cur === v}
                    data-testid={`inv-colour-tone-${f}-${v}`}
                    onClick={() => pick(v)}
                    style={{ ...segBtn(cur === v), borderLeft: '1px solid var(--bd)' }}
                  >
                    {v === 'any' ? t('inv_colour_tone_any') : v === 'light' ? t('inv_colour_tone_light') : t('inv_colour_tone_dark')}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

const NEUTRALS = new Set<ColourFamily>(['black', 'grey', 'white'])
