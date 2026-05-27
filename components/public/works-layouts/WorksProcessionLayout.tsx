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
  const castShadowOn = mode.cast_shadow_enabled !== false
  const castDistance = mode.cast_shadow_distance_px ?? 15
  const castBlur = mode.cast_shadow_blur_px ?? 22
  const castShadowCss = castShadowOn
    ? `drop-shadow(0 ${castDistance}px ${castBlur}px rgba(15,15,20,${(0.34 * intensity).toFixed(3)})) `
      + `drop-shadow(0 ${Math.round(castDistance / 3.75)}px ${Math.round(castBlur / 3.14)}px rgba(15,15,20,${(0.22 * intensity).toFixed(3)}))`
    : 'none'

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.72, behavior: 'smooth' })
  }, [])

  // Vertical wheel → horizontal scroll. Strict deadzone: only hijack when there's
  // clear vertical-only intent (|dy| > 30 && |dx| < 5). Anything else — pure
  // horizontal wheel, diagonal trackpad swipes, gentle vertical wobble — passes
  // through so the browser's native horizontal scroll handles it. `?_diag=1`
  // logs wheel + scroll state for debugging on environments where this fails.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const diag = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('_diag') === '1'
    const onWheel = (e: WheelEvent) => {
      if (lightbox) return
      const { deltaX: dx, deltaY: dy } = e
      if (diag) {
        // eslint-disable-next-line no-console
        console.log('[procession.wheel]', {
          dx, dy,
          scrollLeft: el.scrollLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        })
      }
      if (Math.abs(dy) > 30 && Math.abs(dx) < 5) {
        // scrollBy goes through the browser's scroll pipeline so
        // scroll-snap respects the new position; direct scrollLeft += dy
        // was getting snapped back to the original tile center.
        el.scrollBy({ left: dy, behavior: 'auto' })
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
          overflow-x: scroll; overflow-y: hidden;
          /* proximity (not mandatory) lets wheel scroll freely; the browser
           * still snaps when you let go near a tile center. mandatory was
           * eating partial wheel deltas, leaving the track stuck. */
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }
        /* Force a visible, themed scrollbar — auto-hiding scrollbars on
         * Windows + Mac were hiding the scroll affordance entirely. */
        .w-proc::-webkit-scrollbar { height: 8px; }
        .w-proc::-webkit-scrollbar-track { background: transparent; }
        .w-proc::-webkit-scrollbar-thumb {
          background: ${siteTheme.chromeBorder};
          border-radius: 4px;
        }
        .w-proc::-webkit-scrollbar-thumb:hover { background: ${siteTheme.bodyMutedText}; }
        .w-proc { scrollbar-color: ${siteTheme.chromeBorder} transparent; scrollbar-width: thin; }
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
        /* Reserve a constant-height caption block under every image so tiles
         * without a year (or untitled) keep the same total height as tiles
         * that have both. Otherwise align-items: center on the track shifts
         * the image vertical position based on caption count. */
        .w-proc-caps {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px;
          height: 36px;
        }
        /* Mount hugs the image pixel rect exactly (no letterbox). Cast
         * shadow goes on the mount as a filter (follows the rendered img
         * silhouette). Bevel is an inset box-shadow drawn ON TOP of the
         * image via a ::after pseudo — inset shadows on a span containing
         * <img> would hide behind the bitmap. */
        .w-proc-mount {
          display: inline-block; line-height: 0;
          position: relative;
          filter: ${castShadowCss};
        }
        ${bevelShadow ? `
        .w-proc-mount::after {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none;
          box-shadow: ${bevelShadow};
        }
        ` : ''}
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
          width: 48px; height: 48px; border-radius: 50%;
          background: ${siteTheme.backgroundCss};
          border: 1.5px solid ${siteTheme.bodyMutedText};
          color: ${siteTheme.bodyText};
          font-size: 20px; cursor: pointer; z-index: 250;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
        }
        .w-proc-nav:hover { border-color: ${siteTheme.bodyText}; transform: translateY(-50%) scale(1.06); }
        .w-proc-nav:focus-visible { outline: 2px solid ${siteTheme.bodyText}; outline-offset: 3px; }
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
                <div className="w-proc-caps">
                  <div className="w-proc-cap">{w.Titre ?? t('pub_untitled')}</div>
                  <div className="w-proc-cap-sub" aria-hidden={!w.Annee}>
                    {w.Annee ? yearOf(w.Annee) : ' '}
                  </div>
                </div>
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
