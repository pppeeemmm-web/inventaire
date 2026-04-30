'use client'

// ConstellationCanvas — interactive canvas for visual graph of works.
// Nodes = thumbnails. Edges = tblrelations.
// Grouped by year / theme / free. Zoom/pan. Drag-edge-to-link. Right-click edge to delete.

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { imageUrl, thumbUrl } from '@/lib/data'
import type { Oeuvre }  from '@/lib/types/database'

// ── Constants ──────────────────────────────────────────────────────────────
const NW    = 80   // node bounding box width  (logical px)
const NH    = 60   // node bounding box height 4:3
const NR    = 30   // circle radius (= NH/2)
const RING  = 10   // link-drag zone outside circle border (logical px)
const MIN_Z = 0.04
const MAX_Z = 6

// ── Thumb tier: pick image resolution based on zoom level ─────────────────
function thumbTier(z: number): 40 | 100 | 200 {
  if (z < 0.3)  return 40
  if (z < 1.5)  return 100
  return 200
}

// ── Types ──────────────────────────────────────────────────────────────────
type Pt       = { x: number; y: number }
type NodeMap  = Map<number, Pt>
type GroupBy  = 'year' | 'theme' | 'none' | 'custom'
type LinkType = 'influence' | 'proximity' | 'series' | 'diptych'

interface VP { x: number; y: number; z: number }
interface Edge {
  id:            string
  source:        number
  target:        number
  relation_type: string | null
  strength:      number | null
  description:   string | null
}
interface Drag {
  mode:       'idle' | 'pan' | 'node' | 'link'
  startX:     number
  startY:     number
  nodeId?:    number
  panOrigin?: Pt
}

// ── Link styles ────────────────────────────────────────────────────────────
const LINK_VIS: Record<string, { color: string; dash: number[]; w: number }> = {
  influence: { color: '#c8a86e', dash: [],      w: 2   },
  proximity: { color: '#7ab4c8', dash: [8, 5],  w: 1.5 },
  series:    { color: '#8cc87a', dash: [],       w: 2.5 },
  diptych:   { color: '#c87a9e', dash: [3, 3],  w: 2   },
}
const LINK_DEF = { color: '#706c62', dash: [4, 6], w: 1 }

// ── Position persistence (per groupBy mode + theme filter) ────────────────
// Theme mode uses the selectedThemeId in the key so each filter state saves separately.
const POS_KEY = (g: GroupBy, themeId?: number | null) =>
  g === 'theme' ? `pem_const_pos_theme_${themeId ?? 'all'}` : `pem_const_pos_${g}`

function loadPos(g: GroupBy, themeId?: number | null): NodeMap | null {
  try {
    const raw = localStorage.getItem(POS_KEY(g, themeId))
    if (!raw) return null
    const obj = JSON.parse(raw) as Record<string, Pt>
    const m = new Map(Object.entries(obj).map(([k, v]) => [+k, v]))
    return m.size > 0 ? m : null
  } catch { return null }
}
function savePos(g: GroupBy, m: NodeMap, themeId?: number | null) {
  try {
    const obj: Record<string, Pt> = {}
    m.forEach((v, k) => { obj[k] = v })
    localStorage.setItem(POS_KEY(g, themeId), JSON.stringify(obj))
  } catch {}
}

// ── Named snapshots ────────────────────────────────────────────────────────
const SNAP_KEY = 'pem_const_snapshots'
interface Snapshot { id: string; name: string; groupBy: GroupBy; positions: Record<string, Pt>; savedAt: string }
function loadSnapshots(): Snapshot[] { try { return JSON.parse(localStorage.getItem(SNAP_KEY) ?? '[]') } catch { return [] } }
function persistSnapshots(s: Snapshot[]) { try { localStorage.setItem(SNAP_KEY, JSON.stringify(s)) } catch {} }
function posToObj(m: NodeMap): Record<string, Pt> { const o: Record<string, Pt> = {}; m.forEach((v, k) => { o[k] = v }); return o }
function objToPos(o: Record<string, Pt>): NodeMap  { return new Map(Object.entries(o).map(([k, v]) => [+k, v])) }

// ── Layout algorithms ──────────────────────────────────────────────────────
function layoutYear(oeuvres: Oeuvre[]): NodeMap {
  const by = new Map<string, Oeuvre[]>()
  for (const o of oeuvres) {
    const y = o.Année?.slice(0, 4) ?? '?'
    if (!by.has(y)) by.set(y, [])
    by.get(y)!.push(o)
  }
  const years = [...by.keys()].sort()
  const m     = new Map<number, Pt>()
  let x = 60
  for (const yr of years) {
    const ws   = by.get(yr)!
    const cols = Math.max(1, Math.round(Math.sqrt(ws.length * 0.75)))
    ws.forEach((o, i) => m.set(o.OeuvreID, {
      x: x + (i % cols) * (NW + 14),
      y: 80 + Math.floor(i / cols) * (NH + 14),
    }))
    x += Math.min(cols, ws.length) * (NW + 14) + 52
  }
  return m
}

// Place a cluster of works in concentric rings around (cx, cy) so nodes never overlap.
function placeCluster(ids: number[], cx: number, cy: number, out: Map<number, Pt>) {
  if (!ids.length) return
  // Node circles have radius NR=30. Min center-to-center = 2*NR + 8 = 68px.
  const SPACING  = NR * 2 + 8   // 68 — min distance between node centers
  const RING_GAP = SPACING       // radial distance between consecutive ring radii
  const BASE_R   = Math.max(60, SPACING / (2 * Math.PI) * 4) // ~first ring radius

  let remaining = [...ids]
  let ring = 0
  while (remaining.length > 0) {
    const r    = BASE_R + ring * RING_GAP
    const cap  = Math.max(1, Math.floor(2 * Math.PI * r / SPACING))
    const batch = remaining.splice(0, cap)
    batch.forEach((id, i) => {
      const a = (i / batch.length) * Math.PI * 2 - Math.PI / 2
      out.set(id, { x: cx + Math.cos(a) * r - NW / 2, y: cy + Math.sin(a) * r - NH / 2 })
    })
    ring++
  }
}

// Estimate the outer radius a cluster of n works will occupy.
function clusterOuterR(n: number): number {
  const SPACING = NR * 2 + 8
  const BASE_R  = Math.max(60, SPACING / (2 * Math.PI) * 4)
  const RING_GAP = SPACING
  let rem = n, ring = 0
  while (rem > 0) {
    const r = BASE_R + ring * RING_GAP
    rem -= Math.max(1, Math.floor(2 * Math.PI * r / SPACING))
    ring++
  }
  return BASE_R + (ring - 1) * RING_GAP + NR + 8
}

function layoutTheme(
  oeuvres:   Oeuvre[],
  themeWork: Map<number, Set<number>>,
  themes:    { ThemeID: number }[],
): NodeMap {
  // Only place works that belong to at least one of the given themes.
  // Unthemed works are intentionally excluded — use year/libre mode for them.
  const oeuvreSet = new Set(oeuvres.map(o => o.OeuvreID))
  const m         = new Map<number, Pt>()
  const placed    = new Set<number>()

  // Gather per-theme work lists (skip already-placed multi-theme works after first placement)
  const themeLists = themes.map(th => ({
    th,
    ids: [...(themeWork.get(th.ThemeID) ?? [])].filter(id => oeuvreSet.has(id)),
  })).filter(x => x.ids.length > 0)

  if (themeLists.length === 0) return m

  if (themeLists.length === 1) {
    // Single theme: center the cluster
    const ids = themeLists[0].ids
    placeCluster(ids, 700, 500, m)
    ids.forEach(id => placed.add(id))
  } else {
    // Multiple themes: arrange cluster centers in a large circle so they don't overlap.
    // Cluster center distance = sum of two neighbouring outer radii + 120px buffer.
    const radii = themeLists.map(x => clusterOuterR(x.ids.length))
    const maxR  = Math.max(...radii)
    // Place cluster centers on a circle large enough so adjacent clusters don't touch.
    // Min arc length between centres ≈ 2 * maxR + 120.
    const N         = themeLists.length
    const minArc    = (2 * maxR + 120)
    const R_CLUSTER = Math.max(600, (minArc * N) / (2 * Math.PI))

    themeLists.forEach(({ th: _th, ids }, ti) => {
      // Skip works already placed (works belonging to multiple themes appear in first cluster)
      const unplaced = ids.filter(id => !placed.has(id))
      if (!unplaced.length) return
      const angle = (ti / N) * Math.PI * 2 - Math.PI / 2
      const cx    = 700 + Math.cos(angle) * R_CLUSTER
      const cy    = 500 + Math.sin(angle) * R_CLUSTER
      placeCluster(unplaced, cx, cy, m)
      unplaced.forEach(id => placed.add(id))
    })
  }

  return m
}

function layoutGrid(oeuvres: Oeuvre[]): NodeMap {
  const m    = new Map<number, Pt>()
  const cols = Math.ceil(Math.sqrt(oeuvres.length * 1.4))
  oeuvres.forEach((o, i) => m.set(o.OeuvreID, {
    x: 60 + (i % cols) * (NW + 14),
    y: 60 + Math.floor(i / cols) * (NH + 14),
  }))
  return m
}

// ── Geometry ───────────────────────────────────────────────────────────────
function ptSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

function hitNode(lx: number, ly: number, pos: NodeMap, vp: VP): { id: number; zone: 'center' | 'ring' } | null {
  const wx   = (lx - vp.x) / vp.z
  const wy   = (ly - vp.y) / vp.z
  for (const [id, p] of pos) {
    const cx   = p.x + NW / 2
    const cy   = p.y + NH / 2
    const dist = Math.hypot(wx - cx, wy - cy)
    if (dist <= NR)             return { id, zone: 'center' }
    if (dist <= NR + RING)      return { id, zone: 'ring'   }
  }
  return null
}

function hitEdge(lx: number, ly: number, edges: Edge[], pos: NodeMap, vp: VP): Edge | null {
  for (const e of edges) {
    const a = pos.get(e.source), b = pos.get(e.target)
    if (!a || !b) continue
    const ax = (a.x + NW / 2) * vp.z + vp.x, ay = (a.y + NH / 2) * vp.z + vp.y
    const bx = (b.x + NW / 2) * vp.z + vp.x, by = (b.y + NH / 2) * vp.z + vp.y
    if (ptSeg(lx, ly, ax, ay, bx, by) < 8) return e
  }
  return null
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  oeuvres:      Oeuvre[]
  tM:           Record<number, string>
  themes:       { ThemeID: number; Nom: string }[]
  selection:    Set<number>
  setSelection: (s: Set<number>) => void
  onOpen:       (o: Oeuvre) => void
  onSaveGroup:  (name: string, ids: number[]) => Promise<string | null>
}

// ── Component ──────────────────────────────────────────────────────────────
export function ConstellationCanvas({ oeuvres, tM, themes, selection, setSelection, onOpen, onSaveGroup }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  // Refs for stale-closure-safe event handlers
  const vpRef       = useRef<VP>({ x: 40, y: 40, z: 1 })
  const posRef      = useRef<NodeMap>(new Map())
  const edgesRef    = useRef<Edge[]>([])
  const hovNodeRef  = useRef<number | null>(null)
  const hovEdgeRef  = useRef<Edge | null>(null)
  const dragRef     = useRef<Drag>({ mode: 'idle', startX: 0, startY: 0 })
  const draftRef    = useRef<{ from: number; toX: number; toY: number } | null>(null)
  // keyed by `${oeuvreId}_${tier}` so each zoom tier has its own cache entry
  const imagesRef   = useRef<Map<string, HTMLImageElement>>(new Map())
  const selRef      = useRef(selection)
  const groupByRef  = useRef<GroupBy>('year')
  useEffect(() => { selRef.current = selection }, [selection])

  // React state
  const [tick,      setTick]      = useState(0)
  const [groupBy,   setGroupBy]   = useState<GroupBy>('year')
  const [linkType,  setLinkType]  = useState<LinkType>('influence')
  const [loading,   setLoading]   = useState(true)
  const [themeWork, setThemeWork] = useState<Map<number, Set<number>>>(new Map())
  const [panelNode, setPanelNode] = useState<Oeuvre | null>(null)
  const [groupName,  setGroupName]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [savedName,  setSavedName]  = useState<string | null>(null)
  const [snapshots,  setSnapshots]  = useState<Snapshot[]>(loadSnapshots)
  const [snapName,   setSnapName]   = useState('')
  const [snapSaved,  setSnapSaved]  = useState(false)
  // Custom (blank canvas) mode
  const [customIds,        setCustomIds]        = useState<Set<number>>(new Set())
  const [pickerQ,          setPickerQ]          = useState('')
  // Theme mode: optional single-theme filter
  const [selectedThemeId,  setSelectedThemeId]  = useState<number | null>(null)

  const redraw = useCallback(() => setTick(t => t + 1), [])

  const oeuvresById = useMemo(() => new Map(oeuvres.map(o => [o.OeuvreID, o])), [oeuvres])

  // Reset theme filter when leaving theme mode; clear panel in theme mode.
  useEffect(() => {
    if (groupBy !== 'theme') setSelectedThemeId(null)
    else setPanelNode(null)   // hide preview panel when entering theme mode
  }, [groupBy])
  useEffect(() => {
    // Clear the old monolithic theme cache key (before filter-aware keys were introduced).
    try { localStorage.removeItem('pem_const_pos_theme') } catch {}
  }, [])

  // Works shown in theme mode: only those belonging to the selected/all themes
  const constellationOeuvres = useMemo(() => {
    if (groupBy !== 'theme') return oeuvres
    const themeIds = selectedThemeId !== null ? [selectedThemeId] : [...themeWork.keys()]
    const ids = new Set<number>()
    themeIds.forEach(tid => (themeWork.get(tid) ?? new Set()).forEach(id => ids.add(id)))
    return oeuvres.filter(o => ids.has(o.OeuvreID))
  }, [groupBy, oeuvres, themeWork, selectedThemeId])

  // Works not yet in the custom canvas, matching picker search
  const filteredForPicker = useMemo(() => {
    if (groupBy !== 'custom') return []
    const sq = pickerQ.trim().toLowerCase()
    return oeuvres.filter(o => {
      if (customIds.has(o.OeuvreID)) return false
      if (!sq) return true
      return `${o.Titre ?? ''} ${tM[o.Technique ?? 0] ?? ''} ${o.Année?.slice(0, 4) ?? ''}`.toLowerCase().includes(sq)
    })
  }, [groupBy, oeuvres, customIds, pickerQ, tM])

  // ── Data load ──────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    async function load() {
      const sb = createClient()
      const [{ data: rels }, { data: ot }] = await Promise.all([
        sb.from('tblrelations').select('id, source_id, target_id, relation_type, strength, description').range(0, 9999),
        sb.from('OeuvreTheme').select('OeuvreID, ThemeID').range(0, 49999),
      ])
      if (!active) return

      edgesRef.current = (rels ?? [])
        .filter(r => r.source_id && r.target_id)
        .map(r => ({ id: r.id, source: r.source_id!, target: r.target_id!, relation_type: r.relation_type, strength: r.strength, description: r.description }))

      const tw = new Map<number, Set<number>>()
      for (const row of (ot ?? [])) {
        if (!tw.has(row.ThemeID)) tw.set(row.ThemeID, new Set())
        tw.get(row.ThemeID)!.add(row.OeuvreID)
      }
      setThemeWork(tw)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  // ── Layout ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    groupByRef.current = groupBy
    if (groupBy === 'custom') {
      // Custom mode: positions are managed by addToCustom/removeFromCustom.
      // Don't auto-layout — just redraw with whatever is in posRef.
      redraw()
      return
    }
    if (groupBy === 'theme') {
      // Try to restore saved positions for this exact theme filter.
      // Saved positions are keyed by (groupBy, selectedThemeId) so each filter state persists independently.
      const saved = loadPos('theme', selectedThemeId)
      if (saved && saved.size > 0) {
        posRef.current = saved
      } else {
        const activeThemes = selectedThemeId !== null
          ? themes.filter(t => t.ThemeID === selectedThemeId)
          : themes
        posRef.current = layoutTheme(constellationOeuvres, themeWork, activeThemes)
      }
    } else {
      const saved = loadPos(groupBy)
      if (saved) {
        posRef.current = saved
      } else {
        if (groupBy === 'year') posRef.current = layoutYear(oeuvres)
        else                    posRef.current = layoutGrid(oeuvres)
      }
    }
    redraw()
  }, [groupBy, loading, oeuvres, constellationOeuvres, themeWork, themes, selectedThemeId, redraw])

  // ── Visible image loading (zoom-adaptive tiers) ───────────────
  function loadVisible() {
    const c = canvasRef.current
    if (!c) return
    const vp   = vpRef.current
    const tier = thumbTier(vp.z)
    const m    = (NR + RING) * 2
    const x0   = (-vp.x - m) / vp.z, x1 = (c.offsetWidth  - vp.x + m) / vp.z
    const y0   = (-vp.y - m) / vp.z, y1 = (c.offsetHeight - vp.y + m) / vp.z

    for (const [id, p] of posRef.current) {
      const ncx = p.x + NW / 2, ncy = p.y + NH / 2
      if (ncx + NR < x0 || ncx - NR > x1 || ncy + NR < y0 || ncy - NR > y1) continue
      const key = `${id}_${tier}`
      if (imagesRef.current.has(key)) continue
      const o = oeuvresById.get(id)
      if (!o?.txtImageNameLink) continue
      const img    = new Image()
      img.crossOrigin = 'anonymous'
      img.onload  = () => { imagesRef.current.set(key, img); redraw() }
      img.src     = thumbUrl(o.txtImageNameLink, tier) ?? ''
      imagesRef.current.set(key, img) // placeholder until loaded
    }
  }

  // ── Draw helpers ──────────────────────────────────────────────
  // Draw image cover-cropped to fill a circle of radius r centred at cx,cy
  function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
    const iw = img.naturalWidth, ih = img.naturalHeight
    if (!iw || !ih) return
    const scale = Math.max((r * 2) / iw, (r * 2) / ih)
    const dw = iw * scale, dh = ih * scale
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
  }

  // ── Draw ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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

    ctx.translate(vp.x, vp.y)
    ctx.scale(vp.z, vp.z)

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
        ctx.font = `${Math.max(7, 10 / vp.z)}px "JetBrains Mono", monospace`
        ctx.fillText(yr, minX + 4, minY - 10)
      }
    }

    // ── Theme colors (one distinct hue per theme) ────────────────
    // Computed inline so they stay in sync with the themes array order.
    const themeColors = new Map<number, string>(
      themes.map((th, i) => [th.ThemeID, `hsl(${Math.round((i / Math.max(1, themes.length)) * 300 + 20)}, 55%, 62%)`])
    )
    // Map each work to its first-listed theme (for border colouring)
    const workPrimaryTheme = new Map<number, number>()
    themes.forEach(th => {
      (themeWork.get(th.ThemeID) ?? new Set()).forEach(id => {
        if (!workPrimaryTheme.has(id)) workPrimaryTheme.set(id, th.ThemeID)
      })
    })

    // ── Theme cluster labels (pill badges, colour-coded, size-scaled) ─
    if (groupBy === 'theme') {
      // Step 1: compute ideal positions and sizes for each theme label
      const maxCount = Math.max(1, ...themes.map(th =>
        [...(themeWork.get(th.ThemeID) ?? [])].filter(id => pos.has(id)).length
      ))

      interface LBox {
        th:       { ThemeID: number; Nom: string }
        ax: number; ay: number   // anchor (cluster top-centre)
        x:  number; y:  number   // current (after collision resolution)
        w:  number; h:  number   // pill bounding box
        fs: number               // font size (logical px)
        color: string
        alpha: number
        count: number
      }
      const labels: LBox[] = []

      for (const th of themes) {
        const ids = [...(themeWork.get(th.ThemeID) ?? [])].filter(id => pos.has(id))
        if (!ids.length) continue
        const pts   = ids.map(id => pos.get(id)!)
        const cx    = pts.reduce((a, p) => a + p.x + NW / 2, 0) / pts.length
        const minY  = Math.min(...pts.map(p => p.y))
        const count = ids.length

        // Font size scales with theme size (8–14 logical px, adjusted for zoom)
        const t   = Math.sqrt(count / maxCount)   // 0..1, sqrt for perceptual scaling
        const fs  = (8 + 7 * t) / vp.z
        ctx.font  = `${fs}px "JetBrains Mono", monospace`
        const tw  = ctx.measureText(th.Nom).width
        const padH = (5 + 3 * t) / vp.z
        const padV = (3 + 2 * t) / vp.z
        const w   = tw + padH * 2
        const h   = fs + padV * 2
        const ay  = minY - NR / vp.z - h - 6 / vp.z   // just above the topmost node

        labels.push({
          th, count,
          ax: cx, ay,
          x: cx, y: ay,
          w, h, fs,
          color: themeColors.get(th.ThemeID) ?? 'rgba(166,163,151,0.8)',
          alpha: selectedThemeId === null || selectedThemeId === th.ThemeID ? 1 : 0.22,
        })
      }

      // Step 2: collision resolution — push overlapping pills apart (5 passes)
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i], b = labels[j]
            const overlapX = (a.w + b.w) / 2 - Math.abs(a.x - b.x)
            const overlapY = (a.h + b.h) / 2 + 4 / vp.z - Math.abs(a.y - b.y)
            if (overlapX <= 0 || overlapY <= 0) continue
            // Prefer separating on the smaller axis
            if (overlapX < overlapY) {
              const push = overlapX / 2 + 2 / vp.z
              if (a.x <= b.x) { a.x -= push; b.x += push }
              else             { a.x += push; b.x -= push }
            } else {
              const push = overlapY / 2 + 2 / vp.z
              // Push smaller theme label up, larger label stays (or both separate)
              if (a.count >= b.count) { b.y -= push } else { a.y -= push }
            }
          }
        }
      }

      // Step 3: draw pills + connector lines from pill back to anchor
      ctx.textAlign = 'center'
      for (const lb of labels) {
        ctx.globalAlpha = lb.alpha
        const { x, y, w, h, fs, color } = lb

        // Thin connector from pill centre to cluster anchor (if displaced)
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

        // Pill background
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

        // Label text
        ctx.font      = `${fs}px "JetBrains Mono", monospace`
        ctx.fillStyle = color
        ctx.fillText(lb.th.Nom, x, ry + fs + (h - fs) / 2)
        ctx.globalAlpha = 1
      }
      ctx.textAlign = 'left'
    }

    // ── Edges ────────────────────────────────────────────────────
    for (const e of edgesRef.current) {
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
      // Best available cached image: prefer current tier, fall back to others
      const img  = imagesRef.current.get(`${id}_${tier}`)
                ?? imagesRef.current.get(`${id}_100`)
                ?? imagesRef.current.get(`${id}_200`)
                ?? imagesRef.current.get(`${id}_40`)
      const isSel = sel.has(id)
      const isHov = id === hovNode
      const cx    = p.x + NW / 2
      const cy    = p.y + NH / 2

      // Theme colour for this node's border
      const primThemeId = workPrimaryTheme.get(id)
      const themeC      = (groupBy === 'theme' && primThemeId != null)
        ? themeColors.get(primThemeId) ?? '#26262a'
        : '#26262a'

      // No dimming in theme mode — all visible nodes are relevant
      ctx.globalAlpha = 1

      // Link-ring halo on hover (drawn below node)
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

      // Circular clip for background + thumbnail
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, NR, 0, Math.PI * 2)
      ctx.clip()

      // Background fill
      ctx.fillStyle = '#111112'
      ctx.fill()

      // Thumbnail (only draw if fully loaded)
      if (img?.complete && img.naturalWidth > 0) {
        drawContain(ctx, img, cx, cy, NR)
      }

      ctx.restore()

      // Circle border — colour-coded by theme, gold if selected, grey if hovered
      ctx.beginPath()
      ctx.arc(cx, cy, NR - 0.5 / vp.z, 0, Math.PI * 2)
      ctx.strokeStyle = isSel ? '#c8a86e' : isHov ? '#a8a397' : themeC
      ctx.lineWidth   = (isSel ? 2.5 : groupBy === 'theme' ? 1.5 : 1) / vp.z
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.restore()
    loadVisible()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, groupBy, linkType, oeuvres, themes, themeWork, oeuvresById, selectedThemeId])

  // ── Wheel (passive: false required for preventDefault) ────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const vp     = vpRef.current
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      const newZ   = Math.max(MIN_Z, Math.min(MAX_Z, vp.z * factor))
      const rect   = canvas.getBoundingClientRect()
      const lx     = e.clientX - rect.left
      const ly     = e.clientY - rect.top
      vpRef.current = { z: newZ, x: lx - (lx - vp.x) * (newZ / vp.z), y: ly - (ly - vp.y) * (newZ / vp.z) }
      redraw()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [redraw])

  // ── Resize ────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new ResizeObserver(() => redraw())
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [redraw])

  // ── Helpers ───────────────────────────────────────────────────
  function local(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { lx: e.clientX - rect.left, ly: e.clientY - rect.top }
  }

  // ── Mouse handlers ─────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const hit = hitNode(lx, ly, posRef.current, vpRef.current)

    if (!hit) {
      dragRef.current = { mode: 'pan', startX: lx, startY: ly, panOrigin: { x: vpRef.current.x, y: vpRef.current.y } }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    } else if (hit.zone === 'ring') {
      dragRef.current  = { mode: 'link', startX: lx, startY: ly, nodeId: hit.id }
      draftRef.current = { from: hit.id, toX: lx, toY: ly }
      if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
      setTick(t => t + 1)
    } else {
      dragRef.current = { mode: 'node', startX: lx, startY: ly, nodeId: hit.id }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const drag = dragRef.current
    const vp   = vpRef.current

    if (drag.mode === 'pan') {
      vpRef.current = { ...vp, x: drag.panOrigin!.x + (lx - drag.startX), y: drag.panOrigin!.y + (ly - drag.startY) }
      setTick(t => t + 1)
    } else if (drag.mode === 'node') {
      const cur = posRef.current.get(drag.nodeId!)
      if (cur) {
        const next = new Map(posRef.current)
        next.set(drag.nodeId!, { x: cur.x + (lx - drag.startX) / vp.z, y: cur.y + (ly - drag.startY) / vp.z })
        posRef.current  = next
        dragRef.current = { ...drag, startX: lx, startY: ly }
        setTick(t => t + 1)
      }
    } else if (drag.mode === 'link') {
      draftRef.current = { from: drag.nodeId!, toX: lx, toY: ly }
      const hit   = hitNode(lx, ly, posRef.current, vpRef.current)
      const newId = hit && hit.id !== drag.nodeId ? hit.id : null
      if (newId !== hovNodeRef.current) {
        hovNodeRef.current = newId
        setPanelNode(newId ? (oeuvresById.get(newId) ?? null) : null)
      }
      setTick(t => t + 1)
    } else {
      // Idle hover
      const hit      = hitNode(lx, ly, posRef.current, vpRef.current)
      const newHovId = hit?.id ?? null
      const newHovEd = hit ? null : hitEdge(lx, ly, edgesRef.current, posRef.current, vpRef.current)
      let needRedraw = false

      if (newHovId !== hovNodeRef.current) {
        hovNodeRef.current = newHovId
        // In theme mode, suppress the preview panel — user just wants to rearrange
        if (groupBy !== 'theme') {
          setPanelNode(newHovId ? (oeuvresById.get(newHovId) ?? null) : null)
        }
        needRedraw = true
      }
      if (newHovEd !== hovEdgeRef.current) {
        hovEdgeRef.current = newHovEd
        needRedraw = true
      }

      const c = canvasRef.current
      if (c) {
        if (hit?.zone === 'ring')    c.style.cursor = 'crosshair'
        else if (hit?.zone === 'center') c.style.cursor = 'pointer'
        else if (newHovEd)          c.style.cursor = 'pointer'
        else                        c.style.cursor = 'grab'
      }
      if (needRedraw) setTick(t => t + 1)
    }
  }, [oeuvresById])

  const onMouseUp = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const drag = dragRef.current

    if (drag.mode === 'link') {
      draftRef.current   = null
      hovNodeRef.current = null
      const hit = hitNode(lx, ly, posRef.current, vpRef.current)
      if (hit && hit.id !== drag.nodeId) {
        // Persist
        const sb = createClient()
        const { data } = await sb.from('tblrelations')
          .insert({ source_id: drag.nodeId!, target_id: hit.id, relation_type: linkType })
          .select('id, source_id, target_id, relation_type, strength, description')
          .single()
        if (data) {
          edgesRef.current = [...edgesRef.current, {
            id: data.id, source: data.source_id!, target: data.target_id!,
            relation_type: data.relation_type, strength: data.strength, description: data.description,
          }]
        }
      }
      setPanelNode(null)
      setTick(t => t + 1)
    } else if (drag.mode === 'node') {
      savePos(groupByRef.current, posRef.current, groupByRef.current === 'theme' ? selectedThemeId : undefined)
      // Click detection (no movement → open or toggle selection)
      if (Math.abs(lx - drag.startX) < 4 && Math.abs(ly - drag.startY) < 4) {
        const hit = hitNode(lx, ly, posRef.current, vpRef.current)
        if (hit) {
          if (e.shiftKey) {
            const next = new Set(selRef.current)
            next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id)
            setSelection(next)
          } else {
            const o = oeuvresById.get(hit.id)
            if (o) onOpen(o)
          }
        }
      }
    }

    dragRef.current = { mode: 'idle', startX: 0, startY: 0 }
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }, [linkType, oeuvresById, onOpen, setSelection])

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const edge = hitEdge(lx, ly, edgesRef.current, posRef.current, vpRef.current)
    if (!edge) return
    const sb = createClient()
    sb.from('tblrelations').delete().eq('id', edge.id).then(() => {
      edgesRef.current   = edgesRef.current.filter(e2 => e2.id !== edge.id)
      if (hovEdgeRef.current === edge) hovEdgeRef.current = null
      setTick(t => t + 1)
    })
  }, [])

  const onMouseLeave = useCallback(() => {
    if (dragRef.current.mode === 'node') savePos(groupByRef.current, posRef.current, groupByRef.current === 'theme' ? selectedThemeId : undefined)
    draftRef.current   = null
    hovNodeRef.current = null
    hovEdgeRef.current = null
    dragRef.current    = { mode: 'idle', startX: 0, startY: 0 }
    setPanelNode(null)
    setTick(t => t + 1)
  }, [])

  // ── Custom canvas: add / remove individual works ───────────────
  function addToCustom(id: number) {
    if (posRef.current.has(id)) return
    const vp = vpRef.current
    const canvas = canvasRef.current
    const cx = canvas ? (canvas.offsetWidth  / 2 - vp.x) / vp.z : 400
    const cy = canvas ? (canvas.offsetHeight / 2 - vp.y) / vp.z : 300
    const next = new Map(posRef.current)
    next.set(id, {
      x: cx + (Math.random() - 0.5) * 300 - NW / 2,
      y: cy + (Math.random() - 0.5) * 200 - NH / 2,
    })
    posRef.current = next
    setCustomIds(prev => new Set([...prev, id]))
    redraw()
  }

  function removeFromCustom(id: number) {
    const next = new Map(posRef.current)
    next.delete(id)
    posRef.current = next
    setCustomIds(prev => { const n = new Set(prev); n.delete(id); return n })
    // Also deselect if selected
    if (selRef.current.has(id)) {
      const sel = new Set(selRef.current); sel.delete(id); setSelection(sel)
    }
    redraw()
  }

  function addAllFiltered() {
    const toAdd = filteredForPicker.slice(0, 120)
    if (!toAdd.length) return
    const vp    = vpRef.current
    const canvas = canvasRef.current
    const cx    = canvas ? (canvas.offsetWidth  / 2 - vp.x) / vp.z : 400
    const cy    = canvas ? (canvas.offsetHeight / 2 - vp.y) / vp.z : 300
    const cols  = Math.ceil(Math.sqrt(toAdd.length * 1.4))
    const next  = new Map(posRef.current)
    const ids   = new Set(customIds)
    toAdd.forEach((o, i) => {
      if (next.has(o.OeuvreID)) return
      const col = i % cols, row = Math.floor(i / cols)
      next.set(o.OeuvreID, {
        x: cx + (col - cols / 2) * (NW + 18),
        y: cy + (row - Math.floor(toAdd.length / cols) / 2) * (NH + 18),
      })
      ids.add(o.OeuvreID)
    })
    posRef.current = next
    setCustomIds(ids)
    redraw()
  }

  // ── Snapshot: save current layout ──────────────────────────────
  function handleSaveSnapshot() {
    const name = snapName.trim() || `Vue ${new Date().toLocaleDateString('fr-FR')}`
    const snap: Snapshot = {
      id:        Date.now().toString(),
      name,
      groupBy:   groupByRef.current,
      positions: posToObj(posRef.current),
      savedAt:   new Date().toISOString(),
    }
    const updated = [snap, ...snapshots.filter(s => s.name !== name)].slice(0, 20)
    persistSnapshots(updated)
    setSnapshots(updated)
    setSnapName('')
    setSnapSaved(true)
    setTimeout(() => setSnapSaved(false), 2500)
  }

  // ── Snapshot: load ──────────────────────────────────────────────
  function handleLoadSnapshot(id: string) {
    const snap = snapshots.find(s => s.id === id)
    if (!snap) return
    groupByRef.current = snap.groupBy
    posRef.current = objToPos(snap.positions)
    if (snap.groupBy === 'custom') {
      setCustomIds(new Set(Object.keys(snap.positions).map(Number)))
    }
    setGroupBy(snap.groupBy)
    redraw()
  }

  // ── Snapshot: delete ────────────────────────────────────────────
  function handleDeleteSnapshot(id: string) {
    const updated = snapshots.filter(s => s.id !== id)
    persistSnapshots(updated)
    setSnapshots(updated)
  }

  // ── Export full canvas as PNG ───────────────────────────────────
  function handleExportPng() {
    if (posRef.current.size === 0) return
    // Calculate bounds of all nodes
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
    const SCALE = 2  // 2× for crisp export
    const off   = document.createElement('canvas')
    off.width   = W * SCALE
    off.height  = H * SCALE
    const ctx   = off.getContext('2d')!
    ctx.scale(SCALE, SCALE)
    // Background
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, W, H)
    // Draw nodes from posRef using the same style as the main canvas
    // Draw edges first
    ctx.save()
    ctx.translate(PAD - minX, PAD - minY)
    edgesRef.current.forEach(e => {
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
    // Draw nodes (top-left corner is pt.x, pt.y; center is pt.x+NW/2, pt.y+NH/2)
    posRef.current.forEach((pt, id) => {
      const o  = oeuvresById.get(id)
      const cx = pt.x + NW / 2
      const cy = pt.y + NH / 2
      // Node circle background
      ctx.beginPath()
      ctx.arc(cx, cy, NR, 0, Math.PI * 2)
      ctx.fillStyle   = '#1a1a1a'
      ctx.fill()
      // Thumbnail if cached
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
      // Circle border
      ctx.beginPath()
      ctx.arc(cx, cy, NR - 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = '#3a3a3a'
      ctx.lineWidth   = 1
      ctx.stroke()
      // Label
      if (o?.Titre) {
        ctx.fillStyle   = '#777'
        ctx.font        = '8px monospace'
        ctx.textAlign   = 'center'
        const short = o.Titre.length > 18 ? o.Titre.slice(0, 16) + '…' : o.Titre
        ctx.fillText(short, cx, cy + NR + 12)
      }
    })
    ctx.restore()
    // Download
    const a = document.createElement('a')
    a.href     = off.toDataURL('image/png')
    a.download = `constellation-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  // ── Export: tiled A4 print window ──────────────────────────────
  function handleExportTiledA4() {
    if (posRef.current.size === 0) return
    // Reuse same bounding-box + canvas creation logic as handleExportPng
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    posRef.current.forEach(({ x, y }) => {
      if (x       < minX) minX = x
      if (y       < minY) minY = y
      if (x + NW  > maxX) maxX = x + NW
      if (y + NH  > maxY) maxY = y + NH
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
    // Edges
    edgesRef.current.forEach(e => {
      const a = posRef.current.get(e.source), b = posRef.current.get(e.target)
      if (!a || !b) return
      const vis = LINK_VIS[e.relation_type ?? ''] ?? LINK_DEF
      ctx.beginPath()
      ctx.moveTo(a.x + NW / 2, a.y + NH / 2)
      ctx.lineTo(b.x + NW / 2, b.y + NH / 2)
      ctx.strokeStyle = vis.color; ctx.lineWidth = vis.w
      ctx.setLineDash(vis.dash); ctx.globalAlpha = 0.5
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1
    })
    // Nodes
    posRef.current.forEach((pt, id) => {
      const o  = oeuvresById.get(id)
      const cx = pt.x + NW / 2, cy = pt.y + NH / 2
      ctx.beginPath(); ctx.arc(cx, cy, NR, 0, Math.PI * 2)
      ctx.fillStyle = '#1a1a1a'; ctx.fill()
      const img = imagesRef.current.get(`${id}_100`)
             ?? imagesRef.current.get(`${id}_200`)
             ?? imagesRef.current.get(`${id}_40`)
      if (img?.complete && img.naturalWidth > 0) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, NR - 1, 0, Math.PI * 2); ctx.clip()
        drawContain(ctx, img, cx, cy, NR - 1); ctx.restore()
      }
      ctx.beginPath(); ctx.arc(cx, cy, NR - 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; ctx.stroke()
      if (o?.Titre) {
        ctx.fillStyle = '#777'; ctx.font = '8px monospace'; ctx.textAlign = 'center'
        const short = o.Titre.length > 18 ? o.Titre.slice(0, 16) + '…' : o.Titre
        ctx.fillText(short, cx, cy + NR + 12)
      }
    })
    ctx.restore()

    // A4 landscape @ 150 dpi = 1754 × 1240 physical px
    const A4W = 1754, A4H = 1240
    const tilesX = Math.ceil(off.width  / A4W)
    const tilesY = Math.ceil(off.height / A4H)

    // Build data-URLs for each tile
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

    // Open a print-ready window: one A4 landscape img per page
    const win = window.open('', '_blank')
    if (!win) { alert('Autorisez les pop-ups pour exporter en A4.'); return }
    const date = new Date().toISOString().slice(0, 10)
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Constellation ${date}</title>
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
          <img src="${url}" alt="Constellation page ${i + 1}">
          <span class="lbl">${i + 1} / ${dataUrls.length} · ${date}</span>
        </div>`).join('')}
      <script>window.onload = () => setTimeout(() => window.print(), 400)<\/script>
    </body></html>`)
    win.document.close()
  }

  // ── Save group ─────────────────────────────────────────────────
  async function handleSaveGroup() {
    const ids = [...selection]
    if (!ids.length) return
    setSaving(true)
    const nm = groupName.trim() || `Groupe ${new Date().toLocaleDateString('fr-FR')}`
    const id = await onSaveGroup(nm, ids)
    if (id) { setSavedName(nm); setGroupName(''); setTimeout(() => setSavedName(null), 3000) }
    setSaving(false)
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, height: 40, borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, overflow: 'hidden' }}>
        <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>Vue</div>
        {(['year', 'theme', 'none'] as GroupBy[]).map(g => (
          <button key={g} className="btn ghost sm"
            style={{ borderColor: groupBy === g ? 'var(--ac)' : undefined, color: groupBy === g ? 'var(--ac)' : undefined, whiteSpace: 'nowrap' }}
            onClick={() => { groupByRef.current = g; setGroupBy(g) }}
          >
            {g === 'year' ? 'Année' : g === 'theme' ? 'Thème' : 'Libre'}
          </button>
        ))}
        {groupBy === 'theme' && (
          <select
            value={selectedThemeId ?? ''}
            onChange={e => setSelectedThemeId(e.target.value ? Number(e.target.value) : null)}
            style={{ fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--ac)', color: 'var(--tx)', padding: '2px 8px', cursor: 'pointer', maxWidth: 140 }}
          >
            <option value="">Tous les thèmes ({[...themeWork.values()].reduce((a, s) => { s.forEach(id => a.add(id)); return a }, new Set()).size})</option>
            {themes.map(th => (
              <option key={th.ThemeID} value={th.ThemeID}>
                {th.Nom} ({themeWork.get(th.ThemeID)?.size ?? 0})
              </option>
            ))}
          </select>
        )}
        {/* Blank canvas mode */}
        <button className="btn ghost sm"
          style={{ borderColor: groupBy === 'custom' ? 'var(--ac)' : undefined, color: groupBy === 'custom' ? 'var(--ac)' : undefined, whiteSpace: 'nowrap' }}
          onClick={() => {
            posRef.current = new Map()
            setCustomIds(new Set())
            setPickerQ('')
            groupByRef.current = 'custom'
            setGroupBy('custom')
          }}
        >
          + Vide
        </button>

        <div className="vline" style={{ height: 16 }} />

        <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>Lien</div>
        {(Object.keys(LINK_VIS) as LinkType[]).map(lt => {
          const vis = LINK_VIS[lt]
          return (
            <button key={lt} className="btn ghost sm"
              style={{ borderColor: linkType === lt ? vis.color : undefined, color: linkType === lt ? vis.color : undefined, whiteSpace: 'nowrap' }}
              onClick={() => setLinkType(lt)}
            >
              {lt}
            </button>
          )
        })}

        <div className="vline" style={{ height: 16 }} />

        {/* Snapshots */}
        <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>Maps</div>
        {snapshots.length > 0 && (
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { handleLoadSnapshot(e.target.value); e.target.value = '' } }}
            style={{ fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '2px 6px', maxWidth: 110, cursor: 'pointer' }}
          >
            <option value="">— Charger</option>
            {snapshots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <input
          value={snapName}
          onChange={e => setSnapName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveSnapshot()}
          placeholder="Nom…"
          style={{ width: 80, fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '2px 6px' }}
        />
        <button className="btn ghost sm" onClick={handleSaveSnapshot} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
          {snapSaved ? '✓ Ok' : 'Sauv.'}
        </button>

        <div className="vline" style={{ height: 16 }} />
        <button className="btn ghost sm" onClick={handleExportPng} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
          ↓ PNG
        </button>
        <button className="btn ghost sm" onClick={handleExportTiledA4} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
          ↓ A4
        </button>

        <div className="vline" style={{ height: 16 }} />
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap', fontSize: 9 }}>
          Bord → lier · Maj+clic → sélect. · Clic droit → suppr. lien
        </div>
        {loading && <div className="pulse t-mono-sm" style={{ color: 'var(--tx3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>Chargement…</div>}
      </div>

      {/* Canvas + right panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Canvas */}
        <div ref={wrapRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg0)' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onContextMenu={onContextMenu}
          />
        </div>

        {/* Right panel */}
        <div style={{ width: 240, borderLeft: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>

          {/* Node inspector */}
          {panelNode ? (
            <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>Œuvre</div>
              <div style={{ background: 'var(--bg0)', height: 135, marginBottom: 10, overflow: 'hidden' }}>
                {panelNode.txtImageNameLink
                  ? <img src={thumbUrl(panelNode.txtImageNameLink, 384) ?? ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
                  : <div style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />
                }
              </div>
              <div style={{ fontSize: 14, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif", lineHeight: 1.2, marginBottom: 4 }}>
                {panelNode.Titre || '—'}
              </div>
              <div className="t-mono-sm">{panelNode.Année?.slice(0, 4) ?? '—'} · {(panelNode.Technique != null && tM[panelNode.Technique]) || '—'}</div>
              <button
                className={`btn ghost sm ${selection.has(panelNode.OeuvreID) ? 'primary' : ''}`}
                style={{ marginTop: 10, width: '100%', justifyContent: 'center', borderColor: selection.has(panelNode.OeuvreID) ? 'var(--ac)' : undefined, color: selection.has(panelNode.OeuvreID) ? 'var(--ac)' : undefined }}
                onClick={() => {
                  const next = new Set(selRef.current)
                  next.has(panelNode.OeuvreID) ? next.delete(panelNode.OeuvreID) : next.add(panelNode.OeuvreID)
                  setSelection(next)
                }}
              >
                {selection.has(panelNode.OeuvreID) ? '✓ Sélectionné' : '+ Sélectionner'}
              </button>
            </div>
          ) : groupBy === 'custom' ? (
            /* Custom mode: work picker */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
                <div className="t-eyebrow" style={{ marginBottom: 4 }}>Constellation vide</div>
                <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
                  {customIds.size} œuvre{customIds.size !== 1 ? 's' : ''} · {posRef.current.size} nœuds
                </div>
              </div>

              {/* Picker search */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
                <input
                  value={pickerQ}
                  onChange={e => setPickerQ(e.target.value)}
                  placeholder="Titre, technique, année…"
                  style={{ width: '100%', padding: '5px 8px', fontSize: 10, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }}
                />
                {filteredForPicker.length > 0 && (
                  <button
                    className="btn ghost sm"
                    onClick={addAllFiltered}
                    style={{ marginTop: 6, width: '100%', justifyContent: 'center', fontSize: 9 }}
                  >
                    + Tout ajouter ({Math.min(filteredForPicker.length, 120)})
                  </button>
                )}
              </div>

              {/* Available works list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                {filteredForPicker.length === 0 && (
                  <div className="t-mono-sm" style={{ padding: '10px 14px', color: 'var(--tx3)' }}>
                    {pickerQ ? 'Aucun résultat' : 'Toutes les œuvres sont dans la constellation'}
                  </div>
                )}
                {filteredForPicker.slice(0, 80).map(o => (
                  <div
                    key={o.OeuvreID}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', cursor: 'pointer' }}
                    onClick={() => addToCustom(o.OeuvreID)}
                    title="Cliquer pour ajouter"
                  >
                    {o.txtImageNameLink
                      ? <img src={thumbUrl(o.txtImageNameLink, 48) ?? ''} style={{ width: 24, height: 24, objectFit: 'cover', flexShrink: 0, borderRadius: '50%' }} alt="" />
                      : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg2)', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.Titre || `#${o.OeuvreID}`}
                      </div>
                      <div style={{ fontSize: 8, color: 'var(--tx3)' }}>
                        {o.Année?.slice(0, 4) ?? '—'} · {tM[o.Technique ?? 0] ?? '—'}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--ac)', flexShrink: 0 }}>+</span>
                  </div>
                ))}
                {filteredForPicker.length > 80 && (
                  <div className="t-mono-sm" style={{ padding: '4px 14px', color: 'var(--tx3)' }}>
                    +{filteredForPicker.length - 80} — affinez la recherche
                  </div>
                )}

                {/* Works already in canvas */}
                {customIds.size > 0 && (
                  <>
                    <div style={{ margin: '8px 10px 4px', borderTop: '1px solid var(--bd)', paddingTop: 8 }}>
                      <span className="t-label" style={{ color: 'var(--tx3)', fontSize: 8 }}>Dans la constellation</span>
                    </div>
                    {[...customIds].map(id => {
                      const o = oeuvresById.get(id)
                      if (!o) return null
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 10px' }}>
                          <div style={{ flex: 1, fontSize: 9, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.Titre || `#${id}`}
                          </div>
                          <button
                            onClick={() => removeFromCustom(id)}
                            style={{ fontSize: 9, color: 'var(--tx3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                            title="Retirer"
                          >✕</button>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
              <div className="t-eyebrow" style={{ marginBottom: 6 }}>Constellation</div>
              <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
                {groupBy === 'theme'
                  ? `${constellationOeuvres.length} œuvre${constellationOeuvres.length !== 1 ? 's' : ''}${selectedThemeId !== null ? ` · ${themes.find(t => t.ThemeID === selectedThemeId)?.Nom ?? ''}` : ' thématisées'}`
                  : `${oeuvres.length} œuvres`}
              </div>
            </div>
          )}

          {/* Selection + save */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {selection.size > 0 ? (
              <>
                <div className="t-eyebrow" style={{ marginBottom: 10 }}>Sélection · {selection.size}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                  {[...selection].slice(0, 15).map(id => {
                    const o = oeuvresById.get(id)
                    return o ? (
                      <div key={id}
                        title={`${o.Titre ?? '—'} — clic pour retirer`}
                        onClick={() => { const n = new Set(selRef.current); n.delete(id); setSelection(n) }}
                        style={{ width: 44, height: 33, background: 'var(--bg0)', border: '1px solid var(--bd)', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {o.txtImageNameLink && <img src={thumbUrl(o.txtImageNameLink, 96) ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                      </div>
                    ) : null
                  })}
                  {selection.size > 15 && <div className="t-mono-sm" style={{ color: 'var(--tx3)', alignSelf: 'center' }}>+{selection.size - 15}</div>}
                </div>

                {savedName ? (
                  <div className="t-mono-sm" style={{ color: 'var(--sage)', marginBottom: 8 }}>✓ {savedName}</div>
                ) : (
                  <div className="row gap-sm" style={{ marginBottom: 8 }}>
                    <input
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveGroup()}
                      placeholder="Nom du groupe…"
                      style={{ flex: 1, minWidth: 0, padding: '4px 8px', background: 'var(--bg0)', border: '1px solid var(--bd)', fontSize: 10, color: 'var(--tx)' }}
                    />
                    <button className="btn sm" onClick={handleSaveGroup} disabled={saving}>
                      {saving ? '…' : '+'}
                    </button>
                  </div>
                )}
                <button className="btn ghost sm" onClick={() => setSelection(new Set())}>Tout effacer</button>
              </>
            ) : (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.7 }}>
                Maj+clic pour sélectionner des œuvres et créer un groupe.
              </div>
            )}

            {/* Saved constellation maps */}
            {snapshots.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="t-eyebrow" style={{ marginBottom: 8 }}>Constellations</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {snapshots.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn ghost sm"
                        onClick={() => handleLoadSnapshot(s.id)}
                        style={{ flex: 1, justifyContent: 'flex-start', fontSize: 9, textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                        title={`${s.name} · ${s.groupBy} · ${new Date(s.savedAt).toLocaleDateString('fr-FR')}`}
                      >
                        {s.name}
                      </button>
                      <button
                        className="btn ghost sm"
                        onClick={() => handleDeleteSnapshot(s.id)}
                        style={{ fontSize: 9, padding: '2px 5px', color: 'var(--tx3)', flexShrink: 0 }}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
