'use client'

import { imageUrl, thumbUrl, yearOf, statusOf } from '@/lib/data'
import { StatusChip } from '@/components/ui/StatusChip'
import { WorkStateChip } from './WorkStateChip'
import { deleteWork } from '@/app/atelier/works/actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState, useTransition, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { saveWork, createLookup } from '@/app/atelier/works/actions'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb } from './WorkThumb'

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
}

interface ActionType { id: number; label: string; color: string; field_key: string | null; sort_order: number }

export function WorkDrawer({
  o, tM, sM, cM, pM, fM, locMap, statusLabelMap, selection, setSelection, toggleInSel, onClose, onEdit,
  thM, oeuvreThemeMap, oeuvreGroupMap, groupNameMap,
  techniques: initialTechniques, supports: initialSupports, formats: initialFormats,
  themes: initialThemes, contacts: initialContacts, groups: initialGroups,
  presentations: initialPresentations,
  mode = 'overlay', expanded: expandedProp = false, setExpanded: setExpandedProp,
}: Props) {
  const { t }  = useI18n()
  const router = useRouter()
  const isPanel = mode === 'panel'

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
  const pendingWheelDy = useRef(0)
  const wheelRafId = useRef<number | null>(null)

  // Reset on work change
  useEffect(() => {
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

  // Wheel zoom — accumulate delta, apply at most once per animation frame (fewer React commits).
  useLayoutEffect(() => {
    const el = imgContainerRef.current
    if (!el) return

    const flushWheel = () => {
      wheelRafId.current = null
      const dy = pendingWheelDy.current
      pendingWheelDy.current = 0
      if (dy === 0) return
      setImgZoom(z => {
        const next = Math.min(2, Math.max(1, z - dy * 0.003))
        if (next <= 1) setImgPan({ x: 0, y: 0 })
        return next
      })
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      pendingWheelDy.current += e.deltaY
      if (wheelRafId.current == null) {
        wheelRafId.current = requestAnimationFrame(flushWheel)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelRafId.current != null) cancelAnimationFrame(wheelRafId.current)
      wheelRafId.current = null
      pendingWheelDy.current = 0
    }
  }, [o?.OeuvreID])

  if (!o) {
    return isPanel
      ? <div style={{ flex: '0 0 35%', minWidth: 320, padding: 20, color: 'var(--tx3)' }} className="t-mono-sm">—</div>
      : null
  }

  const isSel  = selection.has(o.OeuvreID)
  const st     = statusOf(o, statusLabelMap)
  const isSold = st === 'sold'
  const isLoan = st === 'loan' || st === 'consigned'

  const isExpanded = isPanel ? (expandedProp || imgZoom > 1) : false
  const activeImgPath = workImages.length > 0 && activeImgIdx >= 0
    ? workImages[activeImgIdx]?.txtImageNameLink ?? o.txtImageNameLink
    : o.txtImageNameLink

  // ── Wrapper ────────────────────────────────────────────
  if (isPanel) {
    return (
      <div ref={panelRef} style={{
        flex: `0 0 ${isExpanded ? '55vw' : '35%'}`,
        minWidth: 320,
        padding: 0, overflow: 'auto', background: 'var(--bg1)',
        borderLeft: '1px solid var(--bd)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isExpanded ? '-10px 0 40px rgba(0,0,0,0.4)' : 'none',
        maxHeight: isExpanded ? '75vh' : '100%',
        alignSelf: 'center',
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
            workImages={workImages} activeImgIdx={activeImgIdx} setActiveImgIdx={setActiveImgIdx}
            imgContainerRef={imgContainerRef} isDragging={isDragging} dragStart={dragStart}
            activeImgPath={activeImgPath}
            isSel={isSel} st={st} isSold={isSold} isLoan={isLoan}
          />
        </div>
      </div>
    )
  }

  // Overlay mode
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 60, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 460, maxWidth: '50vw', maxHeight: '75vh', height: 'fit-content', background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: '16px 0 0 16px', padding: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', boxShadow: '-10px 0 50px rgba(0,0,0,0.4)', margin: 'auto 0' }}
      >
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
            mode="overlay" isExpanded={false}
            imgZoom={imgZoom} setImgZoom={setImgZoom}
            imgPan={imgPan} setImgPan={setImgPan}
            naturalSize={naturalSize} setNaturalSize={setNaturalSize}
            workImages={workImages} activeImgIdx={activeImgIdx} setActiveImgIdx={setActiveImgIdx}
            imgContainerRef={imgContainerRef} isDragging={isDragging} dragStart={dragStart}
            activeImgPath={activeImgPath}
            isSel={isSel} st={st} isSold={isSold} isLoan={isLoan}
          />
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   DrawerContent — shared inner body
   ══════════════════════════════════════════════════════════════════ */

function DrawerContent({
  o, tM, sM, cM, pM, statusLabelMap, selection, setSelection, toggleInSel, onClose, onEdit,
  thM, oeuvreThemeMap, oeuvreGroupMap, groupNameMap,
  initialTechniques, initialSupports, initialFormats, initialThemes,
  initialContacts, initialGroups, initialPresentations,
  mode, isExpanded, setExpanded,
  imgZoom, setImgZoom, imgPan, setImgPan, naturalSize, setNaturalSize,
  workImages, activeImgIdx, setActiveImgIdx,
  imgContainerRef, isDragging, dragStart, activeImgPath,
  isSel, st, isSold, isLoan,
}: any) {
  const { t } = useI18n()
  const router = useRouter()
  const isPanel = mode === 'panel'

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
  const [statusId,    setStatusId]    = useState(String(o.statusId ?? ''))
  const [contactId,   setContactId]   = useState(String(o.ContactID ?? ''))
  const [locId,       setLocId]       = useState(String(o.LocalisationID ?? ''))
  const [exposable,   setExposable]   = useState(!!o.Exposable)
  const [encadree,    setEncadree]    = useState(!!o.Encadree)
  const [prix,        setPrix]        = useState(String(o.Prix ?? ''))
  const [prixFinal,   setPrixFinal]   = useState(String((o as any).PrixFinal ?? ''))
  const [selThemes, setSelThemes] = useState<Set<number>>(new Set())
  const [selGroups, setSelGroups] = useState<Set<string>>(new Set())
  const [localContacts, setLocalContacts] = useState(initialContacts)
  const [showNewContact, setShowNewContact] = useState(false)
  const [newC, setNewC] = useState({ inst: '', prenom: '', nom: '', role: '', email: '', phone: '', ville: '', pays: '', notes: '' })
  const [creatingContact, setCreatingContact] = useState(false)
  const [anonymityLevel, setAnonymityLevel] = useState<number>((o as any).anonymity_level ?? 0)
  const [adminOverride, setAdminOverride] = useState<boolean>((o as any).admin_override_anonymity ?? false)

  const panRafId = useRef<number | null>(null)
  const latestMouseRef = useRef({ x: 0, y: 0 })

  // Sync on work change
  useEffect(() => {
    setTitre(o.Titre ?? '')
    setAnnee(o.Année ?? '')
    setTechniqueId(String(o.Technique ?? ''))
    setSupportId(String(o.Support ?? ''))
    setFormatId(String(o.Format ?? ''))
    setHauteur(String(o.Hauteur ?? ''))
    setLargeur(String(o.Largeur ?? ''))
    setProfondeur(String(o.Profondeur ?? ''))
    setPresentationId(String((o as any).PresentationID ?? ''))
    setStatusId(String(o.statusId ?? ''))
    setContactId(String(o.ContactID ?? ''))
    setLocId(String(o.LocalisationID ?? ''))
    setExposable(!!o.Exposable)
    setEncadree(!!o.Encadree)
    setPrix(String(o.Prix ?? ''))
    setPrixFinal(String((o as any).PrixFinal ?? ''))
    setSelThemes(new Set(oeuvreThemeMap.get(o.OeuvreID) ?? []))
    setSelGroups(new Set(oeuvreGroupMap.get(o.OeuvreID) ?? []))
    setAnonymityLevel((o as any).anonymity_level ?? 0)
    setAdminOverride((o as any).admin_override_anonymity ?? false)
    setLocalContacts(initialContacts)
  }, [o.OeuvreID, oeuvreThemeMap, oeuvreGroupMap, o, initialContacts])

  // Lookups
  const [localTechniques, setLocalTechniques] = useState(initialTechniques)
  const [localSupports,   setLocalSupports]   = useState(initialSupports)
  const [localFormats,    setLocalFormats]    = useState(initialFormats)

  async function saveLookup(table: string, name: string) {
    if (!name) return
    const res = await createLookup(table, cap(name))
    if ('error' in res) { alert('Erreur : ' + res.error); return }
    if (table === 'Technique') { setLocalTechniques((p: any) => [...p, { TechniqueID: res.id, Technique: cap(name) }]); setTechniqueId(String(res.id)) }
    else if (table === 'Support') { setLocalSupports((p: any) => [...p, { SupportID: res.id, Support: cap(name) }]); setSupportId(String(res.id)) }
    else if (table === 'Format') { setLocalFormats((p: any) => [...p, { FormatID: res.id, Format: cap(name) }]); setFormatId(String(res.id)) }
  }

  // ── Logic Gates ────────────────────────────────────────
  const statusNum = Number(statusId)
  const isGateLocked = (statusNum === 1 || statusNum === 2) && !adminOverride

  useEffect(() => {
    if (isGateLocked) setAnonymityLevel(0)
  }, [isGateLocked])

  // ── Pipeline ───────────────────────────────────────────
  const [pipeline,    setPipeline]    = useState<ActionType[]>([])
  const [workActions, setWorkActions] = useState<Record<number, boolean>>({})

  const loadPipeline = useCallback(async () => {
    const sb = createClient()
    const [{ data: types }, { data: acts }] = await Promise.all([
      sb.from('work_action_type').select('id, label, color, field_key, sort_order').order('sort_order'),
      sb.from('work_action').select('action_type_id, done').eq('oeuvre_id', o.OeuvreID)
    ])
    if (types) setPipeline(types)
    if (acts) {
      const m: Record<number, boolean> = {}
      acts.forEach((a: any) => { m[a.action_type_id] = a.done })
      setWorkActions(m)
    }
  }, [o.OeuvreID])

  useEffect(() => { loadPipeline() }, [loadPipeline])

  async function toggleAction(type: ActionType) {
    const sb = createClient()
    const isDone = workActions[type.id] ?? false
    const nextDone = !isDone
    setWorkActions(prev => ({ ...prev, [type.id]: nextDone }))
    await sb.from('work_action').upsert({
      oeuvre_id: o.OeuvreID,
      action_type_id: type.id,
      done: nextDone,
      done_at: nextDone ? new Date().toISOString() : null
    }, { onConflict: 'oeuvre_id,action_type_id' })
    if (type.field_key) {
      await sb.from('Oeuvres').update({ [type.field_key]: nextDone }).eq('OeuvreID', o.OeuvreID)
    }
    router.refresh()
  }

  // ── Save ───────────────────────────────────────────────
  async function handleSubmit() {
    const fd = new FormData()
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
    fd.append('status_id', statusId)
    fd.append('contact_id', contactId)
    fd.append('localisation_id', locId)
    fd.append('exposable', exposable ? '1' : '0')
    fd.append('encadree', encadree ? '1' : '0')
    fd.append('prix', prix)
    fd.append('prix_final', prixFinal)
    fd.append('anonymity_level', String(anonymityLevel))
    fd.append('admin_override_anonymity', adminOverride ? '1' : '0')
    selThemes.forEach(id => fd.append('themes', String(id)))
    selGroups.forEach(id => fd.append('groups', id))

    startSave(async () => {
      const res = await saveWork(fd)
      if ('error' in res) { alert(res.error) }
      else { router.refresh() }
    })
  }

  // ── Delete ─────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  function handleDelete() {
    startDelete(async () => {
      try {
        const result = await deleteWork(o.OeuvreID)
        if ('error' in result) { setDeleteError(result.error); return }
        onClose()
        router.refresh()
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

  const doneCount = pipeline.filter(at => workActions[at.id]).length
  const totalSteps = pipeline.length

  const cName = (c: typeof localContacts[0]) => c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`
  const sortedContacts = [...localContacts].sort((a, b) => cName(a).localeCompare(cName(b), 'fr'))

  const useFullResPreview = imgZoom > 1
  const previewImgSrc = activeImgPath
    ? ((useFullResPreview ? imageUrl(activeImgPath) : thumbUrl(activeImgPath)) ?? '')
    : ''
  const previewImgKey = activeImgPath ? `${activeImgPath}-${useFullResPreview ? 'full' : 'thumb'}` : ''

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
    if (error) { alert('Erreur : ' + error.message); return }
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
        </div>
        <div className="row gap-sm">
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
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 24, padding: '0 6px' }}>×</button>
        </div>
      </div>

      {/* Image */}
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
              <img
                key={previewImgKey}
                draggable={false}
                src={previewImgSrc}
                alt={o.Titre ?? ''}
                onLoad={e => {
                  const el = e.currentTarget
                  if (el.naturalWidth > 0) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
                }}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '60vh',
                  objectFit: 'contain',
                  display: 'block',
                  transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${imgZoom})`,
                  transformOrigin: 'center center',
                  transition: 'none',
                  willChange: imgZoom > 1 ? 'transform' : 'auto',
                }}
              />
            )
          : <div className="ph" style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)' }}>—</div>}
      </div>

      {/* Filmstrip */}
      {workImages.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {workImages.map((img: any, idx: number) => (
            <button key={img.ImageID}
              onClick={() => { setActiveImgIdx(idx); setImgZoom(1); setImgPan({ x: 0, y: 0 }) }}
              style={{ width: 44, height: 44, padding: 0, border: `2px solid ${idx === activeImgIdx ? 'var(--ac)' : 'var(--bd)'}`, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg0)', flexShrink: 0 }}
              title={`Image ${idx + 1}${idx === workImages.length - 1 ? ' (couverture)' : ''}`}
            >
              {img.txtImageNameLink && <WorkThumb file={img.txtImageNameLink} alt={`Vue ${idx + 1}`} size={64} displaySize="44px" />}
            </button>
          ))}
        </div>
      )}

      {/* Title (inline edit) */}
      <input
        value={titre}
        onChange={e => setTitre(cap(e.target.value))}
        style={{ ...FIS, fontSize: 24, fontFamily: 'var(--font-serif)', marginBottom: 16, height: 40, border: 'none', borderBottom: '1px solid var(--bd)', background: 'transparent', width: '100%' }}
        placeholder={t('untitled')}
      />

      {/* ═══ STATUS BAR ═══ */}
      {(() => {
        const STATUS_STAGES: { id: number; label: string; short: string; color: string }[] = [
          { id: 1,  label: 'En production', short: 'Prod',    color: 'var(--rust)' },
          { id: 2,  label: 'Disponible',    short: 'Dispo',   color: 'var(--sage)' },
          { id: 4,  label: 'Réservé',       short: 'Rés.',    color: 'var(--dust)' },
          { id: 7,  label: 'Consigné',      short: 'Cons.',   color: 'var(--dust)' },
          { id: 8,  label: 'Prêt',          short: 'Prêt',    color: 'var(--cyan)' },
          { id: 6,  label: 'Vendu',         short: 'Vendu',   color: 'var(--mt)'   },
          { id: 11, label: 'Gift',          short: 'Don',     color: 'var(--mt)'   },
          { id: 3,  label: 'Archive artiste', short: 'Arch.', color: 'var(--mt)'   },
          { id: 5,  label: 'Archive privée',  short: 'Priv.', color: 'var(--mt)'   },
          { id: 9,  label: 'Destroyed',     short: 'Détruit', color: '#555'        },
          { id: 10, label: 'Lost',          short: 'Perdu',   color: '#555'        },
        ].filter(s => statusLabelMap[s.id] != null)
        const curId = Number(statusId)
        return (
          <section style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', height: 32, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--bd)' }}>
              {STATUS_STAGES.map((s, i) => {
                const active = s.id === curId
                return (
                  <div key={s.id} onClick={() => setStatusId(String(s.id))} title={s.label}
                    style={{ flex: 1, background: active ? s.color : 'var(--bg0)', cursor: 'pointer', borderRight: i < STATUS_STAGES.length - 1 ? '1px solid var(--bd)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'rgba(0,0,0,0.7)' : 'var(--tx3)', overflow: 'hidden', whiteSpace: 'nowrap', padding: '0 1px' }}>
                      {active ? s.short : s.short.charAt(0)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', marginTop: 3 }}>
              {STATUS_STAGES.map(s => (
                <span key={s.id} style={{ flex: 1, fontSize: 9, textAlign: 'center', color: s.id === curId ? 'var(--tx2)' : 'var(--tx3)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {s.short}
                </span>
              ))}
            </div>
          </section>
        )
      })()}

      {/* ═══ PIPELINE BAR ═══ */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)' }}>Pipeline</span>
          <span style={{ fontSize: 10, color: 'var(--tx3)', marginLeft: 'auto' }}>{doneCount}/{totalSteps}</span>
        </div>
        <div style={{ display: 'flex', height: 30, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--bd)' }}>
          {pipeline.map((at, i) => {
            const isDone = workActions[at.id] ?? false
            return (
              <div key={at.id} onClick={() => toggleAction(at)} title={at.label}
                style={{ flex: 1, background: isDone ? at.color : 'var(--bg0)', cursor: 'pointer', borderRight: i < pipeline.length - 1 ? '1px solid var(--bd)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s ease' }}
              >
                <span style={{ fontSize: 10, color: isDone ? 'rgba(0,0,0,0.6)' : 'var(--tx3)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                  {isDone ? '✓' : at.label.charAt(0)}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
          {pipeline.map(at => (
            <span key={at.id} style={{ flex: 1, fontSize: 9, textAlign: 'center', color: (workActions[at.id] ?? false) ? 'var(--tx2)' : 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {at.label}
            </span>
          ))}
        </div>
      </section>

      {/* ═══ VISIBILITY & ANONYMITY GATE ═══ */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)' }}>Visibility</span>
          {isGateLocked && (
            <span style={{ fontSize: 9, color: '#c88c28', display: 'flex', alignItems: 'center', gap: 3 }}>
              🔒 Gate: forcé par statut
            </span>
          )}
          {(statusNum === 1 || statusNum === 2) && (
            <button
              onClick={() => setAdminOverride(!adminOverride)}
              style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 6px', borderRadius: 2, border: `1px solid ${adminOverride ? 'var(--ac)' : 'var(--bd)'}`, background: adminOverride ? 'rgba(100,180,255,0.1)' : 'transparent', color: adminOverride ? 'var(--ac)' : 'var(--tx3)', cursor: 'pointer' }}
            >
              {adminOverride ? '🛡 Override ON' : '🛡 Override'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--bd)' }}>
          {[
            { level: 0, label: 'PUBLIC', color: '#4caf50' },
            { level: 1, label: 'ANONYME', color: '#ff9800' },
            { level: 2, label: 'PRIVÉ', color: '#f44336' },
          ].map(opt => {
            const active = anonymityLevel === opt.level
            const disabled = isGateLocked && opt.level !== 0
            return (
              <button key={opt.level} disabled={disabled}
                onClick={() => !disabled && setAnonymityLevel(opt.level)}
                style={{ flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: active ? opt.color : 'var(--bg0)', color: active ? '#fff' : disabled ? 'var(--tx3)' : 'var(--tx2)', opacity: disabled ? 0.4 : 1, transition: 'all 0.15s ease' }}
              >{opt.label}</button>
            )
          })}
        </div>
        {anonymityLevel === 2 && (
          <div style={{ marginTop: 6, fontSize: 9, color: '#c88c28', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c88c28' }} />
            CONFIDENTIEL
          </div>
        )}
      </section>

      {/* ═══ EDITABLE FIELDS ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section>
          <SectionTitle title="Identité" />
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 12px', fontSize: 12 }}>
            <Label>{t('year')}</Label>
            <input className="input" value={annee} onChange={e => setAnnee(e.target.value)} style={FIS} placeholder="YYYY-MM-DD" />

            <Label>{t('technique')}</Label>
            <CreatableSelect value={techniqueId} options={localTechniques.map((t: any) => ({ id: String(t.TechniqueID), label: t.Technique ?? '' }))} onChange={setTechniqueId} onAdd={(name: string) => saveLookup('Technique', name)} />

            <Label>{t('support')}</Label>
            <CreatableSelect value={supportId} options={localSupports.map((s: any) => ({ id: String(s.SupportID), label: s.Support ?? '' }))} onChange={setSupportId} onAdd={(name: string) => saveLookup('Support', name)} />

            <Label>Dim.</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input className="input" value={hauteur} onChange={e => setHauteur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder="H" />
              <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
              <input className="input" value={largeur} onChange={e => setLargeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder="W" />
              <span style={{ color: 'var(--tx3)', fontSize: 10 }}>×</span>
              <input className="input" value={profondeur} onChange={e => setProfondeur(e.target.value)} style={{ ...FIS, width: '30%' }} placeholder="D" />
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

            <Label>Groupes</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {initialGroups.map((g: any) => {
                const active = selGroups.has(g.id)
                return (
                  <button key={g.id} type="button"
                    onClick={() => setSelGroups((p: Set<string>) => { const s = new Set(p); if (s.has(g.id)) s.delete(g.id); else s.add(g.id); return s })}
                    style={{ padding: '2px 7px', fontSize: 9, borderRadius: 2, border: '1px solid var(--bd)', background: active ? 'var(--ac)44' : 'var(--bg2)', color: active ? 'var(--ac)' : 'var(--tx3)', cursor: 'pointer' }}>
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section>
          <SectionTitle title="Logistique" />
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 12px', fontSize: 12 }}>
            <Label>{t('contact')}</Label>
            <div>
              <div style={{ display: 'flex', gap: 4 }}>
                <select className="input" value={contactId} onChange={e => setContactId(e.target.value)} style={{ ...FIS, width: 'auto', flex: 1 }}>
                  <option value="">—</option>
                  {sortedContacts.map((c: any) => (
                    <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
                  ))}
                </select>
                <button type="button" className="btn ghost sm" style={{ height: 28, padding: '0 7px', fontSize: 13, flexShrink: 0 }} onClick={() => setShowNewContact(true)} title="Nouveau contact">+</button>
              </div>
              {contactId && sortedContacts.find((c: any) => String(c.ContactID) === contactId) && (
                <div style={{ fontSize: 10, color: 'var(--tx2)', marginTop: 3, paddingLeft: 2 }}>
                  {cName(sortedContacts.find((c: any) => String(c.ContactID) === contactId)!)}
                </div>
              )}
            </div>

            <Label>{t('localisation')}</Label>
            <div>
              <select className="input" value={locId} onChange={e => setLocId(e.target.value)} style={FIS}>
                <option value="">—</option>
                {sortedContacts.map((c: any) => (
                  <option key={c.ContactID} value={c.ContactID}>
                    {[cName(c), c.Ville, c.Pays].filter(Boolean).join(' — ')}
                  </option>
                ))}
              </select>
              {locId && sortedContacts.find((c: any) => String(c.ContactID) === locId) && (
                <div style={{ fontSize: 10, color: 'var(--tx2)', marginTop: 3, paddingLeft: 2 }}>
                  {[cName(sortedContacts.find((c: any) => String(c.ContactID) === locId)!), sortedContacts.find((c: any) => String(c.ContactID) === locId)?.Ville, sortedContacts.find((c: any) => String(c.ContactID) === locId)?.Pays].filter(Boolean).join(' — ')}
                </div>
              )}
            </div>

            <Label>Encadrée</Label>
            <Switch checked={encadree} onChange={setEncadree} />

            <Label>Exposable</Label>
            <Switch checked={exposable} onChange={setExposable} />
          </div>
        </section>

        <section>
          <SectionTitle title="Financier" />
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 12px', fontSize: 12 }}>
            <Label>{t('price')}</Label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--tx3)', fontSize: 11 }}>€</span>
              <input className="input" value={prix} onChange={e => setPrix(e.target.value)} style={FIS} placeholder="Base" />
            </div>

            <Label>Final</Label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--tx3)', fontSize: 11 }}>€</span>
              <input className="input" value={prixFinal} onChange={e => setPrixFinal(e.target.value)} style={FIS} placeholder="Final" />
            </div>
          </div>
        </section>
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
        <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={handleSubmit} disabled={isSaving} style={{ fontSize: 11 }}>
            {isSaving ? '…' : 'Sauvegarder'}
          </button>
          <button className={`btn ${isSel ? 'primary' : 'ghost'}`} onClick={handleToggleSel} style={{ fontSize: 11 }}>
            {isSel ? '✓ Sél.' : '+ Sél.'}
          </button>
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
    </>
  )
}

// ── Sub-components ───────────────────────────────────────

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
