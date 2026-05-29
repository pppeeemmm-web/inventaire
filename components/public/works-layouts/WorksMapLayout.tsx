'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl } from '@/lib/data'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import type { Work, WorksMode, ForestPin } from '../works-utils'

interface Props {
  works: Work[]
  mode: WorksMode
  forestPins: ForestPin[]
  siteTheme: PublicSiteTheme
}

interface ZoomedWork {
  work: Work
  src: string
}

export default function WorksMapLayout({ works, mode, forestPins, siteTheme }: Props) {
  const { t } = useI18n()
  const panoramaUrl = imageUrl(mode.forest_panorama_r2_key)
  const worksById = new Map(works.map(w => [w.OeuvreID, w]))
  const [zoomed, setZoomed] = useState<ZoomedWork | null>(null)

  const pinsWithWorks = forestPins
    .map(pin => ({ pin, work: worksById.get(pin.work_id) }))
    .filter((p): p is { pin: ForestPin; work: Work } => Boolean(p.work?.txtImageNameLink))

  function openZoom(work: Work) {
    const src = imageUrl(work.txtImageNameLink)
    if (src) setZoomed({ work, src })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: '#0a0c0f',
    }}>
      <style>{`
        .wmap-pin {
          position: absolute;
          transform: translate(-50%, -50%);
          cursor: pointer;
          transition: transform .2s ease;
          border: none;
          background: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .wmap-pin:hover { transform: translate(-50%, -50%) scale(1.15); z-index: 10; }
        .wmap-pin:focus-visible { outline: 2px solid #fff; outline-offset: 2px; border-radius: 50%; }
        .wmap-thumb {
          width: 48px; height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.5);
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          display: block;
        }
        .wmap-pin-label {
          font-size: 7px; letter-spacing: 1.5px; text-transform: uppercase;
          color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.8);
          white-space: nowrap; max-width: 100px; overflow: hidden; text-overflow: ellipsis;
          opacity: 0; transition: opacity .15s;
          pointer-events: none;
        }
        .wmap-pin:hover .wmap-pin-label { opacity: 1; }
        .wmap-zoom-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.85); cursor: zoom-out;
          display: flex; align-items: center; justify-content: center;
        }
        .wmap-zoom-img {
          max-width: min(90vw, 90vh);
          max-height: min(90vw, 90vh);
          object-fit: contain;
          border-radius: 2px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.7);
        }
        .wmap-zoom-caption {
          position: fixed; bottom: max(24px, env(safe-area-inset-bottom, 0px));
          left: 50%; transform: translateX(-50%);
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: rgba(255,255,255,0.7); text-align: center; pointer-events: none;
        }
        .wmap-no-panorama {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 10px;
          color: rgba(255,255,255,0.35);
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          text-align: center;
        }
      `}</style>

      {/* Panorama background */}
      {panoramaUrl ? (
        <img
          src={panoramaUrl}
          alt=""
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            userSelect: 'none',
          }}
        />
      ) : (
        <div className="wmap-no-panorama">
          <span>{t('site_works_map_r2_key_hint')}</span>
        </div>
      )}

      {/* Dim overlay for readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.2)', pointerEvents: 'none',
      }} />

      {/* Work pins */}
      {pinsWithWorks.map(({ pin, work }) => {
        const thumb = thumbUrl(work.txtImageNameLink)
        const title = work.Titre ?? ''
        return (
          <button
            key={pin.work_id}
            type="button"
            className="wmap-pin"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            onClick={() => openZoom(work)}
            aria-label={title}
          >
            {thumb && (
              <img
                src={thumb}
                alt={title}
                className="wmap-thumb"
              />
            )}
            <span className="wmap-pin-label">{title}</span>
          </button>
        )
      })}

      {/* Lightbox */}
      {zoomed && (
        <div
          className="wmap-zoom-backdrop"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal
          aria-label={zoomed.work.Titre ?? ''}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomed.src}
            alt={zoomed.work.Titre ?? ''}
            className="wmap-zoom-img"
            onClick={e => e.stopPropagation()}
          />
          <div className="wmap-zoom-caption">
            {zoomed.work.Titre && <span>{zoomed.work.Titre}</span>}
            {zoomed.work.Annee && <span style={{ marginLeft: 12, opacity: 0.6 }}>{zoomed.work.Annee.slice(0, 4)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
