'use client'

import { useI18n } from '@/lib/i18n/context'
import { imageUrl, yearOf } from '@/lib/data'
import { useEffect, useState, useRef, useMemo } from 'react'
import PublicNav from './PublicNav'

// Strip HTML tags to plain text before FlameText transform
function htmlToPlain(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim()
}

// Subtitle text: line breaks → █, periods → /
function FlameText({ text }: { text: string }) {
  const plain = htmlToPlain(text)
  const formatted = plain
    .replace(/\./g, ' /')
    .replace(/\n/g, ' █ ')

  return (
    <p style={{
      maxWidth: 'min(640px, 80vw)',
      fontSize: 'clamp(9px, 1.1vw, 13px)',
      lineHeight: 1.9,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: '#8a8680',
      textAlign: 'justify',
      wordSpacing: '0.3em',
      fontFamily: 'JetBrains Mono, monospace',
      margin: '0 auto',
    }}>
      {formatted}
    </p>
  )
}

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface Work {
  OeuvreID: number
  Titre: string | null
  Annee: string | null
  Hauteur: string | null
  Largeur: string | null
  txtImageNameLink: string | null
  themes: string[]
}

interface Collection {
  id: string
  title: string
  description?: string
  theme?: string | null
  is_active: boolean
}

type SequenceItem =
  | { type: 'work'; data: Work; collectionId?: string; workIndex: number }
  | { type: 'header'; title: string; subtitle?: string }

interface Props {
  works: Work[]
  collections: Collection[]
}

export default function WorksClient({ works, collections }: Props) {
  const { t } = useI18n()

  const sequence = useMemo(() => {
    const items: SequenceItem[] = []
    const activeCollections = collections.filter(c => c.is_active)
    // Works first
    activeCollections.forEach(col => {
      const colMatch = normalizeTheme(col.theme)
      const colWorks = works.filter(w => {
        if (!w.txtImageNameLink) return false
        if (!col.theme) return true
        return w.themes.some(th => normalizeTheme(th).includes(colMatch))
      })
      colWorks.forEach(w => items.push({ type: 'work', data: w, collectionId: col.id, workIndex: items.filter(i => i.type === 'work').length }))
    })
    if (items.length === 0) {
      works.filter(w => w.txtImageNameLink).forEach((w, i) => items.push({ type: 'work', data: w, workIndex: i }))
    }
    // Header at end — click loops back to start
    activeCollections.forEach(col => {
      items.push({ type: 'header', title: col.title, subtitle: col.description })
    })
    return items
  }, [works, collections])

  const targetDepth  = useRef(0)
  const currentDepth = useRef(0)
  const [displayDepth, setDisplayDepth] = useState(0)
  const [activeWork, setActiveWork] = useState<Work | null>(null)
  const [captionOpacity, setCaptionOpacity] = useState(0)
  const [atEnd, setAtEnd] = useState(false)
  const [endOpacity, setEndOpacity] = useState(0)

  // Ken Burns
  const burnZooms      = useRef<Map<number, number>>(new Map())
  const burnTicks      = useRef(0)        // ticks for currently settled painting
  const settledIdx     = useRef<number>(-1) // which painting is currently settled
  const activePainting = useRef<number>(-1)

  const STEP       = 6000
  const BIRTH_DIST = 60000

  const touchLastY  = useRef<number | null>(null)
  const touchVelY   = useRef(0)
  const touchActive = useRef(false)

  useEffect(() => {
    const maxScroll = () => (sequence.length - 1) * STEP + 2000
    // Soft clamp: hard floor at 0, soft resistance past max
    const softClamp = (v: number) => {
      if (v < 0) return 0
      const max = maxScroll()
      if (v <= max) return v
      return max + (v - max) * 0.15  // 85% resistance past end
    }

    const handleWheel = (e: WheelEvent) => {
      targetDepth.current = softClamp(targetDepth.current + e.deltaY * 2.5)
    }

    const handleTouchStart = (e: TouchEvent) => {
      touchLastY.current  = e.touches[0].clientY
      touchVelY.current   = 0
      touchActive.current = true
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (touchLastY.current === null) return
      const dy = touchLastY.current - e.touches[0].clientY
      touchVelY.current   = dy
      touchLastY.current  = e.touches[0].clientY
      targetDepth.current = softClamp(targetDepth.current + dy * 6)
    }

    const handleTouchEnd = () => {
      touchActive.current = false
      const coast = () => {
        if (Math.abs(touchVelY.current) < 0.5) return
        touchVelY.current  *= 0.92
        targetDepth.current = softClamp(targetDepth.current + touchVelY.current * 4)
        requestAnimationFrame(coast)
      }
      requestAnimationFrame(coast)
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        targetDepth.current = softClamp(targetDepth.current + STEP)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        targetDepth.current = softClamp(targetDepth.current - STEP)
      }
    }

    window.addEventListener('wheel',      handleWheel,      { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove',  handleTouchMove,  { passive: true })
    window.addEventListener('touchend',   handleTouchEnd)
    window.addEventListener('keydown',    handleKey)

    let rafId: number
    const animate = () => {
      // Depth easing
      const viscosity = 0.04
      currentDepth.current += (targetDepth.current - currentDepth.current) * viscosity
      setDisplayDepth(currentDepth.current)
      document.getElementById('grain')?.style.setProperty('--scroll-y', currentDepth.current.toString())

      // Ken Burns + caption
      const activeIdx = Math.round(currentDepth.current / STEP)
      const item = sequence[activeIdx]

      // Find last work index once
      const lastWorkIdx = sequence.reduce((acc, s, i) => s.type === 'work' ? i : acc, -1)
      const pastLastWork = currentDepth.current > lastWorkIdx * STEP + STEP * 0.5

      // End overlay opacity: fades in over 1 STEP past the last work
      const lastCenter = lastWorkIdx * STEP
      const endProgress = Math.max(0, Math.min(1, (currentDepth.current - lastCenter - STEP * 0.3) / (STEP * 0.7)))
      setEndOpacity(endProgress)
      setAtEnd(endProgress > 0)

      // Work caption: fades out as end fades in — hard zero once end starts
      if (endProgress > 0) {
        setCaptionOpacity(0)
      } else if (item?.type === 'work') {
        const dist = currentDepth.current - activeIdx * STEP
        setCaptionOpacity(Math.max(0, 1 - Math.abs(dist / 1200)))
        if (activePainting.current !== activeIdx) {
          setActiveWork(item.data)
        }
      } else {
        setCaptionOpacity(0)
      }

      // Ken Burns: nearest work index drives the zoom
      const nearestWorkIdx = Math.round(currentDepth.current / STEP)
      const nearestItem = sequence[nearestWorkIdx]
      if (nearestItem?.type === 'work') {
        if (settledIdx.current !== nearestWorkIdx) {
          // Switched to a new painting — reset
          settledIdx.current = nearestWorkIdx
          burnTicks.current  = 0
          burnZooms.current.set(nearestWorkIdx, 1)
        }
        burnTicks.current += 1
        const t = 1 - Math.exp(-burnTicks.current / 180)
        burnZooms.current.set(nearestWorkIdx, 1 + 0.48 * t)
      }

      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('wheel',      handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove',  handleTouchMove)
      window.removeEventListener('touchend',   handleTouchEnd)
      window.removeEventListener('keydown',    handleKey)
      cancelAnimationFrame(rafId)
    }
  }, [sequence])

  // Snapshot zoom map each frame so render picks up latest values
  const [burnSnapshot, setBurnSnapshot] = useState<Map<number, number>>(new Map())
  useEffect(() => {
    let raf: number
    const tick = () => {
      setBurnSnapshot(new Map(burnZooms.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="w-page-enter">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          background: #e8e6e1; font-family: 'JetBrains Mono', monospace; color: #3a3834;
          height: 100vh; overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }

        @keyframes w-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .w-page-enter {
          animation: w-fadein 2s ease forwards;
        }

        .w-viewport {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          overflow: hidden; pointer-events: none; z-index: 10;
          display: flex; align-items: center; justify-content: center;
          perspective: 1200px;
          perspective-origin: center;
          transform-style: preserve-3d;
        }

        .grain-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 200%;
          pointer-events: none; z-index: 5; opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          transform: translateY(calc(var(--scroll-y, 0) * -0.05px));
        }

        /* Warm paper — slightly brightened radial at center for ground plane depth */
        .w-paper-bg {
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 50% 60%, rgba(255,252,245,0.85) 0%, transparent 80%),
            radial-gradient(circle at center, #f8f5ef 0%, #e0ddd6 100%);
          z-index: 1; pointer-events: none;
        }

        .w-depth-item {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          will-change: transform, opacity; pointer-events: none;
          transform-style: preserve-3d;
        }

        .w-artwork-wrap {
          position: relative; width: 100vw; height: 100vh;
          display: flex; align-items: center; justify-content: center;
        }

        /* Floating shadow intensifies at center, fades at distance */
        .w-image-container {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--img-radius);
          overflow: hidden;
          isolation: isolate;
          box-shadow: var(--painting-shadow);
        }

        .w-main-img {
          width: auto; height: auto;
          max-width: min(94vw, 1600px); max-height: min(94vh, 1200px);
          display: block;
          image-rendering: high-quality;
          backface-visibility: hidden;
          transform-origin: center center;
          transform: scale(var(--burns-zoom, 1));
          will-change: transform;
          transition: opacity 1s ease;
        }

.w-parallax-header {
          position: relative; width: 100vw; height: 100vh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center;
          padding: 0 clamp(32px, 8vw, 120px);
          transform-style: preserve-3d;
          transform: rotateX(15deg);
          cursor: pointer;
        }
        .w-header-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(80px, 15vw, 240px);
          color: #1a1816; letter-spacing: -0.05em; line-height: 0.85; margin-bottom: 48px;
          transition: opacity 0.3s;
        }
        .w-parallax-header:hover .w-header-title { opacity: 0.6; }
        .w-header-subtitle {
          max-width: 680px; font-size: 14px; line-height: 1.6; letter-spacing: 0.1em;
          text-transform: uppercase; color: #8a8680; font-weight: 400; text-align: center;
        }

        .w-caption {
          position: fixed; top: 50%; left: clamp(24px, 5vw, 64px);
          transform: translateY(-50%);
          width: clamp(140px, 28vw, 560px); z-index: 200;
          pointer-events: auto;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .w-caption {
            top: auto; bottom: clamp(60px, 10vh, 100px);
            left: 50%; transform: translateX(-50%);
            width: 90vw; text-align: center;
          }
        }
        .w-caption:hover .w-work-title { opacity: 0.55; }
        .w-work-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(20px, 3.5vw, 56px);
          color: #1a1816; font-weight: 400; margin-bottom: 16px;
          letter-spacing: -0.04em; line-height: 1;
          text-shadow:
            0 0 24px rgba(255,255,255,1),
            0 0 48px rgba(255,255,255,0.9),
            0 0 80px rgba(255,255,255,0.6);
          transition: opacity 0.25s;
        }
        .w-work-details {
          display: flex; flex-direction: column; gap: 8px;
          font-size: 9px; letter-spacing: 5px; text-transform: uppercase;
          color: #6a6660;
          text-shadow:
            0 0 12px rgba(255,255,255,1),
            0 0 24px rgba(255,255,255,0.8);
        }

        .w-scroll-hint {
          position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
          font-size: 8px; letter-spacing: 4px; color: #b0aca6; text-transform: uppercase;
          z-index: 100; opacity: 0.3;
        }
      `}</style>

<div className="w-paper-bg"/>
      <div className="grain-overlay" id="grain"/>

      <PublicNav active="works" prefix="w" />

      <div className="w-viewport">
        {sequence.map((item, idx) => {
          const centerPos = idx * STEP
          const dist      = displayDepth - centerPos

          // Opacity: steep fade-in on approach, hold briefly at center, quick fade out
          const opacity = dist < 0
            ? Math.pow(Math.max(0, (dist + BIRTH_DIST) / BIRTH_DIST), 4)
            : Math.max(0, 1 - Math.max(0, dist - STEP * 0.3) / (STEP * 0.4))

          let translateZ = 0
          let scale = 1

          if (dist < 0) {
            const progress = Math.max(0, (dist + BIRTH_DIST) / BIRTH_DIST)
            translateZ = -BIRTH_DIST + BIRTH_DIST * progress
            // Scale starts growing from 60% of the journey in, with a gentle ease
            const remapped = Math.max(0, (progress - 0.6) / 0.4)
            scale = Math.pow(remapped, 1.8)
          }
          // post-center: translateZ=0, scale=1 — fade handles exit

          if (opacity <= 0 && Math.abs(dist) > BIRTH_DIST + 5000) return null

          const zIndex = 1000 - Math.floor(Math.abs(dist) / 50)

          if (item.type === 'header') {
            return (
              <div
                key={`header-${idx}`}
                className="w-depth-item"
                style={{
                  opacity: Math.max(0, 1 - Math.abs(dist / 3000)),
                  transform: `translate3d(0, 0, ${translateZ * 1.2}px) scale(${scale * 0.8})`,
                  zIndex,
                  pointerEvents: Math.abs(dist) < 2000 ? 'auto' : 'none',
                }}
                onClick={() => { targetDepth.current = 0 }}
              >
                <div className="w-parallax-header">
                  <h1 className="w-header-title">{item.title}</h1>
                  {item.subtitle && <FlameText text={item.subtitle} />}
                </div>
              </div>
            )
          }

          const work = item.data
          const isFirstWork = item.workIndex === 0

          // ── First work: slides in from right with rotateY skew ──
          let slideTranslateX = 0
          let slideRotateY = 0
          if (isFirstWork && dist < 0) {
            // progress: 0 (far) → 1 (at center)
            const p = Math.max(0, Math.min(1, (dist + BIRTH_DIST) / BIRTH_DIST))
            // ease in: slow start, fast finish
            const eased = Math.pow(p, 0.5)
            slideTranslateX = (1 - eased) * 160  // vw — starts offscreen right
            slideRotateY    = (1 - eased) * 42   // degrees skew
          }

          // Shape: circle far away → sharp rectangle at center
          const approachWindow = STEP * 2
          const shapeProgress  = dist < 0
            ? Math.max(0, Math.min(1, (dist + approachWindow) / approachWindow))
            : 1
          const cornerRadius = Math.round((1 - shapeProgress) * 50)

          // Shadow: grows as painting arrives, fades as it leaves (top-right source → bottom-left)
          const shadowIntensity = Math.max(0, 1 - Math.abs(dist) / (STEP * 1.5))
          const shadowBlur   = Math.round(shadowIntensity * 80)
          const shadowSpread = Math.round(shadowIntensity * 8)
          const shadowAlpha  = (shadowIntensity * 0.45).toFixed(2)
          const paintingShadow = shadowIntensity > 0.05
            ? `-${Math.round(shadowIntensity * 28)}px ${Math.round(shadowIntensity * 36)}px ${shadowBlur}px ${shadowSpread}px rgba(20,16,10,${shadowAlpha}), -${Math.round(shadowIntensity * 8)}px ${Math.round(shadowIntensity * 12)}px ${Math.round(shadowIntensity * 22)}px rgba(20,16,10,${(shadowIntensity * 0.25).toFixed(2)})`
            : 'none'

const imgSrc      = imageUrl(work.txtImageNameLink) ?? undefined

          const itemTransform = isFirstWork
            ? `translate3d(${slideTranslateX}vw, 0, ${translateZ}px) rotateY(${slideRotateY}deg) scale(${scale})`
            : `translate3d(0, 0, ${translateZ}px) scale(${scale})`

          return (
            <div key={`work-${work.OeuvreID}`} className="w-depth-item" style={{
              opacity,
              transform: itemTransform,
              zIndex,
            }}>
              <div className="w-artwork-wrap">
                <div className="w-image-container" style={{
                  // @ts-ignore
                  '--img-radius': `${cornerRadius}%`,
                  '--painting-shadow': paintingShadow,
                } as React.CSSProperties}>
                  <img
                    src={imgSrc}
                    alt={work.Titre ?? ''}
                    className="w-main-img"
                             style={{ '--burns-zoom': burnSnapshot.get(idx) ?? 1 } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* caption now in fixed overlay — removed from depth item */}
            </div>
          )
        })}
      </div>

      {/* Work caption — fades per distance, hard-hidden at end */}
      {activeWork && (
        <div
          className="w-caption"
          style={{ opacity: atEnd ? 0 : captionOpacity, pointerEvents: atEnd ? 'none' : 'auto' }}
        >
          <h3 className="w-work-title">{activeWork.Titre ?? t('pub_untitled')}</h3>
          <div className="w-work-details">
            <span>{yearOf(activeWork.Annee)}</span>
            {activeWork.Hauteur && activeWork.Largeur && (
              <span>{activeWork.Hauteur} × {activeWork.Largeur} cm</span>
            )}
          </div>
        </div>
      )}

      {/* End overlay — separate entity, click to go back to top */}
      {atEnd && (
        <div
          onClick={() => { targetDepth.current = 0 }}
          style={{
            position: 'fixed', top: '50%', left: 'clamp(24px, 5vw, 64px)',
            transform: 'translateY(-50%)',
            zIndex: 200, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: 16,
            opacity: endOpacity,
          }}
        >
          <div style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 'clamp(20px, 3.5vw, 56px)',
            color: '#1a1816', letterSpacing: '-0.04em', lineHeight: 1,
            textShadow: '0 0 24px rgba(255,255,255,1), 0 0 48px rgba(255,255,255,0.9)',
          }}>
            ↑
          </div>
          <div style={{
            fontSize: 8, letterSpacing: 4, textTransform: 'uppercase', color: '#6a6660',
            textShadow: '0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.8)',
          }}>
            retour
          </div>
        </div>
      )}

      <div className="w-scroll-hint">↓ scroll</div>
    </div>
  )
}
