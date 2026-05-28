'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { DictKey } from '@/lib/i18n/dictionary'
import {
  removeOeuvreFromCatalogTheme,
  removeOeuvreFromWorkingGroup,
} from '@/app/atelier/selection/actions'
import {
  insertConstellationRelation,
  deleteConstellationRelation,
} from '@/app/atelier/(portal)/constellation/actions'
import type { Oeuvre } from '@/lib/types/database'
import {
  NW, NH, MIN_Z, MAX_Z,
  type NodeMap, type GroupBy, type LinkType, type VP,
  type Edge, type Drag, type Shape, type Tool,
  savePos, ptSeg, hitNode, hitEdge,
} from './constellation-shared'

// ── Args ───────────────────────────────────────────────────────────────────

export interface UseConstellationPointerArgs {
  // Refs
  canvasRef:  React.MutableRefObject<HTMLCanvasElement | null>
  vpRef:      React.MutableRefObject<VP>
  posRef:     React.MutableRefObject<NodeMap>
  edgesRef:   React.MutableRefObject<Edge[]>
  dragRef:    React.MutableRefObject<Drag>
  draftRef:   React.MutableRefObject<{ from: number; toX: number; toY: number } | null>
  hovNodeRef: React.MutableRefObject<number | null>
  hovEdgeRef: React.MutableRefObject<Edge | null>
  selRef:     React.MutableRefObject<Set<number>>
  groupByRef: React.MutableRefObject<GroupBy>
  // State (values consumed inside closures)
  tool:            Tool
  drawColor:       string
  drawWidth:       number
  spacePressed:    boolean
  linkType:        LinkType
  groupBy:         GroupBy
  selectedThemeId: number | null
  selectedGroupId: string | null
  frozenEdges:     Edge[] | null
  activeShape:     Shape | null
  marquee:         { x: number; y: number; w: number; h: number } | null
  customIds:       Set<number>
  oeuvresById:     Map<number, Oeuvre>
  // Dispatchers
  setActiveShape: React.Dispatch<React.SetStateAction<Shape | null>>
  setShapes:      React.Dispatch<React.SetStateAction<Shape[]>>
  setMarquee:     React.Dispatch<React.SetStateAction<{ x: number; y: number; w: number; h: number } | null>>
  setCustomIds:   React.Dispatch<React.SetStateAction<Set<number>>>
  setPanelNode:   React.Dispatch<React.SetStateAction<Oeuvre | null>>
  setSelection:   (s: Set<number>) => void
  setTextInput:   React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  // Callbacks
  onOpen:           (o: Oeuvre) => void
  removeFromCustom: (id: number) => void
  reloadGraphData:  (force: boolean) => Promise<void>
  onDropExternal?:  (id: number, x: number, y: number) => void
  redraw:           () => void
  router:           ReturnType<typeof useRouter>
  t:                (key: DictKey) => string
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useConstellationPointer({
  canvasRef, vpRef, posRef, edgesRef, dragRef, draftRef, hovNodeRef, hovEdgeRef, selRef, groupByRef,
  tool, drawColor, drawWidth, spacePressed, linkType, groupBy,
  selectedThemeId, selectedGroupId, frozenEdges, activeShape, marquee, customIds, oeuvresById,
  setActiveShape, setShapes, setMarquee, setCustomIds, setPanelNode, setSelection, setTextInput,
  onOpen, removeFromCustom, reloadGraphData, onDropExternal,
  redraw, router, t,
}: UseConstellationPointerArgs) {

  // ── Wheel (passive: false required for preventDefault) ────────────────────
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

  // ── Mouse handlers ────────────────────────────────────────────────────────

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
      const ex = (lx - vpRef.current.x) / vpRef.current.z
      const ey = (ly - vpRef.current.y) / vpRef.current.z
      setShapes(prev => prev.filter(s => {
        if (s.type === 'line') {
          for (let i = 0; i < s.points.length - 1; i++) {
            if (ptSeg(ex, ey, s.points[i].x, s.points[i].y, s.points[i+1].x, s.points[i+1].y) < 12 / vpRef.current.z) return false
          }
          return true
        } else {
          const charW = s.size * 0.6
          const tw = s.text.length * charW
          const th = s.size
          return !(ex >= s.x - 10 && ex <= s.x + tw + 10 && ey >= s.y - th && ey <= s.y + 10)
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
      redraw()
    } else {
      const sel    = selRef.current
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
      setActiveShape({ ...activeShape, points: [activeShape.points[0], { x: wx, y: wy }] })
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
          const charW = s.size * 0.6
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
      redraw()
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
        redraw()
      }
    } else if (drag.mode === 'link') {
      draftRef.current = { from: drag.nodeId!, toX: lx, toY: ly }
      const hit   = hitNode(lx, ly, posRef.current, vpRef.current)
      const newId = hit && hit.id !== drag.nodeId ? hit.id : null
      if (newId !== hovNodeRef.current) {
        hovNodeRef.current = newId
        setPanelNode(newId ? (oeuvresById.get(newId) ?? null) : null)
      }
      redraw()
    } else {
      // Idle hover
      const hit      = hitNode(lx, ly, posRef.current, vpRef.current)
      const newHovId = hit?.id ?? null
      const newHovEd = hit ? null : hitEdge(lx, ly, frozenEdges ?? edgesRef.current, posRef.current, vpRef.current)
      let needRedraw = false

      if (newHovId !== hovNodeRef.current) {
        hovNodeRef.current = newHovId
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
        if (spacePressed)                                     c.style.cursor = 'grab'
        else if (hit?.zone === 'ring' && frozenEdges === null) c.style.cursor = 'crosshair'
        else if (hit?.zone === 'center')                      c.style.cursor = 'pointer'
        else if (newHovEd)                                    c.style.cursor = 'pointer'
        else                                                  c.style.cursor = 'grab'
      }
      if (needRedraw) redraw()
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
      redraw()
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

    // Erase shape on right-click
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
          const charW = s.size * 0.6
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
      redraw()
    })()
  }, [removeFromCustom, tool, redraw, selectedThemeId, selectedGroupId, reloadGraphData, router, oeuvresById, onOpen, t, frozenEdges])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('oeuvre_id'))
    if (!id) return

    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const wx = (lx - vpRef.current.x) / vpRef.current.z
    const wy = (ly - vpRef.current.y) / vpRef.current.z

    if (onDropExternal) {
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
    redraw()
  }, [selectedThemeId, selectedGroupId])

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const hit = hitNode(lx, ly, posRef.current, vpRef.current)
    if (hit) {
      const o = oeuvresById.get(hit.id)
      if (o) onOpen(o)
    }
  }, [oeuvresById, onOpen])

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
    handleDoubleClick,
    handleDrop,
    handleDragOver,
  }
}
