'use client'

// WorkForm — full-page create / edit form for a single Oeuvre.
// Left rail: multi-image progress manager. Right pane: scrollable field grid.
// Submitted via Server Action (saveWork) with useTransition.

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { imageUrl, thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre, WorkImage } from '@/lib/types/database'
import type { SaveResult } from '@/app/atelier/works/actions'
import { addWorkImage, deleteWorkImage, reorderWorkImages } from '@/app/atelier/works/actions'

function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── A-series format → dims lookup (cm) ───────────────────────────────────
const FORMAT_DIMS: Record<string, { h: string; w: string }> = {
  A1:           { h: '84.1', w: '59.4' },
  A2:           { h: '59.4', w: '42.0' },
  A3:           { h: '42.0', w: '29.7' },
  A4:           { h: '29.7', w: '21.0' },
  A5:           { h: '21.0', w: '14.8' },
  A6:           { h: '14.8', w: '10.5' },
  '10x8':       { h: '25.4', w: '20.3' },
  'Carnet 10x8':{ h: '25.4', w: '20.3' },
}

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  oeuvre:          Oeuvre | null
  currentThemeIds: number[]
  techniques:      { TechniqueID: number; Technique: string | null }[]
  supports:        { SupportID:   number; Support:   string | null }[]
  formats:         { FormatID:    number; Format:    string | null }[]
  themes:          { ThemeID:     number; Nom:       string        }[]
  statuses:        { id: number; label: string }[]
  initialImages?:  WorkImage[]
  addresses:       { id: number; contact_id: number | null; label: string | null; city: string | null; country: string | null }[]
  action:          (fd: FormData) => Promise<SaveResult>
}

const FIS: React.CSSProperties = {
  padding: '6px 9px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}

// ── Component ─────────────────────────────────────────────────────────────

export function WorkForm({
  oeuvre, currentThemeIds,
  techniques, supports, formats, themes: initialThemes,
  contacts, statuses,
  initialImages = [],
  addresses = [],
  action,
}: Props) {
  const { t }         = useI18n()
  const router        = useRouter()
  const [isPending, startTransition] = useTransition()
  const formRef       = useRef<HTMLFormElement>(null)

  const isNew = oeuvre === null

  // Computed prix final
  const [prix,    setPrix]    = useState<string>(String(oeuvre?.Prix    ?? ''))
  const [discount,setDiscount]= useState<string>(String(oeuvre?.Discount ?? ''))
  const prixFinal = computePrixFinal(prix, discount)

  // Dimensions autofill from format
  const [hauteur,    setHauteur]    = useState<string>(oeuvre?.Hauteur    ?? '')
  const [largeur,    setLargeur]    = useState<string>(oeuvre?.Largeur    ?? '')
  const [profondeur, setProfondeur] = useState<string>(oeuvre?.Profondeur ?? '')

  // Themes (local list can grow via inline creation)
  const [allThemes, setAllThemes] = useState(initialThemes)
  const [selThemes, setSelThemes] = useState<Set<number>>(new Set(currentThemeIds))
  const [newThemeName, setNewThemeName] = useState('')
  const [addingTheme,  setAddingTheme]  = useState(false)

  // Selected status (for sending label alongside id)
  const [statusId, setStatusId] = useState<string>(String(oeuvre?.statusId ?? ''))
  const [stageProduction, setStageProduction] = useState<string>(String((oeuvre as any)?.StageProduction ?? ''))
  const [isCatalogued, setIsCatalogued] = useState<boolean>(oeuvre?.Catalogué ?? false)
  const [montee, setMontee] = useState<boolean>((oeuvre as any)?.Montee ?? false)
  const [needsPhotograph, setNeedsPhotograph] = useState<boolean>((oeuvre as any)?.NeedsPhotograph ?? false)
  const [isPublic, setIsPublic] = useState<boolean>(oeuvre?.is_public ?? false)
  const [anonymityLevel, setAnonymityLevel] = useState<number>((oeuvre as any)?.anonymity_level ?? (oeuvre?.is_public === false ? 2 : 0))
  const [disponible, setDisponible] = useState<boolean>((oeuvre as any)?.Disponible ?? true)

  // Controlled lookup selects — can grow via inline creation
  const [techniqueId,   setTechniqueId]   = useState(String(oeuvre?.Technique  ?? ''))
  const [supportId,     setSupportId]     = useState(String(oeuvre?.Support    ?? ''))
  const [formatId,      setFormatId]      = useState(String(oeuvre?.Format     ?? ''))
  // Find pem/artist contact for new-work default
  const pemContact = contacts.find((c) =>
    ['pem', 'p.e.m'].some((alias) =>
      (c.NomInstitution ?? '').toLowerCase().includes(alias) ||
      (c.Prénom ?? '').toLowerCase() === alias ||
      (c.Nom ?? '').toLowerCase() === alias,
    )
  )
  const [contactId,       setContactId]       = useState(isNew ? String(pemContact?.ContactID ?? '') : String(oeuvre?.ContactID ?? ''))
  const [localisationId,  setLocalisationId]  = useState(String(oeuvre?.LocalisationID ?? ''))
  const [isCommission,    setIsCommission]    = useState(oeuvre?.IsCommission ?? false)
  const [localTechs,      setLocalTechs]      = useState(techniques)
  const [localSupports, setLocalSupports] = useState(supports)
  const [localFormats,  setLocalFormats]  = useState(formats)
  const [localContacts, setLocalContacts] = useState(contacts)

  // Derived location label — always from the selected contact, never manually entered
  // Must be computed AFTER localContacts FIS declared
  const locDetailContact = localisationId
    ? localContacts.find((c) => String(c.ContactID) === localisationId)
    : localContacts.find((c) => String(c.ContactID) === String(pemContact?.ContactID ?? ''))
  const locDetail = locDetailContact
    ? [locDetailContact.Ville, locDetailContact.Pays].filter(Boolean).join(', ')
    : ''
  // Contact quick-create modal
  const [showContactModal, setShowContactModal] = useState(false)

  // Error / submit
  const [error, setError] = useState<string | null>(null)

  // ── Atelier Workflow ──
  // If status FIS "Atelier" (id: 1), force production stage to WIP and contact to PEM.
  useEffect(() => {
    if (statusId === '1') {
      setStageProduction('wip')
      setContactId('13')
      setLocalisationId('') // Atelier
    }
  }, [statusId])

  // Rule: if contact is PEM, location is Atelier by default
  useEffect(() => {
    if (contactId === '13') {
      setLocalisationId('') // Atelier
    }
  }, [contactId])

  // Rule: If Sold (2) or Gift (4), automatically mark as Catalogued and Not Available
  useEffect(() => {
    if (statusId === '2' || statusId === '4') {
      setIsCatalogued(true)
      setDisponible(false)
    }
  }, [statusId])

  // Rule: If Reserved/Option (5), set Not Available
  useEffect(() => {
    if (statusId === '5') {
      setDisponible(false)
    }
  }, [statusId])

  // Rule: If Available and Catalogued, production stage is Finished (undefined)
  useEffect(() => {
    if (disponible && isCatalogued) {
      setStageProduction('')
    }
  }, [disponible, isCatalogued])

  // If stage was mounting and work is now catalogued (Done), mark as Mounted
  useEffect(() => {
    if (isCatalogued && stageProduction === 'mounting') {
      setMontee(true)
    }
  }, [isCatalogued, stageProduction])

  // If status is "Sold" or "Gift", it is no longer available
  useEffect(() => {
    const label = statuses.find((s) => String(s.id) === statusId)?.label
    if (label === 'Sold' || label === 'Gift') {
      setDisponible(false)
    }
  }, [statusId, statuses])

  // ── Handlers ────────────────────────────────────────────────────────

  function handleFormatChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.options[e.target.selectedIndex]?.text ?? ''
    const dims = FORMAT_DIMS[selected]
    if (dims) {
      setHauteur(dims.h)
      setLargeur(dims.w)
    }
  }

  function toggleTheme(id: number) {
    setSelThemes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddTheme = useCallback(async () => {
    const name = newThemeName.trim()
    if (!name) return
    setAddingTheme(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await (supabase.from('tblTheme') as any)
        .insert({ Nom: name })
        .select('ThemeID, Nom')
        .single()
      if (error || !data) throw new Error(error?.message ?? 'Erreur')
      setAllThemes((prev) => [...prev, data as any])
      setSelThemes((prev) => new Set([...prev, (data as any).ThemeID]))
      setNewThemeName('')
    } catch (e) {
      alert(String(e))
    } finally {
      setAddingTheme(false)
    }
  }, [newThemeName])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)

    // Inject computed prix final
    fd.set('prix_final', String(prixFinal ?? ''))

    // Inject status label + contact name (for history auto-append)
    const label = statuses.find((s) => String(s.id) === statusId)?.label ?? ''
    fd.set('status_label', label)
    const contact = localContacts.find((c) => String(c.ContactID) === contactId)
    const contactName = contact
      ? (contact.NomInstitution || `${contact.Prénom ?? ''} ${contact.Nom ?? ''}`.trim())
      : ''
    fd.set('contact_name', contactName)

    // Inject selected themes (checkboxes don't submit if unchecked)
    fd.delete('themes')
    selThemes.forEach((id) => fd.append('themes', String(id)))

    startTransition(async () => {
      try {
        const result = await action(fd)
        if ('error' in result) {
          setError(result.error)
        } else if ('newId' in result && result.newId) {
          // New work: go straight to edit so ImageManager FIS available immediately
          router.push(`/atelier/works/${result.newId}/edit`)
        } else {
          router.push('/atelier')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────

  const statusLabel = statuses.find((s) => String(s.id) === statusId)?.label ?? ''

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg0)', overflow: 'hidden',
    }}>

      {/* ── Contact quick-create modal ────────────────────────────── */}
      {showContactModal && (
        <ContactModal
          onClose={() => setShowContactModal(false)}
          onCreated={(c) => {
            setLocalContacts((p) => [...p, c])
            setContactId(String(c.ContactID))
            setShowContactModal(false)
          }}
        />
      )}

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, borderBottom: '1px solid var(--bd)',
        background: 'var(--bg1)', padding: '12px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="row gap-md">
          <button
            type="button"
            className="t-mono-sm"
            style={{ color: 'var(--tx3)' }}
            onClick={() => router.back()}
          >
            ← {t('back')}
          </button>
          <div className="vline" style={{ height: 16 }} />
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
            {isNew ? 'Nouvelle œuvre' : `Éditer #${oeuvre.OeuvreID}`}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 11, color: 'var(--rust)', maxWidth: 400 }}>{error}</div>
        )}

        <div className="row gap-sm">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => router.back()}
            disabled={isPending}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="work-form"
            className="btn sm primary"
            disabled={isPending}
          >
            {isPending ? '…' : isNew ? t('create') : t('save')}
          </button>
        </div>
      </div>

      {/* ── Form body ───────────────────────────────────────────── */}
      <form
        id="work-form"
        ref={formRef}
        onSubmit={handleSubmit}
        style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}
      >
        {/* Hidden fields */}
        {!isNew && (
          <input type="hidden" name="oeuvre_id" value={oeuvre.OeuvreID} />
        )}

        {/* ── Left rail: image progress manager + historique ── */}
        <div style={{
          width: 380, flexShrink: 0,
          borderRight: '1px solid var(--bd)',
          background: 'var(--bg1)',
          display: 'flex', flexDirection: 'column',
          padding: 24, gap: 16, overflow: 'auto',
        }}>
          {/* Image manager — only for existing works */}
          {!isNew && oeuvre && (
            <ImageManager oeuvreId={oeuvre.OeuvreID} initialImages={initialImages} coverLink={oeuvre.txtImageNameLink} />
          )}
          {isNew && (
            <div style={{
              background: 'var(--bg0)', border: '1px solid var(--bd)',
              padding: 24, textAlign: 'center',
            }}>
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.6 }}>
                Les images s'ajoutent après la création.<br />
                Vous serez redirigé ici automatiquement.
              </div>
            </div>
          )}

          {/* Historique (append-only) */}
          <div style={{ marginTop: 4 }}>
            <div className="t-label" style={{ marginBottom: 6 }}>{t('history')}</div>
            <textarea
              name="historique"
              defaultValue={oeuvre?.Historique ?? (isNew ? 'Atelier' : '')}
              rows={8}
              style={{
                width: '100%', padding: '8px',
                background: 'var(--bg0)', border: '1px solid var(--bd)',
                color: 'var(--tx2)', fontSize: 10, lineHeight: 1.6,
                resize: 'vertical', fontFamily: 'monospace',
              }}
              placeholder="Journal des évènements…"
            />
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
              Un bloc [JJ/MM/AAAA] sera ajouté automatiquement si le statut change.
            </div>
          </div>
        </div>

        {/* ── Right pane: fields ─────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          <div style={{ maxWidth: 760 }}>

            {/* ─ Work ID badge ─ */}
            {!isNew && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>
                <div className="t-label">ID</div>
                <div className="t-mono-sm" style={{ color: 'var(--ac)', fontWeight: 700, fontSize: 14 }}>#{oeuvre?.OeuvreID}</div>
              </div>
            )}

            {/* ─ Section: Identité ─ */}
            <SectionHead>{t('identity')}</SectionHead>

            <FieldRow>
              <Field label="Titre" span={2}>
                <input
                  name="titre"
                  defaultValue={oeuvre?.Titre ?? ''}
                  placeholder="Sans titre"
                  onBlur={(e) => e.target.value = cap(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Année">
                <input
                  name="annee"
                  defaultValue={oeuvre?.Année ? String(oeuvre.Année).slice(0, 4) : ''}
                  placeholder="AAAA"
                  style={inputStyle}
                />
              </Field>
              <Field label="Technique">
                <CreatableSelect
                  name="technique"
                  value={techniqueId}
                  onChange={setTechniqueId}
                  style={inputStyle}
                  options={[...localTechs].sort((a,b) => (a.Technique ?? '').localeCompare(b.Technique ?? '', 'fr')).map((t) => ({ id: String(t.TechniqueID), label: t.Technique ?? '—' }))}
                  onCreate={async (name) => {
                    const { createClient } = await import('@/lib/supabase/client')
                    const sb = createClient()
                    const { data: mx } = await (sb.from('Technique') as any).select('TechniqueID').order('TechniqueID', { ascending: false }).limit(1).single()
                    const nextTid = ((mx as any)?.TechniqueID ?? 0) + 1
                    const { data, error } = await (sb.from('Technique') as any).insert({ TechniqueID: nextTid, Technique: name }).select('TechniqueID, Technique').single()
                    if (error || !data) throw new Error(error?.message ?? 'Erreur')
                    setLocalTechs((p) => [...p, data as any])
                    return { id: String((data as any).TechniqueID), label: (data as any).Technique ?? name }
                  }}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Support">
                <CreatableSelect
                  name="support"
                  value={supportId}
                  onChange={setSupportId}
                  style={inputStyle}
                  options={[...localSupports].sort((a,b) => (a.Support ?? '').localeCompare(b.Support ?? '', 'fr')).map((s) => ({ id: String(s.SupportID), label: s.Support ?? '—' }))}
                  onCreate={async (name) => {
                    const { createClient } = await import('@/lib/supabase/client')
                    const sb = createClient()
                    const { data: mx } = await (sb.from('Support') as any).select('SupportID').order('SupportID', { ascending: false }).limit(1).single()
                    const nextSid = ((mx as any)?.SupportID ?? 0) + 1
                    const { data, error } = await (sb.from('Support') as any).insert({ SupportID: nextSid, Support: name }).select('SupportID, Support').single()
                    if (error || !data) throw new Error(error?.message ?? 'Erreur')
                    setLocalSupports((p) => [...p, data as any])
                    return { id: String((data as any).SupportID), label: (data as any).Support ?? name }
                  }}
                />
              </Field>
              <Field label="Format">
                <CreatableSelect
                  name="format"
                  value={formatId}
                  onChange={(v) => { setFormatId(v); const label = localFormats.find((f) => String(f.FormatID) === v)?.Format ?? ''; const dims = FORMAT_DIMS[label]; if (dims) { setHauteur(dims.h); setLargeur(dims.w); } }}
                  style={inputStyle}
                  options={[...localFormats].sort((a,b) => (a.Format ?? '').localeCompare(b.Format ?? '', 'fr')).map((f) => ({ id: String(f.FormatID), label: f.Format ?? '—' }))}
                  onCreate={async (name) => {
                    const { createClient } = await import('@/lib/supabase/client')
                    const sb = createClient()
                    const { data: mx } = await (sb.from('Format') as any).select('FormatID').order('FormatID', { ascending: false }).limit(1).single()
                    const nextFid = ((mx as any)?.FormatID ?? 0) + 1
                    const { data, error } = await (sb.from('Format') as any).insert({ FormatID: nextFid, Format: name }).select('FormatID, Format').single()
                    if (error || !data) throw new Error(error?.message ?? 'Erreur')
                    setLocalFormats((p) => [...p, data as any])
                    return { id: String((data as any).FormatID), label: (data as any).Format ?? name }
                  }}
                />
              </Field>
            </FieldRow>

            {/* ─ Section: Dimensions ─ */}
            <SectionHead>Dimensions ({techniqueId === '19' ? 'pixels' : 'cm'})</SectionHead>

            <FieldRow>
              <Field label="Hauteur">
                <input
                  name="hauteur"
                  value={hauteur}
                  onChange={(e) => setHauteur(e.target.value)}
                  placeholder={techniqueId === '19' ? '0' : '0.0'}
                  style={inputStyle}
                />
              </Field>
              <Field label="Largeur">
                <input
                  name="largeur"
                  value={largeur}
                  onChange={(e) => setLargeur(e.target.value)}
                  placeholder={techniqueId === '19' ? '0' : '0.0'}
                  style={inputStyle}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label={t('depth')}>
                <input
                  name="profondeur"
                  value={profondeur}
                  onChange={(e) => setProfondeur(e.target.value)}
                  placeholder="0.0 (optionnel)"
                  style={inputStyle}
                />
              </Field>
            </FieldRow>

            {/* ─ Section: État & Visibilité ─ */}
            <SectionHead>{t('visibility')}</SectionHead>

            <FieldRow>
              <Field label="Statut">
                <select
                  name="status_id"
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Stade de production">
                {(() => {
                  const statusLabel = statuses.find((s) => String(s.id) === statusId)?.label || ''
                  const sLabel = statusLabel.toLowerCase()
                  const isAvailableStatus = sLabel.includes('avail') || sLabel.includes('atel')
                  const stageGone = (disponible && isCatalogued) || isAvailableStatus || sLabel.includes('sold') || sLabel.includes('gift')
                  return (
                    <select
                      name="stage_production"
                      value={stageProduction}
                      onChange={(e) => setStageProduction(e.target.value)}
                      disabled={stageGone}
                      style={{
                        ...inputStyle,
                        opacity: stageGone ? 0.4 : 1,
                        cursor: stageGone ? 'not-allowed' : undefined,
                      }}
                    >
                      <option value="">— Non défini</option>
                      <option value="wip">🖌 En cours</option>
                      <option value="drying">⏳ Séchage</option>
                      <option value="mounting">🔧 À monter</option>
                      <option value="framing">🪟 À encadrer</option>
                      <option value="catalogued">✅ À cataloguer (fini)</option>
                    </select>
                  )
                })()}
              </Field>
              <Field label="Contact">
                <div style={{ display: 'flex', gap: 4 }}>
                  <select
                    name="contact_id"
                    value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="">—</option>
                    {[...localContacts].sort((a,b) => (a.NomInstitution || a.Nom || '').localeCompare(b.NomInstitution || b.Nom || '', 'fr')).map((c) => {
                      const label = c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)
                      return <option key={c.ContactID} value={c.ContactID}>{label}</option>
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    style={{ padding: '0 10px', background: 'var(--bg1)', border: '1px solid var(--bd)', color: 'var(--ac)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
                    title="Nouveau contact"
                  >+</button>
                </div>
              </Field>
            </FieldRow>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 28px', marginBottom: 24 }}>
              {[
                { name: 'exposable',  label: t('exhibitable'),  val: (oeuvre?.Exposable ?? false) },
                { name: 'montee',     label: 'Montée',     val: montee,     onChange: setMontee },
                { name: 'encadree',   label: 'Encadrée',   val: (oeuvre?.Encadree ?? false) },
                { name: 'needs_photograph', label: 'Besoin d\'une photo', val: needsPhotograph, onChange: setNeedsPhotograph },
                { name: 'catalogued', label: 'Cataloguée', val: isCatalogued, onChange: setIsCatalogued },
                { name: 'is_public',  label: 'Public',     val: isPublic,     onChange: setIsPublic },
                { name: 'disponible', label: 'Disponible', val: disponible,   onChange: setDisponible },
              ].map(({ name, label, val, onChange: onChg }: { name: string; label: string; val: boolean; onChange?: (v: boolean) => void }) => {
                const isSold = statusId === '2'
                const isGift = statusId === '4'
                const isReserved = statusId === '5'
                const isUnavailable = isSold || isGift || isReserved
                const isFinalized = isSold || isGift

                const isPrivate = statusId === '3'
                const isAtelier = statusId === '1'
                
                // Force off rules
                let forcedOff = false
                if (name === 'exposable' && (isAtelier || isPrivate)) forcedOff = true
                // Special: 'is_public' checkbox is now deprecated by anonymity_level, but we keep it for now if needed.
                // However, the user wants 3 levels, so we'll render the levels separately.
                if (name === 'is_public' && (isPrivate || anonymityLevel === 2)) forcedOff = true
                if (name === 'disponible' && (isPrivate || isUnavailable)) forcedOff = true
                
                // Force on rules
                let forcedOn = false
                if (name === 'catalogued' && isFinalized) forcedOn = true
                if (name === 'is_public' && anonymityLevel < 2) forcedOn = true

                const shouldDisable = forcedOff || forcedOn
                
                // Skip rendering 'Public' as a simple checkbox, we'll render it as levels below
                if (name === 'is_public') return null

                return (
                  <CheckFlag
                    key={name} name={name} label={label} 
                    defaultChecked={forcedOn ? true : forcedOff ? false : val}
                    onChange={onChg}
                    disabled={shouldDisable}
                    forceOff={forcedOff}
                  />
                )
              })}
              <CheckFlag
                name="is_commission" label="Commission"
                defaultChecked={oeuvre?.IsCommission ?? false}
                onChange={setIsCommission}
              />
            </div>

            {/* ── Section: Visibilité (Anonymat) ── */}
            <div style={{ marginBottom: 28 }}>
              <div className="t-label" style={{ marginBottom: 12 }}>Visibilité & Anonymat</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { v: 0, l: 'Public',     desc: 'Œuvre et contact visibles' },
                  { v: 1, l: 'Anonyme',    desc: 'Œuvre visible, contact masqué' },
                  { v: 2, l: 'Privé',      desc: 'Œuvre et contact masqués' },
                ].map((tier) => (
                  <button
                    key={tier.v}
                    type="button"
                    onClick={() => setAnonymityLevel(tier.v)}
                    style={{
                      flex: 1, padding: '10px 12px', textAlign: 'left',
                      background: anonymityLevel === tier.v ? 'var(--bg2)' : 'var(--bg0)',
                      border: `1px solid ${anonymityLevel === tier.v ? 'var(--ac)' : 'var(--bd)'}`,
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: anonymityLevel === tier.v ? 'var(--tx)' : 'var(--tx3)', marginBottom: 4 }}>
                      {tier.l.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--tx3)', lineHeight: 1.3 }}>
                      {tier.desc}
                    </div>
                    <input type="radio" name="anonymity_level" value={tier.v} checked={anonymityLevel === tier.v} readOnly style={{ display: 'none' }} />
                  </button>
                ))}
              </div>
              {/* Sync is_public hidden field for existing logic/filters */}
              <input type="hidden" name="is_public" value={anonymityLevel < 2 ? '1' : '0'} />
            </div>

            {/* Commission deadline — shown when commission FIS ticked */}
            {isCommission && (
              <div style={{
                marginBottom: 24, padding: '12px 16px',
                border: '1px solid var(--ac)', background: 'var(--bg1)',
              }}>
                <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ac)', marginBottom: 10 }}>
                  Commission — Deadline
                </div>
                <FieldRow>
                  <Field label="Deadline (date de livraison)">
                    <input
                      name="date_livraison"
                      type="date"
                      defaultValue={oeuvre?.DateLivraison ? String(oeuvre.DateLivraison).slice(0, 10) : ''}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label=" ">
                    {!oeuvre?.DateLivraison && !isNew && (
                      <div style={{ fontSize: 10, color: 'var(--rust)', paddingTop: 8 }}>
                        ⚠ Commission sans deadline — à renseigner
                      </div>
                    )}
                  </Field>
                </FieldRow>
              </div>
            )}

            {/* ─ Section: Localisation ─ */}
            <SectionHead>{t('location')}</SectionHead>

            <FieldRow>
              <Field label="Chez">
                <select
                  name="localisation_id"
                  value={localisationId}
                  onChange={(e) => setLocalisationId(e.target.value)}
                  style={inputStyle}
                >
                  {(() => {
                    const finalOptions: { id: string; label: string }[] = []
                    
                    // 1. Add "Pem - Atelier" as the absolute default (value "")
                    const pemContact = contacts.find(c => (c.NomInstitution || '').toLowerCase().includes('pem'))
                    const pemLabel = pemContact ? (pemContact.NomInstitution || `${pemContact.Prénom ?? ''} ${pemContact.Nom ?? ''}`.trim()) : 'Pem'
                    finalOptions.push({ id: '', label: `${pemLabel} - Atelier` })

                    // 2. Build sorted list of contacts
                    const sortedContacts = [...contacts]
                      .sort((a, b) => {
                        const la = a.NomInstitution || `${a.Prénom ?? ''} ${a.Nom ?? ''}`.trim()
                        const lb = b.NomInstitution || `${b.Prénom ?? ''} ${b.Nom ?? ''}`.trim()
                        return la.localeCompare(lb, 'fr')
                      })

                    // 3. For each contact, add it + its specific addresses
                    sortedContacts.forEach(c => {
                      const cName = c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)
                      finalOptions.push({ id: String(c.ContactID), label: cName })

                      // Add sub-addresses if any
                      const cAddrs = addresses.filter(a => a.contact_id === c.ContactID)
                      cAddrs.forEach(addr => {
                        const subLabel = `${cName} - ${addr.label}`
                        // Skip if generic or if it's the exact "Pem - Atelier" we already put at the top
                        if (!addr.label || addr.label.toLowerCase() === 'principal') return
                        if (subLabel === `${pemLabel} - Atelier`) return 
                        
                        finalOptions.push({ id: String(c.ContactID), label: subLabel })
                      })
                    })

                    return finalOptions.map((opt, i) => (
                      <option key={`${opt.id}-${opt.label}-${i}`} value={opt.id}>{opt.label}</option>
                    ))
                  })()}
                </select>
              </Field>
              <Field label="Ville, pays">
                {/* Derived from contact — not editable */}
                <div style={{ ...inputStyle, color: locDetail ? 'var(--tx2)' : 'var(--tx3)', display: 'flex', alignItems: 'center', cursor: 'default' }}>
                  {locDetail || '—'}
                </div>
                <input type="hidden" name="localisation_detail" value={locDetail} />
              </Field>
            </FieldRow>

            {/* ─ Section: Prix ─ */}
            <SectionHead>Prix</SectionHead>

            {statusLabel === 'Gift' ? (
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 24 }}>
                — Aucun prix (don)
              </div>
            ) : (
              <>
                <FieldRow>
                  <Field label="Prix (€)">
                    <input
                      name="prix"
                      type="number"
                      value={prix}
                      onChange={(e) => setPrix(e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Remise (€)">
                    <input
                      name="discount"
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </Field>
                </FieldRow>

                <FieldRow>
                  <Field label="Prix final (€)">
                    <div style={{ ...inputStyle, color: 'var(--tx2)', display: 'flex', alignItems: 'center' }}>
                      {prixFinal !== null
                        ? prixFinal.toLocaleString('fr-FR')
                        : <span style={{ color: 'var(--tx3)' }}>—</span>}
                    </div>
                  </Field>
                </FieldRow>
              </>
            )}

            {/* ─ Section: Notes ─ */}
            <SectionHead>Notes</SectionHead>

            <div style={{ marginBottom: 24 }}>
              <div className="t-label" style={{ marginBottom: 6 }}>Commentaires</div>
              <textarea
                name="commentaires"
                defaultValue={oeuvre?.Commentaires ?? ''}
                rows={4}
                onBlur={(e) => e.target.value = cap(e.target.value)}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                placeholder="Notes libres…"
              />
            </div>

            {/* ─ Section: Thèmes ─ */}
            <SectionHead>{t('themes')}</SectionHead>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginBottom: 12 }}>
              {[...allThemes].sort((a,b) => a.Nom.localeCompare(b.Nom, 'fr')).map((th) => (
                <label
                  key={th.ThemeID}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer', fontSize: 11, color: 'var(--tx)',
                    padding: '4px 10px',
                    border: `1px solid ${selThemes.has(th.ThemeID) ? 'var(--ac)' : 'var(--bd)'}`,
                    background: selThemes.has(th.ThemeID) ? 'color-mix(in srgb, var(--ac) 12%, transparent)' : 'transparent',
                    transition: 'all 0.1s',
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ display: 'none' }}
                    checked={selThemes.has(th.ThemeID)}
                    onChange={() => toggleTheme(th.ThemeID)}
                    readOnly
                  />
                  {th.Nom}
                </label>
              ))}
            </div>

            {/* Inline new theme */}
            <div className="row gap-sm" style={{ marginBottom: 32 }}>
              <input
                type="text"
                value={newThemeName}
                onChange={(e) => setNewThemeName(e.target.value)}
                onBlur={(e) => setNewThemeName(cap(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTheme())}
                placeholder="Nouveau thème…"
                style={{ ...inputStyle, width: 180 }}
              />
              <button
                type="button"
                className="btn ghost sm"
                onClick={handleAddTheme}
                disabled={addingTheme || !newThemeName.trim()}
              >
                {addingTheme ? '…' : '+ Créer'}
              </button>
            </div>

            {/* Bottom save bar (secondary) */}
            <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 20, marginBottom: 40 }}>
              {error && (
                <div style={{ fontSize: 11, color: 'var(--rust)', marginBottom: 12 }}>{error}</div>
              )}
              <div className="row gap-sm">
                <button
                  type="submit"
                  className="btn primary"
                  disabled={isPending}
                >
                  {isPending ? '…' : isNew ? t('create') : t('save')}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => router.back()}
                  disabled={isPending}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--tx3)', marginBottom: 12, marginTop: 8,
      paddingBottom: 6, borderBottom: '1px solid var(--bd)',
    }}>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '8px 20px',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function Field({
  label, span = 1, children,
}: {
  label: string
  span?: 1 | 2
  children: React.ReactNode
}) {
  return (
    <div style={{ gridColumn: span === 2 ? '1 / -1' : undefined }}>
      <div className="t-label" style={{ marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function CheckFlag({
  name, label, defaultChecked, disabled = false, forceOff = false, onChange,
}: {
  name: string
  label: string
  defaultChecked: boolean
  disabled?: boolean
  forceOff?: boolean
  onChange?: (checked: boolean) => void
}) {
  const [checked, setChecked] = useState(defaultChecked)
  useEffect(() => {
    setChecked(defaultChecked)
  }, [defaultChecked])
  // When forceOff activates (e.g. WIP status), treat as unchecked
  const effectiveChecked = forceOff ? false : checked
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 11, color: disabled ? 'var(--tx3)' : 'var(--tx)',
      opacity: disabled ? 0.45 : 1,
    }}>
      <input
        type="hidden"
        name={name}
        value={effectiveChecked ? '1' : '0'}
      />
      <div
        onClick={() => {
          if (!disabled) {
            const next = !checked
            setChecked(next)
            onChange?.(next)
          }
        }}
        title={disabled ? 'Non disponible pour les œuvres en cours' : undefined}
        style={{
          width: 14, height: 14,
          border: `1px solid ${effectiveChecked ? 'var(--ac)' : 'var(--bd)'}`,
          background: effectiveChecked ? 'var(--ac)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: 'var(--bg0)',
          cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0,
        }}
      >
        {effectiveChecked ? '✓' : ''}
      </div>
      {label}
    </label>
  )
}

// ── ImageManager ─────────────────────────────────────────────────────────────
// Multi-image progress log for a work. Immediate DB operations (no form submit).
// Images sorted by SeqNo ascending — last = most recent = cover.

function ImageManager({
  oeuvreId,
  initialImages,
  coverLink,
}: {
  oeuvreId:      number
  initialImages: WorkImage[]
  coverLink?:    string | null
}) {
  const { t } = useI18n()
  const [images,  setImages]  = useState<WorkImage[]>(initialImages)
  const [busy,    setBusy]    = useState<number | 'add' | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const coverIdx = images.length - 1  // last = cover

  async function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setBusy('add')
    setImgError(null)
    try {
      const fd = new FormData()
      fd.append('oeuvre_id', String(oeuvreId))
      fd.append('image', file)
      const result = await addWorkImage(fd)
      if ('error' in result) { setImgError(result.error); return }
      setImages((prev) => [...prev, result.image])
    } catch (err) {
      setImgError(String(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(img: WorkImage) {
    if (!img.ImageID) return
    setBusy(img.ImageID)
    setImgError(null)
    try {
      const result = await deleteWorkImage(img.ImageID, oeuvreId)
      if ('error' in result) { setImgError(result.error); return }
      setImages((prev) => prev.filter((i) => i.ImageID !== img.ImageID))
    } catch (err) {
      setImgError(String(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleMove(idx: number, dir: -1 | 1) {
    const newImages = [...images]
    const swap = idx + dir
    if (swap < 0 || swap >= newImages.length) return
    ;[newImages[idx], newImages[swap]] = [newImages[swap], newImages[idx]]
    setImages(newImages)
    setBusy('add')  // generic busy
    try {
      await reorderWorkImages(oeuvreId, newImages.map((i) => i.ImageID!))
    } catch (err) {
      setImgError(String(err))
      setImages(images) // revert on error
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="t-label">
          Images ({images.length})
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', marginLeft: 8, fontWeight: 400 }}>
            — dernière = couverture
          </span>
        </div>
        <label style={{ cursor: 'pointer' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAdd}
            disabled={busy !== null}
          />
          <span className={`btn ghost sm${busy === 'add' ? ' disabled' : ''}`}>
            {busy === 'add' ? '…' : '+ Ajouter'}
          </span>
        </label>
      </div>

      {imgError && (
        <div className="t-mono-sm" style={{ color: '#c0392b', marginBottom: 8 }}>{imgError}</div>
      )}

      {images.length === 0 && (
        coverLink ? (
          <div style={{ background: 'var(--bg0)', border: '1px solid var(--ac)', marginBottom: 8 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 4, left: 4, zIndex: 2,
                background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9,
                padding: '1px 5px', fontFamily: 'monospace',
              }}>couverture ★</div>
              <img
                src={thumbUrl(coverLink, 384) ?? ''}
                alt=""
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div className="t-mono-sm" style={{ padding: '4px 6px', color: 'var(--tx3)', fontSize: 9, wordBreak: 'break-all' }}>
              {coverLink}
            </div>
            <div className="t-mono-sm" style={{ padding: '2px 6px 6px', color: 'var(--tx3)', fontSize: 9 }}>
              Image hors tblImage — ajoutez via + Ajouter pour indexer
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg0)', border: '1px dashed var(--bd)',
            padding: '20px 0', textAlign: 'center',
          }}>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Aucune image</div>
          </div>
        )
      )}

      {/* 2-column numbered grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {images.map((img, idx) => {
          const isCover = idx === coverIdx
          const src     = img.txtImageNameLink ? thumbUrl(img.txtImageNameLink, 384) ?? '' : ''
          const isBusy  = busy === img.ImageID
          return (
            <div
              key={img.ImageID ?? idx}
              style={{
                border: `1px solid ${isCover ? 'var(--ac)' : 'var(--bd)'}`,
                background: 'var(--bg0)',
                position: 'relative',
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              {/* Sequence badge */}
              <div style={{
                position: 'absolute', top: 4, left: 4, zIndex: 2,
                background: 'rgba(0,0,0,0.55)',
                color: '#fff', fontSize: 9, padding: '1px 5px',
                fontFamily: 'monospace',
              }}>
                #{idx + 1}{isCover ? ' ★' : ''}
              </div>

              {/* Thumbnail */}
              {src
                ? <img src={src} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>—</span>
                  </div>
              }

              {/* Controls row */}
              <div className="row" style={{ gap: 2, padding: 4, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ fontSize: 10, padding: '1px 5px' }}
                  disabled={idx === 0 || busy !== null}
                  onClick={() => handleMove(idx, -1)}
                  title="Reculer"
                >↑</button>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ fontSize: 10, padding: '1px 5px' }}
                  disabled={idx === images.length - 1 || busy !== null}
                  onClick={() => handleMove(idx, 1)}
                  title="Avancer"
                >↓</button>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ fontSize: 10, padding: '1px 5px', color: 'var(--tx3)', marginLeft: 4 }}
                  disabled={busy !== null}
                  onClick={() => handleDelete(img)}
                  title="Supprimer"
                >×</button>
              </div>

              {/* Filename */}
              {img.txtImageNameLink && (
                <div className="t-mono-sm" style={{ padding: '2px 6px 0', color: 'var(--tx3)', fontSize: 8, wordBreak: 'break-all' }}>
                  {img.txtImageNameLink.split('/').pop() ?? img.txtImageNameLink}
                </div>
              )}
              {img.ImageNote && (
                <div className="t-mono-sm" style={{ padding: '2px 6px 4px', color: 'var(--tx3)', fontSize: 9 }}>
                  {img.ImageNote}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg1)',
  border: '1px solid var(--bd)',
  color: 'var(--tx)',
  fontSize: 11,
  outline: 'none',
}

function computePrixFinal(prix: string, discount: string): number | null {
  const p = parseFloat(prix)
  const d = parseFloat(discount)
  if (!Number.isFinite(p)) return null
  return p - (Number.isFinite(d) ? d : 0)
}

// ── CreatableSelect ─────────────────────────────────────────────────────────
// A <select> that appends a "+ Nouveau..." sentinel option.
// When chosen, it replaces itself with an inline text input + confirm/cancel.

function CreatableSelect({
  name, value, onChange, options, onCreate, style,
}: {
  name:     string
  value:    string
  onChange: (v: string) => void
  options:  { id: string; label: string }[]
  onCreate: (name: string) => Promise<{ id: string; label: string }>
  style?:   React.CSSProperties
}) {
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState("")
  const [busy,     setBusy]     = useState(false)
  const NEW = "__new__"

  async function confirm() {
    const n = newName.trim()
    if (!n) return
    setBusy(true)
    try {
      const item = await onCreate(n)
      onChange(item.id)
      setCreating(false)
      setNewName("")
    } catch (e) {
      alert(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (creating) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        <input type="hidden" name={name} value={value} />
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { e.preventDefault(); void confirm() }
            if (e.key === "Escape") { setCreating(false); setNewName("") }
          }}
          placeholder="Nouveau..."
          style={{ ...style, flex: 1 }}
          disabled={busy}
        />
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => void confirm()}
          disabled={busy || !newName.trim()}
          style={{ padding: "0 10px", flexShrink: 0 }}
        >
          {busy ? "..." : "✓"}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => { setCreating(false); setNewName("") }}
          disabled={busy}
          style={{ padding: "0 10px", flexShrink: 0 }}
        >✕</button>
      </div>
    )
  }

  return (
    <select
      name={name}
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW) { setCreating(true) }
        else { onChange(e.target.value) }
      }}
      style={style}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
      <option value={NEW}>+ Nouveau...</option>
    </select>
  )
}

// ── ContactModal ─────────────────────────────────────────────
// Full contact creation modal — matches the Contacts tab form.

type CMFormState = {
  NomInstitution: string; Nom: string; Prénom: string; Genre: string; Role: string
  Email: string; IndicatifPays1: string; Téléphone1: string; IndicatifPays2: string; Téléphone2: string
  Website: string
  Instagram: string; LinkedIn: string; Facebook: string; Twitter: string
  PersonneResponsable: string; RoleResponsable: string; Notes: string; Actif: boolean
}

type CMAddr = { label: string; adresse: string; code_postal: string; ville: string; pays: string }
function emptyCMAddr(): CMAddr { return { label: "", adresse: "", code_postal: "", ville: "", pays: "" } }

function CMSection({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "var(--tx3)", borderBottom: "1px solid var(--bd)",
      paddingBottom: 4, marginTop: 20, marginBottom: 10,
    }}>{title}</div>
  )
}

function ContactModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (c: { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }) => void
}) {
  const [form, setForm] = useState<CMFormState>({
    NomInstitution: "", Nom: "", Prénom: "", Genre: "", Role: "",
    Email: "", IndicatifPays1: "", Téléphone1: "", IndicatifPays2: "", Téléphone2: "",
    Website: "",
    Instagram: "", LinkedIn: "", Facebook: "", Twitter: "",
    PersonneResponsable: "", RoleResponsable: "", Notes: "", Actif: true,
  })
  const [addrList, setAddrList] = useState<CMAddr[]>([emptyCMAddr()])
  const [roleOptions, setRoleOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)

  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      ;(createClient().from("tblRole") as any)
        .select("Nom").order("Nom")
        .then(({ data }: { data: { Nom: string }[] | null }) => {
          if (data) setRoleOptions(data.map((r) => r.Nom))
        })
    })
  }, [])

  function f(k: keyof Omit<CMFormState, "Actif">) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }))
  }

  function updateAddr(i: number, k: keyof CMAddr, v: string) {
    setAddrList((prev) => prev.map((a, j) => j === i ? { ...a, [k]: v } : a))
  }

  async function handleSave() {
    setBusy(true)
    setErr(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const sb = createClient()
      const validAddrs = addrList.filter((a) => a.adresse || a.ville || a.pays || a.code_postal)
      const primaryVille = validAddrs[0]?.ville || null
      const primaryPays  = validAddrs[0]?.pays  || null

      const { data: maxRow } = await (sb.from("Contact") as any)
        .select("ContactID")
        .order("ContactID", { ascending: false })
        .limit(1)
        .single()
      const nextId = ((maxRow as any)?.ContactID ?? 0) + 1

      const payload = {
        ContactID:           nextId,
        NomInstitution:      form.NomInstitution      || null,
        Nom:                 form.Nom                 || null,
        Prénom:              form.Prénom              || null,
        Genre:               form.Genre               || null,
        Role:                form.Role                || null,
        Email:               form.Email               || null,
        IndicatifPays1:      form.IndicatifPays1      || null,
        Téléphone1:          form.Téléphone1          || null,
        IndicatifPays2:      form.IndicatifPays2      || null,
        Téléphone2:          form.Téléphone2          || null,
        Website:             form.Website             || null,
        Adresse:             validAddrs[0]?.adresse   || null,
        CodePostal:          validAddrs[0]?.code_postal || null,
        Ville:               primaryVille,
        Pays:                primaryPays,
        Instagram:           form.Instagram           || null,
        LinkedIn:            form.LinkedIn            || null,
        Facebook:            form.Facebook            || null,
        Twitter:             form.Twitter             || null,
        PersonneResponsable: form.PersonneResponsable || null,
        RoleResponsable:     form.RoleResponsable     || null,
        Notes:               form.Notes               || null,
        Actif:               form.Actif,
      }

      const { error } = await (sb.from("Contact") as any).insert(payload)
      if (error) throw new Error((error as any).message)

      // Save additional addresses
      if (validAddrs.length > 0) {
        const insertRows = validAddrs.map((a, i) => ({
          contact_id:  nextId,
          label:       a.label || (validAddrs.length === 1 ? "Principal" : `Adresse ${i + 1}`),
          adresse:     a.adresse     || null,
          code_postal: a.code_postal || null,
          ville:       a.ville       || null,
          pays:        a.pays        || null,
          position:    i,
        }))
        await (sb.from("contact_addresses") as any).insert(insertRows)
      }

      onCreated({
        ContactID:      nextId,
        NomInstitution: payload.NomInstitution,
        Nom:            payload.Nom,
        Prénom:         payload.Prénom,
        Role:           payload.Role,
        Ville:          payload.Ville,
        Pays:           payload.Pays,
      })
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }


  const G2: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px",
  }

  function FR({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <div className="t-label" style={{ marginBottom: 3 }}>{label}</div>
        {children}
      </div>
    )
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "var(--bg1)", border: "1px solid var(--bd)",
        width: "100%", maxWidth: 600,
        maxHeight: "90vh", overflowY: "auto",
        padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tx3)" }}>
            Nouveau contact
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose} disabled={busy}>✕</button>
        </div>

        {/* Identité */}
        <CMSection title="Identité" />
        <div style={G2}>
          <FR label="Institution"><input value={form.NomInstitution} onChange={f("NomInstitution")} style={FIS} /></FR>
          <FR label="Rôle">
            <select value={form.Role} onChange={f("Role")} style={FIS}>
              <option value="">— Choisir</option>
              {form.Role && !roleOptions.includes(form.Role) && (
                <option value={form.Role}>{form.Role}</option>
              )}
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FR>
          <FR label="Prénom"><input value={form.Prénom} onChange={f("Prénom")} style={FIS} /></FR>
          <FR label="Nom"><input value={form.Nom} onChange={f("Nom")} style={FIS} /></FR>
          <FR label="Genre">
            <select value={form.Genre} onChange={f("Genre")} style={FIS}>
              <option value="">—</option>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
              <option value="Mx">Mx</option>
            </select>
          </FR>
          <FR label="Actif">
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 11, cursor: "pointer" }}>
              <input type="checkbox" checked={form.Actif} onChange={(e) => setForm((p) => ({ ...p, Actif: e.target.checked }))} />
              Actif
            </label>
          </FR>
        </div>
        <div style={{ ...G2, marginTop: 8 }}>
          <FR label="Personne responsable"><input value={form.PersonneResponsable} onChange={f("PersonneResponsable")} style={FIS} /></FR>
          <FR label="Rôle responsable"><input value={form.RoleResponsable} onChange={f("RoleResponsable")} style={FIS} /></FR>
        </div>

        {/* Contact */}
        <CMSection title="Contact" />
        <div style={G2}>
          <FR label="Email"><input type="email" value={form.Email} onChange={f("Email")} style={FIS} /></FR>
          <FR label="Website"><input value={form.Website} onChange={f("Website")} placeholder="https://…" style={FIS} /></FR>
          <FR label="Indicatif + Tél. 1">
            <div style={{ display: "flex", gap: 4 }}>
              <input value={form.IndicatifPays1} onChange={f("IndicatifPays1")} placeholder="+" style={{ ...FIS, width: 56, flexShrink: 0 }} />
              <input value={form.Téléphone1} onChange={f("Téléphone1")} placeholder="Numéro" style={{ ...FIS, flex: 1 }} />
            </div>
          </FR>
          <FR label="Indicatif + Tél. 2">
            <div style={{ display: "flex", gap: 4 }}>
              <input value={form.IndicatifPays2} onChange={f("IndicatifPays2")} placeholder="+" style={{ ...FIS, width: 56, flexShrink: 0 }} />
              <input value={form.Téléphone2} onChange={f("Téléphone2")} placeholder="Numéro" style={{ ...FIS, flex: 1 }} />
            </div>
          </FR>
        </div>

        {/* Adresse */}
        <CMSection title="Adresse" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {addrList.map((addr, i) => (
            <div key={i} style={{
              border: "1px solid var(--bd)", padding: "10px 12px",
              background: "var(--bg0)", position: "relative",
            }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                <input
                  value={addr.label}
                  onChange={(e) => updateAddr(i, "label", e.target.value)}
                  placeholder={i === 0 ? "Principal" : `Adresse ${i + 1}`}
                  style={{ ...FIS, flex: 1, fontSize: 10 }}
                />
                {addrList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAddrList((p) => p.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "1px solid var(--bd)", color: "var(--tx3)", padding: "4px 8px", cursor: "pointer", fontSize: 10 }}
                  >✕</button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input value={addr.adresse} onChange={(e) => updateAddr(i, "adresse", e.target.value)} placeholder="Rue / adresse" style={FIS} />
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 6 }}>
                  <input value={addr.code_postal} onChange={(e) => updateAddr(i, "code_postal", e.target.value)} placeholder="Code postal" style={FIS} />
                  <input value={addr.ville} onChange={(e) => updateAddr(i, "ville", e.target.value)} placeholder="Ville" style={FIS} />
                </div>
                <input value={addr.pays} onChange={(e) => updateAddr(i, "pays", e.target.value)} placeholder="Pays" style={FIS} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAddrList((p) => [...p, emptyCMAddr()])}
            style={{
              background: "none", border: "1px dashed var(--bd)",
              color: "var(--tx3)", padding: 8,
              cursor: "pointer", fontSize: 10, letterSpacing: 0.5, textAlign: "center",
            }}
          >+ Ajouter une adresse</button>
        </div>

        {/* Réseaux sociaux */}
        <CMSection title="Réseaux sociaux" />
        <div style={G2}>
          <FR label="Instagram"><input value={form.Instagram} onChange={f("Instagram")} placeholder="@handle ou URL" style={FIS} /></FR>
          <FR label="LinkedIn"><input value={form.LinkedIn} onChange={f("LinkedIn")} placeholder="handle ou URL" style={FIS} /></FR>
          <FR label="Facebook"><input value={form.Facebook} onChange={f("Facebook")} placeholder="handle ou URL" style={FIS} /></FR>
          <FR label="Twitter / X"><input value={form.Twitter} onChange={f("Twitter")} placeholder="@handle ou URL" style={FIS} /></FR>
        </div>

        {/* Notes */}
        <CMSection title="Notes" />
        <textarea
          value={form.Notes}
          onChange={f("Notes")}
          rows={3}
          style={{ ...FIS, resize: "vertical", lineHeight: 1.6 }}
          placeholder="Notes libres..."
        />

        {err && <div style={{ fontSize: 11, color: "var(--rust)", marginTop: 10 }}>{err}</div>}

        <div className="row gap-sm" style={{ marginTop: 20, justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn primary sm" onClick={() => void handleSave()} disabled={busy}>
            {busy ? "..." : "Créer"}
          </button>
        </div>
      </div>
    </div>
  )
}
