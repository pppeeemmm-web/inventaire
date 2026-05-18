'use client'

import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import PublicNav from './PublicNav'
import WorksGrid from './WorksGrid'
import { trackView } from '@/lib/track'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'
import { worksForCollection } from './works-utils'
import type { Work, WorksMode, Collection } from './works-utils'

interface Props {
  works: Work[]
  modes: WorksMode[]
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

/** Per-card 3D transform. Center = face-on, neighbors rotate so inner edge faces viewer. */
function cardTransform(offset: number, reducedMotion: boolean, spacing = 780): {
  transform: string
  opacity: number
  zIndex: number
  visible: boolean
} {
  const abs = Math.abs(offset)
  const isMobileSpacing = spacing > 900
  const maxVisible = isMobileSpacing ? 1 : 3
  if (abs > maxVisible) return { transform: '', opacity: 0, zIndex: 0, visible: false }
  const tx = offset * spacing
  const ty = -abs * (isMobileSpacing ? 300 : 240)
  const ry = reducedMotion ? 0 : Math.sign(offset) * Math.min(abs, 1) * 5
  const opacity = isMobileSpacing ? (abs === 0 ? 1 : 0.35) : Math.max(0, 1 - abs * 0.22)
  const zIndex = 100 - abs
  const transform = `translate3d(${tx}px, 0, ${ty}px) rotateY(${ry}deg)`
  return { transform, opacity, zIndex, visible: true }
}

// Grain SVG data URI — shared between CSS and 3D wall plane
const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`

export default function WorksClient({ works, modes, hiddenNavRoutes, navOrder }: Props) {
  const { t, lang } = useI18n()
  const safeModes: WorksMode[] = modes.length > 0 ? modes : [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    layout: 'carousel', collections: [], outro_fr: '', outro_en: '',
  }]
  const mode = safeModes[0]
  const layout = mode.layout ?? 'carousel'

  const [activeChapterIdx, setActiveChapterIdx] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)
  const [trackFade, setTrackFade] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const posRef = useRef(0)
  const velRef = useRef(0)
  const rafRef = useRef<number | undefined>(undefined)
  const totalSlotsRef = useRef(0)

  // z-axis zoom: viewer approaches the gallery wall
  const zoomZRef = useRef(0)
  const [zoomZ, setZoomZ] = useState(0)
  const MAX_Z = 1800   // perspective 2400 → apparent scale 2400/600 = 4× at max

  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 })
  // Track which work's full-res image has loaded (gates zoom entry)
  const [loadedWorkId, setLoadedWorkId] = useState<number | null>(null)
  // Natural dimensions of the loaded center image — used for hi-res rasterization trick
  const [centerNaturalSize, setCenterNaturalSize] = useState<{ w: number; h: number } | null>(null)

  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const didDragRef = useRef(false)
  const isZoomedRef = useRef(false)

  const reducedMotion = useReducedMotion()

  useEffect(() => {
    void trackView('/works', null, null, getOrCreatePublicVisitorId())
  }, [])

  const chapter = mode.collections[Math.min(activeChapterIdx, Math.max(0, mode.collections.length - 1))]
  const chapterWorks = useMemo(() => {
    if (!chapter) {
      return works.filter(w => w.txtImageNameLink)
    }
    return worksForCollection(chapter, works)
  }, [chapter, works])

  const curatedGroupsNomatch = Boolean(chapter && chapterWorks.length === 0)

  const activeWork: Work | undefined = chapterWorks[activeIndex]
  // Derived: center card's full-res image is ready
  const centerImgLoaded = activeWork?.OeuvreID === loadedWorkId

  // Oversized-image rasterization trick: lay out img at its natural pixel dimensions,
  // scale it down to fit the card via transform — browser holds the full-res GPU texture.
  const hiResImgStyle = useMemo((): CSSProperties | undefined => {
    if (!centerNaturalSize || typeof window === 'undefined') return undefined
    const cardW = Math.min(window.innerWidth * 0.25, 400)
    const cardH = Math.min(window.innerHeight * 0.42, 460)
    const scale = Math.min(cardW / centerNaturalSize.w, cardH / centerNaturalSize.h)
    return {
      width: centerNaturalSize.w,
      height: centerNaturalSize.h,
      maxWidth: 'none',
      objectFit: undefined,
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
    }
  }, [centerNaturalSize])

  /** Reset slot + zoom when chapter changes; play a brief cross-fade. */
  useEffect(() => {
    posRef.current = 0
    velRef.current = 0
    setActiveIndex(0)
    setIsZoomed(false)
    isZoomedRef.current = false
    zoomZRef.current = 0
    setZoomZ(0)
    setZoomPan({ x: 0, y: 0 })
    setLoadedWorkId(null)
    setCenterNaturalSize(null)
    setTrackFade(true)
    const id = window.setTimeout(() => setTrackFade(false), 220)
    return () => window.clearTimeout(id)
  }, [activeChapterIdx])

  /** Clamp active slot inside the new list. */
  useEffect(() => {
    posRef.current = Math.max(0, Math.min(posRef.current, Math.max(0, chapterWorks.length - 1)))
    velRef.current = 0
    setActiveIndex(Math.round(posRef.current))
  }, [chapterWorks.length])

  /** Reset hi-res rasterization state when active work changes. */
  useEffect(() => { setCenterNaturalSize(null) }, [activeIndex])

  /** Start the RAF momentum loop if not already running. */
  const kickRaf = useCallback(() => {
    if (rafRef.current) return
    const max = totalSlotsRef.current - 1
    const tick = () => {
      if (Math.abs(velRef.current) < 0.005) {
        velRef.current = 0
        rafRef.current = undefined
        return
      }
      velRef.current *= 0.97
      posRef.current = Math.max(0, Math.min(posRef.current + velRef.current, max))
      setActiveIndex(Math.round(posRef.current))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stepBy = useCallback((delta: number) => {
    if (totalSlotsRef.current === 0) return
    posRef.current = Math.max(0, Math.min(Math.round(posRef.current), totalSlotsRef.current - 1))
    velRef.current = delta * 0.25
    kickRaf()
  }, [kickRaf])

  // Discrete single-step for arrow buttons and keyboard — no momentum carry
  const jumpBy = useCallback((delta: number) => {
    if (totalSlotsRef.current === 0) return
    const next = Math.max(0, Math.min(Math.round(posRef.current) + delta, totalSlotsRef.current - 1))
    posRef.current = next
    velRef.current = 0
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined }
    setActiveIndex(next)
  }, [])

  const exitZoom = useCallback(() => {
    setIsZoomed(false)
    isZoomedRef.current = false
    zoomZRef.current = 0
    setZoomZ(0)
    setZoomPan({ x: 0, y: 0 })
  }, [])

  /** Keyboard nav + Esc to exit zoom. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomed) {
        exitZoom()
        e.preventDefault()
        return
      }
      if (isZoomed) return
      if (e.key === 'ArrowRight') { jumpBy(1); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { jumpBy(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isZoomed, stepBy, jumpBy, exitZoom])

  // Keep ref in sync so the passive:false wheel handler reads current state
  useEffect(() => { isZoomedRef.current = isZoomed }, [isZoomed])

  /** Wheel + trackpad: viewer approaches the wall in zoom mode, otherwise drift the carousel. */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (isZoomedRef.current) {
        e.preventDefault()
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
        // Scroll UP = negative deltaY → viewer approaches → scene z increases
        const next = zoomZRef.current + (-d) * 0.4
        if (next < -40) { exitZoom(); return }
        zoomZRef.current = Math.max(0, Math.min(next, MAX_Z))
        setZoomZ(zoomZRef.current)
        return
      }
      let raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (e.deltaMode === 1) raw *= 40
      else if (e.deltaMode === 2) raw *= 600
      const impulse = raw * 0.00025
      velRef.current = Math.max(-1.5, Math.min(velRef.current + impulse, 1.5))
      kickRaf()
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [kickRaf, exitZoom])

  /** Touch swipe: 60px threshold = ±1 step; tap (short + still) = zoom center card. */
  const touchStartXRef = useRef<number | null>(null)
  const touchStartTimeRef = useRef<number>(0)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
    touchStartTimeRef.current = Date.now()
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const x0 = touchStartXRef.current
    touchStartXRef.current = null
    if (x0 == null) return
    const x1 = e.changedTouches[0]?.clientX ?? x0
    const dx = x1 - x0
    const elapsed = Date.now() - touchStartTimeRef.current
    // Tap: short duration, minimal movement → toggle zoom on center card
    if (Math.abs(dx) < 20 && elapsed < 300) {
      if (isZoomed) { exitZoom(); return }
      if (centerImgLoaded) {
        velRef.current = 0
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined }
        setIsZoomed(true)
        isZoomedRef.current = true
        zoomZRef.current = 0
        setZoomZ(0)
      }
      return
    }
    if (isZoomed) return
    if (Math.abs(dx) < 60) return
    jumpBy(dx < 0 ? 1 : -1)
  }

  const chapterTitle = chapter
    ? (lang === 'en' ? (chapter.title_en || chapter.title_fr) : (chapter.title_fr || chapter.title_en))
    : ''
  const chapterIntro = chapter
    ? (lang === 'en' ? (chapter.intro_en || chapter.intro_fr || '') : (chapter.intro_fr || chapter.intro_en || ''))
    : ''
  const chapterDesc = chapter
    ? (lang === 'en' ? (chapter.description_en || chapter.description_fr || '') : (chapter.description_fr || chapter.description_en || ''))
    : ''
  const totalSlots = chapterWorks.length + (chapterDesc ? 1 : 0)
  totalSlotsRef.current = totalSlots

  return (
    <div className="w-page-enter">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body {
          background: #fafafa; font-family: var(--font-ui); color: #2a2826;
          height: 100vh; overflow: hidden; -webkit-font-smoothing: antialiased;
        }
        @keyframes w-fadein { from { opacity: 0; } to { opacity: 1; } }
        .w-page-enter { animation: w-fadein 1.2s ease forwards; }

        .w-stage {
          position: fixed; inset: 0;
          background: linear-gradient(to top, #d0ccc6 0%, #dedad4 50%, #edeae4 100%);
          overflow: hidden;
          touch-action: pan-y;
        }
        .w-track-wrap {
          position: absolute; inset: 0; z-index: 3;
          display: flex; align-items: center; justify-content: center;
          perspective: 2400px;
          perspective-origin: 50% 46%;
          transition: opacity 220ms ease;
        }
        .w-track-wrap.fading { opacity: 0; }
        .w-track {
          position: relative;
          width: 100%; height: 100%;
          transform-style: preserve-3d;
        }
        .w-card {
          --thickness: 42px;
          position: absolute;
          top: 46%; left: 50%;
          width: min(25vw, 400px);
          height: min(42vh, 460px);
          margin-left: calc(-1 * min(25vw, 400px) / 2);
          margin-top:  calc(-1 * min(42vh, 460px) / 2);
          transform-style: preserve-3d;
          transform-origin: 50% 50%;
          transition: transform 900ms cubic-bezier(.22,.61,.36,1),
                      opacity 700ms ease,
                      filter 700ms ease;
          will-change: transform, opacity;
        }
        .w-card.is-zoomed { transition: none; }
        .w-card-inner {
          position: relative;
          width: 100%; height: 100%;
          transform-style: preserve-3d;
        }
        /* Box faces — front carries the image, side panels give the object real thickness on Z */
        .w-face {
          position: absolute;
          backface-visibility: hidden;
        }
        .w-face.front {
          top: 0; left: 0;
          width: 100%; height: 100%;
          transform: translateZ(calc(var(--thickness) / 2));
          display: flex; align-items: center; justify-content: center;
        }
        .w-face.right {
          top: 0; left: calc(100% - var(--thickness));
          width: var(--thickness); height: 100%;
          transform-origin: 100% 50%;
          transform: rotateY(-90deg);
          background: linear-gradient(to bottom, #c2b9a4 0%, #9c917b 55%, #6e6553 100%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .w-face.left {
          top: 0; left: 0;
          width: var(--thickness); height: 100%;
          transform-origin: 0 50%;
          transform: rotateY(90deg);
          background: linear-gradient(to bottom, #c2b9a4 0%, #9c917b 55%, #6e6553 100%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .w-face.top {
          top: 0; left: 0;
          width: 100%; height: var(--thickness);
          transform-origin: 50% 0;
          transform: rotateX(90deg);
          background: linear-gradient(to right, #b6ad97 0%, #cec3ad 50%, #b6ad97 100%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.10);
        }
        .w-face.bottom {
          top: calc(100% - var(--thickness)); left: 0;
          width: 100%; height: var(--thickness);
          transform-origin: 50% 100%;
          transform: rotateX(-90deg);
          background: linear-gradient(to right, #8a8170 0%, #9c917b 50%, #8a8170 100%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.22);
        }
        .w-card-img {
          width: 100%; height: 100%;
          object-fit: contain;
          display: block;
          image-rendering: high-quality;
          backface-visibility: hidden;
          will-change: transform;
        }
        .w-card-img.round { border-radius: 50%; overflow: hidden; }
        /* Prevent bilinear blur at high perspective magnification */
        .w-card-img.zoomed {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
        /* Cursor states */
        .w-card.center          { cursor: default; }
        .w-card.center.img-ready { cursor: zoom-in; }
        .w-card.center.is-zoomed { cursor: zoom-out; }
        .w-card.center.is-zoomed:active { cursor: grabbing; }
        .w-card.side            { cursor: pointer; }
        .w-card.text            { width: min(36vw, 480px); height: auto; max-height: min(80vh, 720px); margin-left: calc(-1 * min(36vw, 480px) / 2); margin-top: 0; cursor: default; }
        .w-card.zoomed-out      { pointer-events: none; }

        /* Drop-shadow rakes the silhouette so the work reads as a hung object */
        .w-card.center .w-card-img {
          filter: drop-shadow(0 15px 22px rgba(15,15,20,0.34))
                  drop-shadow(0 4px 7px rgba(15,15,20,0.22));
        }
        .w-card.side.left .w-card-img {
          filter: drop-shadow(-10px 13px 18px rgba(0,0,0,0.30))
                  drop-shadow(0 10px 15px rgba(15,15,20,0.20));
        }
        .w-card.side.right .w-card-img {
          filter: drop-shadow(10px 13px 18px rgba(0,0,0,0.30))
                  drop-shadow(0 10px 15px rgba(15,15,20,0.20));
        }


        .w-caption {
          position: fixed;
          right: calc(50% + min(12.5vw, 200px) + 24px);
          top: 46%;
          transform: translateY(-50%);
          text-align: right;
          z-index: 220;
          pointer-events: none;
          transition: opacity 420ms ease;
          max-width: min(160px, 14vw);
        }
        .w-work-title {
          font-family: 'Instrument Serif', serif;
          font-size: 11px;
          color: #1a1816; font-weight: 400;
          letter-spacing: 0; line-height: 1.35;
          margin: 0 0 5px 0;
        }
        .w-work-details {
          font-size: 7px; letter-spacing: 2px; text-transform: uppercase; color: #6a6660;
          display: flex; flex-direction: column; gap: 2px; align-items: flex-end;
        }
        .w-zoom-hint {
          margin-top: 6px;
          font-size: 7px; letter-spacing: 2px; text-transform: uppercase;
          color: #9a958f; opacity: 0.85;
        }
        .w-lean-hint {
          position: fixed; bottom: clamp(24px, 5vh, 48px); left: 50%;
          transform: translateX(-50%);
          z-index: 250; pointer-events: none;
          font-size: 8px; letter-spacing: 3px; text-transform: uppercase;
          color: #8a8680;
          transition: opacity 400ms ease;
        }

        .w-chapter-header {
          position: fixed;
          left: clamp(24px, 4vw, 56px);
          top: 50%; transform: translateY(-50%);
          text-align: left;
          z-index: 200;
          pointer-events: none;
          max-width: min(180px, 16vw);
          transition: opacity 420ms ease;
        }
        .w-chapter-name {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(13px, 1.4vw, 20px);
          color: #1a1816; font-weight: 400;
          letter-spacing: -0.01em; line-height: 1.2;
          margin: 0 0 6px 0;
        }
        .w-chapter-intro {
          font-size: 7px; letter-spacing: 2px; text-transform: uppercase;
          color: #7a7570; margin: 0;
        }
        .w-text-card-front {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start;
          padding: clamp(20px, 6%, 40px) clamp(16px, 5%, 32px);
          background: #f5f2ed;
          border: 1px solid rgba(26,24,22,0.10);
          overflow-y: auto;
          scrollbar-width: none;
        }
        .w-text-card-front::-webkit-scrollbar { display: none; }
        .w-text-card-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(14px, 2vw, 22px);
          color: #1a1816; font-weight: 400;
          letter-spacing: -0.01em; line-height: 1.2;
          margin: 0 0 12px 0;
          text-align: center;
        }
        .w-text-card-body {
          font-size: clamp(10px, 1.1vw, 13px);
          line-height: 1.7; color: #5a5652;
          margin: 0;
          text-align: left;
          width: 100%;
        }

        .w-arrow {
          position: fixed;
          top: 50%; transform: translateY(-50%);
          z-index: 230;
          width: 56px; height: 56px;
          min-width: 44px; min-height: 44px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.55);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 999px;
          color: #1a1816;
          font-family: 'Instrument Serif', serif;
          font-size: 26px; line-height: 1;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, opacity 0.2s;
          pointer-events: auto;
        }
        .w-arrow:hover { background: rgba(255,255,255,0.9); border-color: rgba(0,0,0,0.16); }
        .w-arrow:disabled { opacity: 0.25; cursor: default; }
        .w-arrow.prev { left: clamp(14px, 3vw, 32px); }
        .w-arrow.next { right: clamp(14px, 3vw, 32px); }

        .w-bottom-stack {
          position: fixed;
          left: 50%;
          bottom: max(clamp(14px, 3.5vh, 32px), env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 240;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          max-width: min(96vw, 720px);
        }
        .w-section-nav-label {
          font-size: 8px; letter-spacing: 3px; text-transform: uppercase;
          color: #8a8680;
        }
        .w-section-pills {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
        }
        .w-section-pill {
          font-size: clamp(8px, 1vw, 9px);
          letter-spacing: 2px; text-transform: uppercase;
          color: #7a7570;
          background: none;
          border: none;
          border-bottom: 1px solid transparent;
          padding: 8px 4px;
          min-height: 44px;
          cursor: pointer;
          font-family: inherit;
          max-width: min(42vw, 220px);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.2s, border-color 0.2s;
        }
        .w-section-pill:hover { color: #1a1816; }
        .w-section-pill.active { color: #1a1816; border-bottom-color: rgba(26,24,22,0.5); }

        .w-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 300;
          display: flex; align-items: center; justify-content: space-between;
          padding: clamp(12px, 2vw, 18px) clamp(16px, 4vw, 36px);
          pointer-events: auto;
          transition: opacity 300ms ease;
        }
        .w-logo { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #8a8680; text-decoration: none; transition: color .15s; }
        .w-logo:hover { color: #1a1816; }
        .w-navlinks { display: flex; gap: clamp(14px, 2.5vw, 28px); align-items: center; }
        .w-navlink { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #8a8680; text-decoration: none; transition: color .15s; }
        .w-navlink:hover { color: #1a1816; }
        .w-navlink.active { color: #3a3632; }
        .w-lang {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #8a8680; background: none; border: 1px solid rgba(26,24,22,0.15);
          padding: 3px 8px; cursor: pointer; transition: all .15s; font-family: inherit;
          min-height: 32px; display: inline-flex; align-items: center;
        }
        .w-lang:hover { color: #1a1816; border-color: rgba(26,24,22,0.4); }

        .w-page-h1-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }

        @media (max-width: 767px) {
          .w-card {
            width: min(86vw, 520px);
            height: min(54vh, 540px);
            margin-left: calc(-1 * min(86vw, 520px) / 2);
            margin-top:  calc(-1 * min(54vh, 540px) / 2);
          }
          .w-arrow { width: 48px; height: 48px; font-size: 22px; }
          .w-arrow.prev { left: 8px; }
          .w-arrow.next { right: 8px; }
          .w-caption { bottom: clamp(110px, 16vh, 160px); }
          .w-cartel {
            right: auto !important;
            top: auto !important;
            bottom: clamp(28px, 6vh, 64px);
            left: 50%;
            transform: translateX(-50%) !important;
            text-align: center !important;
            width: min(88vw, 400px) !important;
          }
          .w-cartel .w-work-details {
            align-items: center !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .w-card { transition: transform 250ms ease, opacity 250ms ease; }
        }
      `}</style>

      <PublicNav active="works" prefix="w" hiddenNavRoutes={hiddenNavRoutes} navOrder={navOrder} />

      <h1 className="w-page-h1-sr-only">{t('pub_works')}</h1>

      {layout === 'grid' ? (
        <WorksGrid
          works={works}
          mode={mode}
          activeChapterIdx={activeChapterIdx}
          onChapterChange={setActiveChapterIdx}
        />
      ) : (
      <div
        className="w-stage pem-grain"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Gentle spotlight centred on the works plane */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 38% 48% at 50% 46%, rgba(255,248,232,0.18) 0%, transparent 70%)',
        }} />

        {curatedGroupsNomatch && (
          <div
            role="status"
            style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: 'min(420px, 88vw)', textAlign: 'center',
              fontSize: 12, letterSpacing: '0.08em', lineHeight: 1.65, color: '#6a6660',
            }}
          >
            {t('pub_works_groups_nomatch')}
          </div>
        )}

        {!curatedGroupsNomatch && chapterWorks.length > 0 && (
          <div
            className={`w-track-wrap${trackFade ? ' fading' : ''}`}
            role="region"
            aria-roledescription="carousel"
            aria-label={t('pub_works')}
            style={{ zIndex: 'auto' }}
          >
            {/*
              Scene container. translateZ here = viewer approaching the entire wall.
              All child z-planes (artworks at z=0, wall texture at z=-10) move together,
              each scaling according to the perspective projection — correct parallax.
            */}
            <div
              className="w-track"
              style={isZoomed
                ? { transform: `translateZ(${zoomZ}px)`, transition: 'transform 0.10s ease-out' }
                : undefined}
            >
              {/* Wall plane: grain texture — lives slightly behind artworks (z=-10) so it zooms at the same rate */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '-50%', right: '-50%', bottom: '-50%', left: '-50%',
                  transform: 'translateZ(-10px)',
                  backgroundImage: GRAIN_BG,
                  backgroundSize: '200px 200px',
                  opacity: 0.28,
                  pointerEvents: 'none',
                }}
              />
              {/* Wall plane: overhead light well — at 25% of oversized element ≈ viewport top */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '-50%', right: '-50%', bottom: '-50%', left: '-50%',
                  transform: 'translateZ(-10px)',
                  background: 'radial-gradient(ellipse 110% 70% at 50% 0%, rgba(255,252,245,0.92) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />

              {/* Wall-mounted cartel — lives in 3D scene, left of center card, zooms with the wall */}
              {activeWork && (
                <div
                  className="w-cartel"
                  aria-hidden
                  style={{
                    position: 'absolute',
                    right: 'calc(50% + min(12.5vw, 200px) + 24px)',
                    top: '46%',
                    transform: 'translateY(-50%)',
                    width: 'min(160px, 14vw)',
                    textAlign: 'right',
                    pointerEvents: 'none',
                    zIndex: 220,
                  }}
                >
                  <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 11, fontWeight: 400, color: '#1a1816', letterSpacing: 0, lineHeight: 1.35, margin: '0 0 5px 0' }}>
                    {activeWork.Titre ?? t('pub_untitled')}
                  </h3>
                  <div className="w-work-details" style={{ fontSize: 7, letterSpacing: 2, textTransform: 'uppercase', color: '#6a6660', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {yearOf(activeWork.Annee) && <span>{yearOf(activeWork.Annee)}</span>}
                    {activeWork.Hauteur && activeWork.Largeur && (
                      <span>
                        {Number(activeWork.Hauteur).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                        {' × '}
                        {Number(activeWork.Largeur).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                        {' cm'}
                      </span>
                    )}
                    {centerImgLoaded && !isZoomed && (
                      <span style={{ marginTop: 4, color: '#9a958f' }}>{t('pub_works_zoom_hint')}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Collection title — on the wall, zooms with the scene */}
              {chapterTitle && (
                <div aria-hidden style={{
                  position: 'absolute',
                  left: '50%', top: 'clamp(60px, 10vh, 96px)',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  zIndex: 10,
                  opacity: isZoomed ? 0 : 1,
                  transition: 'opacity 300ms ease',
                }}>
                  <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 'clamp(13px,1.4vw,20px)', fontWeight: 400, color: '#1a1816', letterSpacing: '-0.01em', lineHeight: 1.2, margin: 0 }}>
                    {chapterTitle}
                  </p>
                  {chapterIntro && <p style={{ fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase', color: '#7a7570', margin: '5px 0 0' }}>{chapterIntro}</p>}
                </div>
              )}

              {chapterWorks.map((w, i) => {
                const offset = i - activeIndex
                const { transform, opacity, zIndex, visible } = cardTransform(offset, reducedMotion, isMobile ? 1100 : 780)
                if (!visible) return null
                const isCenter = offset === 0
                const isSide = !isCenter
                const sideClass = offset < 0 ? 'left' : 'right'
                const src = imageUrl(w.txtImageNameLink) ?? undefined

                // Pan offset applied on top of card's native 3D transform in zoom mode
                const finalTransform = isCenter && isZoomed && (zoomPan.x !== 0 || zoomPan.y !== 0)
                  ? `translate(${zoomPan.x}px, ${zoomPan.y}px) ${transform}`
                  : transform
                const finalZ = isCenter && isZoomed ? 300 : zIndex

                const classes = [
                  'w-card',
                  isCenter ? 'center' : `side ${sideClass}`,
                  isCenter && centerImgLoaded && !isZoomed ? 'img-ready' : '',
                  isCenter && isZoomed ? 'is-zoomed' : '',
                  isSide && isZoomed ? 'zoomed-out' : '',
                ].filter(Boolean).join(' ')

                return (
                  <div
                    key={`work-${w.OeuvreID}`}
                    className={classes}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={w.Titre ?? t('pub_untitled')}
                    style={{ transform: finalTransform, opacity, zIndex: finalZ }}
                    onClick={() => {
                      if (didDragRef.current) { didDragRef.current = false; return }
                      if (isCenter && isZoomed) {
                        exitZoom()
                      } else if (isCenter) {
                        if (!centerImgLoaded) return
                        // Stop any active carousel momentum before entering zoom
                        velRef.current = 0
                        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined }
                        setIsZoomed(true)
                        isZoomedRef.current = true
                        zoomZRef.current = 0
                        setZoomZ(0)
                      } else {
                        setActiveIndex(i)
                      }
                    }}
                    onMouseDown={isCenter && isZoomed ? (e) => { dragRef.current = { mx: e.clientX, my: e.clientY, px: zoomPan.x, py: zoomPan.y }; didDragRef.current = false; e.preventDefault() } : undefined}
                    onMouseMove={isCenter && isZoomed ? (e) => { if (!dragRef.current) return; didDragRef.current = true; setZoomPan({ x: dragRef.current.px + e.clientX - dragRef.current.mx, y: dragRef.current.py + e.clientY - dragRef.current.my }) } : undefined}
                    onMouseUp={isCenter && isZoomed ? () => { dragRef.current = null } : undefined}
                    onMouseLeave={isCenter && isZoomed ? () => { dragRef.current = null } : undefined}
                    onTouchStart={isCenter && isZoomed ? (e) => { const t = e.touches[0]; dragRef.current = { mx: t.clientX, my: t.clientY, px: zoomPan.x, py: zoomPan.y }; didDragRef.current = false } : undefined}
                    onTouchMove={isCenter && isZoomed ? (e) => { if (!dragRef.current) return; didDragRef.current = true; const t = e.touches[0]; setZoomPan({ x: dragRef.current.px + t.clientX - dragRef.current.mx, y: dragRef.current.py + t.clientY - dragRef.current.my }); e.stopPropagation() } : undefined}
                    onTouchEnd={isCenter && isZoomed ? () => { dragRef.current = null } : undefined}
                  >
                    <div className="w-card-inner">
                      <div className="w-face left" aria-hidden />
                      <div className="w-face right" aria-hidden />
                      <div className="w-face top" aria-hidden />
                      <div className="w-face bottom" aria-hidden />
                      <div className="w-face front">
                        <img
                          src={src}
                          alt={w.Titre ?? ''}
                          className={`w-card-img${w.isRound ? ' round' : ''}${isCenter && isZoomed ? ' zoomed' : ''}`}
                          draggable={false}
                          style={isCenter && hiResImgStyle ? hiResImgStyle : undefined}
                          ref={isCenter ? (el) => { if (el?.complete && el.naturalWidth > 0 && loadedWorkId !== w.OeuvreID) { setLoadedWorkId(w.OeuvreID); setCenterNaturalSize({ w: el.naturalWidth, h: el.naturalHeight }) } } : undefined}
                          onLoad={isCenter ? (e) => { const t = e.currentTarget; setLoadedWorkId(w.OeuvreID); setCenterNaturalSize({ w: t.naturalWidth, h: t.naturalHeight }) } : undefined}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {chapterDesc && (() => {
                const i = chapterWorks.length
                const offset = i - activeIndex
                const { transform, opacity, zIndex, visible } = cardTransform(offset, reducedMotion, isMobile ? 1100 : 780)
                if (!visible) return null
                return (
                  <div
                    key="text-card"
                    className="w-card side text"
                    style={{ transform: `translateY(-50%) ${isZoomed ? `translateZ(-${zoomZ}px) ${transform}` : transform}`, opacity, zIndex }}
                  >
                    <div className="w-card-inner">
                      <div className="w-face left" aria-hidden />
                      <div className="w-face right" aria-hidden />
                      <div className="w-face top" aria-hidden />
                      <div className="w-face bottom" aria-hidden />
                      <div className="w-text-card-front">
                        {chapterTitle && <p className="w-text-card-title">{chapterTitle}</p>}
                        <div
                          className="w-text-card-body"
                          dangerouslySetInnerHTML={{ __html: chapterDesc.replace(/\n/g, '<br>') }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}



        {isZoomed && (
          <button
            type="button"
            onClick={exitZoom}
            aria-label={t('pub_works_zoom_close_aria')}
            style={{
              position: 'fixed', top: 16, right: 16, zIndex: 400,
              width: 48, height: 48, minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.70)',
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: '50%',
              fontSize: 22, lineHeight: 1, color: '#1a1816',
              cursor: 'pointer',
            }}
          >×</button>
        )}

        {isZoomed && (
          <div className="w-lean-hint" style={{ opacity: zoomZ <= 50 ? 1 : 0 }}>
            {t('pub_works_zoom_hint')}
          </div>
        )}

        {chapterWorks.length > 1 && !isZoomed && (
          <>
            <button
              type="button"
              className="w-arrow prev"
              aria-label={t('pub_works_carousel_prev')}
              disabled={activeIndex <= 0}
              onClick={() => jumpBy(-1)}
            >‹</button>
            <button
              type="button"
              className="w-arrow next"
              aria-label={t('pub_works_carousel_next')}
              disabled={activeIndex >= totalSlots - 1}
              onClick={() => jumpBy(1)}
            >›</button>
          </>
        )}

        {mode.collections.length > 1 && !isZoomed && (
          <div className="w-bottom-stack">
            <span className="w-section-nav-label">{t('pub_works_collections')}</span>
            <div
              className="w-section-pills"
              aria-label={t('pub_works_aria_switch_chapter')}
            >
              {mode.collections.map((c, idx) => {
                const label = lang === 'en' ? (c.title_en || c.title_fr) : (c.title_fr || c.title_en)
                return (
                  <button
                    key={`pill-${c.id || idx}`}
                    type="button"
                    className={`w-section-pill${idx === activeChapterIdx ? ' active' : ''}`}
                    title={t('pub_works_chapter_open_fmt').replace('{title}', label || '')}
                    onClick={() => setActiveChapterIdx(idx)}
                  >
                    {label || '—'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Life-size visitor silhouette — top aligns with artwork top, runs to viewport floor */}
        <img
          aria-hidden
          src="/silhouette.avif"
          alt=""
          style={{
            position: 'fixed',
            left: 0,
            top: 'calc(46vh - min(21vh, 230px) - 12vh)',
            height: 'calc(66vh + min(21vh, 230px))',
            width: 'auto',
            objectFit: 'contain',
            objectPosition: 'top left',
            opacity: isZoomed ? 0 : 0.125,
            mixBlendMode: 'multiply',
            transition: 'opacity 400ms ease',
            pointerEvents: 'none',
            zIndex: 5,
            userSelect: 'none',
          }}
        />

        {/* Navigation instructions */}
        {!isZoomed && (
          <div aria-hidden style={{
            position: 'fixed', bottom: 'clamp(14px, 3vh, 28px)', left: 'clamp(24px, 4vw, 48px)',
            zIndex: 240, pointerEvents: 'none',
            fontSize: 7, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a958f',
          }}>
            {t('pub_works_nav_hint')}
          </div>
        )}

      </div>
      )}
    </div>
  )
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}
