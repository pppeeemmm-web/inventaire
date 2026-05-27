'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
 * Procession — single horizontal scrolling band. Each work renders at a fixed
 * height; eye traverses left → right. Click → lightbox. Arrow keys, on-screen
 * ← → buttons, and snap-scroll all navigate. Wall tint + bevel + drop-shadow
 * come from the per-mode light system.
 */
export default function WorksProcessionLayout({ works, mode, bevelShadow, light, siteTheme }: Props) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const visible = works.filter(w => w.txtImageNameLink)
  const intensity = light.intensity

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const step = el.clientWidth * 0.72
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox) return
      if (e.key === 'ArrowRight') { scrollBy(1); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { scrollBy(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scrollBy, lightbox])

  return (
    <>
      <style>{`
        .w-proc {
          position: fixed; inset: 0;
          background: ${siteTheme.backgroundCss};
          overflow-x: auto; overflow-y: hidden;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .w-proc-track {
          display: flex; align-items: center;
          height: 100%;
          padding: 0 max(72px, 10vw);
          gap: clamp(24px, 5vw, 56px);
        }
        .w-proc-tile {
          flex: 0 0 auto;
          scroll-snap-align: center;
          cursor: zoom-in;
          background: transparent;
          border: none; padding: 0;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .w-proc-mount {
          position: relative;
          line-height: 0;
          overflow: hidden;
          filter: drop-shadow(0 16px 22px rgba(15,15,20,${(0.30 * intensity).toFixed(3)}))
                  drop-shadow(0 4px 8px rgba(15,15,20,${(0.18 * intensity).toFixed(3)}));
        }
        .w-proc-mount::after {
          content: ''; position: absolute; inset: 0;
          pointer-events: none; z-index: 2;
          ${bevelShadow ? `box-shadow: ${bevelShadow};` : ''}
        }
        .w-proc-img {
          height: 62vh; max-height: 720px;
          width: auto; display: block;
          object-fit: contain;
          background: transparent;
        }
        @media (max-width: 768px) {
          .w-proc-img { height: 46vh; }
          .w-proc-track { padding: 0 max(40px, 8vw); }
        }
        .w-proc-cap {
          font-family: 'Instrument Serif', serif;
          font-size: 12px; color: ${siteTheme.bodyText};
          line-height: 1.35; text-align: center;
        }
        .w-proc-cap-sub {
          font-size: 8px; letter-spacing: 2px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText}; opacity: 0.7;
        }
        .w-proc-outro-tile {
          flex: 0 0 min(560px, 80vw);
          scroll-snap-align: center;
          display: flex; align-items: center; justify-content: center;
          padding: 0 16px;
        }
        /* Nav arrows */
        .w-proc-nav {
          position: fixed; top: 50%; transform: translateY(-50%);
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(255,255,255,0.85); backdrop-filter: blur(6px);
          border: 1px solid ${siteTheme.chromeBorder};
          color: ${siteTheme.bodyText};
          font-size: 18px; cursor: pointer; z-index: 250;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.15s, transform 0.15s;
        }
        .w-proc-nav:hover { transform: translateY(-50%) scale(1.04); }
        .w-proc-nav.left  { left: clamp(12px, 2vw, 24px); }
        .w-proc-nav.right { right: clamp(12px, 2vw, 24px); }
        /* Wall tint overlay (kelvin-driven) */
        .w-proc::after {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background: ${light.tintRgba}; pointer-events: none;
        }
        /* Lightbox */
        .w-proc-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; cursor: zoom-out;
        }
        .w-proc-lb img { max-width: 96vw; max-height: 92vh; object-fit: contain; display: block; }
      `}</style>
      <div className="w-proc" aria-label={t('pub_works')} ref={trackRef}>
        <div className="w-proc-track">
          {visible.map(w => (
            <button
              key={w.OeuvreID}
              type="button"
              className="w-proc-tile"
              onClick={() => setLightbox(w)}
              aria-label={w.Titre ?? t('pub_untitled')}
            >
              <div className="w-proc-mount">
                <img
                  src={thumbUrl(w.txtImageNameLink) ?? imageUrl(w.txtImageNameLink) ?? ''}
                  alt={w.Titre ?? ''}
                  className="w-proc-img"
                  draggable={false}
                />
              </div>
              <div className="w-proc-cap">{w.Titre ?? t('pub_untitled')}</div>
              {w.Annee && (
                <div className="w-proc-cap-sub">{yearOf(w.Annee)}</div>
              )}
            </button>
          ))}
          <div className="w-proc-outro-tile" aria-hidden={!mode.outro_fr && !mode.outro_en}>
            <OutroCard mode={mode} variant="inline" />
          </div>
        </div>
      </div>
      <button type="button" className="w-proc-nav left" onClick={() => scrollBy(-1)} aria-label="←">←</button>
      <button type="button" className="w-proc-nav right" onClick={() => scrollBy(1)} aria-label="→">→</button>
      {lightbox && (
        <div className="w-proc-lb" role="dialog" aria-label={lightbox.Titre ?? ''} onClick={() => setLightbox(null)}>
          <img src={imageUrl(lightbox.txtImageNameLink) ?? ''} alt={lightbox.Titre ?? ''} />
        </div>
      )}
    </>
  )
}
