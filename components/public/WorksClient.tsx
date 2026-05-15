'use client'

import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PublicNav from './PublicNav'
import { trackView } from '@/lib/track'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function workMatchesCollectionTheme(workThemes: string[], collectionTheme: string | null | undefined): boolean {
  if (!collectionTheme?.trim()) return true
  const sMatch = normalizeTheme(collectionTheme)
  return workThemes.some((th) => {
    const wMatch = normalizeTheme(th)
    return wMatch.includes(sMatch) || sMatch.includes(wMatch)
  })
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
  intro_fr?: string
  intro_en?: string
  description_fr: string
  description_en: string
  theme?: string | null
  is_active: boolean
  manual_work_order?: number[]
}

interface WorksMode {
  id: string
  label_fr: string
  label_en: string
  collections: Collection[]
  outro_fr: string
  outro_en: string
}

interface Props {
  works: Work[]
  modes: WorksMode[]
}

/** Manual order first, then theme-matched residuals. Only works with images. */
function worksForCollection(col: Collection, works: Work[]): Work[] {
  const seenHere = new Set<number>()
  const orderIds = col.manual_work_order ?? []
  const byId = new Map(works.map(w => [w.OeuvreID, w]))

  if (orderIds.length > 0) {
    const out: Work[] = []
    for (const id of orderIds) {
      const w = byId.get(id)
      if (!w?.txtImageNameLink) continue
      if (seenHere.has(w.OeuvreID)) continue
      seenHere.add(w.OeuvreID)
      out.push(w)
    }
    for (const w of works) {
      if (!w.txtImageNameLink) continue
      if (seenHere.has(w.OeuvreID)) continue
      if (!workMatchesCollectionTheme(w.themes, col.theme)) continue
      seenHere.add(w.OeuvreID)
      out.push(w)
    }
    return out
  }
  return works.filter(w => {
    if (!w.txtImageNameLink) return false
    if (!workMatchesCollectionTheme(w.themes, col.theme)) return false
    if (seenHere.has(w.OeuvreID)) return false
    seenHere.add(w.OeuvreID)
    return true
  })
}

/** Per-card 3D transform. Center = face-on, neighbors rotate so inner edge faces viewer. */
function cardTransform(offset: number, reducedMotion: boolean): {
  transform: string
  opacity: number
  zIndex: number
  visible: boolean
} {
  const abs = Math.abs(offset)
  if (abs > 3) return { transform: '', opacity: 0, zIndex: 0, visible: false }
  const tx = offset * 780
  const ty = -abs * 240
  const ry = reducedMotion ? 0 : Math.sign(offset) * Math.min(abs, 1) * 5
  const opacity = Math.max(0, 1 - abs * 0.22)
  const zIndex = 100 - abs
  const transform = `translate3d(${tx}px, 0, ${ty}px) rotateY(${ry}deg)`
  return { transform, opacity, zIndex, visible: true }
}

export default function WorksClient({ works, modes }: Props) {
  const { t, lang } = useI18n()
  const safeModes: WorksMode[] = modes.length > 0 ? modes : [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    collections: [], outro_fr: '', outro_en: '',
  }]
  const mode = safeModes[0]

  const [activeChapterIdx, setActiveChapterIdx] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)
  const [trackFade, setTrackFade] = useState(false)

  const posRef = useRef(0)
  const velRef = useRef(0)
  const rafRef = useRef<number | undefined>(undefined)
  const totalSlotsRef = useRef(0)

  const [zoomScale, setZoomScale] = useState(1)
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const didDragRef = useRef(false)
  const MAX_ZOOM = 3.0
  const isZoomedRef = useRef(false)

  const reducedMotion = useReducedMotion()

  useEffect(() => {
    void trackView('/works', null, null, getOrCreatePublicVisitorId())
  }, [])

  const chapter = mode.collections[Math.min(activeChapterIdx, Math.max(0, mode.collections.length - 1))]
  const chapterWorks = useMemo(() => {
    if (!chapter) {
      // Fallback: no curated chapters → all public works
      return works.filter(w => w.txtImageNameLink)
    }
    return worksForCollection(chapter, works)
  }, [chapter, works])

  const curatedGroupsNomatch = Boolean(chapter && chapterWorks.length === 0)

  /** Reset slot + zoom when chapter changes; play a brief cross-fade. */
  useEffect(() => {
    posRef.current = 0
    velRef.current = 0
    setActiveIndex(0)
    setIsZoomed(false)
    setZoomScale(1)
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

  /** Keyboard nav + Esc to exit zoom. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomed) {
        setIsZoomed(false)
        setZoomScale(1)
        setZoomPan({ x: 0, y: 0 })
        e.preventDefault()
        return
      }
      if (isZoomed) return
      if (e.key === 'ArrowRight') { stepBy(1); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { stepBy(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isZoomed, stepBy])

  // Keep ref in sync so the passive:false wheel handler reads current state
  useEffect(() => { isZoomedRef.current = isZoomed }, [isZoomed])

  /** Wheel + trackpad: zoom when in zoom mode, otherwise drift the wall. */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (isZoomedRef.current) {
        e.preventDefault()
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
        setZoomScale(s => Math.max(1, Math.min(s + d * 0.0009, MAX_ZOOM)))
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
  }, [kickRaf])

  /** Touch swipe: 60px threshold = ±1 step. */
  const touchStartXRef = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const x0 = touchStartXRef.current
    touchStartXRef.current = null
    if (x0 == null || isZoomed) return
    const x1 = e.changedTouches[0]?.clientX ?? x0
    const dx = x1 - x0
    if (Math.abs(dx) < 60) return
    stepBy(dx < 0 ? 1 : -1)
  }

  const activeWork: Work | undefined = chapterWorks[activeIndex]
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
          background: linear-gradient(to top, #e6e6e8 0%, #f1f1f3 50%, #fafafa 100%);
          overflow: hidden;
          touch-action: pan-y;
        }
        /* Paper-grain texture — subtle, kills the vinyl look */
        .w-stage::before {
          content: '';
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.10;
          mix-blend-mode: multiply;
        }
        /* Soft overhead light well */
        .w-stage::after {
          content: '';
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background: radial-gradient(ellipse 80% 55% at 50% 0%, rgba(255,252,245,0.38) 0%, transparent 100%);
        }
        .w-track-wrap {
          position: absolute; inset: 0; z-index: 3;
          display: flex; align-items: center; justify-content: center;
          perspective: 2400px;
          perspective-origin: 50% 55%;
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
        }
        .w-card-img.round { border-radius: 50%; overflow: hidden; }
        .w-card.center { cursor: zoom-in; }
        .w-card.side   { cursor: pointer; }
        .w-card.text   { width: min(36vw, 480px); height: min(62vh, 580px); margin-left: calc(-1 * min(36vw, 480px) / 2); margin-top: calc(-1 * min(62vh, 580px) / 2); cursor: default; }
        .w-card.zoomed { cursor: zoom-out; }
        .w-card.zoomed:active { cursor: grabbing; }
        .w-card.zoomed-out { opacity: 0.04 !important; pointer-events: none; }

        /* Drop-shadow rakes the silhouette so the work reads as a hung object */
        .w-card.center .w-card-img {
          filter: drop-shadow(0 22px 32px rgba(15,15,20,0.34))
                  drop-shadow(0 6px 10px rgba(15,15,20,0.22));
        }
        .w-card.side.left .w-card-img {
          filter: drop-shadow(-14px 18px 26px rgba(0,0,0,0.30))
                  drop-shadow(0 14px 22px rgba(15,15,20,0.20));
        }
        .w-card.side.right .w-card-img {
          filter: drop-shadow(14px 18px 26px rgba(0,0,0,0.30))
                  drop-shadow(0 14px 22px rgba(15,15,20,0.20));
        }


        .w-caption {
          position: fixed;
          left: 50%; bottom: clamp(96px, 14vh, 140px);
          transform: translateX(-50%);
          text-align: center;
          z-index: 220;
          pointer-events: none;
          transition: opacity 420ms ease;
          max-width: min(620px, 92vw);
        }
        .w-work-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(20px, 3.2vw, 40px);
          color: #1a1816; font-weight: 400;
          letter-spacing: -0.02em; line-height: 1.1;
          margin: 0 0 8px 0;
        }
        .w-work-details {
          font-size: 9px; letter-spacing: 4px; text-transform: uppercase; color: #6a6660;
          display: inline-flex; gap: 12px; flex-wrap: wrap; justify-content: center;
        }
        .w-zoom-hint {
          margin-top: 10px;
          font-size: 8px; letter-spacing: 3px; text-transform: uppercase;
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
          top: clamp(60px, 8vh, 96px);
          left: 50%; transform: translateX(-50%);
          text-align: center;
          z-index: 200;
          pointer-events: none;
          max-width: min(640px, 88vw);
          transition: opacity 420ms ease;
        }
        .w-chapter-name {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(22px, 3.6vw, 46px);
          color: #1a1816; font-weight: 400;
          letter-spacing: -0.02em; line-height: 1.1;
          margin: 0 0 6px 0;
        }
        .w-chapter-intro {
          font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
          color: #7a7570; margin: 0;
        }
        .w-text-card-front {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start;
          padding: clamp(20px, 6%, 40px) clamp(16px, 5%, 32px);
          background: #f5f2ed;
          border: 1px solid rgba(26,24,22,0.10);
          text-align: center;
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
        }
        .w-text-card-body {
          font-size: clamp(10px, 1.1vw, 13px);
          line-height: 1.7; color: #5a5652;
          margin: 0;
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
          color: #5a5854;
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(26,24,22,0.12);
          border-radius: 999px;
          padding: 10px 14px;
          min-height: 44px;
          cursor: pointer;
          font-family: inherit;
          max-width: min(42vw, 220px);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .w-section-pill:hover { color: #1a1816; border-color: rgba(26,24,22,0.35); background: rgba(255,255,255,0.92); }
        .w-section-pill.active { color: #1a1816; border-color: rgba(26,24,22,0.45); background: rgba(255,255,255,0.98); }

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
        }

        @media (prefers-reduced-motion: reduce) {
          .w-card { transition: transform 250ms ease, opacity 250ms ease; }
        }
      `}</style>

      <PublicNav active="works" prefix="w" />

      <h1 className="w-page-h1-sr-only">{t('pub_works')}</h1>

      <div
        className="w-stage"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
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
            <div className="w-track">
              {chapterWorks.map((w, i) => {
                const offset = i - activeIndex
                const { transform, opacity, zIndex, visible } = cardTransform(offset, reducedMotion)
                if (!visible) return null
                const isCenter = offset === 0
                const isSide = !isCenter
                const sideClass = offset < 0 ? 'left' : 'right'
                const src = isCenter
                  ? (imageUrl(w.txtImageNameLink) ?? undefined)
                  : (thumbUrl(w.txtImageNameLink) ?? imageUrl(w.txtImageNameLink) ?? undefined)

                let finalTransform = transform
                let finalZ = zIndex
                let zoomSizeStyle: React.CSSProperties = {}
                if (isCenter && isZoomed) {
                  // Expand element to viewport size so browser renders image at source res,
                  // then scale() provides additional zoom on top of full-quality pixels
                  const vw = 'min(92vw, 1400px)'
                  const vh = 'min(88vh, 1000px)'
                  zoomSizeStyle = {
                    width: vw, height: vh,
                    marginLeft: `calc(-1 * ${vw} / 2)`,
                    marginTop: `calc(-1 * ${vh} / 2)`,
                  }
                  finalTransform = `translate(${zoomPan.x}px, ${zoomPan.y}px) scale(${zoomScale})`
                  finalZ = 300
                }

                const classes = [
                  'w-card',
                  isCenter ? 'center' : `side ${sideClass}`,
                  isCenter && isZoomed ? 'zoomed' : '',
                  isSide && isZoomed ? 'zoomed-out' : '',
                ].filter(Boolean).join(' ')

                return (
                  <div
                    key={`work-${w.OeuvreID}`}
                    className={classes}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={w.Titre ?? t('pub_untitled')}
                    style={{ transform: finalTransform, opacity, zIndex: finalZ, ...zoomSizeStyle }}
                    onClick={() => {
                      if (didDragRef.current) { didDragRef.current = false; return }
                      if (isCenter && isZoomed) {
                        setIsZoomed(false); setZoomScale(1); setZoomPan({ x: 0, y: 0 })
                      } else if (isCenter) {
                        setIsZoomed(true); setZoomScale(1)
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
                          className={`w-card-img${w.isRound ? ' round' : ''}`}
                          draggable={false}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {chapterDesc && (() => {
                const i = chapterWorks.length
                const offset = i - activeIndex
                const { transform, opacity, zIndex, visible } = cardTransform(offset, reducedMotion)
                if (!visible) return null
                return (
                  <div
                    key="text-card"
                    className="w-card side text"
                    style={{ transform, opacity, zIndex }}
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

        {chapterTitle && !isZoomed && (
          <div className="w-chapter-header">
            <h2 className="w-chapter-name">{chapterTitle}</h2>
            {chapterIntro && <p className="w-chapter-intro">{chapterIntro}</p>}
          </div>
        )}

        {activeWork && !isZoomed && (
          <div
            className="w-caption"
            style={{ opacity: 1, zIndex: 220 }}
          >
            <h3 className="w-work-title">{activeWork.Titre ?? t('pub_untitled')}</h3>
            <div className="w-work-details">
              {yearOf(activeWork.Annee) && <span>{yearOf(activeWork.Annee)}</span>}
              {activeWork.Hauteur && activeWork.Largeur && (
                <span>
                  {Number(activeWork.Hauteur).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                  {' × '}
                  {Number(activeWork.Largeur).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                  {' cm'}
                </span>
              )}
            </div>
            <div className="w-zoom-hint">{t('pub_works_zoom_hint')}</div>
          </div>
        )}

        {isZoomed && (
          <div className="w-lean-hint" style={{ opacity: zoomScale <= 1.05 ? 1 : 0 }}>
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
              onClick={() => stepBy(-1)}
            >‹</button>
            <button
              type="button"
              className="w-arrow next"
              aria-label={t('pub_works_carousel_next')}
              disabled={activeIndex >= totalSlots - 1}
              onClick={() => stepBy(1)}
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

      </div>
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
