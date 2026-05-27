'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl } from '@/lib/data'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import type { Work, WorksMode } from '@/components/public/works-utils'
import type { WorksLightResolved } from '@/lib/works-mode-light'
import OutroCard from './OutroCard'

interface Props {
  works: Work[]
  mode: WorksMode
  bevelShadow: string | null
  light: WorksLightResolved
  siteTheme: PublicSiteTheme
}

type Tile = {
  work: Work
  w: number
  h: number
  x: number
  y: number
}

type NaturalSize = { w: number; h: number }
type RelTile = { work: Work; w: number; h: number }

/** Viewport-fit salon: the active collection always fits the wall area
 *  without scrolling, regardless of how many works it contains.
 *
 *  Approach:
 *  1. Compute each work's "relative" size from cm dimensions with the same
 *     area-compression as the carousel (small works stay visible). Aspect
 *     comes from the image's natural pixel size when known.
 *  2. Binary-search a uniform scale so the greedy row-pack fits inside
 *     (wallWidth × wallHeight × density). density ≈ 0.55 leaves whitespace.
 *  3. Lay out tiles at the chosen scale, row by row, each row centered on
 *     a shared eyeline.
 *
 *  Mobile (< 768px) shrinks REF + gaps; the same algorithm applies. Phase 4
 *  will swap salon for a grid fallback on mobile entirely. */
function buildRelativeTiles(
  works: Work[],
  isMobile: boolean,
  natural: Map<number, NaturalSize>,
): RelTile[] {
  // Unit-less sizes — the scale step turns these into pixels.
  return works
    .filter(w => w.txtImageNameLink)
    .map(w => {
      const cmH = Number(w.Hauteur) || 0
      const cmW = Number(w.Largeur) || 0
      const linearH = cmH > 0 ? cmH : 60
      const linearW = cmW > 0 ? cmW : 60
      const linearArea = linearH * linearW
      // Same compression as the carousel: small works keep some visual weight.
      const compressed = Math.pow(Math.max(linearArea, 1), isMobile ? 0.55 : 0.62)
      const nat = natural.get(w.OeuvreID)
      // Prefer image-pixel aspect (bevel hugs the painting) — fall back to cm aspect.
      const aspect = nat && nat.w > 0 && nat.h > 0 ? nat.w / nat.h : linearW / linearH
      const h = Math.sqrt(compressed / aspect)
      const wPx = h * aspect
      return { work: w, w: wPx, h }
    })
}

type PackResult = { rows: Array<{ tiles: RelTile[]; height: number; width: number }>; totalH: number }

function packAtScale(
  rel: RelTile[],
  scale: number,
  wallWidth: number,
  tileGap: number,
  rowGap: number,
): PackResult {
  const rows: PackResult['rows'] = []
  let cur: RelTile[] = []
  let curW = 0
  let curMaxH = 0
  for (const t of rel) {
    const sw = t.w * scale
    const sh = t.h * scale
    const proj = curW + (cur.length > 0 ? tileGap : 0) + sw
    if (proj > wallWidth && cur.length > 0) {
      rows.push({ tiles: cur, height: curMaxH, width: curW })
      cur = []
      curW = 0
      curMaxH = 0
    }
    cur.push({ work: t.work, w: sw, h: sh })
    curW += (cur.length > 1 ? tileGap : 0) + sw
    curMaxH = Math.max(curMaxH, sh)
  }
  if (cur.length > 0) rows.push({ tiles: cur, height: curMaxH, width: curW })
  const totalH = rows.reduce((s, r) => s + r.height, 0) + Math.max(0, rows.length - 1) * rowGap
  return { rows, totalH }
}

function packSalon(
  works: Work[],
  wallWidth: number,
  wallHeight: number,
  isMobile: boolean,
  natural: Map<number, NaturalSize>,
): Tile[] {
  const TILE_GAP = isMobile ? 10 : 18
  const ROW_GAP = isMobile ? 18 : 28
  const DENSITY = 0.55

  const rel = buildRelativeTiles(works, isMobile, natural)
  if (rel.length === 0) return []

  // Initial scale guess from area ratio. Refined by binary search next.
  const totalRelArea = rel.reduce((s, t) => s + t.w * t.h, 0)
  const availArea = wallWidth * wallHeight * DENSITY
  const seed = Math.sqrt(availArea / Math.max(totalRelArea, 1))

  // Binary-search the largest scale that fits both bounds.
  let lo = 0.01
  let hi = Math.max(seed * 2, 1)
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    const { totalH, rows } = packAtScale(rel, mid, wallWidth, TILE_GAP, ROW_GAP)
    const fitsH = totalH <= wallHeight
    const fitsW = rows.every(r => r.width <= wallWidth)
    if (fitsH && fitsW) lo = mid
    else hi = mid
  }
  const scale = lo
  const { rows } = packAtScale(rel, scale, wallWidth, TILE_GAP, ROW_GAP)

  // Center the wall content vertically inside the available height.
  const totalContentH = rows.reduce((s, r) => s + r.height, 0)
    + Math.max(0, rows.length - 1) * ROW_GAP
  const yStart = Math.max(0, (wallHeight - totalContentH) / 2)

  const out: Tile[] = []
  let y = yStart
  for (const row of rows) {
    const xStart = (wallWidth - row.width) / 2
    const eyeline = y + row.height / 2
    let x = xStart
    for (const tile of row.tiles) {
      out.push({
        work: tile.work,
        w: tile.w,
        h: tile.h,
        x,
        y: eyeline - tile.h / 2,
      })
      x += tile.w + TILE_GAP
    }
    y += row.height + ROW_GAP
  }
  return out
}

export default function WorksSalonLayout({ works, mode, bevelShadow, light, siteTheme }: Props) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)
  const [wallW, setWallW] = useState(1200)
  const [wallH, setWallH] = useState(700)
  const [isMobile, setIsMobile] = useState(false)
  const [natural, setNatural] = useState<Map<number, NaturalSize>>(new Map())

  const recordNatural = useCallback((id: number, w: number, h: number) => {
    setNatural(prev => {
      const cur = prev.get(id)
      if (cur && cur.w === w && cur.h === h) return prev
      const next = new Map(prev)
      next.set(id, { w, h })
      return next
    })
  }, [])

  // Track viewport so the wall fits without scrolling.
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const mobile = vw < 768
      const sidePad = mobile ? 32 : 96
      const topPad = mobile ? 80 : 110
      const botPad = mobile ? 60 : 80
      setWallW(Math.max(280, Math.min(1440, vw - sidePad)))
      setWallH(Math.max(360, vh - topPad - botPad))
      setIsMobile(mobile)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  const tiles = useMemo(
    () => packSalon(works, wallW, wallH, isMobile, natural),
    [works, wallW, wallH, isMobile, natural],
  )
  const visibleCount = tiles.length
  const intensity = light.intensity
  const castShadowOn = mode.cast_shadow_enabled !== false
  const castDistance = mode.cast_shadow_distance_px ?? 15
  const castBlur = mode.cast_shadow_blur_px ?? 22
  const castShadowCss = castShadowOn
    ? `drop-shadow(0 ${castDistance}px ${castBlur}px rgba(15,15,20,${(0.34 * intensity).toFixed(3)})) `
      + `drop-shadow(0 ${Math.round(castDistance / 3.75)}px ${Math.round(castBlur / 3.14)}px rgba(15,15,20,${(0.22 * intensity).toFixed(3)}))`
    : 'none'

  return (
    <>
      <style>{`
        .w-salon-shell {
          position: relative;
          min-height: 100vh;
          background: ${siteTheme.backgroundCss};
        }
        .w-salon-shell::after {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background: ${light.tintRgba}; pointer-events: none;
        }
        .w-salon-frame {
          position: relative; z-index: 1;
          height: 100vh;
          padding: clamp(80px, 11vh, 110px) clamp(16px, 4vw, 48px) clamp(60px, 9vh, 80px);
          display: flex; flex-direction: column; align-items: center;
        }
        .w-salon-marker {
          position: absolute; top: clamp(16px, 3vh, 28px); right: clamp(20px, 4vw, 40px);
          font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText}; opacity: 0.75;
          font-family: 'JetBrains Mono', monospace;
          z-index: 2;
        }
        .w-salon-wall {
          position: relative;
          width: ${wallW}px; height: ${wallH}px;
          max-width: 100%;
        }
        /* Tile is just a positioned reservation cell — no styling on its
         * rect. Mount sizes itself to the image's natural aspect-ratio
         * (set inline from naturalWidth/Height when it loads) so the bevel
         * + cast shadow always hug the painting, never the cm-derived
         * tile bbox. Until natural is recorded, the mount is unstyled
         * (no bevel) to avoid wrapping a letterbox during the brief
         * cm-fallback → natural-aspect transition. */
        .w-salon-tile {
          position: absolute;
          cursor: zoom-in;
          background: transparent; border: none; padding: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .w-salon-mount {
          display: block; line-height: 0;
          max-width: 100%; max-height: 100%;
          position: relative;
        }
        .w-salon-mount[data-ready="1"] {
          filter: ${castShadowCss};
        }
        ${bevelShadow ? `
        .w-salon-mount[data-ready="1"]::after {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none;
          box-shadow: ${bevelShadow};
        }
        ` : ''}
        .w-salon-mount img {
          width: 100%; height: 100%;
          display: block;
        }
        .w-salon-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; cursor: zoom-out;
        }
        .w-salon-lb img { max-width: 96vw; max-height: 92vh; object-fit: contain; display: block; }
        @media (max-width: 768px) {
          .w-salon-frame { height: auto; min-height: 100vh; }
        }
      `}</style>
      <main className="w-salon-shell" aria-label={t('pub_works')}>
        <div className="w-salon-frame">
          <div className="w-salon-marker" aria-hidden>
            {visibleCount} {t('pub_salon_count_works')} · {t('pub_salon_hang_label')}
          </div>
          <div className="w-salon-wall" style={{ width: wallW, height: wallH }}>
            {tiles.map(({ work, w, h, x, y }) => {
              const nat = natural.get(work.OeuvreID)
              const ready = !!(nat && nat.w > 0 && nat.h > 0)
              return (
                <button
                  key={work.OeuvreID}
                  type="button"
                  className="w-salon-tile"
                  style={{ left: x, top: y, width: w, height: h }}
                  onClick={() => setLightbox(work)}
                  aria-label={work.Titre ?? t('pub_untitled')}
                >
                  <span
                    className="w-salon-mount"
                    data-ready={ready ? '1' : '0'}
                    style={ready ? { aspectRatio: `${nat!.w} / ${nat!.h}` } : undefined}
                  >
                    <img
                      src={thumbUrl(work.txtImageNameLink) ?? imageUrl(work.txtImageNameLink) ?? ''}
                      alt={work.Titre ?? ''}
                      draggable={false}
                      loading="lazy"
                      // Callback ref also fires for cached/already-loaded images
                      // where onLoad would never fire (React mounts after browser
                      // has the bitmap), so naturals are always recorded.
                      ref={(node) => {
                        if (node && node.complete && node.naturalWidth > 0) {
                          recordNatural(work.OeuvreID, node.naturalWidth, node.naturalHeight)
                        }
                      }}
                      onLoad={(e) => {
                        const img = e.currentTarget
                        if (img.naturalWidth > 0) recordNatural(work.OeuvreID, img.naturalWidth, img.naturalHeight)
                      }}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </main>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <OutroCard mode={mode} />
      </div>
      {lightbox && (
        <div className="w-salon-lb" role="dialog" aria-label={lightbox.Titre ?? ''} onClick={() => setLightbox(null)}>
          <img src={imageUrl(lightbox.txtImageNameLink) ?? ''} alt={lightbox.Titre ?? ''} />
        </div>
      )}
    </>
  )
}
