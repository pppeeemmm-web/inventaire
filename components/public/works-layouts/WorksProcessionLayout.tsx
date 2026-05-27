'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import type { Work } from '@/components/public/works-utils'

interface Props {
  works: Work[]
  siteTheme: PublicSiteTheme
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

/**
 * Procession — single horizontal scrolling band. Each work renders at a fixed
 * height so the eye traverses left → right like a museum gallery walk.
 * Click → lightbox for full-res view.
 */
export default function WorksProcessionLayout({ works, siteTheme, hiddenNavRoutes, navOrder }: Props) {
  const { t, lang } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)
  const visible = works.filter(w => w.txtImageNameLink)
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
          padding: 0 max(48px, 8vw);
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
        .w-proc-img {
          height: 62vh; max-height: 720px;
          width: auto; display: block;
          object-fit: contain;
          filter: drop-shadow(0 16px 22px rgba(15,15,20,0.30))
                  drop-shadow(0 4px 8px rgba(15,15,20,0.18));
          background: transparent;
        }
        @media (max-width: 768px) {
          .w-proc-img { height: 46vh; }
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
        /* Lightbox */
        .w-proc-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          cursor: zoom-out;
        }
        .w-proc-lb img {
          max-width: 96vw; max-height: 92vh;
          object-fit: contain; display: block;
        }
      `}</style>
      <div className="w-proc" aria-label={t('pub_works')}>
        <div className="w-proc-track">
          {visible.map(w => (
            <button
              key={w.OeuvreID}
              type="button"
              className="w-proc-tile"
              onClick={() => setLightbox(w)}
              aria-label={w.Titre ?? t('pub_untitled')}
            >
              <img
                src={thumbUrl(w.txtImageNameLink) ?? imageUrl(w.txtImageNameLink) ?? ''}
                alt={w.Titre ?? ''}
                className="w-proc-img"
                draggable={false}
              />
              <div className="w-proc-cap">{w.Titre ?? t('pub_untitled')}</div>
              {w.Annee && (
                <div className="w-proc-cap-sub">{yearOf(w.Annee)}</div>
              )}
            </button>
          ))}
        </div>
      </div>
      {lightbox && (
        <div className="w-proc-lb" role="dialog" aria-label={lightbox.Titre ?? ''} onClick={() => setLightbox(null)}>
          <img src={imageUrl(lightbox.txtImageNameLink) ?? ''} alt={lightbox.Titre ?? ''} />
        </div>
      )}
    </>
  )
}
