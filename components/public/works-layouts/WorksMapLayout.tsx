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

const RADIUS = 600
const PERSPECTIVE = 1400

export default function WorksMapLayout({ works, mode, forestPins }: Props) {
  const [rotation, setRotation] = useState(0) // degrees
  const [isDragging, setIsDragging] = useState(false)
  const [zoomed, setZoomed] = useState<ZoomedWork | null>(null)
  const drag = useRef({ startX: 0, startRot: 0, moved: false })

  const panoramaUrl = imageUrl(mode.forest_panorama_r2_key)
  const baseSize = mode.forest_panorama_pin_size ?? 120
  const worksById = new Map(works.map(w => [w.OeuvreID, w]))

  const placed = forestPins
    .map(pin => ({ pin, work: worksById.get(pin.work_id) }))
    .filter((p): p is { pin: ForestPin; work: Work } => Boolean(p.work?.txtImageNameLink))

  // Manual projection — no CSS preserve-3d (browser quirks)
  // pin.x 0-100 → angle 0-360° around Y axis
  // Perspective scale = P / (P - zWorld) where zWorld = cos(angle) * RADIUS
  const rotRad = (rotation * Math.PI) / 180
  const items = placed.map(({ pin, work }) => {
    const angle = (pin.x / 100) * 2 * Math.PI + rotRad
    const zWorld = Math.cos(angle) * RADIUS   // +RADIUS = near, -RADIUS = far
    const xWorld = Math.sin(angle) * RADIUS   // horizontal offset
    const scale = PERSPECTIVE / (PERSPECTIVE - zWorld)
    const sz = (pin.size ?? baseSize) * scale
    const screenX = xWorld * scale
    const screenY = (pin.y - 50) * 6         // vertical spread
    const zIndex = Math.round(zWorld + RADIUS + 1)
    return { pin, work, sz, screenX, screenY, zIndex, scale }
  }).sort((a, b) => a.zIndex - b.zIndex)     // paint back-to-front

  function openZoom(work: Work) {
    const src = imageUrl(work.txtImageNameLink)
    if (src) setZoomed({ work, src })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0a0c0f', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      onPointerDown={e => {
        drag.current = { startX: e.clientX, startRot: rotation, moved: false }
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        if (!isDragging) return
        const dx = e.clientX - drag.current.startX
        if (Math.abs(dx) > 4) drag.current.moved = true
        setRotation(drag.current.startRot - dx * 0.3)
      }}
      onPointerUp={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
    >
      {panoramaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={panoramaUrl} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }} />
      )}

      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', pointerEvents: 'none' }} />

      {/* Works — 2D projected from cylinder math */}
      {items.map(({ pin, work, sz, screenX, screenY, zIndex }) => {
        const thumb = thumbUrl(work.txtImageNameLink)
        return (
          <button
            key={pin.work_id}
            type="button"
            aria-label={work.Titre ?? ''}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: sz, height: sz,
              marginLeft: -sz / 2, marginTop: -sz / 2,
              transform: `translate(${screenX}px, ${screenY}px)`,
              border: 'none', padding: 0, cursor: 'pointer',
              zIndex,
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
            onClick={() => { if (!drag.current.moved) openZoom(work) }}
          >
            {thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={work.Titre ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
            )}
          </button>
        )
      })}

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
