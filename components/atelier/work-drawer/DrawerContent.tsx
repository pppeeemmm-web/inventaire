'use client'

import { imageUrl, thumbUrl } from '@/lib/data'
import { deleteWork, restoreSoftDeletedWorks, revertWorkSnapshot, loadOeuvreLongText, type WorkRevertSnapshot } from '@/app/atelier/works/actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState, useTransition, useCallback, useRef, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { saveWork, createLookup, addWorkImage, reorderWorkImages, deleteWorkImage, replaceWorkImage } from '@/app/atelier/works/actions'
import { toast } from '@/lib/ui/toast'
import { workSaveErrorToastMessage } from '@/lib/work-save-error'
import { registerUndo, consumeUndo } from '@/lib/ui/undo'
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
  enqueueOfflineWorkSaveFromFormData,
  isLikelyOfflineSaveError,
} from '@/lib/mobile/offline-work-queue'
import type { DrawerContentProps, DrawerContactRow } from './drawer-content-props'
import { WorkDrawerImageArea } from './WorkDrawerImageArea'
import { WorkDrawerPipelineSection } from './WorkDrawerPipelineSection'
import { SaleReturnWindowBanner } from './SaleReturnWindowBanner'
import { DrawerContentFinanceSection } from './DrawerContentFinanceSection'
import { DrawerContentIdentitySection } from './DrawerContentIdentitySection'
import { DrawerContentNotesVersionSection } from './DrawerContentNotesVersionSection'
import { DrawerWorkSessionsSection } from './DrawerWorkSessionsSection'
import { DrawerContentGroupsSection } from './DrawerContentGroupsSection'
import { emitJunctionSaved } from '@/lib/atelier/junction-refresh-bus'
import { NewContactModal, EMPTY_CONTACT_DRAFT } from './NewContactModal'
import { UnsavedChangesModal } from './UnsavedChangesModal'
import { GiftTransferModal } from './GiftTransferModal'
import { FIS, cap } from './drawer-widgets'
import { WorkFormPhysicalQr } from '@/components/atelier/WorkFormPhysicalQr'
import { normalizeAnonymityLevel } from '@/lib/anonymity-level'

function withCacheKey(src: string, cacheKey?: string): string {
  if (!src || !cacheKey) return src
  return `${src}${src.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheKey)}`
}

export function DrawerContent({
  o,
  tM: _tM,
  sM: _sM,
  cM: _cM,
  pM: _pM,
  statusLabelMap,
  selection,
  setSelection,
  toggleInSel,
  onClose,
  onEdit: _onEdit,
  thM: _thM,
  oeuvreThemeMap,
  oeuvreGroupMap,
  groupNameMap: _groupNameMap,
  fM: _fM,
  locMap: _locMap,
  initialTechniques, initialSupports, initialFormats, initialThemes,
  initialContacts, initialGroups, initialPresentations,
  mode, isExpanded, setExpanded,
  imgZoom,
  setImgZoom,
  imgPan,
  setImgPan,
  naturalSize: _naturalSize,
  setNaturalSize,
  workImages, setWorkImages, activeImgIdx, setActiveImgIdx,
  imgContainerRef, isDragging, dragStart, activeImgPath,
  isSel,
  closeAttemptRef,
  runGuardedSlot,
  guardApiRef,
  onDrawerDirtyChange,
  isAdmin = false,
  onJunctionSaved,
  onWorkSaved,
  onOeuvreRemoved,
}: DrawerContentProps) {
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
  const [presentationId, setPresentationId] = useState(String((o as { PresentationID?: number }).PresentationID ?? ''))
  const [prodStage, setProdStage] = useState<ProdStageId>(() => prodStageFromOeuvre(o))
  const [needsPhoto, setNeedsPhoto] = useState(!!((o as { NeedsPhotograph?: boolean }).NeedsPhotograph ?? false))
  const [ownStage, setOwnStage] = useState<OwnStageId>(() => ownStageFromStatusId(o.statusId))
  const [contactId, setContactId] = useState(String(o.LocalisationID ?? ''))
  const [exposable,   setExposable]   = useState(!!o.Exposable)
  const [broadcastReady, setBroadcastReady] = useState(!!(o as { broadcast_ready?: boolean }).broadcast_ready)
  const [broadcastCaptionSeed, setBroadcastCaptionSeed] = useState(String((o as { broadcast_caption_seed?: string | null }).broadcast_caption_seed ?? ''))
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
  const [newC, setNewC] = useState(EMPTY_CONTACT_DRAFT)
  const [creatingContact, setCreatingContact] = useState(false)
  const [anonymityLevel, setAnonymityLevel] = useState<number>(() =>
    normalizeAnonymityLevel((o as { anonymity_level?: unknown }).anonymity_level),
  )

  // ── Gift modal state ───────────────────────────────────
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [noteBaseline, setNoteBaseline] = useState({ c: '', h: '' })

  const draftKey = useMemo(() => draftStorageKey(o.OeuvreID), [o.OeuvreID])
  const draftRestoreHandledKeyRef = useRef<string | null>(null)
  /** Avoid re-applying junction map on every hydrate merge while user edits themes. */
  const syncedOeuvreIdRef = useRef<number | null>(null)
  /** Per-œuvre editor snapshot last queued/applied via save (incl. pending_changes). */
  const submittedByOeuvreRef = useRef<Map<number, WorkFormDraftContent>>(new Map())
  /** Frozen form snapshot at open or last successful save — dirty = current form ≠ this. */
  const [editorBaseline, setEditorBaseline] = useState<WorkFormDraftContent | null>(null)
  const [longTextReady, setLongTextReady] = useState(false)
  /** Increment so long-text reload runs after discard-in-place (same OeuvreID). */
  const [longTextReloadNonce, setLongTextReloadNonce] = useState(0)

  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [savingExit, setSavingExit]             = useState(false)
  const pendingAfterGuardRef = useRef<(() => void) | null>(null)
  const isDirtyRef = useRef(false)

  const panRafId = useRef<number | null>(null)
  const latestMouseRef = useRef({ x: 0, y: 0 })
  const drawerImageFileRef = useRef<HTMLInputElement>(null)
  const retouchImageFileRef = useRef<HTMLInputElement>(null)
  const retouchImageTargetRef = useRef<number | null>(null)
  const drawerUploadCancelRef = useRef(false)
  const [drawerImageBusy, setDrawerImageBusy] = useState(false)
  const [drawerUploadPct, setDrawerUploadPct] = useState(0)
  const [drawerUploadName, setDrawerUploadName] = useState('')
  const [drawerUploadIndex, setDrawerUploadIndex] = useState(0)
  const [drawerUploadTotal, setDrawerUploadTotal] = useState(0)
  const [imageCacheKeys, setImageCacheKeys] = useState<Record<number, string>>({})

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

  function drawerStartRetouch(imageId: number) {
    retouchImageTargetRef.current = imageId
    retouchImageFileRef.current?.click()
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
          if ('pending' in res) {
            toast.success(t('wf_image_pending_toast'))
            continue
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

  async function onRetouchImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    const imageId = retouchImageTargetRef.current
    retouchImageTargetRef.current = null
    if (!file || !o?.OeuvreID || !imageId) return

    setDrawerImageBusy(true)
    setDrawerUploadTotal(1)
    setDrawerUploadIndex(1)
    setDrawerUploadName(file.name)
    const stopTick = startEstimatedUploadProgress(file.size, setDrawerUploadPct)
    try {
      const res = await withUploadRetry(
        async () => {
          const fd = new FormData()
          fd.append('image', file)
          fd.append('oeuvre_id', String(o.OeuvreID))
          fd.append('image_id', String(imageId))
          return replaceWorkImage(fd)
        },
        { onRetry: () => toast.info(t('upload_retry_toast')) },
      )
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      setWorkImages((prev: { ImageID: number; txtImageNameLink: string | null; SeqNo: number | null }[]) =>
        prev.map((row) => (row.ImageID === imageId ? { ...row, ...res.image } : row)),
      )
      setImageCacheKeys((prev) => ({
        ...prev,
        [imageId]: res.cacheKey || String(Date.now()),
      }))
      toast.success(t('wf_images_retouch_uploaded'))
      router.refresh()
    } catch (err) {
      toast.error(`${t('error_prefix')} ${String(err)}`)
    } finally {
      stopTick()
      setDrawerImageBusy(false)
      setDrawerUploadTotal(0)
      setDrawerUploadIndex(0)
      setDrawerUploadName('')
      setDrawerUploadPct(0)
    }
  }

  const captureDrawerDraftContent = useCallback(
    (): WorkFormDraftContent =>
      normalizeWorkFormDraftContent({
        titre,
        annee,
        techniqueId,
        supportId,
        formatId,
        hauteur,
        largeur,
        profondeur,
        prodStage,
        needsPhoto,
        ownStage,
        contactId,
        anonymityLevel,
        prix,
        tvaRate,
        discount,
        paymentDone,
        exposable,
        broadcastReady,
        commentaires,
        historique,
        selThemes: Array.from(selThemes),
        selGroups: Array.from(selGroups),
      }),
    [
      titre,
      annee,
      techniqueId,
      supportId,
      formatId,
      hauteur,
      largeur,
      profondeur,
      prodStage,
      needsPhoto,
      ownStage,
      contactId,
      anonymityLevel,
      prix,
      tvaRate,
      discount,
      paymentDone,
      exposable,
      broadcastReady,
      commentaires,
      historique,
      selThemes,
      selGroups,
    ],
  )

  const applyDraftContentToForm = useCallback((d: WorkFormDraftContent) => {
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
    setAnonymityLevel(normalizeAnonymityLevel(d.anonymityLevel))
    setPrix(d.prix ?? '0')
    setTvaRate(d.tvaRate ?? '0')
    setDiscount(d.discount ?? '0')
    setPaymentDone(!!d.paymentDone)
    setExposable(!!d.exposable)
    setBroadcastReady(!!d.broadcastReady)
    setCommentaires(d.commentaires ?? '')
    setHistorique(d.historique ?? '')
    setSelThemes(new Set(d.selThemes ?? []))
    setSelGroups(new Set(d.selGroups ?? []))
  }, [])

  // Sync on work change — layout pass resets state before effects (draft autosave) run,
  // and noteBaseline must match cleared notes or isDirty falsely trips during long-text load.
  const syncFormFieldsFromOeuvre = useCallback(() => {
    syncedOeuvreIdRef.current = o.OeuvreID
    const persisted = submittedByOeuvreRef.current.get(o.OeuvreID) ?? null
    const mapThemes = oeuvreThemeMap.get(o.OeuvreID) ?? []
    const mapGroups = oeuvreGroupMap.get(o.OeuvreID) ?? []
    setLongTextReady(false)
    setNoteBaseline({ c: '', h: '' })
    setTitre(o.Titre ?? '')
    setAnnee(o.Année ?? '')
    setTechniqueId(String(o.Technique ?? ''))
    setSupportId(String(o.Support ?? ''))
    setFormatId(String(o.Format ?? ''))
    setHauteur(String(o.Hauteur ?? ''))
    setLargeur(String(o.Largeur ?? ''))
    setProfondeur(String(o.Profondeur ?? ''))
    setPresentationId(String((o as { PresentationID?: number }).PresentationID ?? ''))
    const loadedOwn = ownStageFromStatusId(o.statusId)
    const loadedProd = prodStageFromOeuvre(o)
    setProdStage(loadedProd)
    // Seed from the derived stage (what editorBaseline stores), not raw NeedsPhotograph.
    setNeedsPhoto(loadedProd === 'catalogued')
    setOwnStage(loadedOwn)
    const pemRow = (initialContacts as DrawerContactRow[]).find((c) =>
      (c.NomInstitution ?? '').toLowerCase().includes('pem'),
    )
    let loadedContactId = String(o.LocalisationID ?? '')
    if ((loadedOwn === 'artist' || loadedOwn === 'artist_archive') && pemRow) {
      loadedContactId = String(pemRow.ContactID)
    }
    setContactId(loadedContactId)
    setExposable(loadedOwn === 'artist_archive' ? false : !!o.Exposable)
    setBroadcastReady(!!(o as { broadcast_ready?: boolean }).broadcast_ready)
    setBroadcastCaptionSeed(String((o as { broadcast_caption_seed?: string | null }).broadcast_caption_seed ?? ''))
    setEncadree(!!o.Encadree)
    const loadedPrix = loadedOwn === 'gift' ? '0' : String(o.Prix ?? '0')
    const loadedDiscount = loadedOwn === 'gift' ? '0' : String((o as { Discount?: number | null }).Discount ?? '0')
    setPrix(loadedPrix)
    setTvaRate(String((o as { tva_rate?: number | null }).tva_rate ?? '0'))
    setDiscount(loadedDiscount)
    setPaymentDone(
      !!((o as { PaymentDone?: boolean; is_paid?: boolean | null }).PaymentDone
        ?? (o as { is_paid?: boolean | null }).is_paid
        ?? false),
    )
    if (!persisted) {
      setSelThemes(new Set(mapThemes))
      setSelGroups(new Set(mapGroups))
    }
    setAnonymityLevel(normalizeAnonymityLevel((o as { anonymity_level?: unknown }).anonymity_level))
    setLocalContacts(initialContacts)
    setCommentaires('')
    setHistorique('')
    setImageCacheKeys({})
    if (persisted) {
      applyDraftContentToForm(persisted)
      setEditorBaseline(normalizeWorkFormDraftContent(persisted))
    } else {
      const ownershipTransferred = loadedOwn === 'sold' || loadedOwn === 'gift'
      const normProd =
        ownershipTransferred && loadedProd === 'atelier' ? 'available' : loadedProd
      setEditorBaseline(
        normalizeWorkFormDraftContent({
          titre: o.Titre ?? '',
          annee: o.Année ?? '',
          techniqueId: String(o.Technique ?? ''),
          supportId: String(o.Support ?? ''),
          formatId: String(o.Format ?? ''),
          hauteur: String(o.Hauteur ?? ''),
          largeur: String(o.Largeur ?? ''),
          profondeur: String(o.Profondeur ?? ''),
          prodStage: normProd,
          needsPhoto: normProd === 'catalogued',
          ownStage: loadedOwn,
          contactId: loadedContactId,
          anonymityLevel: normalizeAnonymityLevel((o as { anonymity_level?: unknown }).anonymity_level),
          prix: loadedPrix,
          tvaRate: String((o as { tva_rate?: number | null }).tva_rate ?? '0'),
          discount: loadedDiscount,
          paymentDone:
            !!((o as { PaymentDone?: boolean; is_paid?: boolean | null }).PaymentDone
              ?? (o as { is_paid?: boolean | null }).is_paid
              ?? false),
          exposable: loadedOwn === 'artist_archive' ? false : !!o.Exposable,
          broadcastReady: !!(o as { broadcast_ready?: boolean }).broadcast_ready,
          commentaires: '',
          historique: '',
          selThemes: mapThemes,
          selGroups: mapGroups,
        }),
      )
    }
  }, [o, oeuvreThemeMap, oeuvreGroupMap, initialContacts, applyDraftContentToForm])

  useLayoutEffect(() => {
    syncFormFieldsFromOeuvre()
    // Intentionally only when the open work changes — not when oeuvreThemeMap hydrates later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.OeuvreID])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await loadOeuvreLongText(o.OeuvreID)
        if (cancelled) return
        if (!('error' in r)) {
          const c = r.Commentaires ?? ''
          const h = r.Historique ?? ''
          setCommentaires(c)
          setHistorique(h)
          setNoteBaseline({ c, h })
          setEditorBaseline((prev) =>
            prev ? normalizeWorkFormDraftContent({ ...prev, commentaires: c, historique: h }) : prev,
          )
        } else {
          setNoteBaseline({ c: '', h: '' })
        }
      } finally {
        if (!cancelled) setLongTextReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [o.OeuvreID, longTextReloadNonce])

  useEffect(() => {
    if (ownStage !== 'loan' && ownStage !== 'consigned') {
      setActiveConsignment(null)
      return
    }
    const sb = createClient()
    void sb
      .from('consignment')
      .select('*, Contact(NomInstitution, Nom, "Prénom", Ville, Pays)')
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

  // Stage/photo auto-advance lives in USER-action handlers, not effects: the
  // effect versions replayed programmatic writes (row sync, restores, other
  // effects) as if the user had clicked, mutating prodStage with zero input —
  // the source of the recurring false "Unsaved changes" dialog.
  const handleProdStageChange = useCallback((next: ProdStageId) => {
    setProdStage(next)
    setNeedsPhoto(next === 'catalogued')
  }, [])

  const handleNeedsPhotoChange = useCallback((v: boolean) => {
    setNeedsPhoto(v)
    if (!v) setProdStage('available')
  }, [])

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

  const isDirty = useMemo(() => {
    if (!editorBaseline) return false
    return !workFormDraftContentEquals(captureDrawerDraftContent(), editorBaseline)
  }, [editorBaseline, captureDrawerDraftContent])

  isDirtyRef.current = isDirty

  const guardDiagRef = useRef<{ cap: () => WorkFormDraftContent; base: WorkFormDraftContent | null }>({
    cap: captureDrawerDraftContent,
    base: editorBaseline,
  })
  guardDiagRef.current = { cap: captureDrawerDraftContent, base: editorBaseline }

  // Junction map may hydrate after first paint — fill empty themes only; keep editorBaseline in sync.
  useEffect(() => {
    if (syncedOeuvreIdRef.current !== o.OeuvreID) return
    const mapThemes = oeuvreThemeMap.get(o.OeuvreID) ?? []
    const mapGroups = oeuvreGroupMap.get(o.OeuvreID) ?? []
    if (mapThemes.length === 0 && mapGroups.length === 0) return
    setSelThemes((prev) => {
      if (prev.size > 0) return prev
      if (mapThemes.length === 0) return prev
      return new Set(mapThemes)
    })
    setSelGroups((prev) => {
      if (prev.size > 0) return prev
      if (mapGroups.length === 0) return prev
      return new Set(mapGroups)
    })
    setEditorBaseline((prev) => {
      if (!prev) return prev
      const patch: Partial<WorkFormDraftContent> = {}
      if ((prev.selThemes?.length ?? 0) === 0 && mapThemes.length > 0) patch.selThemes = mapThemes
      if ((prev.selGroups?.length ?? 0) === 0 && mapGroups.length > 0) patch.selGroups = mapGroups
      if (Object.keys(patch).length === 0) return prev
      return normalizeWorkFormDraftContent({ ...prev, ...patch })
    })
  }, [o.OeuvreID, oeuvreThemeMap, oeuvreGroupMap])

  const runGuarded = useCallback((fn: () => void) => {
    if (!isDirtyRef.current) fn()
    else {
      // Diagnostic: name the fields that made the form dirty, so a false
      // "Unsaved changes" report can be pinned to a field instead of guessed.
      try {
        const { cap, base } = guardDiagRef.current
        if (base) {
          const cur = cap()
          const keys = (Object.keys(base) as (keyof WorkFormDraftContent)[])
            .filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(base[k]))
          console.warn(
            '[unsaved-guard] dirty:',
            keys.map((k) => `${k}: ${JSON.stringify(base[k])} -> ${JSON.stringify(cur[k])}`).join(' | '),
          )
        }
      // eslint-disable-next-line pem-i18n/no-silent-catch
      } catch { /* diagnostic only */ }
      pendingAfterGuardRef.current = fn
      setShowUnsavedModal(true)
    }
  }, [])

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
    if (table === 'Technique') { setLocalTechniques((p) => [...p, { TechniqueID: res.id, Technique: cap(name) }]); setTechniqueId(String(res.id)) }
    else if (table === 'Support') { setLocalSupports((p) => [...p, { SupportID: res.id, Support: cap(name) }]); setSupportId(String(res.id)) }
    else if (table === 'Format') { setLocalFormats((p) => [...p, { FormatID: res.id, Format: cap(name) }]); setFormatId(String(res.id)) }
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
    fd.append('broadcast_ready', broadcastReady ? '1' : '0')
    fd.append('broadcast_caption_seed', broadcastCaptionSeed ?? '')
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
        toast.error(workSaveErrorToastMessage(res.error, t))
        return false
      }
      try {
        sessionStorage.removeItem(draftKey)
      } catch { /* ignore */ }
      const commitEditorAfterSave = () => {
        const snap = captureDrawerDraftContent()
        submittedByOeuvreRef.current.set(oid, snap)
        setEditorBaseline(snap)
        onJunctionSaved?.(oid, snap.selThemes, snap.selGroups)
        emitJunctionSaved({ oeuvreId: oid, themeIds: snap.selThemes, groupIds: snap.selGroups })
      }
      if (res.pending) {
        commitEditorAfterSave()
        setNoteBaseline({ c: commentaires, h: historique })
        toast.success(t('wf_save_pending_toast'))
        return true
      }
      const savedLevel = normalizeAnonymityLevel(anonymityLevel)
      onWorkSaved?.(oid, { anonymity_level: savedLevel })
      commitEditorAfterSave()
      setNoteBaseline({ c: commentaires, h: historique })
      setLongTextReloadNonce((n) => n + 1)
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
          await enqueueOfflineWorkSaveFromFormData(fd)
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
    broadcastReady,
    broadcastCaptionSeed,
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
    onJunctionSaved,
    onWorkSaved,
    captureDrawerDraftContent,
  ])
  /* eslint-enable react-hooks/exhaustive-deps */

  useLayoutEffect(() => {
    if (guardApiRef) {
      guardApiRef.current.isDirty = () => isDirtyRef.current
      guardApiRef.current.performSave = performSave
    }
  }, [guardApiRef, isDirty, performSave])

  useLayoutEffect(() => {
    onDrawerDirtyChange?.(isDirty)
  }, [isDirty, onDrawerDirtyChange])

  const draftSnapshot = useMemo((): WorkFormDraftContent => ({
    titre, annee, techniqueId, supportId, formatId, hauteur, largeur, profondeur,
    prodStage, needsPhoto, ownStage, contactId, anonymityLevel,
    prix, tvaRate, discount, paymentDone, exposable, broadcastReady,
    commentaires, historique,
    selThemes: Array.from(selThemes), selGroups: Array.from(selGroups),
  }), [
    titre, annee, techniqueId, supportId, formatId, hauteur, largeur, profondeur,
    prodStage, needsPhoto, ownStage, contactId, anonymityLevel,
    prix, tvaRate, discount, paymentDone, exposable, broadcastReady,
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
    // A draft equal to the committed baseline holds no user input (e.g. leftovers from a
    // pre-fix false-dirty autosave) — drop it silently instead of prompting.
    if (editorBaseline && workFormDraftContentEquals(normalizeWorkFormDraftContent(d), editorBaseline)) {
      sessionStorage.removeItem(draftKey)
      return
    }
    const msg = `${t('wf_draft_restore_title')}\n\n${t('wf_draft_restore_body')}`
    if (!window.confirm(msg)) {
      sessionStorage.removeItem(draftKey)
      return
    }
    applyDraftContentToForm(d)
  }, [longTextReady, draftKey, draftSnapshot, editorBaseline, applyDraftContentToForm, t])

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (!longTextReady) return
        if (isDirty) {
          const payload: WorkFormDraftPayload = { ...draftSnapshot, savedAt: Date.now() }
          sessionStorage.setItem(draftKey, JSON.stringify(payload))
        } else {
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
    try {
      sessionStorage.removeItem(draftKey)
    } catch { /* ignore */ }
    submittedByOeuvreRef.current.delete(o.OeuvreID)
    setEditorBaseline(null)
    syncFormFieldsFromOeuvre()
    setLongTextReloadNonce((n) => n + 1)
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
        if ('error' in result) {
          const msg =
            result.error === 'work_delete_no_rows' || result.error === 'work_delete_partial'
              ? t(result.error as 'work_delete_no_rows')
              : `${t('error_prefix')} ${result.error}`
          setDeleteError(msg)
          toast.error(msg)
          return
        }
        onOeuvreRemoved?.(result.deletedIds ?? [oid])
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
      } catch (e: unknown) { setDeleteError(e instanceof Error ? e.message : String(e)) }
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

  const activeImage = activeImgIdx >= 0 ? drawerSorted[activeImgIdx] : null
  const activeImageCacheKey = activeImage ? imageCacheKeys[activeImage.ImageID] : undefined
  const thumbPreviewSrc = activeImgPath ? withCacheKey(thumbUrl(activeImgPath) ?? '', activeImageCacheKey) : ''
  const fullPreviewSrc = activeImgPath ? withCacheKey(imageUrl(activeImgPath) ?? '', activeImageCacheKey) : ''
  const showFullPreviewLayer = Boolean(activeImgPath && imgZoom > 1)
  /** Overlay rail is narrow: cap hero image so pipeline + fields stay reachable without huge scroll. */
  const previewMaxHeight = isPanel ? '70vh' : narrow ? '56vh' : 'min(44vh, 400px)'

  useEffect(() => {
    setFullPreviewReady(false)
  }, [activeImgPath, activeImageCacheKey])

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
    const newId = ((maxRow?.[0] as { ContactID?: number } | undefined)?.ContactID ?? 0) + 1
    const payload = {
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
    setLocalContacts((prev) => [...prev, newEntry])
    setContactId(String(newId))
    setShowNewContact(false)
    setNewC(EMPTY_CONTACT_DRAFT)
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
              type="button"
              onClick={() => setExpanded(!isExpanded)}
              aria-label={isExpanded ? t('wf_drawer_collapse') : t('wf_drawer_expand')}
              style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--tx3)', cursor: 'pointer', fontSize: 13, padding: '4px 8px', marginRight: 4, minHeight: 44, minWidth: 44 }}
              title={isExpanded ? t('wf_drawer_collapse') : t('wf_drawer_expand')}
            >{isExpanded ? '◀' : '▶'}</button>
          )}
          <button type="button" onClick={attemptClose} aria-label={t('close')} style={{ background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 24, padding: '0 6px', minHeight: 44, minWidth: 44 }}>×</button>
        </div>
      </div>

      <WorkDrawerImageArea
        o={o}
        narrow={narrow}
        imgContainerRef={imgContainerRef}
        imgZoom={imgZoom}
        imgPan={imgPan}
        setImgPan={setImgPan}
        setImgZoom={setImgZoom}
        isDragging={isDragging}
        dragStart={dragStart}
        latestMouseRef={latestMouseRef}
        panRafId={panRafId}
        activeImgPath={activeImgPath}
        thumbPreviewSrc={thumbPreviewSrc}
        fullPreviewSrc={fullPreviewSrc}
        showFullPreviewLayer={showFullPreviewLayer}
        fullPreviewReady={fullPreviewReady}
        setFullPreviewReady={setFullPreviewReady}
        setNaturalSize={setNaturalSize}
        previewMaxHeight={previewMaxHeight}
        drawerImageFileRef={drawerImageFileRef}
        onDrawerImageFileChange={onDrawerImageFileChange}
        retouchImageFileRef={retouchImageFileRef}
        onRetouchImageFileChange={onRetouchImageFileChange}
        drawerImageBusy={drawerImageBusy}
        drawerUploadPct={drawerUploadPct}
        drawerUploadName={drawerUploadName}
        drawerUploadIndex={drawerUploadIndex}
        drawerUploadTotal={drawerUploadTotal}
        drawerUploadCancelRef={drawerUploadCancelRef}
        workImages={workImages}
        drawerSorted={drawerSorted}
        activeImgIdx={activeImgIdx}
        setActiveImgIdx={setActiveImgIdx}
        imageCacheKeys={imageCacheKeys}
        drawerNudge={drawerNudge}
        drawerMakeCover={drawerMakeCover}
        drawerDeleteImage={drawerDeleteImage}
        drawerStartRetouch={drawerStartRetouch}
      />

      <WorkFormPhysicalQr oeuvreId={o.OeuvreID} titre={titre || o.Titre} />

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

      <WorkDrawerPipelineSection
        narrow={narrow}
        prodStage={prodStage}
        setProdStage={handleProdStageChange}
        needsPhoto={needsPhoto}
        setNeedsPhoto={handleNeedsPhotoChange}
        ownStage={ownStage}
        setOwnStage={setOwnStage}
        isOwnershipTransferred={isOwnershipTransferred}
        isArchived={isArchived}
        pemContact={pemContact}
        contactId={contactId}
        setContactId={setContactId}
        sortedContacts={sortedContacts}
        cName={cName}
        currentLoc={currentLoc}
        anonymityLevel={anonymityLevel}
        setAnonymityLevel={setAnonymityLevel}
        setShowNewContact={setShowNewContact}
      />

      {ownStage === 'sold' ? <SaleReturnWindowBanner oeuvreId={o.OeuvreID} /> : null}

      {/* ═══ EDITABLE FIELDS ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <DrawerContentIdentitySection
          t={t}
          annee={annee}
          setAnnee={setAnnee}
          techniqueId={techniqueId}
          setTechniqueId={setTechniqueId}
          supportId={supportId}
          setSupportId={setSupportId}
          hauteur={hauteur}
          setHauteur={setHauteur}
          largeur={largeur}
          setLargeur={setLargeur}
          profondeur={profondeur}
          setProfondeur={setProfondeur}
          localTechniques={localTechniques}
          localSupports={localSupports}
          saveLookup={saveLookup}
          encadree={encadree}
          setEncadree={setEncadree}
          broadcastReady={broadcastReady}
          setBroadcastReady={setBroadcastReady}
          broadcastCaptionSeed={broadcastCaptionSeed}
          setBroadcastCaptionSeed={setBroadcastCaptionSeed}
          presentationId={presentationId}
          setPresentationId={setPresentationId}
          initialPresentations={initialPresentations}
          initialThemes={initialThemes}
          selThemes={selThemes}
          setSelThemes={setSelThemes}
        />

        <DrawerContentFinanceSection
          narrow={narrow}
          lang={lang}
          t={t}
          prix={prix}
          setPrix={setPrix}
          discount={discount}
          setDiscount={setDiscount}
          tvaRate={tvaRate}
          setTvaRate={setTvaRate}
          prixFinalComputed={prixFinalComputed}
          paymentDone={paymentDone}
          setPaymentDone={setPaymentDone}
          ownStage={ownStage}
        />

        <DrawerContentGroupsSection t={t} initialGroups={initialGroups} selGroups={selGroups} setSelGroups={setSelGroups} />

        <DrawerWorkSessionsSection oeuvreId={o.OeuvreID} isAdmin={isAdmin} lang={lang} t={t} />

        <DrawerContentNotesVersionSection
          oeuvreId={o.OeuvreID}
          t={t}
          commentaires={commentaires}
          setCommentaires={setCommentaires}
          historique={historique}
          setHistorique={setHistorique}
          onVersionRestored={() => router.refresh()}
        />
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 14,
          borderTop: '1px solid var(--bd)',
          ...(narrow
            ? {
                position: 'sticky',
                bottom: 0,
                zIndex: 4,
                background: 'var(--bg1)',
                paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              }
            : {}),
        }}
      >
        <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={handleSubmit} disabled={isSaving} style={{ fontSize: 11, minHeight: 44 }}>
            {isSaving ? '…' : t('save')}
          </button>
          {narrow && (
            <>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44, fontSize: 18 }}
                aria-label={t('wf_mobile_add_photo')}
                onClick={() => drawerImageFileRef.current?.click()}
              >
                {t('wf_mobile_add_photo')}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44, fontSize: 18 }}
                aria-label={t('wf_mobile_pipeline_bump_aria')}
                title={t('wf_mobile_pipeline_bump_aria')}
                onClick={() => setProdStage(s => s === 'atelier' ? 'catalogued' : s === 'catalogued' ? 'available' : 'atelier')}
              >
                {t('wf_mobile_pipeline_bump')}
              </button>
            </>
          )}
          <button className={`btn ${isSel ? 'primary' : 'ghost'}`} onClick={handleToggleSel} style={{ fontSize: 11, minHeight: 44 }}>
            {isSel ? t('wf_in_selection_short') : t('wf_add_selection_short')}
          </button>
          {/* Direct gift path — disabled when ownership has already moved or work is archived */}
          {!(ownStage === 'sold' || ownStage === 'gift' || ownStage === 'artist_archive') && (
            <button
              className="btn ghost sm"
              style={{ fontSize: 11, color: 'var(--ac)', borderColor: 'rgba(200,168,110,0.4)', minHeight: 44 }}
              type="button"
              onClick={() => setShowGiftModal(true)}
              title={t('workDrawer_gift_body')}
            >
              ⊕ {t('workDrawer_gift_cta')}
            </button>
          )}
          {!confirmDelete ? (
            <button className="btn ghost sm" style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 10, minHeight: 44 }} onClick={() => setConfirmDelete(true)}>
              {t('delete')}
            </button>
          ) : (
            <div className="row gap-sm" style={{ marginLeft: 'auto', alignItems: 'center' }}>
              <button className="btn ghost sm" style={{ color: '#c0392b', minHeight: 44 }} disabled={deleting} onClick={handleDelete}>
                {deleting ? '…' : t('btn_confirm')}
              </button>
              <button type="button" className="btn ghost sm" aria-label={t('cancel')} onClick={() => { setConfirmDelete(false); setDeleteError(null) }}>×</button>
            </div>
          )}
        </div>
        {deleteError && <div style={{ color: '#c0392b', fontSize: 10, marginTop: 6 }}>{deleteError}</div>}
      </div>

      {showNewContact && (
        <NewContactModal
          newC={newC}
          setNewC={setNewC}
          creating={creatingContact}
          t={t}
          onCreate={handleCreateContact}
          onClose={() => { setShowNewContact(false); setNewC(EMPTY_CONTACT_DRAFT) }}
        />
      )}

      {showUnsavedModal && (
        <UnsavedChangesModal
          saving={savingExit}
          t={t}
          onDiscard={discardUnsavedClose}
          onCancel={() => { setShowUnsavedModal(false); pendingAfterGuardRef.current = null }}
          onSaveAndClose={() => void handleSaveAndClose()}
        />
      )}

      {showGiftModal && (
        <GiftTransferModal
          oeuvreId={o.OeuvreID}
          recipients={sortedContacts}
          cName={cName}
          t={t}
          onClose={() => setShowGiftModal(false)}
          onGifted={() => { setShowGiftModal(false); setLongTextReloadNonce((n) => n + 1); router.refresh() }}
        />
      )}
    </>
  )

}
