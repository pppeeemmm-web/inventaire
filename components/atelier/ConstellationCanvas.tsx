'use client'

// ConstellationCanvas — interactive canvas for visual graph of works.
// Nodes = thumbnails. Edges = tblrelations.
// Grouped by year / theme / free. Zoom/pan. Drag-edge-to-link. Right-click edge to delete.

import { useRef, useEffect, useState, useCallback, useMemo, useId } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { imageUrl, thumbUrl } from '@/lib/data'
import {
  removeOeuvreFromCatalogTheme,
  removeOeuvreFromWorkingGroup,
} from '@/app/atelier/selection/actions'
import {
  fetchConstellationGraphBundle,
  insertConstellationRelation,
  deleteConstellationRelation,
  listConstellationMaps,
  saveConstellationMap,
  loadConstellationMap,
  deleteConstellationMap,
  type ConstellationMapRow,
} from '@/app/atelier/(portal)/constellation/actions'
import {
  CONSTELLATION_MAP_VERSION,
  type ConstellationMapDocument,
  type ConstellationMapEdgeSnapshot,
} from '@/lib/constellation-map-document'
import { WorkThumb } from './WorkThumb'
import type { Oeuvre }  from '@/lib/types/database'

import {
  NW, NH, NR, RING, MIN_Z, MAX_Z,
  cacheConstellationThumb, thumbTier,
  type Pt, type NodeMap,
  type GroupBy, type LinkType, type VP, type Edge, type Drag, type Shape, type Tool, type Snapshot,
  type ThemeLinkRow, type GroupLinkRow,
  LINK_LABEL_KEYS, LINK_VIS, LINK_DEF,
  loadPos, savePos, filterSavedToMembership,
  loadSnapshots, persistSnapshots, posToObj, objToPos,
  layoutYear, layoutTheme, layoutWorkGroup, layoutGrid,
  ptSeg, hitNode, hitEdge,
  buildThemeWorkFromRows, buildThemeWorkFromOeuvreMap, mergeThemeWorkMaps, themeWorkSize,
  buildGroupWorkFromRows, buildGroupWorkFromOeuvreMap, mergeGroupWorkMaps, groupWorkSize,
  edgeSnapshotToEdges, edgesToSnapshot,
} from './constellation/constellation-shared'
export type { Pt, NodeMap } from './constellation/constellation-shared'
import { ConstellationToolbar } from './constellation/ConstellationToolbar'
import { ConstellationToolRail } from './constellation/ConstellationToolRail'
import { ConstellationSidePanel } from './constellation/ConstellationSidePanel'


// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  oeuvres:      Oeuvre[]
  tM:           Record<number, string>
  themes:       { id: number; name: string }[]
  /** Hydrated junction counts — fallback when graph bundle is empty or still loading. */
  themeWorkCount?: Record<number, number>
  oeuvreThemeIdsByOeuvre?: Record<number, number[]>
  groups?:      { id: string; name: string }[]
  groupWorkCount?: Record<string, number>
  oeuvreGroupIdsByOeuvre?: Record<number, string[]>
  selection:    Set<number>
  setSelection: (s: Set<number>) => void
  onOpen:       (o: Oeuvre) => void
  onSaveGroup:  (name: string, ids: number[]) => Promise<string | null>
  
  // Background floorplan integration
  backgroundImage?:     string
  backgroundOpacity?:   number
  onBackgroundOpacity?: (opacity: number) => void
  onDropExternal?:      (id: number, x: number, y: number) => void
  hideToolbar?:         boolean
  initialPositions?:    NodeMap
}

// ── Component ──────────────────────────────────────────────────────────────
export function ConstellationCanvas({ 
  oeuvres, tM, themes, themeWorkCount, oeuvreThemeIdsByOeuvre,
  groups = [], groupWorkCount, oeuvreGroupIdsByOeuvre,
  selection, setSelection, onOpen, onSaveGroup,
  backgroundImage, backgroundOpacity = 1, onBackgroundOpacity, onDropExternal, hideToolbar, initialPositions
}: Props) {
  const router = useRouter()
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  const initialGroupBy = useMemo<GroupBy>(() => {
    try {
      const raw = localStorage.getItem('pem_const_groupBy') as GroupBy | null
      if (raw === 'year' || raw === 'theme' || raw === 'workgroup' || raw === 'none' || raw === 'custom') return raw
    } catch {}
    // Default: open Constellation scoped (fast) instead of full.
    return 'theme'
  }, [])

  const initialThemeId = useMemo<number | null>(() => {
    try {
      const raw = localStorage.getItem('pem_const_selectedThemeId')
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    } catch {
      return null
    }
  }, [])

  // Refs for stale-closure-safe event handlers
  const vpRef       = useRef<VP>({ x: 40, y: 40, z: 1 })
  const posRef      = useRef<NodeMap>(new Map())
  const edgesRef    = useRef<Edge[]>([])
  /** When set, layout effect applies this document once (avoids overwriting cloud positions). */
  const constellationImportPendingRef = useRef<ConstellationMapDocument | null>(null)
  const hovNodeRef  = useRef<number | null>(null)
  const hovEdgeRef  = useRef<Edge | null>(null)
  const dragRef     = useRef<Drag>({ mode: 'idle', startX: 0, startY: 0 })
  const draftRef    = useRef<{ from: number; toX: number; toY: number } | null>(null)
  // keyed by `${oeuvreId}_${tier}` so each zoom tier has its own cache entry
  const imagesRef   = useRef<Map<string, HTMLImageElement>>(new Map())
  const selRef      = useRef(selection)
  const groupByRef  = useRef<GroupBy>(initialGroupBy)
  useEffect(() => { selRef.current = selection }, [selection])
  // React state
  const [tick,      setTick]      = useState(0)
  const [groupBy,   setGroupBy]   = useState<GroupBy>(initialGroupBy)
  const [linkType,  setLinkType]  = useState<LinkType>('influence')
  const [loading,   setLoading]   = useState(true)
  const [tool,      setTool]      = useState<Tool>('move')
  const [shapes,    setShapes]    = useState<Shape[]>([])
  const [marquee,   setMarquee]   = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [themeWork, setThemeWork] = useState<Map<number, Set<number>>>(new Map())
  const effectiveThemeWork = useMemo(() => {
    const fromOeuvres =
      oeuvreThemeIdsByOeuvre && Object.keys(oeuvreThemeIdsByOeuvre).length > 0
        ? buildThemeWorkFromOeuvreMap(oeuvreThemeIdsByOeuvre)
        : new Map<number, Set<number>>()
    return mergeThemeWorkMaps(themeWork, fromOeuvres)
  }, [themeWork, oeuvreThemeIdsByOeuvre])
  const themesInDropdown = useMemo(
    () => themes.filter((th) => themeWorkSize(effectiveThemeWork, th.id, themeWorkCount) > 0),
    [themes, effectiveThemeWork, themeWorkCount],
  )
  const [panelNode, setPanelNode] = useState<Oeuvre | null>(null)
  const [groupName,  setGroupName]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [activeShape, setActiveShape] = useState<Shape | null>(null)
  const [drawColor,   setDrawColor]   = useState('#c8a86e')
  const [drawWidth,   setDrawWidth]   = useState(2)
  const [textInput,   setTextInput]   = useState<{ x: number, y: number } | null>(null)
  const [textVal,     setTextVal]     = useState('')
  const [savedName,  setSavedName]  = useState<string | null>(null)
  const [snapshots,  setSnapshots]  = useState<Snapshot[]>(loadSnapshots)
  const [snapName,   setSnapName]   = useState('')
  const [snapSaved,  setSnapSaved]  = useState(false)
  const [cloudMaps,  setCloudMaps]  = useState<ConstellationMapRow[]>([])
  const [cloudSaved, setCloudSaved] = useState(false)
  const [cloudBusy,  setCloudBusy]  = useState(false)
  /** Frozen edge layer from a loaded cloud map (not DB); null = use live tblrelations. */
  const [frozenEdges, setFrozenEdges] = useState<Edge[] | null>(null)
  const [activeCloudMapId, setActiveCloudMapId] = useState<string | null>(null)
  // Custom (blank canvas) mode
  const [customIds,        setCustomIds]        = useState<Set<number>>(new Set())
  const [pickerQ,          setPickerQ]          = useState('')
  const [spacePressed, setSpacePressed] = useState(false)
  // Theme mode: optional single-theme filter
  const [selectedThemeId,  setSelectedThemeId]  = useState<number | null>(
    initialGroupBy === 'theme' ? initialThemeId : null,
  )
  const [selectedGroupId,   setSelectedGroupId]  = useState<string | null>(null)
  const [groupWork,         setGroupWork]         = useState<Map<string, Set<number>>>(new Map())
  const effectiveGroupWork = useMemo(() => {
    const fromOeuvres =
      oeuvreGroupIdsByOeuvre && Object.keys(oeuvreGroupIdsByOeuvre).length > 0
        ? buildGroupWorkFromOeuvreMap(oeuvreGroupIdsByOeuvre)
        : new Map<string, Set<number>>()
    return mergeGroupWorkMaps(groupWork, fromOeuvres)
  }, [groupWork, oeuvreGroupIdsByOeuvre])
  const groupsInDropdown = useMemo(
    () => groups.filter((gr) => groupWorkSize(effectiveGroupWork, gr.id, groupWorkCount) > 0),
    [groups, effectiveGroupWork, groupWorkCount],
  )
  const [toolShortcutsOpen, setToolShortcutsOpen] = useState(false)
  const shortcutsPanelId = useId()
  const shortcutsPanelRef = useRef<HTMLDivElement>(null)
  const toolRailRef = useRef<HTMLDivElement>(null)

  const redraw = useCallback(() => setTick(t => t + 1), [])
  const toolbarTools = useMemo(
    () =>
      [
        { id: 'move' as const, l: '🖐️', tipKey: 'const_tool_move' as const },
        { id: 'marquee' as const, l: '⬛', tipKey: 'const_tool_marquee' as const },
        { id: 'draw' as const, l: '✏️', tipKey: 'const_tool_draw' as const },
        { id: 'line' as const, l: '📏', tipKey: 'const_tool_line' as const },
        { id: 'text' as const, l: 'T', tipKey: 'const_tool_text' as const },
        { id: 'erase' as const, l: '🧹', tipKey: 'const_tool_erase' as const },
      ] as const,
    [lang],
  )
  const oeuvresById = useMemo(() => new Map(oeuvres.map(o => [o.OeuvreID, o])), [oeuvres])

  useEffect(() => {
    if (!toolShortcutsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolShortcutsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toolShortcutsOpen])

  useEffect(() => {
    if (!toolShortcutsOpen) return
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node
      if (toolRailRef.current?.contains(node)) return
      if (shortcutsPanelRef.current?.contains(node)) return
      setToolShortcutsOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [toolShortcutsOpen])

  // Background image ref
  const bgImgRef = useRef<HTMLImageElement | null>(null)
  const [bgLoaded, setBgLoaded] = useState(false)
  
  useEffect(() => {
    if (initialPositions) {
      posRef.current = new Map(initialPositions)
      setCustomIds(new Set(initialPositions.keys()))
      setGroupBy('custom')
      groupByRef.current = 'custom'
      redraw()
    }
  }, [initialPositions, redraw])

  useEffect(() => {
    if (!backgroundImage) {
      bgImgRef.current = null
      setBgLoaded(false)
      redraw()
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      bgImgRef.current = img
      setBgLoaded(true)
      redraw()
    }
    img.src = backgroundImage
  }, [backgroundImage, redraw])

  // Reset filters when switching vue mode; hide preview panel in theme/workgroup modes.
  useEffect(() => {
    if (groupBy !== 'theme') setSelectedThemeId(null)
    if (groupBy !== 'workgroup') setSelectedGroupId(null)
    if (groupBy === 'theme' || groupBy === 'workgroup') setPanelNode(null)
  }, [groupBy])

  // Persist the last view mode + selected theme (helps open “scoped” next time).
  useEffect(() => {
    try { localStorage.setItem('pem_const_groupBy', groupBy) } catch {}
    groupByRef.current = groupBy
  }, [groupBy])
  useEffect(() => {
    if (groupBy !== 'theme') return
    try {
      if (selectedThemeId == null) localStorage.removeItem('pem_const_selectedThemeId')
      else localStorage.setItem('pem_const_selectedThemeId', String(selectedThemeId))
    } catch {}
  }, [groupBy, selectedThemeId])

  // If we open in theme mode with no theme selected, restore the last one if it still exists.
  useEffect(() => {
    if (groupBy !== 'theme') return
    if (selectedThemeId != null) return
    if (initialThemeId == null) return
    if (!themes.some((t) => t.id === initialThemeId)) return
    if (themeWorkSize(effectiveThemeWork, initialThemeId, themeWorkCount) === 0) return
    setSelectedThemeId(initialThemeId)
  }, [groupBy, selectedThemeId, initialThemeId, themes, effectiveThemeWork, themeWorkCount])

  // Theme mode requires a scoped pick — auto-select first theme with works when none saved.
  useEffect(() => {
    if (loading || groupBy !== 'theme' || selectedThemeId != null) return
    if (initialThemeId != null && themes.some((t) => t.id === initialThemeId)) return
    const first = themesInDropdown[0]
    if (first) setSelectedThemeId(first.id)
  }, [loading, groupBy, selectedThemeId, initialThemeId, themes, themesInDropdown])

  // Workgroup mode requires a scoped pick — auto-select first group with works when none saved.
  useEffect(() => {
    if (loading || groupBy !== 'workgroup' || selectedGroupId != null) return
    const first = groupsInDropdown[0]
    if (first) setSelectedGroupId(first.id)
  }, [loading, groupBy, selectedGroupId, groupsInDropdown])

  useEffect(() => {
    // Clear the old monolithic theme cache key (before filter-aware keys were introduced).
    try { localStorage.removeItem('pem_const_pos_theme') } catch {}

    // ── Curation Trigger: handle transition from Inventory dock ──
    const trigger = sessionStorage.getItem('pem_curation_trigger')
    if (trigger === 'true') {
      sessionStorage.removeItem('pem_curation_trigger')
      const selIds = Array.from(selection)
      if (selIds.length > 0) {
        setGroupBy('custom')
        groupByRef.current = 'custom'
        setCustomIds(new Set(selIds))
        
        // Layout selection in a clean grid at the center
        const selectedOeuvres = selIds.map(id => oeuvresById.get(id)).filter(Boolean) as Oeuvre[]
        const m = layoutGrid(selectedOeuvres)
        // Center the grid
        const canvas = canvasRef.current
        if (canvas) {
          const cx = canvas.offsetWidth / 2, cy = canvas.offsetHeight / 2
          m.forEach(p => { p.x += cx - 300; p.y += cy - 200 })
        }
        posRef.current = m
        redraw()
      }
    }
  }, [selection, oeuvresById, redraw])

  // Theme / working-group vue: only works in the selected catalog theme or working group
  const constellationOeuvres = useMemo(() => {
    if (groupBy === 'theme') {
      if (selectedThemeId === null) return []
      const ids = effectiveThemeWork.get(selectedThemeId) ?? new Set<number>()
      return oeuvres.filter(o => ids.has(o.OeuvreID))
    }
    if (groupBy === 'workgroup') {
      if (selectedGroupId === null) return []
      const ids = effectiveGroupWork.get(selectedGroupId) ?? new Set<number>()
      return oeuvres.filter(o => ids.has(o.OeuvreID))
    }
    return oeuvres
  }, [groupBy, oeuvres, effectiveThemeWork, effectiveGroupWork, selectedThemeId, selectedGroupId])

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

  // ── Graph + junction data (reload after theme/group removal so UI matches DB) ─
  const reloadGraphData = useCallback(async (completeInitialLoad = false) => {
    const result = await fetchConstellationGraphBundle()
    if ('error' in result) {
      console.warn('[constellation] reloadGraphData', result.error)
      if (completeInitialLoad) setLoading(false)
      redraw()
      return
    }
    const { relations: rels, entities: _graphEntities, oeuvreThemes: ot, workingGroupWork: wg } = result.bundle
    void _graphEntities // hydrated for future multi-type layout; canvas still oeuvre–oeuvre positions

    edgesRef.current = (rels ?? [])
      .filter((r) => r.source_id != null && r.target_id != null)
      .map((r) => ({
        id: r.id,
        source: r.source_id!,
        target: r.target_id!,
        relation_type: r.relation_type,
        strength: r.strength,
        description: r.description,
      }))

    setThemeWork(buildThemeWorkFromRows((ot ?? []) as ThemeLinkRow[]))
    setGroupWork(buildGroupWorkFromRows((wg ?? []) as GroupLinkRow[]))

    if (completeInitialLoad) setLoading(false)
    redraw()
  }, [redraw])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reloadGraphData(true)
      if (cancelled) return
    })()
    return () => { cancelled = true }
  }, [reloadGraphData])

  const refreshCloudMaps = useCallback(async () => {
    const r = await listConstellationMaps()
    if ('ok' in r) setCloudMaps(r.maps)
    else setCloudMaps([])
  }, [])

  useEffect(() => {
    void refreshCloudMaps()
  }, [refreshCloudMaps])

  const applyConstellationCloudDoc = useCallback((doc: ConstellationMapDocument, mapId: string | null) => {
    constellationImportPendingRef.current = doc
    setFrozenEdges(edgeSnapshotToEdges(doc.edgesSnapshot))
    setShapes(doc.shapes)
    setSelectedThemeId(doc.selectedThemeId)
    setSelectedGroupId(doc.selectedGroupId)
    setCustomIds(new Set(doc.customWorkIds))
    vpRef.current = { ...doc.viewport }
    setActiveCloudMapId(mapId)
    setGroupBy(doc.groupBy)
    setTick(t => t + 1)
  }, [])

  const mapUrlBootstrappedRef = useRef(false)
  useEffect(() => {
    if (loading || mapUrlBootstrappedRef.current) return
    if (typeof window === 'undefined') return
    const id = new URLSearchParams(window.location.search).get('map')
    if (!id) return
    mapUrlBootstrappedRef.current = true
    void (async () => {
      setCloudBusy(true)
      const r = await loadConstellationMap(id)
      setCloudBusy(false)
      if ('error' in r) {
        mapUrlBootstrappedRef.current = false
        alert(r.error)
        return
      }
      applyConstellationCloudDoc(r.document, id)
      const p = new URLSearchParams(window.location.search)
      p.delete('map')
      const qs = p.toString()
      window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    })()
  }, [loading, applyConstellationCloudDoc])

  // ── Layout ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    const pending = constellationImportPendingRef.current
    if (pending) {
      constellationImportPendingRef.current = null
      groupByRef.current = pending.groupBy
      posRef.current = objToPos(pending.positions)
      redraw()
      return
    }
    groupByRef.current = groupBy
    if (groupBy === 'custom') {
      // Custom mode: positions are managed by addToCustom/removeFromCustom.
      // Don't auto-layout — just redraw with whatever is in posRef.
      redraw()
      return
    }

    if (groupBy === 'theme') {
      const savedRaw = loadPos('theme', selectedThemeId)
      const allowed =
        selectedThemeId !== null ? (effectiveThemeWork.get(selectedThemeId) ?? new Set<number>()) : null
      const saved =
        savedRaw && selectedThemeId !== null
          ? filterSavedToMembership(savedRaw, allowed)
          : savedRaw
      if (saved && saved.size > 0) {
        posRef.current = saved
      } else {
        const activeThemes = selectedThemeId !== null
          ? themes.filter(t => t.id === selectedThemeId)
          : themes
        posRef.current = layoutTheme(constellationOeuvres, effectiveThemeWork, activeThemes)
      }
    } else if (groupBy === 'workgroup') {
      const savedRaw = loadPos('workgroup', selectedGroupId)
      const allowed =
        selectedGroupId !== null ? (effectiveGroupWork.get(selectedGroupId) ?? new Set<number>()) : null
      const saved =
        savedRaw && selectedGroupId !== null
          ? filterSavedToMembership(savedRaw, allowed)
          : savedRaw
      if (saved && saved.size > 0) {
        posRef.current = saved
      } else {
        const activeGroups = selectedGroupId !== null
          ? groups.filter(g => g.id === selectedGroupId)
          : groups
        posRef.current = layoutWorkGroup(constellationOeuvres, effectiveGroupWork, activeGroups)
      }
    } else {
      const saved = loadPos(groupBy)
      if (saved) {
        posRef.current = saved
        // Incremental add: if new works are in oeuvres but not in saved pos, 
        // we should ideally add them. For now, if we detect MANY missing works,
        // or specifically if the user is in 'year' mode and a year is missing, we might re-layout.
        const missingCount = oeuvres.filter(o => !saved.has(o.OeuvreID)).length
        if (missingCount > 0 && (missingCount > 10 || saved.size < 5)) {
          // Automatic re-layout if significant changes detected
          if (groupBy === 'year') posRef.current = layoutYear(oeuvres)
          else                    posRef.current = layoutGrid(oeuvres)
        }
      } else {
        // Only auto-layout if posRef is actually empty for the current view
        const currentCount = Array.from(posRef.current.keys()).filter(id => oeuvresById.has(id)).length
        if (currentCount < oeuvres.length) {
           if (groupBy === 'year') posRef.current = layoutYear(oeuvres)
           else                    posRef.current = layoutGrid(oeuvres)
        }
      }
    }
    redraw()
  }, [groupBy, loading, constellationOeuvres, themes, groups, effectiveThemeWork, effectiveGroupWork, selectedThemeId, selectedGroupId, redraw, oeuvresById, oeuvres])

  // ── Visible image loading (zoom-adaptive tiers) ───────────────
  const loadingSet = useRef(new Set<string>())
  function loadVisible() {
    const c = canvasRef.current
    if (!c) return
    const vp   = vpRef.current
    const tier = thumbTier(vp.z)
    const m    = (NR + RING) * 2
    const x0   = (-vp.x - m) / vp.z, x1 = (c.offsetWidth  - vp.x + m) / vp.z
    const y0   = (-vp.y - m) / vp.z, y1 = (c.offsetHeight - vp.y + m) / vp.z

    // Limit concurrent new requests to avoid browser bottleneck
    let requestsStarted = 0
    const MAX_BATCH = 20

    for (const [id, p] of posRef.current) {
      if (requestsStarted >= MAX_BATCH) break

      const ncx = p.x + NW / 2, ncy = p.y + NH / 2
      if (ncx + NR < x0 || ncx - NR > x1 || ncy + NR < y0 || ncy - NR > y1) continue
      
      const o = oeuvresById.get(id)
      if (!o?.txtImageNameLink) continue

      const key = `${id}_${tier}`
      // If we don't have THIS specific tier and aren't already fetching it
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
          // If thumbnail fails, try to load the full image as a fallback
          const fullUrl = imageUrl(o.txtImageNameLink!)
          if (fullUrl && img.src !== fullUrl) {
            // Note: we don't use loadingSet for full image fallback to keep it simple
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
    // Computed inline so they stay in sync with the themes array order.
    const themeColors = new Map<number, string>(
      (themes || []).map((th, i) => [th.id, `hsl(${Math.round((i / Math.max(1, (themes?.length || 1))) * 300 + 20)}, 55%, 62%)`])
    )
    // Map each work to its first-listed theme (for border colouring)
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
      // Step 1: compute ideal positions and sizes for each theme label
      const maxCount = Math.max(1, ...themes.map(th =>
        [...(effectiveThemeWork.get(th.id) ?? [])].filter(id => pos.has(id)).length
      ))

      interface LBox {
        th:       { id: number; name: string }
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
        const ids = [...(effectiveThemeWork.get(th.id) ?? [])].filter(id => pos.has(id))
        if (!ids.length) continue
        const pts   = ids.map(id => pos.get(id)!)
        const cx    = pts.reduce((a, p) => a + p.x + NW / 2, 0) / pts.length
        const minY  = Math.min(...pts.map(p => p.y))
        const count = ids.length

        // Font size scales with theme size (8–14 logical px, adjusted for zoom)
        const t   = Math.sqrt(count / maxCount)   // 0..1, sqrt for perceptual scaling
        const fs  = (8 + 7 * t) / vp.z
        ctx.font  = `${fs}px "Sofia Sans", sans-serif`
        const tw  = ctx.measureText(th.name).width
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
          color: themeColors.get(th.id) ?? 'rgba(166,163,151,0.8)',
          alpha: selectedThemeId === null || selectedThemeId === th.id ? 1 : 0.22,
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
      // Best available cached image: prefer current tier, fall back to others
      const img  = imagesRef.current.get(`${id}_${tier}`)
                ?? imagesRef.current.get(`${id}_100`)
                ?? imagesRef.current.get(`${id}_200`)
                ?? imagesRef.current.get(`${id}_40`)
      const isSel = sel.has(id)
      const isHov = id === hovNode
      const cx    = p.x + NW / 2
      const cy    = p.y + NH / 2

      // Catalogue theme / working-group colour for this node's border
      const primThemeId = workPrimaryTheme.get(id)
      const primGroupId = workPrimaryGroup.get(id)
      let themeC = '#26262a'
      if (groupBy === 'theme' && primThemeId != null) {
        themeC = themeColors.get(primThemeId) ?? '#26262a'
      } else if (groupBy === 'workgroup' && primGroupId != null) {
        themeC = groupColors.get(primGroupId) ?? '#26262a'
      }

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

      // Thumbnail (draw if loaded, else fallback to initials)
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

      // Non-public indicator: amber dot with ! at top-right of circle
      if ((o as any).anonymity_level === 2) {
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

      // Small label below node
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
 
    loadVisible()
  }, [tick, groupBy, linkType, oeuvres, themes, groups, effectiveThemeWork, effectiveGroupWork, oeuvresById, selectedThemeId, selectedGroupId, shapes, activeShape, marquee, frozenEdges])

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

    const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') setSpacePressed(true) }
    const onKeyUp   = (e: KeyboardEvent) => { if (e.code === 'Space') setSpacePressed(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)

    return () => {
      obs.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [redraw])

  // ── Helpers ───────────────────────────────────────────────────
  function local(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { lx: e.clientX - rect.left, ly: e.clientY - rect.top }
  }

  // ── Mouse handlers ─────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const wx = (lx - vpRef.current.x) / vpRef.current.z
    const wy = (ly - vpRef.current.y) / vpRef.current.z
    const hit = hitNode(lx, ly, posRef.current, vpRef.current)

    if (spacePressed) {
      dragRef.current = { mode: 'pan', startX: lx, startY: ly, panOrigin: { x: vpRef.current.x, y: vpRef.current.y } }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      return
    }

    if (tool === 'draw') {
      dragRef.current = { mode: 'draw', startX: lx, startY: ly }
      setActiveShape({ type: 'line', points: [{ x: wx, y: wy }], color: drawColor, width: drawWidth / vpRef.current.z })
      return
    }

    if (tool === 'line') {
      dragRef.current = { mode: 'line', startX: lx, startY: ly }
      setActiveShape({ type: 'line', points: [{ x: wx, y: wy }, { x: wx, y: wy }], color: drawColor, width: drawWidth / vpRef.current.z })
      return
    }

    if (tool === 'text') {
      setTextInput({ x: wx, y: wy })
      return
    }

    if (tool === 'marquee') {
      dragRef.current = { mode: 'marquee', startX: lx, startY: ly }
      setMarquee({ x: lx, y: ly, w: 0, h: 0 })
      return
    }
 
    if (tool === 'erase') {
      dragRef.current = { mode: 'erase', startX: lx, startY: ly }
      // Immediate erase on click
      const wx = (lx - vpRef.current.x) / vpRef.current.z
      const wy = (ly - vpRef.current.y) / vpRef.current.z
      setShapes(prev => prev.filter(s => {
        if (s.type === 'line') {
          for (let i = 0; i < s.points.length - 1; i++) {
            if (ptSeg(wx, wy, s.points[i].x, s.points[i].y, s.points[i+1].x, s.points[i+1].y) < 12 / vpRef.current.z) return false
          }
          return true
        } else {
          // Better text hit detection: assume 12px width per char approx, check box
          const charW = (s.size * 0.6)
          const tw = s.text.length * charW
          const th = s.size
          return !(wx >= s.x - 10 && wx <= s.x + tw + 10 && wy >= s.y - th && wy <= s.y + 10)
        }
      }))
      redraw()
      return
    }

    if (!hit) {
      dragRef.current = { mode: 'pan', startX: lx, startY: ly, panOrigin: { x: vpRef.current.x, y: vpRef.current.y } }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    } else if (hit.zone === 'ring' && frozenEdges === null) {
      dragRef.current  = { mode: 'link', startX: lx, startY: ly, nodeId: hit.id }
      draftRef.current = { from: hit.id, toX: lx, toY: ly }
      if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
      setTick(t => t + 1)
    } else {
      const sel = selRef.current
      const moveIds =
        sel.size > 1 && sel.has(hit.id)
          ? [...sel].filter(id => posRef.current.has(id))
          : undefined
      dragRef.current = { mode: 'node', startX: lx, startY: ly, nodeId: hit.id, moveIds }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    }
  }, [tool, drawColor, drawWidth, spacePressed, frozenEdges])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const drag = dragRef.current
    const vp   = vpRef.current

    if (drag.mode === 'draw' && activeShape?.type === 'line') {
      const wx = (lx - vp.x) / vp.z
      const wy = (ly - vp.y) / vp.z
      setActiveShape({ ...activeShape, points: [...activeShape.points, { x: wx, y: wy }] })
      redraw()
      return
    }

    if (drag.mode === 'line' && activeShape?.type === 'line') {
      const wx = (lx - vp.x) / vp.z
      const wy = (ly - vp.y) / vp.z
      const pts = [activeShape.points[0], { x: wx, y: wy }]
      setActiveShape({ ...activeShape, points: pts })
      redraw()
      return
    }

    if (drag.mode === 'marquee') {
      setMarquee({ x: drag.startX, y: drag.startY, w: lx - drag.startX, h: ly - drag.startY })
      redraw()
      return
    }
 
    if (drag.mode === 'erase') {
      const wx = (lx - vp.x) / vp.z
      const wy = (ly - vp.y) / vp.z
      setShapes(prev => prev.filter(s => {
        if (s.type === 'line') {
          for (let i = 0; i < s.points.length - 1; i++) {
            if (ptSeg(wx, wy, s.points[i].x, s.points[i].y, s.points[i+1].x, s.points[i+1].y) < 12 / vp.z) return false
          }
          return true
        } else {
          const charW = (s.size * 0.6)
          const tw = s.text.length * charW
          const th = s.size
          return !(wx >= s.x - 10 && wx <= s.x + tw + 10 && wy >= s.y - th && wy <= s.y + 10)
        }
      }))
      redraw()
      return
    }

    if (drag.mode === 'pan') {
      vpRef.current = { ...vp, x: drag.panOrigin!.x + (lx - drag.startX), y: drag.panOrigin!.y + (ly - drag.startY) }
      setTick(t => t + 1)
    } else if (drag.mode === 'node') {
      const dx = (lx - drag.startX) / vp.z
      const dy = (ly - drag.startY) / vp.z
      const ids = drag.moveIds?.length ? drag.moveIds : [drag.nodeId!]
      const next = new Map(posRef.current)
      let moved = false
      for (const id of ids) {
        const cur = next.get(id)
        if (cur) {
          next.set(id, { x: cur.x + dx, y: cur.y + dy })
          moved = true
        }
      }
      if (moved) {
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
      const newHovEd = hit ? null : hitEdge(lx, ly, frozenEdges ?? edgesRef.current, posRef.current, vpRef.current)
      let needRedraw = false

      if (newHovId !== hovNodeRef.current) {
        hovNodeRef.current = newHovId
        // In theme mode, suppress the preview panel — user just wants to rearrange
        if (groupBy !== 'theme' && groupBy !== 'workgroup') {
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
        if (spacePressed)            c.style.cursor = 'grab'
        else if (hit?.zone === 'ring' && frozenEdges === null) c.style.cursor = 'crosshair'
        else if (hit?.zone === 'center') c.style.cursor = 'pointer'
        else if (newHovEd)          c.style.cursor = 'pointer'
        else                        c.style.cursor = 'grab'
      }
      if (needRedraw) setTick(t => t + 1)
    }
  }, [oeuvresById, spacePressed, activeShape, groupBy, redraw, frozenEdges])

  const onMouseUp = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const drag = dragRef.current

    if ((drag.mode === 'draw' || drag.mode === 'line') && activeShape) {
      setShapes(prev => [...prev, activeShape])
      setActiveShape(null)
    } else if (drag.mode === 'marquee' && marquee) {
      // Logic for selecting nodes in rect
      const x0 = (Math.min(marquee.x, marquee.x + marquee.w) - vpRef.current.x) / vpRef.current.z
      const x1 = (Math.max(marquee.x, marquee.x + marquee.w) - vpRef.current.x) / vpRef.current.z
      const y0 = (Math.min(marquee.y, marquee.y + marquee.h) - vpRef.current.y) / vpRef.current.z
      const y1 = (Math.max(marquee.y, marquee.y + marquee.h) - vpRef.current.y) / vpRef.current.z
      
      const next = e.shiftKey ? new Set(selRef.current) : new Set<number>()
      posRef.current.forEach((p, id) => {
        const cx = p.x + NW / 2, cy = p.y + NH / 2
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) next.add(id)
      })
      setSelection(next)
      setMarquee(null)
    } else if (drag.mode === 'link') {
      draftRef.current   = null
      hovNodeRef.current = null
      const hit = hitNode(lx, ly, posRef.current, vpRef.current)
      if (hit && hit.id !== drag.nodeId) {
        const ins = await insertConstellationRelation({
          source_id: drag.nodeId!,
          target_id: hit.id,
          relation_type: linkType,
        })
        if ('error' in ins) {
          console.warn('[constellation] insert relation', ins.error)
        } else {
          const data = ins.row
          edgesRef.current = [...edgesRef.current, {
            id: data.id, source: data.source_id!, target: data.target_id!,
            relation_type: data.relation_type, strength: data.strength, description: data.description,
          }]
        }
      }
      setPanelNode(null)
      setTick(t => t + 1)
    } else if (drag.mode === 'node') {
      savePos(
        groupByRef.current,
        posRef.current,
        groupByRef.current === 'theme'
          ? selectedThemeId
          : groupByRef.current === 'workgroup'
            ? selectedGroupId
            : undefined,
      )
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
            setPanelNode(o || null)
          }
        } else {
          setPanelNode(null)
        }
      }
    }

    dragRef.current = { mode: 'idle', startX: 0, startY: 0 }
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }, [linkType, oeuvresById, onOpen, setSelection, groupBy, selectedThemeId, selectedGroupId, activeShape, marquee])

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top

    // Check if we hit a node first — right-click / Ctrl+right-click target works only (not toolbar).
    const nodeHit = hitNode(lx, ly, posRef.current, vpRef.current)
    if (nodeHit) {
      const oeuvre = oeuvresById.get(nodeHit.id)
      const ctrl = e.ctrlKey || e.metaKey
      const gb = groupByRef.current

      if (ctrl && oeuvre) {
        onOpen(oeuvre)
        return
      }

      if (gb === 'custom') {
        removeFromCustom(nodeHit.id)
      } else if (gb === 'theme' && selectedThemeId) {
        if (confirm(t('const_confirmRemoveTheme'))) {
          void (async () => {
            const res = await removeOeuvreFromCatalogTheme(nodeHit.id, selectedThemeId)
            if ('error' in res) {
              alert(res.error)
              return
            }
            await reloadGraphData(false)
            router.refresh()
            const next = new Map(posRef.current)
            next.delete(nodeHit.id)
            posRef.current = next
            redraw()
          })()
        }
      } else if (gb === 'workgroup' && selectedGroupId) {
        if (confirm(t('const_confirmRemoveWorkgroup'))) {
          void (async () => {
            const res = await removeOeuvreFromWorkingGroup(nodeHit.id, selectedGroupId)
            if ('error' in res) {
              alert(res.error)
              return
            }
            await reloadGraphData(false)
            router.refresh()
            const next = new Map(posRef.current)
            next.delete(nodeHit.id)
            posRef.current = next
            redraw()
          })()
        }
      } else if (oeuvre) {
        onOpen(oeuvre)
      }
      return
    }

    // Check if hit a shape
    if (tool === 'erase') {
      const wx = (lx - vpRef.current.x) / vpRef.current.z
      const wy = (ly - vpRef.current.y) / vpRef.current.z
      setShapes(prev => prev.filter(s => {
        if (s.type === 'line') {
          for (let i = 0; i < s.points.length - 1; i++) {
            if (ptSeg(wx, wy, s.points[i].x, s.points[i].y, s.points[i+1].x, s.points[i+1].y) < 12 / vpRef.current.z) return false
          }
          return true
        } else {
          const charW = (s.size * 0.6)
          const tw = s.text.length * charW
          const th = s.size
          return !(wx >= s.x - 10 && wx <= s.x + tw + 10 && wy >= s.y - th && wy <= s.y + 10)
        }
      }))
      redraw()
      return
    }

    const edge = frozenEdges === null
      ? hitEdge(lx, ly, edgesRef.current, posRef.current, vpRef.current)
      : null
    if (!edge) return
    void (async () => {
      const res = await deleteConstellationRelation(edge.id)
      if ('error' in res) {
        console.warn('[constellation] delete edge', res.error)
        return
      }
      edgesRef.current = edgesRef.current.filter(e2 => e2.id !== edge.id)
      if (hovEdgeRef.current === edge) hovEdgeRef.current = null
      setTick(t => t + 1)
    })()
  }, [removeFromCustom, tool, redraw, selectedThemeId, selectedGroupId, reloadGraphData, router, oeuvresById, onOpen, t, frozenEdges])

  // ── Drag and Drop (Exhibition Floorplan integration) ──────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('oeuvre_id'))
    if (!id) return

    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const wx = (lx - vpRef.current.x) / vpRef.current.z
    const wy = (ly - vpRef.current.y) / vpRef.current.z

    if (onDropExternal) {
      // Pass coordinates that center the node on the drop point
      onDropExternal(id, wx - NW / 2, wy - NH / 2)
    } else if (groupBy === 'custom') {
      if (!posRef.current.has(id)) {
        const next = new Map(posRef.current)
        next.set(id, { x: wx - NW / 2, y: wy - NH / 2 })
        posRef.current = next
        setCustomIds(prev => new Set([...prev, id]))
        redraw()
      }
    }
  }, [onDropExternal, groupBy, redraw])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onMouseLeave = useCallback(() => {
    if (dragRef.current.mode === 'node') {
      savePos(
        groupByRef.current,
        posRef.current,
        groupByRef.current === 'theme'
          ? selectedThemeId
          : groupByRef.current === 'workgroup'
            ? selectedGroupId
            : undefined,
      )
    }
    draftRef.current   = null
    hovNodeRef.current = null
    hovEdgeRef.current = null
    dragRef.current    = { mode: 'idle', startX: 0, startY: 0 }
    setPanelNode(null)
    setTick(t => t + 1)
  }, [selectedThemeId, selectedGroupId])

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

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const hit = hitNode(lx, ly, posRef.current, vpRef.current)
    if (hit) {
      const o = oeuvresById.get(hit.id)
      if (o) onOpen(o)
    }
  }, [oeuvresById, onOpen])

  // ── Snapshot: save current layout ──────────────────────────────
  function handleSaveSnapshot() {
    const name = snapName.trim() || `${t('const_defaultSnapshotPrefix')} ${new Date().toLocaleDateString(locale)}`
    const snap: Snapshot = {
      id:        Date.now().toString(),
      name,
      groupBy:   groupByRef.current,
      positions: posToObj(posRef.current),
      shapes:    shapes,
      savedAt:   new Date().toISOString(),
    }
    const updated = [snap, ...snapshots.filter(s => s.name !== name)].slice(0, 20)
    persistSnapshots(updated)
    setSnapshots(updated)
    setSnapName('')
    setSnapSaved(true)
    setTimeout(() => setSnapSaved(false), 2500)
  }

  function handleResetLayout() {
    if (!confirm(t('const_resetLayoutConfirm'))) return
    if (groupBy === 'year')  posRef.current = layoutYear(oeuvres)
    else if (groupBy === 'none') posRef.current = layoutGrid(oeuvres)
    else if (groupBy === 'theme') {
      const activeThemes = selectedThemeId !== null ? themes.filter(t => t.id === selectedThemeId) : themes
      posRef.current = layoutTheme(constellationOeuvres, effectiveThemeWork, activeThemes)
    } else if (groupBy === 'workgroup') {
      const activeGroups = selectedGroupId !== null ? groups.filter(g => g.id === selectedGroupId) : groups
      posRef.current = layoutWorkGroup(constellationOeuvres, effectiveGroupWork, activeGroups)
    }
    savePos(
      groupBy,
      posRef.current,
      groupBy === 'theme' ? selectedThemeId : groupBy === 'workgroup' ? selectedGroupId : undefined,
    )
    redraw()
  }

  function handleFitView() {
    const canvas = canvasRef.current
    if (!canvas || posRef.current.size === 0) return
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    posRef.current.forEach(({ x, y }) => {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x + NW > maxX) maxX = x + NW
      if (y + NH > maxY) maxY = y + NH
    })
    
    const w = canvas.offsetWidth, h = canvas.offsetHeight
    const bw = maxX - minX, bh = maxY - minY
    const PAD = 80
    const scale = Math.min(6, Math.max(0.05, Math.min((w - PAD) / bw, (h - PAD) / bh)))
    
    vpRef.current = {
      x: (w / 2) - (minX + bw / 2) * scale,
      y: (h / 2) - (minY + bh / 2) * scale,
      z: scale
    }
    redraw()
  }

  // ── Snapshot: load ──────────────────────────────────────────────
  function handleLoadSnapshot(id: string) {
    const snap = snapshots.find(s => s.id === id)
    if (!snap) return
    setFrozenEdges(null)
    setActiveCloudMapId(null)
    groupByRef.current = snap.groupBy
    posRef.current = objToPos(snap.positions)
    setShapes(snap.shapes || [])
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

  async function handleSaveCloudMap() {
    const title = snapName.trim() || `${t('const_defaultSnapshotPrefix')} ${new Date().toLocaleDateString(locale)}`
    setCloudBusy(true)
    const doc: ConstellationMapDocument = {
      version: CONSTELLATION_MAP_VERSION,
      groupBy,
      selectedThemeId,
      selectedGroupId,
      customWorkIds: [...customIds],
      positions: posToObj(posRef.current),
      shapes,
      edgesSnapshot: edgesToSnapshot(frozenEdges ?? edgesRef.current),
      viewport: { ...vpRef.current },
    }
    const r = await saveConstellationMap(title, doc)
    setCloudBusy(false)
    if ('error' in r) {
      alert(r.error)
      return
    }
    await refreshCloudMaps()
    setSnapName('')
    setCloudSaved(true)
    setTimeout(() => setCloudSaved(false), 2500)
  }

  async function handleLoadCloudMap(mapId: string) {
    setCloudBusy(true)
    const r = await loadConstellationMap(mapId)
    setCloudBusy(false)
    if ('error' in r) {
      alert(r.error)
      return
    }
    applyConstellationCloudDoc(r.document, mapId)
  }

  async function handleDeleteCloudMap(mapId: string) {
    if (!confirm(t('const_cloudDeleteConfirm'))) return
    setCloudBusy(true)
    const res = await deleteConstellationMap(mapId)
    setCloudBusy(false)
    if ('error' in res) {
      alert(t('const_cloudErrGeneric'))
      return
    }
    if (activeCloudMapId === mapId) {
      setFrozenEdges(null)
      setActiveCloudMapId(null)
      await reloadGraphData(false)
    }
    await refreshCloudMaps()
    setTick(t => t + 1)
  }

  function exitFrozenLiveGraph() {
    setFrozenEdges(null)
    setActiveCloudMapId(null)
    void reloadGraphData(false)
    setTick(t => t + 1)
  }

  function handleAddText() {
    if (!textInput || !textVal.trim()) { setTextInput(null); setTextVal(''); return }
    setShapes(prev => [...prev, {
      type: 'text',
      x: textInput.x,
      y: textInput.y,
      text: textVal.trim(),
      color: drawColor,
      size: 16 / vpRef.current.z,
    }])
    setTextInput(null)
    setTextVal('')
  }
  function waitImg(id: number, tier: number): Promise<HTMLImageElement | null> {
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

  // ── Export full canvas as PNG ───────────────────────────────────
  async function handleExportPng() {
    if (posRef.current.size === 0) return
    setSaving(true) // reuse saving state for feedback

    // Ensure all visible nodes have their tier-100 images loaded
    await Promise.all(Array.from(posRef.current.keys()).map(id => waitImg(id, 100)))

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
    // Draw nodes (top-left corner FIS pt.x, pt.y; center FIS pt.x+NW/2, pt.y+NH/2)
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

    // Draw shapes
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
    // Download
    const a = document.createElement('a')
    a.href     = off.toDataURL('image/png')
    a.download = `constellation-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
    setSaving(false)
  }
  
  // ── Export: tiled A4 print window ──────────────────────────────
  async function handleExportTiledA4() {
    if (posRef.current.size === 0) return
    setSaving(true)
    
    // Ensure all visible nodes have their tier-100 images loaded
    await Promise.all(Array.from(posRef.current.keys()).map(id => waitImg(id, 100)))

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
    const edgesExportA4 = frozenEdges ?? edgesRef.current
    edgesExportA4.forEach(e => {
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

    // Draw shapes
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

  // ── Save group ─────────────────────────────────────────────────
  async function handleSaveGroup() {
    const ids = [...selection]
    if (!ids.length) return
    setSaving(true)
    const nm = groupName.trim() || `${t('const_defaultGroupNamePrefix')} ${new Date().toLocaleDateString(locale)}`
    const id = await onSaveGroup(nm, ids)
    if (id) { setSavedName(nm); setGroupName(''); setTimeout(() => setSavedName(null), 3000) }
    setSaving(false)
  }

  async function handleSaveAllAsGroup() {
    const ids = Array.from(posRef.current.keys())
    if (!ids.length) return
    setSaving(true)
    const nm = groupName.trim() || `${t('constellation')} ${new Date().toLocaleDateString(locale)}`
    const id = await onSaveGroup(nm, ids)
    if (id) { setSavedName(nm); setGroupName(''); setTimeout(() => setSavedName(null), 3000) }
    setSaving(false)
  }

  if (hideToolbar) {
    return (
      <div ref={wrapRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg0)' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onContextMenu={onContextMenu}
          onDoubleClick={handleDoubleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

      {/* Toolbar */}
      <ConstellationToolbar
        t={t}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        groupByRef={groupByRef}
        linkType={linkType}
        setLinkType={setLinkType}
        selectedThemeId={selectedThemeId}
        setSelectedThemeId={setSelectedThemeId}
        effectiveThemeWork={effectiveThemeWork}
        themesInDropdown={themesInDropdown}
        themeWorkCount={themeWorkCount}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        effectiveGroupWork={effectiveGroupWork}
        groupsInDropdown={groupsInDropdown}
        groupWorkCount={groupWorkCount}
        posRef={posRef}
        setCustomIds={setCustomIds}
        setPickerQ={setPickerQ}
        snapshots={snapshots}
        snapName={snapName}
        setSnapName={setSnapName}
        snapSaved={snapSaved}
        handleSaveSnapshot={handleSaveSnapshot}
        handleLoadSnapshot={handleLoadSnapshot}
        cloudMaps={cloudMaps}
        cloudBusy={cloudBusy}
        cloudSaved={cloudSaved}
        frozenEdges={frozenEdges}
        handleLoadCloudMap={handleLoadCloudMap}
        handleSaveCloudMap={handleSaveCloudMap}
        exitFrozenLiveGraph={exitFrozenLiveGraph}
        handleResetLayout={handleResetLayout}
        handleFitView={handleFitView}
        handleExportPng={handleExportPng}
        handleExportTiledA4={handleExportTiledA4}
        backgroundImage={backgroundImage}
        backgroundOpacity={backgroundOpacity}
        onBackgroundOpacity={onBackgroundOpacity}
        loading={loading}
      />

      {/* Canvas + tool rail + right panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        <ConstellationToolRail
          t={t}
          toolRailRef={toolRailRef}
          toolbarTools={toolbarTools}
          tool={tool}
          setTool={setTool}
          drawColor={drawColor}
          setDrawColor={setDrawColor}
          drawWidth={drawWidth}
          setDrawWidth={setDrawWidth}
          shapes={shapes}
          setShapes={setShapes}
          toolShortcutsOpen={toolShortcutsOpen}
          setToolShortcutsOpen={setToolShortcutsOpen}
          shortcutsPanelId={shortcutsPanelId}
        />

        <div ref={wrapRef} style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--bg0)',
          paddingTop: frozenEdges !== null ? 44 : 0,
        }}>
          {frozenEdges !== null && (
            <div
              role="status"
              data-testid="constellation-frozen-banner"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                zIndex: 5,
                padding: '6px 10px',
                fontSize: 10,
                lineHeight: 1.35,
                color: 'var(--tx)',
                background: 'rgba(200,168,110,0.12)',
                borderBottom: '1px solid var(--bd)',
                pointerEvents: 'none',
              }}
            >
              {t('const_cloudFreezeBanner')}
            </div>
          )}
          <canvas
            ref={canvasRef}
            style={{ 
              display: 'block', width: '100%', height: '100%', 
              cursor: tool === 'move' ? 'grab' : tool === 'text' ? 'text' : (tool === 'draw' || tool === 'line') ? 'crosshair' : 'crosshair'
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onContextMenu={onContextMenu}
            onDoubleClick={handleDoubleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />

          {/* Text Input Overlay */}
          {textInput && (
            <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: 'var(--bg1)', padding: 20, border: '1px solid var(--bd)', width: 300 }}>
                <div className="t-eyebrow" style={{ marginBottom: 12 }}>{t('const_textModalTitle')}</div>
                <input
                  autoFocus
                  className="input"
                  value={textVal}
                  onChange={e => setTextVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddText(); if (e.key === 'Escape') setTextInput(null) }}
                  placeholder={t('const_textModalPlaceholder')}
                  style={{ width: '100%', marginBottom: 12 }}
                />
                <div className="row gap-sm j-end">
                  <button className="btn ghost sm" onClick={() => setTextInput(null)}>{t('cancel')}</button>
                  <button className="btn sm" onClick={handleAddText}>{t('const_textAdd')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Theme / working-group filter prompt */}
          {groupBy === 'theme' && selectedThemeId === null && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', background: 'var(--bg1)', padding: '10px 20px', border: '1px solid var(--bd)', borderRadius: 2 }}>
                {t('const_pickThemeToolbar')}
              </div>
            </div>
          )}
          {groupBy === 'workgroup' && selectedGroupId === null && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', background: 'var(--bg1)', padding: '10px 20px', border: '1px solid var(--bd)', borderRadius: 2 }}>
                {t('const_pickGroupToolbar')}
              </div>
            </div>
          )}
        </div>

        <ConstellationSidePanel
          t={t}
          locale={locale}
          panelNode={panelNode}
          groupBy={groupBy}
          selectedThemeId={selectedThemeId}
          selectedGroupId={selectedGroupId}
          selection={selection}
          setSelection={setSelection}
          selRef={selRef}
          tM={tM}
          removeFromCustom={removeFromCustom}
          customIds={customIds}
          posRef={posRef}
          pickerQ={pickerQ}
          setPickerQ={setPickerQ}
          filteredForPicker={filteredForPicker}
          addAllFiltered={addAllFiltered}
          addToCustom={addToCustom}
          constellationOeuvres={constellationOeuvres}
          themes={themes}
          groups={groups}
          oeuvres={oeuvres}
          oeuvresById={oeuvresById}
          groupName={groupName}
          setGroupName={setGroupName}
          savedName={savedName}
          saving={saving}
          handleSaveGroup={handleSaveGroup}
          handleSaveAllAsGroup={handleSaveAllAsGroup}
          snapshots={snapshots}
          handleLoadSnapshot={handleLoadSnapshot}
          handleDeleteSnapshot={handleDeleteSnapshot}
          cloudMaps={cloudMaps}
          cloudBusy={cloudBusy}
          handleLoadCloudMap={handleLoadCloudMap}
          handleDeleteCloudMap={handleDeleteCloudMap}
        />
        {toolShortcutsOpen && (
          <div
            ref={shortcutsPanelRef}
            id={shortcutsPanelId}
            role="region"
            aria-label={t('const_toolbarShortcutsPanelTitle')}
            className="t-mono-sm"
            style={{
              position: 'absolute',
              left: 56,
              top: 8,
              zIndex: 30,
              maxWidth: 'min(300px, calc(100vw - 80px))',
              padding: '10px 12px',
              background: 'var(--bg1)',
              border: '1px solid var(--bd)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              fontSize: 10,
              lineHeight: 1.5,
              color: 'var(--tx2)',
            }}
          >
            {t('const_toolbar_hint')}
          </div>
        )}
      </div>
    </div>
  )
}
