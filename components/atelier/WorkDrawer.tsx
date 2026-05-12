'use client'

import { imageUrl, thumbUrl, DIAMETER_SIGN, isCircularSupport, STATUS_ID_ARCHIVE_ARTISTE } from '@/lib/data'

import { deleteWork, restoreSoftDeletedWorks, revertWorkSnapshot, loadOeuvreLongText, type WorkRevertSnapshot } from '@/app/atelier/works/actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState, useTransition, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import type { MutableRefObject } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { saveWork, createLookup, addWorkImage, reorderWorkImages, deleteWorkImage } from '@/app/atelier/works/actions'
import { toast } from '@/lib/ui/toast'
import { registerUndo, consumeUndo } from '@/lib/ui/undo'
import { markAsGift } from '@/app/atelier/works/gift-actions'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb } from './WorkThumb'
import { WorkVersionHistory } from './WorkVersionHistory'
import { useMediaQuery } from '@/lib/useMediaQuery'
import {
  downscaleImageFileForMobileIfNeeded,
  startEstimatedUploadProgress,
  withUploadRetry,
} from '@/lib/mobile/image-upload-client'
import {
  computeStatusId as computeWorkStatusId,
  ownStageFromStatusId,
  prodStageFromOeuvre,
  type OwnStageId,
  type ProdStageId,
} from '@/lib/work-editor-model'
import {
  draftStorageKey,
  type WorkFormDraftPayload,
  type WorkFormDraftContent,
  normalizeWorkFormDraftContent,
  workFormDraftContentEquals,
} from '@/lib/mobile/work-form-draft'
import {
  enqueueOfflineWorkSave,
  formDataToStringRecord,
  isLikelyOfflineSaveError,
} from '@/lib/mobile/offline-work-queue'

function setsEqualNum(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

function setsEqualStr(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

/* ──────────────────────────────────────────────────────────────────
   WorkDrawer — unified detail panel.
   mode='panel'   → inline flex panel (InventoryTab Aperçu)
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
  // Panel mode props
  mode?:          'panel' | 'overlay'
  expanded?:      boolean
  setExpanded?:   (b: boolean) => void
  /** Route-leave / parent guards */
  guardApiRef?: MutableRefObject<{
    isDirty: () => boolean
    performSave: () => Promise<boolean>
  }>
  onDrawerDirtyChange?: (dirty: boolean) => void
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
}, ref) {
  const isPanel = mode === 'panel'
  const narrow = useMediaQuery('(max-width: 767px)')

  /** Wired by DrawerContent — backdrop / × call this to guard unsaved edits (overlay + panel). */
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

  // ── Image zoom/pan (panel mode) ────────────────────────
  const [imgZoom, setImgZoom] = useState(1)
  const [imgPan, setImgPan] = useState({ x: 0, y: 0 })
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [workImages, setWorkImages] = useState<{ ImageID: number; txtImageNameLink: string | null; SeqNo: number | null }[]>([])
  const [activeImgIdx, setActiveImgIdx] = useState(-1)
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  /** Wheel adjusts target; rAF chases with small steps (avoids one huge first commit + thumb→full swap shock). */
  const zoomTargetRef = useRef(1)
  const zoomCurrentRef = useRef(1)
  const wheelRafId = useRef<number | null>(null)

  // Reset on work change
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
    createClient()
      .from('tblImage')
      .select('ImageID, txtImageNameLink, SeqNo')
      .eq('OeuvreID', o.OeuvreID)
      .order('SeqNo', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setWorkImages(data)
          setActiveImgIdx(data.length - 1)
        }
      })
  }, [o?.OeuvreID])

  // Mirror committed zoom into chase refs; pin target when snapped to 1× (do not cancel rAF here — imgZoom can lag one frame behind the chase).
  useEffect(() => {
    zoomCurrentRef.current = imgZoom
    if (imgZoom <= 1) zoomTargetRef.current = 1
  }, [imgZoom])

  // Wheel zoom — update target from normalized deltas; rAF chases target with tight first steps.
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

  // ── Wrapper ────────────────────────────────────────────
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
          />
        </div>
      </div>
    )
  }

  // Overlay mode — dimmed backdrop catches outside clicks; panel stops propagation.
  // Full-viewport-height rail + internal scroll: avoids a transparent gap under a short
  // `75vh`/`fit-content` panel (grid bleeding through) and keeps form fields scrollable.
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', background: 'rgba(0,0,0,0.35)' }}>
      <div
        role="presentation"
        aria-hidden
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
          />
        </div>
      </div>
    </div>
  )
})

WorkDrawer.displayName = 'WorkDrawer'

/* ══════════════════════════════════════════════════════════════════
   DrawerContent — shared inner body
   ══════════════════════════════════════════════════════════════════ */

type DrawerContactRow = {
  ContactID: number
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Role: string | null
  Ville?: string | null
  Pays?: string | null
}

function DrawerContent({
  o, tM, sM, cM, pM, statusLabelMap, selection, setSelection, toggleInSel, onClose, onEdit,
  thM, oeuvreThemeMap, oeuvreGroupMap, groupNameMap,
  initialTechniques, initialSupports, initialFormats, initialThemes,
  initialContacts, initialGroups, initialPresentations,
  mode, isExpanded, setExpanded,
  imgZoom, setImgZoom, imgPan, setImgPan, naturalSize, setNaturalSize,
  workImages, setWorkImages, activeImgIdx, setActiveImgIdx,
  imgContainerRef, isDragging, dragStart, activeImgPath,
  isSel,
  closeAttemptRef,
  runGuardedSlot,
  guardApiRef,
  onDrawerDirtyChange,
}: any) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const isPanel = mode === 'panel'
  const narrow = useMediaQuery('(max-width: 767px)')
  /** Full-res overlay fades in after decode (thumb stays underneath — no hard swap). */
  const [fullPreviewReady, setFullPreviewReady] = useState(false)

  // ── Form State (always editable) ───────────────────────
  const [isSaving, startSave] = useTransition()
  const [titre,       setTitre]       = useState(o.Titre ?? '')
  const [annee,       setAnnee]       = useState(o.Année ?? '')
  const [techniqueId, setTechniqueId] = useState(String(o.Technique ?? ''))
  const [supportId,   setSupportId]   = useState(String(o.Support ?? ''))
  const [formatId,    setFormatId]    = useState(String(o.Format ?? ''))
  const [hauteur,     setHauteur]     = useState(String(o.Hauteur ?? ''))
  const [largeur,     setLargeur]     = useState(String(o.Largeur ?? ''))
  const [profondeur,  setProfondeur]  = useState(String(o.Profondeur ?? ''))
  const [presentationId, setPresentationId] = useState(String((o as any).PresentationID ?? ''))
  const [prodStage, setProdStage] = useState<ProdStageId>(() => prodStageFromOeuvre(o))
  const [needsPhoto, setNeedsPhoto] = useState(!!((o as { NeedsPhotograph?: boolean }).NeedsPhotograph ?? false))
  const [ownStage, setOwnStage] = useState<OwnStageId>(() => ownStageFromStatusId(o.statusId))
  const [contactId, setContactId] = useState(String(o.LocalisationID ?? ''))
  const [exposable,   setExposable]   = useState(!!o.Exposable)
  const [encadree,    setEncadree]    = useState(!!o.Encadree)
  const [prix,        setPrix]        = useState(String(o.Prix ?? '0'))
  const [tvaRate, setTvaRate] = useState(String((o as { tva_rate?: number | null }).tva_rate ?? '0'))
  const [discount, setDiscount] = useState(String((o as { Discount?: number | null }).Discount ?? '0'))
  const [paymentDone, setPaymentDone] = useState(!!((o as { PaymentDone?: boolean; is_paid?: boolean | null }).PaymentDone ?? (o as { is_paid?: boolean | null }).is_paid ?? false))
  const [commentaires, setCommentaires] = useState('')
  const [historique, setHistorique] = useState('')
  const [activeConsignment, setActiveConsignment] = useState<{
    label?: string | null
    Contact?: { NomInstitution?: string | null; Nom?: string | null; Prénom?: string | null; Ville?: string | null; Pays?: string | null }
  } | null>(null)
  const [selThemes, setSelThemes] = useState<Set<number>>(new Set())
  const [selGroups, setSelGroups] = useState<Set<string>>(new Set())
  const [localContacts, setLocalContacts] = useState<DrawerContactRow[]>(initialContacts as DrawerContactRow[])
  const [showNewContact, setShowNewContact] = useState(false)
  const [newC, setNewC] = useState({ inst: '', prenom: '', nom: '', role: '', email: '', phone: '', ville: '', pays: '', notes: '' })
  const [creatingContact, setCreatingContact] = useState(false)
  const [anonymityLevel, setAnonymityLevel] = useState<number>((o as any).anonymity_level ?? 0)

  // ── Gift modal state ───────────────────────────────────
  const [showGiftModal, setShowGiftModal]       = useState(false)
  const [giftRecipientId, setGiftRecipientId]   = useState('')
  const [giftDeliveryDate, setGiftDeliveryDate] = useState('')
  const [giftNotes, setGiftNotes]               = useState('')
  const [giftBusy, setGiftBusy]                 = useState(false)
  const [giftError, setGiftError]               = useState<string | null>(null)
  const [noteBaseline, setNoteBaseline] = useState({ c: '', h: '' })

  const draftKey = useMemo(() => draftStorageKey(o.OeuvreID), [o.OeuvreID])
  const draftRestoreHandledKeyRef = useRef<string | null>(null)
  const [longTextReady, setLongTextReady] = useState(false)

  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [savingExit, setSavingExit]             = useState(false)
  const pendingAfterGuardRef = useRef<(() => void) | null>(null)

  const panRafId = useRef<number | null>(null)
  const latestMouseRef = useRef({ x: 0, y: 0 })
  const drawerImageFileRef = useRef<HTMLInputElement>(null)
  const drawerUploadCancelRef = useRef(false)
  const [drawerImageBusy, setDrawerImageBusy] = useState(false)
  const [drawerUploadPct, setDrawerUploadPct] = useState(0)
  const [drawerUploadName, setDrawerUploadName] = useState('')
  const [drawerUploadIndex, setDrawerUploadIndex] = useState(0)
  const [drawerUploadTotal, setDrawerUploadTotal] = useState(0)

  const drawerSorted = useMemo(
    () => [...workImages].sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0)),
    [workImages],
  )

  async function drawerPersistOrder(ids: number[]) {
    if (!o?.OeuvreID || ids.length === 0) return
    const before = [...drawerSorted]
    const currentId = before[activeImgIdx]?.ImageID
    const res = await reorderWorkImages(o.OeuvreID, ids)
    if ('error' in res) {
      toast.error(`${t('error_prefix')} ${res.error}`)
      return
    }
    const map = new Map(before.map((row) => [row.ImageID, row]))
    const nextRows = ids.map((id, i) => ({ ...map.get(id)!, SeqNo: i + 1 }))
    setWorkImages(nextRows)
    const ni = ids.findIndex((id) => id === currentId)
    setActiveImgIdx(ni >= 0 ? ni : Math.max(0, ids.length - 1))
    router.refresh()
  }

  function drawerNudge(sortedIndex: number, dir: -1 | 1) {
    const j = sortedIndex + dir
    if (j < 0 || j >= drawerSorted.length) return
    const ids = drawerSorted.map((x) => x.ImageID)
    const a = ids[sortedIndex]!
    const b = ids[j]!
    ids[sortedIndex] = b
    ids[j] = a
    void drawerPersistOrder(ids)
  }

  function drawerMakeCover(sortedIndex: number) {
    if (sortedIndex < 0 || sortedIndex >= drawerSorted.length) return
    const ids = drawerSorted.map((x) => x.ImageID)
    const id = ids.splice(sortedIndex, 1)[0]!
    ids.push(id)
    void drawerPersistOrder(ids)
  }

  async function drawerDeleteImage(imageId: number) {
    if (!o?.OeuvreID) return
    if (!window.confirm(t('confirm_delete_image'))) return
    const res = await deleteWorkImage(imageId, o.OeuvreID)
    if ('error' in res) {
      toast.error(`${t('error_prefix')} ${res.error}`)
      return
    }
    setWorkImages((prev: { ImageID: number; txtImageNameLink: string | null; SeqNo: number | null }[]) => {
      const next = prev.filter((row) => row.ImageID !== imageId)
      setActiveImgIdx((ai: number) => {
        if (next.length === 0) return -1
        return Math.min(Math.max(0, ai), next.length - 1)
      })
      return next
    })
    router.refresh()
  }

  async function onDrawerImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !o?.OeuvreID) return
    drawerUploadCancelRef.current = false
    setDrawerImageBusy(true)
    setDrawerUploadTotal(files.length)
    try {
      for (let i = 0; i < files.length; i++) {
        if (drawerUploadCancelRef.current) break
        const file = files[i]!
        setDrawerUploadIndex(i + 1)
        setDrawerUploadName(file.name)
        const prepared = await downscaleImageFileForMobileIfNeeded(file, narrow)
        const stopTick = startEstimatedUploadProgress(prepared.size, setDrawerUploadPct)
        try {
          const res = await withUploadRetry(
            async () => {
              const fd = new FormData()
              fd.append('image', prepared)
              fd.append('oeuvre_id', String(o.OeuvreID))
              return addWorkImage(fd)
            },
            { onRetry: () => toast.info(t('upload_retry_toast')) },
          )
          if ('error' in res) {
            toast.error(`${t('error_prefix')} ${res.error}`)
            break
          }
          setWorkImages((prev: { ImageID: number; txtImageNameLink: string | null; SeqNo: number | null }[]) => {
            const next = [...prev, res.image].sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0))
            const ai = next.findIndex((x) => x.ImageID === res.image.ImageID)
            if (ai >= 0) setActiveImgIdx(ai)
            return next
          })
          router.refresh()
        } catch (err) {
          toast.error(`${t('error_prefix')} ${String(err)}`)
          break
        } finally {
          stopTick()
          setDrawerUploadPct(0)
        }
      }
    } finally {
      setDrawerImageBusy(false)
      setDrawerUploadTotal(0)
      setDrawerUploadIndex(0)
      setDrawerUploadName('')
      setDrawerUploadPct(0)
    }
  }

  // Sync on work change
  useEffect(() => {
    setLongTextReady(false)
    setTitre(o.Titre ?? '')
    setAnnee(o.Année ?? '')
    setTechniqueId(String(o.Technique ?? ''))
    setSupportId(String(o.Support ?? ''))
    setFormatId(String(o.Format ?? ''))
    setHauteur(String(o.Hauteur ?? ''))
    setLargeur(String(o.Largeur ?? ''))
    setProfondeur(String(o.Profondeur ?? ''))
    setPresentationId(String((o as any).PresentationID ?? ''))
    setProdStage(prodStageFromOeuvre(o))
    setNeedsPhoto(!!((o as { NeedsPhotograph?: boolean }).NeedsPhotograph ?? false))
    setOwnStage(ownStageFromStatusId(o.statusId))
    setContactId(String(o.LocalisationID ?? ''))
    setExposable(o.statusId === STATUS_ID_ARCHIVE_ARTISTE ? false : !!o.Exposable)
    setEncadree(!!o.Encadree)
    setPrix(String(o.Prix ?? '0'))
    setTvaRate(String((o as { tva_rate?: number | null }).tva_rate ?? '0'))
    setDiscount(String((o as { Discount?: number | null }).Discount ?? '0'))
    setPaymentDone(!!((o as { PaymentDone?: boolean; is_paid?: boolean | null }).PaymentDone ?? (o as { is_paid?: boolean | null }).is_paid ?? false))
    setSelThemes(new Set(oeuvreThemeMap.get(o.OeuvreID) ?? []))
    setSelGroups(new Set(oeuvreGroupMap.get(o.OeuvreID) ?? []))
    setAnonymityLevel((o as { anonymity_level?: number }).anonymity_level ?? 0)
    setLocalContacts(initialContacts)
    setCommentaires('')
    setHistorique('')
    void (async () => {
      try {
        const r = await loadOeuvreLongText(o.OeuvreID)
        if (!('error' in r)) {
          const c = r.Commentaires ?? ''
          const h = r.Historique ?? ''
          setCommentaires(c)
          setHistorique(h)
          setNoteBaseline({ c, h })
        } else {
          setNoteBaseline({ c: '', h: '' })
        }
      } finally {
        setLongTextReady(true)
      }
    })()
  }, [o.OeuvreID, oeuvreThemeMap, oeuvreGroupMap, o, initialContacts])

  useEffect(() => {
    if (ownStage !== 'loan' && ownStage !== 'consigned') {
      setActiveConsignment(null)
      return
    }
    const sb = createClient()
    void sb
      .from('consignment')
      .select('*, Contact(NomInstitution, Nom, Prénom, Ville, Pays)')
      .eq('oeuvre_id', o.OeuvreID)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) setActiveConsignment(data as { label?: string | null; Contact?: { NomInstitution?: string | null; Nom?: string | null; Prénom?: string | null; Ville?: string | null; Pays?: string | null } })
        else setActiveConsignment(null)
      })
  }, [ownStage, o.OeuvreID])

  useEffect(() => {
    pendingAfterGuardRef.current = null
    setShowUnsavedModal(false)
  }, [o.OeuvreID])

  // Lookups
  const [localTechniques, setLocalTechniques] = useState(initialTechniques)
  const [localSupports,   setLocalSupports]   = useState(initialSupports)
  const [localFormats,    setLocalFormats]    = useState(initialFormats)

  const supportLabel = useMemo(
    () => localSupports.find((s: { SupportID: number; Support: string | null }) => String(s.SupportID) === supportId)?.Support ?? '',
    [localSupports, supportId],
  )
  const circularPlanar = isCircularSupport(supportLabel)
  const diameterFieldValue = useMemo(() => {
    if (!circularPlanar) return hauteur
    const a = hauteur.trim()
    const b = largeur.trim()
    if (a === b) return hauteur
    return hauteur || largeur
  }, [circularPlanar, hauteur, largeur])

  const isDigital = techniqueId === '19'
  const pxToCm = (px: string) => (px ? (parseFloat(px) / (300 / 2.54)).toFixed(1) : '')

  const PRODUCTION_STAGES = useMemo(
    () => [
      { id: 'atelier' as const, label: t('wf_prod_atelier_l'), desc: t('wf_prod_atelier_d') },
      { id: 'catalogued' as const, label: t('wf_prod_cat_l'), desc: t('wf_prod_cat_d') },
      { id: 'available' as const, label: t('wf_prod_avail_l'), desc: t('wf_prod_avail_d') },
    ],
    [t],
  )
  const OWNERSHIP_STAGES = useMemo(
    () => [
      { id: 'artist' as const, label: t('wf_own_artist_l'), desc: t('wf_own_artist_d') },
      { id: 'reserved' as const, label: t('wf_own_reserved_l'), desc: t('wf_own_reserved_d') },
      { id: 'consigned' as const, label: t('wf_own_consigned_l'), desc: t('wf_own_consigned_d') },
      { id: 'loan' as const, label: t('wf_own_loan_l'), desc: t('wf_own_loan_d') },
      { id: 'sold' as const, label: t('wf_own_sold_l'), desc: t('wf_own_sold_d') },
      { id: 'gift' as const, label: t('wf_own_gift_l'), desc: t('wf_own_gift_d') },
      { id: 'artist_archive' as const, label: t('wf_own_archive_l'), desc: t('wf_own_archive_d') },
    ],
    [t],
  )

  const pemContact = useMemo(
    () => localContacts.find((c: DrawerContactRow) => (c.NomInstitution ?? '').toLowerCase().includes('pem')),
    [localContacts],
  )
  const currentOwner = useMemo(
    () => localContacts.find((c: DrawerContactRow) => String(c.ContactID) === contactId),
    [localContacts, contactId],
  )

  const prixVal = parseFloat(prix) || 0
  const discVal = parseFloat(discount) || 0
  const prixFinalComputed = ownStage === 'gift' ? 0 : prixVal * (1 - discVal / 100)

  const isOwnershipTransferred = ownStage === 'sold' || ownStage === 'gift'
  const isArchived = ownStage === 'artist_archive'

  const currentLoc = useMemo(() => {
    if (ownStage === 'artist' || ownStage === 'artist_archive') {
      return pemContact?.Ville ? `${pemContact.Ville}, ${pemContact.Pays ?? ''}` : t('atelier')
    }
    if (ownStage === 'reserved') {
      if (currentOwner) {
        const loc = [currentOwner.Ville, currentOwner.Pays].filter(Boolean).join(', ')
        return `${t('wf_own_reserved_l')} — ${currentOwner.NomInstitution ?? currentOwner.Nom ?? '?'} (${loc || '?'})`
      }
      return `${t('wf_own_reserved_l')} — ${t('buyer')} (?)`
    }
    if (ownStage === 'consigned' || ownStage === 'loan') {
      if (activeConsignment) {
        const c = activeConsignment.Contact
        const loc = [c?.Ville, c?.Pays].filter(Boolean).join(', ')
        return `${activeConsignment.label ?? t('wf_own_consigned_l')} · ${c?.NomInstitution ?? c?.Nom ?? '—'} (${loc || '?'})`
      }
      if (currentOwner) {
        const loc = [currentOwner.Ville, currentOwner.Pays].filter(Boolean).join(', ')
        return `${currentOwner.NomInstitution ?? currentOwner.Nom ?? '?'} (${loc || '?'})`
      }
      return `${t('wf_own_consigned_l')} / ${t('wf_own_loan_l')}`
    }
    if (isOwnershipTransferred) {
      if (!currentOwner) return `${t('buyer')} (?)`
      const loc = [currentOwner.Ville, currentOwner.Pays].filter(Boolean).join(', ')
      return loc || `${currentOwner.NomInstitution ?? currentOwner.Nom ?? t('buyer')}`
    }
    return '—'
  }, [ownStage, currentOwner, pemContact, activeConsignment, isOwnershipTransferred, t])

  useEffect(() => {
    if (prodStage === 'catalogued') setNeedsPhoto(true)
    else setNeedsPhoto(false)
  }, [prodStage])

  const prevNeedsPhoto = useRef(needsPhoto)
  useEffect(() => {
    if (!needsPhoto && prevNeedsPhoto.current === true) setProdStage('available')
    prevNeedsPhoto.current = needsPhoto
  }, [needsPhoto])

  useEffect(() => {
    if (ownStage === 'gift') {
      setPrix('0')
      setDiscount('0')
    }
  }, [ownStage])

  useEffect(() => {
    if (isArchived && pemContact) setContactId(String(pemContact.ContactID))
  }, [isArchived, pemContact])

  useEffect(() => {
    if (isOwnershipTransferred && prodStage === 'atelier') setProdStage('available')
  }, [isOwnershipTransferred, prodStage])

  useEffect(() => {
    if ((ownStage === 'artist' || ownStage === 'artist_archive') && pemContact) {
      setContactId(String(pemContact.ContactID))
    }
  }, [ownStage, pemContact])

  const baselineThemes = useMemo(
    () => new Set<number>(oeuvreThemeMap.get(o.OeuvreID) ?? []),
    [o.OeuvreID, oeuvreThemeMap],
  )
  const baselineGroups = useMemo(
    () => new Set<string>(oeuvreGroupMap.get(o.OeuvreID) ?? []),
    [o.OeuvreID, oeuvreGroupMap],
  )

  const baselineOwn = useMemo(() => ownStageFromStatusId(o.statusId), [o.statusId])
  const baselineProd = useMemo(() => prodStageFromOeuvre(o), [o])
  const baselineNeeds = !!((o as { NeedsPhotograph?: boolean }).NeedsPhotograph ?? false)

  const isDirty = useMemo(() => {
    if ((o.Titre ?? '') !== titre) return true
    if (String(o.Année ?? '') !== String(annee)) return true
    if (String(o.Technique ?? '') !== techniqueId) return true
    if (String(o.Support ?? '') !== supportId) return true
    if (String(o.Format ?? '') !== formatId) return true
    if (String(o.Hauteur ?? '') !== hauteur) return true
    if (String(o.Largeur ?? '') !== largeur) return true
    if (String(o.Profondeur ?? '') !== profondeur) return true
    if (String((o as { PresentationID?: number }).PresentationID ?? '') !== presentationId) return true
    if (ownStage !== baselineOwn) return true
    if (prodStage !== baselineProd) return true
    if (needsPhoto !== baselineNeeds) return true
    if (String(o.LocalisationID ?? '') !== contactId) return true
    if (!!o.Exposable !== exposable) return true
    if (!!o.Encadree !== encadree) return true
    if (String(o.Prix ?? '0') !== prix) return true
    if (String((o as { Discount?: number | null }).Discount ?? '0') !== discount) return true
    if (String((o as { tva_rate?: number | null }).tva_rate ?? '0') !== tvaRate) return true
    const baselinePaid = !!((o as { PaymentDone?: boolean; is_paid?: boolean | null }).PaymentDone ?? (o as { is_paid?: boolean | null }).is_paid ?? false)
    if (paymentDone !== baselinePaid) return true
    if (((o as { anonymity_level?: number }).anonymity_level ?? 0) !== anonymityLevel) return true
    if (!setsEqualNum(selThemes, baselineThemes)) return true
    if (!setsEqualStr(selGroups, baselineGroups)) return true
    if (commentaires !== noteBaseline.c) return true
    if (historique !== noteBaseline.h) return true
    return false
  }, [
    o,
    titre,
    annee,
    techniqueId,
    supportId,
    formatId,
    hauteur,
    largeur,
    profondeur,
    presentationId,
    ownStage,
    baselineOwn,
    prodStage,
    baselineProd,
    needsPhoto,
    baselineNeeds,
    contactId,
    exposable,
    encadree,
    prix,
    discount,
    tvaRate,
    paymentDone,
    anonymityLevel,
    selThemes,
    selGroups,
    baselineThemes,
    baselineGroups,
    commentaires,
    historique,
    noteBaseline,
  ])

  const runGuarded = useCallback((fn: () => void) => {
    if (!isDirty) fn()
    else {
      pendingAfterGuardRef.current = fn
      setShowUnsavedModal(true)
    }
  }, [isDirty])

  const attemptClose = useCallback(() => {
    runGuarded(onClose)
  }, [runGuarded, onClose])

  useEffect(() => {
    closeAttemptRef.current = attemptClose
    return () => {
      closeAttemptRef.current = null
    }
  }, [attemptClose, closeAttemptRef])

  useEffect(() => {
    runGuardedSlot.current = runGuarded
    return () => {
      runGuardedSlot.current = (fn: () => void) => { fn() }
    }
  }, [runGuarded, runGuardedSlot])

  async function saveLookup(table: string, name: string) {
    if (!name) return
    const res = await createLookup(table, cap(name))
    if ('error' in res) {
      toast.error(`${t('error_prefix')} ${res.error}`)
      return
    }
    if (table === 'Technique') { setLocalTechniques((p: any) => [...p, { TechniqueID: res.id, Technique: cap(name) }]); setTechniqueId(String(res.id)) }
    else if (table === 'Support') { setLocalSupports((p: any) => [...p, { SupportID: res.id, Support: cap(name) }]); setSupportId(String(res.id)) }
    else if (table === 'Format') { setLocalFormats((p: any) => [...p, { FormatID: res.id, Format: cap(name) }]); setFormatId(String(res.id)) }
  }

  function buildFormData(): FormData {
    const fd = new FormData()
    const sid = computeWorkStatusId(ownStage, prodStage)
    fd.append('oeuvre_id', String(o.OeuvreID))
    fd.append('titre', titre)
    fd.append('annee', annee)
    fd.append('technique', techniqueId)
    fd.append('support', supportId)
    fd.append('format', formatId)
    fd.append('hauteur', hauteur)
    fd.append('largeur', largeur)
    fd.append('profondeur', profondeur)
    fd.append('presentation_id', presentationId)
    fd.append('status_id', String(sid))
    fd.append('contact_id', contactId)
    fd.append('localisation_id', contactId)
    fd.append('exposable', exposable ? '1' : '0')
    fd.append('encadree', encadree ? '1' : '0')
    fd.append('montee', (o as { Montee?: boolean }).Montee ? '1' : '0')
    fd.append('is_commission', (o as { IsCommission?: boolean }).IsCommission ? '1' : '0')
    fd.append('prix', prix)
    fd.append('discount', discount)
    fd.append('prix_final', String(prixFinalComputed))
    fd.append('tva_rate', tvaRate)
    fd.append('is_paid', paymentDone ? '1' : '0')
    fd.append('is_gift', ownStage === 'gift' ? '1' : '0')
    fd.append('commentaires', commentaires)
    fd.append('historique', historique)
    fd.append('catalogued', prodStage !== 'atelier' ? '1' : '0')
    fd.append('needs_photograph', needsPhoto ? '1' : '0')
    fd.append('anonymity_level', String(anonymityLevel))
    fd.append('admin_override_anonymity', '0')
    const locParsed = parseInt(contactId, 10)
    if (contactId && !Number.isNaN(locParsed) && o.LocalisationID !== locParsed) {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/')
      const locStr = `${dateStr} - ${currentOwner?.NomInstitution ?? currentOwner?.Nom ?? '—'} - ${currentOwner?.Ville ?? '?'}/${currentOwner?.Pays ?? '?'}`
      fd.append('historique_append', locStr)
    }
    selThemes.forEach((id) => fd.append('themes', String(id)))
    selGroups.forEach((id) => fd.append('groups', id))
    return fd
  }

  /* eslint-disable react-hooks/exhaustive-deps -- deps mirror inline buildFormData() captures */
  const performSave = useCallback(async (): Promise<boolean> => {
    const snapshot: WorkRevertSnapshot = {
      statusId: o.statusId ?? null,
      catalogued: !!(o as { Catalogué?: boolean }).Catalogué,
      needsPhotograph: !!(o as { NeedsPhotograph?: boolean }).NeedsPhotograph,
      themeIds: Array.from(baselineThemes),
      groupIds: Array.from(baselineGroups),
    }
    const oid = o.OeuvreID
    const fd = buildFormData()
    try {
      const res = await saveWork(fd)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return false
      }
      try {
        sessionStorage.removeItem(draftKey)
      } catch { /* ignore */ }
      if (res.pending) {
        setNoteBaseline({ c: commentaires, h: historique })
        toast.success(t('wf_save_pending_toast'))
        return true
      }
      setNoteBaseline({ c: commentaires, h: historique })
      router.refresh()
      const runUndo = () => {
        void (async () => {
          try {
            const ok = await consumeUndo()
            if (!ok) return
          } catch {
            toast.error(t('undoFailed'))
          }
        })()
      }
      const tid = toast.success(t('saveDoneUndoHint'), {
        ttlMs: 8000,
        action: { label: t('undo'), onClick: runUndo },
      })
      registerUndo({
        ttlMs: 8000,
        linkedToastId: tid,
        undo: async () => {
          const r = await revertWorkSnapshot(oid, snapshot)
          if ('error' in r) {
            toast.error(t('revertWorkFailed'))
            throw new Error(r.error)
          }
          router.refresh()
        },
      })
      return true
    } catch (e) {
      if (isLikelyOfflineSaveError(e)) {
        try {
          await enqueueOfflineWorkSave(formDataToStringRecord(fd))
          toast.info(t('offline_save_queued'))
        } catch {
          toast.error(t('offline_sync_failed'))
        }
        return false
      }
      toast.error(`${t('error_prefix')} ${String(e)}`)
      return false
    }
  }, [
    o,
    titre,
    annee,
    techniqueId,
    supportId,
    formatId,
    hauteur,
    largeur,
    profondeur,
    presentationId,
    ownStage,
    prodStage,
    needsPhoto,
    contactId,
    exposable,
    encadree,
    prix,
    discount,
    tvaRate,
    paymentDone,
    commentaires,
    historique,
    anonymityLevel,
    selThemes,
    selGroups,
    baselineThemes,
    baselineGroups,
    currentOwner,
    draftKey,
    t,
    prixFinalComputed,
    router,
  ])
  /* eslint-enable react-hooks/exhaustive-deps */

  useLayoutEffect(() => {
    if (guardApiRef) {
      guardApiRef.current.isDirty = () => isDirty
      guardApiRef.current.performSave = performSave
    }
  }, [guardApiRef, isDirty, performSave])

  useEffect(() => {
    onDrawerDirtyChange?.(isDirty)
  }, [isDirty, onDrawerDirtyChange])

  const draftSnapshot = useMemo((): WorkFormDraftContent => ({
    titre, annee, techniqueId, supportId, formatId, hauteur, largeur, profondeur,
    prodStage, needsPhoto, ownStage, contactId, anonymityLevel,
    prix, tvaRate, discount, paymentDone, exposable,
    commentaires, historique,
    selThemes: Array.from(selThemes), selGroups: Array.from(selGroups),
  }), [
    titre, annee, techniqueId, supportId, formatId, hauteur, largeur, profondeur,
    prodStage, needsPhoto, ownStage, contactId, anonymityLevel,
    prix, tvaRate, discount, paymentDone, exposable,
    commentaires, historique, selThemes, selGroups,
  ])

  useEffect(() => {
    draftRestoreHandledKeyRef.current = null
  }, [draftKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!longTextReady) return
    if (draftRestoreHandledKeyRef.current === draftKey) return
    draftRestoreHandledKeyRef.current = draftKey
    const raw = sessionStorage.getItem(draftKey)
    if (!raw) return
    let d: WorkFormDraftPayload
    try {
      d = JSON.parse(raw) as WorkFormDraftPayload
    } catch {
      sessionStorage.removeItem(draftKey)
      return
    }
    if (Date.now() - (d.savedAt ?? 0) > 7 * 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(draftKey)
      return
    }
    if (workFormDraftContentEquals(normalizeWorkFormDraftContent(d), draftSnapshot)) {
      sessionStorage.removeItem(draftKey)
      return
    }
    const msg = `${t('wf_draft_restore_title')}\n\n${t('wf_draft_restore_body')}`
    if (!window.confirm(msg)) {
      sessionStorage.removeItem(draftKey)
      return
    }
    setTitre(d.titre ?? '')
    setAnnee(d.annee ?? '')
    setTechniqueId(d.techniqueId ?? '')
    setSupportId(d.supportId ?? '')
    setFormatId(d.formatId ?? '')
    setHauteur(d.hauteur ?? '')
    setLargeur(d.largeur ?? '')
    setProfondeur(d.profondeur ?? '')
    setProdStage((d.prodStage as ProdStageId) || 'atelier')
    setNeedsPhoto(!!d.needsPhoto)
    setOwnStage((d.ownStage as OwnStageId) || 'artist')
    setContactId(d.contactId ?? '')
    setAnonymityLevel(typeof d.anonymityLevel === 'number' ? d.anonymityLevel : 0)
    setPrix(d.prix ?? '0')
    setTvaRate(d.tvaRate ?? '0')
    setDiscount(d.discount ?? '0')
    setPaymentDone(!!d.paymentDone)
    setExposable(!!d.exposable)
    setCommentaires(d.commentaires ?? '')
    setHistorique(d.historique ?? '')
    setSelThemes(new Set(d.selThemes ?? []))
    setSelGroups(new Set(d.selGroups ?? []))
  }, [longTextReady, draftKey, draftSnapshot, t])

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (isDirty) {
          const payload: WorkFormDraftPayload = { ...draftSnapshot, savedAt: Date.now() }
          sessionStorage.setItem(draftKey, JSON.stringify(payload))
        } else if (longTextReady) {
          sessionStorage.removeItem(draftKey)
        }
      } catch { /* quota */ }
    }, 600)
    return () => clearTimeout(id)
  }, [draftKey, draftSnapshot, isDirty, longTextReady])

  function handleSubmit() {
    startSave(async () => {
      await performSave()
    })
  }

  async function handleSaveAndClose() {
    setSavingExit(true)
    try {
      const ok = await performSave()
      if (ok) {
        setShowUnsavedModal(false)
        const run = pendingAfterGuardRef.current
        pendingAfterGuardRef.current = null
        run?.()
      }
    } finally {
      setSavingExit(false)
    }
  }

  function discardUnsavedClose() {
    setShowUnsavedModal(false)
    const run = pendingAfterGuardRef.current
    pendingAfterGuardRef.current = null
    run?.()
  }

  // ── Delete ─────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  function handleDelete() {
    startDelete(async () => {
      try {
        const oid = o.OeuvreID
        const result = await deleteWork(oid)
        if ('error' in result) { setDeleteError(result.error); return }
        onClose()
        router.refresh()
        const runUndo = () => {
          void (async () => {
            try {
              const ok = await consumeUndo()
              if (!ok) return
            } catch {
              toast.error(t('undoFailed'))
            }
          })()
        }
        const tid = toast.success(t('workTrashHint'), {
          ttlMs: 8000,
          action: { label: t('undo'), onClick: runUndo },
        })
        registerUndo({
          ttlMs: 8000,
          linkedToastId: tid,
          undo: async () => {
            const r = await restoreSoftDeletedWorks([oid])
            if ('error' in r) {
              toast.error(t('restoreWorkFailed'))
              throw new Error(r.error)
            }
            router.refresh()
          },
        })
      } catch (e: any) { setDeleteError(e?.message ?? String(e)) }
    })
  }

  function handleToggleSel() {
    if (toggleInSel) { toggleInSel(o.OeuvreID); return }
    if (!setSelection) return
    const next = new Set(selection)
    if (next.has(o.OeuvreID)) next.delete(o.OeuvreID)
    else next.add(o.OeuvreID)
    setSelection(next)
  }

  const cName = (c: DrawerContactRow) => c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`
  const sortedContacts = [...localContacts].sort((a, b) => cName(a).localeCompare(cName(b), 'fr'))

  const thumbPreviewSrc = activeImgPath ? (thumbUrl(activeImgPath) ?? '') : ''
  const fullPreviewSrc = activeImgPath ? (imageUrl(activeImgPath) ?? '') : ''
  const showFullPreviewLayer = Boolean(activeImgPath && imgZoom > 1)
  /** Overlay rail is narrow: cap hero image so pipeline + fields stay reachable without huge scroll. */
  const previewMaxHeight = isPanel ? '70vh' : narrow ? '56vh' : 'min(44vh, 400px)'

  useEffect(() => {
    setFullPreviewReady(false)
  }, [activeImgPath])

  useEffect(() => {
    if (!showFullPreviewLayer) setFullPreviewReady(false)
  }, [showFullPreviewLayer])

  useEffect(() => () => {
    if (panRafId.current != null) cancelAnimationFrame(panRafId.current)
    panRafId.current = null
  }, [])

  async function handleCreateContact() {
    if (!newC.inst && !newC.prenom && !newC.nom) return
    setCreatingContact(true)
    const sb = createClient()
    const { data: maxRow } = await sb.from('Contact').select('ContactID').order('ContactID', { ascending: false }).limit(1)
    const newId = ((maxRow?.[0] as any)?.ContactID ?? 0) + 1
    const payload: any = {
      ContactID: newId,
      NomInstitution: newC.inst || null,
      Prénom: newC.prenom || null,
      Nom: newC.nom || null,
      Role: newC.role || null,
      Email: newC.email || null,
      Téléphone1: newC.phone || null,
      Ville: newC.ville || null,
      Pays: newC.pays || null,
      Notes: newC.notes || null,
    }
    const { error } = await sb.from('Contact').insert(payload)
    setCreatingContact(false)
    if (error) {
      toast.error(`${t('error_prefix')} ${error.message}`)
      return
    }
    const newEntry = { ContactID: newId, NomInstitution: newC.inst || null, Prénom: newC.prenom || null, Nom: newC.nom || null, Role: newC.role || null, Ville: newC.ville || null, Pays: newC.pays || null }
    setLocalContacts((prev: any) => [...prev, newEntry])
    setContactId(String(newId))
    setShowNewContact(false)
    setNewC({ inst: '', prenom: '', nom: '', role: '', email: '', phone: '', ville: '', pays: '', notes: '' })
  }

  return (
    <>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>#{o.OeuvreID}</div>
          <span
            className="t-mono-sm"
            title={t('auditAttributedHint')}
            aria-label={t('auditAttributedHint')}
            style={{ color: 'var(--ac)', cursor: 'help', fontSize: 11, opacity: 0.85 }}
          >
            ◈
          </span>
        </div>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          {imgZoom > 1 && (
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', marginRight: 8 }}>×{imgZoom.toFixed(1)}</span>
          )}
          {isPanel && setExpanded && (
            <button
              onClick={() => setExpanded(!isExpanded)}
              style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--tx3)', cursor: 'pointer', fontSize: 13, padding: '4px 8px', marginRight: 4 }}
              title={isExpanded ? 'Réduire' : 'Agrandir'}
            >{isExpanded ? '◀' : '▶'}</button>
          )}
          <button type="button" onClick={attemptClose} style={{ background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 24, padding: '0 6px' }}>×</button>
        </div>
      </div>

      {/* Image */}
      <input
        ref={drawerImageFileRef}
        type="file"
        accept="image/*"
        multiple={narrow}
        capture={narrow ? 'environment' : undefined}
        style={{ display: 'none' }}
        onChange={onDrawerImageFileChange}
        tabIndex={-1}
      />
      {drawerImageBusy && (drawerUploadPct > 0 || drawerUploadName) && (
        <div className="t-mono-sm" style={{ color: 'var(--tx2)', marginBottom: 8 }} role="status">
          <div>{t('wf_images_upload_status').replace('{name}', drawerUploadName)}</div>
          <div style={{ marginTop: 4, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(drawerUploadPct * 100)}%`, height: '100%', background: 'var(--ac)' }} />
          </div>
          {drawerUploadTotal > 1 && (
            <div style={{ marginTop: 4, color: 'var(--tx3)' }}>
              {drawerUploadIndex}/{drawerUploadTotal}
            </div>
          )}
        </div>
      )}
      {drawerImageBusy && drawerUploadTotal > 1 && (
        <button type="button" className="btn ghost sm" style={{ marginBottom: 8 }} onClick={() => { drawerUploadCancelRef.current = true }}>
          {t('wf_images_upload_cancel')}
        </button>
      )}
      <div
        ref={imgContainerRef}
        style={{ width: '100%', overflow: 'hidden', background: 'transparent', cursor: imgZoom > 1 ? 'grab' : 'default', userSelect: 'none', marginBottom: 16 }}
        onMouseDown={e => {
          if (imgZoom > 1) {
            isDragging.current = true
            dragStart.current = { x: e.clientX, y: e.clientY, px: imgPan.x, py: imgPan.y }
          }
        }}
        onMouseMove={e => {
          if (!isDragging.current) return
          latestMouseRef.current = { x: e.clientX, y: e.clientY }
          if (panRafId.current != null) return
          panRafId.current = requestAnimationFrame(() => {
            panRafId.current = null
            const { x, y } = latestMouseRef.current
            setImgPan({
              x: dragStart.current.px + (x - dragStart.current.x),
              y: dragStart.current.py + (y - dragStart.current.y),
            })
          })
        }}
        onMouseUp={() => { isDragging.current = false }}
        onMouseLeave={() => { isDragging.current = false }}
      >
        {activeImgPath
          ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${imgZoom})`,
                  transformOrigin: 'center center',
                  transition: 'none',
                  willChange: imgZoom > 1 ? 'transform' : 'auto',
                }}
              >
                <img
                  key={`drawer-thumb-${activeImgPath}`}
                  draggable={false}
                  src={thumbPreviewSrc}
                  alt={o.Titre ?? ''}
                  onLoad={e => {
                    const el = e.currentTarget
                    if (el.naturalWidth > 0) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
                  }}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: previewMaxHeight,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                {showFullPreviewLayer && fullPreviewSrc ? (
                  <img
                    key={`drawer-full-${activeImgPath}`}
                    draggable={false}
                    src={fullPreviewSrc}
                    alt=""
                    aria-hidden
                    decoding="async"
                    onLoad={e => {
                      const el = e.currentTarget
                      if (el.naturalWidth > 0) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
                      setFullPreviewReady(true)
                    }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      opacity: fullPreviewReady ? 1 : 0,
                      transition: 'opacity 0.22s ease-out',
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
              </div>
            )
          : (
              <div
                className="ph"
                style={{
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: 'var(--tx3)',
                  border: '1px dashed var(--bd)',
                  borderRadius: 4,
                  padding: 16,
                }}
              >
                <span style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.45 }}>{t('workDrawer_add_photo')}</span>
                <button
                  type="button"
                  data-testid="work-drawer-add-photo"
                  disabled={drawerImageBusy}
                  onClick={() => drawerImageFileRef.current?.click()}
                  aria-label={t('workDrawer_add_photo_aria')}
                  className="btn ghost sm"
                >
                  {drawerImageBusy ? '…' : '+'}
                </button>
              </div>
            )}
      </div>

      {/* Filmstrip + add / reorder (cover = last in order) */}
      {workImages.length >= 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {drawerSorted.map((img: { ImageID: number; txtImageNameLink: string | null; SeqNo: number | null }, idx: number) => (
            <div key={img.ImageID} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => { setActiveImgIdx(idx); setImgZoom(1); setImgPan({ x: 0, y: 0 }) }}
                style={{ width: 44, height: 44, padding: 0, border: `2px solid ${idx === activeImgIdx ? 'var(--ac)' : 'var(--bd)'}`, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg0)', flexShrink: 0 }}
                title={
                  `${t('wf_images_strip_alt').replace('{n}', String(idx + 1))}${
                    idx === drawerSorted.length - 1 ? t('wf_images_strip_cover_suffix') : ''
                  }`
                }
              >
                {img.txtImageNameLink && (
                  <WorkThumb
                    file={img.txtImageNameLink}
                    alt={t('wf_images_strip_alt').replace('{n}', String(idx + 1))}
                    size={64}
                    displaySize="44px"
                  />
                )}
              </button>
              {drawerSorted.length > 1 && (
                <div className="row" style={{ gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => drawerNudge(idx, -1)}
                    aria-label={t('wf_images_order_before_aria')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22 }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={idx === drawerSorted.length - 1}
                    onClick={() => drawerNudge(idx, 1)}
                    aria-label={t('wf_images_order_after_aria')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22 }}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    disabled={idx === drawerSorted.length - 1}
                    onClick={() => drawerMakeCover(idx)}
                    aria-label={t('wf_images_order_cover_aria')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22 }}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => void drawerDeleteImage(img.ImageID)}
                    aria-label={t('confirm_delete_image')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22, color: 'var(--rust)' }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              data-testid="work-drawer-add-another-photo"
              disabled={drawerImageBusy}
              onClick={() => drawerImageFileRef.current?.click()}
              aria-label={t('wf_images_add_aria')}
              className="btn ghost sm"
              style={{ width: 44, height: 44, padding: 0, border: '1px dashed var(--bd)', fontSize: 18 }}
            >
              {drawerImageBusy ? '…' : '+'}
            </button>
          </div>
        </div>
      )}

      {/* Title (inline edit) */}
      <input
        value={titre}
        onChange={e => setTitre(cap(e.target.value))}
        style={{ ...FIS, fontSize: 24, fontFamily: 'var(--font-serif)', marginBottom: 16, height: 40, border: 'none', borderBottom: '1px solid var(--bd)', background: 'transparent', width: '100%' }}
        placeholder={t('untitled')}
      />

      <section style={{ marginBottom: 12 }} data-testid="work-drawer-status-bar">
        <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
          {statusLabelMap[computeWorkStatusId(ownStage, prodStage)] ?? `ID ${computeWorkStatusId(ownStage, prodStage)}`}
        </div>
      </section>

      <section style={{ marginBottom: 16, opacity: (isOwnershipTransferred || isArchived) ? 0.55 : 1 }}>
        <SectionTitle title={t('wf_section_production')} />
        <WfPipeProgress
          stages={PRODUCTION_STAGES}
          current={prodStage}
          onSelect={(id) => {
            if (isOwnershipTransferred || isArchived) return
            setProdStage(id as ProdStageId)
          }}
          color="var(--sage)"
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          <WfSwitch
            label={t('wf_photo_required')}
            checked={needsPhoto}
            onChange={(v) => {
              if (isOwnershipTransferred || isArchived) return
              setNeedsPhoto(v)
            }}
            disabled={isOwnershipTransferred || isArchived}
          />
        </div>
        {needsPhoto && prodStage === 'catalogued' && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--dust)22', border: '1px solid var(--dust)44', fontSize: 11, color: 'var(--tx2)' }}>
            {t('wf_photo_pending_hint')}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 16 }}>
        <SectionTitle title={t('wf_section_ownership')} />
        <WfPipeProgress
          stages={OWNERSHIP_STAGES.map((s) => ({
            ...s,
            disabled: isOwnershipTransferred && s.id !== 'sold' && s.id !== 'gift',
          }))}
          current={ownStage}
          onSelect={(id) => setOwnStage(id as OwnStageId)}
          color="var(--cyan)"
        />
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <div className="t-label" style={{ fontSize: 10, marginBottom: 4 }}>
              {ownStage === 'consigned' || ownStage === 'loan' ? t('wf_contact_custodian') : ownStage === 'reserved' ? t('wf_contact_buyer_intent') : t('wf_contact_acquire')}
            </div>
            {ownStage === 'artist' || ownStage === 'artist_archive' ? (
              <div style={{ ...FIS, display: 'flex', alignItems: 'center', background: 'var(--bg2)44', opacity: 0.85, minHeight: 36 }}>
                {pemContact?.NomInstitution ?? 'Pem'}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)} style={{ ...FIS, flex: 1 }}>
                  <option value="">{t('select_option_placeholder')}</option>
                  {sortedContacts.map((c) => (
                    <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
                  ))}
                </select>
                <button type="button" className="btn ghost sm" style={{ flexShrink: 0, minHeight: 44, minWidth: 44 }} onClick={() => setShowNewContact(true)}>+</button>
              </div>
            )}
          </div>
          <div style={{ background: 'var(--bg2)', padding: 12, border: '1px solid var(--bd)', borderRadius: 4 }}>
            <div className="t-label" style={{ fontSize: 9, marginBottom: 4 }}>{t('wf_localisation_now')}</div>
            <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--ac)' }}>{currentLoc}</div>
          </div>
        </div>
        <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
          <div className="t-label" style={{ fontSize: 10, marginBottom: 6 }}>{t('wf_visibility_hdr')}</div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 8, lineHeight: 1.45 }}>{t('wf_visibility_blurb')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { level: 0, label: t('wf_vis_public'), desc: t('wf_vis_public_d') },
              { level: 1, label: t('wf_vis_masked'), desc: t('wf_vis_masked_d') },
              { level: 2, label: t('wf_vis_private'), desc: t('wf_vis_private_d') },
            ].map(({ level, label, desc }) => {
              const active = anonymityLevel === level
              return (
                <button
                  key={level}
                  type="button"
                  title={desc}
                  onClick={() => setAnonymityLevel(level)}
                  style={{
                    flex: 1,
                    minWidth: 72,
                    padding: '8px 6px',
                    fontSize: 10,
                    border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`,
                    background: active ? 'var(--ac)22' : 'var(--bg2)',
                    color: active ? 'var(--ac)' : 'var(--tx2)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {anonymityLevel === 2 && (
        <div style={{ marginBottom: 14, fontSize: 10, color: 'var(--rust)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--rust)' }} />
          {t('wf_vis_private_banner')}
        </div>
      )}

      {/* ═══ EDITABLE FIELDS ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section>
          <SectionTitle title={t('wf_section_identity')} />
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 12px', fontSize: 12 }}>
            <Label>{t('year')}</Label>
            <input className="input" value={annee} onChange={e => setAnnee(e.target.value)} style={FIS} placeholder="YYYY-MM-DD" />

            <Label>{t('technique')}</Label>
            <CreatableSelect value={techniqueId} options={localTechniques.map((t: any) => ({ id: String(t.TechniqueID), label: t.Technique ?? '' }))} onChange={setTechniqueId} onAdd={(name: string) => saveLookup('Technique', name)} />

            <Label>{t('support')}</Label>
            <CreatableSelect value={supportId} options={localSupports.map((s: any) => ({ id: String(s.SupportID), label: s.Support ?? '' }))} onChange={setSupportId} onAdd={(name: string) => saveLookup('Support', name)} />

            <Label>Dim.</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {circularPlanar ? (
                <>
                  <span style={{ color: 'var(--tx3)', fontSize: 12, lineHeight: 1 }} title={t('wf_diameter_tt')}>{DIAMETER_SIGN}</span>
                  <input
                    className="input"
                    value={diameterFieldValue}
                    onChange={(e) => {
                      const v = e.target.value
                      setHauteur(v)
                      setLargeur(v)
                    }}
                    style={{ ...FIS, width: '34%', minWidth: 52 }}
                    placeholder="cm"
                  />
                  <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
                  <input className="input" value={profondeur} onChange={e => setProfondeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder="D" />
                </>
              ) : (
                <>
                  <input className="input" value={hauteur} onChange={e => setHauteur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder={isDigital ? 'H (px)' : 'H'} />
                  <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
                  <input className="input" value={largeur} onChange={e => setLargeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder={isDigital ? 'W (px)' : 'W'} />
                  <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
                  <input className="input" value={profondeur} onChange={e => setProfondeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder="D" />
                </>
              )}
            </div>
            {isDigital && (
              <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: 10, border: '1px solid var(--bd)', background: 'var(--bg2)', fontSize: 11 }}>
                <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('wf_fmt_digital')}</div>
                <div className="t-mono-xs" style={{ color: 'var(--ac)' }}>≈ {pxToCm(hauteur)} × {pxToCm(largeur)} cm (@300dpi)</div>
              </div>
            )}

            <Label>{t('framed')}</Label>
            <div style={{ paddingTop: 2 }}>
              <Switch checked={encadree} onChange={setEncadree} />
            </div>

            <Label>Présentation</Label>
            <select className="input" value={presentationId} onChange={e => setPresentationId(e.target.value)} style={FIS}>
              <option value="">—</option>
              {initialPresentations.map((p: any) => <option key={p.PresentationID} value={p.PresentationID}>{p.Nom}</option>)}
            </select>

            <Label>Thèmes</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {initialThemes.map((th: any) => {
                const active = selThemes.has(th.id)
                return (
                  <button key={th.id} type="button"
                    onClick={() => setSelThemes((p: Set<number>) => { const s = new Set(p); if (s.has(th.id)) s.delete(th.id); else s.add(th.id); return s })}
                    style={{ padding: '2px 7px', fontSize: 9, borderRadius: 2, border: '1px solid var(--bd)', background: active ? 'var(--ac)' : 'var(--bg2)', color: active ? 'var(--bg1)' : 'var(--tx3)', cursor: 'pointer' }}>
                    {th.name}
                  </button>
                )
              })}
            </div>

          </div>
        </section>

        <section>
          <SectionTitle title={t('wf_section_finance')} />
          <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '80px 1fr 80px 1fr', gap: '8px 10px', fontSize: 12 }}>
            <Label>{t('wf_price')}</Label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--tx3)', fontSize: 11 }}>€</span>
              <input className="input" value={prix} onChange={e => setPrix(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
            </div>
            <Label>{t('wf_discount')}</Label>
            <input className="input" value={discount} onChange={e => setDiscount(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
            <Label>{t('wf_vat')}</Label>
            <input className="input" type="number" min={0} max={100} step={0.01} value={tvaRate} onChange={e => setTvaRate(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
            <Label>{t('wf_final_ht')}</Label>
            <div className="t-mono-md" style={{ fontWeight: 700, paddingTop: 4 }}>€ {prixFinalComputed.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}</div>
            <div style={{ gridColumn: narrow ? '1 / -1' : '1 / -1', marginTop: 4 }}>
              <WfSwitch label={t('wf_payment_rcvd')} checked={paymentDone} onChange={setPaymentDone} disabled={ownStage === 'gift'} />
            </div>
          </div>
        </section>

        <section>
          <SectionTitle title={t('wf_groups')} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {initialGroups.map((g: { id: string; name: string }) => {
              const active = selGroups.has(g.id)
              return (
                <button key={g.id} type="button"
                  onClick={() => setSelGroups((p: Set<string>) => { const s = new Set(p); if (s.has(g.id)) s.delete(g.id); else s.add(g.id); return s })}
                  style={{ padding: '4px 10px', fontSize: 10, borderRadius: 12, border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`, background: active ? 'var(--ac)22' : 'var(--bg2)', color: active ? 'var(--ac)' : 'var(--tx3)', cursor: 'pointer' }}>
                  {g.name}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <SectionTitle title={t('wf_comments')} />
          <textarea className="input" value={commentaires} onChange={e => setCommentaires(e.target.value)} style={{ ...FIS, minHeight: 80, resize: 'vertical', fontSize: 12 }} placeholder={t('wf_comments_placeholder')} />
          <div style={{ marginTop: 12 }}>
            <div className="t-label" style={{ fontSize: 10, marginBottom: 4 }}>{t('wf_history_title')}</div>
            <textarea className="input" value={historique} onChange={e => setHistorique(e.target.value)} style={{ ...FIS, minHeight: 88, resize: 'vertical', fontSize: 11, fontFamily: 'var(--font-mono)' }} placeholder={t('wf_history_placeholder')} />
            <div className="t-mono-xs" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 6 }}>{t('wf_history_hint')}</div>
          </div>
        </section>

        <WorkVersionHistory oeuvreId={o.OeuvreID} onRestored={() => router.refresh()} />
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
        <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={handleSubmit} disabled={isSaving} style={{ fontSize: 11, minHeight: 44 }}>
            {isSaving ? '…' : t('save')}
          </button>
          <button className={`btn ${isSel ? 'primary' : 'ghost'}`} onClick={handleToggleSel} style={{ fontSize: 11 }}>
            {isSel ? '✓ Sél.' : '+ Sél.'}
          </button>
          {/* Direct gift path — disabled when ownership has already moved or work is archived */}
          {!(ownStage === 'sold' || ownStage === 'gift' || ownStage === 'artist_archive') && (
            <button
              className="btn ghost sm"
              style={{ fontSize: 11, color: 'var(--ac)', borderColor: 'rgba(200,168,110,0.4)', minHeight: 44 }}
              type="button"
              onClick={() => {
                setGiftRecipientId('')
                setGiftDeliveryDate(new Date().toISOString().slice(0, 10))
                setGiftNotes('')
                setGiftError(null)
                setShowGiftModal(true)
              }}
              title={t('workDrawer_gift_body')}
            >
              ⊕ {t('workDrawer_gift_cta')}
            </button>
          )}
          {!confirmDelete ? (
            <button className="btn ghost sm" style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 10 }} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </button>
          ) : (
            <div className="row gap-sm" style={{ marginLeft: 'auto', alignItems: 'center' }}>
              <button className="btn ghost sm" style={{ color: '#c0392b' }} disabled={deleting} onClick={handleDelete}>
                {deleting ? '…' : 'Confirmer'}
              </button>
              <button className="btn ghost sm" onClick={() => { setConfirmDelete(false); setDeleteError(null) }}>×</button>
            </div>
          )}
        </div>
        {deleteError && <div style={{ color: '#c0392b', fontSize: 10, marginTop: 6 }}>{deleteError}</div>}
      </div>

      {/* New contact full form modal */}
      {showNewContact && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowNewContact(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 8, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)' }}>Nouveau contact</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Institution</label>
              <input className="input" value={newC.inst} onChange={e => setNewC(p => ({ ...p, inst: e.target.value }))} style={FIS} placeholder="Nom institution" autoFocus />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Prénom</label>
                <input className="input" value={newC.prenom} onChange={e => setNewC(p => ({ ...p, prenom: e.target.value }))} style={FIS} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Nom</label>
                <input className="input" value={newC.nom} onChange={e => setNewC(p => ({ ...p, nom: e.target.value }))} style={FIS} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Rôle</label>
              <input className="input" value={newC.role} onChange={e => setNewC(p => ({ ...p, role: e.target.value }))} style={FIS} placeholder="Collectionneur, Galerie, Musée…" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Email</label>
                <input className="input" type="email" value={newC.email} onChange={e => setNewC(p => ({ ...p, email: e.target.value }))} style={FIS} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Téléphone</label>
                <input className="input" type="tel" value={newC.phone} onChange={e => setNewC(p => ({ ...p, phone: e.target.value }))} style={FIS} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Ville</label>
                <input className="input" value={newC.ville} onChange={e => setNewC(p => ({ ...p, ville: e.target.value }))} style={FIS} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Pays</label>
                <input className="input" value={newC.pays} onChange={e => setNewC(p => ({ ...p, pays: e.target.value }))} style={FIS} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--tx3)' }}>Notes</label>
              <textarea className="input" value={newC.notes} onChange={e => setNewC(p => ({ ...p, notes: e.target.value }))} style={{ ...FIS, height: 72, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost sm" onClick={() => { setShowNewContact(false); setNewC({ inst: '', prenom: '', nom: '', role: '', email: '', phone: '', ville: '', pays: '', notes: '' }) }} style={{ fontSize: 11 }}>Annuler</button>
              <button className="btn primary sm" onClick={handleCreateContact} disabled={creatingContact || (!newC.inst && !newC.prenom && !newC.nom)} style={{ fontSize: 11 }}>
                {creatingContact ? '…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnsavedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-drawer-unsaved-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 230,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => {
            if (savingExit) return
            setShowUnsavedModal(false)
            pendingAfterGuardRef.current = null
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg1)',
              border: '1px solid var(--bd)',
              borderRadius: 10,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            }}
          >
            <div id="work-drawer-unsaved-title" style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", marginBottom: 8, color: 'var(--tx)' }}>
              {t('workDrawerUnsavedTitle')}
            </div>
            <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 20, lineHeight: 1.45 }}>
              {t('workDrawerUnsavedBody')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn ghost sm"
                disabled={savingExit}
                onClick={discardUnsavedClose}
                style={{ color: 'var(--rust)', borderColor: 'rgba(192,57,43,0.35)' }}
              >
                {t('workDrawerDiscard')}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                disabled={savingExit}
                onClick={() => {
                  setShowUnsavedModal(false)
                  pendingAfterGuardRef.current = null
                }}
              >
                {t('cancel')}
              </button>
              <button type="button" className="btn primary sm" disabled={savingExit} onClick={() => void handleSaveAndClose()}>
                {savingExit ? '…' : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift transfer modal */}
      {showGiftModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !giftBusy && setShowGiftModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg1)', border: '1px solid var(--ac)', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ac)' }}>{t('workDrawer_gift_title')}</div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>
                {t('workDrawer_gift_body')}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('workDrawer_gift_recipient')} *</label>
              <select className="input" value={giftRecipientId} onChange={e => setGiftRecipientId(e.target.value)} style={FIS} autoFocus>
                <option value="">{t('workDrawer_gift_recipient_ph')}</option>
                {sortedContacts.map((c: any) => (
                  <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('workDrawer_gift_delivery')}</label>
              <input type="date" className="input" value={giftDeliveryDate} onChange={e => setGiftDeliveryDate(e.target.value)} style={FIS} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('wf_comments')}</label>
              <textarea className="input" value={giftNotes} onChange={e => setGiftNotes(e.target.value)} style={{ ...FIS, height: 72, resize: 'vertical' }} placeholder={t('workDrawer_gift_notes_ph')} />
            </div>

            {giftError && <div style={{ color: '#c0392b', fontSize: 10 }}>{giftError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost sm" disabled={giftBusy} onClick={() => setShowGiftModal(false)} style={{ fontSize: 11 }}>{t('workDrawer_gift_cancel')}</button>
              <button
                type="button"
                className="btn primary sm"
                disabled={giftBusy || !giftRecipientId}
                onClick={async () => {
                  setGiftBusy(true); setGiftError(null)
                  try {
                    const fd = new FormData()
                    fd.append('oeuvre_id', String(o.OeuvreID))
                    fd.append('recipient_id', giftRecipientId)
                    if (giftDeliveryDate) fd.append('delivery_date', giftDeliveryDate)
                    if (giftNotes.trim())  fd.append('notes', giftNotes.trim())
                    const res = await markAsGift(fd)
                    if ('error' in res) {
                      setGiftError(res.error)
                    } else {
                      setShowGiftModal(false)
                      router.refresh()
                    }
                  } catch (err) {
                    setGiftError(err instanceof Error ? err.message : String(err))
                  } finally {
                    setGiftBusy(false)
                  }
                }}
                style={{ fontSize: 11 }}
              >
                {giftBusy ? '…' : t('workDrawer_gift_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ───────────────────────────────────────

function WfPipeProgress({
  stages,
  current,
  onSelect,
  color,
}: {
  stages: { id: string; label: string; desc?: string; disabled?: boolean }[]
  current: string
  onSelect: (id: string) => void
  color: string
}) {
  const idxCurrent = stages.findIndex((x) => x.id === current)
  return (
    <div style={{ display: 'flex', gap: 4, width: '100%', flexWrap: 'wrap' }}>
      {stages.map((s, i) => {
        const isActive = s.id === current
        const isPast = idxCurrent >= i
        const isDisabled = !!s.disabled
        return (
          <div
            key={s.id}
            onClick={() => !isDisabled && onSelect(s.id)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                e.preventDefault()
                onSelect(s.id)
              }
            }}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            style={{
              flex: '1 1 72px',
              minWidth: 64,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              borderBottom: `3px solid ${isPast ? color : 'var(--bd)'}`,
              padding: '6px 2px',
              opacity: isDisabled ? 0.25 : isPast ? 1 : 0.45,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, color: 'var(--tx)', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{s.label}</div>
            {s.desc && <div style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 2, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{s.desc}</div>}
          </div>
        )
      })}
    </div>
  )
}

function WfSwitch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer', fontSize: 12, opacity: disabled ? 0.45 : 1 }}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        role="checkbox"
        aria-checked={checked}
        style={{
          width: 18,
          height: 18,
          border: '1px solid var(--bd)',
          background: checked ? 'var(--ac)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bg0)',
          fontSize: 11,
        }}
      >
        {checked ? '✓' : ''}
      </div>
      <span style={{ color: checked ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
    </label>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid var(--bd2)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 3, height: 3, background: 'var(--ac)' }} />
      {title}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="t-label" style={{ fontSize: 10, paddingTop: 4 }}>{children}</div>
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 14, height: 14, border: '1px solid var(--bd)', background: checked ? 'var(--ac)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg1)', fontSize: 9, cursor: 'pointer', borderRadius: 2 }}>
      {checked ? '✓' : ''}
    </div>
  )
}

function CreatableSelect({ value, options, onChange, onAdd }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; onAdd: (v: string) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [newVal, setNewVal] = useState('')
  if (isAdding) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="input" value={newVal} onChange={e => setNewVal(e.target.value)} style={{ ...FIS, padding: '0 6px' }} placeholder="Nouveau…" autoFocus />
        <button type="button" className="btn primary sm" style={{ height: 28, padding: '0 6px', fontSize: 10 }} onClick={() => { onAdd(newVal); setIsAdding(false); setNewVal('') }}>OK</button>
        <button type="button" className="btn ghost sm" style={{ height: 28, padding: '0 6px', fontSize: 10 }} onClick={() => setIsAdding(false)}>×</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select className="input" value={value} onChange={e => onChange(e.target.value)} style={{ ...FIS, padding: '0 6px' }}>
        <option value="">—</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <button type="button" className="btn ghost sm" style={{ height: 28, padding: '0 6px', fontSize: 10 }} onClick={() => setIsAdding(true)}>+</button>
    </div>
  )
}

const FIS: React.CSSProperties = { fontSize: 12, outline: 'none', height: 28, width: '100%' }

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
