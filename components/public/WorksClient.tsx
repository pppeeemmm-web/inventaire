'use client'

import { useI18n } from '@/lib/i18n/context'
import { imageUrl, yearOf } from '@/lib/data'
import { useEffect, useState, useRef, useMemo } from 'react'
import PublicNav from './PublicNav'

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

function FlameText({ text }: { text: string }) {
  const plain = htmlToPlain(text)
  const formatted = plain.replace(/\./g, ' /').replace(/\n/g, ' █ ')
  return (
    <p style={{
      maxWidth: 'min(640px, 80vw)', fontSize: 'clamp(9px, 1.1vw, 13px)',
      lineHeight: 1.9, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: '#8a8680', textAlign: 'justify', wordSpacing: '0.3em',
      fontFamily: 'JetBrains Mono, monospace', margin: '0 auto',
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
  isRound: boolean
}

interface Collection {
  id: string
  title_fr: string
  title_en: string
  description_fr: string
  description_en: string
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
  const { t, lang } = useI18n()

  const sequence = useMemo(() => {
    const items: SequenceItem[] = []
    const activeCollections = collections.filter(c => c.is_active)
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
    activeCollections.forEach(col => {
      const title = lang === 'en' ? (col.title_en || col.title_fr) : (col.title_fr || col.title_en)
      const subtitle = lang === 'en' ? (col.description_en || col.description_fr) : (col.description_fr || col.description_en)
      items.push({ type: 'header', title, subtitle })
    })
    return items
  }, [works, collections, lang])

  const lastWorkIdx = useMemo(() =>
    sequence.reduce((acc, s, i) => s.type === 'work' ? i : acc, -1)
  , [sequence])

  const targetDepth  = useRef(0)
  const currentDepth = useRef(0)
  const [displayDepth, setDisplayDepth] = useState(0)
  const [activeWork, setActiveWork]     = useState<Work | null>(null)
  const [captionOpacity, setCaptionOpacity] = useState(0)
  const [endOpacity, setEndOpacity]     = useState(0)

  const burnZooms  = useRef<Map<number, number>>(new Map())
  const burnTicks  = useRef(0)
  const settledIdx = useRef<number>(-1)
  const activePainting = useRef<number>(-1)

  const STEP       = 6000
  const BIRTH_DIST = 60000

  const touchLastY  = useRef<number | null>(null)
  const touchVelY   = useRef(0)

  useEffect(() => {
    // maxScroll: enough to push endProgress to 1, plus a bit of resistance room
    const maxScroll = lastWorkIdx * STEP + STEP * 1.5

    const softClamp = (v: number) => {
      if (v < 0) return 0
      if (v <= maxScroll) return v
      return maxScroll + (v - maxScroll) * 0.1
    }

    const handleWheel = (e: WheelEvent) => {
      targetDepth.current = softClamp(targetDepth.current + e.deltaY * 2.5)
    }
    const handleTouchStart = (e: TouchEvent) => {
      touchLastY.current = e.touches[0].clientY
      touchVelY.current  = 0
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (touchLastY.current === null) return
      const dy = touchLastY.current - e.touches[0].clientY
      touchVelY.current  = dy
      touchLastY.current = e.touches[0].clientY
      targetDepth.current = softClamp(targetDepth.current + dy * 6)
    }
    const handleTouchEnd = () => {
      const coast = () => {
        if (Math.abs(touchVelY.current) < 0.5) return
        touchVelY.current *= 0.92
        targetDepth.current = softClamp(targetDepth.current + touchVelY.current * 4)
        requestAnimationFrame(coast)
      }
      requestAnimationFrame(coast)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') targetDepth.current = softClamp(targetDepth.current + STEP)
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') targetDepth.current = softClamp(targetDepth.current - STEP)
    }

    window.addEventListener('wheel',      handleWheel,      { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove',  handleTouchMove,  { passive: true })
    window.addEventListener('touchend',   handleTouchEnd)
    window.addEventListener('keydown',    handleKey)

    let rafId: number
    const animate = () => {
      currentDepth.current += (targetDepth.current - currentDepth.current) * 0.04
      setDisplayDepth(currentDepth.current)
      document.getElementById('grain')?.style.setProperty('--scroll-y', currentDepth.current.toString())

      const activeIdx = Math.round(currentDepth.current / STEP)
      const item = sequence[activeIdx]

      // End overlay: driven by targetDepth — reaches 1 without viscosity lag
      const lastCenter  = lastWorkIdx * STEP
      const endProgress = Math.max(0, Math.min(1, (targetDepth.current - lastCenter - STEP * 0.3) / (STEP * 0.7)))
      setEndOpacity(endProgress)

      // Caption
      if (endProgress > 0) {
        setCaptionOpacity(0)
      } else if (item?.type === 'work') {
        const dist = currentDepth.current - activeIdx * STEP
        setCaptionOpacity(Math.max(0, 1 - Math.abs(dist / 1200)))
        if (activePainting.current !== activeIdx) {
          setActiveWork(item.data)
          activePainting.current = activeIdx
        }
      } else {
        setCaptionOpacity(0)
      }

      // Ken Burns
      const nearestWorkIdx = Math.round(currentDepth.current / STEP)
      const nearestItem    = sequence[nearestWorkIdx]
      const distToCenter   = Math.abs(currentDepth.current - nearestWorkIdx * STEP)
      const settled        = distToCenter < STEP * 0.25

      if (nearestItem?.type === 'work' && settled) {
        if (settledIdx.current !== nearestWorkIdx) {
          settledIdx.current = nearestWorkIdx
          burnTicks.current  = 0
          burnZooms.current.set(nearestWorkIdx, 1)
        }
        burnTicks.current += 1
        const t = 1 - Math.exp(-burnTicks.current / 180)
        burnZooms.current.set(nearestWorkIdx, 1 + 0.48 * t)
      } else if (nearestItem?.type === 'work' && targetDepth.current < nearestWorkIdx * STEP) {
        // Scrolling back up — decay zoom
        const cur = burnZooms.current.get(nearestWorkIdx) ?? 1
        burnZooms.current.set(nearestWorkIdx, cur > 1.001 ? 1 + (cur - 1) * 0.94 : 1)
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
  }, [sequence, lastWorkIdx])

  const [burnSnapshot, setBurnSnapshot] = useState<Map<number, number>>(new Map())
  useEffect(() => {
    let raf: number
    const tick = () => { setBurnSnapshot(new Map(burnZooms.current)); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="w-page-enter">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: #e8e6e1; font-family: 'JetBrains Mono', monospace; color: #3a3834;
          height: 100vh; overflow: hidden; -webkit-font-smoothing: antialiased;
        }
        @keyframes w-fadein { from { opacity: 0; } to { opacity: 1; } }
        .w-page-enter { animation: w-fadein 2s ease forwards; }

        .w-viewport {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          overflow: hidden; pointer-events: none; z-index: 10;
          display: flex; align-items: center; justify-content: center;
          perspective: 1200px; perspective-origin: center; transform-style: preserve-3d;
        }
        .grain-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 200%;
          pointer-events: none; z-index: 5; opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          transform: translateY(calc(var(--scroll-y, 0) * -0.05px));
        }
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
          will-change: transform, opacity; pointer-events: none; transform-style: preserve-3d;
        }
        .w-artwork-wrap {
          position: relative; width: 100vw; height: 100vh;
          display: flex; align-items: center; justify-content: center;
        }
        .w-image-container {
          position: relative; display: flex; align-items: center; justify-content: center;
          filter: var(--painting-filter, none);
          isolation: isolate;
        }
        .w-img-clip {
          border-radius: var(--img-radius);
          overflow: hidden;
        }
        .w-main-img {
          width: auto; height: auto;
          max-width: min(94vw, 1600px); max-height: min(86vh, 1200px);
          display: block; image-rendering: high-quality; backface-visibility: hidden;
          transform-origin: center center; transform: scale(var(--burns-zoom, 1));
          will-change: transform;
        }
        .w-parallax-header {
          position: relative; width: 100vw; height: 100vh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 0 clamp(32px, 8vw, 120px);
          transform-style: preserve-3d; transform: rotateX(15deg); cursor: pointer;
        }
        .w-header-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(80px, 15vw, 240px);
          color: #1a1816; letter-spacing: -0.05em; line-height: 0.85; margin-bottom: 48px;
          transition: opacity 0.3s;
        }
        .w-parallax-header:hover .w-header-title { opacity: 0.6; }

        /* ── Nav ── */
        .w-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 300;
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px clamp(24px, 5vw, 64px); pointer-events: auto;
        }
        .w-logo {
          font-family: 'Instrument Serif', serif; font-size: 16px;
          color: #1a1816; text-decoration: none; letter-spacing: 0.04em;
          text-shadow: 0 0 20px rgba(255,255,255,0.9), 0 0 40px rgba(255,255,255,0.6);
          transition: opacity 0.2s;
        }
        .w-logo:hover { opacity: 0.5; }
        .w-navlinks { display: flex; align-items: center; gap: clamp(20px, 3vw, 40px); }
        .w-navlink {
          font-size: 8px; letter-spacing: 4px; text-transform: uppercase;
          color: #6a6660; text-decoration: none;
          text-shadow: 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.8);
          transition: color 0.2s;
        }
        .w-navlink:hover, .w-navlink.active { color: #1a1816; }
        .w-lang {
          font-size: 8px; letter-spacing: 4px; text-transform: uppercase;
          color: #6a6660; background: none; border: none; cursor: pointer;
          text-shadow: 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.8);
          font-family: inherit; padding: 0; transition: color 0.2s;
        }
        .w-lang:hover { color: #1a1816; }

        /* ── Caption ── */
        .w-caption {
          position: fixed; top: 50%; left: clamp(24px, 5vw, 64px); transform: translateY(-50%);
          width: clamp(140px, 28vw, 560px); z-index: 200; pointer-events: auto; cursor: pointer;
        }
        @media (max-width: 640px) {
          .w-caption {
            top: auto; bottom: clamp(60px, 10vh, 100px);
            left: 50%; transform: translateX(-50%); width: 90vw; text-align: center;
          }
        }
        .w-caption:hover .w-work-title { opacity: 0.55; }
        .w-work-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(20px, 3.5vw, 56px);
          color: #1a1816; font-weight: 400; margin-bottom: 16px;
          letter-spacing: -0.04em; line-height: 1;
          text-shadow: 0 0 24px rgba(255,255,255,1), 0 0 48px rgba(255,255,255,0.9), 0 0 80px rgba(255,255,255,0.6);
          transition: opacity 0.25s;
        }
        .w-work-details {
          display: flex; flex-direction: column; gap: 8px;
          font-size: 9px; letter-spacing: 5px; text-transform: uppercase; color: #6a6660;
          text-shadow: 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.8);
        }

        /* ── Scroll hint ── */
        @keyframes w-hint-pulse {
          0%, 100% { opacity: 0.25; transform: translateX(-50%) translateY(0); }
          50%       { opacity: 0.5;  transform: translateX(-50%) translateY(4px); }
        }
        .w-scroll-hint {
          position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
          font-size: 8px; letter-spacing: 4px; color: #b0aca6; text-transform: uppercase;
          z-index: 100; animation: w-hint-pulse 2.4s ease-in-out infinite;
          text-shadow: 0 0 12px rgba(255,255,255,1); transition: opacity 0.6s;
        }
      `}</style>

      <div className="w-paper-bg" />
      <div className="grain-overlay" id="grain" />
      <PublicNav active="works" prefix="w" />

      <div className="w-viewport">
        {sequence.map((item, idx) => {
          const centerPos = idx * STEP
          const dist      = displayDepth - centerPos

          const rawOpacity = dist < 0
            ? Math.pow(Math.max(0, (dist + BIRTH_DIST) / BIRTH_DIST), 4)
            : Math.max(0, 1 - Math.max(0, dist - STEP * 0.3) / (STEP * 0.4))
          const opacity = rawOpacity

          let translateZ = 0
          let scale = 1
          if (dist < 0) {
            const progress  = Math.max(0, (dist + BIRTH_DIST) / BIRTH_DIST)
            translateZ      = -BIRTH_DIST + BIRTH_DIST * progress
            const remapped  = Math.max(0, (progress - 0.6) / 0.4)
            scale           = Math.pow(remapped, 1.8)
          }

          if (opacity <= 0 && Math.abs(dist) > BIRTH_DIST + 5000) return null

          const zIndex = 1000 - Math.floor(Math.abs(dist) / 50)

          if (item.type === 'header') {
            return (
              <div key={`header-${idx}`} className="w-depth-item" style={{
                opacity: Math.max(0, 1 - Math.abs(dist / 3000)),
                transform: `translate3d(0, 0, ${translateZ * 1.2}px) scale(${scale * 0.8})`,
                zIndex: 252, pointerEvents: Math.abs(dist) < 2000 ? 'auto' : 'none',
              }} onClick={() => { targetDepth.current = 0 }}>
                <div className="w-parallax-header">
                  <h1 className="w-header-title">{item.title}</h1>
                  {item.subtitle && <FlameText text={item.subtitle} />}
                </div>
              </div>
            )
          }

          const work = item.data
          const isFirstWork = item.workIndex === 0
          let slideTranslateX = 0, slideRotateY = 0
          if (isFirstWork && dist < 0) {
            const p     = Math.max(0, Math.min(1, (dist + BIRTH_DIST) / BIRTH_DIST))
            const eased = Math.pow(p, 0.5)
            slideTranslateX = (1 - eased) * 160
            slideRotateY    = (1 - eased) * 42
          }

          const approachWindow = STEP * 2
          const shapeProgress  = dist < 0 ? Math.max(0, Math.min(1, (dist + approachWindow) / approachWindow)) : 1
          const cornerRadius   = work.isRound ? 50 : Math.round((1 - shapeProgress) * 50)

          const shadowIntensity = Math.max(0, 1 - Math.abs(dist) / (STEP * 1.5))
          const shadowBlur      = Math.round(shadowIntensity * 80)
          const shadowAlpha     = (shadowIntensity * 0.45).toFixed(2)
          const paintingFilter  = shadowIntensity > 0.05
            ? `drop-shadow(-${Math.round(shadowIntensity * 28)}px ${Math.round(shadowIntensity * 36)}px ${shadowBlur}px rgba(20,16,10,${shadowAlpha})) drop-shadow(-${Math.round(shadowIntensity * 8)}px ${Math.round(shadowIntensity * 12)}px ${Math.round(shadowIntensity * 22)}px rgba(20,16,10,${(shadowIntensity * 0.25).toFixed(2)}))`
            : 'none'

          const imgSrc      = imageUrl(work.txtImageNameLink) ?? undefined
          const itemTransform = isFirstWork
            ? `translate3d(${slideTranslateX}vw, 0, ${translateZ}px) rotateY(${slideRotateY}deg) scale(${scale})`
            : `translate3d(0, 0, ${translateZ}px) scale(${scale})`

          return (
            <div key={`work-${work.OeuvreID}`} className="w-depth-item" style={{ opacity, transform: itemTransform, zIndex }}>
              <div className="w-artwork-wrap">
                <div className="w-image-container" style={{
                  '--painting-filter': paintingFilter,
                } as React.CSSProperties}>
                  <div className="w-img-clip" style={{
                    '--img-radius': cornerRadius > 0 ? `${cornerRadius}%` : '5px',
                  } as React.CSSProperties}>
                    <img
                      src={imgSrc}
                      alt={work.Titre ?? ''}
                      className="w-main-img"
                      style={{ '--burns-zoom': burnSnapshot.get(idx) ?? 1 } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Work caption */}
      {activeWork && (
        <div className="w-caption" style={{ opacity: endOpacity > 0 ? 0 : captionOpacity, pointerEvents: endOpacity > 0 ? 'none' : 'auto' }}>
          <h3 className="w-work-title">{activeWork.Titre ?? t('pub_untitled')}</h3>
          <div className="w-work-details">
            <span>{yearOf(activeWork.Annee)}</span>
            {activeWork.Hauteur && activeWork.Largeur && (
              <span>{activeWork.Hauteur} × {activeWork.Largeur} cm</span>
            )}
          </div>
        </div>
      )}

      {/* Retour button — shown when at end, above everything */}
      <div
        onClick={() => { if (endOpacity > 0) targetDepth.current = 0 }}
        style={{
          position: 'fixed', bottom: 48, right: 'clamp(24px, 5vw, 64px)',
          zIndex: 300, opacity: endOpacity,
          pointerEvents: endOpacity > 0 ? 'auto' : 'none',
          cursor: endOpacity > 0 ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}
      >
        <div style={{
          fontFamily: 'Instrument Serif, serif', fontSize: 32,
          color: '#1a1816', lineHeight: 1,
        }}>↑</div>
        <div style={{ fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#6a6660' }}>
          retour
        </div>
      </div>

      <div className="w-scroll-hint" style={{ opacity: displayDepth < 200 ? undefined : 0 }}>
        ↓ scroll
      </div>
    </div>
  )
}
