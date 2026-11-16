'use client'

import { useCallback, useRef, useState } from 'react'
import {
  insertConstellationRelation,
  deleteConstellationRelation,
} from '@/app/atelier/(portal)/constellation/actions'
import type { Edge, NodeMap, Pt, Shape } from './constellation-shared'

// TODO 20: undo / redo for drawings, text, moves and links.
// Links live in the DB: undoing a link made here deletes it with the same action the eraser uses;
// undoing a deletion makes it again with the same insert action (new id, same ends / type / strength / note).

export type HistoryEntry =
  | { kind: 'shapes'; before: Shape[]; after: Shape[] }
  | { kind: 'move'; before: [number, Pt][]; after: [number, Pt][] }
  | { kind: 'linkAdd'; edge: Edge }
  | { kind: 'linkDelete'; edge: Edge }

const MAX_HISTORY = 100

type Args = {
  setShapes: (s: Shape[]) => void
  posRef: React.MutableRefObject<NodeMap>
  edgesRef: React.MutableRefObject<Edge[]>
  hovEdgeRef: React.MutableRefObject<Edge | null>
  /** Persist works moved back by undo/redo (local layout, or the floor plan's own view). */
  persistMoves: (moves: { id: number; x: number; y: number }[]) => void
  redraw: () => void
}

export function useConstellationHistory({ setShapes, posRef, edgesRef, hovEdgeRef, persistMoves, redraw }: Args) {
  const undoRef = useRef<HistoryEntry[]>([])
  const redoRef = useRef<HistoryEntry[]>([])
  const busyRef = useRef(false)
  const [counts, setCounts] = useState({ undo: 0, redo: 0 })
  const sync = useCallback(() => {
    setCounts({ undo: undoRef.current.length, redo: redoRef.current.length })
  }, [])

  const push = useCallback((e: HistoryEntry) => {
    undoRef.current.push(e)
    if (undoRef.current.length > MAX_HISTORY) undoRef.current.shift()
    redoRef.current = []
    sync()
  }, [sync])

  const clear = useCallback(() => {
    undoRef.current = []
    redoRef.current = []
    sync()
  }, [sync])

  /** Moves belong to one view (year / theme / group…): drop them when the view changes. */
  const dropMoves = useCallback(() => {
    undoRef.current = undoRef.current.filter(e => e.kind !== 'move')
    redoRef.current = redoRef.current.filter(e => e.kind !== 'move')
    sync()
  }, [sync])

  const apply = useCallback(async (e: HistoryEntry, dir: 'undo' | 'redo'): Promise<boolean> => {
    if (e.kind === 'shapes') {
      setShapes(dir === 'undo' ? e.before : e.after)
      return true
    }
    if (e.kind === 'move') {
      const pts = dir === 'undo' ? e.before : e.after
      const next = new Map(posRef.current)
      const moved: { id: number; x: number; y: number }[] = []
      for (const [id, p] of pts) {
        if (!next.has(id)) continue // work no longer on the canvas
        next.set(id, { x: p.x, y: p.y })
        moved.push({ id, x: p.x, y: p.y })
      }
      posRef.current = next
      if (moved.length) persistMoves(moved)
      redraw()
      return true
    }
    const remove = (e.kind === 'linkAdd') === (dir === 'undo')
    const edge = e.edge
    if (remove) {
      const res = await deleteConstellationRelation(edge.id)
      if ('error' in res) {
        console.warn('[constellation] undo: delete link', res.error)
        return false
      }
      edgesRef.current = edgesRef.current.filter(e2 => e2.id !== edge.id)
      if (hovEdgeRef.current?.id === edge.id) hovEdgeRef.current = null
    } else {
      const ins = await insertConstellationRelation({
        source_id: edge.source,
        target_id: edge.target,
        relation_type: edge.relation_type,
        strength: edge.strength,
        description: edge.description,
      })
      if ('error' in ins) {
        console.warn('[constellation] undo: recreate link', ins.error)
        return false
      }
      const oldId = edge.id
      const newId = ins.row.id
      // Every entry naming this link follows it to its new id.
      for (const h of [...undoRef.current, ...redoRef.current]) {
        if ((h.kind === 'linkAdd' || h.kind === 'linkDelete') && h.edge.id === oldId) h.edge.id = newId
      }
      edge.id = newId
      edgesRef.current = [...edgesRef.current.filter(e2 => e2.id !== newId), edge]
    }
    redraw()
    return true
  }, [setShapes, posRef, edgesRef, hovEdgeRef, persistMoves, redraw])

  const step = useCallback(async (dir: 'undo' | 'redo') => {
    if (busyRef.current) return
    const from = dir === 'undo' ? undoRef : redoRef
    const to = dir === 'undo' ? redoRef : undoRef
    const e = from.current[from.current.length - 1]
    if (!e) return
    busyRef.current = true
    try {
      const ok = await apply(e, dir)
      if (ok) {
        from.current.pop()
        to.current.push(e)
      }
    } finally {
      busyRef.current = false
      sync()
    }
  }, [apply, sync])

  const undo = useCallback(() => step('undo'), [step])
  const redo = useCallback(() => step('redo'), [step])

  return { push, clear, dropMoves, undo, redo, canUndo: counts.undo > 0, canRedo: counts.redo > 0 }
}
