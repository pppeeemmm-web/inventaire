'use client'

import { imageUrl, thumbUrl, yearOf, PEM_CONTACT_ID } from '@/lib/data'
import { deleteWork, purgeWorkPermanently, restoreSoftDeletedWorks, revertWorkSnapshot, loadOeuvreLongText, type WorkRevertSnapshot } from '@/app/atelier/works/actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState, useTransition, useCallback, useRef, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { saveWork, createLookup, addWorkImage, reorderWorkImages, deleteWorkImage, replaceWorkImage } from '@/app/atelier/works/actions'
import { toast } from '@/lib/ui/toast'
import { workSaveErrorToastMessage } from '@/lib/work-save-error'
import { registerUndo, consumeUndo } from '@/lib/ui/undo'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { openReadOr, primeWorkDrawerOpen } from '@/lib/atelier/open-reads'
import { drawerOpenKey } from '@/lib/atelier/open-read-keys'
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
import { DrawerWorkSessionsSection } from './DrawerWorkSessionsSection'
import { CommissionClient, ContactConfidentialityPart } from './WorkDrawerPipelineSection'
import { CardDrawer, Chip, Part, PickChips } from './WorkCardParts'
import { ShipmentTopChip, WorkLogisticsPart, isShipmentOpen, useWorkShipments } from './WorkCardLogistics'
import { WorkCardIdentity, emptyIdentityLabels } from './WorkCardIdentity'
import { WorkCreationHistory } from './WorkCreationHistory'
import { WorkVersionHistory } from '../WorkVersionHistory'
import { emitJunctionSaved } from '@/lib/atelier/junction-refresh-bus'
import { NewContactModal, EMPTY_CONTACT_DRAFT } from './NewContactModal'
import { UnsavedChangesModal } from './UnsavedChangesModal'
import { GiftTransferModal } from './GiftTransferModal'
import { ContactQuickModal } from './ContactQuickModal'
import { WorkLinksSection } from './WorkLinksSection'
import { FIS, cap } from './drawer-widgets'
import { WorkFormPhysicalQr } from '@/components/atelier/WorkFormPhysicalQr'
import { WorkProductionSpan } from './WorkProductionSpan'
import { WorkCostBlock } from './WorkCostBlock'
import { LinkedVoiceNotes } from '@/components/atelier/LinkedVoiceNotes'
import { WorkNoteLines } from './WorkNoteLines'
import { ConditionReportsSection } from './ConditionReportsSection'
import { WorkPeriodSourceSection } from './WorkPeriodSourceSection'
import { WorkAiDescriptionSection } from './WorkAiDescriptionSection'
import { workWhen } from '@/lib/work-periods'
import { normalizeAnonymityLevel } from '@/lib/anonymity-level'
import { formatPartialDate } from '@/lib/partial-date'
import { useConfirmStep } from '@/hooks/useConfirmStep'
import { findOrderForWork, type ProcessOrderLink, type WorkOrderKind } from '@/app/atelier/(portal)/sales/orders-actions'
import type { WorkSaleMoney } from '@/lib/sales/work-paid'

const WORK_CARD_VIEW_KEY = 'pem.workCard.view'

function withCacheKey(src: string, cacheKey?: string): string {
  if (!src || !cacheKey) return src
  return `${src}${src.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheKey)}`
}


/**
 * Fields the card saves that live outside the guarded draft (lib/mobile/work-form-draft): Encadrée,
 * Montée, Commande, Logistique dates, presentation type, caption seed. Their own baseline = the work
 * as loaded, then what was last sent (a pending save keeps them clean too).
 */
type ExtraFields = { encadree: boolean; montee: boolean; isCommission: boolean; dateLivraison: string; returnDate: string; presentationId: string; seed: string }
function extraFromOeuvre(o: object): ExtraFields {
  const r = o as { Encadree?: boolean | null; Montee?: boolean | null; IsCommission?: boolean | null; DateLivraison?: string | null; ReturnDate?: string | null; PresentationID?: number | null; broadcast_caption_seed?: string | null }
  return {
    encadree: !!r.Encadree,
    montee: !!r.Montee,
    isCommission: !!r.IsCommission,
    dateLivraison: String(r.DateLivraison ?? '').slice(0, 10),
    returnDate: String(r.ReturnDate ?? '').slice(0, 10),
    presentationId: String(r.PresentationID ?? ''),
    seed: String(r.broadcast_caption_seed ?? ''),
  }
}

/** The card's contacts + the shell's list: the card's rows win (made here with « + », renamed in the contact
 *  pop-up), the shell's list only adds the ones the card doesn't have. */
function mergeCardContacts(card: DrawerContactRow[], incoming: DrawerContactRow[]): DrawerContactRow[] {
  const have = new Set(card.map((c) => c.ContactID))
  const add = incoming.filter((c) => !have.has(c.ContactID))
  return add.length ? [...card, ...add] : card
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
  initialContacts, initialAddresses = [], initialGroups, initialPresentations,
  mode, isExpanded: _isExpanded, setExpanded, wide = false,
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
  // Work card R3 (docs/design/2026-11-16/WorkCard.notes.md): « Replié » (default) = top block in
  // full, Création + Objet closed, empty fields in one grey line; « Développé » = both open, empty
  // parts greyed in place. The choice is remembered on this browser.
  const [view, setView] = useState<'folded' | 'open'>('folded')
  const [creationOpen, setCreationOpen] = useState(false)
  const [objectOpen, setObjectOpen] = useState(false)
  const [stagedCount, setStagedCount] = useState(0)
  const [voiceCount, setVoiceCount] = useState(0)
  const [aiToJudge, setAiToJudge] = useState(false)
  useEffect(() => {
    let v: string | null = null
    try { v = localStorage.getItem(WORK_CARD_VIEW_KEY) } catch { /* ignore */ }
    if (v === 'open') {
      setView('open')
      setCreationOpen(true)
      setObjectOpen(true)
    }
  }, [])
  const setViewPersist = useCallback((v: 'folded' | 'open') => {
    setView(v)
    setCreationOpen(v === 'open')
    setObjectOpen(v === 'open')
    try { localStorage.setItem(WORK_CARD_VIEW_KEY, v) } catch { /* ignore */ }
  }, [])
  useEffect(() => { setStagedCount(0); setVoiceCount(0); setAiToJudge(false) }, [o.OeuvreID])
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
  // The stage is held once (docs/WORK_RULES.md, #2381): « photo to take » IS the Catalogué step,
  // never a second switch that can disagree with it.
  const needsPhoto = prodStage === 'catalogued'
  const [ownStage, setOwnStage] = useState<OwnStageId>(() => ownStageFromStatusId(o.statusId))
  // Custody model (docs/WORK_CUSTODY_MODEL.md): contactId = custodian (LocalisationID),
  // ownerId = owner (ContactID), buyerId = buyer (AcheteurID).
  const [contactId, setContactId] = useState(String(o.LocalisationID ?? ''))
  const [ownerId, setOwnerId] = useState(String(o.ContactID ?? ''))
  const [buyerId, setBuyerId] = useState(String((o as { AcheteurID?: number | null }).AcheteurID ?? ''))
  const [localisationAddressId, setLocalisationAddressId] = useState(
    String((o as { localisation_address_id?: number | null }).localisation_address_id ?? ''),
  )
  const [exposable,   setExposable]   = useState(!!o.Exposable)
  const [broadcastReady, setBroadcastReady] = useState(!!(o as { broadcast_ready?: boolean }).broadcast_ready)
  const [broadcastCaptionSeed, setBroadcastCaptionSeed] = useState(String((o as { broadcast_caption_seed?: string | null }).broadcast_caption_seed ?? ''))
  const [encadree,    setEncadree]    = useState(!!o.Encadree)
  // R3 step 2 — Présentation « Montée », Valeur « Commande », Logistique dates (saved with the card).
  const [montee, setMontee] = useState(!!(o as { Montee?: boolean | null }).Montee)
  const [isCommission, setIsCommission] = useState(!!(o as { IsCommission?: boolean | null }).IsCommission)
  const [dateLivraison, setDateLivraison] = useState(String((o as { DateLivraison?: string | null }).DateLivraison ?? '').slice(0, 10))
  const [returnDate, setReturnDate] = useState(String((o as { ReturnDate?: string | null }).ReturnDate ?? '').slice(0, 10))
  const [extraBase, setExtraBase] = useState(() => JSON.stringify(extraFromOeuvre(o)))
  const [prix,        setPrix]        = useState(String(o.Prix ?? '0'))
  const [tvaRate, setTvaRate] = useState(String((o as { tva_rate?: number | null }).tva_rate ?? '0'))
  const [discount, setDiscount] = useState(String((o as { Discount?: number | null }).Discount ?? '0'))
  const [paymentDone, setPaymentDone] = useState(!!((o as { PaymentDone?: boolean; is_paid?: boolean | null }).PaymentDone ?? (o as { is_paid?: boolean | null }).is_paid ?? false))
  const [commentaires, setCommentaires] = useState('')
  const [historique, setHistorique] = useState('')
  const [selThemes, setSelThemes] = useState<Set<number>>(new Set())
  const [selGroups, setSelGroups] = useState<Set<string>>(new Set())
  const [localContacts, setLocalContacts] = useState<DrawerContactRow[]>(initialContacts as DrawerContactRow[])
  /** Contact card open over the drawer (↗ in Ownership); the work stays open underneath. */
  const [quickContactId, setQuickContactId] = useState<number | null>(null)
  const [showNewContact, setShowNewContact] = useState(false)
  const [newC, setNewC] = useState(EMPTY_CONTACT_DRAFT)
  const [creatingContact, setCreatingContact] = useState(false)
  const [anonymityLevel, setAnonymityLevel] = useState<number>(() =>
    normalizeAnonymityLevel((o as { anonymity_level?: unknown }).anonymity_level),
  )

  // ── Order modal (« Don… », « Dépôt… », « Prêt… », « Vendu… » → a draft order, R7) ──
  const [orderModalKind, setOrderModalKind] = useState<WorkOrderKind | null>(null)
  const [orderLink, setOrderLink] = useState<(ProcessOrderLink & { party: string; sale: WorkSaleMoney | null }) | null>(null)
  useEffect(() => {
    let live = true
    setOrderLink(null)
    findOrderForWork(o.OeuvreID)
      .then((link) => { if (live) setOrderLink(link) })
      // The link is a convenience: without it the stage chip just stays locked.
      // eslint-disable-next-line pem-i18n/no-silent-catch -- the chip falls back to its locked state
      .catch(() => {})
    return () => { live = false }
  }, [o.OeuvreID, o.statusId])
  const [noteBaseline, setNoteBaseline] = useState({ c: '', h: '' })
  /** False after a session draft is restored: its Historique was edited from an older text, so the
   *  server must keep every stored line (no base sent → union). docs/WORK_RULES.md rule 14. */
  const historiqueBaseKnownRef = useRef(true)
  const { confirmStep, confirmDialog } = useConfirmStep()

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
  /** Objet › Logistique + Top chip: the work's shipments (read-only). */
  const shipments = useWorkShipments(o.OeuvreID)
  /** Header « modifié par »: `edited_by` (auth uuid) → the team member's contact name. Read-only, one row. */
  const [editInfo, setEditInfo] = useState<{ at: string | null; who: string } | null>(null)
  useEffect(() => {
    let alive = true
    setEditInfo(null)
    void (async () => {
      const sb = createClient()
      const { data: row } = await sb.from('Oeuvres').select('edited_at, edited_by').eq('OeuvreID', o.OeuvreID).maybeSingle()
      if (!alive || !row) return
      let who = ''
      if (row.edited_by) {
        const { data: cs } = await sb.from('Contact').select('NomInstitution, "Prénom", Nom').eq('auth_user_id', row.edited_by).limit(1)
        const c = cs?.[0]
        if (c) who = [c.Prénom, c.Nom].filter(Boolean).join(' ') || c.NomInstitution || ''
      }
      if (alive) setEditInfo({ at: row.edited_at, who })
    })().catch(() => { /* the name is optional; the header keeps the date */ })
    return () => {
      alive = false
    }
  }, [o.OeuvreID, longTextReloadNonce])

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
        localisationAddressId,
        ownerId,
        buyerId,
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
      localisationAddressId,
      ownerId,
      buyerId,
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
    // An older draft kept the photo switch apart: « Disponible » + photo to take = the Catalogué step.
    const draftStage = (d.prodStage as ProdStageId) || 'atelier'
    setProdStage(draftStage === 'available' && d.needsPhoto ? 'catalogued' : draftStage)
    setOwnStage((d.ownStage as OwnStageId) || 'artist')
    setContactId(d.contactId ?? '')
    setLocalisationAddressId(d.localisationAddressId ?? '')
    setOwnerId(d.ownerId ?? '')
    setBuyerId(d.buyerId ?? '')
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
    setOwnStage(loadedOwn)
    // Pem by id, not by name, and whether or not the contact list has arrived yet: the stage effects below
    // set owner / custodian to Pem as soon as `pemContact` exists, so the baseline must already say Pem —
    // otherwise a card opened before the list (QR link, ⌘K) turns « unsaved » with no input.
    const pemRow = (initialContacts as DrawerContactRow[]).find((c) => c.ContactID === PEM_CONTACT_ID)
    const pemId = String(pemRow?.ContactID ?? PEM_CONTACT_ID)
    let loadedContactId = String(o.LocalisationID ?? '')
    let loadedOwnerId = String(o.ContactID ?? '')
    if (loadedOwn === 'artist' || loadedOwn === 'artist_archive') {
      // Archive: the artist holds it by default, but an admin may have set another custodian (R3 rule).
      if (loadedOwn === 'artist' || !loadedContactId) loadedContactId = pemId
      loadedOwnerId = pemId
    } else if (loadedOwn === 'reserved') {
      // Reserved: payment not cleared, Pem still owns it — the stage effect below sets the owner to Pem too.
      loadedOwnerId = pemId
    }
    const loadedBuyerId = String((o as { AcheteurID?: number | null }).AcheteurID ?? '')
    const loadedAddressId = String(
      (o as { localisation_address_id?: number | null }).localisation_address_id ?? '',
    )
    setContactId(loadedContactId)
    setOwnerId(loadedOwnerId)
    setBuyerId(loadedBuyerId)
    setLocalisationAddressId(loadedAddressId)
    setExposable(loadedOwn === 'artist_archive' ? false : !!o.Exposable)
    setBroadcastReady(!!(o as { broadcast_ready?: boolean }).broadcast_ready)
    setBroadcastCaptionSeed(String((o as { broadcast_caption_seed?: string | null }).broadcast_caption_seed ?? ''))
    setEncadree(!!o.Encadree)
    setMontee(!!(o as { Montee?: boolean | null }).Montee)
    setIsCommission(!!(o as { IsCommission?: boolean | null }).IsCommission)
    setDateLivraison(String((o as { DateLivraison?: string | null }).DateLivraison ?? '').slice(0, 10))
    setReturnDate(String((o as { ReturnDate?: string | null }).ReturnDate ?? '').slice(0, 10))
    setExtraBase(JSON.stringify(extraFromOeuvre(o)))
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
    setLocalContacts((prev) => mergeCardContacts(prev, initialContacts as DrawerContactRow[]))
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
          localisationAddressId: loadedAddressId,
          ownerId: loadedOwnerId,
          buyerId: loadedBuyerId,
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

  // One read for the whole card (TODO 18): runs before the sections' effects, which take their slice.
  useLayoutEffect(() => {
    primeWorkDrawerOpen(o.OeuvreID, { cost: isAdmin, returnHint: ownStageFromStatusId(o.statusId) === 'sold' })
    // Only when the open work changes; a later admin flag or stage change makes that section read on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.OeuvreID])

  /** Last (work, reload nonce) the long text was read for: a nonce bump is a reload, not an open. */
  const longTextReadRef = useRef<{ id: number; nonce: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    const last = longTextReadRef.current
    const isOpen = !last || last.id !== o.OeuvreID || last.nonce === longTextReloadNonce
    longTextReadRef.current = { id: o.OeuvreID, nonce: longTextReloadNonce }
    void (async () => {
      try {
        const r = isOpen
          ? await openReadOr(drawerOpenKey.longText(o.OeuvreID), () => loadOeuvreLongText(o.OeuvreID))
          : await loadOeuvreLongText(o.OeuvreID)
        if (cancelled) return
        if (!('error' in r)) {
          const c = r.Commentaires ?? ''
          const h = r.Historique ?? ''
          setCommentaires(c)
          setHistorique(h)
          setNoteBaseline({ c, h })
          historiqueBaseKnownRef.current = true
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
    pendingAfterGuardRef.current = null
    setShowUnsavedModal(false)
  }, [o.OeuvreID])

  // Lookups
  const [localTechniques, setLocalTechniques] = useState(initialTechniques)
  const [localSupports,   setLocalSupports]   = useState(initialSupports)
  const [localFormats,    setLocalFormats]    = useState(initialFormats)

  // The Atelier paints with empty lookups and fills them post-paint; a drawer opened before that
  // kept empty pickers ("—" only) — bug 1, owner 2026-11-12. Refill from the props when they
  // arrive, keeping entries created here with "+" that the props don't have yet.
  useEffect(() => {
    setLocalTechniques((prev) => [...initialTechniques, ...prev.filter((p) => !initialTechniques.some((i) => i.TechniqueID === p.TechniqueID))])
  }, [initialTechniques])
  useEffect(() => {
    setLocalSupports((prev) => [...initialSupports, ...prev.filter((p) => !initialSupports.some((i) => i.SupportID === p.SupportID))])
  }, [initialSupports])
  useEffect(() => {
    setLocalFormats((prev) => [...initialFormats, ...prev.filter((p) => !initialFormats.some((i) => i.FormatID === p.FormatID))])
  }, [initialFormats])
  // Same for contacts: every tab fills them post-paint, but the card took them only when the work changed,
  // so a card opened before that (QR link `?work=`, ⌘K) named owner / custodian « — » and its pickers
  // offered almost no one (stress test 2026-11-18). The card's own rows win (made with « + », renamed in the
  // contact pop-up); the list only fills in what the card doesn't have.
  useEffect(() => {
    setLocalContacts((prev) => mergeCardContacts(prev, initialContacts as DrawerContactRow[]))
  }, [initialContacts])

  /** Addresses belonging to the contact that currently holds the work. */
  const locationAddresses = useMemo(
    () => initialAddresses.filter((a) => String(a.contact_id) === contactId),
    [initialAddresses, contactId],
  )

  // A pinned address must belong to the holding contact: clear it when ownership moves,
  // otherwise a transferred work would keep pointing at its previous owner's address.
  // Addresses hydrate after first paint: an empty list means "not loaded yet", not "moved".
  useEffect(() => {
    if (!localisationAddressId || locationAddresses.length === 0) return
    if (!locationAddresses.some((a) => String(a.id) === localisationAddressId)) {
      setLocalisationAddressId('')
    }
  }, [locationAddresses, localisationAddressId])

  // Pem's address by stage (Atelier / Principal) is set by DB trigger oeuvre_location_by_stage on
  // save; the drawer shows it and lets you pick (docs/WORK_CUSTODY_MODEL.md).

  const pemContact = useMemo(
    () => localContacts.find((c: DrawerContactRow) => c.ContactID === PEM_CONTACT_ID),
    [localContacts],
  )
  const currentOwner = useMemo(
    () => localContacts.find((c: DrawerContactRow) => String(c.ContactID) === ownerId),
    [localContacts, ownerId],
  )
  const currentCustodian = useMemo(
    () => localContacts.find((c: DrawerContactRow) => String(c.ContactID) === contactId),
    [localContacts, contactId],
  )

  const prixVal = parseFloat(prix) || 0
  const discVal = parseFloat(discount) || 0
  const prixFinalComputed = ownStage === 'gift' ? 0 : prixVal * (1 - discVal / 100)

  const isOwnershipTransferred = ownStage === 'sold' || ownStage === 'gift'
  const isArchived = ownStage === 'artist_archive'

  /** Custodian shown next to the address picker. */
  const currentLoc = currentCustodian
    ? (currentCustodian.NomInstitution || [currentCustodian.Prénom, currentCustodian.Nom].filter(Boolean).join(' ') || `#${currentCustodian.ContactID}`)
    : '—'

  // Stage/photo auto-advance lives in USER-action handlers, not effects: the
  // effect versions replayed programmatic writes (row sync, restores, other
  // effects) as if the user had clicked, mutating prodStage with zero input —
  // the source of the recurring false "Unsaved changes" dialog.
  // Validating the photo of a studio work makes it Disponible and public (WORK_RULES §5, decided
  // 2026-11-17): ask first, unless the work is already Disponible.
  const loadedReady = prodStageFromOeuvre(o) === 'available'
  const askPhotoGo = useCallback(
    async (next: ProdStageId): Promise<boolean> => {
      if (next !== 'available' || prodStage === 'available' || ownStage !== 'artist' || loadedReady) return true
      return confirmStep({
        title: t('wr_photo_go_title'),
        body: t('wr_photo_go_body'),
        confirmLabel: t('wr_photo_go_ok'),
        cancelLabel: t('wr_photo_go_cancel'),
      })
    },
    [prodStage, ownStage, loadedReady, confirmStep, t],
  )

  const handleProdStageChange = useCallback((next: ProdStageId) => {
    void askPhotoGo(next).then((ok) => { if (ok) setProdStage(next) })
  }, [askPhotoGo])

  const handleNeedsPhotoChange = useCallback((v: boolean) => {
    const next: ProdStageId = v ? 'catalogued' : 'available'
    void askPhotoGo(next).then((ok) => { if (ok) setProdStage(next) })
  }, [askPhotoGo])

  useEffect(() => {
    if (ownStage === 'gift') {
      setPrix('0')
      setDiscount('0')
    }
  }, [ownStage])

  // R3 rule: a work moved into the artist's archive is held by the artist (admin may change it after).
  const loadedArchived = ownStageFromStatusId(o.statusId) === 'artist_archive'
  useEffect(() => {
    if (isArchived && !loadedArchived && pemContact) setContactId(String(pemContact.ContactID))
  }, [isArchived, loadedArchived, pemContact])

  // Reserved: payment not cleared, Pem still owns it (the picked contact is the buyer).
  useEffect(() => {
    if (ownStage === 'reserved' && pemContact) setOwnerId(String(pemContact.ContactID))
  }, [ownStage, pemContact])

  useEffect(() => {
    if (isOwnershipTransferred && prodStage === 'atelier') setProdStage('available')
  }, [isOwnershipTransferred, prodStage])

  // Archive needs a catalogued work (Pem 2026-11-17, archive_shelf.sql): the Archive pill stays
  // closed while the stage is « Atelier » — nothing ticks « Catalogué » behind the user's back.

  useEffect(() => {
    if ((ownStage === 'artist' || ownStage === 'artist_archive') && pemContact) {
      if (ownStage === 'artist' || !loadedArchived) setContactId(String(pemContact.ContactID))
      setOwnerId(String(pemContact.ContactID))
    }
  }, [ownStage, pemContact, loadedArchived])

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

  const extraNow: ExtraFields = { encadree, montee, isCommission, dateLivraison, returnDate, presentationId, seed: broadcastCaptionSeed ?? '' }
  const extraDirty = JSON.stringify(extraNow) !== extraBase
  // R1 4b: an unsent line in « Lignes » counts as unsaved too (Save adds it, Discard drops it).
  const [lineDraft, setLineDraft] = useState('')
  const [lineFlag, setLineFlag] = useState(false)
  const lineSubmitRef = useRef<(() => Promise<boolean>) | null>(null)
  const lineDirty = lineDraft.trim() !== ''
  const lineDirtyRef = useRef(false)
  lineDirtyRef.current = lineDirty
  useEffect(() => {
    setLineDraft('')
    setLineFlag(false)
  }, [o.OeuvreID])
  const formDirtyRef = useRef(false)
  formDirtyRef.current = isDirty || extraDirty
  isDirtyRef.current = isDirty || extraDirty || lineDirty

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
    // Owner / custodian / buyer kept apart (docs/WORK_CUSTODY_MODEL.md; DB trigger
    // oeuvre_holder_check enforces the table).
    fd.append('contact_id', ownerId)
    fd.append('localisation_id', contactId)
    fd.append('localisation_address_id', localisationAddressId)
    fd.append('acheteur_id', buyerId)
    fd.append('exposable', exposable ? '1' : '0')
    fd.append('broadcast_ready', broadcastReady ? '1' : '0')
    fd.append('broadcast_caption_seed', broadcastCaptionSeed ?? '')
    fd.append('encadree', encadree ? '1' : '0')
    // A row loaded without the Montee column (older cache) must not clear it: send it only when known or set.
    if ('Montee' in o || montee) fd.append('montee', montee ? '1' : '0')
    fd.append('is_commission', isCommission ? '1' : '0')
    fd.append('date_livraison', dateLivraison)
    fd.append('return_date', returnDate)
    fd.append('prix', prix)
    fd.append('discount', discount)
    fd.append('prix_final', String(prixFinalComputed))
    fd.append('tva_rate', tvaRate)
    fd.append('is_paid', paymentDone ? '1' : '0')
    fd.append('commentaires', commentaires)
    fd.append('historique', historique)
    // The text this card loaded: the server keeps any line the database wrote since (rule 14).
    if (historiqueBaseKnownRef.current) fd.append('historique_base', noteBaseline.h)
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
        setExtraBase(JSON.stringify(extraNow))
      }
      if (res.pending) {
        commitEditorAfterSave()
        setNoteBaseline({ c: commentaires, h: historique })
        toast.success(t('wf_save_pending_toast'))
        return true
      }
      const savedLevel = normalizeAnonymityLevel(anonymityLevel)
      // Patch the list row with what the DB stored (triggers included) — pill/location update, no reload.
      onWorkSaved?.(oid, { anonymity_level: savedLevel, ...res.saved })
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
    localisationAddressId,
    ownerId,
    buyerId,
    exposable,
    broadcastReady,
    broadcastCaptionSeed,
    encadree,
    montee,
    isCommission,
    dateLivraison,
    returnDate,
    prix,
    discount,
    tvaRate,
    paymentDone,
    commentaires,
    historique,
    noteBaseline,
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

  /** Save = the unsent line first (if any), then the work form — skipped when only the line was unsaved. */
  const saveAll = useCallback(async (): Promise<boolean> => {
    const lineOnly = lineDirtyRef.current && !formDirtyRef.current
    if (lineDirtyRef.current && lineSubmitRef.current) {
      const ok = await lineSubmitRef.current()
      if (!ok) return false
    }
    return lineOnly ? true : performSave()
  }, [performSave])

  useLayoutEffect(() => {
    if (guardApiRef) {
      guardApiRef.current.isDirty = () => isDirtyRef.current
      guardApiRef.current.performSave = saveAll
    }
  }, [guardApiRef, isDirty, extraDirty, lineDirty, saveAll])

  useLayoutEffect(() => {
    onDrawerDirtyChange?.(isDirty || extraDirty || lineDirty)
  }, [isDirty, extraDirty, lineDirty, onDrawerDirtyChange])

  const draftSnapshot = useMemo((): WorkFormDraftContent => ({
    titre, annee, techniqueId, supportId, formatId, hauteur, largeur, profondeur,
    prodStage, needsPhoto, ownStage, contactId, localisationAddressId, ownerId, buyerId, anonymityLevel,
    prix, tvaRate, discount, paymentDone, exposable, broadcastReady,
    commentaires, historique,
    selThemes: Array.from(selThemes), selGroups: Array.from(selGroups),
  }), [
    titre, annee, techniqueId, supportId, formatId, hauteur, largeur, profondeur,
    prodStage, needsPhoto, ownStage, contactId, localisationAddressId, ownerId, buyerId, anonymityLevel,
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
    historiqueBaseKnownRef.current = false
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
      await saveAll()
    })
  }

  async function handleSaveAndClose() {
    setSavingExit(true)
    try {
      const ok = await saveAll()
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
    setLineDraft('')
    setLineFlag(false)
    setShowUnsavedModal(false)
    const run = pendingAfterGuardRef.current
    pendingAfterGuardRef.current = null
    run?.()
  }

  /** Sticky bar « Annuler »: back to the saved work, the card stays open. */
  function discardInPlace() {
    try {
      sessionStorage.removeItem(draftKey)
    } catch { /* ignore */ }
    submittedByOeuvreRef.current.delete(o.OeuvreID)
    setEditorBaseline(null)
    syncFormFieldsFromOeuvre()
    setLongTextReloadNonce((n) => n + 1)
    setLineDraft('')
    setLineFlag(false)
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
              : workSaveErrorToastMessage(result.error, t)
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

  /** Objet › Zone admin: permanent delete (`purgeWorkPermanently`, admin only — no undo). */
  function handlePurge() {
    if (!window.confirm(t('wc_purge_confirm_fmt').replace('{id}', String(o.OeuvreID)))) return
    startDelete(async () => {
      const oid = o.OeuvreID
      try {
        const result = await purgeWorkPermanently(oid)
        if ('error' in result) {
          const msg = workSaveErrorToastMessage(result.error, t)
          setDeleteError(msg)
          toast.error(msg)
          return
        }
        onOeuvreRemoved?.([oid])
        onClose()
        router.refresh()
        toast.success(t('wc_purge_done'))
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setDeleteError(msg)
        toast.error(msg)
      }
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
  const fateLastLocation = (() => {
    if (!o.fate || o.LocalisationID == null) return ''
    const c = localContacts.find((x) => x.ContactID === o.LocalisationID)
    return c ? cName(c) : ''
  })()
  const sortedContacts = [...localContacts].sort((a, b) => cName(a).localeCompare(cName(b), 'fr'))

  const activeImage = activeImgIdx >= 0 ? drawerSorted[activeImgIdx] : null
  const activeImageCacheKey = activeImage ? imageCacheKeys[activeImage.ImageID] : undefined
  const thumbPreviewSrc = activeImgPath ? withCacheKey(thumbUrl(activeImgPath) ?? '', activeImageCacheKey) : ''
  const fullPreviewSrc = activeImgPath ? withCacheKey(imageUrl(activeImgPath) ?? '', activeImageCacheKey) : ''
  // Thumbs are 400 px: at the taller hero size (below) they would be blown up, so off the phone the full image
  // fades in over the thumb at once, not only on zoom.
  const showFullPreviewLayer = Boolean(activeImgPath && (imgZoom > 1 || !narrow))
  /** Hero image height. Pem 2026-11-18 (« more vertical room for the image PLEASE »): the old caps
   *  (panel 360 px, wide 520 px) left a tall screen mostly empty; the fields below scroll anyway. */
  const previewMaxHeight = wide && !narrow ? 'min(78vh, 960px)' : isPanel ? 'min(72vh, 860px)' : narrow ? '62vh' : 'min(64vh, 720px)'

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

  const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
  const openShipment = shipments?.find(isShipmentOpen) ?? null
  const gatesOn = [montee, encadree, exposable, broadcastReady].filter(Boolean).length
  const folded = view === 'folded'
  const twoCol = !!wide && !narrow
  /** Parts stack their label over the content where the card is one narrow column. */
  const stacked = narrow || (isPanel && !twoCol)
  const startedLabel = o.production_started_on ? formatPartialDate(o.production_started_on, o.production_started_precision, loc) : ''
  const completedLabel = o.production_completed_on ? formatPartialDate(o.production_completed_on, o.production_completed_precision, loc) : ''
  const editedAt = editInfo?.at ?? (o as { edited_at?: string | null }).edited_at
  const editedLabel = editedAt
    ? new Date(editedAt).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
  const editedText = editedLabel
    ? editInfo?.who
      ? t('wc_modified_by_fmt').replace('{who}', editInfo.who).replace('{date}', editedLabel)
      : t('wc_modified_fmt').replace('{date}', editedLabel)
    : ''
  const when = workWhen({
    Année: annee,
    production_started_on: o.production_started_on,
    production_completed_on: o.production_completed_on,
    production_started_precision: o.production_started_precision,
    production_completed_precision: o.production_completed_precision,
  })
  const fateText = o.fate
    ? [
        (ownStage === 'sold' || ownStage === 'gift' ? `${statusLabelMap[o.statusId ?? 0] ?? ''} · ` : '')
          + t(o.fate === 'destroyed' ? 'fate_destroyed_fmt' : o.fate === 'stolen' ? 'fate_stolen_fmt' : 'fate_lost_fmt')
            .replace('{date}', formatPartialDate(o.fate_on, o.fate_precision, loc)),
        fateLastLocation ? t('fate_last_location_fmt').replace('{loc}', fateLastLocation) : '',
      ].filter(Boolean).join(' — ')
    : ''
  const isGiftStage = ownStage === 'gift'
  const priceEmpty = prixVal === 0 && !isGiftStage
  const creationSummary = [
    yearOf(annee) != null ? t('wc_sum_period_fmt').replace('{p}', String(yearOf(annee))) : '',
    commentaires.trim() ? t('wc_sum_comments') : '',
    voiceCount ? t('wc_sum_voice_fmt').replace('{n}', String(voiceCount)) : '',
    selThemes.size ? t('wc_sum_themes_fmt').replace('{n}', String(selThemes.size)) : '',
    stagedCount ? t('wc_session_photos_fmt').replace('{n}', String(stagedCount)) : '',
    aiToJudge ? t('wc_sum_ai_to_judge') : '',
  ].filter(Boolean).join(' · ') || t('wc_sum_none')
  const objectSummary = [
    historique.trim() ? t('wc_sum_provenance') : '',
    !priceEmpty && !isGiftStage ? t('wc_sum_price_fmt').replace('{p}', `€ ${prixFinalComputed.toLocaleString(loc)}`) : '',
    paymentDone ? t('wc_sum_paid') : '',
    selGroups.size ? t('wc_sum_groups_fmt').replace('{n}', String(selGroups.size)) : '',
    openShipment ? t('wc_sum_shipping') : '',
    t('wc_sum_gates_fmt').replace('{n}', String(gatesOn)),
    isCommission ? t('wc_sum_commission') : '',
    o.fate ? t('wc_sum_fate') : '',
    t('wc_sum_label'),
  ].filter(Boolean).join(' · ')
  const emptyLabels = [
    ...(titre.trim() ? [] : [t('untitled').toLowerCase()]),
    ...emptyIdentityLabels(t, { annee, techniqueId, supportId, formatId, hauteur, largeur, profondeur, hasSpan: !!(startedLabel || completedLabel) }),
    ...(selThemes.size ? [] : [t('wc_p_themes').toLowerCase()]),
    ...(historique.trim() ? [] : [t('wc_p_provenance').toLowerCase()]),
    ...(priceEmpty ? [t('wf_price').toLowerCase()] : []),
    ...(selGroups.size ? [] : [t('wc_p_groups').toLowerCase()]),
  ]
  const barDirty = isDirty || extraDirty || lineDirty
  const hdrBtn = { minHeight: narrow ? 44 : 36, minWidth: narrow ? 44 : 36, background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 18, padding: 0, fontFamily: 'inherit' } as const
  const segBtn = (on: boolean) => ({
    padding: '0 10px',
    minHeight: narrow ? 44 : 30,
    border: 'none',
    background: on ? 'var(--bg3)' : 'transparent',
    color: on ? 'var(--tx)' : 'var(--tx3)',
    fontSize: 12,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }) as const
  const textareaSt = { ...FIS, resize: 'vertical' as const, fontSize: 12, padding: 8, minHeight: 56 }

  return (
    // `wc-card`: phone hit areas (app/globals.css); display: contents keeps the sticky header / bar.
    <div className="wc-card" style={{ display: 'contents' }}>
      {confirmDialog}
      {/* ═══ HEADER ═══ */}
      <div
        data-testid="work-card-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 6,
          background: 'var(--bg1)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 52,
          borderBottom: '1px solid var(--bd)',
          marginBottom: 12,
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, flexShrink: 0 }}>#{o.OeuvreID}</span>
        <span
          className="t-mono-sm"
          title={t('auditAttributedHint')}
          style={{ fontSize: 11, color: 'var(--tx3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}
        >
          {editedText || null}
          <span style={{ color: 'var(--ac)', marginLeft: 4 }}>◈</span>
        </span>
        <span style={{ flex: 1 }} />
        {imgZoom > 1 && !narrow ? (
          <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>×{imgZoom.toFixed(1)}</span>
        ) : null}
        <div role="group" aria-label={t('wc_view_aria')} style={{ display: 'flex', border: '1px solid var(--bd2)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
          <button type="button" data-testid="work-card-view-folded" aria-pressed={folded} title={t('wc_view_folded_tt')} onClick={() => setViewPersist('folded')} style={segBtn(folded)}>
            {t('wc_view_folded')}
          </button>
          <button type="button" data-testid="work-card-view-open" aria-pressed={!folded} title={t('wc_view_open_tt')} onClick={() => setViewPersist('open')} style={segBtn(!folded)}>
            {t('wc_view_open')}
          </button>
        </div>
        <button
          type="button"
          data-testid="work-card-selection"
          aria-pressed={isSel}
          title={isSel ? t('wc_sel_remove') : t('wc_sel_add')}
          aria-label={isSel ? t('wc_sel_remove') : t('wc_sel_add')}
          onClick={handleToggleSel}
          style={{ ...hdrBtn, color: isSel ? 'var(--ac)' : 'var(--tx3)' }}
        >
          {isSel ? '★' : '☆'}
        </button>
        {setExpanded && !narrow ? (
          <button
            type="button"
            data-testid="work-card-widen"
            onClick={() => setExpanded(!wide)}
            title={wide ? t('wc_narrow') : t('wc_widen')}
            aria-label={wide ? t('wc_narrow') : t('wc_widen')}
            style={hdrBtn}
          >
            {wide ? '⤡' : '⤢'}
          </button>
        ) : null}
        <button type="button" onClick={attemptClose} aria-label={t('close')} title={t('close')} style={{ ...hdrBtn, fontSize: 24 }}>×</button>
      </div>

      {/* ═══ TOP BLOCK ═══ */}
      <div
        key={o.OeuvreID}
        data-testid="work-card-top"
        style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(0, 330px) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 16, alignItems: 'start', marginBottom: 12 }}
      >
        <div style={{ minWidth: 0 }}>
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
            drawerReorder={(ids) => void drawerPersistOrder(ids)}
            isAdmin={isAdmin}
            drawerDeleteImage={drawerDeleteImage}
            drawerStartRetouch={drawerStartRetouch}
          />
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={titre}
            onChange={(e) => setTitre(cap(e.target.value))}
            aria-label={t('wc_tap_edit')}
            style={{ ...FIS, fontSize: twoCol ? 30 : 26, fontFamily: 'var(--font-serif)', lineHeight: 1.1, height: 'auto', padding: '2px 0', border: 'none', borderBottom: '1px solid transparent', background: 'transparent', color: 'var(--tx)' }}
            placeholder={t('untitled')}
          />

          <WorkDrawerPipelineSection
            // Kaizen #34: the contact card opens over the drawer; no guard needed, the work stays open.
            onOpenContact={(cid) => setQuickContactId(cid)}
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
            ownerId={ownerId}
            setOwnerId={setOwnerId}
            buyerId={buyerId}
            setBuyerId={setBuyerId}
            loadedOwnStage={ownStageFromStatusId(o.statusId)}
            locationAddresses={locationAddresses}
            localisationAddressId={localisationAddressId}
            setLocalisationAddressId={setLocalisationAddressId}
            sortedContacts={sortedContacts}
            cName={cName}
            currentLoc={currentLoc}
            setShowNewContact={setShowNewContact}
            onGift={() => setOrderModalKind('gift')}
            onOrder={(kind) => setOrderModalKind(kind)}
            orderLink={orderLink}
            startedLabel={startedLabel}
            completedLabel={completedLabel}
            locked={!!o.fate}
            fateText={fateText}
            isAdmin={isAdmin}
          />

          <WorkCardIdentity
            narrow={narrow}
            folded={folded}
            annee={annee}
            setAnnee={setAnnee}
            techniqueId={techniqueId}
            setTechniqueId={setTechniqueId}
            supportId={supportId}
            setSupportId={setSupportId}
            formatId={formatId}
            setFormatId={setFormatId}
            hauteur={hauteur}
            setHauteur={setHauteur}
            largeur={largeur}
            setLargeur={setLargeur}
            profondeur={profondeur}
            setProfondeur={setProfondeur}
            localTechniques={localTechniques}
            localSupports={localSupports}
            localFormats={localFormats}
            saveLookup={saveLookup}
            startedLabel={startedLabel}
            completedLabel={completedLabel}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Chip narrow={narrow} tone={o.is_public ? 'ok' : 'muted'} title={t('wc_public_tt')} testId="work-card-public">
              {o.is_public ? t('wc_public_on') : t('wc_public_off')}
            </Chip>
            {openShipment ? (
              <ShipmentTopChip shipment={openShipment} narrow={narrow} onClick={() => setObjectOpen(true)} />
            ) : null}
            {stagedCount > 0 ? (
              <Chip
                narrow={narrow}
                tone="warn"
                title={t('wc_session_photos_tt')}
                testId="work-card-staged"
                onClick={() => setCreationOpen(true)}
              >
                {t('wc_session_photos_fmt').replace('{n}', String(stagedCount))}
              </Chip>
            ) : null}
            {o.fate ? (
              <Chip narrow={narrow} tone="warn" title={t('fate_locked')} testId="work-drawer-fate">
                {fateText}
              </Chip>
            ) : null}
          </div>
          {ownStage === 'sold' ? <SaleReturnWindowBanner oeuvreId={o.OeuvreID} /> : null}
        </div>
      </div>

      {/* ═══ CRÉATION ═══ */}
      <CardDrawer
        title={t('wc_creation')}
        summary={creationSummary}
        open={creationOpen}
        onToggle={() => setCreationOpen((v) => !v)}
        narrow={narrow}
        testId="work-card-creation"
      >
        <Part selfTitled stacked={stacked} testId="work-card-period">
          <WorkPeriodSourceSection oeuvreId={o.OeuvreID} when={when} historyApart />
        </Part>
        <Part selfTitled stacked={stacked} testId="work-card-history">
          <WorkProductionSpan
            oeuvreId={o.OeuvreID}
            editable={isAdmin}
            startedOn={o.production_started_on}
            startedPrecision={o.production_started_precision}
            completedOn={o.production_completed_on}
            completedPrecision={o.production_completed_precision}
            origin={o.production_origin}
            inProduction={!o.Catalogué}
          />
          <WorkCreationHistory oeuvreId={o.OeuvreID} when={when} />
        </Part>
        <Part label={t('wc_p_comments')} stacked={stacked} testId="work-card-comments">
          {/* The old free-text « Commentaires » field is retired (Pem 2026-11-18): its text was already in note
              lines, the leftovers were emptied (supabase/sql/old_comments_retire.sql). Notes go in lines. */}
          <WorkNoteLines
            oeuvreId={o.OeuvreID}
            isAdmin={isAdmin}
            narrow={narrow}
            draft={lineDraft}
            onDraft={setLineDraft}
            flag={lineFlag}
            onFlag={setLineFlag}
            submitRef={lineSubmitRef}
          />
          <LinkedVoiceNotes field="oeuvre_id" value={o.OeuvreID} card onCount={setVoiceCount} />
        </Part>
        <Part label={t('wc_p_themes')} stacked={stacked} muted={selThemes.size === 0}>
          <PickChips
            items={initialThemes}
            selected={selThemes}
            onToggle={(id) => setSelThemes((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })}
            addLabel={t('wc_add_theme')}
            narrow={narrow}
            testId="work-drawer-themes"
          />
        </Part>
        <Part selfTitled stacked={stacked}>
          <WorkLinksSection oeuvreId={o.OeuvreID} />
        </Part>
        <Part label={t('wc_p_sessions')} stacked={stacked}>
          <DrawerWorkSessionsSection oeuvreId={o.OeuvreID} isAdmin={isAdmin} lang={lang} t={t} defaultOpen={false} onStagedCount={setStagedCount} card />
        </Part>
        <Part selfTitled stacked={stacked}>
          <WorkAiDescriptionSection oeuvreId={o.OeuvreID} onToJudge={setAiToJudge} />
        </Part>
      </CardDrawer>

      {/* ═══ OBJET ═══ */}
      <CardDrawer
        title={t('wc_object')}
        summary={objectSummary}
        open={objectOpen}
        onToggle={() => setObjectOpen((v) => !v)}
        narrow={narrow}
        testId="work-card-object"
      >
        <Part label={t('wc_p_provenance')} hint={t('wf_history_hint')} stacked={stacked} muted={!historique.trim()}>
          <textarea
            className="input"
            value={historique}
            onChange={(e) => setHistorique(e.target.value)}
            rows={historique.trim() ? 3 : 1}
            style={{ ...textareaSt, fontSize: 11, fontFamily: 'var(--font-mono)' }}
            placeholder={t('wf_history_placeholder')}
          />
          <WorkVersionHistory oeuvreId={o.OeuvreID} onRestored={() => router.refresh()} />
        </Part>
        <Part label={t('wc_p_logistics')} hint={t('wc_p_logistics_tt')} stacked={stacked} muted={!shipments?.length && !dateLivraison && !returnDate} testId="work-card-logistics">
          <WorkLogisticsPart
            shipments={shipments}
            narrow={narrow}
            onOpenLogistics={() => runGuarded(() => router.push('/atelier/logistics'))}
            dateLivraison={dateLivraison}
            setDateLivraison={setDateLivraison}
            returnDate={returnDate}
            setReturnDate={setReturnDate}
          />
        </Part>
        <Part label={t('wc_p_presentation')} hint={t('wc_p_presentation_tt')} stacked={stacked} muted={gatesOn === 0 && !presentationId} testId="work-card-presentation">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: narrow ? 44 : undefined }}>
            <Chip narrow={narrow} tone="ok" active={montee} onClick={() => setMontee(!montee)} title={t('wc_gate_mounted_tt')} testId="wc-gate-mounted">
              {montee ? '✓ ' : ''}{t('wc_gate_mounted')}
            </Chip>
            <Chip narrow={narrow} tone="ok" active={encadree} onClick={() => setEncadree(!encadree)} title={t('wc_gate_framed_tt')} testId="wc-gate-framed">
              {encadree ? '✓ ' : ''}{t('wc_gate_framed')}
            </Chip>
            <Chip
              narrow={narrow}
              tone="ok"
              // Destroyed / lost: never « Exposable » (fate_not_showable.sql, WORK_RULES rule 17).
              active={exposable && !o.fate}
              disabled={ownStage === 'artist_archive' || !!o.fate}
              onClick={() => { if (ownStage !== 'artist_archive' && !o.fate) setExposable(!exposable) }}
              title={o.fate ? t('wc_gate_exposable_fate_tt') : ownStage === 'artist_archive' ? t('wc_gate_exposable_archive_tt') : t('wc_gate_exposable_tt')}
              testId="wc-gate-exposable"
            >
              {exposable ? '✓ ' : ''}{t('wc_gate_exposable')}
            </Chip>
            <Chip narrow={narrow} tone="ok" active={broadcastReady} onClick={() => setBroadcastReady(!broadcastReady)} title={t('wc_gate_broadcast_tt')} testId="wf-broadcast-ready-switch">
              {broadcastReady ? '✓ ' : ''}{t('wf_broadcast_ready')}
            </Chip>
          </div>
          {broadcastReady ? (
            <div style={{ marginTop: 6 }}>
              <textarea
                data-testid="wf-broadcast-caption-seed"
                className="input"
                aria-label={t('bc_caption_seed')}
                title={t('bc_caption_seed_hint')}
                value={broadcastCaptionSeed}
                onChange={(e) => setBroadcastCaptionSeed(e.target.value.slice(0, 2000))}
                rows={2}
                style={textareaSt}
                placeholder={t('bc_caption_seed')}
              />
            </div>
          ) : null}
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--mt)', minHeight: narrow ? 44 : undefined, display: 'flex', alignItems: 'center' }}>{t('presentation')}</summary>
            <select className="input" value={presentationId} onChange={(e) => setPresentationId(e.target.value)} style={{ ...FIS, marginTop: 4, height: narrow ? 44 : 28 }}>
              <option value="">—</option>
              {initialPresentations.map((p) => (
                <option key={p.PresentationID} value={p.PresentationID}>{p.Nom}</option>
              ))}
            </select>
          </details>
        </Part>
        <Part label={t('wc_p_confidentiality')} hint={t('wc_p_confidentiality_tt')} stacked={stacked}>
          <ContactConfidentialityPart anonymityLevel={anonymityLevel} setAnonymityLevel={setAnonymityLevel} narrow={narrow} />
        </Part>
        <Part label={t('wc_p_value')} stacked={stacked} muted={priceEmpty && !isCommission} testId="work-card-value">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6, minHeight: narrow ? 44 : undefined }}>
            <Chip narrow={narrow} tone="ac" active={isCommission} onClick={() => setIsCommission(!isCommission)} title={t('wc_commission_tt')} testId="wc-commission">
              {isCommission ? '✓ ' : ''}{t('wc_commission')}
            </Chip>
            {isCommission ? (
              <CommissionClient
                buyerId={buyerId}
                setBuyerId={setBuyerId}
                contacts={sortedContacts}
                cName={cName}
                narrow={narrow}
                onOpenContact={(cid) => setQuickContactId(cid)}
              />
            ) : null}
            <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('wc_commission_later')}</span>
          </div>
          <DrawerContentFinanceSection
            narrow={stacked}
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
            saleMoney={orderLink?.sale ?? null}
          />
          {isAdmin ? (
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--tx3)', minHeight: narrow ? 44 : undefined, display: 'flex', alignItems: 'center' }}>{t('wc_p_costs')}</summary>
              <WorkCostBlock oeuvreId={o.OeuvreID} isAdmin={isAdmin} catalogPrice={o.Prix ?? null} />
            </details>
          ) : null}
        </Part>
        <Part label={t('wc_p_groups')} stacked={stacked} muted={selGroups.size === 0}>
          <PickChips
            items={initialGroups}
            selected={selGroups}
            onToggle={(id) => setSelGroups((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })}
            addLabel={t('wc_add_group')}
            narrow={narrow}
            testId="work-card-groups"
          />
        </Part>
        <Part selfTitled stacked={stacked}>
          <ConditionReportsSection
            oeuvreId={o.OeuvreID}
            onWorkPatched={(patch) => {
              onWorkSaved?.(o.OeuvreID, patch)
              // A destruction / loss report adds a history line server-side: re-read it, or the
              // next Save would send the old text back. Only when the fate moved (a plain
              // examination writes no line, and the reload would drop unsaved history edits).
              if (patch.fate !== (o.fate ?? null)) setLongTextReloadNonce((n) => n + 1)
            }}
          />
        </Part>
        <Part label={t('wc_p_fate')} stacked={stacked} muted={!o.fate}>
          {o.fate ? (
            <div style={{ fontSize: 13 }}>
              {fateText}
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{t('fate_locked')}</div>
            </div>
          ) : (
            <span style={{ fontSize: 12 }}>{t('wc_p_fate_none')}</span>
          )}
        </Part>
        <Part selfTitled stacked={stacked}>
          <WorkFormPhysicalQr oeuvreId={o.OeuvreID} titre={titre || o.Titre} />
        </Part>
        {/* Soft delete (trash + undo) stays with everyone who had it in the old « ⋯ » menu. */}
        <Part label={t('wc_p_trash')} stacked={stacked} testId="work-card-trash">
          {!confirmDelete ? (
            <button
              type="button"
              className="btn ghost sm"
              data-testid="work-card-delete"
              title={t('wc_trash_work_tt')}
              style={{ color: 'var(--tx3)', minHeight: narrow ? 44 : 30 }}
              onClick={() => setConfirmDelete(true)}
            >
              {t('wc_trash_work')}
            </button>
          ) : (
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <button type="button" className="btn ghost sm" style={{ color: '#c0392b', minHeight: 44 }} disabled={deleting} onClick={handleDelete}>
                {deleting ? '…' : t('btn_confirm')}
              </button>
              <button type="button" className="btn ghost sm" aria-label={t('cancel')} style={{ minHeight: 44 }} onClick={() => { setConfirmDelete(false); setDeleteError(null) }}>×</button>
            </div>
          )}
          {deleteError && <div style={{ color: '#c0392b', fontSize: 11, marginTop: 6 }}>{deleteError}</div>}
        </Part>
        {isAdmin ? (
          <Part label={t('wc_p_admin')} labelColor="var(--rust)" stacked={stacked} testId="work-card-admin">
            <button
              type="button"
              className="btn ghost sm"
              data-testid="work-card-purge"
              title={t('wc_purge_work_tt')}
              disabled={deleting}
              style={{ color: 'var(--rust)', minHeight: narrow ? 44 : 30 }}
              onClick={handlePurge}
            >
              {deleting ? '…' : t('wc_purge_work')}
            </button>
          </Part>
        ) : null}
      </CardDrawer>

      {folded && emptyLabels.length > 0 ? (
        <div data-testid="work-card-empty-line" style={{ borderTop: '1px solid var(--bd)', padding: '10px 0', fontSize: 12, color: 'var(--mt)', overflowWrap: 'anywhere' }}>
          {t('wc_empty_fmt').replace('{n}', String(emptyLabels.length)).replace('{list}', emptyLabels.join(', '))}{' '}
          <button
            type="button"
            onClick={() => setViewPersist('open')}
            style={{ background: 'none', border: 'none', borderBottom: '1px dashed var(--bd3)', padding: 0, color: 'var(--tx3)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', minHeight: narrow ? 44 : undefined }}
          >
            {t('wc_empty_see')}
          </button>
        </div>
      ) : null}

      {/* ═══ SAVE BAR — always there, greyed while nothing changed ═══ */}
      <div
        data-testid="work-card-save-bar"
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 6,
          background: 'var(--bg1)',
          borderTop: '1px solid var(--bd)',
          marginTop: 12,
          paddingTop: 10,
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: barDirty ? 'var(--yellow)' : 'var(--tx3)' }}>
          {barDirty ? t('wc_save_dirty') : t('wc_save_clean')}
        </span>
        <button
          type="button"
          className="btn ghost"
          data-testid="work-card-discard"
          title={t('wc_discard_tt')}
          disabled={isSaving}
          onClick={discardInPlace}
          style={{ minHeight: 44, opacity: barDirty ? 1 : 0.45 }}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn primary"
          data-testid="work-card-save"
          onClick={handleSubmit}
          disabled={isSaving}
          style={{ minHeight: 44, opacity: barDirty ? 1 : 0.45 }}
        >
          {isSaving ? '…' : t('save')}
        </button>
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

      {orderModalKind && (
        <GiftTransferModal
          oeuvreId={o.OeuvreID}
          kind={orderModalKind}
          recipients={sortedContacts}
          onClose={() => setOrderModalKind(null)}
          onGifted={() => {
            setOrderModalKind(null); setLongTextReloadNonce((n) => n + 1); router.refresh()
            void findOrderForWork(o.OeuvreID).then(setOrderLink)
          }}
        />
      )}

      {quickContactId != null && (
        <ContactQuickModal
          contactId={quickContactId}
          narrow={narrow}
          onClose={() => setQuickContactId(null)}
          onSaved={(c) =>
            // Upsert: before the shell's list arrives the contact may not be on the card yet; as a card row its new
            // name then wins over the list (mergeCardContacts).
            setLocalContacts((prev) =>
              prev.some((x) => x.ContactID === c.ContactID)
                ? prev.map((x) =>
                    x.ContactID === c.ContactID ? { ...x, NomInstitution: c.NomInstitution, Nom: c.Nom, Prénom: c.Prénom, Role: c.Role } : x,
                  )
                : [...prev, { ContactID: c.ContactID, NomInstitution: c.NomInstitution, Nom: c.Nom, Prénom: c.Prénom, Role: c.Role }],
            )
          }
        />
      )}
    </div>
  )
}
