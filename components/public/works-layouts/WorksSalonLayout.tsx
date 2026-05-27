'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
import PublicNav from '@/components/public/PublicNav'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import { publicSiteBaseCss } from '@/lib/public-site-theme'
import type { Work } from '@/components/public/works-utils'

interface Props {
  works: Work[]
  siteTheme: PublicSiteTheme
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

type Tile = {
  work: Work
  w: number
  h: number
  x: number
  y: number
}

/** Greedy bin-pack: lay tiles in rows, each row centered on a shared eyeline.
 *  Works are sized from recorded cm dimensions with the same compressed-area
 *  scaling used by the carousel; missing dimensions fall back to a default. */
function packSalon(works: Work[], wallWidth: number): Tile[] {
  const ROW_GAP = 28
  const TILE_GAP = 18
  const ROW_HEIGHT_MIN = 110
  const ROW_HEIGHT_MAX = 280

  // Convert each work into a (w,h) tile in px. Reference: 70 cm = 260 px height.
  const pxPerCm = 260 / 70
  const tiles: Array<{ work: Work; w: number; h: number }> = works
    .filter(w => w.txtImageNameLink)
    .map(w => {
      const cmH = Number(w.Hauteur) || 0
      const cmW = Number(w.Largeur) || 0
      const linearH = cmH > 0 ? cmH * pxPerCm : 200
      const linearW = cmW > 0 ? cmW * pxPerCm : 200
      // Compress area like the carousel does so small works stay visible.
      const linearArea = linearH * linearW
      const refArea = 260 * 260
      const unit = linearArea / refArea
      const compressed = Math.pow(Math.max(unit, 1e-6), 0.62)
      const targetArea = refArea * compressed
      const aspect = linearW / linearH
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

export default function WorksSalonLayout({ works, siteTheme, hiddenNavRoutes, navOrder }: Props) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)
  // Wall width — chosen to keep tile px sizes sensible across viewports.
  const WALL_W = 1200
  const tiles = useMemo(() => packSalon(works, WALL_W), [works])
  const wallHeight = useMemo(() => Math.max(...tiles.map(t => t.y + t.h), 600) + 60, [tiles])

  return (
    <>
      <style>{publicSiteBaseCss(siteTheme)}</style>
      <style>{`
        .w-salon-wrap {
          min-height: 100vh;
          background: ${siteTheme.backgroundCss};
          padding: clamp(80px, 10vh, 120px) clamp(16px, 4vw, 48px) 80px;
          overflow-x: auto;
        }
        .w-salon-wall {
          position: relative;
          margin: 0 auto;
          width: ${WALL_W}px;
        }
        .w-salon-tile {
          position: absolute;
          cursor: zoom-in;
          background: transparent; border: none; padding: 0;
        }
        .w-salon-tile img {
          width: 100%; height: 100%;
          object-fit: contain; display: block;
          filter: drop-shadow(-6px 12px 18px rgba(0,0,0,0.28))
                  drop-shadow(0 4px 8px rgba(15,15,20,0.18));
        }
        .w-salon-lb {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(8,8,10,0.92);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; cursor: zoom-out;
        }
        .w-salon-lb img { max-width: 96vw; max-height: 92vh; object-fit: contain; display: block; }
      `}</style>
      <PublicNav active="works" prefix="w" hiddenNavRoutes={hiddenNavRoutes} navOrder={navOrder} />
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
              />
            </button>
          ))}
        </div>
      </main>
      {lightbox && (
        <div className="w-salon-lb" role="dialog" aria-label={lightbox.Titre ?? ''} onClick={() => setLightbox(null)}>
          <img src={imageUrl(lightbox.txtImageNameLink) ?? ''} alt={lightbox.Titre ?? ''} />
        </div>
      )}
    </>
  )
}
