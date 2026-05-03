'use client'

/**
 * WorkForm — Piped Workflow Architecture.
 * Redesigned to eliminate redundancies and implement "Pipeline" type solutions
 * as requested in Improvements general.txt.
 * 
 * 4 Main Pipelines:
 * 1. Identity & Physicality (The foundation)
 * 2. Production & Condition (The state of the object)
 * 3. Ownership & Logistics (The legal/spatial state)
 * 4. Financials & Diffusion (The value and visibility)
 */

import { useState, useEffect, useTransition, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre, WorkImage } from '@/lib/types/database'
import type { SaveResult } from '@/app/atelier/works/actions'
import { addWorkImage, deleteWorkImage } from '@/app/atelier/works/actions'
import { createClient } from '@/lib/supabase/client'

// ── Types & Config ────────────────────────────────────────────────────────

const PIPELINE_COLORS = {
  production: '#80a060',
  ownership:  '#6090c0',
  condition:  '#c06060',
  visibility: '#a060c0',
}

const PRODUCTION_STAGES = [
  { id: 'atelier',    label: 'Atelier',    pct: 90,  desc: 'Production ongoing' },
  { id: 'catalogued', label: 'Catalogué',  pct: 100, desc: 'Media ready / Finished' },
  { id: 'available',  label: 'Available',  pct: 100, desc: 'Ready for deployment' },
  { id: 'archive',    label: 'Archive',    pct: 100, desc: 'Historical archive' },
]

const OWNERSHIP_STAGES = [
  { id: 'artist',      label: 'Artist',       desc: 'Full ownership' },
  { id: 'possession',  label: 'Consignment',  desc: 'Loan / Galerie (No transfer)' },
  { id: 'transfer',    label: 'Sold / Gift',  desc: 'Property transfer' },
]

const CONDITION_STAGES = [
  { id: 'good',      label: 'Good',      color: '#60a060' },
  { id: 'damaged',   label: 'Damaged',   color: '#c0a030' },
  { id: 'destroyed', label: 'Destroyed', color: '#c06060' },
  { id: 'lost',      label: 'Lost',      color: '#888' },
]

// ── Utils ─────────────────────────────────────────────────────────────────

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  oeuvre:          Oeuvre | null
  currentThemeIds: number[]
  techniques:      { TechniqueID: number; Technique: string | null }[]
  supports:        { SupportID:   number; Support:   string | null }[]
  formats:         { FormatID:    number; Format:    string | null }[]
  themes:          { ThemeID:     number; Nom:       string        }[]
  contacts:        any[]
  initialImages?:  WorkImage[]
  addresses?:      any[]
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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // ── 1. Pipeline States ──────────────────────────────────────────

  // Identity
  const [titre,       setTitre]       = useState(oeuvre?.Titre ?? '')
  const [annee,       setAnnee]       = useState(oeuvre?.Année ?? '')
  const [techniqueId, setTechniqueId] = useState(String(oeuvre?.Technique ?? ''))
  const [supportId,   setSupportId]   = useState(String(oeuvre?.Support ?? ''))
  const [formatId,    setFormatId]    = useState(String(oeuvre?.Format ?? ''))
  const [hauteur,     setHauteur]     = useState(String(oeuvre?.Hauteur ?? ''))
  const [largeur,     setLargeur]     = useState(String(oeuvre?.Largeur ?? ''))
  const [profondeur,  setProfondeur]  = useState(String(oeuvre?.Profondeur ?? ''))

  // 2. Production & State
  const initialProd = (oeuvre?.statusId === 5) ? 'archive' : 
                      (oeuvre?.statusId === 2) ? 'available' :
                      (oeuvre?.Catalogué) ? 'catalogued' : 'atelier'
  const [prodStage, setProdStage] = useState(initialProd)
  const [exposable, setExposable] = useState((oeuvre as any)?.Exposable ?? false)
  const [needsPhoto, setNeedsPhoto] = useState(!!((oeuvre as any)?.NeedsPhotograph ?? false))

  // 3. Ownership & Logistics
  const initialOwn = (oeuvre?.statusId === 6 || oeuvre?.statusId === 11) ? 'transfer' : 
                     (oeuvre?.statusId === 7 || oeuvre?.statusId === 8 || oeuvre?.statusId === 5) ? 'possession' : 'artist'
  const [ownStage,  setOwnStage]  = useState(initialOwn)
  const [contactId, setContactId] = useState(String(oeuvre?.LocalisationID ?? ''))
  const [showContactModal, setShowContactModal] = useState(false)

  // 4. Condition
  const initialCond = (oeuvre?.statusId === 9) ? 'destroyed' : 
                      (oeuvre?.statusId === 10) ? 'lost' : 'good'
  const [condition, setCondition] = useState(initialCond)

  // 5. Financials & Visibility
  const [prix,        setPrix]        = useState(String(oeuvre?.Prix ?? '0'))
  const [discount,    setDiscount]    = useState(String((oeuvre as any)?.Discount ?? '0'))
  const [paymentDone, setPaymentDone] = useState((oeuvre as any)?.PaymentDone ?? false)
  const [isGift,      setIsGift]      = useState(oeuvre?.statusId === 11)
  const [isAnonymous, setIsAnonymous] = useState((oeuvre as any)?.IsAnonymous ?? false)
  const [isPublic,    setIsPublic]    = useState(oeuvre?.is_public ?? false)

  // Lookups & Groups
  const [localTechniques, setLocalTechniques] = useState(initialTechniques)
  const [localSupports,   setLocalSupports]   = useState(initialSupports)
  const [localFormats,    setLocalFormats]    = useState(initialFormats)
  const [localContacts,   setLocalContacts]   = useState(contacts)
  const [localGroups,     setLocalGroups]     = useState(initialGroups)
  const [selGroups,       setSelGroups]       = useState<Set<string>>(new Set(currentGroupIds))
  const [allThemes, setAllThemes] = useState(initialThemes)
  const [selThemes, setSelThemes] = useState<Set<number>>(new Set(currentThemeIds))

  // ── 2. Computed Values ──────────────────────────────────────────

  const isDigital = techniqueId === '19'
  const pxToCm = (px: string) => px ? (parseFloat(px) / (300 / 2.54)).toFixed(1) : ''

  const prixVal = parseFloat(prix) || 0
  const discVal = parseFloat(discount) || 0
  const prixFinal = isGift ? 0 : prixVal * (1 - discVal / 100)

  // Logic Guards
  const pemContact = useMemo(() => contacts.find(c => (c.NomInstitution||'').toLowerCase().includes('pem')), [contacts])
  const currentOwner = useMemo(() => localContacts.find(c => String(c.ContactID) === contactId), [localContacts, contactId])
  const activeOwner = currentOwner || pemContact

  const isPemOwner = (activeOwner?.NomInstitution || '').toLowerCase().includes('pem')
  const isSoldOrGift = ownStage === 'transfer'
  const isArchived   = prodStage === 'archive' || condition === 'destroyed' || condition === 'lost'
  const isArtistVaulted = isArchived && isPemOwner
  const isReserved   = isSoldOrGift && !paymentDone

  const currentLoc = useMemo(() => {
    if (condition === 'lost') return 'Unknown (Lost)'
    if (ownStage === 'artist') return pemContact?.Ville ? `${pemContact.Ville}, ${pemContact.Pays || ''}` : 'Atelier'
    
    if (ownStage === 'transfer') {
      if (!currentOwner) return 'Buyer TBD'
      const loc = [currentOwner.Ville, currentOwner.Pays].filter(Boolean).join(', ')
      return loc || `${currentOwner.NomInstitution || currentOwner.Nom || 'Buyer'} (Location TBD)`
    }
    
    if (ownStage === 'possession' && activeConsignment) {
        const c = activeConsignment.Contact
        const loc = [c?.Ville, c?.Pays].filter(Boolean).join(', ')
        return `${activeConsignment.label || 'Exhibition'} · ${c?.NomInstitution || c?.Nom || 'Holder'} (${loc || '?'})`
    }
    return 'Atelier / In Transit'
  }, [ownStage, condition, currentOwner, pemContact, activeConsignment])

  // ── 3. Pipeline Enforcements ────────────────────────────────────

  useEffect(() => {
    if (prodStage === 'archive') {
      setIsPublic(false)
      if (pemContact) setContactId(String(pemContact.ContactID))
    }
  }, [prodStage, pemContact])

  useEffect(() => {
    if (condition === 'destroyed' || condition === 'lost') {
      setProdStage('archive')
    }
  }, [condition])

  useEffect(() => {
    if (!pemContact) return
    const isPem = String(pemContact.ContactID) === contactId

    // If we are in Artist mode, contact MUST be PEM
    if (ownStage === 'artist' && !isPem) {
      setContactId(String(pemContact.ContactID))
    } 
    // If we are in other modes but contact is PEM, shift back to Artist
    else if (ownStage !== 'artist' && isPem) {
      setOwnStage('artist')
    }
  }, [contactId, pemContact, ownStage])

  useEffect(() => {
    if (isGift) {
      setPrix('0')
      setDiscount('0')
    }
  }, [isGift])

  useEffect(() => {
    if (ownStage === 'transfer') {
      setProdStage('available')
      setIsPublic(true)
    }
  }, [ownStage])

  // 6. Automation: If "Needs Photo" is ON, it cannot be "Available" or "Public"
  // 7. Automation: If "Needs Photo" is TURNED OFF, move to "Available" and "Public"
  const prevNeedsPhoto = useRef(needsPhoto)
  useEffect(() => {
    if (needsPhoto) {
      if (prodStage === 'available') setProdStage('catalogued')
      setIsPublic(false)
    } else if (prevNeedsPhoto.current === true && !needsPhoto) {
      // Transition from True -> False
      setProdStage('available')
      setIsPublic(true)
    }
    prevNeedsPhoto.current = needsPhoto
  }, [needsPhoto])

  // 8. Hard Guard: Cannot be Consigned/Sold if not Available
  useEffect(() => {
    if (prodStage !== 'available' && prodStage !== 'archive' && ownStage !== 'artist') {
      setOwnStage('artist')
    }
  }, [prodStage, ownStage])

  // 9. Mandatory Link: "Catalogué" always implies "Needs Photo"
  useEffect(() => {
    if (prodStage === 'catalogued' && !needsPhoto) {
      setNeedsPhoto(true)
    }
  }, [prodStage])

  // ── 4. Handlers ─────────────────────────────────────────────

  async function handleSubmit(e: any) {
    if (e?.preventDefault) e.preventDefault()
    const fd = new FormData(formRef.current!)
    
    fd.set('catalogued', (prodStage === 'catalogued' || prodStage === 'available') ? '1' : '0')
    fd.set('is_public', isPublic ? '1' : '0')
    fd.set('is_gift', isGift ? '1' : '0')
    fd.set('needs_photograph', needsPhoto ? '1' : '0')
    fd.set('stage_production', prodStage)
    fd.set('prix_final', String(prixFinal))
    fd.set('contact_id', contactId)
    fd.set('localisation_id', contactId)
    
    let finalStatus = 1
    if (prodStage === 'available') finalStatus = 2
    if (ownStage === 'possession') finalStatus = 7
    if (ownStage === 'transfer')   finalStatus = isGift ? 11 : 6
    if (prodStage === 'archive')   finalStatus = 6 // Sold/Gone
    if (condition === 'destroyed') finalStatus = 9
    if (condition === 'lost')      finalStatus = 10
    fd.set('status_id', String(finalStatus))

    // Ownership Change History
    if (oeuvre?.LocalisationID !== parseInt(contactId)) {
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/')
        const locStr = `${dateStr} - ${currentOwner?.NomInstitution || currentOwner?.Nom || 'Unknown'} - ${currentOwner?.Ville || '?'}/${currentOwner?.Pays || '?'}`
        fd.set('historique_append', locStr)
    }

    fd.delete('themes')
    selThemes.forEach(id => fd.append('themes', String(id)))
    fd.delete('groups')
    selGroups.forEach(id => fd.append('groups', id))

    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) alert("Erreur : " + res.error)
      else { router.push('/atelier'); router.refresh() }
    })
  }

  async function saveLookup(table: string, name: string) {
    if (!name) return
    const { createLookup } = await import('@/app/atelier/works/actions')
    const res = await createLookup(table, cap(name))
    if ('error' in res) alert("Erreur : " + res.error)
    else {
        if (table === 'Technique') { setLocalTechniques(prev => [...prev, { TechniqueID: res.id, Technique: cap(name) }]); setTechniqueId(String(res.id)) }
        else if (table === 'Support') { setLocalSupports(prev => [...prev, { SupportID: res.id, Support: cap(name) }]); setSupportId(String(res.id)) }
        else if (table === 'Format') { setLocalFormats(prev => [...prev, { FormatID: res.id, Format: cap(name) }]); setFormatId(String(res.id)) }
    }
  }

  // ── 5. Render ──────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '12px 28px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row gap-md">
          <button type="button" className="btn ghost sm" onClick={() => router.back()}>← Back</button>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>{oeuvre ? `Edit #${oeuvre.OeuvreID}` : 'New Artwork'}</div>
          {isSoldOrGift && <div className="t-eyebrow" style={{ color: 'var(--rust)', background: 'var(--rust)22', padding: '2px 6px' }}>{isGift ? 'Gift' : 'Sold'}</div>}
        </div>
        <div className="row gap-sm">
          <button type="button" className="btn primary sm" onClick={handleSubmit} disabled={isPending}>{isPending ? 'Saving...' : 'Save Work'}</button>
        </div>
      </div>

      <form id="work-form" ref={formRef} onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <input type="hidden" name="oeuvre_id" value={oeuvre?.OeuvreID ?? ''} />
        <div style={{ width: 340, borderRight: '1px solid var(--bd)', background: 'var(--bg1)', padding: 24, overflow: 'auto' }}>
          <ImageManager oeuvreId={oeuvre?.OeuvreID ?? 0} initialImages={initialImages} />
          <div style={{ marginTop: 32 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 9 }}>Themes / Sets</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {allThemes.map(th => (
                <button key={th.ThemeID} type="button" onClick={() => setSelThemes(p => { const s = new Set(p); if(s.has(th.ThemeID)) s.delete(th.ThemeID); else s.add(th.ThemeID); return s })}
                  style={{ padding: '3px 8px', fontSize: 9, borderRadius: 2, border: '1px solid var(--bd)', background: selThemes.has(th.ThemeID) ? 'var(--ac)' : 'var(--bg2)', color: selThemes.has(th.ThemeID) ? 'var(--bg0)' : 'var(--tx3)' }}>{th.Nom}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '40px 60px', overflow: 'auto' }}>
          <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 56 }}>
            {/* 1. Identity */}
            <section>
              <div className="t-eyebrow" style={{ marginBottom: 20, color: 'var(--tx3)', fontSize: 10 }}>1. Base Identity</div>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20 }}>
                <Field label="Titre (Auto-cap)"><input name="titre" value={titre} onChange={e=>setTitre(cap(e.target.value))} style={FIS} /></Field>
                <Field label="Année / Période (YYYY/MM/DD)"><input name="annee" value={annee} onChange={e=>setAnnee(e.target.value)} style={FIS} placeholder="1999/10/31" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 16 }}>
                <Field label="Technique">
                  <CreatableSelect 
                    value={techniqueId} 
                    options={localTechniques.map(t => ({ id: String(t.TechniqueID), label: t.Technique || '' }))}
                    onChange={setTechniqueId}
                    onAdd={name => saveLookup('Technique', name)}
                    name="technique"
                  />
                </Field>
                <Field label="Support">
                  <CreatableSelect 
                    value={supportId} 
                    options={localSupports.map(s => ({ id: String(s.SupportID), label: s.Support || '' }))}
                    onChange={setSupportId}
                    onAdd={name => saveLookup('Support', name)}
                    name="support"
                  />
                </Field>
                <Field label="Format">
                  <CreatableSelect 
                    value={formatId} 
                    options={localFormats.map(f => ({ id: String(f.FormatID), label: f.Format || '' }))}
                    onChange={setFormatId}
                    onAdd={name => saveLookup('Format', name)}
                    name="format"
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 16 }}>
                <Field label={isDigital ? "H (px)" : "H (cm)"}><input name="hauteur" value={hauteur} onChange={e=>setHauteur(e.target.value)} style={FIS} /></Field>
                <Field label={isDigital ? "W (px)" : "W (cm)"}><input name="largeur" value={largeur} onChange={e=>setLargeur(e.target.value)} style={FIS} /></Field>
                <Field label="D (cm)"><input name="profondeur" value={profondeur} onChange={e=>setProfondeur(e.target.value)} style={FIS} /></Field>
              </div>
              {isDigital && (
                <div style={{ marginTop: 24, padding: 20, border: '1px solid var(--bd)', background: 'var(--bg2)' }}>
                  <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 12 }}>Digital Asset Manifest</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                    {['TIFF', 'JPG', 'AVIF', 'WEBP', 'PSD', 'PDF', 'VIDEO', 'SOURCE'].map(f => (
                        <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--tx2)' }}>
                            <input type="checkbox" style={{ accentColor: 'var(--ac)' }} /> {f}
                        </label>
                    ))}
                  </div>
                  <div className="t-mono-xs" style={{ marginTop: 16, color: 'var(--ac)' }}>≈ {pxToCm(hauteur)} × {pxToCm(largeur)} cm (@300dpi)</div>
                </div>
              )}
            </section>

            <section style={{ opacity: (isSoldOrGift || isArchived) ? 0.4 : 1 }}>
              <PipeHeader icon="⚙️" title="Production Pipeline" color={PIPELINE_COLORS.production} />
              <PipeProgress 
                stages={PRODUCTION_STAGES.map(s => ({ ...s, disabled: needsPhoto && s.id === 'available' }))} 
                current={prodStage} 
                onSelect={setProdStage} 
                color={PIPELINE_COLORS.production} 
              />
              <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
                <Switch label="Exposable" checked={exposable} onChange={setExposable} />
                <Switch label="Needs Photo" checked={needsPhoto} onChange={setNeedsPhoto} />
              </div>
            </section>

            <section style={{ opacity: isArchived ? 0.4 : 1 }}>
              <PipeHeader icon="🌍" title="Ownership & Logistics" color={PIPELINE_COLORS.ownership} />
              <PipeProgress 
                stages={OWNERSHIP_STAGES.map(s => {
                  const isBlocked = prodStage !== 'available' && s.id !== 'artist'
                  if (s.id === 'artist') return { ...s, label: 'Artist Atelier' }
                  if (s.id === 'transfer') return { ...s, label: isGift ? 'Gift' : 'Sold', disabled: isBlocked }
                  if (s.id === 'possession') return { ...s, disabled: isBlocked }
                  return s
                })} 
                current={ownStage} 
                onSelect={(id) => {
                  if (id === 'transfer' && ownStage === 'transfer') {
                    setIsGift(!isGift)
                  } else {
                    // If moving away from Artist, clear contact to prompt selection
                    if (ownStage === 'artist' && id !== 'artist') {
                      setContactId('')
                    }
                    setOwnStage(id)
                  }
                }} 
                color={PIPELINE_COLORS.ownership} 
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 24 }}>
                <Field label={ownStage === 'possession' ? "Custodian" : "Contact / Buyer"}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {ownStage === 'artist' ? (
                      <div style={{ ...FIS, display: 'flex', alignItems: 'center', background: 'var(--bg2)44', opacity: 0.8, cursor: 'default' }}>
                        {pemContact?.NomInstitution || 'Artist (PEM)'}
                      </div>
                    ) : (
                      <>
                        <select value={contactId} onChange={e=>setContactId(e.target.value)} style={{ ...FIS, color: isReserved ? 'var(--rust)' : 'inherit' }}>
                          <option value="">— Select —</option>
                          {localContacts.map(c=><option key={c.ContactID} value={c.ContactID}>{c.NomInstitution || `${c.Prénom||''} ${c.Nom||''}`}</option>)}
                        </select>
                        <button type="button" className="btn ghost sm" onClick={()=>setShowContactModal(true)}>+</button>
                      </>
                    )}
                  </div>
                </Field>
                <div style={{ background: 'var(--bg1)', padding: 16, border: '1px solid var(--bd)', alignSelf: 'flex-end' }}>
                  <div className="t-label" style={{ fontSize: 7, marginBottom: 4 }}>CURRENT CUSTODIAL STATE</div>
                  <div className="t-mono-sm" style={{ color: 'var(--ac)' }}>{currentLoc}</div>
                </div>
              </div>
            </section>

            <section>
              <PipeHeader icon="🛡️" title="Condition & Archive" color={PIPELINE_COLORS.condition} />
              <PipeProgress stages={CONDITION_STAGES} current={condition} onSelect={setCondition} color={PIPELINE_COLORS.condition} />
            </section>

            <section style={{ background: paymentDone ? 'transparent' : 'var(--rust)08', border: `1px solid ${paymentDone ? 'var(--bd)' : 'var(--rust)44'}`, padding: 24 }}>
              <PipeHeader icon="💳" title="Financials & Diffusion" color={PIPELINE_COLORS.visibility} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                <Field label="Base Price (€)"><input value={prix} onChange={e=>setPrix(e.target.value)} style={FIS} disabled={isGift} /></Field>
                <Field label="Discount (%)"><input value={discount} onChange={e=>setDiscount(e.target.value)} style={FIS} disabled={isGift} /></Field>
                <div style={{ alignSelf: 'flex-end' }}>
                  <div className="t-label" style={{ fontSize: 7, color: paymentDone ? 'var(--tx3)' : 'var(--rust)' }}>FINAL SETTLEMENT</div>
                  <div className="t-mono-md" style={{ fontWeight: 700 }}>€ {prixFinal.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
                <Switch label="Payment Received" checked={paymentDone} onChange={setPaymentDone} />
                <Switch label="Master Public" checked={isPublic} onChange={setIsPublic} disabled={isArtistVaulted || needsPhoto} />
              </div>
              {isSoldOrGift && !isGift && (
                <div style={{ marginTop: 24, padding: 16, background: 'var(--bg2)', borderLeft: `3px solid ${paymentDone ? 'var(--ac)' : 'var(--rust)'}` }}>
                   <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 8 }}>Payment Plan & Schedule</div>
                   <div style={{ display: 'flex', gap: 24, color: 'var(--tx2)' }}>
                      <div className="t-mono-xs">Paid: € {(paymentDone ? prixFinal : 0).toLocaleString()}</div>
                      <div className="t-mono-xs">Due: € {(paymentDone ? 0 : prixFinal).toLocaleString()}</div>
                   </div>
                </div>
              )}
              <div style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}>
                <Field label="Business Groups">
                   <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {localGroups.map(g => {
                          const isSel = selGroups.has(g.id)
                          return (
                            <div key={g.id} onClick={() => setSelGroups(p => { const n = new Set(p); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n })}
                              style={{ padding: '4px 12px', fontSize: 9, cursor: 'pointer', border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd)'}`, background: isSel ? 'var(--ac)22' : 'transparent', color: isSel ? 'var(--ac)' : 'var(--tx3)', borderRadius: 12 }}>{g.name}</div>
                          )
                      })}
                   </div>
                </Field>
              </div>
            </section>
          </div>
        </div>
      </form>
      {showContactModal && <ContactModal onClose={() => setShowContactModal(false)} onCreated={c => { setLocalContacts(p => [...p, c]); setContactId(String(c.ContactID)) }} />}
    </div>
  )
}

function PipeHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: `1px solid ${color}44`, paddingBottom: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div className="t-eyebrow" style={{ color }}>{title}</div>
    </div>
  )
}

function PipeProgress({ stages, current, onSelect, color }: { stages: any[]; current: string; onSelect: (id: string) => void; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, width: '100%' }}>
      {stages.map((s, i) => {
        const isActive = s.id === current
        const isPast = stages.findIndex(x => x.id === current) >= i
        const isDisabled = s.disabled
        return (
          <div key={s.id} onClick={() => !isDisabled && onSelect(s.id)}
            style={{ 
              flex: 1, 
              cursor: isDisabled ? 'not-allowed' : 'pointer', 
              transition: 'all 0.2s', 
              borderBottom: `3px solid ${isPast ? color : 'var(--bd)'}`, 
              padding: '8px 4px', 
              opacity: isDisabled ? 0.2 : (isPast ? 1 : 0.4) 
            }}>
            <div style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, color: isPast ? 'var(--tx)' : 'var(--tx3)' }}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="t-label" style={{ marginBottom: 4, fontSize: 8, letterSpacing: '0.05em' }}>{label}</div>
      {children}
    </div>
  )
}

function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer', fontSize: 10, opacity: disabled ? 0.5 : 1 }}>
      <div onClick={() => !disabled && onChange(!checked)}
        style={{ width: 14, height: 14, border: '1px solid var(--bd)', background: checked ? 'var(--ac)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg0)', fontSize: 9 }}>{checked ? '✓' : ''}</div>
      <span style={{ color: checked ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
    </label>
  )
}

function CreatableSelect({ value, options, onChange, onAdd, name }: { value: string; options: any[]; onChange: (v: string) => void; onAdd: (v: string) => void; name: string }) {
    const [isAdding, setIsAdding] = useState(false)
    const [newVal, setNewVal] = useState('')
    if (isAdding) {
        return (
            <div style={{ display: 'flex', gap: 4 }}>
                <input value={newVal} onChange={e => setNewVal(e.target.value)} style={{ ...FIS, height: 31 }} placeholder="New..." autoFocus />
                <button type="button" className="btn primary sm" onClick={() => { onAdd(newVal); setIsAdding(false); setNewVal('') }}>OK</button>
                <button type="button" className="btn ghost sm" onClick={() => setIsAdding(false)}>✕</button>
            </div>
        )
    }
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            <select name={name} value={value} onChange={e => onChange(e.target.value)} style={FIS}>
                <option value="">— Select —</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button type="button" className="btn ghost sm" onClick={() => setIsAdding(true)} style={{ padding: '0 8px' }}>+</button>
        </div>
    )
}

function ImageManager({ oeuvreId, initialImages }: { oeuvreId: number; initialImages: WorkImage[] }) {
  const [imgs, setImgs] = useState(initialImages)
  const [busy, setBusy] = useState(false)
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !oeuvreId) return
    setBusy(true); const fd = new FormData(); fd.append('image', file); fd.append('oeuvre_id', String(oeuvreId))
    const res = await addWorkImage(fd); if ('image' in res) setImgs(p => [...p, res.image]); setBusy(false)
  }
  async function onDelete(id: number) {
    if (!confirm("Delete image?")) return
    const res = await deleteWorkImage(id, oeuvreId); if ('ok' in res) setImgs(p => p.filter(img => img.ImageID !== id))
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="t-eyebrow" style={{ fontSize: 9 }}>Media Manager</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {imgs.map(img => (
          <div key={img.ImageID} style={{ position: 'relative', aspectRatio: '1', background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
            <img src={thumbUrl(img.txtImageNameLink||'')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button type="button" onClick={() => onDelete(img.ImageID)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 14, height: 14, fontSize: 8, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <label style={{ aspectRatio: '1', border: '1px dashed var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--tx3)', cursor: 'pointer' }}>
          {busy ? '…' : '+'}<input type="file" hidden onChange={onUpload} accept="image/*" />
        </label>
      </div>
    </div>
  )
}

function ContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
    const [form, setForm] = useState({ NomInstitution: '', Nom: '', Prénom: '', Role: '', Ville: '', Pays: '', Email: '', Téléphone1: '', Website: '', Adresse: '' })
    const [busy, setBusy] = useState(false)
    async function handleSave() {
      if (!form.NomInstitution && !form.Nom) return; setBusy(true)
      const sb = createClient(); const { data, error } = await sb.from('Contact').insert(form).select().single()
      if (!error && data) onCreated(data); setBusy(false); onClose()
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 32, width: 600, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
          <div className="t-eyebrow" style={{ marginBottom: 24, fontSize: 10, color: 'var(--ac)' }}>Full Fidelity Contact Creation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <Field label="INSTITUTION"><input value={form.NomInstitution} onChange={e => setForm(p => ({...p, NomInstitution: cap(e.target.value)}))} style={FIS} autoFocus /></Field>
             <Field label="ROLE"><input value={form.Role} onChange={e => setForm(p => ({...p, Role: cap(e.target.value)}))} style={FIS} /></Field>
             <Field label="PRÉNOM"><input value={form.Prénom} onChange={e => setForm(p => ({...p, Prénom: cap(e.target.value)}))} style={FIS} /></Field>
             <Field label="NOM"><input value={form.Nom} onChange={e => setForm(p => ({...p, Nom: cap(e.target.value)}))} style={FIS} /></Field>
             <Field label="EMAIL"><input value={form.Email} onChange={e => setForm(p => ({...p, Email: e.target.value}))} style={FIS} /></Field>
             <Field label="PHONE"><input value={form.Téléphone1} onChange={e => setForm(p => ({...p, Téléphone1: e.target.value}))} style={FIS} /></Field>
             <Field label="WEBSITE"><input value={form.Website} onChange={e => setForm(p => ({...p, Website: e.target.value}))} style={FIS} /></Field>
             <Field label="ADDRESS"><input value={form.Adresse} onChange={e => setForm(p => ({...p, Adresse: e.target.value}))} style={FIS} /></Field>
             <Field label="VILLE"><input value={form.Ville} onChange={e => setForm(p => ({...p, Ville: cap(e.target.value)}))} style={FIS} /></Field>
             <Field label="PAYS"><input value={form.Pays} onChange={e => setForm(p => ({...p, Pays: cap(e.target.value)}))} style={FIS} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn ghost sm" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="button" className="btn primary sm" onClick={handleSave} style={{ flex: 1, background: 'var(--ac)' }} disabled={busy}>Save Contact</button>
          </div>
        </div>
      </div>
    )
}

const FIS: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12,
  background: 'var(--bg2)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}
