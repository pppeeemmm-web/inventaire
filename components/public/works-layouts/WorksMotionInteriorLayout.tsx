'use client'

import { useState } from 'react'
import { imageUrl, thumbUrl, r2PublicPath } from '@/lib/data'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import type { Work, WorksMode } from '../works-utils'

interface Props {
  works: Work[]
  mode: WorksMode
  siteTheme: PublicSiteTheme
}

interface ZoomedWork {
  work: Work
  src: string
}

function buildVideoUrl(key: string | undefined): string | null {
  if (!key) return null
  if (key.startsWith('http')) return key
  return r2PublicPath(key)
}

export default function WorksMotionInteriorLayout({ works, mode, siteTheme }: Props) {
  const videoUrl = buildVideoUrl(mode.motion_interior_r2_key)
  const [zoomed, setZoomed] = useState<ZoomedWork | null>(null)

  const worksWithImages = works.filter(w => w.txtImageNameLink)

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
        .wmi-strip {
          position: fixed;
          bottom: max(72px, calc(env(safe-area-inset-bottom, 0px) + 64px));
          left: 0; right: 0;
          display: flex;
          flex-direction: row;
          gap: 10px;
          padding: 0 16px;
          overflow-x: auto;
          overflow-y: visible;
          scrollbar-width: none;
          -ms-overflow-style: none;
          z-index: 10;
        }
        .wmi-strip::-webkit-scrollbar { display: none; }
        .wmi-card {
          flex: 0 0 auto;
          width: clamp(80px, 12vw, 120px);
          cursor: pointer;
          border: none;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
          border-radius: 3px;
          padding: 4px;
          transition: transform .2s ease, background .2s ease;
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        }
        .wmi-card:hover { transform: translateY(-6px); background: rgba(255,255,255,0.16); }
        .wmi-card:focus-visible { outline: 2px solid rgba(255,255,255,0.7); outline-offset: 2px; border-radius: 3px; }
        .wmi-thumb {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          border-radius: 2px;
          display: block;
        }
        .wmi-title {
          font-size: 7px; letter-spacing: 1.5px; text-transform: uppercase;
          color: rgba(255,255,255,0.65);
          white-space: nowrap; max-width: 100%;
          overflow: hidden; text-overflow: ellipsis;
          text-align: center; padding: 0 2px;
        }
        .wmi-zoom-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.85); cursor: zoom-out;
          display: flex; align-items: center; justify-content: center;
        }
        .wmi-zoom-img {
          max-width: min(90vw, 85vh);
          max-height: min(90vw, 85vh);
          object-fit: contain;
          border-radius: 2px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.7);
        }
        .wmi-zoom-caption {
          position: fixed; bottom: max(24px, env(safe-area-inset-bottom, 0px));
          left: 50%; transform: translateX(-50%);
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: rgba(255,255,255,0.7); text-align: center; pointer-events: none;
        }
        .wmi-no-video {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #0d1117 0%, #1a1f2e 50%, #0d1117 100%);
          animation: wmi-pulse 8s ease-in-out infinite alternate;
        }
        @keyframes wmi-pulse {
          0% { opacity: 1; } 100% { opacity: 0.7; }
        }
      `}</style>

      {/* Video background */}
      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div className="wmi-no-video" />
      )}

      {/* Dark vignette over video */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.2) 100%)',
      }} />

      {/* Works strip */}
      <div className="wmi-strip" role="list" aria-label="Works">
        {worksWithImages.map(work => {
          const thumb = thumbUrl(work.txtImageNameLink)
          const title = work.Titre ?? ''
          return (
            <button
              key={work.OeuvreID}
              type="button"
              className="wmi-card"
              onClick={() => openZoom(work)}
              aria-label={title}
              role="listitem"
            >
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="wmi-thumb" aria-hidden />
              )}
              {title && <span className="wmi-title">{title}</span>}
            </button>
          )
        })}
      </div>

      {/* Lightbox */}
      {zoomed && (
        <div
          className="wmi-zoom-backdrop"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal
          aria-label={zoomed.work.Titre ?? ''}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomed.src}
            alt={zoomed.work.Titre ?? ''}
            className="wmi-zoom-img"
            onClick={e => e.stopPropagation()}
          />
          <div className="wmi-zoom-caption">
            {zoomed.work.Titre && <span>{zoomed.work.Titre}</span>}
            {zoomed.work.Annee && <span style={{ marginLeft: 12, opacity: 0.6 }}>{zoomed.work.Annee.slice(0, 4)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
