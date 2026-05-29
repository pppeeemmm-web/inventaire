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

const RADIUS = 560

export default function WorksMapLayout({ works, mode, forestPins }: Props) {
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomed, setZoomed] = useState<ZoomedWork | null>(null)
  const drag = useRef({ startX: 0, startRot: 0, moved: false })

  const worksById = new Map(works.map(w => [w.OeuvreID, w]))
  const pinsWithWorks = forestPins
    .map(pin => ({ pin, work: worksById.get(pin.work_id) }))
    .filter((p): p is { pin: ForestPin; work: Work } => Boolean(p.work?.txtImageNameLink))

  const baseSize = mode.forest_panorama_pin_size ?? 80

  function openZoom(work: Work) {
    const src = imageUrl(work.txtImageNameLink)
    if (src) setZoomed({ work, src })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: '#0a0c0f',
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
        {pinsWithWorks.map(({ pin, work }) => {
          const thumb = thumbUrl(work.txtImageNameLink)
          const angle = (pin.x / 100) * 360
          const sz = pin.size ?? baseSize
          const radius = RADIUS - (pin.z / 100) * (RADIUS * 0.45)
          const vOffset = (pin.y - 50) * 5

          return (
            <button
              key={pin.work_id}
              type="button"
              aria-label={work.Titre ?? ''}
              style={{
                position: 'absolute',
                width: sz, height: sz,
                marginLeft: -sz / 2, marginTop: -sz / 2,
                border: 'none', padding: 0,
                cursor: drag.current.moved ? 'grabbing' : 'pointer',
                transform: `rotateY(${angle}deg) translateZ(${radius}px) translateY(${vOffset}px)`,
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: '0 2px 20px rgba(0,0,0,0.6)',
              }}
              onClick={() => {
                if (!drag.current.moved) openZoom(work)
              }}
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

      {/* Lightbox */}
      {zoomed && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.88)', cursor: 'zoom-out',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal
          aria-label={zoomed.work.Titre ?? ''}
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
