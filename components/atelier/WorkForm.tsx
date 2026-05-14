'use client'

/**
 * WorkForm — simplified pipeline architecture.
 * Two axes: Production state (booleans) + Ownership/flow state (statusId).
 * No commercial_status. No StageProduction. No FORCE FIELD ENFORCEMENT.
 */

import { useState, useEffect, useTransition, useRef, useMemo, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { thumbUrl, isCircularSupport, DIAMETER_SIGN } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre, WorkImage } from '@/lib/types/database'
import type { SaveResult, WorkRevertSnapshot } from '@/app/atelier/works/actions'
import { addWorkImage, deleteWorkImage, createLookup, reorderWorkImages, revertWorkSnapshot } from '@/app/atelier/works/actions'
import { WorkThumb } from './WorkThumb'
import { createClient } from '@/lib/supabase/client'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import { toast } from '@/lib/ui/toast'
import { registerUndo, consumeUndo } from '@/lib/ui/undo'
import { useMediaQuery } from '@/lib/useMediaQuery'
import {
  downscaleImageFileForMobileIfNeeded,
  startEstimatedUploadProgress,
  withUploadRetry,
} from '@/lib/mobile/image-upload-client'
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
import {
  computeStatusId as computeWorkStatusId,
  ownStageFromStatusId,
  prodStageFromOeuvre,
  type OwnStageId,
  type ProdStageId,
} from '@/lib/work-editor-model'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  oeuvre:          Oeuvre | null
  currentThemeIds: number[]
  techniques:      { TechniqueID: number; Technique: string | null }[]
  supports:        { SupportID:   number; Support:   string | null }[]
  formats:         { FormatID:    number; Format:    string | null }[]
  themes:          { id:          number; name:      string        }[]
  contacts:        any[]
  initialImages?:  WorkImage[]
  addresses?:      ContactAddress[]
  groups:          { id: string; name: string }[]
  currentGroupIds: string[]
  activeConsignment?: any
  action:          (fd: FormData) => Promise<SaveResult>
}

export function WorkForm({
  oeuvre, currentThemeIds,
  techniques: initialTechniques, supports: initialSupports, formats: initialFormats,
  themes: initialThemes,
  contacts,
  initialImages = [],
  groups: initialGroups,
  currentGroupIds,
  activeConsignment,
  action,
}: Props) {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
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
      { id: 'artist', label: t('wf_own_artist_l'), desc: t('wf_own_artist_d') },
      { id: 'reserved', label: t('wf_own_reserved_l'), desc: t('wf_own_reserved_d') },
      { id: 'consigned', label: t('wf_own_consigned_l'), desc: t('wf_own_consigned_d') },
      { id: 'loan', label: t('wf_own_loan_l'), desc: t('wf_own_loan_d') },
      { id: 'sold', label: t('wf_own_sold_l'), desc: t('wf_own_sold_d') },
      { id: 'gift', label: t('wf_own_gift_l'), desc: t('wf_own_gift_d') },
      { id: 'artist_archive', label: t('wf_own_archive_l'), desc: t('wf_own_archive_d') },
    ],
    [t],
  )
  const visibilityOptions = useMemo(
    () => [
      { level: 0, label: t('wf_vis_public'), desc: t('wf_vis_public_d') },
      { level: 1, label: t('wf_vis_masked'), desc: t('wf_vis_masked_d') },
      { level: 2, label: t('wf_vis_private'), desc: t('wf_vis_private_d') },
    ],
    [t],
  )
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const undoBaselineRef = useRef<WorkRevertSnapshot | null>(null)
  const draftKey = useMemo(() => draftStorageKey(oeuvre?.OeuvreID ?? null), [oeuvre?.OeuvreID])
  const draftPromptedForKey = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!oeuvre) {
      undoBaselineRef.current = null
      return
    }
    undoBaselineRef.current = {
      statusId: oeuvre.statusId ?? null,
      catalogued: prodStageFromOeuvre(oeuvre) !== 'atelier',
      needsPhotograph: !!((oeuvre as { NeedsPhotograph?: boolean }).NeedsPhotograph ?? false),
      themeIds: [...currentThemeIds],
      groupIds: [...currentGroupIds],
    }
  }, [oeuvre, currentThemeIds, currentGroupIds])

  // ── Identity ──────────────────────────────────────────────────────
  const [titre,       setTitre]       = useState(oeuvre?.Titre ?? '')
  const [annee,       setAnnee]       = useState(oeuvre?.Année ?? '')
  const [techniqueId, setTechniqueId] = useState(String(oeuvre?.Technique ?? ''))
  const [supportId,   setSupportId]   = useState(String(oeuvre?.Support ?? ''))
  const [formatId,    setFormatId]    = useState(String(oeuvre?.Format ?? ''))
  const [hauteur,     setHauteur]     = useState(String((oeuvre as any)?.Hauteur ?? ''))
  const [largeur,     setLargeur]     = useState(String((oeuvre as any)?.Largeur ?? ''))
  const [profondeur,  setProfondeur]  = useState(String((oeuvre as any)?.Profondeur ?? ''))

  // ── Production state (derived from booleans) ──────────────────────
  const [prodStage,  setProdStage]  = useState<ProdStageId>(() => prodStageFromOeuvre(oeuvre))
  const [needsPhoto, setNeedsPhoto] = useState(!!((oeuvre as any)?.NeedsPhotograph ?? false))

  // ── Ownership / flow state ────────────────────────────────────────
  const [ownStage,      setOwnStage]      = useState<OwnStageId>(() => ownStageFromStatusId(oeuvre?.statusId))
  const [contactId,     setContactId]     = useState(String(oeuvre?.LocalisationID ?? ''))
  const [anonymityLevel, setAnonymityLevel] = useState<number>((oeuvre as any)?.anonymity_level ?? 0)
  const [showContactModal, setShowContactModal] = useState(false)

  // ── Financials ────────────────────────────────────────────────────
  const [prix,        setPrix]        = useState(String(oeuvre?.Prix ?? '0'))
  const [tvaRate,     setTvaRate]     = useState(String((oeuvre as any)?.tva_rate ?? '0'))
  const [discount,    setDiscount]    = useState(String((oeuvre as any)?.Discount ?? '0'))
  const [paymentDone, setPaymentDone] = useState((oeuvre as any)?.PaymentDone ?? false)
  const [exposable,   setExposable]   = useState((oeuvre as any)?.Exposable ?? false)
  const [broadcastReady, setBroadcastReady] = useState(
    !!(oeuvre as { broadcast_ready?: boolean } | null)?.broadcast_ready,
  )
  const [broadcastCaptionSeed, setBroadcastCaptionSeed] = useState(String((oeuvre as { broadcast_caption_seed?: string | null })?.broadcast_caption_seed ?? ''))

  // ── Lookups ───────────────────────────────────────────────────────
  const [localTechniques, setLocalTechniques] = useState(initialTechniques)
  const [localSupports,   setLocalSupports]   = useState(initialSupports)
  const [localFormats,    setLocalFormats]    = useState(initialFormats)
  const [localContacts,   setLocalContacts]   = useState(contacts)
  const [localGroups,     setLocalGroups]     = useState(initialGroups)
  const [selGroups,       setSelGroups]       = useState<Set<string>>(new Set(currentGroupIds))
  const [allThemes, setAllThemes] = useState(initialThemes)
  const [selThemes, setSelThemes] = useState<Set<number>>(new Set(currentThemeIds))
  const [commentaires, setCommentaires] = useState((oeuvre as any)?.Commentaires ?? '')
  const [historique,   setHistorique]   = useState((oeuvre as any)?.Historique ?? '')

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

  const committedDraftBaseline = useMemo((): WorkFormDraftContent => {
    if (!oeuvre) {
      return {
        titre: '',
        annee: '',
        techniqueId: '',
        supportId: '',
        formatId: '',
        hauteur: '',
        largeur: '',
        profondeur: '',
        prodStage: 'atelier',
        needsPhoto: false,
        ownStage: 'artist',
        contactId: '',
        anonymityLevel: 0,
        prix: '0',
        tvaRate: '0',
        discount: '0',
        paymentDone: false,
        exposable: false,
        broadcastReady: false,
        commentaires: '',
        historique: '',
        selThemes: [...currentThemeIds],
        selGroups: [...currentGroupIds],
      }
    }
    return {
      titre: oeuvre.Titre ?? '',
      annee: String(oeuvre.Année ?? ''),
      techniqueId: String(oeuvre.Technique ?? ''),
      supportId: String(oeuvre.Support ?? ''),
      formatId: String(oeuvre.Format ?? ''),
      hauteur: String((oeuvre as { Hauteur?: unknown }).Hauteur ?? ''),
      largeur: String((oeuvre as { Largeur?: unknown }).Largeur ?? ''),
      profondeur: String((oeuvre as { Profondeur?: unknown }).Profondeur ?? ''),
      prodStage: prodStageFromOeuvre(oeuvre),
      needsPhoto: !!((oeuvre as { NeedsPhotograph?: boolean }).NeedsPhotograph ?? false),
      ownStage: ownStageFromStatusId(oeuvre.statusId),
      contactId: String(oeuvre.LocalisationID ?? ''),
      anonymityLevel: (oeuvre as { anonymity_level?: number }).anonymity_level ?? 0,
      prix: String(oeuvre.Prix ?? '0'),
      tvaRate: String((oeuvre as { tva_rate?: number | null }).tva_rate ?? '0'),
      discount: String((oeuvre as { Discount?: number | null }).Discount ?? '0'),
      paymentDone: !!((oeuvre as { PaymentDone?: boolean }).PaymentDone ?? false),
      exposable: !!((oeuvre as { Exposable?: boolean }).Exposable ?? false),
      broadcastReady: !!((oeuvre as { broadcast_ready?: boolean }).broadcast_ready ?? false),
      commentaires: String((oeuvre as { Commentaires?: string | null }).Commentaires ?? ''),
      historique: String((oeuvre as { Historique?: string | null }).Historique ?? ''),
      selThemes: [...currentThemeIds],
      selGroups: [...currentGroupIds],
    }
  }, [oeuvre, currentThemeIds, currentGroupIds])

  const isDirty = !workFormDraftContentEquals(
    normalizeWorkFormDraftContent(draftSnapshot),
    normalizeWorkFormDraftContent(committedDraftBaseline),
  )

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (isDirty) {
          const payload: WorkFormDraftPayload = { ...draftSnapshot, savedAt: Date.now() }
          sessionStorage.setItem(draftKey, JSON.stringify(payload))
        } else {
          sessionStorage.removeItem(draftKey)
        }
      } catch { /* quota */ }
    }, 600)
    return () => clearTimeout(id)
  }, [draftKey, draftSnapshot, isDirty])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (draftPromptedForKey.current === draftKey) return
    draftPromptedForKey.current = draftKey
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
    setBroadcastReady(!!d.broadcastReady)
    setCommentaires(d.commentaires ?? '')
    setHistorique(d.historique ?? '')
    setSelThemes(new Set(d.selThemes ?? []))
    setSelGroups(new Set(d.selGroups ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot restore per draftKey; setters stable
  }, [draftKey, t])

  // ── Derived ───────────────────────────────────────────────────────
  const isDigital  = techniqueId === '19'
  const supportLabel = useMemo(
    () => localSupports.find(s => String(s.SupportID) === supportId)?.Support ?? '',
    [localSupports, supportId],
  )
  const circularPlanar = !isDigital && isCircularSupport(supportLabel)
  const diameterFieldValue = useMemo(() => {
    if (!circularPlanar) return hauteur
    const a = hauteur.trim()
    const b = largeur.trim()
    if (a === b) return hauteur
    return hauteur || largeur
  }, [circularPlanar, hauteur, largeur])
  const pxToCm = (px: string) => px ? (parseFloat(px) / (300 / 2.54)).toFixed(1) : ''

  const prixVal  = parseFloat(prix) || 0
  const discVal  = parseFloat(discount) || 0
  const prixFinal = ownStage === 'gift' ? 0 : prixVal * (1 - discVal / 100)

  const isOwnershipTransferred = ownStage === 'sold' || ownStage === 'gift'
  const isArchived = ownStage === 'artist_archive'
  const isInCirculation = !isOwnershipTransferred && !isArchived

  const pemContact = useMemo(
    () => contacts.find(c => (c.NomInstitution ?? '').toLowerCase().includes('pem')),
    [contacts]
  )
  const currentOwner = useMemo(
    () => localContacts.find(c => String(c.ContactID) === contactId),
    [localContacts, contactId]
  )

  const currentLoc = useMemo(() => {
      if (ownStage === 'artist' || ownStage === 'artist_archive') {
      return pemContact?.Ville
        ? `${pemContact.Ville}, ${pemContact.Pays ?? ''}`
        : t('atelier')
    }
    if (ownStage === 'reserved') {
      if (currentOwner) {
        const loc = [currentOwner.Ville, currentOwner.Pays].filter(Boolean).join(', ')
        return `Réservé — ${currentOwner.NomInstitution ?? currentOwner.Nom ?? '?'} (${loc || '?'})`
      }
      return 'Réservé — acheteur TBD'
    }
    if (ownStage === 'consigned' || ownStage === 'loan') {
      if (activeConsignment) {
        const c = activeConsignment.Contact
        const loc = [c?.Ville, c?.Pays].filter(Boolean).join(', ')
        return `${activeConsignment.label ?? 'En dépôt'} · ${c?.NomInstitution ?? c?.Nom ?? 'Holder'} (${loc || '?'})`
      }
      if (currentOwner) {
        const loc = [currentOwner.Ville, currentOwner.Pays].filter(Boolean).join(', ')
        return `${currentOwner.NomInstitution ?? currentOwner.Nom ?? '?'} (${loc || '?'})`
      }
      return 'En dépôt / Transit'
    }
    if (isOwnershipTransferred) {
      if (!currentOwner) return 'Acheteur TBD'
      const loc = [currentOwner.Ville, currentOwner.Pays].filter(Boolean).join(', ')
      return loc || `${currentOwner.NomInstitution ?? currentOwner.Nom ?? 'Acheteur'} (localisation TBD)`
    }
    return '—'
  }, [ownStage, currentOwner, pemContact, activeConsignment, isOwnershipTransferred, t])

  // ── Automations ───────────────────────────────────────────────────

  // A. Change of prodStage dictates NeedsPhoto logic
  useEffect(() => {
    if (prodStage === 'catalogued') {
      setNeedsPhoto(true)
    } else {
      setNeedsPhoto(false)
    }
  }, [prodStage])

  // B. NeedsPhoto cleared → move to available
  const prevNeedsPhoto = useRef(needsPhoto)
  useEffect(() => {
    if (!needsPhoto && prevNeedsPhoto.current === true) {
      setProdStage('available')
    }
    prevNeedsPhoto.current = needsPhoto
  }, [needsPhoto])

  // C. Gift → price = 0
  useEffect(() => {
    if (ownStage === 'gift') {
      setPrix('0')
      setDiscount('0')
    }
  }, [ownStage])

  // D. Archived → not public, contact = Pem
  useEffect(() => {
    if (isArchived && pemContact) {
      setContactId(String(pemContact.ContactID))
    }
  }, [isArchived, pemContact])

  // E. Sold/Gift → cannot be in production
  useEffect(() => {
    if (isOwnershipTransferred && prodStage === 'atelier') {
      setProdStage('available')
    }
  }, [isOwnershipTransferred, prodStage])

  // F. Artist/archive → contact = Pem
  useEffect(() => {
    if ((ownStage === 'artist' || ownStage === 'artist_archive') && pemContact) {
      setContactId(String(pemContact.ContactID))
    }
  }, [ownStage, pemContact])

  // ── Submit ────────────────────────────────────────────────────────

  async function handleSubmit(e: any) {
    if (e?.preventDefault) e.preventDefault()
    const fd = new FormData(formRef.current!)

    fd.set('catalogued', (prodStage !== 'atelier') ? '1' : '0')
    fd.set('anonymity_level', String(anonymityLevel))
    fd.set('needs_photograph', needsPhoto ? '1' : '0')
    fd.set('prix', prix)
    fd.set('discount', discount)
    fd.set('exposable', exposable ? '1' : '0')
    fd.set('prix_final', String(prixFinal))
    fd.set('is_paid', paymentDone ? '1' : '0')
    fd.set('commentaires', commentaires)
    fd.set('historique', historique)
    fd.set('contact_id', contactId)
    fd.set('localisation_id', contactId)
    fd.set('status_id', String(computeWorkStatusId(ownStage, prodStage)))
    fd.set('tva_rate', tvaRate)
    fd.set('broadcast_ready', broadcastReady ? '1' : '0')
    fd.set('broadcast_caption_seed', broadcastCaptionSeed ?? '')

    // Ownership change history
    if (oeuvre?.LocalisationID !== parseInt(contactId)) {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/')
      const locStr = `${dateStr} - ${currentOwner?.NomInstitution ?? currentOwner?.Nom ?? 'Inconnu'} - ${currentOwner?.Ville ?? '?'}/${currentOwner?.Pays ?? '?'}`
      fd.set('historique_append', locStr)
    }

    fd.delete('themes')
    selThemes.forEach(id => fd.append('themes', String(id)))
    fd.delete('groups')
    selGroups.forEach(id => fd.append('groups', id))

    startTransition(async () => {
      const prevSnap = oeuvre ? undoBaselineRef.current : null
      try {
        const res = await action(fd)
        if ('error' in res) {
          alert(`${t('error_prefix')} ${res.error}`)
          return
        }
        try {
          sessionStorage.removeItem(draftKey)
        } catch { /* ignore */ }
        if (typeof res.newId === 'number') {
          router.push(`/atelier?work=${res.newId}`)
          router.refresh()
        } else {
          if (oeuvre && prevSnap) {
            const oid = oeuvre.OeuvreID
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
                const r = await revertWorkSnapshot(oid, prevSnap)
                if ('error' in r) {
                  toast.error(t('revertWorkFailed'))
                  throw new Error(r.error)
                }
                router.refresh()
              },
            })
          }
          undoBaselineRef.current = {
            statusId: computeWorkStatusId(ownStage, prodStage),
            catalogued: prodStage !== 'atelier',
            needsPhotograph: needsPhoto,
            themeIds: Array.from(selThemes),
            groupIds: Array.from(selGroups),
          }
          router.push('/atelier')
          router.refresh()
        }
      } catch (e) {
        if (isLikelyOfflineSaveError(e)) {
          try {
            await enqueueOfflineWorkSave(formDataToStringRecord(fd))
            toast.info(t('offline_save_queued'))
          } catch {
            toast.error(t('offline_sync_failed'))
          }
          return
        }
        alert(`${t('error_prefix')} ${String(e)}`)
      }
    })
  }

  async function saveLookup(table: string, name: string) {
    if (!name) return
    const res = await createLookup(table, cap(name))
    if ('error' in res) { alert(`${t('error_prefix')} ${res.error}`); return }
    if (table === 'Technique') { setLocalTechniques(p => [...p, { TechniqueID: res.id, Technique: cap(name) }]); setTechniqueId(String(res.id)) }
    else if (table === 'Support') { setLocalSupports(p => [...p, { SupportID: res.id, Support: cap(name) }]); setSupportId(String(res.id)) }
    else if (table === 'Format') { setLocalFormats(p => [...p, { FormatID: res.id, Format: cap(name) }]); setFormatId(String(res.id)) }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div data-testid="work-form-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: narrow ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))' : '12px 28px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div className="row gap-md">
          <button type="button" className="btn ghost sm" onClick={() => router.back()}>← {t('back')}</button>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
            {oeuvre ? `${t('wf_modify_label')} #${oeuvre.OeuvreID}` : t('newWork')}
          </div>
          {isOwnershipTransferred && (
            <div className="t-eyebrow" style={{ color: 'var(--rust)', background: 'var(--rust)22', padding: '2px 6px' }}>
              {ownStage === 'gift' ? t('wf_badge_gift') : t('wf_badge_sold')}
            </div>
          )}
          {isArchived && (
            <div className="t-eyebrow" style={{ color: 'var(--mt)', background: 'var(--mt)22', padding: '2px 6px' }}>
              {t('wf_badge_archive')}
            </div>
          )}
        </div>
        {!narrow && (
          <button type="button" className="btn primary sm" onClick={handleSubmit} disabled={isPending}>
            {isPending ? t('savingRecord') : t('save')}
          </button>
        )}
      </div>

      <form id="work-form" ref={formRef} onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: narrow ? 'column' : 'row', overflow: 'hidden' }}>
        <input type="hidden" name="oeuvre_id" value={oeuvre?.OeuvreID ?? ''} />

        {/* Left sidebar: images, themes, notes */}
        <div style={{ width: narrow ? '100%' : 340, borderRight: narrow ? 'none' : '1px solid var(--bd)', borderBottom: narrow ? '1px solid var(--bd)' : 'none', background: 'var(--bg1)', padding: narrow ? 16 : 24, overflow: 'auto' }}>
          <ImageManager oeuvreId={oeuvre?.OeuvreID ?? 0} initialImages={initialImages} narrow={narrow} />

          <div style={{ marginTop: 32 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>{t('wf_themes_series')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allThemes.map(th => (
                <button key={th.id} type="button"
                  onClick={() => setSelThemes(p => { const s = new Set(p); if (s.has(th.id)) s.delete(th.id); else s.add(th.id); return s })}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 2, border: '1px solid var(--bd)', background: selThemes.has(th.id) ? 'var(--ac)' : 'var(--bg2)', color: selThemes.has(th.id) ? 'var(--bg0)' : 'var(--tx3)' }}>
                  {th.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>{t('wf_comments')}</div>
            <textarea value={commentaires} onChange={e => setCommentaires(e.target.value)}
              style={{ ...FIS, height: 120, resize: 'vertical', fontSize: 13 }} placeholder={t('wf_comments_placeholder')} />
          </div>

          <div style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>{t('wf_history_title')}</div>
            <textarea value={historique} onChange={e => setHistorique(e.target.value)}
              style={{ ...FIS, height: 140, resize: 'vertical', fontSize: 12, fontFamily: 'var(--font-mono)' }} placeholder={t('wf_history_placeholder')} />
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--tx3)', lineHeight: 1.4 }}>
              {t('wf_history_hint')}
            </div>
          </div>
        </div>

        {/* Main form */}
        <div style={{ flex: 1, padding: narrow ? '18px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left))' : '40px 60px', overflow: 'auto' }}>
          <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: narrow ? 32 : 56 }}>

            {/* 1. Identity */}
            <section>
              <SectionHeader title={t('wf_section_identity')} />
              <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '3fr 1fr', gap: 20 }}>
                <Field label={t('wf_field_title')}><input name="titre" value={titre} onChange={e => setTitre(cap(e.target.value))} style={FIS} /></Field>
                <Field label={t('wf_field_year')}><input name="annee" value={annee} onChange={e => setAnnee(e.target.value)} style={FIS} placeholder="1999/10/31" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr 1fr', gap: 20, marginTop: 16 }}>
                <Field label={t('technique')}>
                  <CreatableSelect value={techniqueId} options={localTechniques.map(t => ({ id: String(t.TechniqueID), label: t.Technique ?? '' }))} onChange={setTechniqueId} onAdd={name => saveLookup('Technique', name)} name="technique" />
                </Field>
                <Field label={t('support')}>
                  <CreatableSelect value={supportId} options={localSupports.map(s => ({ id: String(s.SupportID), label: s.Support ?? '' }))} onChange={setSupportId} onAdd={name => saveLookup('Support', name)} name="support" />
                </Field>
                <Field label={t('wf_field_format')}>
                  <CreatableSelect value={formatId} options={localFormats.map(f => ({ id: String(f.FormatID), label: f.Format ?? '' }))} onChange={setFormatId} onAdd={name => saveLookup('Format', name)} name="format" />
                </Field>
              </div>
              {circularPlanar && <input type="hidden" name="largeur" value={largeur} readOnly aria-hidden />}
              <div style={{
                display: 'grid',
                gridTemplateColumns: narrow ? '1fr' : (circularPlanar ? '1fr 1fr' : '1fr 1fr 1fr'),
                gap: 20,
                marginTop: 16,
              }}>
                {circularPlanar ? (
                  <>
                    <Field label={`${DIAMETER_SIGN} (cm)`}>
                      <input
                        name="hauteur"
                        value={diameterFieldValue}
                        onChange={(e) => {
                          const v = e.target.value
                          setHauteur(v)
                          setLargeur(v)
                        }}
                        style={FIS}
                        title={t('wf_diameter_tt')}
                      />
                    </Field>
                    <Field label="D (cm)"><input name="profondeur" value={profondeur} onChange={e => setProfondeur(e.target.value)} style={FIS} /></Field>
                  </>
                ) : (
                  <>
                    <Field label={isDigital ? "H (px)" : "H (cm)"}><input name="hauteur" value={hauteur} onChange={e => setHauteur(e.target.value)} style={FIS} /></Field>
                    <Field label={isDigital ? "W (px)" : "W (cm)"}><input name="largeur" value={largeur} onChange={e => setLargeur(e.target.value)} style={FIS} /></Field>
                    <Field label="D (cm)"><input name="profondeur" value={profondeur} onChange={e => setProfondeur(e.target.value)} style={FIS} /></Field>
                  </>
                )}
              </div>
              {isDigital && (
                <div style={{ marginTop: 24, padding: 24, border: '1px solid var(--bd)', background: 'var(--bg2)' }}>
                  <div className="t-eyebrow" style={{ fontSize: 11, marginBottom: 16 }}>{t('wf_fmt_digital')}</div>
                  <div className="t-mono-xs" style={{ color: 'var(--ac)', fontSize: 12 }}>≈ {pxToCm(hauteur)} × {pxToCm(largeur)} cm (@300dpi)</div>
                </div>
              )}
            </section>

            {/* 2. Production State */}
            <section style={{ opacity: (isOwnershipTransferred || isArchived) ? 0.5 : 1 }}>
              <SectionHeader title={t('wf_section_production')} />
              <PipeProgress stages={PRODUCTION_STAGES} current={prodStage} onSelect={(id) => {
                if (isOwnershipTransferred || isArchived) return
                setProdStage(id as ProdStageId)
              }} color="var(--sage)" />
              <div style={{ display: 'flex', gap: 32, marginTop: 20 }}>
                <Switch label={t('wf_photo_required')} checked={needsPhoto} onChange={v => {
                  if (isOwnershipTransferred || isArchived) return
                  setNeedsPhoto(v)
                }} />
                <Switch label={t('wf_exposable')} checked={exposable} onChange={setExposable} />
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Switch
                  label={t('wf_broadcast_ready')}
                  checked={broadcastReady}
                  onChange={setBroadcastReady}
                  testId="wf-broadcast-ready-switch"
                />
                <div style={{ fontSize: 12, color: 'var(--tx3)', maxWidth: 520, lineHeight: 1.45 }}>
                  {t('wf_broadcast_ready_hint')}
                </div>
                {broadcastReady && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 520 }}>
                    <label style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)' }}>
                      {t('bc_caption_seed')}
                    </label>
                    <textarea
                      data-testid="wf-broadcast-caption-seed"
                      value={broadcastCaptionSeed}
                      onChange={(e) => setBroadcastCaptionSeed(e.target.value.slice(0, 2000))}
                      rows={3}
                      className="input"
                      style={{ resize: 'vertical', minHeight: 64, padding: 8, fontSize: 12, lineHeight: 1.4 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.4 }}>
                      {t('bc_caption_seed_hint')}
                    </div>
                  </div>
                )}
              </div>
              {needsPhoto && prodStage === 'catalogued' && (
                <div style={{ marginTop: 12, padding: '8px 14px', background: 'var(--dust)22', border: '1px solid var(--dust)44', fontSize: 12, color: 'var(--tx2)' }}>
                  {t('wf_photo_pending_hint')}
                </div>
              )}
            </section>

            {/* 3. Ownership & Flow */}
            <section>
              <SectionHeader title={t('wf_section_ownership')} />
              <PipeProgress
                stages={OWNERSHIP_STAGES.map(s => ({
                  ...s,
                  disabled: isOwnershipTransferred && s.id !== 'sold' && s.id !== 'gift',
                }))}
                current={ownStage}
                onSelect={(id) => setOwnStage(id as OwnStageId)}
                color="var(--cyan)"
              />
              <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 24, marginTop: 24 }}>
                <Field label={ownStage === 'consigned' || ownStage === 'loan' ? t('wf_contact_custodian') : ownStage === 'reserved' ? t('wf_contact_buyer_intent') : t('wf_contact_acquire')}>
                  {ownStage === 'artist' || ownStage === 'artist_archive' ? (
                    <div style={{ ...FIS, display: 'flex', alignItems: 'center', background: 'var(--bg2)44', opacity: 0.8, cursor: 'default' }}>
                      {pemContact?.NomInstitution ?? 'Pem (Artiste)'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={contactId} onChange={e => setContactId(e.target.value)} style={FIS}>
                        <option value="">{t('select_option_placeholder')}</option>
                        {localContacts.map(c => (
                          <option key={c.ContactID} value={c.ContactID}>
                            {c.NomInstitution ?? `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn ghost sm" onClick={() => setShowContactModal(true)}>+</button>
                    </div>
                  )}
                </Field>
                <div style={{ background: 'var(--bg1)', padding: 20, border: '1px solid var(--bd)', alignSelf: 'flex-end' }}>
                  <div className="t-label" style={{ fontSize: 10, marginBottom: 6 }}>{t('wf_localisation_now')}</div>
                  <div className="t-mono-sm" style={{ color: 'var(--ac)', fontSize: 12 }}>{currentLoc}</div>
                </div>
              </div>

              {/* Confidentialité du contact — défaut public, choix du propriétaire */}
              <div style={{ marginTop: 24, borderTop: '1px solid var(--bd)', paddingTop: 20 }}>
                <div className="t-eyebrow" style={{ fontSize: 11, marginBottom: 4 }}>{t('wf_visibility_hdr')}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 12, lineHeight: 1.5 }}>
                  {t('wf_visibility_blurb')}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {visibilityOptions.map(({ level, label, desc }) => {
                    const isActive = anonymityLevel === level
                    return (
                      <button
                        key={level}
                        type="button"
                        title={desc}
                        onClick={() => setAnonymityLevel(level)}
                        style={{
                          flex: 1, padding: '10px 8px', fontSize: 11, cursor: 'pointer',
                          border: `1px solid ${isActive ? 'var(--ac)' : 'var(--bd)'}`,
                          background: isActive ? 'var(--ac)22' : 'var(--bg2)',
                          color: isActive ? 'var(--ac)' : 'var(--tx2)',
                          textAlign: 'center', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: isActive ? 700 : 400 }}>{label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* 4. Financials */}
            <section style={{ background: paymentDone ? 'transparent' : 'var(--rust)08', border: `1px solid ${paymentDone ? 'var(--bd)' : 'var(--rust)44'}`, padding: 24 }}>
              <SectionHeader title={t('wf_section_finance')} />
              <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, 1fr)', gap: 24 }}>
                <Field label={t('wf_price')}>
                  <input value={prix} onChange={e => setPrix(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
                </Field>
                <Field label={t('wf_discount')}>
                  <input value={discount} onChange={e => setDiscount(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
                </Field>
                <Field label={t('wf_vat')}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    list="work-tva-presets"
                    value={tvaRate}
                    onChange={e => setTvaRate(e.target.value)}
                    placeholder="0–100"
                    style={FIS}
                    disabled={ownStage === 'gift'}
                  />
                  <datalist id="work-tva-presets">
                    <option value="0" />
                    <option value="5.5" />
                    <option value="10" />
                    <option value="20" />
                  </datalist>
                </Field>
                <div style={{ alignSelf: 'flex-end' }}>
                  <div className="t-label" style={{ fontSize: 11, color: paymentDone ? 'var(--tx3)' : 'var(--rust)', marginBottom: 6 }}>{t('wf_final_ht')}</div>
                  <div className="t-mono-md" style={{ fontWeight: 700, fontSize: 18 }}>€ {prixFinal.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
                <Switch label={t('wf_payment_rcvd')} checked={paymentDone} onChange={setPaymentDone} disabled={ownStage === 'gift'} />
              </div>
              {isOwnershipTransferred && ownStage !== 'gift' && (
                <div style={{ marginTop: 24, padding: 16, background: 'var(--bg2)', borderLeft: `3px solid ${paymentDone ? 'var(--ac)' : 'var(--rust)'}` }}>
                  <div className="t-eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>{t('wf_settlement')}</div>
                  <div style={{ display: 'flex', gap: 24, color: 'var(--tx2)' }}>
                    <div className="t-mono-xs" style={{ fontSize: 12 }}>{t('wf_paid')} : € {(paymentDone ? prixFinal : 0).toLocaleString()}</div>
                    <div className="t-mono-xs" style={{ fontSize: 12 }}>{t('wf_due')} : € {(paymentDone ? 0 : prixFinal).toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}>
                <Field label={t('wf_groups')}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {localGroups.map(g => {
                      const isSel = selGroups.has(g.id)
                      return (
                        <div key={g.id}
                          onClick={() => setSelGroups(p => { const n = new Set(p); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n })}
                          style={{ padding: '6px 14px', fontSize: 12, cursor: 'pointer', border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd)'}`, background: isSel ? 'var(--ac)22' : 'transparent', color: isSel ? 'var(--ac)' : 'var(--tx3)', borderRadius: 14 }}>
                          {g.name}
                        </div>
                      )
                    })}
                  </div>
                </Field>
              </div>
            </section>

          </div>
        </div>
      </form>

      {narrow && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 50,
          borderTop: '1px solid var(--bd)',
          background: 'var(--bg1)',
          padding: '10px max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}>
          <button type="button" className="btn ghost sm" onClick={() => router.back()} style={{ flexShrink: 0 }}>
            ← {t('back')}
          </button>
          <button type="button" className="btn primary" onClick={handleSubmit} disabled={isPending} style={{ flex: 1 }}>
            {isPending ? t('savingRecord') : t('save')}
          </button>
        </div>
      )}

      {showContactModal && (
        <ContactModal
          onClose={() => setShowContactModal(false)}
          onCreated={c => { setLocalContacts(p => [...p, c]); setContactId(String(c.ContactID)) }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="t-eyebrow" style={{ marginBottom: 20, color: 'var(--tx3)', fontSize: 12, borderBottom: '1px solid var(--bd)', paddingBottom: 8 }}>
      {title}
    </div>
  )
}

function PipeProgress({ stages, current, onSelect, color }: { stages: any[]; current: string; onSelect: (id: string) => void; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, width: '100%' }}>
      {stages.map((s, i) => {
        const isActive  = s.id === current
        const isPast    = stages.findIndex(x => x.id === current) >= i
        const isDisabled = s.disabled
        return (
          <div key={s.id} onClick={() => !isDisabled && onSelect(s.id)}
            style={{
              flex: 1, cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              borderBottom: `3px solid ${isPast ? color : 'var(--bd)'}`,
              padding: '8px 4px', opacity: isDisabled ? 0.2 : (isPast ? 1 : 0.4),
            }}>
            <div style={{ fontSize: 11, fontWeight: isActive ? 700 : 400, color: isPast ? 'var(--tx)' : 'var(--tx3)' }}>{s.label}</div>
            {s.desc && <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>{s.desc}</div>}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="t-label" style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.05em' }}>{label}</div>
      {children}
    </div>
  )
}

function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  testId,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  testId?: string
}) {
  return (
    <label data-testid={testId} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer', fontSize: 13, opacity: disabled ? 0.5 : 1 }}>
      <div onClick={() => !disabled && onChange(!checked)}
        style={{ width: 16, height: 16, border: '1px solid var(--bd)', background: checked ? 'var(--ac)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg0)', fontSize: 11 }}>
        {checked ? '✓' : ''}
      </div>
      <span style={{ color: checked ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
    </label>
  )
}

function CreatableSelect({ value, options, onChange, onAdd, name }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; onAdd: (v: string) => void; name: string }) {
  const { t } = useI18n()
  const [isAdding, setIsAdding] = useState(false)
  const [newVal, setNewVal] = useState('')
  if (isAdding) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={newVal} onChange={e => setNewVal(e.target.value)} style={{ ...FIS, height: 42 }} placeholder={t('wf_placeholder_new')} autoFocus />
        <button type="button" className="btn primary sm" onClick={() => { onAdd(newVal); setIsAdding(false); setNewVal('') }}>OK</button>
        <button type="button" className="btn ghost sm" onClick={() => setIsAdding(false)}>✕</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select name={name} value={value} onChange={e => onChange(e.target.value)} style={FIS}>
        <option value="">{t('select_option_placeholder')}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <button type="button" className="btn ghost sm" onClick={() => setIsAdding(true)} style={{ padding: '0 8px' }}>+</button>
    </div>
  )
}

function ImageManager({ oeuvreId, initialImages, narrow }: { oeuvreId: number; initialImages: WorkImage[]; narrow: boolean }) {
  const { t } = useI18n()
  const [imgs, setImgs] = useState(initialImages)
  const [busy, setBusy] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const [uploadIndex, setUploadIndex] = useState(0)
  const [uploadTotal, setUploadTotal] = useState(0)
  const cancelQueueRef = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const sorted = useMemo(() => [...imgs].sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0)), [imgs])
  const initialSnap = useMemo(
    () => initialImages.map((i) => `${i.ImageID}:${i.SeqNo}`).join(','),
    [initialImages],
  )
  useEffect(() => {
    setImgs([...initialImages].sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0)))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initialSnap encodes server rows; avoid initialImages identity churn
  }, [initialSnap, oeuvreId])

  async function persistOrder(ids: number[]) {
    const res = await reorderWorkImages(oeuvreId, ids)
    if ('error' in res) alert(`${t('error_prefix')} ${res.error}`)
    else {
      setImgs((prev) => {
        const map = new Map(prev.map((r) => [r.ImageID, r]))
        return ids.map((id, i) => ({ ...map.get(id)!, SeqNo: i + 1 }))
      })
    }
  }

  function nudge(sortedIndex: number, dir: -1 | 1) {
    const j = sortedIndex + dir
    if (j < 0 || j >= sorted.length) return
    const ids = sorted.map((x) => x.ImageID)
    const a = ids[sortedIndex]!
    const b = ids[j]!
    ids[sortedIndex] = b
    ids[j] = a
    void persistOrder(ids)
  }

  function makeCover(sortedIndex: number) {
    if (sortedIndex < 0 || sortedIndex >= sorted.length) return
    const ids = sorted.map((x) => x.ImageID)
    const id = ids.splice(sortedIndex, 1)[0]!
    ids.push(id)
    void persistOrder(ids)
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!oeuvreId || list.length === 0) return
    cancelQueueRef.current = false
    setBusy(true)
    setUploadTotal(list.length)
    try {
      for (let i = 0; i < list.length; i++) {
        if (cancelQueueRef.current) break
        const file = list[i]!
        setUploadIndex(i + 1)
        setUploadName(file.name)
        const prepared = await downscaleImageFileForMobileIfNeeded(file, narrow)
        const stopTick = startEstimatedUploadProgress(prepared.size, setUploadPct)
        try {
          const res = await withUploadRetry(
            async () => {
              const fd = new FormData()
              fd.append('image', prepared)
              fd.append('oeuvre_id', String(oeuvreId))
              return addWorkImage(fd)
            },
            { onRetry: () => toast.info(t('upload_retry_toast')) },
          )
          if ('error' in res) {
            toast.error(`${t('error_prefix')} ${res.error}`)
            break
          }
          setImgs((p) => [...p, res.image].sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0)))
        } catch (err) {
          toast.error(`${t('error_prefix')} ${String(err)}`)
          break
        } finally {
          stopTick()
          setUploadPct(0)
        }
      }
    } finally {
      setBusy(false)
      setUploadIndex(0)
      setUploadTotal(0)
      setUploadName('')
      setUploadPct(0)
    }
  }
  async function onDelete(id: number) {
    if (!confirm(t('confirm_delete_image'))) return
    const res = await deleteWorkImage(id, oeuvreId); if ('ok' in res) setImgs(p => p.filter(img => img.ImageID !== id))
  }
  const pctLabel = Math.round(uploadPct * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="t-eyebrow" style={{ fontSize: 12 }}>{t('wf_images_heading')}</div>
      {oeuvreId > 0 && sorted.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.45, marginBottom: 4 }}>
          {t('wf_images_reorder_hint')}
        </div>
      )}
      {oeuvreId <= 0 && (
        <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.45 }}>
          {t('wf_images_save_first_hint')}
        </div>
      )}
      {busy && (uploadPct > 0 || uploadName) && (
        <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.4 }} role="status">
          <div>{t('wf_images_upload_status').replace('{name}', uploadName)}</div>
          <div style={{ marginTop: 4, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${pctLabel}%`, height: '100%', background: 'var(--ac)', transition: 'width 0.12s linear' }} />
          </div>
          {uploadTotal > 1 && (
            <div style={{ marginTop: 4, color: 'var(--tx3)' }}>
              {uploadIndex}/{uploadTotal}
            </div>
          )}
        </div>
      )}
      {busy && uploadTotal > 1 && (
        <button type="button" className="btn ghost sm" onClick={() => { cancelQueueRef.current = true }}>
          {t('wf_images_upload_cancel')}
        </button>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {sorted.map((img, si) => (
          <div key={img.ImageID} style={{ position: 'relative', aspectRatio: '1', background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
            <WorkThumb file={img.txtImageNameLink ?? ''} size={256} alt="" />
            <button type="button" onClick={() => onDelete(img.ImageID)}
              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
            {oeuvreId > 0 && sorted.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  right: 4,
                  display: 'flex',
                  gap: 4,
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.45)',
                  borderRadius: 4,
                  padding: '2px 4px',
                }}
              >
                <button type="button" disabled={si === 0} onClick={() => nudge(si, -1)} aria-label={t('wf_images_order_before_aria')} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: si === 0 ? 'default' : 'pointer', fontSize: 12, padding: '0 4px', opacity: si === 0 ? 0.35 : 1 }}>←</button>
                <button type="button" disabled={si === sorted.length - 1} onClick={() => nudge(si, 1)} aria-label={t('wf_images_order_after_aria')} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: si === sorted.length - 1 ? 'default' : 'pointer', fontSize: 12, padding: '0 4px', opacity: si === sorted.length - 1 ? 0.35 : 1 }}>→</button>
                <button type="button" disabled={si === sorted.length - 1} onClick={() => makeCover(si)} aria-label={t('wf_images_order_cover_aria')} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: si === sorted.length - 1 ? 'default' : 'pointer', fontSize: 12, padding: '0 4px', opacity: si === sorted.length - 1 ? 0.35 : 1 }}>★</button>
              </div>
            )}
          </div>
        ))}
        {oeuvreId > 0 && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple={narrow}
              capture={narrow ? 'environment' : undefined}
              style={{ display: 'none' }}
              onChange={onUpload}
              tabIndex={-1}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              aria-label={t('wf_images_add_aria')}
              style={{
                aspectRatio: '1',
                border: '1px dashed var(--bd)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: 'var(--tx3)',
                cursor: busy ? 'wait' : 'pointer',
                background: 'transparent',
                padding: 0,
              }}
            >
              {busy ? '…' : '+'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ NomInstitution: '', Nom: '', Prénom: '', Role: '', Ville: '', Pays: '', Email: '', Téléphone1: '', Website: '', Adresse: '' })
  const [busy, setBusy] = useState(false)
  const emptySnap = useMemo(() => JSON.stringify({ NomInstitution: '', Nom: '', Prénom: '', Role: '', Ville: '', Pays: '', Email: '', Téléphone1: '', Website: '', Adresse: '' }), [])
  const formSnap = useMemo(() => JSON.stringify(form), [form])
  const [baselineSnap, setBaselineSnap] = useState<string | null>(null)
  useLayoutEffect(() => {
    setBaselineSnap(emptySnap)
  }, [emptySnap])
  const isDirty = baselineSnap != null && formSnap !== baselineSnap

  async function handleSave(): Promise<boolean> {
    if (!form.NomInstitution && !form.Nom) return false
    setBusy(true)
    const sb = createClient()
    const { data, error } = await sb.from('Contact').insert(form).select().single()
    setBusy(false)
    if (!error && data) {
      onCreated(data)
      onClose()
      return true
    }
    return false
  }

  const performSave = async () => handleSave()

  const { attemptClose, unsavedDialog } = useUnsavedCloseGuard({
    isDirty,
    onClose,
    performSave,
  })

  return (
    <>
    {unsavedDialog}
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={attemptClose}
    >
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 40, width: 720, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="t-eyebrow" style={{ marginBottom: 24, fontSize: 13, color: 'var(--ac)' }}>{t('wf_new_contact')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="INSTITUTION"><input value={form.NomInstitution} onChange={e => setForm(p => ({ ...p, NomInstitution: cap(e.target.value) }))} style={FIS} autoFocus /></Field>
          <Field label="RÔLE"><input value={form.Role} onChange={e => setForm(p => ({ ...p, Role: cap(e.target.value) }))} style={FIS} /></Field>
          <Field label="PRÉNOM"><input value={form.Prénom} onChange={e => setForm(p => ({ ...p, Prénom: cap(e.target.value) }))} style={FIS} /></Field>
          <Field label="NOM"><input value={form.Nom} onChange={e => setForm(p => ({ ...p, Nom: cap(e.target.value) }))} style={FIS} /></Field>
          <Field label="EMAIL"><input value={form.Email} onChange={e => setForm(p => ({ ...p, Email: e.target.value }))} style={FIS} /></Field>
          <Field label="TÉLÉPHONE"><input value={form.Téléphone1} onChange={e => setForm(p => ({ ...p, Téléphone1: e.target.value }))} style={FIS} /></Field>
          <Field label="SITE WEB"><input value={form.Website} onChange={e => setForm(p => ({ ...p, Website: e.target.value }))} style={FIS} /></Field>
          <Field label="ADRESSE"><input value={form.Adresse} onChange={e => setForm(p => ({ ...p, Adresse: e.target.value }))} style={FIS} /></Field>
          <Field label="VILLE"><input value={form.Ville} onChange={e => setForm(p => ({ ...p, Ville: cap(e.target.value) }))} style={FIS} /></Field>
          <Field label="PAYS"><input value={form.Pays} onChange={e => setForm(p => ({ ...p, Pays: cap(e.target.value) }))} style={FIS} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" className="btn ghost sm" onClick={attemptClose} style={{ flex: 1 }}>{t('cancel')}</button>
          <button type="button" className="btn primary sm" onClick={() => void handleSave()} style={{ flex: 1, background: 'var(--ac)' }} disabled={busy}>{t('save')}</button>
        </div>
      </div>
    </div>
    </>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────

const FIS: React.CSSProperties = {
  padding: '10px 14px', fontSize: 14,
  background: 'var(--bg2)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
