import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import type { DictKey } from '@/lib/i18n/dictionary'
import { thumbUrl } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'
import {
  NW, NH, NR,
  cacheConstellationThumb, drawContain,
  type NodeMap, type Edge, type Shape,
  LINK_VIS, LINK_DEF,
} from './constellation-shared'

export type ConstellationExportDeps = {
  posRef:      MutableRefObject<NodeMap>
  edgesRef:    MutableRefObject<Edge[]>
  frozenEdges: Edge[] | null
  shapes:      Shape[]
  oeuvresById: Map<number, Oeuvre>
  imagesRef:   MutableRefObject<Map<string, HTMLImageElement>>
  t:           (key: DictKey) => string
  setSaving:   Dispatch<SetStateAction<boolean>>
}

function waitImg(
  deps: Pick<ConstellationExportDeps, 'imagesRef' | 'oeuvresById'>,
  id: number,
  tier: number,
): Promise<HTMLImageElement | null> {
  const { imagesRef, oeuvresById } = deps
  const key = `${id}_${tier}`
  const existing = imagesRef.current.get(key)
  if (existing?.complete && existing.naturalWidth > 0) return Promise.resolve(existing)

  const o = oeuvresById.get(id)
  if (!o?.txtImageNameLink) return Promise.resolve(null)

  return new Promise((res) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => {
      cacheConstellationThumb(imagesRef.current, key, img, id)
      res(img)
    }
    img.onerror = () => res(null)
    img.src     = thumbUrl(o.txtImageNameLink, tier) ?? ''
  })
}

async function buildExportCanvas(deps: ConstellationExportDeps): Promise<HTMLCanvasElement | null> {
  const { posRef, edgesRef, frozenEdges, shapes, oeuvresById, imagesRef } = deps
  if (posRef.current.size === 0) return null

  await Promise.all(Array.from(posRef.current.keys()).map(id => waitImg(deps, id, 100)))

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  posRef.current.forEach(({ x, y }) => {
    if (x         < minX) minX = x
    if (y         < minY) minY = y
    if (x + NW   > maxX) maxX = x + NW
    if (y + NH   > maxY) maxY = y + NH
  })
  const PAD   = 60
  const W     = Math.ceil(maxX - minX + PAD * 2)
  const H     = Math.ceil(maxY - minY + PAD * 2)
  const SCALE = 2
  const off   = document.createElement('canvas')
  off.width   = W * SCALE
  off.height  = H * SCALE
  const ctx   = off.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(PAD - minX, PAD - minY)

  const edgesExport = frozenEdges ?? edgesRef.current
  edgesExport.forEach(e => {
    const a = posRef.current.get(e.source), b = posRef.current.get(e.target)
    if (!a || !b) return
    const vis = LINK_VIS[e.relation_type ?? ''] ?? LINK_DEF
    ctx.beginPath()
    ctx.moveTo(a.x + NW / 2, a.y + NH / 2)
    ctx.lineTo(b.x + NW / 2, b.y + NH / 2)
    ctx.strokeStyle = vis.color
    ctx.lineWidth   = vis.w
    ctx.setLineDash(vis.dash)
    ctx.globalAlpha = 0.5
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  })

  posRef.current.forEach((pt, id) => {
    const o  = oeuvresById.get(id)
    const cx = pt.x + NW / 2
    const cy = pt.y + NH / 2
    ctx.beginPath()
    ctx.arc(cx, cy, NR, 0, Math.PI * 2)
    ctx.fillStyle   = '#1a1a1a'
    ctx.fill()
    const tier = 100
    const img  = imagesRef.current.get(`${id}_${tier}`)
             ?? imagesRef.current.get(`${id}_200`)
             ?? imagesRef.current.get(`${id}_40`)
    if (img?.complete && img.naturalWidth > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, NR - 1, 0, Math.PI * 2)
      ctx.clip()
      drawContain(ctx, img, cx, cy, NR - 1)
      ctx.restore()
    }
    ctx.beginPath()
    ctx.arc(cx, cy, NR - 0.5, 0, Math.PI * 2)
    ctx.strokeStyle = '#3a3a3a'
    ctx.lineWidth   = 1
    ctx.stroke()
    if (o?.Titre) {
      ctx.fillStyle   = '#777'
      ctx.font        = '8px monospace'
      ctx.textAlign   = 'center'
      const short = o.Titre.length > 18 ? o.Titre.slice(0, 16) + '…' : o.Titre
      ctx.fillText(short, cx, cy + NR + 12)
    }
  })

  for (const s of shapes) {
    ctx.strokeStyle = s.color
    ctx.fillStyle   = s.color
    if (s.type === 'line') {
      if (s.points.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      ctx.lineWidth = s.width
      ctx.lineCap   = 'round'; ctx.lineJoin = 'round'
      ctx.stroke()
    } else {
      ctx.font = `${s.size}px "Instrument Serif", serif`
      ctx.fillText(s.text, s.x, s.y)
    }
  }

  ctx.restore()
  return off
}

/** Export full canvas as PNG download. */
export async function handleExportPng(deps: ConstellationExportDeps): Promise<void> {
  const { setSaving } = deps
  if (deps.posRef.current.size === 0) return
  setSaving(true)

  const off = await buildExportCanvas(deps)
  if (!off) {
    setSaving(false)
    return
  }

  const a = document.createElement('a')
  a.href     = off.toDataURL('image/png')
  a.download = `constellation-${new Date().toISOString().slice(0, 10)}.png`
  a.click()
  setSaving(false)
}

/** Export tiled A4 print window. */
export async function handleExportTiledA4(deps: ConstellationExportDeps): Promise<void> {
  const { t, setSaving } = deps
  if (deps.posRef.current.size === 0) return
  setSaving(true)

  const off = await buildExportCanvas(deps)
  if (!off) {
    setSaving(false)
    return
  }

  const A4W = 1754, A4H = 1240
  const tilesX = Math.ceil(off.width  / A4W)
  const tilesY = Math.ceil(off.height / A4H)

  const dataUrls: string[] = []
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const tile = document.createElement('canvas')
      tile.width  = A4W; tile.height = A4H
      const tc    = tile.getContext('2d')!
      tc.fillStyle = '#0d0d0d'; tc.fillRect(0, 0, A4W, A4H)
      tc.drawImage(off, tx * A4W, ty * A4H, A4W, A4H, 0, 0, A4W, A4H)
      dataUrls.push(tile.toDataURL('image/png'))
    }
  }

  const win = window.open('', '_blank')
  if (!win) { alert(t('const_popupBlockedA4')); return }
  const date = new Date().toISOString().slice(0, 10)
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${t('constellation')} ${date}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #000; }
      .page { width: 297mm; height: 210mm; overflow: hidden; page-break-after: always; position: relative; }
      .page img { width: 100%; height: 100%; object-fit: contain; display: block; }
      .lbl { position: absolute; bottom: 4mm; right: 6mm; color: rgba(255,255,255,0.3);
             font: 7pt monospace; }
      @page { size: A4 landscape; margin: 0; }
      @media print { body { background: #000; } .page { page-break-after: always; } }
    </style>
  </head><body>
    ${dataUrls.map((url, i) => `
      <div class="page">
        <img src="${url}" alt="${t('const_printPageAlt')} ${i + 1}">
        <span class="lbl">${i + 1} / ${dataUrls.length} · ${date}</span>
      </div>`).join('')}
    <script>window.onload = () => setTimeout(() => window.print(), 400)<\/script>
  </body></html>`)
  win.document.close()
  setSaving(false)
}
