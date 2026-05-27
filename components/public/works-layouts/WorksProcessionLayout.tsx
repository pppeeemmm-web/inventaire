'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, yearOf } from '@/lib/data'
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
 * Procession — horizontal scrolling band, equal-height works.
 *
 * Interaction: arrow buttons, keyboard ← →, snap-scroll, AND mouse wheel
 * scrolls horizontally instead of vertically. Background wall moves at ~40%
 * of foreground speed for a subtle parallax.
 *
 * Bevel + drop-shadow live on a `display: inline-block` mount that hugs the
 * image content exactly — no letterboxing artifacts.
 */
export default function WorksProcessionLayout({ works, mode, bevelShadow, light, siteTheme }: Props) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const wallRef = useRef<HTMLDivElement>(null)
  const visible = works.filter(w => w.txtImageNameLink)
  const intensity = light.intensity

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.72, behavior: 'smooth' })
  }, [])

  // Vertical wheel → horizontal scroll. Keep native horizontal wheel as-is.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (lightbox) return
      // If mostly vertical, redirect to horizontal.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [lightbox])

  // Parallax: background wall translates slower than foreground.
  // Depth scales with track length so long series feel proportionally deeper.
  useEffect(() => {
    const el = trackRef.current
    const wall = wallRef.current
    if (!el || !wall) return
    let raf = 0
    const computeDepth = () => {
      const ratio = el.scrollWidth / Math.max(1, el.clientWidth)
      // 2× viewport → 0.25, 6× viewport → 0.45, capped at 0.55.
      return Math.max(0.25, Math.min(0.55, 0.15 + 0.05 * ratio))
    }
    let depth = computeDepth()
    const update = () => {
      wall.style.transform = `translate3d(${-el.scrollLeft * depth}px, 0, 0)`
      raf = 0
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    const onResize = () => { depth = computeDepth(); update() }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    update()
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [visible.length])

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
        .w-proc-shell { position: fixed; inset: 0; overflow: hidden; background: ${siteTheme.backgroundCss}; }
        .w-proc-wall {
          position: absolute; inset: 0; z-index: 0;
          background:
            radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.05), transparent 60%),
            ${siteTheme.backgroundCss};
          will-change: transform;
          pointer-events: none;
        }
        .w-proc-wall::after {
          content: ''; position: absolute; inset: 0;
          background: ${light.tintRgba}; pointer-events: none;
        }
        .w-proc {
          position: absolute; inset: 0; z-index: 1;
          overflow-x: auto; overflow-y: hidden;
          /* proximity (not mandatory) lets wheel scroll freely; the browser
           * still snaps when you let go near a tile center. mandatory was
           * eating partial wheel deltas, leaving the track stuck. */
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }
        .w-proc-track {
          display: flex; align-items: center;
          height: 100%;
          padding: 0 max(72px, 10vw);
          gap: clamp(24px, 5vw, 56px);
        }
        .w-proc-tile {
          flex: 0 0 auto; scroll-snap-align: center;
          background: transparent; border: none; padding: 0; cursor: zoom-in;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        /* Raw image rendering — no introduced bevel or drop-shadow. The mount
         * is just a hugging wrapper so the bounding-box matches the image pixel
         * rect exactly, no letterbox. */
        .w-proc-mount {
          display: inline-block; line-height: 0;
        }
        .w-proc-img {
          height: 62vh; max-height: 720px;
          width: auto; display: block; object-fit: contain;
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
        .w-proc-nav {
          position: fixed; top: 50%; transform: translateY(-50%);
          width: 44px; height: 44px; border-radius: 50%;
          background: transparent;
          border: 1px solid ${siteTheme.chromeBorder};
          color: ${siteTheme.bodyText};
          font-size: 18px; cursor: pointer; z-index: 250;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
        }
        .w-proc-nav:hover { background: rgba(0,0,0,0.04); border-color: ${siteTheme.bodyText}; transform: translateY(-50%) scale(1.04); }
        .w-proc-nav.left  { left: clamp(12px, 2vw, 24px); }
        .w-proc-nav.right { right: clamp(12px, 2vw, 24px); }
        .w-proc-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; cursor: zoom-out;
        }
        .w-proc-lb img { max-width: 96vw; max-height: 92vh; object-fit: contain; display: block; }
      `}</style>
      <div className="w-proc-shell" aria-label={t('pub_works')}>
        <div className="w-proc-wall" ref={wallRef} />
        <div className="w-proc" ref={trackRef}>
          <div className="w-proc-track">
            {visible.map((w, i) => (
              <button
                key={w.OeuvreID}
                type="button"
                className="w-proc-tile"
                onClick={() => setLightbox(w)}
                aria-label={w.Titre ?? t('pub_untitled')}
              >
                <span className="w-proc-mount">
                  <img
                    src={imageUrl(w.txtImageNameLink) ?? ''}
                    alt={w.Titre ?? ''}
                    className="w-proc-img"
                    draggable={false}
                    loading={i < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </span>
                <div className="w-proc-cap">{w.Titre ?? t('pub_untitled')}</div>
                {w.Annee && <div className="w-proc-cap-sub">{yearOf(w.Annee)}</div>}
              </button>
            ))}
            {(mode.outro_fr || mode.outro_en) && (
              <div className="w-proc-outro-tile">
                <OutroCard mode={mode} variant="inline" />
              </div>
            )}
          </div>
        </div>
        <button type="button" className="w-proc-nav left" onClick={() => scrollBy(-1)} aria-label="←">←</button>
        <button type="button" className="w-proc-nav right" onClick={() => scrollBy(1)} aria-label="→">→</button>
        {lightbox && (
          <div className="w-proc-lb" role="dialog" aria-label={lightbox.Titre ?? ''} onClick={() => setLightbox(null)}>
            <img src={imageUrl(lightbox.txtImageNameLink) ?? ''} alt={lightbox.Titre ?? ''} />
          </div>
        )}
      </div>
    </>
  )
}
