import type { MutableRefObject } from 'react'
import type { Oeuvre } from '@/lib/types/database'
import {
  NW, NH, NR, RING,
  drawContain, thumbTier,
  type Pt, type NodeMap, type GroupBy, type LinkType, type VP, type Edge, type Shape,
  LINK_VIS, LINK_DEF,
} from './constellation-shared'

export type ConstellationDrawFrameRefs = {
  vpRef:       MutableRefObject<VP>
  posRef:      MutableRefObject<NodeMap>
  selRef:      MutableRefObject<Set<number>>
  hovNodeRef:  MutableRefObject<number | null>
  hovEdgeRef:  MutableRefObject<Edge | null>
  draftRef:    MutableRefObject<{ from: number; toX: number; toY: number } | null>
  edgesRef:    MutableRefObject<Edge[]>
  imagesRef:   MutableRefObject<Map<string, HTMLImageElement>>
  bgImgRef:    MutableRefObject<HTMLImageElement | null>
}

export type ConstellationDrawFrameState = {
  bgLoaded:            boolean
  backgroundOpacity:   number
  groupBy:             GroupBy
  linkType:            LinkType
  oeuvres:             Oeuvre[]
  themes:              { id: number; name: string }[]
  groups:              { id: string; name: string }[]
  effectiveThemeWork:  Map<number, Set<number>>
  effectiveGroupWork:  Map<string, Set<number>>
  oeuvresById:         Map<number, Oeuvre>
  selectedThemeId:     number | null
  selectedGroupId:     string | null
  shapes:              Shape[]
  activeShape:         Shape | null
  marquee:             { x: number; y: number; w: number; h: number } | null
  frozenEdges:         Edge[] | null
}

export type ConstellationDrawFrameParams = ConstellationDrawFrameRefs & ConstellationDrawFrameState

/** Render one constellation canvas frame (viewport + screen-space marquee). */
export function drawConstellationFrame(
  params: ConstellationDrawFrameParams,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  wrap: HTMLDivElement,
): void {
  const {
    vpRef, posRef, selRef, hovNodeRef, hovEdgeRef, draftRef, edgesRef, imagesRef, bgImgRef,
    bgLoaded, backgroundOpacity, groupBy, linkType,
    oeuvres, themes, groups, effectiveThemeWork, effectiveGroupWork, oeuvresById,
    selectedThemeId, selectedGroupId, shapes, activeShape, marquee, frozenEdges,
  } = params

  const dpr = window.devicePixelRatio ?? 1
  const cw  = wrap.clientWidth
  const ch  = wrap.clientHeight
  if (canvas.width !== Math.round(cw * dpr)) canvas.width  = Math.round(cw * dpr)
  if (canvas.height !== Math.round(ch * dpr)) canvas.height = Math.round(ch * dpr)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.scale(dpr, dpr)

  const vp      = vpRef.current
  const pos     = posRef.current
  const sel     = selRef.current
  const hovNode = hovNodeRef.current
  const hovEdge = hovEdgeRef.current

  ctx.save() // Viewport transform start
  ctx.translate(vp.x, vp.y)
  ctx.scale(vp.z, vp.z)

  // ── Background Floorplan ────────────────────────────────────
  if (bgImgRef.current && bgLoaded) {
    ctx.save()
    ctx.globalAlpha = backgroundOpacity
    const img = bgImgRef.current
    const iw = img.naturalWidth, ih = img.naturalHeight
    // In exhibition mode, we align (0,0) with top-left of the floorplan.
    ctx.drawImage(img, 0, 0, iw, ih)
    ctx.restore()
  }

  // ── Year band backgrounds + labels ──────────────────────────
  if (groupBy === 'year') {
    const byY = new Map<string, Oeuvre[]>()
    for (const o of oeuvres) {
      const y = o.Année?.slice(0, 4) ?? '?'
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push(o)
    }
    for (const [yr, ws] of byY) {
      const pts = ws.map(o => pos.get(o.OeuvreID)).filter(Boolean) as Pt[]
      if (!pts.length) continue
      const minX = Math.min(...pts.map(p => p.x)) - 8
      const maxX = Math.max(...pts.map(p => p.x + NW)) + 8
      const minY = Math.min(...pts.map(p => p.y))
      ctx.fillStyle = 'rgba(255,255,255,0.016)'
      ctx.fillRect(minX, -20, maxX - minX, ch / vp.z + 40)
      ctx.fillStyle = 'rgba(200,168,110,0.55)'
      ctx.font = `${Math.max(7, 10 / vp.z)}px "Sofia Sans", sans-serif`
      ctx.fillText(yr, minX + 4, minY - 10)
    }
  }

  // ── Theme colors (one distinct hue per theme) ────────────────
  const themeColors = new Map<number, string>(
    (themes || []).map((th, i) => [th.id, `hsl(${Math.round((i / Math.max(1, (themes?.length || 1))) * 300 + 20)}, 55%, 62%)`])
  )
  const workPrimaryTheme = new Map<number, number>();
  (themes || []).forEach(th => {
    (effectiveThemeWork.get(th.id) ?? new Set()).forEach(id => {
      if (!workPrimaryTheme.has(id)) workPrimaryTheme.set(id, th.id)
    })
  })

  const groupColors = new Map<string, string>(
    (groups || []).map((g, i) => [g.id, `hsl(${Math.round((i / Math.max(1, (groups?.length || 1))) * 280 + 40)}, 50%, 58%)`]),
  )
  const workPrimaryGroup = new Map<number, string>()
  ;(groups || []).forEach(g => {
    (effectiveGroupWork.get(g.id) ?? new Set()).forEach(oid => {
      if (!workPrimaryGroup.has(oid)) workPrimaryGroup.set(oid, g.id)
    })
  })

  // ── Theme cluster labels (pill badges, colour-coded, size-scaled) ─
  if (groupBy === 'theme') {
    const maxCount = Math.max(1, ...themes.map(th =>
      [...(effectiveThemeWork.get(th.id) ?? [])].filter(id => pos.has(id)).length
    ))

    interface LBox {
      th:       { id: number; name: string }
      ax: number; ay: number
      x:  number; y:  number
      w:  number; h:  number
      fs: number
      color: string
      alpha: number
      count: number
    }
    const labels: LBox[] = []

    for (const th of themes) {
      const ids = [...(effectiveThemeWork.get(th.id) ?? [])].filter(id => pos.has(id))
      if (!ids.length) continue
      const pts   = ids.map(id => pos.get(id)!)
      const cx    = pts.reduce((a, p) => a + p.x + NW / 2, 0) / pts.length
      const minY  = Math.min(...pts.map(p => p.y))
      const count = ids.length

      const t   = Math.sqrt(count / maxCount)
      const fs  = (8 + 7 * t) / vp.z
      ctx.font  = `${fs}px "Sofia Sans", sans-serif`
      const tw  = ctx.measureText(th.name).width
      const padH = (5 + 3 * t) / vp.z
      const padV = (3 + 2 * t) / vp.z
      const w   = tw + padH * 2
      const h   = fs + padV * 2
      const ay  = minY - NR / vp.z - h - 6 / vp.z

      labels.push({
        th, count,
        ax: cx, ay,
        x: cx, y: ay,
        w, h, fs,
        color: themeColors.get(th.id) ?? 'rgba(166,163,151,0.8)',
        alpha: selectedThemeId === null || selectedThemeId === th.id ? 1 : 0.22,
      })
    }

    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j]
          const overlapX = (a.w + b.w) / 2 - Math.abs(a.x - b.x)
          const overlapY = (a.h + b.h) / 2 + 4 / vp.z - Math.abs(a.y - b.y)
          if (overlapX <= 0 || overlapY <= 0) continue
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 2 / vp.z
            if (a.x <= b.x) { a.x -= push; b.x += push }
            else             { a.x += push; b.x -= push }
          } else {
            const push = overlapY / 2 + 2 / vp.z
            if (a.count >= b.count) { b.y -= push } else { a.y -= push }
          }
        }
      }
    }

    ctx.textAlign = 'center'
    for (const lb of labels) {
      ctx.globalAlpha = lb.alpha
      const { x, y, w, h, fs, color } = lb

      const dx = x - lb.ax, dy = y - lb.ay
      if (Math.hypot(dx, dy) > 4 / vp.z) {
        ctx.beginPath()
        ctx.moveTo(lb.ax, lb.ay + h / 2)
        ctx.lineTo(x, y + h / 2)
        ctx.strokeStyle = color
        ctx.lineWidth   = 0.5 / vp.z
        ctx.globalAlpha = lb.alpha * 0.4
        ctx.setLineDash([3 / vp.z, 3 / vp.z])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = lb.alpha
      }

      const rx = x - w / 2, ry = y, rad = 3 / vp.z
      ctx.beginPath()
      ctx.moveTo(rx + rad, ry)
      ctx.lineTo(rx + w - rad, ry)
      ctx.arcTo(rx + w, ry, rx + w, ry + rad, rad)
      ctx.lineTo(rx + w, ry + h - rad)
      ctx.arcTo(rx + w, ry + h, rx + w - rad, ry + h, rad)
      ctx.lineTo(rx + rad, ry + h)
      ctx.arcTo(rx, ry + h, rx, ry + h - rad, rad)
      ctx.lineTo(rx, ry + rad)
      ctx.arcTo(rx, ry, rx + rad, ry, rad)
      ctx.closePath()
      ctx.fillStyle = 'rgba(13,13,13,0.82)'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth   = (0.8 + 0.7 * Math.sqrt(lb.count / maxCount)) / vp.z
      ctx.stroke()

      ctx.font      = `${fs}px "Sofia Sans", sans-serif`
      ctx.fillStyle = color
      ctx.fillText(lb.th.name, x, ry + fs + (h - fs) / 2)
      ctx.globalAlpha = 1
    }
    ctx.textAlign = 'left'
  }

  // ── Working-group cluster labels (same pill UX as themes) ─────
  if (groupBy === 'workgroup') {
    const maxGW = Math.max(1, ...groups.map(gr =>
      [...(effectiveGroupWork.get(gr.id) ?? [])].filter(id => pos.has(id)).length
    ))
    interface GWBox {
      gr: { id: string; name: string }
      ax: number; ay: number
      x: number; y: number
      w: number; h: number
      fs: number
      color: string
      alpha: number
      count: number
    }
    const gwLabels: GWBox[] = []
    for (const gr of groups) {
      const ids = [...(effectiveGroupWork.get(gr.id) ?? [])].filter(id => pos.has(id))
      if (!ids.length) continue
      const pts  = ids.map(id => pos.get(id)!)
      const cx   = pts.reduce((a, p) => a + p.x + NW / 2, 0) / pts.length
      const minY = Math.min(...pts.map(p => p.y))
      const count = ids.length
      const t    = Math.sqrt(count / maxGW)
      const fs   = (8 + 7 * t) / vp.z
      ctx.font   = `${fs}px "Sofia Sans", sans-serif`
      const tw   = ctx.measureText(gr.name).width
      const padH = (5 + 3 * t) / vp.z
      const padV = (3 + 2 * t) / vp.z
      const w    = tw + padH * 2
      const h    = fs + padV * 2
      const ay   = minY - NR / vp.z - h - 6 / vp.z
      gwLabels.push({
        gr, count,
        ax: cx, ay,
        x: cx, y: ay,
        w, h, fs,
        color: groupColors.get(gr.id) ?? 'rgba(166,163,151,0.8)',
        alpha: selectedGroupId === null || selectedGroupId === gr.id ? 1 : 0.22,
      })
    }
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < gwLabels.length; i++) {
        for (let j = i + 1; j < gwLabels.length; j++) {
          const a = gwLabels[i], b = gwLabels[j]
          const overlapX = (a.w + b.w) / 2 - Math.abs(a.x - b.x)
          const overlapY = (a.h + b.h) / 2 + 4 / vp.z - Math.abs(a.y - b.y)
          if (overlapX <= 0 || overlapY <= 0) continue
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 2 / vp.z
            if (a.x <= b.x) { a.x -= push; b.x += push }
            else             { a.x += push; b.x -= push }
          } else {
            const push = overlapY / 2 + 2 / vp.z
            if (a.count >= b.count) { b.y -= push } else { a.y -= push }
          }
        }
      }
    }
    ctx.textAlign = 'center'
    for (const lb of gwLabels) {
      ctx.globalAlpha = lb.alpha
      const { x, y, w, h, fs, color } = lb
      const dx = x - lb.ax, dy = y - lb.ay
      if (Math.hypot(dx, dy) > 4 / vp.z) {
        ctx.beginPath()
        ctx.moveTo(lb.ax, lb.ay + h / 2)
        ctx.lineTo(x, y + h / 2)
        ctx.strokeStyle = color
        ctx.lineWidth   = 0.5 / vp.z
        ctx.globalAlpha = lb.alpha * 0.4
        ctx.setLineDash([3 / vp.z, 3 / vp.z])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = lb.alpha
      }
      const rx = x - w / 2, ry = y, rad = 3 / vp.z
      ctx.beginPath()
      ctx.moveTo(rx + rad, ry)
      ctx.lineTo(rx + w - rad, ry)
      ctx.arcTo(rx + w, ry, rx + w, ry + rad, rad)
      ctx.lineTo(rx + w, ry + h - rad)
      ctx.arcTo(rx + w, ry + h, rx + w - rad, ry + h, rad)
      ctx.lineTo(rx + rad, ry + h)
      ctx.arcTo(rx, ry + h, rx, ry + h - rad, rad)
      ctx.lineTo(rx, ry + rad)
      ctx.arcTo(rx, ry, rx + rad, ry, rad)
      ctx.closePath()
      ctx.fillStyle = 'rgba(13,13,13,0.82)'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth   = (0.8 + 0.7 * Math.sqrt(lb.count / maxGW)) / vp.z
      ctx.stroke()
      ctx.font      = `${fs}px "Sofia Sans", sans-serif`
      ctx.fillStyle = color
      ctx.fillText(lb.gr.name, x, ry + fs + (h - fs) / 2)
      ctx.globalAlpha = 1
    }
    ctx.textAlign = 'left'
  }

  // ── Edges ────────────────────────────────────────────────────
  const edgesDraw = frozenEdges ?? edgesRef.current
  for (const e of edgesDraw) {
    const a = pos.get(e.source), b = pos.get(e.target)
    if (!a || !b) continue
    const vis   = LINK_VIS[e.relation_type ?? ''] ?? LINK_DEF
    const isHov = e === hovEdge
    ctx.beginPath()
    ctx.moveTo(a.x + NW / 2, a.y + NH / 2)
    ctx.lineTo(b.x + NW / 2, b.y + NH / 2)
    ctx.strokeStyle = vis.color
    ctx.lineWidth   = (isHov ? vis.w * 2.5 : vis.w) / vp.z
    ctx.setLineDash(vis.dash.map(d => d / vp.z))
    ctx.globalAlpha = isHov ? 1 : 0.6
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  // ── Draft link ───────────────────────────────────────────────
  const draft = draftRef.current
  if (draft) {
    const a = pos.get(draft.from)
    if (a) {
      const vis = LINK_VIS[linkType] ?? LINK_DEF
      ctx.beginPath()
      ctx.moveTo(a.x + NW / 2, a.y + NH / 2)
      ctx.lineTo((draft.toX - vp.x) / vp.z, (draft.toY - vp.y) / vp.z)
      ctx.strokeStyle = vis.color
      ctx.lineWidth   = vis.w / vp.z
      ctx.setLineDash([4 / vp.z, 4 / vp.z])
      ctx.globalAlpha = 0.85
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
  }

  // ── Nodes (circular) ─────────────────────────────────────────
  const tier = thumbTier(vp.z)
  for (const [id, p] of pos) {
    const o    = oeuvresById.get(id)
    if (!o) continue
    const img  = imagesRef.current.get(`${id}_${tier}`)
              ?? imagesRef.current.get(`${id}_100`)
              ?? imagesRef.current.get(`${id}_200`)
              ?? imagesRef.current.get(`${id}_40`)
    const isSel = sel.has(id)
    const isHov = id === hovNode
    const cx    = p.x + NW / 2
    const cy    = p.y + NH / 2

    const primThemeId = workPrimaryTheme.get(id)
    const primGroupId = workPrimaryGroup.get(id)
    let themeC = '#26262a'
    if (groupBy === 'theme' && primThemeId != null) {
      themeC = themeColors.get(primThemeId) ?? '#26262a'
    } else if (groupBy === 'workgroup' && primGroupId != null) {
      themeC = groupColors.get(primGroupId) ?? '#26262a'
    }

    ctx.globalAlpha = 1

    if (isHov) {
      const rr = NR + RING / vp.z
      ctx.beginPath()
      ctx.arc(cx, cy, rr, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(200,168,110,0.35)'
      ctx.lineWidth   = 1 / vp.z
      ctx.setLineDash([3 / vp.z, 3 / vp.z])
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, NR, 0, Math.PI * 2)
    ctx.clip()

    ctx.fillStyle = '#111112'
    ctx.fill()

    if (img?.complete && img.naturalWidth > 0) {
      drawContain(ctx, img, cx, cy, NR)
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fill()
      ctx.fillStyle = 'var(--tx3)'
      ctx.font      = `${Math.max(6, 12 / vp.z)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = o.Titre ? o.Titre.slice(0, 2).toUpperCase() : `#${id}`
      ctx.fillText(label, cx, cy)
    }

    ctx.restore()

    ctx.beginPath()
    ctx.arc(cx, cy, NR - 0.5 / vp.z, 0, Math.PI * 2)
    ctx.strokeStyle = isSel ? '#c8a86e' : isHov ? '#a8a397' : themeC
    ctx.lineWidth   = (isSel ? 2.5 : groupBy === 'theme' || groupBy === 'workgroup' ? 1.5 : 1) / vp.z
    ctx.stroke()

    if ((o as Oeuvre & { anonymity_level?: number }).anonymity_level === 2) {
      ctx.save()
      const dotR = 7 / vp.z
      const ang  = -Math.PI / 4
      const dotX = cx + (NR - dotR * 0.5) * Math.cos(ang)
      const dotY = cy + (NR - dotR * 0.5) * Math.sin(ang)
      ctx.beginPath()
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = '#c88a20'
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.max(5, 8 / vp.z)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', dotX, dotY)
      ctx.restore()
    }

    if (vp.z > 0.4) {
      ctx.fillStyle = isSel ? 'var(--ac)' : isHov ? 'var(--tx)' : 'var(--tx3)'
      ctx.font      = `${8 / vp.z}px "Sofia Sans", sans-serif`
      ctx.textAlign = 'center'
      const short = o.Titre ? (o.Titre.length > 20 ? o.Titre.slice(0, 18) + '…' : o.Titre) : `#${id}`
      ctx.fillText(short, cx, cy + NR + 10 / vp.z)
    }
    ctx.globalAlpha = 1
  }

  // ── Shapes & Active Shape ────────────────────────────────────
  const allShapes = activeShape ? [...shapes, activeShape] : shapes
  for (const s of allShapes) {
    ctx.strokeStyle = s.color
    ctx.fillStyle   = s.color
    if (s.type === 'line') {
      if (s.points.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      ctx.lineWidth = s.width
      ctx.lineCap   = 'round'
      ctx.lineJoin  = 'round'
      ctx.stroke()
    } else {
      ctx.font = `${s.size}px "Instrument Serif", serif`
      ctx.fillText(s.text, s.x, s.y)
    }
  }

  ctx.restore() // Viewport transform end

  // ── Marquee (Screen Space - CSS Pixels with DPR) ────────────
  if (marquee) {
    ctx.strokeStyle = 'rgba(200,168,110,0.8)'
    ctx.setLineDash([4, 4])
    ctx.lineWidth   = 1
    ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h)
    ctx.fillStyle   = 'rgba(200,168,110,0.1)'
    ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h)
    ctx.setLineDash([])
  }

  ctx.restore()
}
