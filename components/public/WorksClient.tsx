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
  | { type: 'work'; data: Work; collectionId?: string }
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
    
    activeCollections.forEach((col, colIdx) => {
      items.push({ type: 'header', title: col.title, subtitle: col.description })
      
      const colMatch = normalizeTheme(col.theme)
      const colWorks = works.filter(w => {
        if (!w.txtImageNameLink) return false
        if (!col.theme) return true
        return w.themes.some(th => normalizeTheme(th).includes(colMatch))
      })
      
      colWorks.forEach(w => {
        items.push({ type: 'work', data: w, collectionId: col.id })
      })
    })

    if (items.length === 0) {
      works.filter(w => w.txtImageNameLink).forEach(w => items.push({ type: 'work', data: w }))
    }
    return items
  }, [works, collections])

  const targetDepth = useRef(0)
  const currentDepth = useRef(0)
  const [displayDepth, setDisplayDepth] = useState(0)

  const STEP = 6000 
  const BIRTH_DIST = 24000 // Further birth for better needle-point feel

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      targetDepth.current += e.deltaY * 2.5 
      const maxScroll = (sequence.length - 1) * STEP + 2000
      targetDepth.current = Math.max(0, Math.min(targetDepth.current, maxScroll))
    }
    window.addEventListener('wheel', handleWheel, { passive: true })

    let rafId: number
    const animate = () => {
      const viscosity = 0.04 
      const delta = targetDepth.current - currentDepth.current
      currentDepth.current += delta * viscosity
      setDisplayDepth(currentDepth.current)
      document.getElementById('grain')?.style.setProperty('--scroll-y', currentDepth.current.toString())
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      cancelAnimationFrame(rafId)
    }
  }, [sequence.length])

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
          pointer-events: none; z-index: 5;
          opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          transform: translateY(calc(var(--scroll-y, 0) * -0.05px));
        }

        .w-paper-bg {
          position: fixed; inset: 0; 
          background: radial-gradient(circle at center, #fcfaf7 0%, #e8e6e1 100%);
          z-index: 1; pointer-events: none;
        }

        .w-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 2000;
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 48px; background: transparent; pointer-events: auto;
        }
        .w-logo { font-size: 10px; letter-spacing: 5px; text-transform: uppercase; color: #1a1816; text-decoration: none; font-weight: 500; }
        .w-navlinks { display: flex; gap: 40px; align-items: center; }
        .w-navlink { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #7a7670; text-decoration: none; transition: color .3s; }
        .w-navlink:hover, .w-navlink.active { color: #1a1816; }
        .w-lang { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #7a7670; background: none; border: 1px solid #c8c4be; padding: 3px 8px; cursor: pointer; transition: all .15s; font-family: inherit; }
        .w-lang:hover { color: #1a1816; border-color: #7a7670; }

        .w-depth-item {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          will-change: transform, opacity; pointer-events: none;
          transform-style: preserve-3d;
        }

        .w-artwork-wrap {
          position: relative; width: 100vw; height: 100vh;
          display: flex; align-items: center; justify-content: center;
          mix-blend-mode: multiply;
        }

        .w-image-container {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          background: transparent;
          mask-image: var(--breakthrough-mask);
          -webkit-mask-image: var(--breakthrough-mask);
          mask-repeat: no-repeat;
          -webkit-mask-repeat: no-repeat;
          mask-position: center;
          -webkit-mask-position: center;
        }

        .w-main-img {
          max-width: 50vw; max-height: 50vh;
          display: block;
          mix-blend-mode: multiply;
          image-rendering: high-quality;
          backface-visibility: hidden;
        }

        .w-radial-vignette {
          position: absolute; inset: -1000px;
          background: var(--radial-vignette);
          z-index: 10; pointer-events: none;
          opacity: 0.98;
        }

        .w-parallax-meta {
          position: absolute; top: 50%; 
          left: 64px; /* Slightly more margin for big text */
          width: 35vw; max-width: 500px; z-index: 100;
          pointer-events: auto; transition: opacity 0.5s ease-out;
          will-change: transform;
          transform-style: preserve-3d;
          transform: translateY(-50%) rotateX(30deg); 
          text-align: left;
        }

        .w-parallax-header {
          position: relative; width: 100vw; height: 100vh;
          display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
          text-align: left;
          padding-left: 64px;
          transform-style: preserve-3d;
          transform: rotateX(15deg); 
        }
        /* BIGGER TEXT ENGINE */
        .w-header-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(80px, 15vw, 240px);
          color: #1a1816; letter-spacing: -0.05em; line-height: 0.85;
          margin-bottom: 48px;
        }
        .w-header-subtitle {
          max-width: 600px; font-size: 14px; line-height: 1.6; letter-spacing: 0.1em; 
          text-transform: uppercase; color: #8a8680; text-align: left; font-weight: 400;
        }

        .w-work-title { 
          font-family: 'Instrument Serif', serif; font-size: clamp(32px, 6vw, 72px); 
          color: #1a1816; font-weight: 400; margin-bottom: 32px; letter-spacing: -0.04em; line-height: 1; 
        }
        .w-work-details { display: flex; flex-direction: column; gap: 16px; font-size: 11px; color: #b0aca6; letter-spacing: 6px; text-transform: uppercase; }

        .w-scroll-hint {
          position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
          font-size: 8px; letter-spacing: 4px; color: #b0aca6; text-transform: uppercase;
          z-index: 100; opacity: 0.3;
        }
      `}</style>

      <div className="w-paper-bg"></div>
      <div className="grain-overlay" id="grain"></div>

      <PublicNav active="works" prefix="w" />

      <div className="w-viewport">
        {sequence.map((item, idx) => {
          const centerPos = idx * STEP
          const dist = displayDepth - centerPos
          
          const opacity = dist < 12000 ? 1 : Math.max(0, 1 - (dist - 12000) / 2000)
          
          let translateZ = 0
          let scale = 1
          
          if (dist < 0) {
            const progress = Math.max(0, (dist + BIRTH_DIST) / BIRTH_DIST)
            /* NEEDLE-POINT IMAGE: Steeper curve for microscopic birth */
            translateZ = -BIRTH_DIST + (BIRTH_DIST * progress)
            scale = 0 + (1 - 0) * Math.pow(progress, 8.0) 
          } else {
            translateZ = (dist / STEP) * 2000 
            scale = 1 + (dist / STEP) * 4
          }

          if (opacity <= 0 && Math.abs(dist) > BIRTH_DIST + 5000) return null

          const zIndex = 1000 - Math.floor(Math.abs(dist) / 50)

          if (item.type === 'header') {
            const headerZ = translateZ * 1.2 
            return (
              <div key={`header-${idx}`} className="w-depth-item" style={{
                opacity: Math.max(0, 1 - Math.abs(dist / 3000)),
                transform: `translate3d(0, 0, ${headerZ}px) scale(${scale * 0.8})`,
                zIndex: zIndex
              }}>
                <div className="w-parallax-header">
                  <h1 className="w-header-title">{item.title}</h1>
                  {item.subtitle && <p className="w-header-subtitle">{item.subtitle}</p>}
                </div>
              </div>
            )
          }

          const work = item.data
          let maskRadius = 45 
          let vignetteRadius = 55
          
          if (dist > -800) {
            const arrivalProgress = Math.min(1, Math.max(0, (dist + 800) / 1000))
            maskRadius = 45 + (arrivalProgress * 300)
            vignetteRadius = 55 + (arrivalProgress * 300)
          }
          
          const breakthroughMask = `radial-gradient(circle at center, black 0%, black 10%, transparent ${maskRadius}%)`
          const vignette = `radial-gradient(circle at center, transparent 0%, transparent 20%, black ${vignetteRadius}%)`

          const textZ = translateZ * 0.8 
          const textOpacity = Math.max(0, 1 - Math.abs(dist / 1200))

          return (
            <div key={`work-${work.OeuvreID}`} className="w-depth-item" style={{ 
              opacity, 
              transform: `translate3d(0, 0, ${translateZ}px) scale(${scale})`,
              zIndex: zIndex,
              // @ts-ignore
              '--breakthrough-mask': breakthroughMask,
              // @ts-ignore
              '--radial-vignette': vignette
            }}>
              <div className="w-artwork-wrap">
                <div className="w-image-container">
                  <img
                    src={imageUrl(work.txtImageNameLink) ?? undefined}
                    alt={work.Titre ?? ''}
                    className="w-main-img"
                  />
                  <div className="w-radial-vignette"></div>
                </div>
              </div>

              <div 
                className="w-parallax-meta"
                style={{ 
                  opacity: textOpacity,
                  transform: `translate3d(0, 0, ${textZ - translateZ}px) rotateX(30deg)` 
                }}
              >
                <h3 className="w-work-title">{work.Titre ?? t('pub_untitled')}</h3>
                <div className="w-work-details">
                  <span className="w-work-year">{yearOf(work.Annee)}</span>
                  <span className="max-w-[200px]">{work.Hauteur && work.Largeur ? `${work.Hauteur} X ${work.Largeur} CM` : ''}</span>
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
