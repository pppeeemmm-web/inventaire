'use client'

import { useState, useRef } from 'react'
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

const IMG_W = 120
const IMG_H = 160
const RADIUS = 640

export default function WorksMapLayout({ works, mode }: Props) {
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomed, setZoomed] = useState<ZoomedWork | null>(null)
  const drag = useRef({ startX: 0, startRot: 0, moved: false })

  const panoramaUrl = imageUrl(mode.forest_panorama_r2_key)
  const worksWithImages = works.filter(w => w.txtImageNameLink)
  const N = worksWithImages.length
  const angleStep = N > 0 ? 360 / N : 0

  function openZoom(work: Work) {
    const src = imageUrl(work.txtImageNameLink)
    if (src) setZoomed({ work, src })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0a0c0f' }}>

      {panoramaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={panoramaUrl}
          alt=""
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            userSelect: 'none', pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />

      {/* Perspective — no overflow:hidden here (kills preserve-3d) */}
      <div
        style={{
          position: 'absolute', inset: 0,
          perspective: '900px',
          perspectiveOrigin: '50% 50%',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onPointerDown={e => {
          drag.current = { startX: e.clientX, startRot: rotation, moved: false }
          setIsDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          if (!isDragging) return
          const dx = e.clientX - drag.current.startX
          if (Math.abs(dx) > 4) drag.current.moved = true
          setRotation(drag.current.startRot - dx * 0.25)
        }}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
      >
        {/* 3D cylinder stage */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: 0, height: 0,
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}>
          {worksWithImages.map((work, i) => {
            const thumb = thumbUrl(work.txtImageNameLink)
            const angle = i * angleStep

            return (
              <button
                key={work.OeuvreID}
                type="button"
                aria-label={work.Titre ?? ''}
                style={{
                  position: 'absolute',
                  width: IMG_W, height: IMG_H,
                  marginLeft: -IMG_W / 2, marginTop: -IMG_H / 2,
                  border: 'none', padding: 0, cursor: 'pointer',
                  transform: `rotateY(${angle}deg) translateZ(${RADIUS}px)`,
                  overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
                }}
                onClick={() => { if (!drag.current.moved) openZoom(work) }}
              >
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={work.Titre ?? ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {zoomed && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.88)', cursor: 'zoom-out',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setZoomed(null)}
          role="dialog" aria-modal aria-label={zoomed.work.Titre ?? ''}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomed.src}
            alt={zoomed.work.Titre ?? ''}
            style={{
              maxWidth: 'min(90vw, 90vh)', maxHeight: 'min(90vw, 90vh)',
              objectFit: 'contain', borderRadius: 2,
              boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{
            position: 'fixed',
            bottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
            left: '50%', transform: 'translateX(-50%)',
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)', textAlign: 'center', pointerEvents: 'none',
          }}>
            {zoomed.work.Titre && <span>{zoomed.work.Titre}</span>}
            {zoomed.work.Annee && (
              <span style={{ marginLeft: 12, opacity: 0.6 }}>{zoomed.work.Annee.slice(0, 4)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
