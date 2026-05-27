'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
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

/** Greedy bin-pack: lay tiles in rows, each row centered on a shared eyeline.
 *
 *  Tile area is derived from recorded cm dimensions (compressed area, same as
 *  the carousel). The tile's ASPECT is taken from the image's natural pixel
 *  size when known so the bevel hugs the artwork — otherwise it falls back to
 *  the cm aspect. Same fix as the carousel ate after the user spotted the
 *  bevel artifact in v1. */
function packSalon(
  works: Work[],
  wallWidth: number,
  isMobile: boolean,
  natural: Map<number, NaturalSize>,
): Tile[] {
  const ROW_GAP = isMobile ? 18 : 28
  const TILE_GAP = isMobile ? 10 : 18
  const ROW_HEIGHT_MIN = isMobile ? 80 : 110
  const ROW_HEIGHT_MAX = isMobile ? 200 : 280
  const REF_CM = isMobile ? 50 : 70
  const REF_PX = isMobile ? 160 : 260

  // Convert each work into a (w,h) tile in px. Reference: REF_CM cm = REF_PX px height.
  const pxPerCm = REF_PX / REF_CM
  const tiles: Array<{ work: Work; w: number; h: number }> = works
    .filter(w => w.txtImageNameLink)
    .map(w => {
      const cmH = Number(w.Hauteur) || 0
      const cmW = Number(w.Largeur) || 0
      const linearH = cmH > 0 ? cmH * pxPerCm : REF_PX * 0.7
      const linearW = cmW > 0 ? cmW * pxPerCm : REF_PX * 0.7
      // Compress area like the carousel does so small works stay visible.
      const linearArea = linearH * linearW
      const refArea = REF_PX * REF_PX
      const unit = linearArea / refArea
      const compressed = Math.pow(Math.max(unit, 1e-6), isMobile ? 0.55 : 0.62)
      const targetArea = refArea * compressed
      // Prefer image-natural aspect (so bevel hugs the painting) — fall back
      // to cm aspect if the image hasn't loaded its natural size yet.
      const nat = natural.get(w.OeuvreID)
      const aspect = nat && nat.w > 0 && nat.h > 0 ? nat.w / nat.h : linearW / linearH
      const h = Math.max(ROW_HEIGHT_MIN, Math.min(ROW_HEIGHT_MAX, Math.sqrt(targetArea / aspect)))
      const wPx = h * aspect
      return { work: w, w: wPx, h }
    })

  // Greedy row packer
  const rows: Array<{ tiles: typeof tiles; height: number; width: number }> = []
  let currentRow: typeof tiles = []
  let currentWidth = 0
  let currentMaxH = 0
  for (const tile of tiles) {
    const projected = currentWidth + (currentRow.length > 0 ? TILE_GAP : 0) + tile.w
    if (projected > wallWidth && currentRow.length > 0) {
      rows.push({ tiles: currentRow, height: currentMaxH, width: currentWidth })
      currentRow = []
      currentWidth = 0
      currentMaxH = 0
    }
    currentRow.push(tile)
    currentWidth += (currentRow.length > 1 ? TILE_GAP : 0) + tile.w
    currentMaxH = Math.max(currentMaxH, tile.h)
  }
  if (currentRow.length > 0) {
    rows.push({ tiles: currentRow, height: currentMaxH, width: currentWidth })
  }

  // Lay out rows vertically; center each row on the wall; center each tile vertically on row eyeline.
  const out: Tile[] = []
  let y = 0
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
  // Wall width tracks the viewport so tiles never overflow horizontally.
  // Defaults to 1200 for SSR; once mounted we use min(viewport - sidePad, 1200).
  const [wallW, setWallW] = useState(1200)
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
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth
      const mobile = vw < 768
      const sidePad = mobile ? 32 : 96
      setWallW(Math.max(280, Math.min(1200, vw - sidePad)))
      setIsMobile(mobile)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])
  const tiles = useMemo(() => packSalon(works, wallW, isMobile, natural), [works, wallW, isMobile, natural])
  const wallHeight = useMemo(() => Math.max(...tiles.map(t => t.y + t.h), 600) + 60, [tiles])

  return (
    <>
      <style>{`
        .w-salon-wrap {
          position: relative;
          min-height: 100vh;
          background: ${siteTheme.backgroundCss};
          padding: clamp(80px, 10vh, 120px) clamp(16px, 4vw, 48px) 80px;
        }
        .w-salon-wrap::after {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background: ${light.tintRgba}; pointer-events: none;
        }
        .w-salon-wall {
          position: relative; z-index: 1;
          margin: 0 auto;
          width: ${wallW}px;
          max-width: 100%;
        }
        .w-salon-tile {
          position: absolute;
          cursor: zoom-in;
          background: transparent; border: none; padding: 0;
          line-height: 0;
        }
        .w-salon-tile img {
          width: 100%; height: 100%;
          object-fit: contain; display: block;
        }
        .w-salon-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; cursor: zoom-out;
        }
        .w-salon-lb img { max-width: 96vw; max-height: 92vh; object-fit: contain; display: block; }
      `}</style>
      <main className="w-salon-wrap" aria-label={t('pub_works')}>
        <div className="w-salon-wall" style={{ height: wallHeight }}>
          {tiles.map(({ work, w, h, x, y }) => (
            <button
              key={work.OeuvreID}
              type="button"
              className="w-salon-tile"
              style={{ left: x, top: y, width: w, height: h }}
              onClick={() => setLightbox(work)}
              aria-label={work.Titre ?? t('pub_untitled')}
            >
              <img
                src={thumbUrl(work.txtImageNameLink) ?? imageUrl(work.txtImageNameLink) ?? ''}
                alt={work.Titre ?? ''}
                draggable={false}
                loading="lazy"
                onLoad={(e) => {
                  const t = e.currentTarget
                  if (t.naturalWidth > 0) recordNatural(work.OeuvreID, t.naturalWidth, t.naturalHeight)
                }}
              />
            </button>
          ))}
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
