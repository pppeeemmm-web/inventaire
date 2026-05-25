'use client'

import { listWorkDrawerImages } from '@/app/atelier/works/actions'
import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import type { MutableRefObject } from 'react'
import type { Oeuvre } from '@/lib/types/database'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { DrawerContent } from './work-drawer/DrawerContent'

/* ──────────────────────────────────────────────────────────────────
   WorkDrawer — unified detail panel.
   mode='panel'   → inline flex panel (Inventory Aperçu)
   mode='overlay'  → fixed right-rail overlay (TeamPortalClient)
   ────────────────────────────────────────────────────────────────── */

interface Props {
  o:               Oeuvre | null
  tM:              Record<number, string>
  sM:              Record<number, string>
  cM:              Record<number, string>
  pM:              Record<number, string>
  fM?:             Record<number, string>
  locMap?:         Record<number, string>
  statusLabelMap:  Record<number, string>
  selection:       Set<number>
  setSelection?:   (s: Set<number>) => void
  toggleInSel?:    (id: number) => void
  onClose:         () => void
  onEdit?:         (o: Oeuvre) => void
  thM:             Record<number, string>
  oeuvreThemeMap:  Map<number, number[]>
  oeuvreGroupMap:  Map<number, string[]>
  groupNameMap:    Record<string, string>
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  themes:         { id:          number; name:      string }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  groups:         { id: string; name: string }[]
  presentations:  { PresentationID: number; Nom: string | null }[]
  mode?:          'panel' | 'overlay'
  expanded?:      boolean
  setExpanded?:   (b: boolean) => void
  guardApiRef?: MutableRefObject<{
    isDirty: () => boolean
    performSave: () => Promise<boolean>
  }>
  onDrawerDirtyChange?: (dirty: boolean) => void
  /** Enables admin-only controls inside the editor (field sessions, etc.). */
  isAdmin?: boolean
  /** Keep theme/group junction client maps in sync after saveWork. */
  onJunctionSaved?: (oeuvreId: number, themeIds: number[], groupIds: string[]) => void
  /** Patch catalogue row + open work after committed save (e.g. anonymity_level). */
  onWorkSaved?: (oeuvreId: number, patch: Partial<Oeuvre>) => void
  /** Remove soft-deleted work(s) from client catalogue immediately. */
  onOeuvreRemoved?: (oeuvreIds: number[]) => void
}

/** Parent can call `runGuarded(() => …)` before changing the open work (e.g. list click) so unsaved edits prompt first. */
export type WorkDrawerGuardHandle = {
  runGuarded: (fn: () => void) => void
  isDirty: () => boolean
  performSave: () => Promise<boolean>
}

export const WorkDrawer = forwardRef<WorkDrawerGuardHandle, Props>(function WorkDrawer({
  o, tM, sM, cM, pM, fM, locMap, statusLabelMap, selection, setSelection, toggleInSel, onClose, onEdit,
  thM, oeuvreThemeMap, oeuvreGroupMap, groupNameMap,
  techniques: initialTechniques, supports: initialSupports, formats: initialFormats,
  themes: initialThemes, contacts: initialContacts, groups: initialGroups,
  presentations: initialPresentations,
  mode = 'overlay', expanded: expandedProp = false, setExpanded: setExpandedProp,
  guardApiRef: guardApiRefProp,
  onDrawerDirtyChange,
  isAdmin = false,
  onJunctionSaved,
  onWorkSaved,
  onOeuvreRemoved,
}, ref) {
  const isPanel = mode === 'panel'
  const narrow = useMediaQuery('(max-width: 767px)')

  const closeAttemptRef = useRef<(() => void) | null>(null)

  const internalGuardApiRef = useRef({
    isDirty: () => false,
    performSave: async () => true as boolean,
  })
  const guardApiRef = guardApiRefProp ?? internalGuardApiRef

  const runGuardedSlot = useRef<(fn: () => void) => void>((fn) => { fn() })
  useImperativeHandle(ref, () => ({
    runGuarded: (fn) => runGuardedSlot.current(fn),
    isDirty: () => guardApiRef.current.isDirty(),
    performSave: () => guardApiRef.current.performSave(),
  }), [guardApiRef])

  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => { panelRef.current?.scrollTo(0, 0) }, [o?.OeuvreID])

  const [imgZoom, setImgZoom] = useState(1)
  const [imgPan, setImgPan] = useState({ x: 0, y: 0 })
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [workImages, setWorkImages] = useState<{ ImageID: number; txtImageNameLink: string | null; SeqNo: number | null }[]>([])
  const [activeImgIdx, setActiveImgIdx] = useState(-1)
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const zoomTargetRef = useRef(1)
  const zoomCurrentRef = useRef(1)
  const wheelRafId = useRef<number | null>(null)

  useEffect(() => {
    zoomTargetRef.current = 1
    zoomCurrentRef.current = 1
    if (wheelRafId.current != null) {
      cancelAnimationFrame(wheelRafId.current)
      wheelRafId.current = null
    }
    setImgZoom(1)
    setImgPan({ x: 0, y: 0 })
    setNaturalSize(null)
    setWorkImages([])
    setActiveImgIdx(-1)
    if (!o?.OeuvreID) return
    const id = o.OeuvreID
    let cancelled = false
    void listWorkDrawerImages(id).then((rows) => {
      if (cancelled) return
      if (rows.length > 0) {
        setWorkImages(rows)
        setActiveImgIdx(rows.length - 1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [o?.OeuvreID])

  useEffect(() => {
    zoomCurrentRef.current = imgZoom
    if (imgZoom <= 1) zoomTargetRef.current = 1
  }, [imgZoom])

  useLayoutEffect(() => {
    const el = imgContainerRef.current
    if (!el) return

    const normDy = (e: WheelEvent) => {
      let d = e.deltaY
      if (e.deltaMode === 1) d *= 16
      else if (e.deltaMode === 2) d *= 800
      return d
    }

    const chaseZoom = () => {
      wheelRafId.current = null
      const z = zoomCurrentRef.current
      const t = zoomTargetRef.current
      const eps = 0.0012
      if (Math.abs(t - z) < eps) return

      const maxStep = z < 1.02 ? 0.021 : 0.065
      const next = Math.min(2, Math.max(1, z + Math.sign(t - z) * Math.min(Math.abs(t - z), maxStep)))
      zoomCurrentRef.current = next
      setImgZoom(next)
      if (next <= 1) setImgPan({ x: 0, y: 0 })
      if (Math.abs(t - next) >= eps) {
        wheelRafId.current = requestAnimationFrame(chaseZoom)
      }
    }

    const scheduleChase = () => {
      if (wheelRafId.current == null) wheelRafId.current = requestAnimationFrame(chaseZoom)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const sens = 0.00105
      zoomTargetRef.current = Math.min(2, Math.max(1, zoomTargetRef.current - normDy(e) * sens))
      scheduleChase()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelRafId.current != null) cancelAnimationFrame(wheelRafId.current)
      wheelRafId.current = null
    }
  }, [o?.OeuvreID])

  const workImagesSorted = useMemo(
    () => [...workImages].sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0)),
    [workImages],
  )

  if (!o) {
    return isPanel
      ? <div style={{ flex: '0 0 35%', minWidth: narrow ? 0 : 320, padding: 20, color: 'var(--tx3)' }} className="t-mono-sm">—</div>
      : null
  }

  const isSel  = selection.has(o.OeuvreID)
  const isExpanded = isPanel ? (expandedProp || imgZoom > 1) : false
  const activeImgPath = workImagesSorted.length > 0 && activeImgIdx >= 0
    ? workImagesSorted[activeImgIdx]?.txtImageNameLink ?? o.txtImageNameLink
    : o.txtImageNameLink

  if (isPanel) {
    return (
      <div ref={panelRef} style={{
        flex: `0 0 ${isExpanded ? '55vw' : '35%'}`,
        minWidth: narrow ? 0 : 320,
        padding: 0, overflow: 'auto', background: 'var(--bg1)',
        borderLeft: '1px solid var(--bd)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: expandedProp && imgZoom <= 1 ? '-10px 0 40px rgba(0,0,0,0.4)' : 'none',
        maxHeight: '100%',
        height: isExpanded ? '100%' : undefined,
        minHeight: 0,
        alignSelf: 'stretch',
        borderRadius: isExpanded ? '16px 0 0 16px' : '0',
      }}>
        <div style={{ padding: 28 }}>
          <DrawerContent
            o={o} tM={tM} sM={sM} cM={cM} pM={pM} fM={fM} locMap={locMap}
            statusLabelMap={statusLabelMap} selection={selection} setSelection={setSelection}
            toggleInSel={toggleInSel} onClose={onClose} onEdit={onEdit}
            thM={thM} oeuvreThemeMap={oeuvreThemeMap} oeuvreGroupMap={oeuvreGroupMap}
            groupNameMap={groupNameMap}
            initialTechniques={initialTechniques} initialSupports={initialSupports}
            initialFormats={initialFormats} initialThemes={initialThemes}
            initialContacts={initialContacts} initialGroups={initialGroups}
            initialPresentations={initialPresentations}
            mode="panel" isExpanded={isExpanded} setExpanded={setExpandedProp}
            imgZoom={imgZoom} setImgZoom={setImgZoom}
            imgPan={imgPan} setImgPan={setImgPan}
            naturalSize={naturalSize} setNaturalSize={setNaturalSize}
            workImages={workImages} setWorkImages={setWorkImages} activeImgIdx={activeImgIdx} setActiveImgIdx={setActiveImgIdx}
            imgContainerRef={imgContainerRef} isDragging={isDragging} dragStart={dragStart}
            activeImgPath={activeImgPath}
            isSel={isSel}
            closeAttemptRef={closeAttemptRef}
            runGuardedSlot={runGuardedSlot}
            guardApiRef={guardApiRef}
            onDrawerDirtyChange={onDrawerDirtyChange}
            isAdmin={isAdmin}
            onJunctionSaved={onJunctionSaved}
            onWorkSaved={onWorkSaved}
            onOeuvreRemoved={onOeuvreRemoved}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', background: 'rgba(0,0,0,0.35)' }}>
      <div
        role="presentation"
        aria-hidden
        data-testid="work-drawer-dismiss-backdrop"
        onClick={() => closeAttemptRef.current?.()}
        style={{
          flex: 1,
          minWidth: 0,
          alignSelf: 'stretch',
          cursor: 'default',
        }}
      />
      <div
        data-testid="work-drawer-overlay"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: narrow ? '100vw' : 460,
          maxWidth: narrow ? '100vw' : '50vw',
          maxHeight: '100dvh',
          height: '100dvh',
          minHeight: 0,
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          borderRadius: narrow ? 0 : '16px 0 0 16px',
          padding: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 50px rgba(0,0,0,0.4)',
          margin: 0,
        }}
      >
        <div style={{ padding: narrow ? 'max(14px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))' : 28 }}>
          <DrawerContent
            o={o} tM={tM} sM={sM} cM={cM} pM={pM} fM={fM} locMap={locMap}
            statusLabelMap={statusLabelMap} selection={selection} setSelection={setSelection}
            toggleInSel={toggleInSel} onClose={onClose} onEdit={onEdit}
            thM={thM} oeuvreThemeMap={oeuvreThemeMap} oeuvreGroupMap={oeuvreGroupMap}
            groupNameMap={groupNameMap}
            initialTechniques={initialTechniques} initialSupports={initialSupports}
            initialFormats={initialFormats} initialThemes={initialThemes}
            initialContacts={initialContacts} initialGroups={initialGroups}
            initialPresentations={initialPresentations}
            mode="overlay" isExpanded={false}
            imgZoom={imgZoom} setImgZoom={setImgZoom}
            imgPan={imgPan} setImgPan={setImgPan}
            naturalSize={naturalSize} setNaturalSize={setNaturalSize}
            workImages={workImages} setWorkImages={setWorkImages} activeImgIdx={activeImgIdx} setActiveImgIdx={setActiveImgIdx}
            imgContainerRef={imgContainerRef} isDragging={isDragging} dragStart={dragStart}
            activeImgPath={activeImgPath}
            isSel={isSel}
            closeAttemptRef={closeAttemptRef}
            runGuardedSlot={runGuardedSlot}
            guardApiRef={guardApiRef}
            onDrawerDirtyChange={onDrawerDirtyChange}
            isAdmin={isAdmin}
            onJunctionSaved={onJunctionSaved}
            onWorkSaved={onWorkSaved}
            onOeuvreRemoved={onOeuvreRemoved}
          />
        </div>
      </div>
    </div>
  )
})

WorkDrawer.displayName = 'WorkDrawer'
