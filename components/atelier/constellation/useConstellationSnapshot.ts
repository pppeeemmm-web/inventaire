'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  listConstellationMaps,
  saveConstellationMap,
  loadConstellationMap,
  deleteConstellationMap,
  type ConstellationMapRow,
} from '@/app/atelier/(portal)/constellation/actions'
import {
  CONSTELLATION_MAP_VERSION,
  type ConstellationMapDocument,
} from '@/lib/constellation-map-document'
import type { Oeuvre } from '@/lib/types/database'
import {
  type NodeMap, type GroupBy, type VP, type Edge, type Shape, type Snapshot,
  loadSnapshots, persistSnapshots, posToObj, objToPos,
  edgeSnapshotToEdges, edgesToSnapshot,
} from './constellation-shared'

// ── Args ───────────────────────────────────────────────────────────────────

export interface UseConstellationSnapshotArgs {
  // Refs
  constellationImportPendingRef: React.MutableRefObject<ConstellationMapDocument | null>
  vpRef:      React.MutableRefObject<VP>
  posRef:     React.MutableRefObject<NodeMap>
  edgesRef:   React.MutableRefObject<Edge[]>
  groupByRef: React.MutableRefObject<GroupBy>
  // External state (read-only by this hook)
  loading:          boolean
  frozenEdges:      Edge[] | null
  activeCloudMapId: string | null
  shapes:           Shape[]
  customIds:        Set<number>
  groupBy:          GroupBy
  selectedThemeId:  number | null
  selectedGroupId:  string | null
  // External state setters
  setFrozenEdges:     React.Dispatch<React.SetStateAction<Edge[] | null>>
  setActiveCloudMapId: React.Dispatch<React.SetStateAction<string | null>>
  setShapes:          React.Dispatch<React.SetStateAction<Shape[]>>
  setGroupBy:         React.Dispatch<React.SetStateAction<GroupBy>>
  setCustomIds:       React.Dispatch<React.SetStateAction<Set<number>>>
  setSelectedThemeId: React.Dispatch<React.SetStateAction<number | null>>
  setSelectedGroupId: React.Dispatch<React.SetStateAction<string | null>>
  // Callbacks
  reloadGraphData: (force: boolean) => Promise<void>
  redraw:          () => void
}

// ── Return ─────────────────────────────────────────────────────────────────

export interface UseConstellationSnapshotReturn {
  cloudMaps:        ConstellationMapRow[]
  cloudBusy:        boolean
  cloudSaved:       boolean
  snapshots:        Snapshot[]
  snapName:         string
  setSnapName:      React.Dispatch<React.SetStateAction<string>>
  snapSaved:        boolean
  applyConstellationCloudDoc: (doc: ConstellationMapDocument, mapId: string | null) => void
  handleSaveSnapshot:   () => void
  handleLoadSnapshot:   (id: string) => void
  handleDeleteSnapshot: (id: string) => void
  handleSaveCloudMap:   () => Promise<void>
  handleLoadCloudMap:   (mapId: string) => Promise<void>
  handleDeleteCloudMap: (mapId: string) => Promise<void>
  exitFrozenLiveGraph:  () => void
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useConstellationSnapshot({
  constellationImportPendingRef, vpRef, posRef, edgesRef, groupByRef,
  loading, frozenEdges, activeCloudMapId,
  shapes, customIds, groupBy, selectedThemeId, selectedGroupId,
  setFrozenEdges, setActiveCloudMapId,
  setShapes, setGroupBy, setCustomIds, setSelectedThemeId, setSelectedGroupId,
  reloadGraphData, redraw,
}: UseConstellationSnapshotArgs): UseConstellationSnapshotReturn {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  // ── Owned state ───────────────────────────────────────────────────────────
  const [snapshots,        setSnapshots]        = useState<Snapshot[]>(loadSnapshots)
  const [snapName,         setSnapName]         = useState('')
  const [snapSaved,        setSnapSaved]        = useState(false)
  const [cloudMaps,        setCloudMaps]        = useState<ConstellationMapRow[]>([])
  const [cloudSaved,       setCloudSaved]       = useState(false)
  const [cloudBusy,        setCloudBusy]        = useState(false)

  // ── Cloud map list ────────────────────────────────────────────────────────
  const refreshCloudMaps = useCallback(async () => {
    const r = await listConstellationMaps()
    if ('ok' in r) setCloudMaps(r.maps)
    else setCloudMaps([])
  }, [])

  useEffect(() => {
    void refreshCloudMaps()
  }, [refreshCloudMaps])

  // ── Apply cloud doc ───────────────────────────────────────────────────────
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
    redraw()
  }, [constellationImportPendingRef, vpRef, setFrozenEdges, setActiveCloudMapId, setShapes, setSelectedThemeId, setSelectedGroupId, setCustomIds, setGroupBy, redraw])

  // ── URL ?map= bootstrap ───────────────────────────────────────────────────
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

  // ── Snapshot handlers ─────────────────────────────────────────────────────
  function handleSaveSnapshot() {
    const name = snapName.trim() || `${t('const_defaultSnapshotPrefix')} ${new Date().toLocaleDateString(locale)}`
    const snap: Snapshot = {
      id:        Date.now().toString(),
      name,
      groupBy:   groupByRef.current,
      positions: posToObj(posRef.current),
      shapes,
      savedAt:   new Date().toISOString(),
    }
    const updated = [snap, ...snapshots.filter(s => s.name !== name)].slice(0, 20)
    persistSnapshots(updated)
    setSnapshots(updated)
    setSnapName('')
    setSnapSaved(true)
    setTimeout(() => setSnapSaved(false), 2500)
  }

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

  function handleDeleteSnapshot(id: string) {
    const updated = snapshots.filter(s => s.id !== id)
    persistSnapshots(updated)
    setSnapshots(updated)
  }

  // ── Cloud map handlers ────────────────────────────────────────────────────
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
    redraw()
  }

  function exitFrozenLiveGraph() {
    setFrozenEdges(null)
    setActiveCloudMapId(null)
    void reloadGraphData(false)
    redraw()
  }

  return {
    cloudMaps,
    cloudBusy,
    cloudSaved,
    snapshots,
    snapName,
    setSnapName,
    snapSaved,
    applyConstellationCloudDoc,
    handleSaveSnapshot,
    handleLoadSnapshot,
    handleDeleteSnapshot,
    handleSaveCloudMap,
    handleLoadCloudMap,
    handleDeleteCloudMap,
    exitFrozenLiveGraph,
  }
}
