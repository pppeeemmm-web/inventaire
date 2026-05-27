'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
import PublicNav from '@/components/public/PublicNav'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import { publicSiteBaseCss } from '@/lib/public-site-theme'
import type { Work } from '@/components/public/works-utils'

interface Props {
  works: Work[]
  siteTheme: PublicSiteTheme
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

/** Horizontal timeline bucketed by year. Sparse years stay narrow; dense years
 *  expand so all works fit. Click a work → lightbox. */
export default function WorksTimelineLayout({ works, siteTheme, hiddenNavRoutes, navOrder }: Props) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)

  // Bucket by year, sorted ascending.
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

  return (
    <>
      <style>{publicSiteBaseCss(siteTheme)}</style>
      <style>{`
        .w-tl-wrap {
          position: fixed; inset: 0;
          background: ${siteTheme.backgroundCss};
          overflow-x: auto; overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          padding-top: clamp(70px, 9vh, 100px);
        }
        .w-tl-track {
          display: flex; align-items: flex-end;
          height: calc(100% - 80px);
          padding: 0 max(48px, 6vw) 60px;
          gap: clamp(32px, 5vw, 80px);
          position: relative;
        }
        .w-tl-axis {
          position: absolute; left: 0; right: 0; bottom: 30px;
          height: 1px; background: ${siteTheme.bodyMutedText}; opacity: 0.3;
        }
        .w-tl-year {
          display: flex; flex-direction: column; align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }
        .w-tl-year-label {
          font-family: 'Instrument Serif', serif;
          font-size: 16px; color: ${siteTheme.bodyText};
          margin-top: 8px;
          letter-spacing: 0.02em;
        }
        .w-tl-year-tick {
          width: 1px; height: 14px; background: ${siteTheme.bodyMutedText}; opacity: 0.5;
        }
        .w-tl-works {
          display: flex; gap: 14px; align-items: flex-end;
        }
        .w-tl-tile {
          background: transparent; border: none; padding: 0; cursor: zoom-in;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .w-tl-tile img {
          height: 28vh; max-height: 320px; min-height: 90px;
          width: auto; display: block; object-fit: contain;
          filter: drop-shadow(0 8px 14px rgba(15,15,20,0.25));
        }
        .w-tl-tile-cap {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText}; opacity: 0.75;
          max-width: 140px; text-align: center;
        }
        .w-tl-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; cursor: zoom-out;
        }
        .w-tl-lb img { max-width: 96vw; max-height: 92vh; object-fit: contain; display: block; }
        @media (max-width: 768px) {
          .w-tl-tile img { height: 22vh; }
        }
      `}</style>
      <PublicNav active="works" prefix="w" hiddenNavRoutes={hiddenNavRoutes} navOrder={navOrder} />
      <div className="w-tl-wrap" aria-label={t('pub_works')}>
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
                    <img
                      src={thumbUrl(w.txtImageNameLink) ?? imageUrl(w.txtImageNameLink) ?? ''}
                      alt={w.Titre ?? ''}
                      draggable={false}
                    />
                    {w.Titre && <div className="w-tl-tile-cap">{w.Titre}</div>}
                  </button>
                ))}
              </div>
              <div className="w-tl-year-tick" />
              <div className="w-tl-year-label">{year}</div>
            </div>
          ))}
        </div>
      </div>
      {lightbox && (
        <div className="w-tl-lb" role="dialog" aria-label={lightbox.Titre ?? ''} onClick={() => setLightbox(null)}>
          <img src={imageUrl(lightbox.txtImageNameLink) ?? ''} alt={lightbox.Titre ?? ''} />
        </div>
      )}
    </>
  )
}
