'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/** Horizontal timeline bucketed by year. Sparse years stay narrow; dense
 *  years expand to fit. ← → arrows + keyboard scroll the axis. Click a tile
 *  → lightbox. Bevel + light + wall tint applied per-mode. */
export default function WorksTimelineLayout({ works, mode, bevelShadow, light, siteTheme }: Props) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const intensity = light.intensity

  const buckets = useMemo(() => {
    const map = new Map<number, Work[]>()
    for (const w of works) {
      if (!w.txtImageNameLink) continue
      const y = yearOf(w.Annee)
      if (!y) continue
      const arr = map.get(y) ?? []
      arr.push(w)
      map.set(y, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [works])

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.72, behavior: 'smooth' })
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
        .w-tl-wrap {
          position: fixed; inset: 0;
          background: ${siteTheme.backgroundCss};
          overflow-x: auto; overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          padding-top: clamp(70px, 9vh, 100px);
        }
        .w-tl-wrap::after {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background: ${light.tintRgba}; pointer-events: none;
        }
        .w-tl-track {
          display: flex; align-items: flex-end;
          height: calc(100% - 80px);
          padding: 0 max(72px, 6vw) 60px;
          gap: clamp(32px, 5vw, 80px);
          position: relative; z-index: 1;
        }
        .w-tl-axis {
          position: absolute; left: 0; right: 0; bottom: 30px;
          height: 1px; background: ${siteTheme.bodyMutedText}; opacity: 0.3;
        }
        .w-tl-year {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          flex: 0 0 auto;
        }
        .w-tl-year-label {
          font-family: 'Instrument Serif', serif;
          font-size: 16px; color: ${siteTheme.bodyText};
          margin-top: 8px; letter-spacing: 0.02em;
        }
        .w-tl-year-tick { width: 1px; height: 14px; background: ${siteTheme.bodyMutedText}; opacity: 0.5; }
        .w-tl-works { display: flex; gap: 14px; align-items: flex-end; }
        .w-tl-tile {
          background: transparent; border: none; padding: 0; cursor: zoom-in;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .w-tl-mount {
          position: relative; overflow: hidden; line-height: 0;
          filter: drop-shadow(0 8px 14px rgba(15,15,20,${(0.25 * intensity).toFixed(3)}));
        }
        .w-tl-mount::after {
          content: ''; position: absolute; inset: 0;
          pointer-events: none; z-index: 2;
          ${bevelShadow ? `box-shadow: ${bevelShadow};` : ''}
        }
        .w-tl-mount img {
          height: 28vh; max-height: 320px; min-height: 90px;
          width: auto; display: block; object-fit: contain;
        }
        .w-tl-tile-cap {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText}; opacity: 0.75;
          max-width: 140px; text-align: center;
        }
        .w-tl-outro {
          flex: 0 0 min(560px, 80vw);
          display: flex; align-items: center; justify-content: center;
          padding: 0 16px 60px;
        }
        .w-tl-nav {
          position: fixed; top: 50%; transform: translateY(-50%);
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(255,255,255,0.85); backdrop-filter: blur(6px);
          border: 1px solid ${siteTheme.chromeBorder};
          color: ${siteTheme.bodyText};
          font-size: 18px; cursor: pointer; z-index: 250;
          display: flex; align-items: center; justify-content: center;
        }
        .w-tl-nav.left { left: clamp(12px, 2vw, 24px); }
        .w-tl-nav.right { right: clamp(12px, 2vw, 24px); }
        .w-tl-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; cursor: zoom-out;
        }
        .w-tl-lb img { max-width: 96vw; max-height: 92vh; object-fit: contain; display: block; }
        @media (max-width: 768px) {
          .w-tl-mount img { height: 22vh; }
        }
      `}</style>
      <div className="w-tl-wrap" aria-label={t('pub_works')} ref={trackRef}>
        <div className="w-tl-track">
          <div className="w-tl-axis" />
          {buckets.map(([year, ws]) => (
            <div key={year} className="w-tl-year">
              <div className="w-tl-works">
                {ws.map(w => (
                  <button
                    key={w.OeuvreID}
                    type="button"
                    className="w-tl-tile"
                    onClick={() => setLightbox(w)}
                    aria-label={w.Titre ?? t('pub_untitled')}
                  >
                    <div className="w-tl-mount">
                      <img
                        src={thumbUrl(w.txtImageNameLink) ?? imageUrl(w.txtImageNameLink) ?? ''}
                        alt={w.Titre ?? ''}
                        draggable={false}
                      />
                    </div>
                    {w.Titre && <div className="w-tl-tile-cap">{w.Titre}</div>}
                  </button>
                ))}
              </div>
              <div className="w-tl-year-tick" />
              <div className="w-tl-year-label">{year}</div>
            </div>
          ))}
          {(mode.outro_fr || mode.outro_en) && (
            <div className="w-tl-outro">
              <OutroCard mode={mode} variant="inline" />
            </div>
          )}
        </div>
      </div>
      <button type="button" className="w-tl-nav left" onClick={() => scrollBy(-1)} aria-label="←">←</button>
      <button type="button" className="w-tl-nav right" onClick={() => scrollBy(1)} aria-label="→">→</button>
      {lightbox && (
        <div className="w-tl-lb" role="dialog" aria-label={lightbox.Titre ?? ''} onClick={() => setLightbox(null)}>
          <img src={imageUrl(lightbox.txtImageNameLink) ?? ''} alt={lightbox.Titre ?? ''} />
        </div>
      )}
    </>
  )
}
