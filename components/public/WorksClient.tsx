'use client'

import { useI18n } from '@/lib/i18n/context'
import PublicNav from './PublicNav'
import { imageUrl, yearOf } from '@/lib/data'
import { useEffect, useState, useRef } from 'react'

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

interface Props {
  works: Work[]
  collections: Collection[]
}

function PushedLiquidWorkItem({ work, index }: { work: Work; index: number }) {
  const { t } = useI18n()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  
  // Animation state: Ultra-Viscosity Liquid LERP
  const [displayZoom, setDisplayZoom] = useState(1)
  const targetZoom = useRef(1)
  const currentZoom = useRef(1)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { setIsVisible(entry.isIntersecting) },
      { threshold: 0.01 }
    )
    if (anchorRef.current) observer.observe(anchorRef.current)

    let rafId: number
    
    const animate = () => {
      // Pushing the viscosity: 0.035 is extremely heavy and liquid
      const viscosity = 0.035 
      const delta = targetZoom.current - currentZoom.current
      
      if (Math.abs(delta) > 0.0001) {
        currentZoom.current += delta * viscosity
        setDisplayZoom(currentZoom.current)
      }
      
      rafId = requestAnimationFrame(animate)
    }

    const handleScroll = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      const vh = window.innerHeight
      const vCenter = vh / 2
      const anchorCenter = rect.top + rect.height / 2
      
      const distance = Math.abs(anchorCenter - vCenter)
      // Pushing the focus zone: 4x Viewport height for extreme gear reduction
      const maxDist = vh * 4.0
      const normalizedDist = Math.min(1, distance / maxDist)
      
      const smoothFactor = Math.cos(normalizedDist * Math.PI / 2)
      // Pushing peak scale to 3.0x
      targetZoom.current = 1 + (smoothFactor * 2.0)
    }

    rafId = requestAnimationFrame(animate)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const isLeft = index % 2 === 0
  const driftAmount = (displayZoom - 1) * 160 // Pushed counter-drift
  const infoStyle = {
    transform: `translate3d(${isLeft ? -driftAmount : driftAmount}px, 0, 0) translateZ(0)`,
    opacity: 1.15 - (displayZoom - 1) * 0.4
  }

  return (
    <div 
      className={`w-physical-item ${isVisible ? 'is-visible' : ''} ${isLeft ? 'is-left' : 'is-right'}`}
    >
      <div ref={anchorRef} className="w-anchor-box">
        <div className="w-item-inner">
          <div 
            className="w-artwork-container"
            style={{ transform: `scale3d(${displayZoom}, ${displayZoom}, 1) translateZ(0)` }}
          >
            <img
              src={imageUrl(work.txtImageNameLink) ?? undefined}
              alt={work.Titre ?? `Oeuvre #${work.OeuvreID}`}
              className="w-main-img"
            />
          </div>
          
          <div className="w-work-info" style={infoStyle}>
            <h3 className="w-work-title">{work.Titre ?? t('pub_untitled')}</h3>
            <div className="w-work-details">
              <span className="w-work-year">{yearOf(work.Annee)}</span>
              <span className="w-work-dot"></span>
              <span className="w-work-dim">
                {work.Hauteur && work.Largeur ? `${work.Hauteur} X ${work.Largeur} CM` : 'Dimensions on request'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WorksClient({ works, collections }: Props) {
  const { t } = useI18n()

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        .grain-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 200%;
          pointer-events: none; z-index: 9999; opacity: 0.05;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          /* Texture Parallax */
          transform: translateY(calc(var(--scroll-y, 0) * -0.05px));
        }

        html { height: auto; scroll-behavior: smooth; }
        html, body { background: #f2f0eb; font-family: 'JetBrains Mono', monospace; color: #3a3834; }
        body { overflow-y: auto; overflow-x: hidden; min-height: 100vh; -webkit-font-smoothing: antialiased; }

        .w-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 48px;
          background: rgba(242,240,235, 0.95); backdrop-filter: blur(40px);
          border-bottom: 1px solid rgba(0,0,0,0.03);
        }
        .w-logo { font-size: 10px; letter-spacing: 5px; text-transform: uppercase; color: #1a1816; text-decoration: none; font-weight: 500; }
        .w-navlinks { display: flex; gap: 40px; align-items: center; }
        .w-navlink { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; text-decoration: none; transition: all .3s; }
        .w-navlink:hover, .w-navlink.active { color: #1a1816; }
        
        .w-body { max-width: 1500px; margin: 0 auto; padding: 180px 48px 400px; }
        
        .w-collection { margin-bottom: 700px; }
        .w-col-intro { max-width: 900px; margin-bottom: 400px; }
        .w-col-label { font-size: 10px; letter-spacing: 12px; text-transform: uppercase; color: #c0bdb8; display: block; margin-bottom: 32px; }
        .w-col-title { font-family: 'Instrument Serif', serif; font-size: clamp(80px, 18vw, 220px); color: #1a1816; margin-bottom: 48px; font-weight: 400; line-height: 0.75; letter-spacing: -0.07em; }
        .w-col-desc { font-size: 20px; line-height: 1.65; color: #5a5752; max-width: 42ch; font-weight: 300; letter-spacing: -0.01em; }
        
        .w-physical-item {
          width: 100%; margin-bottom: 850px;
          opacity: 0; transform: translate3d(0, 80px, 0); transition: opacity 2.5s ease-out, transform 2.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .w-physical-item.is-visible { opacity: 1; transform: translate3d(0, 0, 0); }
        
        .w-anchor-box { width: 100%; position: relative; }

        .w-item-inner {
          display: flex; align-items: center; gap: 140px; width: 100%; position: relative;
        }
        .w-physical-item.is-left .w-item-inner { flex-direction: row; padding-right: 15%; }
        .w-physical-item.is-right .w-item-inner { flex-direction: row-reverse; padding-left: 15%; }

        .w-artwork-container {
          flex: 0 0 50%;
          position: relative;
          background: transparent;
          user-select: none;
          transform-origin: center center;
          display: flex; justify-content: center;
          will-change: transform;
        }
        .w-main-img {
          display: block; width: 100%; height: auto; max-height: 70vh; object-fit: contain;
          mix-blend-mode: multiply; position: relative; z-index: 2;
          pointer-events: none;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.04)) drop-shadow(0 15px 35px rgba(0,0,0,0.05));
        }
        
        .w-work-info { 
          flex: 0 0 35%; 
          padding-bottom: 150px;
          will-change: transform, opacity;
        }
        .w-work-title { font-family: 'Instrument Serif', serif; font-size: clamp(40px, 6vw, 64px); color: #1a1816; font-weight: 400; margin-bottom: 32px; letter-spacing: -0.04em; line-height: 1; }
        .w-work-details { display: flex; flex-direction: column; gap: 16px; font-size: 11px; color: #b0aca6; letter-spacing: 5px; text-transform: uppercase; }

        .w-footer { 
          padding: 350px 48px; border-top: 1px solid rgba(0,0,0,0.05);
          text-align: center; font-size: 10px; color: #b0aca6; letter-spacing: 6px; text-transform: uppercase;
        }

        @media (max-width: 1024px) {
          .w-item-inner { flex-direction: column !important; gap: 64px; padding: 0 !important; }
          .w-artwork-container { flex: 0 0 100%; }
          .w-work-info { flex: 0 0 100%; text-align: center; padding-bottom: 0; transform: none !important; opacity: 1 !important; }
          .w-physical-item { margin-bottom: 500px; }
        }
      `}</style>

      <div className="grain-overlay" id="grain"></div>
      <PublicNav active="works" prefix="w" />

      <script dangerouslySetInnerHTML={{ __html: `
        window.addEventListener('scroll', () => {
          document.getElementById('grain').style.setProperty('--scroll-y', window.scrollY);
        }, { passive: true });
      `}} />

      <div className="w-body">
        {collections.map((col) => {
          const colWorks = works.filter((w) => {
            if (!w.txtImageNameLink) return false
            if (!col.theme) return true
            const colMatch = normalizeTheme(col.theme)
            return w.themes.some(th => normalizeTheme(th).includes(colMatch))
          })

          return (
            <section key={col.id} className="w-collection">
              <div className="w-col-intro">
                <span className="w-col-label">{col.theme || 'Series'}</span>
                <h2 className="w-col-title">{col.title}</h2>
                {col.description && <p className="w-col-desc">{col.description}</p>}
              </div>

              <div className="w-curated-grid">
                {colWorks.map((w, idx) => (
                  <PushedLiquidWorkItem key={w.OeuvreID} work={w} index={idx} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="w-footer">
        &copy; {new Date().getFullYear()} PIERRE EMMANUEL MOULIN
      </footer>
    </>
  )
}
