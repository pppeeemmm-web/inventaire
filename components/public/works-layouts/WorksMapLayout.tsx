'use client'

import { useState } from 'react'
import { imageUrl, thumbUrl } from '@/lib/data'
import type { Work, WorksMode, ForestPin } from '../works-utils'
import type { PublicSiteTheme } from '@/lib/public-site-theme'

interface Props {
  works: Work[]
  mode: WorksMode
  forestPins: ForestPin[]
  siteTheme: PublicSiteTheme
}

interface ZoomedWork { work: Work; src: string }

/** Container depth for the per-work Y-axis rotation. */
const SCENE_PERSPECTIVE = 1400

/**
 * Flat manual map. Works are placed inside a fixed 16:9 stage that scales to
 * fit the viewport (letterboxed). Positions (x/y %) and width (% of the stage)
 * are therefore resolution-independent: resizing the window scales the whole
 * stage uniformly so pins stay exactly where they were placed, matching the
 * 16:9 editor canvas (true WYSIWYG). Static — click a work to zoom.
 */
export default function WorksMapLayout({ works, mode, forestPins }: Props) {
  const [zoomed, setZoomed] = useState<ZoomedWork | null>(null)

  const panoramaUrl = imageUrl(mode.forest_panorama_r2_key)
  const worksById = new Map(works.map(w => [w.OeuvreID, w]))

  const placed = forestPins
    .map(pin => ({ pin, work: worksById.get(pin.work_id) }))
    .filter((p): p is { pin: ForestPin; work: Work } => Boolean(p.work?.txtImageNameLink))
    .sort((a, b) => a.pin.z - b.pin.z) // paint low z first (behind)

  function openZoom(work: Work) {
    const src = imageUrl(work.txtImageNameLink)
    if (src) setZoomed({ work, src })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: '#0a0c0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* Fixed 16:9 stage — scales to fit, so % positions stay put on resize. */}
      <div
        style={{
          position: 'relative',
          width: 'min(100vw, calc(100vh * 16 / 9))',
          aspectRatio: '16 / 9',
          overflow: 'hidden',
          perspective: `${SCENE_PERSPECTIVE}px`,
        }}
      >
        {panoramaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={panoramaUrl}
            alt=""
            aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none', zIndex: 0 }}
          />
        )}

        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 1 }} />

        {/* Works — flat, natural aspect ratio, one Y-axis rotation each */}
        {placed.map(({ pin, work }) => {
          const thumb = thumbUrl(work.txtImageNameLink)
          return (
            <button
              key={pin.work_id}
              type="button"
              aria-label={work.Titre ?? ''}
              onClick={() => openZoom(work)}
              style={{
                position: 'absolute',
                left: `${pin.x}%`, top: `${pin.y}%`,
                width: `${pin.size}%`, height: 'auto',
                transform: `translate(-50%, -50%) rotateY(${pin.rotation}deg)`,
                transformStyle: 'preserve-3d',
                border: 'none', padding: 0, background: 'none', cursor: 'pointer',
                zIndex: Math.round(pin.z) + 10,
                lineHeight: 0,
                boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
              }}
            >
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt={work.Titre ?? ''}
                  style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {zoomed && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', cursor: 'zoom-out', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setZoomed(null)}
          role="dialog" aria-modal aria-label={zoomed.work.Titre ?? ''}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomed.src} alt={zoomed.work.Titre ?? ''} style={{ maxWidth: 'min(90vw, 90vh)', maxHeight: 'min(90vw, 90vh)', objectFit: 'contain', borderRadius: 2, boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()} />
          <div style={{ position: 'fixed', bottom: 'max(24px, env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'center', pointerEvents: 'none' }}>
            {zoomed.work.Titre && <span>{zoomed.work.Titre}</span>}
            {zoomed.work.Annee && <span style={{ marginLeft: 12, opacity: 0.6 }}>{zoomed.work.Annee.slice(0, 4)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
