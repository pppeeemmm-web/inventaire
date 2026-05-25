'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { imageUrl, thumbUrl } from '@/lib/data'
import {
  NW, NH, NR, RING,
  cacheConstellationThumb, thumbTier,
} from './constellation-shared'
import {
  drawConstellationFrame,
  type ConstellationDrawFrameRefs,
  type ConstellationDrawFrameState,
} from './constellation-draw-frame'

export type UseConstellationCanvasRedrawParams =
  ConstellationDrawFrameRefs &
  ConstellationDrawFrameState & {
    canvasRef: RefObject<HTMLCanvasElement | null>
    wrapRef:   RefObject<HTMLDivElement | null>
  }

/** Canvas redraw tick + draw effect + visible thumbnail loading. */
export function useConstellationCanvasRedraw(params: UseConstellationCanvasRedrawParams): () => void {
  const { canvasRef, wrapRef, vpRef, posRef, oeuvresById, imagesRef, ...drawState } = params

  const [tick, setTick] = useState(0)
  const redraw = useCallback(() => setTick(t => t + 1), [])
  const loadingSet = useRef(new Set<string>())

  const loadVisible = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const vp   = vpRef.current
    const tier = thumbTier(vp.z)
    const m    = (NR + RING) * 2
    const x0   = (-vp.x - m) / vp.z, x1 = (c.offsetWidth  - vp.x + m) / vp.z
    const y0   = (-vp.y - m) / vp.z, y1 = (c.offsetHeight - vp.y + m) / vp.z

    let requestsStarted = 0
    const MAX_BATCH = 20

    for (const [id, p] of posRef.current) {
      if (requestsStarted >= MAX_BATCH) break

      const ncx = p.x + NW / 2, ncy = p.y + NH / 2
      if (ncx + NR < x0 || ncx - NR > x1 || ncy + NR < y0 || ncy - NR > y1) continue

      const o = oeuvresById.get(id)
      if (!o?.txtImageNameLink) continue

      const key = `${id}_${tier}`
      if (!imagesRef.current.has(key) && !loadingSet.current.has(key)) {
        requestsStarted++
        loadingSet.current.add(key)

        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
          loadingSet.current.delete(key)
          cacheConstellationThumb(imagesRef.current, key, img, id)
          redraw()
        }

        img.onerror = () => {
          loadingSet.current.delete(key)
          const fullUrl = imageUrl(o.txtImageNameLink!)
          if (fullUrl && img.src !== fullUrl) {
            const fallbackImg = new Image()
            fallbackImg.crossOrigin = 'anonymous'
            fallbackImg.onload = () => {
              cacheConstellationThumb(imagesRef.current, key, fallbackImg, id)
              redraw()
            }
            fallbackImg.src = fullUrl
          }
        }

        img.src = thumbUrl(o.txtImageNameLink!, tier) ?? ''
      }
    }
  }, [canvasRef, vpRef, posRef, oeuvresById, imagesRef, redraw])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    drawConstellationFrame(
      { vpRef, posRef, imagesRef, oeuvresById, ...drawState },
      ctx,
      canvas,
      wrap,
    )

    loadVisible()
  }, [
    tick,
    canvasRef,
    wrapRef,
    vpRef,
    posRef,
    imagesRef,
    loadVisible,
    drawState.groupBy,
    drawState.linkType,
    drawState.oeuvres,
    drawState.themes,
    drawState.groups,
    drawState.effectiveThemeWork,
    drawState.effectiveGroupWork,
    oeuvresById,
    drawState.selectedThemeId,
    drawState.selectedGroupId,
    drawState.shapes,
    drawState.activeShape,
    drawState.marquee,
    drawState.frozenEdges,
  ])

  return redraw
}
