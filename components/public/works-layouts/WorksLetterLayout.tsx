'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import type { Work, WorksMode } from '@/components/public/works-utils'
import type { WorksLightResolved } from '@/lib/works-mode-light'
import OutroCard from './OutroCard'

interface Props {
  works: Work[]
  mode: WorksMode
  bevelShadow: string | null
  light: WorksLightResolved
  siteTheme: PublicSiteTheme
}

/**
 * Letter / zine — paginated reader. One work per page, large image on top,
 * caption + year below. Arrow keys / on-screen buttons turn the page.
 * Slower, more contemplative than the carousel.
 */
export default function WorksLetterLayout({ works, mode, bevelShadow, light, siteTheme }: Props) {
  const { t, lang } = useI18n()
  const visible = useMemo(() => works.filter(w => w.txtImageNameLink), [works])
  const [page, setPage] = useState(0)
  const max = Math.max(0, visible.length - 1)
  const intensity = light.intensity
  const castShadowOn = mode.cast_shadow_enabled !== false
  const castDistance = mode.cast_shadow_distance_px ?? 15
  const castBlur = mode.cast_shadow_blur_px ?? 22
  const castShadowCss = castShadowOn
    ? `drop-shadow(0 ${castDistance}px ${castBlur}px rgba(15,15,20,${(0.34 * intensity).toFixed(3)})) `
      + `drop-shadow(0 ${Math.round(castDistance / 3.75)}px ${Math.round(castBlur / 3.14)}px rgba(15,15,20,${(0.22 * intensity).toFixed(3)}))`
    : 'none'

  const go = useCallback((delta: number) => {
    setPage(p => Math.max(0, Math.min(p + delta, max)))
  }, [max])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(1); e.preventDefault() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const current = visible[page]
  const hasOutro = Boolean((mode.outro_fr || mode.outro_en || '').trim())

  return (
    <>
      <style>{`
        .w-letter-wrap {
          position: relative;
          min-height: 100vh;
          background: ${siteTheme.backgroundCss};
          padding: clamp(80px, 10vh, 120px) clamp(16px, 4vw, 64px) 80px;
        }
        .w-letter-wrap::after {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background: ${light.tintRgba}; pointer-events: none;
        }
        .w-letter-page {
          position: relative; z-index: 1;
          max-width: 760px; margin: 0 auto;
          display: flex; flex-direction: column; align-items: center;
          gap: 24px;
          padding-bottom: 120px; /* reserve space for fixed nav */
        }
        /* Image slot has a stable minimum so the page chrome (title, dims, outro)
         * never jumps vertically when paging between landscape and portrait works. */
        .w-letter-slot {
          width: 100%;
          min-height: 64vh;
          display: flex; align-items: center; justify-content: center;
        }
        .w-letter-mount {
          display: inline-block; line-height: 0;
          max-width: 100%; max-height: 64vh;
          position: relative;
          filter: ${castShadowCss};
        }
        ${bevelShadow ? `
        .w-letter-mount::after {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none;
          box-shadow: ${bevelShadow};
        }
        ` : ''}
        .w-letter-img {
          max-width: 100%; max-height: 64vh;
          display: block; object-fit: contain;
        }
        .w-letter-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(22px, 3vw, 32px);
          color: ${siteTheme.bodyText};
          margin: 0; text-align: center; letter-spacing: 0.01em;
        }
        .w-letter-meta {
          font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText}; opacity: 0.75;
        }
        .w-letter-outro {
          margin-top: 32px; max-width: 560px;
          font-family: 'Instrument Serif', serif;
          font-size: 14px; color: ${siteTheme.bodyMutedText};
          line-height: 1.7; text-align: center;
        }
        .w-letter-nav {
          position: fixed;
          bottom: max(24px, env(safe-area-inset-bottom, 0px));
          left: 50%; transform: translateX(-50%);
          z-index: 250;
          display: flex; align-items: center; gap: 24px;
          padding: 6px 10px;
          background: transparent;
          font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText};
        }
        .w-letter-arrow {
          background: transparent;
          border: 1px solid ${siteTheme.chromeBorder};
          color: ${siteTheme.bodyText};
          width: 44px; height: 44px; border-radius: 50%;
          font-size: 16px; cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .w-letter-arrow:hover:not([disabled]) {
          background: rgba(0,0,0,0.04);
          border-color: ${siteTheme.bodyText};
        }
        .w-letter-arrow[disabled] { opacity: 0.3; cursor: default; }
      `}</style>
      <main className="w-letter-wrap" aria-label={t('pub_works')}>
        {current && (
          <article className="w-letter-page" key={current.OeuvreID}>
            <div className="w-letter-slot">
              <span className="w-letter-mount">
                <img
                  src={imageUrl(current.txtImageNameLink) ?? ''}
                  alt={current.Titre ?? ''}
                  className="w-letter-img"
                  draggable={false}
                />
              </span>
            </div>
            <h2 className="w-letter-title">{current.Titre ?? t('pub_untitled')}</h2>
            <div className="w-letter-meta">
              {[yearOf(current.Annee), current.Hauteur && current.Largeur ? `${current.Hauteur} × ${current.Largeur} cm` : null]
                .filter(Boolean).join(' · ')}
            </div>
            <div className="w-letter-nav">
              <button type="button" className="w-letter-arrow" onClick={() => go(-1)} disabled={page === 0} aria-label="←">←</button>
              <span>{page + 1} / {visible.length}</span>
              <button type="button" className="w-letter-arrow" onClick={() => go(1)} disabled={page === max} aria-label="→">→</button>
            </div>
            {page === max && hasOutro && (
              <OutroCard mode={mode} variant="inline" />
            )}
          </article>
        )}
      </main>
    </>
  )
}
