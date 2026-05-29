'use client'

import { useI18n } from '@/lib/i18n/context'
import { imageUrl, yearOf } from '@/lib/data'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import WorksGrid from './WorksGrid'
import WorksPlaceholderLayout from './works-layouts/WorksPlaceholderLayout'
import WorksProcessionLayout from './works-layouts/WorksProcessionLayout'
import WorksSalonLayout from './works-layouts/WorksSalonLayout'
import WorksTimelineLayout from './works-layouts/WorksTimelineLayout'
import WorksLetterLayout from './works-layouts/WorksLetterLayout'
import { WORKS_LAYOUT_PLACEHOLDERS, type WorksLayout } from '@/lib/portfolio-config-types'
import { WorksSectionTextCard } from './WorksSectionTextCard'
import {
  collectionDisplayHeading,
  collectionDescriptionHtml,
  collectionHasVisibleText,
  collectionIntroPlain,
  worksForCollection,
} from './works-utils'
import type { Work, WorksMode } from './works-utils'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import {
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  LANDING_HERO_BEVEL_PX_DEFAULT,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_CIRCADIAN_TICK_MS,
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
  buildWorksBevelBoxShadow,
  resolveCircadianValues,
  resolveWorksLight,
  resolveWorksMobileLayout,
} from '@/lib/works-mode-light'
import {
  parseDimensionCm,
  physicalArtDisplaySize,
} from '@/lib/physical-art-display-size'

interface Props {
  works: Work[]
  mode: WorksMode
  siteTheme: PublicSiteTheme
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

function worksCardViewport(isMobile: boolean): { cardW: number; cardH: number } {
  if (typeof window === 'undefined') return { cardW: 400, cardH: 460 }
  return {
    cardW: isMobile ? Math.min(window.innerWidth * 0.86, 520) : Math.min(window.innerWidth * 0.25, 400),
    cardH: isMobile ? Math.min(window.innerHeight * 0.54, 540) : Math.min(window.innerHeight * 0.42, 460),
  }
}

/** Pixel size of the artwork as object-fit: contain would lay it out in the card. */
function fitArtDisplaySize(
  naturalW: number,
  naturalH: number,
  isMobile: boolean,
): { w: number; h: number; scale: number } {
  const { cardW, cardH } = worksCardViewport(isMobile)
  const scale = Math.min(cardW / naturalW, cardH / naturalH)
  return { w: Math.round(naturalW * scale), h: Math.round(naturalH * scale), scale }
}

// Grain SVG data URI — shared between CSS and 3D wall plane
const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`

export default function WorksModeGallery({ works, mode, siteTheme }: Props) {
  const { t, lang } = useI18n()

  // Dev/preview helper: `?_layout=salon` etc. lets you preview a layout without
  // saving it into the portfolio config. Falls back to the mode's persisted layout.
  const [layoutOverride, setLayoutOverride] = useState<string | null>(null)
  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('_layout')
      if (v) setLayoutOverride(v)
    } catch { /* SSR: noop */ }
  }, [])

  // Per-mode bevel + light — fall back to defaults so older configs still render.
  const bevelPx = mode.bevel_px ?? LANDING_HERO_BEVEL_PX_DEFAULT
  const bevelProfile = mode.bevel_profile ?? LANDING_HERO_BEVEL_PROFILE_DEFAULT
  const manualTempK = mode.light_temp_k ?? WORKS_LIGHT_TEMP_DEFAULT
  const manualDirDeg = mode.light_direction_deg ?? WORKS_LIGHT_DIRECTION_DEFAULT
  const manualIntensityPct = mode.light_intensity_pct ?? WORKS_LIGHT_INTENSITY_DEFAULT
  const circadianEnabled = mode.light_circadian === true
  const castShadowOn = mode.cast_shadow_enabled !== false
  const castDistance = mode.cast_shadow_distance_px ?? 15
  const castBlur = mode.cast_shadow_blur_px ?? 22

  // Circadian tick — re-evaluate each minute when enabled.
  const [circadianTick, setCircadianTick] = useState(0)
  useEffect(() => {
    if (!circadianEnabled) return
    const id = window.setInterval(() => setCircadianTick(n => n + 1), WORKS_CIRCADIAN_TICK_MS)
    return () => window.clearInterval(id)
  }, [circadianEnabled])
  const circadianValues = useMemo(
    () => (circadianEnabled ? resolveCircadianValues() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [circadianEnabled, circadianTick],
  )
  const lightTempK = circadianValues?.kelvin ?? manualTempK
  const lightDirDeg = circadianValues?.directionDeg ?? manualDirDeg
  const lightIntensityPct = circadianValues?.intensityPct ?? manualIntensityPct
  const light = useMemo(
    () => resolveWorksLight(lightTempK, lightDirDeg, lightIntensityPct),
    [lightTempK, lightDirDeg, lightIntensityPct],
  )
  const bevelShadow = useMemo(
    () => buildWorksBevelBoxShadow(bevelPx, bevelProfile, light),
    [bevelPx, bevelProfile, light],
  )

  const [activeChapterIdx, setActiveChapterIdx] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)
  const [trackFade, setTrackFade] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  // On mobile, apply the mode's mobile_fallback.
  const effectiveLayout = isMobile
    ? resolveWorksMobileLayout(mode.layout ?? 'carousel', mode.mobile_fallback ?? 'auto')
    : (mode.layout ?? 'carousel')
  const layout = (layoutOverride ?? effectiveLayout) as WorksLayout

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setMounted(true) }, [])

  const posRef = useRef(0)
  const velRef = useRef(0)
  const rafRef = useRef<number | undefined>(undefined)
  const totalSlotsRef = useRef(0)

  // z-axis zoom: viewer approaches the gallery wall
  const zoomZRef = useRef(0)
  const [zoomZ, setZoomZ] = useState(0)
  const MAX_Z = 2200

  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 })
  const [zoomPanning, setZoomPanning] = useState(false)
  const [loadedWorkId, setLoadedWorkId] = useState<number | null>(null)
  const [centerNaturalSize, setCenterNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [naturalSizes, setNaturalSizes] = useState<Map<number, { w: number; h: number }>>(new Map())
  const recordNaturalSize = useCallback((oeuvreId: number, w: number, h: number) => {
    setNaturalSizes((prev) => {
      const existing = prev.get(oeuvreId)
      if (existing && existing.w === w && existing.h === h) return prev
      const next = new Map(prev)
      next.set(oeuvreId, { w, h })
      return next
    })
  }, [])

  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const pinchRef = useRef<{ distance: number; zoomZ: number } | null>(null)
  const didDragRef = useRef(false)
  const carouselMouseXRef = useRef<number | null>(null)
  const carouselDragDidRef = useRef(false)
  const isZoomedRef = useRef(false)
  const centerImgLoadedRef = useRef(false)
  const isMobileRef = useRef(false)

  const reducedMotion = useReducedMotion()

  const chapter = mode.collections[Math.min(activeChapterIdx, Math.max(0, mode.collections.length - 1))]
  const chapterWorks = useMemo(() => {
    if (!chapter) {
      return works.filter(w => w.txtImageNameLink)
    }
    return worksForCollection(chapter, works)
  }, [chapter, works])

  const curatedGroupsNomatch = Boolean(chapter && chapterWorks.length === 0)

  const activeWork: Work | undefined = chapterWorks[activeIndex]
  const centerImgLoaded = activeWork?.OeuvreID === loadedWorkId

  const centerPhysMount = useMemo(() => {
    if (!mounted) return null
    const hauteur = parseDimensionCm(activeWork?.Hauteur)
    const largeur = parseDimensionCm(activeWork?.Largeur)
    if (hauteur && largeur) {
      return physicalArtDisplaySize(
        hauteur, largeur, isMobile,
        centerNaturalSize?.w, centerNaturalSize?.h,
      )
    }
    return null
  }, [mounted, activeWork?.Hauteur, activeWork?.Largeur, isMobile, centerNaturalSize])

  const centerArtFit = useMemo(() => {
    if (!centerNaturalSize || typeof window === 'undefined') return null
    if (centerPhysMount) {
      const scale = Math.min(centerPhysMount.w / centerNaturalSize.w, centerPhysMount.h / centerNaturalSize.h)
      return { w: centerPhysMount.w, h: centerPhysMount.h, scale }
    }
    return fitArtDisplaySize(centerNaturalSize.w, centerNaturalSize.h, isMobile)
  }, [centerNaturalSize, centerPhysMount, isMobile])

  const centerMountStyle = useMemo((): CSSProperties | undefined => {
    if (centerPhysMount) return { width: centerPhysMount.w, height: centerPhysMount.h }
    if (!centerArtFit) return undefined
    return { width: centerArtFit.w, height: centerArtFit.h }
  }, [centerPhysMount, centerArtFit])

  const hiResImgStyle = useMemo((): CSSProperties | undefined => {
    if (!centerNaturalSize || !centerArtFit) return undefined
    return {
      width: centerNaturalSize.w,
      height: centerNaturalSize.h,
      maxWidth: 'none',
      objectFit: undefined,
      transform: `scale(${centerArtFit.scale})`,
      transformOrigin: 'center center',
    }
  }, [centerNaturalSize, centerArtFit])

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
    setZoomPanning(false)
    setLoadedWorkId(null)
    setCenterNaturalSize(null)
    setTrackFade(true)
    const id = window.setTimeout(() => setTrackFade(false), 220)
    return () => window.clearTimeout(id)
  }, [activeChapterIdx])

  useEffect(() => {
    posRef.current = Math.max(0, Math.min(posRef.current, Math.max(0, chapterWorks.length - 1)))
    velRef.current = 0
    setActiveIndex(Math.round(posRef.current))
  }, [chapterWorks.length])

  useEffect(() => { setCenterNaturalSize(null) }, [activeIndex])

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
    setZoomPanning(false)
  }, [])

  const enterZoom = useCallback(() => {
    if (!centerImgLoaded) return
    velRef.current = 0
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined }
    setIsZoomed(true)
    isZoomedRef.current = true
    const initialZoomZ = isMobile ? 1650 : 1100
    zoomZRef.current = initialZoomZ
    setZoomZ(initialZoomZ)
  }, [centerImgLoaded, isMobile])

  const enterZoomRef = useRef(enterZoom)
  useEffect(() => { enterZoomRef.current = enterZoom }, [enterZoom])
  useEffect(() => { centerImgLoadedRef.current = centerImgLoaded }, [centerImgLoaded])
  useEffect(() => { isMobileRef.current = isMobile }, [isMobile])

  const zoomEnterHint = t(isMobile ? 'pub_works_zoom_hint_enter_mobile' : 'pub_works_zoom_hint_enter_desktop')
  const zoomAdjustHint = t(isMobile ? 'pub_works_zoom_hint_adjust_mobile' : 'pub_works_zoom_hint_adjust_desktop')

  const touchDistance = (touches: React.TouchList) => {
    const a = touches[0]
    const b = touches[1]
    if (!a || !b) return 0
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const onCenterTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length >= 2) {
      e.stopPropagation()
      if (!isZoomedRef.current && centerImgLoadedRef.current) enterZoomRef.current()
      const distance = touchDistance(e.touches)
      if (distance > 0) {
        pinchRef.current = { distance, zoomZ: zoomZRef.current }
        dragRef.current = null
        didDragRef.current = true
        setZoomPanning(true)
        e.preventDefault()
      }
      return
    }
    if (!isZoomedRef.current) return
    e.stopPropagation()
    const touch = e.touches[0]
    if (!touch) return
    pinchRef.current = null
    dragRef.current = { mx: touch.clientX, my: touch.clientY, px: zoomPan.x, py: zoomPan.y }
    didDragRef.current = false
    setZoomPanning(true)
  }

  const onCenterTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isZoomedRef.current && e.touches.length < 2) return
    e.stopPropagation()
    if (pinchRef.current && e.touches.length >= 2) {
      const distance = touchDistance(e.touches)
      const next = pinchRef.current.zoomZ + (distance - pinchRef.current.distance) * 5.5
      zoomZRef.current = Math.max(0, Math.min(next, MAX_Z))
      setZoomZ(zoomZRef.current)
      e.preventDefault()
      return
    }
    if (!dragRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    didDragRef.current = true
    setZoomPan({
      x: dragRef.current.px + touch.clientX - dragRef.current.mx,
      y: dragRef.current.py + touch.clientY - dragRef.current.my,
    })
    e.preventDefault()
  }

  const onCenterTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isZoomedRef.current && e.touches.length === 0 && e.changedTouches.length < 2) return
    e.stopPropagation()
    if (e.touches.length < 2) {
      pinchRef.current = null
      if (e.touches.length === 0) setZoomPanning(false)
    }
    if (e.touches.length === 0) {
      dragRef.current = null
      setZoomPanning(false)
    }
  }

  useEscapeClose(isZoomed, exitZoom)

  useEffect(() => {
    if (isZoomed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { jumpBy(1); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { jumpBy(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isZoomed, jumpBy])

  useEffect(() => { isZoomedRef.current = isZoomed }, [isZoomed])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (isZoomedRef.current) {
        e.preventDefault()
        const next = zoomZRef.current + (-d) * 0.4
        if (next < -40) { exitZoom(); return }
        zoomZRef.current = Math.max(0, Math.min(next, MAX_Z))
        setZoomZ(zoomZRef.current)
        return
      }
      let raw = d
      if (e.deltaMode === 1) raw *= 40
      else if (e.deltaMode === 2) raw *= 600
      const impulse = raw * 0.00025
      velRef.current = Math.max(-1.5, Math.min(velRef.current + impulse, 1.5))
      kickRaf()
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [kickRaf, exitZoom])

  const onStageMouseDown = (e: React.MouseEvent) => {
    if (isZoomedRef.current || e.button !== 0) return
    carouselMouseXRef.current = e.clientX
    carouselDragDidRef.current = false
  }
  const onStageMouseMove = (e: React.MouseEvent) => {
    if (carouselMouseXRef.current == null || isZoomedRef.current) return
    if (Math.abs(e.clientX - carouselMouseXRef.current) >= 8) carouselDragDidRef.current = true
  }
  const onStageMouseUp = (e: React.MouseEvent) => {
    const x0 = carouselMouseXRef.current
    carouselMouseXRef.current = null
    if (x0 == null || isZoomedRef.current) return
    const dx = e.clientX - x0
    if (Math.abs(dx) >= 60) {
      carouselDragDidRef.current = true
      jumpBy(dx < 0 ? 1 : -1)
    }
  }

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
    if (Math.abs(dx) < 20 && elapsed < 300) {
      if (isZoomed) { exitZoom(); return }
      enterZoom()
      return
    }
    if (isZoomed) return
    if (Math.abs(dx) < 60) return
    jumpBy(dx < 0 ? 1 : -1)
  }

  const chapterTitle = chapter ? collectionDisplayHeading(chapter, lang) : ''
  const chapterIntroText = chapter ? collectionIntroPlain(chapter, lang) : ''
  const chapterDesc = chapter ? collectionDescriptionHtml(chapter, lang) : ''
  const showChapterText = chapter ? collectionHasVisibleText(chapter, lang) : false
  const totalSlots = chapterWorks.length
  totalSlotsRef.current = totalSlots
  const mobileZoomScale = 1 + (zoomZ / MAX_Z) * 5

  return (
    <>
      <style>{`
        .w-stage {
          position: fixed; inset: 0;
          background: ${siteTheme.backgroundCss};
          overflow: hidden;
          touch-action: pan-y;
        }
        ${lightTempK !== WORKS_LIGHT_TEMP_DEFAULT ? `
        /* Wall tint — kelvin-driven overlay sits below the carousel cards (z 0). */
        .w-stage::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background: ${light.tintRgba};
          pointer-events: none;
        }
        ` : ''}
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
        .w-card.is-zoomed .w-face.left,
        .w-card.is-zoomed .w-face.right,
        .w-card.is-zoomed .w-face.top,
        .w-card.is-zoomed .w-face.bottom { display: none; }
        .w-card-inner {
          position: relative;
          width: 100%; height: 100%;
          transform-style: preserve-3d;
        }
        ${reducedMotion ? '' : `
        @keyframes w-focus-idle {
          0%, 100% { transform: translate3d(0, 0, 0); }
          33% { transform: translate3d(2px, -4px, 0); }
          66% { transform: translate3d(-2px, -2px, 0); }
        }
        .w-card.center.img-ready:not(.is-zoomed) .w-art-mount {
          animation: w-focus-idle 11s ease-in-out infinite;
        }
        .w-track-wrap.fading .w-card.center .w-art-mount {
          animation-play-state: paused;
        }
        `}
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
        .w-art-mount {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          max-width: 100%;
          max-height: 100%;
          overflow: hidden;
          line-height: 0;
        }
        .w-art-mount.round { border-radius: 50%; }
        .w-card.center .w-art-mount:not(.sized) img.w-card-img {
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: 100%;
        }
        ${bevelShadow ? `
        .w-card.center .w-art-mount::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          border-radius: inherit;
          box-shadow: ${bevelShadow};
        }
        ` : ''}
        .w-card.center .w-art-mount {
          filter: ${castShadowOn ? `drop-shadow(0 ${castDistance}px ${castBlur}px rgba(15,15,20,${(0.34 * light.intensity).toFixed(3)}))
                  drop-shadow(0 ${Math.round(castDistance / 3.75)}px ${Math.round(castBlur / 3.14)}px rgba(15,15,20,${(0.22 * light.intensity).toFixed(3)}))` : 'none'};
        }
        .w-vitrine .w-card { --thickness: 130px; transform-origin: 50% 60%; }
        .w-vitrine .w-card.center .w-art-mount {
          filter: none;
        }
        .w-vitrine .w-track-wrap { perspective: 1400px; perspective-origin: 50% 80%; }
        .w-vitrine .w-face.top {
          background: linear-gradient(to right, #d4cbb6 0%, #e8dec6 50%, #d4cbb6 100%) !important;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.55) !important;
        }
        .w-vitrine .w-face.bottom {
          background: linear-gradient(to right, #5d564a 0%, #6e6655 50%, #5d564a 100%) !important;
        }
        .w-vitrine .w-card.center::before {
          content: '';
          position: absolute;
          left: -10%; right: -10%;
          bottom: -38px;
          height: 70px;
          background: radial-gradient(ellipse at center,
            rgba(8,8,12,${(0.40 * light.intensity).toFixed(3)}) 0%,
            rgba(8,8,12,0) 70%);
          filter: blur(8px);
          pointer-events: none;
          z-index: -1;
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
        .w-card-img.zoomed {
          image-rendering: auto;
        }
        .w-card.center          { cursor: default; }
        .w-card.center.img-ready:not(.is-zoomed) { cursor: zoom-in; }
        .w-card.center.is-zoomed { cursor: zoom-out; touch-action: none; }
        .w-card.center.is-zoomed:active { cursor: grabbing; }
        .w-card.side            { cursor: pointer; }
        .w-card.text            { width: min(36vw, 480px); height: auto; max-height: min(80vh, 720px); margin-left: calc(-1 * min(36vw, 480px) / 2); margin-top: 0; cursor: default; }
        .w-card.zoomed-out      { pointer-events: none; }
        .w-card.side.left .w-card-img {
          filter: drop-shadow(-10px 13px 18px rgba(0,0,0,${(0.30 * light.intensity).toFixed(3)}))
                  drop-shadow(0 10px 15px rgba(15,15,20,${(0.20 * light.intensity).toFixed(3)}));
        }
        .w-card.side.right .w-card-img {
          filter: drop-shadow(10px 13px 18px rgba(0,0,0,${(0.30 * light.intensity).toFixed(3)}))
                  drop-shadow(0 10px 15px rgba(15,15,20,${(0.20 * light.intensity).toFixed(3)}));
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
        .w-collection-text-panel {
          position: fixed;
          left: clamp(20px, 3.5vw, 48px);
          bottom: clamp(72px, 12vh, 120px);
          z-index: 180;
          max-width: min(280px, 28vw);
          max-height: min(36vh, 320px);
          overflow-y: auto;
          pointer-events: auto;
          scrollbar-width: none;
          opacity: 1;
          transition: opacity 300ms ease;
        }
        .w-collection-text-panel::-webkit-scrollbar { display: none; }
        .w-collection-text-panel.is-hidden { opacity: 0; pointer-events: none; }
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
        .w-logo { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; transition: color .15s; }
        .w-navlinks { display: flex; gap: clamp(14px, 2.5vw, 28px); align-items: center; }
        .w-navlink { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; text-decoration: none; transition: color .15s; }
        .w-lang {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          background: none; padding: 3px 8px; cursor: pointer; transition: all .15s; font-family: inherit;
          min-height: 32px; display: inline-flex; align-items: center;
        }
        .w-zoom-backdrop {
          position: absolute;
          inset: 0;
          z-index: 200;
          cursor: zoom-out;
        }
        .w-zoom-close {
          position: fixed;
          z-index: 400;
          top: auto;
          left: auto;
          bottom: max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px));
          right: clamp(16px, 4vw, 36px);
          width: 48px;
          height: 48px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.88);
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 50%;
          font-size: 22px;
          line-height: 1;
          color: #1a1816;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        }
        .w-page-h1-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
        @media (max-width: 767px) {
          .w-card {
            --thickness: 0px;
            width: min(86vw, 520px);
            height: min(54vh, 540px);
            margin-left: calc(-1 * min(86vw, 520px) / 2);
            margin-top:  calc(-1 * min(54vh, 540px) / 2);
          }
          .w-card .w-face.left,
          .w-card .w-face.right,
          .w-card .w-face.top,
          .w-card .w-face.bottom {
            display: none;
          }
          .w-card.text {
            width: min(72vw, 360px);
            height: min(68svh, 620px);
            max-height: calc(100svh - 168px);
            margin-left: calc(-1 * min(72vw, 360px) / 2);
            margin-top: 0;
          }
          .w-card.text .w-text-card-front {
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding: 24px 20px 28px;
          }
          .w-card.text .w-text-card-body {
            font-size: 11px;
            line-height: 1.75;
          }
          .w-arrow { width: 48px; height: 48px; font-size: 22px; }
          .w-arrow.prev { left: 8px; }
          .w-arrow.next { right: 8px; }
          .w-caption { bottom: clamp(110px, 16vh, 160px); }
          .w-cartel {
            right: auto !important;
            top: calc(46% + min(27vh, 270px) + 16px) !important;
            bottom: auto !important;
            left: 50%;
            transform: translateX(-50%) !important;
            text-align: center !important;
            width: min(88vw, 400px) !important;
          }
          .w-cartel .w-work-details {
            align-items: center !important;
          }
          .w-bottom-stack {
            bottom: max(46px, calc(env(safe-area-inset-bottom) + 34px));
            gap: 3px;
            max-width: 86vw;
          }
          .w-section-nav-label {
            display: none;
          }
          .w-section-pills {
            gap: 4px;
          }
          .w-section-pill {
            min-height: 36px;
            padding: 6px 3px;
          }
          .w-nav-hint {
            display: none;
          }
          .w-zoom-close {
            bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px));
            right: 12px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .w-card { transition: transform 250ms ease, opacity 250ms ease; }
          .w-card .w-art-mount { animation: none !important; }
        }
      `}</style>

      {layout === 'grid' ? (
        <WorksGrid
          works={works}
          mode={mode}
          activeChapterIdx={activeChapterIdx}
          onChapterChange={setActiveChapterIdx}
          siteTheme={siteTheme}
        />
      ) : layout === 'procession' ? (
        <WorksProcessionLayout works={chapterWorks} mode={mode} bevelShadow={bevelShadow} light={light} siteTheme={siteTheme} />
      ) : layout === 'salon' ? (
        <WorksSalonLayout works={chapterWorks} mode={mode} bevelShadow={bevelShadow} light={light} siteTheme={siteTheme} />
      ) : layout === 'timeline' ? (
        <WorksTimelineLayout works={chapterWorks} mode={mode} bevelShadow={bevelShadow} light={light} siteTheme={siteTheme} />
      ) : layout === 'letter' ? (
        <WorksLetterLayout works={chapterWorks} mode={mode} bevelShadow={bevelShadow} light={light} siteTheme={siteTheme} />
      ) : WORKS_LAYOUT_PLACEHOLDERS.has(layout as WorksLayout) ? (
        <WorksPlaceholderLayout layout={layout as WorksLayout} siteTheme={siteTheme} />
      ) : (
      <div
        className={`w-stage pem-grain${layout === 'vitrine' ? ' w-vitrine' : ''}`}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onMouseLeave={onStageMouseUp}
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
            <div
              className="w-track"
              style={isZoomed && !isMobile
                ? { transform: `translateZ(${zoomZ}px)`, transition: 'transform 0.10s ease-out' }
                : undefined}
            >
              {/* Wall plane: grain texture */}
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
              {/* Wall plane: overhead light well */}
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

              {isZoomed && (
                <div
                  className="w-zoom-backdrop"
                  aria-hidden
                  onClick={exitZoom}
                />
              )}

              {/* Wall-mounted cartel */}
              {activeWork && !(isMobile && isZoomed) && (
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
                      <span className="w-zoom-enter-hint" style={{ marginTop: 4, color: '#9a958f' }}>{zoomEnterHint}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Collection title on the wall */}
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
                  {showChapterText && chapterIntroText && (
                    <p style={{ fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase', color: '#7a7570', margin: '5px 0 0' }}>{chapterIntroText}</p>
                  )}
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

                const finalTransform = isCenter && isZoomed
                  ? isMobile
                    ? `translate(${zoomPan.x}px, ${zoomPan.y}px) scale(${mobileZoomScale}) ${transform}`
                    : `translate(${zoomPan.x}px, ${zoomPan.y}px) ${transform}`
                  : transform
                const finalZ = isCenter && isZoomed ? 300 : zIndex

                const zoomCardStyle: CSSProperties = isCenter && isZoomed && centerMountStyle
                  ? {
                      width: centerMountStyle.width as number,
                      height: centerMountStyle.height as number,
                      marginLeft: -(centerMountStyle.width as number) / 2,
                      marginTop: -(centerMountStyle.height as number) / 2,
                    }
                  : {}

                const classes = [
                  'w-card',
                  isCenter ? 'center' : `side ${sideClass}`,
                  isCenter && centerImgLoaded && !isZoomed ? 'img-ready' : '',
                  isCenter && isZoomed ? 'is-zoomed' : '',
                  isCenter && isZoomed && zoomPanning ? 'w-panning' : '',
                  isSide && isZoomed ? 'zoomed-out' : '',
                ].filter(Boolean).join(' ')

                return (
                  <div
                    key={`work-${w.OeuvreID}`}
                    className={classes}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={w.Titre ?? t('pub_untitled')}
                    style={{ transform: finalTransform, opacity, zIndex: finalZ, ...zoomCardStyle }}
                    onClick={() => {
                      if (didDragRef.current) { didDragRef.current = false; return }
                      if (carouselDragDidRef.current) { carouselDragDidRef.current = false; return }
                      if (isCenter && isZoomed) {
                        exitZoom()
                      } else if (isCenter) {
                        enterZoom()
                      } else {
                        setActiveIndex(i)
                      }
                    }}
                    onMouseDown={isCenter && isZoomed ? (e) => { dragRef.current = { mx: e.clientX, my: e.clientY, px: zoomPan.x, py: zoomPan.y }; didDragRef.current = false; setZoomPanning(true); e.preventDefault() } : undefined}
                    onMouseMove={isCenter && isZoomed ? (e) => { if (!dragRef.current) return; didDragRef.current = true; setZoomPan({ x: dragRef.current.px + e.clientX - dragRef.current.mx, y: dragRef.current.py + e.clientY - dragRef.current.my }) } : undefined}
                    onMouseUp={isCenter && isZoomed ? () => { dragRef.current = null; setZoomPanning(false) } : undefined}
                    onMouseLeave={isCenter && isZoomed ? () => { dragRef.current = null; setZoomPanning(false) } : undefined}
                    onTouchStart={isCenter && centerImgLoaded ? onCenterTouchStart : undefined}
                    onTouchMove={isCenter && centerImgLoaded ? onCenterTouchMove : undefined}
                    onTouchEnd={isCenter && centerImgLoaded ? onCenterTouchEnd : undefined}
                    onTouchCancel={isCenter && centerImgLoaded ? onCenterTouchEnd : undefined}
                  >
                    <div className="w-card-inner">
                      {!(isCenter && isZoomed) && <div className="w-face left" aria-hidden />}
                      {!(isCenter && isZoomed) && <div className="w-face right" aria-hidden />}
                      {!(isCenter && isZoomed) && <div className="w-face top" aria-hidden />}
                      {!(isCenter && isZoomed) && <div className="w-face bottom" aria-hidden />}
                      <div className="w-face front">
                        {isCenter ? (
                          <div
                            key="center-mount"
                            suppressHydrationWarning
                            className={[
                              'w-art-mount',
                              centerMountStyle ? 'sized' : '',
                              w.isRound ? 'round' : '',
                            ].filter(Boolean).join(' ')}
                            style={centerMountStyle}
                          >
                            <img
                              src={src}
                              alt={w.Titre ?? ''}
                              className={`w-card-img${w.isRound ? ' round' : ''}${isZoomed ? ' zoomed' : ''}`}
                              draggable={false}
                              style={hiResImgStyle}
                              ref={(el) => { if (el?.complete && el.naturalWidth > 0 && loadedWorkId !== w.OeuvreID) { setLoadedWorkId(w.OeuvreID); setCenterNaturalSize({ w: el.naturalWidth, h: el.naturalHeight }); recordNaturalSize(w.OeuvreID, el.naturalWidth, el.naturalHeight) } }}
                              onLoad={(e) => { const img = e.currentTarget; setLoadedWorkId(w.OeuvreID); setCenterNaturalSize({ w: img.naturalWidth, h: img.naturalHeight }); recordNaturalSize(w.OeuvreID, img.naturalWidth, img.naturalHeight) }}
                            />
                          </div>
                        ) : (() => {
                          const hauteur = mounted ? parseDimensionCm(w.Hauteur) : null
                          const largeur = mounted ? parseDimensionCm(w.Largeur) : null
                          const nat = naturalSizes.get(w.OeuvreID)
                          if (hauteur && largeur) {
                            const phys = physicalArtDisplaySize(hauteur, largeur, isMobile, nat?.w, nat?.h)
                            return (
                              <div
                                key="side-mount"
                                className={['w-art-mount', 'sized', 'side-phys', w.isRound ? 'round' : ''].filter(Boolean).join(' ')}
                                style={{ width: phys.w, height: phys.h, overflow: w.isRound ? 'hidden' : 'visible' }}
                              >
                                <img
                                  src={src}
                                  alt={w.Titre ?? ''}
                                  className={`w-card-img${w.isRound ? ' round' : ''}`}
                                  draggable={false}
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                  onLoad={(e) => { const img = e.currentTarget; if (img.naturalWidth > 0) recordNaturalSize(w.OeuvreID, img.naturalWidth, img.naturalHeight) }}
                                />
                              </div>
                            )
                          }
                          return (
                            <img
                              key="side-img"
                              src={src}
                              alt={w.Titre ?? ''}
                              className={`w-card-img${w.isRound ? ' round' : ''}`}
                              draggable={false}
                              onLoad={(e) => { const img = e.currentTarget; if (img.naturalWidth > 0) recordNaturalSize(w.OeuvreID, img.naturalWidth, img.naturalHeight) }}
                            />
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {showChapterText && chapterDesc && (
          <div
            className={`w-collection-text-panel${isZoomed ? ' is-hidden' : ''}`}
            aria-label={chapterTitle || t('pub_works')}
          >
            <WorksSectionTextCard
              html={chapterDesc}
              title={chapterTitle || undefined}
              variant="carousel"
            />
          </div>
        )}

        {isZoomed && (
          <button
            type="button"
            className="w-zoom-close"
            onClick={exitZoom}
            aria-label={t('pub_works_zoom_close_aria')}
          >×</button>
        )}

        {isZoomed && (
          <div className="w-lean-hint" style={{ opacity: zoomZ <= 50 ? 1 : 0 }}>
            {zoomAdjustHint}
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
                const label = collectionDisplayHeading(c, lang)
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

        {/* Life-size visitor silhouette */}
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

        {!isZoomed && (
          <div className="w-nav-hint" aria-hidden style={{
            position: 'fixed', bottom: 'clamp(14px, 3vh, 28px)', left: 'clamp(24px, 4vw, 48px)',
            zIndex: 240, pointerEvents: 'none',
            fontSize: 7, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a958f',
          }}>
            {t('pub_works_nav_hint')}
          </div>
        )}

      </div>
      )}
    </>
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
