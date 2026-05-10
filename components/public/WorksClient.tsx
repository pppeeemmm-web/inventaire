'use client'

import type { WheelEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, yearOf } from '@/lib/data'
import { useEffect, useState, useRef, useMemo } from 'react'
import PublicNav from './PublicNav'
import type { WorksUxMode } from '@/lib/worksUx'

/** Virtual distance between sequence slide centers (wheel deltas map here). */
const WORKS_STEP = 7200
/** Matches slide spacing — keeps birth / micro transitions proportional. */
const WORKS_BIRTH_DIST = WORKS_STEP * 10
/** Scroll budget past the last slide center (end hint + “retour”), then hard stop — no infinite wheel. */
const WORKS_END_TAIL = 1.22

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
      width: '100%', maxWidth: '100%', fontSize: 'clamp(9px, 1.1vw, 13px)',
      lineHeight: 1.9, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: '#8a8680', textAlign: 'justify', wordSpacing: '0.3em',
      fontFamily: 'JetBrains Mono, monospace', margin: 0,
    }}>
      {formatted}
    </p>
  )
}

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Bidirectional substring match on normalized theme names */
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

type SequenceItem =
  /** leadInCollection: first image of this collection — micro-scale birth transition */
  | { type: 'work'; data: Work; collectionId?: string; workIndex: number; leadInCollection: boolean }
  /** Closing prose after works (FlameText) */
  | { type: 'header'; title: string; subtitle?: string; collectionId?: string }
  /** Opening HTML before works (matches Diffusion rich editor) */
  | { type: 'intro'; title: string; subtitle?: string; collectionId?: string }
  /** Between collections when worksUx=bridge */
  | { type: 'bridge'; nextTitle: string }
  | { type: 'outro'; html_fr: string; html_en: string }

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
  /** default | bridge | intro | chapters — query ?worksUx= or NEXT_PUBLIC_WORKS_UX_MODE */
  worksUxMode?: WorksUxMode
  /** Removed UI; optional so stale bundles / partial merges never ReferenceError */
  showUxPicker?: boolean
  uxPickerSticky?: boolean
}

type SectionPill = { seqIdx: number; title: string; chapterIdx: number }

function buildWorksSequence(
  works: Work[],
  mode: WorksMode,
  lang: 'fr' | 'en',
  worksUxMode: WorksUxMode,
  activeChapterIdx: number,
): { sequence: SequenceItem[]; curatedGroupsNomatch: boolean; collectionSections: SectionPill[] } {
  const items: SequenceItem[] = []
  /** Preserve Diffusion order (sort_order). Each collection lists its own works — no cross-collection stealing. */
  const allActive = mode.collections

  let activeCollections = allActive
  if (worksUxMode === 'chapters') {
    const pick = allActive[activeChapterIdx]
    activeCollections = pick ? [pick] : []
  }

  for (let i = 0; i < activeCollections.length; i++) {
    const col = activeCollections[i]
    let colWorks = worksForCollection(col, works)

    const orderIds = col.manual_work_order ?? []
    if (orderIds.length > 0 && colWorks.length > 0) {
      const rank = new Map(orderIds.map((id, idx) => [id, idx]))
      colWorks = colWorks.slice().sort((a, b) => {
        const ai = rank.has(a.OeuvreID) ? rank.get(a.OeuvreID)! : Number.POSITIVE_INFINITY
        const bi = rank.has(b.OeuvreID) ? rank.get(b.OeuvreID)! : Number.POSITIVE_INFINITY
        return ai - bi
      })
    }

    const title = lang === 'en' ? (col.title_en || col.title_fr) : (col.title_fr || col.title_en)
    const subtitleClosing = lang === 'en' ? (col.description_en || col.description_fr) : (col.description_fr || col.description_en)
    const introHtml = lang === 'en' ? (col.intro_en ?? '') : (col.intro_fr ?? '')
    const hasIntro = Boolean(introHtml && htmlToPlain(introHtml).trim())
    const hasClosing = Boolean((title && title.trim()) || (subtitleClosing && htmlToPlain(subtitleClosing).trim()))

    if (colWorks.length === 0 && !hasClosing && !hasIntro) continue

    if (worksUxMode === 'bridge' && i > 0) {
      items.push({ type: 'bridge', nextTitle: title?.trim() || '—' })
    }

    if (hasIntro) {
      items.push({
        type: 'intro',
        title: title?.trim() ? title : '',
        subtitle: introHtml,
        collectionId: col.id,
      })
    }

    colWorks.forEach((w, wi) => {
      const workIndex = items.filter(x => x.type === 'work').length
      items.push({
        type: 'work',
        data: w,
        collectionId: col.id,
        workIndex,
        leadInCollection: wi === 0,
      })
    })

    if (hasClosing) {
      items.push({
        type: 'header',
        title: title?.trim() ? title : '',
        subtitle: subtitleClosing,
        collectionId: col.id,
      })
    }
  }

  if (items.length === 0 && allActive.length === 0) {
    works.filter(w => w.txtImageNameLink).forEach((w, i) => {
      items.push({ type: 'work', data: w, workIndex: i, leadInCollection: i === 0 })
    })
  }

  const curatedGroupsNomatch = items.length === 0 && allActive.length > 0

  const itemsBeforeOutro = items.slice()

  if (mode.outro_fr || mode.outro_en) {
    items.push({ type: 'outro', html_fr: mode.outro_fr, html_en: mode.outro_en })
  }

  const sectionPills: SectionPill[] = []
  allActive.forEach((col, chapterIdx) => {
    const label = lang === 'en' ? (col.title_en || col.title_fr) : (col.title_fr || col.title_en)
    if (worksUxMode === 'chapters') {
      sectionPills.push({ seqIdx: 0, title: label?.trim() || '—', chapterIdx })
      return
    }
    const intros = itemsBeforeOutro.findIndex(
      it => it.type === 'intro' && it.collectionId === col.id,
    )
    const wrk = itemsBeforeOutro.findIndex(
      it => it.type === 'work' && it.collectionId === col.id,
    )
    const hdr = itemsBeforeOutro.findIndex(
      it => it.type === 'header' && it.collectionId === col.id,
    )
    let seqIdx = -1
    if (intros >= 0) seqIdx = intros
    else if (wrk >= 0) seqIdx = wrk
    else seqIdx = hdr
    if (seqIdx >= 0) sectionPills.push({ seqIdx, title: label?.trim() || '—', chapterIdx })
  })

  return { sequence: items, curatedGroupsNomatch, collectionSections: sectionPills }
}

/** Membership per collection only (no global de-dupe across sequences). */
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
    return true
  }).filter(w => {
    if (seenHere.has(w.OeuvreID)) return false
    seenHere.add(w.OeuvreID)
    return true
  })
}

export default function WorksClient({
  works,
  modes,
  worksUxMode = 'default',
  showUxPicker = false,
  uxPickerSticky = false,
}: Props) {
  const { t, lang } = useI18n()
  const [activeModeIdx, setActiveModeIdx] = useState(0)
  const [activeChapterIdx, setActiveChapterIdx] = useState(0)
  const safeModes = modes.length > 0 ? modes : [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    collections: [], outro_fr: '', outro_en: '',
  }]
  const mode = safeModes[Math.min(activeModeIdx, safeModes.length - 1)]

  const allActiveLen = useMemo(() => mode.collections.length, [mode.collections])

  useEffect(() => {
    if (worksUxMode !== 'chapters') setActiveChapterIdx(0)
  }, [worksUxMode])

  useEffect(() => {
    setActiveChapterIdx(i => {
      if (allActiveLen <= 0) return 0
      return Math.min(i, allActiveLen - 1)
    })
  }, [allActiveLen])

  const { sequence, curatedGroupsNomatch, collectionSections } = useMemo(
    () => buildWorksSequence(works, mode, lang as 'fr' | 'en', worksUxMode, activeChapterIdx),
    [works, mode, lang, worksUxMode, activeChapterIdx],
  )

  // Last "scrollable" index: last work, or outro card if present (so end overlay
  // appears AFTER the closing text, not over it).
  const lastWorkIdx = useMemo(() =>
    sequence.reduce((acc, s, i) => (s.type === 'work' || s.type === 'outro') ? i : acc, -1)
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

  const STEP       = WORKS_STEP
  const BIRTH_DIST = WORKS_BIRTH_DIST
  /** Narrow focus band — less stacking ghost between neighbours */
  const WORK_IN    = STEP * 0.17
  const WORK_OUT   = STEP * 0.21
  /** Text slides: slightly tighter than 0.2×STEP for cleaner hand-offs */
  const TEXT_BAND  = STEP * 0.175
  /** First image of each collection: start ~micro, grow across full approach */
  const LEAD_MICRO = 0.028
  /** Extra depth (px, more negative) so the lead painting begins farther “back” in Z */
  const LEAD_Z_PUSH = 38000

  const touchLastY  = useRef<number | null>(null)
  const touchVelY   = useRef(0)

  /** After sequence changes (mode/tab), keep depth inside the new stack — no runaway target. */
  useEffect(() => {
    const maxScroll =
      sequence.length === 0
        ? 0
        : (sequence.length - 1) * WORKS_STEP + WORKS_STEP * WORKS_END_TAIL
    if (targetDepth.current > maxScroll) {
      targetDepth.current = maxScroll
      currentDepth.current = maxScroll
      setDisplayDepth(maxScroll)
    }
  }, [sequence])

  useEffect(() => {
    const maxScroll =
      sequence.length === 0
        ? 0
        : (sequence.length - 1) * STEP + STEP * WORKS_END_TAIL

    const softClamp = (v: number) => Math.max(0, Math.min(v, maxScroll))

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
  }, [sequence, lastWorkIdx, STEP])

  const [burnSnapshot, setBurnSnapshot] = useState<Map<number, number>>(new Map())
  useEffect(() => {
    let raf: number
    const tick = () => { setBurnSnapshot(new Map(burnZooms.current)); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const opacityBirth = (dist: number) =>
    Math.pow(Math.max(0, (dist + BIRTH_DIST) / BIRTH_DIST), 4)
  const workSlideOpacity = (dist: number) =>
    dist < 0 ? opacityBirth(dist) : Math.max(0, 1 - Math.max(0, dist - WORK_IN) / WORK_OUT)
  const textSlideOpacity = (dist: number) =>
    dist < 0 ? opacityBirth(dist) : Math.max(0, 1 - Math.abs(dist) / TEXT_BAND)

  /**
   * After intro/bridge, the next work used to “peek” at ~60%+ opacity while intro was still
   * centered (birth curve at dist = −STEP). This gates the painting to 0 until scroll gets
   * within `gate` of the work center, then ramps — proper sequence: text alone → then image.
   */
  function workRevealAfterTextSlide(dist: number, gate: number): number {
    if (dist >= 0) return 1
    if (dist <= -gate) return 0
    return (dist + gate) / gate
  }

  /** Wheel inside scrollable prose should scroll text, not advance the slide stack */
  const absorbNestedWheel = (e: WheelEvent<HTMLDivElement>) => {
    const t = e.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = t
    if (scrollHeight <= clientHeight + 2) return
    const dy = e.deltaY
    const atTop = scrollTop <= 1
    const atBottom = scrollTop + clientHeight >= scrollHeight - 2
    if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) {
      e.stopPropagation()
    }
  }

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
        /* Full-viewport typography slides — isolated from image stack, long copy scrolls */
        .w-text-slide {
          position: relative; width: 100%; min-height: 100vh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center;
          padding: clamp(88px, 11vh, 120px) clamp(24px, 6vw, 96px) clamp(96px, 14vh, 140px);
          pointer-events: none;
        }
        .w-text-slide-scroll {
          width: 100%; max-width: min(680px, 92vw);
          max-height: min(70vh, 640px);
          overflow-y: auto; overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          pointer-events: auto;
          cursor: auto;
          padding: clamp(18px, 2.8vw, 32px) clamp(14px, 2.5vw, 24px);
          margin-top: clamp(10px, 2vh, 28px);
          background: rgba(248, 245, 239, 0.96);
          border: 1px solid rgba(26, 24, 22, 0.07);
          border-radius: 3px;
          box-shadow:
            0 12px 56px rgba(248, 245, 239, 0.98),
            0 0 0 1px rgba(255, 252, 245, 0.5);
        }
        .w-text-slide-scroll:first-child { margin-top: 0; }
        .w-bridge-inner {
          max-height: none;
          padding: clamp(22px, 3vw, 36px) clamp(20px, 4vw, 40px);
        }
        /* Intro from CMS rich editor — readable, matches Atelier preview */
        .w-intro-prose {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(17px, 2.4vw, 26px);
          line-height: 1.5;
          color: #252320;
          text-align: center;
          font-weight: 400;
        }
        .w-intro-prose p { margin: 0.45em 0; }
        .w-intro-prose p:first-child { margin-top: 0; }
        .w-intro-prose p:last-child { margin-bottom: 0; }
        .w-intro-prose strong { font-weight: 600; }
        .w-intro-prose em { font-style: italic; }
        .w-header-title {
          font-family: 'Instrument Serif', serif; font-size: clamp(80px, 15vw, 240px);
          color: #1a1816; letter-spacing: -0.05em; line-height: 0.85;
          margin-bottom: clamp(12px, 2vh, 32px);
          transition: opacity 0.3s;
          pointer-events: none;
        }
        .w-text-slide:hover .w-header-title { opacity: 0.72; }

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
          font-size: clamp(8px, 1.1vw, 9px); letter-spacing: 4px; text-transform: uppercase;
          color: #6a6660; text-decoration: none;
          text-shadow: 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.8);
          transition: color 0.2s;
        }
        .w-navlink:hover, .w-navlink.active { color: #1a1816; }
        .w-lang {
          font-size: clamp(8px, 1.1vw, 9px); letter-spacing: 4px; text-transform: uppercase;
          color: #6a6660; background: none; border: none; cursor: pointer;
          text-shadow: 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.8);
          font-family: inherit; padding: 0; transition: color 0.2s;
          min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
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
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50%       { opacity: 0.5;  transform: translateY(4px); }
        }
        .w-scroll-hint {
          font-size: clamp(7px, 1vw, 8px); letter-spacing: 4px; color: #b0aca6; text-transform: uppercase;
          animation: w-hint-pulse 2.4s ease-in-out infinite;
          text-shadow: 0 0 12px rgba(255,255,255,1); transition: opacity 0.6s;
          text-align: center;
        }
        @media (max-width: 640px) {
          .w-navlinks { gap: clamp(12px, 2.5vw, 20px); }
          .w-nav { padding: 16px clamp(16px, 4vw, 24px); }
        }

        /* ── Mode tab bar ── */
        .w-mode-tab {
          pointer-events: auto;
          font-size: clamp(8px, 1.05vw, 9px); letter-spacing: 3px; text-transform: uppercase;
          color: #6a6660; background: none; border: none; padding: 8px 4px; cursor: pointer;
          font-family: inherit; transition: color 0.2s;
          text-shadow: 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.8);
          min-height: 36px; display: inline-flex; align-items: center;
          border-bottom: 1px solid transparent;
        }
        .w-mode-tab:hover { color: #1a1816; }
        .w-mode-tab.active { color: #1a1816; border-bottom-color: #1a1816; }

        .w-modes-wrap {
          position: fixed;
          top: clamp(44px, 6vh, 64px);
          left: 0; right: 0;
          z-index: 280;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }
        .w-modes-label {
          font-size: clamp(7px, 0.95vw, 8px);
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #8a8680;
          text-shadow: 0 0 10px rgba(255,255,255,0.9);
        }
        .w-modes-inner {
          display: flex;
          justify-content: center;
          gap: clamp(10px, 2vw, 24px);
          flex-wrap: wrap;
          padding: 0 clamp(16px, 4vw, 32px);
          pointer-events: none;
        }

        /* ── Collection jump (several collections in one mode) ── */
        .w-bottom-stack {
          position: fixed;
          bottom: clamp(14px, 3.5vh, 28px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 290;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          max-width: min(96vw, 720px);
          pointer-events: none;
        }
        .w-section-nav-label {
          font-size: clamp(7px, 0.95vw, 8px);
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #8a8680;
          text-shadow: 0 0 10px rgba(255,255,255,0.9);
          align-self: center;
        }
        .w-section-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          pointer-events: auto;
        }
        .w-section-pill {
          font-size: clamp(7px, 1vw, 9px);
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #5a5854;
          background: rgba(255,252,245,0.72);
          border: 1px solid rgba(26,24,22,0.12);
          border-radius: 999px;
          padding: 8px 14px;
          cursor: pointer;
          font-family: inherit;
          max-width: min(42vw, 220px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 2px 16px rgba(255,255,255,0.6);
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .w-section-pill:hover {
          color: #1a1816;
          border-color: rgba(26,24,22,0.35);
          background: rgba(255,252,245,0.92);
        }
        .w-section-pill.active {
          color: #1a1816;
          border-color: rgba(26,24,22,0.45);
          background: rgba(255,252,245,0.98);
          box-shadow: 0 0 0 1px rgba(26,24,22,0.08);
        }

        /* ── Outro card ── */
        .w-outro-card {
          width: min(720px, 86vw);
          max-height: min(82vh, 800px);
          padding: clamp(28px, 5vw, 56px) clamp(20px, 4vw, 40px);
          text-align: center;
          display: flex; flex-direction: column;
          background: rgba(248, 245, 239, 0.55);
          border-radius: 4px;
          pointer-events: auto;
        }
        .w-outro-rule {
          flex-shrink: 0;
          width: clamp(40px, 6vw, 64px); height: 1px;
          background: rgba(20,24,22,0.35);
          margin: 0 auto clamp(16px, 2.5vw, 28px);
        }
        .w-outro-scroll-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          padding-right: 4px;
          margin-right: -4px;
        }
        .w-outro-text {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(15px, 2.2vw, 22px);
          line-height: 1.6; color: #1a1816;
          font-style: italic; letter-spacing: -0.005em;
          text-shadow: 0 0 24px rgba(255,255,255,1), 0 0 48px rgba(255,255,255,0.85);
        }
        .w-outro-text p + p { margin-top: 1em; }
      `}</style>

      <div className="w-paper-bg" />
      <div className="grain-overlay" id="grain" />
      <PublicNav active="works" prefix="w" />

      {worksUxMode !== 'default' && (
        <div
          className="t-mono-xs"
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 400,
            padding: '6px 10px', borderRadius: 4,
            background: 'rgba(248,245,239,0.92)', border: '1px solid rgba(26,24,22,0.12)',
            fontSize: 9, letterSpacing: 2, color: '#6a6660', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
        >
          {t('pub_works_preview_badge')} · {worksUxMode}
        </div>
      )}

      {curatedGroupsNomatch && (
        <div
          role="status"
          style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 400, maxWidth: 'min(420px, 88vw)', textAlign: 'center',
            fontSize: 12, letterSpacing: '0.08em', lineHeight: 1.65, color: '#6a6660',
            pointerEvents: 'none',
          }}
        >
          {t('pub_works_groups_nomatch')}
        </div>
      )}

      {safeModes.length > 1 && (
        <div className="w-modes-wrap">
          <span className="w-modes-label">{t('pub_works_views_label')}</span>
          <div className="w-modes-inner">
            {safeModes.map((m, i) => {
              const label = lang === 'en' ? (m.label_en || m.label_fr) : (m.label_fr || m.label_en)
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`w-mode-tab${i === activeModeIdx ? ' active' : ''}`}
                  title={lang === 'en' ? 'Switch work layout' : 'Changer de présentation des œuvres'}
                  onClick={() => {
                    if (i === activeModeIdx) return
                    setActiveModeIdx(i)
                    setActiveChapterIdx(0)
                    targetDepth.current = 0
                    currentDepth.current = 0
                    setDisplayDepth(0)
                    setEndOpacity(0)
                    setActiveWork(null)
                    setCaptionOpacity(0)
                  }}
                >{label || `Mode ${i + 1}`}</button>
              )
            })}
          </div>
        </div>
      )}

      <div className="w-viewport">
        {sequence.map((item, idx) => {
          const centerPos = idx * STEP
          const dist      = displayDepth - centerPos

          const prevItem = idx > 0 ? sequence[idx - 1] : undefined
          const afterIntroOrBridge =
            item.type === 'work'
            && prevItem
            && (prevItem.type === 'intro' || prevItem.type === 'bridge')

          const AFTER_TEXT_GATE = STEP * 0.44

          let opacity =
            item.type === 'work'
              ? workSlideOpacity(dist)
              : item.type === 'bridge' || item.type === 'intro' || item.type === 'header' || item.type === 'outro'
                ? textSlideOpacity(dist)
                : 0

          if (afterIntroOrBridge) {
            opacity *= workRevealAfterTextSlide(dist, AFTER_TEXT_GATE)
          }

          let translateZ = 0
          let scale = 1
          if (dist < 0) {
            const progress  = Math.max(0, (dist + BIRTH_DIST) / BIRTH_DIST)
            translateZ      = -BIRTH_DIST + BIRTH_DIST * progress
            const remapped  = Math.max(0, (progress - 0.6) / 0.4)
            scale           = Math.pow(remapped, 1.8)
          }

          if (opacity <= 0 && Math.abs(dist) > BIRTH_DIST + 5000) return null

          let zIndex = 1000 - Math.floor(Math.abs(dist) / 50)
          if (
            item.type !== 'work'
            && Math.abs(dist) < STEP * 0.32
          ) {
            zIndex = Math.max(zIndex, 920)
          }

          if (item.type === 'bridge') {
            return (
              <div key={`bridge-${idx}`} className="w-depth-item" style={{
                opacity,
                transform: `translate3d(0, 0, ${translateZ * 1.15}px) scale(${scale * 0.82})`,
                zIndex, pointerEvents: Math.abs(dist) < TEXT_BAND ? 'auto' : 'none',
              }}>
                <div className="w-text-slide">
                  <div className="w-text-slide-scroll w-bridge-inner">
                  <div style={{
                    fontSize: 'clamp(8px, 1vw, 10px)', letterSpacing: '0.35em', textTransform: 'uppercase',
                    color: '#9a9690', marginBottom: 14,
                  }}>{t('pub_works_bridge_label')}</div>
                  <div style={{
                    fontFamily: 'Instrument Serif, serif', fontSize: 'clamp(22px, 4vw, 34px)',
                    color: '#3a3834', lineHeight: 1.25,
                  }}>{item.nextTitle}</div>
                  </div>
                </div>
              </div>
            )
          }

          if (item.type === 'header' || item.type === 'intro') {
            const k = item.type === 'intro' ? `intro-${item.collectionId ?? idx}` : `header-${item.collectionId ?? idx}`
            return (
              <div key={k} className="w-depth-item" style={{
                opacity,
                transform: `translate3d(0, 0, ${translateZ * 1.2}px) scale(${scale * 0.8})`,
                zIndex, pointerEvents: Math.abs(dist) < TEXT_BAND ? 'auto' : 'none',
              }}>
                <div className="w-text-slide">
                  {item.title?.trim() ? <h1 className="w-header-title">{item.title}</h1> : null}
                  {item.subtitle ? (
                    item.type === 'intro' ? (
                      <div
                        className="w-text-slide-scroll w-intro-prose"
                        onWheel={absorbNestedWheel}
                        dangerouslySetInnerHTML={{ __html: item.subtitle }}
                      />
                    ) : (
                      <div className="w-text-slide-scroll" onWheel={absorbNestedWheel}>
                        <FlameText text={item.subtitle} />
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            )
          }

          if (item.type === 'outro') {
            const html = lang === 'en' ? (item.html_en || item.html_fr) : (item.html_fr || item.html_en)
            return (
              <div key={`outro-${idx}`} className="w-depth-item" style={{
                opacity,
                transform: `translate3d(0, 0, ${translateZ * 1.2}px) scale(${scale * 0.85})`,
                zIndex, pointerEvents: Math.abs(dist) < TEXT_BAND ? 'auto' : 'none',
              }}>
                <div className="w-outro-card">
                  <div className="w-outro-rule" />
                  <div className="w-outro-scroll-body" onWheel={absorbNestedWheel}>
                    <div className="w-outro-text" dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                </div>
              </div>
            )
          }

          if (item.type !== 'work') return null

          const work = item.data
          const isLead = item.leadInCollection
          let slideTranslateX = 0, slideRotateY = 0
          if (isLead && dist < 0) {
            const p     = Math.max(0, Math.min(1, (dist + BIRTH_DIST) / BIRTH_DIST))
            const eased = Math.pow(p, 0.5)
            slideTranslateX = (1 - eased) * 160
            slideRotateY    = (1 - eased) * 42
          }

          let paintScale = scale
          if (isLead && dist < 0) {
            const p = Math.max(0, Math.min(1, (dist + BIRTH_DIST) / BIRTH_DIST))
            paintScale = LEAD_MICRO + (1 - LEAD_MICRO) * Math.pow(p, 0.42)
          }

          /** Lead: extra negative Z at birth so it reads deeper in the stack */
          let translateZPaint = translateZ
          if (isLead && dist < 0) {
            const birthP = Math.max(0, Math.min(1, (dist + BIRTH_DIST) / BIRTH_DIST))
            translateZPaint = translateZ - LEAD_Z_PUSH * (1 - birthP)
          }

          const approachWindow = STEP * 2
          const shapeProgress  = dist < 0 ? Math.max(0, Math.min(1, (dist + approachWindow) / approachWindow)) : 1
          /** Lead rectangles: stay pill-round longer; others keep slide window curve */
          let cornerRadius: number
          if (work.isRound) {
            cornerRadius = 50
          } else if (isLead && dist < 0) {
            const birthP = Math.max(0, Math.min(1, (dist + BIRTH_DIST) / BIRTH_DIST))
            const roundHold = Math.pow(1 - birthP, 0.48)
            cornerRadius = Math.round(roundHold * 50)
          } else {
            cornerRadius = Math.round((1 - shapeProgress) * 50)
          }

          const shadowIntensity = Math.max(0, 1 - Math.abs(dist) / (STEP * 1.5))
          const shadowBlur      = Math.round(shadowIntensity * 80)
          const shadowAlpha     = (shadowIntensity * 0.45).toFixed(2)
          const paintingFilter  = shadowIntensity > 0.05
            ? `drop-shadow(-${Math.round(shadowIntensity * 28)}px ${Math.round(shadowIntensity * 36)}px ${shadowBlur}px rgba(20,16,10,${shadowAlpha})) drop-shadow(-${Math.round(shadowIntensity * 8)}px ${Math.round(shadowIntensity * 12)}px ${Math.round(shadowIntensity * 22)}px rgba(20,16,10,${(shadowIntensity * 0.25).toFixed(2)}))`
            : 'none'

          const imgSrc = imageUrl(work.txtImageNameLink) ?? undefined
          const itemTransform = isLead
            ? `translate3d(${slideTranslateX}vw, 0, ${translateZPaint}px) rotateY(${slideRotateY}deg) scale(${paintScale})`
            : `translate3d(0, 0, ${translateZ}px) scale(${paintScale})`

          return (
            <div key={`work-${idx}-${work.OeuvreID}`} className="w-depth-item" style={{ opacity, transform: itemTransform, zIndex }}>
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
                      style={{ 
                        '--burns-zoom': burnSnapshot.get(idx) ?? 1,
                        objectFit: 'contain'
                      } as React.CSSProperties}
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

      <div className="w-bottom-stack">
        {worksUxMode === 'chapters' && collectionSections.length >= 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span className="w-section-nav-label">{t('pub_works_collections')}</span>
            <div className="w-section-pills" aria-label={lang === 'en' ? 'Switch chapter' : 'Changer de séquence'}>
              {collectionSections.map((s) => (
                <button
                  key={`pill-${s.chapterIdx}`}
                  type="button"
                  className={`w-section-pill${s.chapterIdx === activeChapterIdx ? ' active' : ''}`}
                  title={lang === 'en' ? `Open: ${s.title}` : `Ouvrir : ${s.title}`}
                  onClick={() => {
                    setActiveChapterIdx(s.chapterIdx)
                    targetDepth.current = 0
                    currentDepth.current = 0
                    setDisplayDepth(0)
                    setEndOpacity(0)
                    setActiveWork(null)
                    setCaptionOpacity(0)
                  }}
                >
                  {s.title || '—'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="w-scroll-hint" style={{ opacity: displayDepth < 200 ? undefined : 0, pointerEvents: 'none' }}>
          ↓ scroll
        </div>
      </div>
    </div>
  )
}
