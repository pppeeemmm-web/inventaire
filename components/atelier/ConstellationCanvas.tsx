'use client'

// ConstellationCanvas — interactive canvas for visual graph of works.
// Nodes = thumbnails. Edges = tblrelations.
// Grouped by year / theme / free. Zoom/pan. Drag-edge-to-link. Right-click edge to delete.

import { useRef, useEffect, useState, useCallback, useMemo, useId } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import {
  fetchConstellationGraphBundle,
  type ConstellationMapRow,
} from '@/app/atelier/(portal)/constellation/actions'
import {
  type ConstellationMapDocument,
} from '@/lib/constellation-map-document'
import { WorkThumb } from './WorkThumb'
import type { Oeuvre }  from '@/lib/types/database'

import {
  NW, NH,
  type Pt, type NodeMap,
  type GroupBy, type LinkType, type VP, type Edge, type Drag, type Shape, type Tool, type Snapshot,
  type ThemeLinkRow, type GroupLinkRow,
  LINK_LABEL_KEYS,
  loadPos, savePos, filterSavedToMembership,
  objToPos,
  layoutYear, layoutTheme, layoutWorkGroup, layoutGrid,
  buildThemeWorkFromRows, buildThemeWorkFromOeuvreMap, mergeThemeWorkMaps, themeWorkSize,
  buildGroupWorkFromRows, buildGroupWorkFromOeuvreMap, mergeGroupWorkMaps, groupWorkSize,
} from './constellation/constellation-shared'
export type { Pt, NodeMap } from './constellation/constellation-shared'
import { ConstellationToolbar } from './constellation/ConstellationToolbar'
import { ConstellationToolRail } from './constellation/ConstellationToolRail'
import { ConstellationSidePanel } from './constellation/ConstellationSidePanel'
import { ConstellationShortcutsPanel } from './constellation/ConstellationShortcutsPanel'
import { useConstellationCanvasRedraw } from './constellation/useConstellationCanvasRedraw'
import { useConstellationPointer } from './constellation/useConstellationPointer'
import { useConstellationSnapshot } from './constellation/useConstellationSnapshot'
import { handleExportPng, handleExportTiledA4 } from './constellation/constellation-export'


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
  /** Frozen edge layer from a loaded cloud map; null = use live tblrelations. */
  const [frozenEdges,      setFrozenEdges]      = useState<Edge[] | null>(null)
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

  const redraw = useConstellationCanvasRedraw({
    canvasRef,
    wrapRef,
    vpRef,
    posRef,
    selRef,
    hovNodeRef,
    hovEdgeRef,
    draftRef,
    edgesRef,
    imagesRef,
    bgImgRef,
    bgLoaded,
    backgroundOpacity,
    groupBy,
    linkType,
    oeuvres,
    themes,
    groups,
    effectiveThemeWork,
    effectiveGroupWork,
    oeuvresById,
    selectedThemeId,
    selectedGroupId,
    shapes,
    activeShape,
    marquee,
    frozenEdges,
  })
  
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

  // ── Snapshot + cloud map hook ─────────────────────────────────
  const {
    cloudMaps, cloudBusy, cloudSaved,
    snapshots, snapName, setSnapName, snapSaved,
    applyConstellationCloudDoc,
    handleSaveSnapshot, handleLoadSnapshot, handleDeleteSnapshot,
    handleSaveCloudMap, handleLoadCloudMap, handleDeleteCloudMap,
    exitFrozenLiveGraph,
  } = useConstellationSnapshot({
    constellationImportPendingRef, vpRef, posRef, edgesRef, groupByRef,
    loading, frozenEdges, activeCloudMapId,
    shapes, customIds, groupBy, selectedThemeId, selectedGroupId,
    setFrozenEdges, setActiveCloudMapId,
    setShapes, setGroupBy, setCustomIds, setSelectedThemeId, setSelectedGroupId,
    reloadGraphData, redraw,
  })

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

  // ── removeFromCustom (defined here so pointer hook can reference it) ────
  function removeFromCustom(id: number) {
    const next = new Map(posRef.current)
    next.delete(id)
    posRef.current = next
    setCustomIds(prev => { const n = new Set(prev); n.delete(id); return n })
    if (selRef.current.has(id)) {
      const sel = new Set(selRef.current); sel.delete(id); setSelection(sel)
    }
    redraw()
  }

  // ── Pointer hook ───────────────────────────────────────────────
  const {
    onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onContextMenu,
    handleDoubleClick, handleDrop, handleDragOver,
  } = useConstellationPointer({
    canvasRef, vpRef, posRef, edgesRef, dragRef, draftRef, hovNodeRef, hovEdgeRef, selRef, groupByRef,
    tool, drawColor, drawWidth, spacePressed, linkType, groupBy,
    selectedThemeId, selectedGroupId, frozenEdges, activeShape, marquee, customIds, oeuvresById,
    setActiveShape, setShapes, setMarquee, setCustomIds, setPanelNode, setSelection, setTextInput,
    onOpen, removeFromCustom, reloadGraphData, onDropExternal,
    redraw, router, t,
  })

  // ── Resize + space key ────────────────────────────────────────
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
  const exportDeps = useMemo(() => ({
    posRef,
    edgesRef,
    frozenEdges,
    shapes,
    oeuvresById,
    imagesRef,
    t,
    setSaving,
  }), [frozenEdges, shapes, oeuvresById, t])

  const onExportPng = useCallback(
    () => handleExportPng(exportDeps),
    [exportDeps],
  )
  const onExportTiledA4 = useCallback(
    () => handleExportTiledA4(exportDeps),
    [exportDeps],
  )

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
        handleExportPng={onExportPng}
        handleExportTiledA4={onExportTiledA4}
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
          <ConstellationShortcutsPanel
            ref={shortcutsPanelRef}
            panelId={shortcutsPanelId}
            t={t}
          />
        )}
      </div>
    </div>
  )
}
