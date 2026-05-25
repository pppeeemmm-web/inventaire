import type { DictKey } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import type { ConstellationMapEdgeSnapshot } from '@/lib/constellation-map-document'

export type Pt = { x: number; y: number }
export type NodeMap = Map<number, Pt>

// ── Constants ──────────────────────────────────────────────────────────────
export const NW    = 80   // node bounding box width  (logical px)
export const NH    = 60   // node bounding box height 4:3
export const NR    = 30   // circle radius (= NH/2)
export const RING  = 10   // link-drag zone outside circle border (logical px)
export const MIN_Z = 0.04
export const MAX_Z = 6

/** Cap in-memory decoded thumbnails; drop stale zoom tiers per œuvre first. */
const MAX_THUMB_CACHE = 480

export function cacheConstellationThumb(
  map: Map<string, HTMLImageElement>,
  key: string,
  img: HTMLImageElement,
  oeuvreId: number,
) {
  for (const k of [...map.keys()]) {
    if (k.startsWith(`${oeuvreId}_`) && k !== key) map.delete(k)
  }
  if (map.has(key)) map.delete(key)
  map.set(key, img)
  while (map.size > MAX_THUMB_CACHE) {
    const oldest = map.keys().next().value as string | undefined
    if (!oldest) break
    map.delete(oldest)
  }
}

// ── Thumb tier: pick image resolution based on zoom level ─────────────────
export function thumbTier(z: number): 40 | 100 | 200 {
  if (z < 0.3)  return 40
  if (z < 1.5)  return 100
  return 200
}

// ── Types ──────────────────────────────────────────────────────────────────
export type GroupBy  = 'year' | 'theme' | 'workgroup' | 'none' | 'custom'
export type LinkType = 'influence' | 'proximity' | 'series' | 'diptych'

export const LINK_LABEL_KEYS: Record<LinkType, DictKey> = {
  influence: 'const_link_influence',
  proximity: 'const_link_proximity',
  series: 'const_link_series',
  diptych: 'const_link_diptych',
}

export interface VP { x: number; y: number; z: number }
export interface Edge {
  id:            string
  source:        number
  target:        number
  relation_type: string | null
  strength:      number | null
  description:   string | null
}

export function edgeSnapshotToEdges(snap: ConstellationMapEdgeSnapshot[]): Edge[] {
  return snap.map((e, i) => ({
    id:            `frozen-${i}`,
    source:        e.source_id,
    target:        e.target_id,
    relation_type: e.relation_type,
    strength:      e.strength,
    description:   e.description,
  }))
}

export function edgesToSnapshot(edges: Edge[]): ConstellationMapEdgeSnapshot[] {
  return edges.map(e => ({
    source_id:     e.source,
    target_id:     e.target,
    relation_type: e.relation_type,
    strength:      e.strength,
    description:   e.description,
  }))
}
export interface Drag {
  mode:       'idle' | 'pan' | 'node' | 'link' | 'marquee' | 'draw' | 'line' | 'erase'
  startX:     number
  startY:     number
  nodeId?:    number
  panOrigin?: Pt
  /** Multi-select: drag these ids together (subset of selection with positions). */
  moveIds?:   number[]
}

// ── Link styles ────────────────────────────────────────────────────────────
export const LINK_VIS: Record<string, { color: string; dash: number[]; w: number }> = {
  influence: { color: '#c8a86e', dash: [],      w: 2   },
  proximity: { color: '#7ab4c8', dash: [8, 5],  w: 1.5 },
  series:    { color: '#8cc87a', dash: [],       w: 2.5 },
  diptych:   { color: '#c87a9e', dash: [3, 3],  w: 2   },
}
export const LINK_DEF = { color: '#706c62', dash: [4, 6], w: 1 }

/** Draw image cover-cropped to fill a circle of radius r centred at cx,cy */
export function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  r: number,
) {
  const iw = img.naturalWidth, ih = img.naturalHeight
  if (!iw || !ih) return
  const scale = Math.max((r * 2) / iw, (r * 2) / ih)
  const dw = iw * scale, dh = ih * scale
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
}

// ── Position persistence (per groupBy mode + theme / working-group filter) ─
export const POS_KEY = (g: GroupBy, filter?: number | string | null) => {
  if (g === 'theme') return `pem_const_pos_theme_${filter ?? 'all'}`
  if (g === 'workgroup') return `pem_const_pos_wg_${filter ?? 'all'}`
  return `pem_const_pos_${g}`
}

export function loadPos(g: GroupBy, filter?: number | string | null): NodeMap | null {
  try {
    const raw = localStorage.getItem(POS_KEY(g, filter))
    if (!raw) return null
    const obj = JSON.parse(raw) as Record<string, Pt>
    const m = new Map(Object.entries(obj).map(([k, v]) => [+k, v]))
    return m.size > 0 ? m : null
  } catch { return null }
}
export function savePos(g: GroupBy, m: NodeMap, filter?: number | string | null) {
  try {
    const obj: Record<string, Pt> = {}
    m.forEach((v, k) => { obj[k] = v })
    localStorage.setItem(POS_KEY(g, filter), JSON.stringify(obj))
  } catch {}
}

/** Drop stale nodes from persisted layouts (junction changed or row already removed in DB). */
export function filterSavedToMembership(saved: NodeMap, memberOf: Set<number> | null): NodeMap | null {
  if (!memberOf) return saved
  const m = new Map<number, Pt>()
  for (const [id, pt] of saved) {
    if (memberOf.has(id)) m.set(id, pt)
  }
  return m.size > 0 ? m : null
}

// ── Named snapshots ────────────────────────────────────────────────────────
export const SNAP_KEY = 'pem_const_snapshots'
export type Shape =
  | { type: 'line'; points: Pt[]; color: string; width: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number }

export type Tool = 'move' | 'draw' | 'line' | 'text' | 'marquee' | 'erase'

export interface Snapshot {
  id: string
  name: string
  groupBy: GroupBy
  positions: Record<string, Pt>
  shapes: Shape[]
  savedAt: string
}

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY)
    if (!raw) return []
    const snaps = JSON.parse(raw) as Snapshot[]
    // Ensure back-compat for old snapshots without shapes
    return snaps.map(s => ({ ...s, shapes: s.shapes ?? [] }))
  } catch { return [] }
}
export function persistSnapshots(s: Snapshot[]) { try { localStorage.setItem(SNAP_KEY, JSON.stringify(s)) } catch {} }
export function posToObj(m: NodeMap): Record<string, Pt> { const o: Record<string, Pt> = {}; m.forEach((v, k) => { o[k] = v }); return o }
export function objToPos(o: Record<string, Pt>): NodeMap  { return new Map(Object.entries(o).map(([k, v]) => [+k, v])) }

// ── Layout algorithms ──────────────────────────────────────────────────────
export function layoutYear(oeuvres: Oeuvre[]): NodeMap {
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

export function layoutTheme(
  oeuvres:   Oeuvre[],
  themeWork: Map<number, Set<number>>,
  themes:    { id: number }[],
): NodeMap {
  // Only place works that belong to at least one of the given themes.
  // Unthemed works are intentionally excluded — use year/libre mode for them.
  const oeuvreSet = new Set(oeuvres.map(o => o.OeuvreID))
  const m         = new Map<number, Pt>()
  const placed    = new Set<number>()

  // Gather per-theme work lists (skip already-placed multi-theme works after first placement)
  const themeLists = themes.map(th => ({
    th,
    ids: [...(themeWork.get(th.id) ?? [])].filter(id => oeuvreSet.has(id)),
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

export function layoutWorkGroup(
  oeuvres:   Oeuvre[],
  groupWork: Map<string, Set<number>>,
  groups:    { id: string }[],
): NodeMap {
  const oeuvreSet = new Set(oeuvres.map(o => o.OeuvreID))
  const m         = new Map<number, Pt>()
  const placed    = new Set<number>()

  const groupLists = groups.map(g => ({
    g,
    ids: [...(groupWork.get(g.id) ?? [])].filter(id => oeuvreSet.has(id)),
  })).filter(x => x.ids.length > 0)

  if (groupLists.length === 0) return m

  if (groupLists.length === 1) {
    const ids = groupLists[0].ids
    placeCluster(ids, 700, 500, m)
    ids.forEach(id => placed.add(id))
  } else {
    const radii = groupLists.map(x => clusterOuterR(x.ids.length))
    const maxR  = Math.max(...radii)
    const N         = groupLists.length
    const minArc    = (2 * maxR + 120)
    const R_CLUSTER = Math.max(600, (minArc * N) / (2 * Math.PI))

    groupLists.forEach(({ g: _g, ids }, ti) => {
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

export function layoutGrid(oeuvres: Oeuvre[]): NodeMap {
  const m    = new Map<number, Pt>()
  const cols = Math.ceil(Math.sqrt(oeuvres.length * 1.4))
  oeuvres.forEach((o, i) => m.set(o.OeuvreID, {
    x: 60 + (i % cols) * (NW + 14),
    y: 60 + Math.floor(i / cols) * (NH + 14),
  }))
  return m
}

// ── Geometry ───────────────────────────────────────────────────────────────
export function ptSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

export function hitNode(lx: number, ly: number, pos: NodeMap, vp: VP): { id: number; zone: 'center' | 'ring' } | null {
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

export function hitEdge(lx: number, ly: number, edges: Edge[], pos: NodeMap, vp: VP): Edge | null {
  for (const e of edges) {
    const a = pos.get(e.source), b = pos.get(e.target)
    if (!a || !b) continue
    const ax = (a.x + NW / 2) * vp.z + vp.x, ay = (a.y + NH / 2) * vp.z + vp.y
    const bx = (b.x + NW / 2) * vp.z + vp.x, by = (b.y + NH / 2) * vp.z + vp.y
    if (ptSeg(lx, ly, ax, ay, bx, by) < 8) return e
  }
  return null
}

export type ThemeLinkRow = { oeuvre_id: number; theme_id: number }

export function buildThemeWorkFromRows(rows: ThemeLinkRow[]): Map<number, Set<number>> {
  const tw = new Map<number, Set<number>>()
  for (const row of rows) {
    const themeId = Number(row.theme_id)
    const oeuvreId = Number(row.oeuvre_id)
    if (!Number.isFinite(themeId) || !Number.isFinite(oeuvreId)) continue
    let set = tw.get(themeId)
    if (!set) {
      set = new Set<number>()
      tw.set(themeId, set)
    }
    set.add(oeuvreId)
  }
  return tw
}

export function buildThemeWorkFromOeuvreMap(
  oeuvreThemeIdsByOeuvre: Record<number, number[]>,
): Map<number, Set<number>> {
  const tw = new Map<number, Set<number>>()
  for (const [oeuvreKey, themeIds] of Object.entries(oeuvreThemeIdsByOeuvre)) {
    const oeuvreId = Number(oeuvreKey)
    if (!Number.isFinite(oeuvreId)) continue
    for (const rawTid of themeIds) {
      const themeId = Number(rawTid)
      if (!Number.isFinite(themeId)) continue
      let set = tw.get(themeId)
      if (!set) {
        set = new Set<number>()
        tw.set(themeId, set)
      }
      set.add(oeuvreId)
    }
  }
  return tw
}

export function mergeThemeWorkMaps(
  primary: Map<number, Set<number>>,
  secondary: Map<number, Set<number>>,
): Map<number, Set<number>> {
  if (secondary.size === 0) return primary
  if (primary.size === 0) return secondary
  const merged = new Map(primary)
  for (const [themeId, ids] of secondary) {
    const existing = merged.get(themeId)
    if (existing) {
      for (const id of ids) existing.add(id)
    } else {
      merged.set(themeId, new Set(ids))
    }
  }
  return merged
}

export function themeWorkSize(
  themeWork: Map<number, Set<number>>,
  themeId: number,
  fallback?: Record<number, number>,
): number {
  return themeWork.get(themeId)?.size ?? fallback?.[themeId] ?? 0
}

export type GroupLinkRow = { oeuvre_id: number; group_id: string }

export function buildGroupWorkFromRows(rows: GroupLinkRow[]): Map<string, Set<number>> {
  const gw = new Map<string, Set<number>>()
  for (const row of rows) {
    const groupId = String(row.group_id)
    const oeuvreId = Number(row.oeuvre_id)
    if (!groupId || !Number.isFinite(oeuvreId)) continue
    let set = gw.get(groupId)
    if (!set) {
      set = new Set<number>()
      gw.set(groupId, set)
    }
    set.add(oeuvreId)
  }
  return gw
}

export function buildGroupWorkFromOeuvreMap(
  oeuvreGroupIdsByOeuvre: Record<number, string[]>,
): Map<string, Set<number>> {
  const gw = new Map<string, Set<number>>()
  for (const [oeuvreKey, groupIds] of Object.entries(oeuvreGroupIdsByOeuvre)) {
    const oeuvreId = Number(oeuvreKey)
    if (!Number.isFinite(oeuvreId)) continue
    for (const rawGid of groupIds) {
      const groupId = String(rawGid)
      if (!groupId) continue
      let set = gw.get(groupId)
      if (!set) {
        set = new Set<number>()
        gw.set(groupId, set)
      }
      set.add(oeuvreId)
    }
  }
  return gw
}

export function mergeGroupWorkMaps(
  primary: Map<string, Set<number>>,
  secondary: Map<string, Set<number>>,
): Map<string, Set<number>> {
  if (secondary.size === 0) return primary
  if (primary.size === 0) return secondary
  const merged = new Map(primary)
  for (const [groupId, ids] of secondary) {
    const existing = merged.get(groupId)
    if (existing) {
      for (const id of ids) existing.add(id)
    } else {
      merged.set(groupId, new Set(ids))
    }
  }
  return merged
}

export function groupWorkSize(
  groupWork: Map<string, Set<number>>,
  groupId: string,
  fallback?: Record<string, number>,
): number {
  return groupWork.get(groupId)?.size ?? fallback?.[groupId] ?? 0
}
