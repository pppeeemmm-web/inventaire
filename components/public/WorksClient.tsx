'use client'

import { useI18n } from '@/lib/i18n/context'
import { imageUrl, yearOf } from '@/lib/data'
import { useEffect, useState, useRef, useMemo } from 'react'
import PublicNav from './PublicNav'

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
    activeCollections.forEach(col => {
      items.push({ type: 'header', title: col.title, subtitle: col.description })
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
    return items
  }, [works, collections])

  const targetDepth  = useRef(0)
  const currentDepth = useRef(0)
  const [displayDepth, setDisplayDepth] = useState(0)

  // Ken Burns: slow zoom per-painting, resets when a new painting hits center
  const burnZoom      = useRef(1)
  const burnTarget    = useRef(1)
  const activePainting = useRef<number>(-1)

  const STEP       = 6000
  const BIRTH_DIST = 60000

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      targetDepth.current += e.deltaY * 2.5
      const maxScroll = (sequence.length - 1) * STEP + 2000
      targetDepth.current = Math.max(0, Math.min(targetDepth.current, maxScroll))
    }
    window.addEventListener('wheel', handleWheel, { passive: true })

    let rafId: number
    const animate = () => {
      // Depth easing
      const viscosity = 0.04
      currentDepth.current += (targetDepth.current - currentDepth.current) * viscosity
      setDisplayDepth(currentDepth.current)
      document.getElementById('grain')?.style.setProperty('--scroll-y', currentDepth.current.toString())

      // Ken Burns: find active painting index
      const activeIdx = Math.round(currentDepth.current / STEP)
      const item = sequence[activeIdx]
      if (item?.type === 'work') {
        if (activePainting.current !== activeIdx) {
          // New painting arrived — reset zoom
          activePainting.current = activeIdx
          burnZoom.current = 1
          burnTarget.current = 1.18
        }
        // Slowly creep toward target
        burnZoom.current += (burnTarget.current - burnZoom.current) * 0.002
      }

      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      cancelAnimationFrame(rafId)
    }
  }, [sequence])

  // Read burn zoom each render via ref — avoids re-render overhead
  const [burnValue, setBurnValue] = useState(1)
  useEffect(() => {
    let raf: number
    const tick = () => {
      setBurnValue(burnZoom.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          background: #e8e6e1; font-family: 'JetBrains Mono', monospace; color: #3a3834;
          height: 100vh; overflow: hidden;
          -webkit-font-smoothing: antialiased;
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
          max-width: min(78vw, 1100px); max-height: min(80vh, 800px);
          display: block;
          image-rendering: high-quality;
          backface-visibility: hidden;
          transform-origin: center center;
          transform: scale(var(--burns-zoom, 1));
          will-change: transform;
        }

        /* RGB channel layers — absolutely positioned, blend over image */
        .w-rgb-r, .w-rgb-g, .w-rgb-b {
          position: absolute; inset: 0;
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: var(--rgb-opacity, 0);
        }
        .w-rgb-r img { filter: url(#filter-red);   width: 100%; height: 100%; object-fit: cover; }
        .w-rgb-g img { filter: url(#filter-green); width: 100%; height: 100%; object-fit: cover; }
        .w-rgb-b img { filter: url(#filter-blue);  width: 100%; height: 100%; object-fit: cover; }

        .w-parallax-header {
          position: relative; width: 100vw; height: 100vh;
          display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
          padding-left: 64px;
          transform-style: preserve-3d;
          transform: rotateX(15deg);
        }
        .w-header-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(80px, 15vw, 240px);
          color: #1a1816; letter-spacing: -0.05em; line-height: 0.85; margin-bottom: 48px;
        }
        .w-header-subtitle {
          max-width: 600px; font-size: 14px; line-height: 1.6; letter-spacing: 0.1em;
          text-transform: uppercase; color: #8a8680; font-weight: 400;
        }

        .w-parallax-meta {
          position: absolute; top: 50%; left: 64px;
          width: 30vw; max-width: 420px; z-index: 100;
          pointer-events: auto;
          will-change: transform;
          transform-style: preserve-3d;
          transform: translateY(-50%) rotateX(30deg);
        }
        .w-work-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(28px, 4vw, 56px);
          color: #1a1816; font-weight: 400; margin-bottom: 24px;
          letter-spacing: -0.04em; line-height: 1;
          text-shadow: -6px 10px 20px rgba(20,16,10,0.25);
        }
        .w-work-details {
          display: flex; flex-direction: column; gap: 12px; font-size: 10px; color: #b0aca6; letter-spacing: 5px; text-transform: uppercase;
          text-shadow: -4px 6px 12px rgba(20,16,10,0.2);
        }

        .w-scroll-hint {
          position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
          font-size: 8px; letter-spacing: 4px; color: #b0aca6; text-transform: uppercase;
          z-index: 100; opacity: 0.3;
        }
      `}</style>

      {/* SVG filters for RGB channel separation */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="filter-red">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
          </filter>
          <filter id="filter-green">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
          </filter>
          <filter id="filter-blue">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
          </filter>
        </defs>
      </svg>

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
            const remapped = Math.max(0, (progress - 0.85) / 0.15)
            scale = Math.pow(remapped, 3.0)
          }
          // post-center: translateZ=0, scale=1 — fade handles exit

          if (opacity <= 0 && Math.abs(dist) > BIRTH_DIST + 5000) return null

          const zIndex = 1000 - Math.floor(Math.abs(dist) / 50)

          if (item.type === 'header') {
            return (
              <div key={`header-${idx}`} className="w-depth-item" style={{
                opacity: Math.max(0, 1 - Math.abs(dist / 3000)),
                transform: `translate3d(0, 0, ${translateZ * 1.2}px) scale(${scale * 0.8})`,
                zIndex,
              }}>
                <div className="w-parallax-header">
                  <h1 className="w-header-title">{item.title}</h1>
                  {item.subtitle && <p className="w-header-subtitle">{item.subtitle}</p>}
                </div>
              </div>
            )
          }

          const work = item.data
          const isFirstWork = item.workIndex === 0
          const isActive = activePainting.current === idx

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

          // RGB split: offset diverges when far, converges to 0 at center
          // Only active while approaching (dist < 0)
          const rgbDist    = Math.max(0, -dist) // 0 at center, grows when approaching
          const rgbOffset  = Math.min(rgbDist / STEP, 1) // 0–1
          // Depth offset per channel (translateZ)
          const rZ = translateZ - rgbOffset * 800
          const gZ = translateZ
          const bZ = translateZ + rgbOffset * 800
          // RGB layers visible only during approach, fade away at arrival
          const rgbOpacity = Math.max(0, Math.min(0.6, rgbOffset * 1.5))

          const textZ       = translateZ * 0.8
          const textOpacity = Math.max(0, 1 - Math.abs(dist / 1200))
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
              {/* RGB channel layers at different depths */}
              {rgbOpacity > 0.01 && <>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: `translate3d(0, 0, ${rZ - translateZ}px)`,
                  opacity: rgbOpacity,
                  pointerEvents: 'none',
                  mixBlendMode: 'screen',
                }}>
                  <img src={imgSrc} alt="" style={{
                    maxWidth: 'min(78vw, 1100px)', maxHeight: 'min(80vh, 800px)',
                    filter: 'url(#filter-red)',
                    display: 'block',
                  }} />
                </div>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: `translate3d(0, 0, ${bZ - translateZ}px)`,
                  opacity: rgbOpacity,
                  pointerEvents: 'none',
                  mixBlendMode: 'screen',
                }}>
                  <img src={imgSrc} alt="" style={{
                    maxWidth: 'min(78vw, 1100px)', maxHeight: 'min(80vh, 800px)',
                    filter: 'url(#filter-blue)',
                    display: 'block',
                  }} />
                </div>
              </>}

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
                    style={{ '--burns-zoom': isActive ? burnValue : 1 } as React.CSSProperties}
                  />
                </div>
              </div>

              <div
                className="w-parallax-meta"
                style={{
                  opacity: textOpacity,
                  transform: `translate3d(0, 0, ${textZ - translateZ}px) rotateX(30deg)`,
                }}
              >
                <h3 className="w-work-title">{work.Titre ?? t('pub_untitled')}</h3>
                <div className="w-work-details">
                  <span>{yearOf(work.Annee)}</span>
                  <span>{work.Hauteur && work.Largeur ? `${work.Hauteur} × ${work.Largeur} cm` : ''}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="w-scroll-hint">↓ scroll</div>
    </>
  )
}
