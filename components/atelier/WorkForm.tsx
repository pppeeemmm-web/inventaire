'use client'

/**
 * WorkForm — simplified pipeline architecture.
 * Two axes: Production state (booleans) + Ownership/flow state (statusId).
 * No commercial_status. No StageProduction. No FORCE FIELD ENFORCEMENT.
 */

import { useState, useEffect, useTransition, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre, WorkImage } from '@/lib/types/database'
import type { SaveResult } from '@/app/atelier/works/actions'
import { addWorkImage, deleteWorkImage, createLookup } from '@/app/atelier/works/actions'
import { createClient } from '@/lib/supabase/client'

// ── Config ────────────────────────────────────────────────────────────────

const PRODUCTION_STAGES = [
  { id: 'atelier',    label: 'En production', desc: 'Travail en cours'    },
  { id: 'catalogued', label: 'Catalogué',     desc: 'Photo en attente'    },
  { id: 'available',  label: 'Disponible',    desc: 'Prêt pour diffusion' },
]

// Ownership stages: artist = statusId 1 (en production) or 2 (available);
// others map 1-to-1 to OeuvreStatus rows.
const OWNERSHIP_STAGES = [
  { id: 'artist',         label: 'Atelier (Pem)',  desc: 'Propriété totale'            },
  { id: 'reserved',       label: 'Réservé',        desc: 'Vente en cours'              },
  { id: 'consigned',      label: 'Consigné',       desc: 'Galerie / sans transfert'    },
  { id: 'loan',           label: 'Prêt',           desc: 'Institution / sans transfert'},
  { id: 'sold',           label: 'Vendu',          desc: 'Transfert propriété'         },
  { id: 'gift',           label: 'Don',            desc: 'Transfert propriété'         },
  { id: 'artist_archive', label: 'Archive (Pem)',  desc: 'Retiré de la diffusion'      },
]

// statusId lookup for ownership stages (statusId 1/2 handled via prod logic)
const OWN_TO_STATUS_ID: Record<string, number> = {
  reserved:       4,
  consigned:      7,
  loan:           8,
  sold:           6,
  gift:           11,
  artist_archive: 3,
}

function ownStageFromStatusId(statusId: number | null | undefined): string {
  if (statusId === null || statusId === undefined) return 'artist'
  switch (statusId) {
    case 4:  return 'reserved'
    case 7:  return 'consigned'
    case 8:  return 'loan'
    case 6:  return 'sold'
    case 11: return 'gift'
    case 3:  return 'artist_archive'
    case 5:  return 'artist_archive' // private_archive → treat as artist_archive in UI
    default: return 'artist'         // 1, 2 → artist still owns
  }
}

function prodStageFromOeuvre(o: Oeuvre | null): string {
  if (!o || !o.Catalogué) return 'atelier'
  if ((o as any).NeedsPhotograph) return 'catalogued'
  return 'available'
}

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
  const [prodStage,  setProdStage]  = useState(() => prodStageFromOeuvre(oeuvre))
  const [needsPhoto, setNeedsPhoto] = useState(!!((oeuvre as any)?.NeedsPhotograph ?? false))

  // ── Ownership / flow state ────────────────────────────────────────
  const [ownStage,  setOwnStage]  = useState(() => ownStageFromStatusId(oeuvre?.statusId))
  const [contactId, setContactId] = useState(String(oeuvre?.LocalisationID ?? ''))
  const [showContactModal, setShowContactModal] = useState(false)

  // ── Financials ────────────────────────────────────────────────────
  const [prix,        setPrix]        = useState(String(oeuvre?.Prix ?? '0'))
  const [discount,    setDiscount]    = useState(String((oeuvre as any)?.Discount ?? '0'))
  const [paymentDone, setPaymentDone] = useState((oeuvre as any)?.PaymentDone ?? false)
  const [exposable,   setExposable]   = useState((oeuvre as any)?.Exposable ?? false)

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

  // ── Derived ───────────────────────────────────────────────────────
  const isDigital  = techniqueId === '19'
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
        : 'Atelier'
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
  }, [ownStage, currentOwner, pemContact, activeConsignment, isOwnershipTransferred])

  // ── Automations ───────────────────────────────────────────────────

  // A. Cataloguer → always enter photo gate (prodStage sets needsPhoto)
  useEffect(() => {
    if (prodStage === 'catalogued') {
      setNeedsPhoto(true)
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
  }, [isOwnershipTransferred])

  // F. Artist/archive → contact = Pem
  useEffect(() => {
    if ((ownStage === 'artist' || ownStage === 'artist_archive') && pemContact) {
      setContactId(String(pemContact.ContactID))
    }
  }, [ownStage, pemContact])

  // ── Computed statusId ─────────────────────────────────────────────
  function computeStatusId(): number {
    if (ownStage !== 'artist') return OWN_TO_STATUS_ID[ownStage] ?? 1
    // artist + prodStage
    if (prodStage === 'available') return 2
    return 1  // atelier or catalogued → en production
  }

  // ── Submit ────────────────────────────────────────────────────────

  async function handleSubmit(e: any) {
    if (e?.preventDefault) e.preventDefault()
    const fd = new FormData(formRef.current!)

    fd.set('catalogued', (prodStage !== 'atelier') ? '1' : '0')
    fd.set('needs_photograph', needsPhoto ? '1' : '0')
    fd.set('prix_final', String(prixFinal))
    fd.set('is_paid', paymentDone ? '1' : '0')
    fd.set('commentaires', commentaires)
    fd.set('historique', historique)
    fd.set('contact_id', contactId)
    fd.set('localisation_id', contactId)
    fd.set('status_id', String(computeStatusId()))

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
      const res = await action(fd)
      if ('error' in res) alert('Erreur : ' + res.error)
      else { router.push('/atelier'); router.refresh() }
    })
  }

  async function saveLookup(table: string, name: string) {
    if (!name) return
    const res = await createLookup(table, cap(name))
    if ('error' in res) { alert('Erreur : ' + res.error); return }
    if (table === 'Technique') { setLocalTechniques(p => [...p, { TechniqueID: res.id, Technique: cap(name) }]); setTechniqueId(String(res.id)) }
    else if (table === 'Support') { setLocalSupports(p => [...p, { SupportID: res.id, Support: cap(name) }]); setSupportId(String(res.id)) }
    else if (table === 'Format') { setLocalFormats(p => [...p, { FormatID: res.id, Format: cap(name) }]); setFormatId(String(res.id)) }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '12px 28px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row gap-md">
          <button type="button" className="btn ghost sm" onClick={() => router.back()}>← Retour</button>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>{oeuvre ? `Modifier #${oeuvre.OeuvreID}` : 'Nouvelle œuvre'}</div>
          {isOwnershipTransferred && (
            <div className="t-eyebrow" style={{ color: 'var(--rust)', background: 'var(--rust)22', padding: '2px 6px' }}>
              {ownStage === 'gift' ? 'Don' : 'Vendu'}
            </div>
          )}
          {isArchived && (
            <div className="t-eyebrow" style={{ color: 'var(--mt)', background: 'var(--mt)22', padding: '2px 6px' }}>
              Archive
            </div>
          )}
        </div>
        <button type="button" className="btn primary sm" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <form id="work-form" ref={formRef} onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <input type="hidden" name="oeuvre_id" value={oeuvre?.OeuvreID ?? ''} />

        {/* Left sidebar: images, themes, notes */}
        <div style={{ width: 340, borderRight: '1px solid var(--bd)', background: 'var(--bg1)', padding: 24, overflow: 'auto' }}>
          <ImageManager oeuvreId={oeuvre?.OeuvreID ?? 0} initialImages={initialImages} />

          <div style={{ marginTop: 32 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>Thèmes / Séries</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allThemes.map(th => (
                <button key={th.ThemeID} type="button"
                  onClick={() => setSelThemes(p => { const s = new Set(p); if (s.has(th.ThemeID)) s.delete(th.ThemeID); else s.add(th.ThemeID); return s })}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 2, border: '1px solid var(--bd)', background: selThemes.has(th.ThemeID) ? 'var(--ac)' : 'var(--bg2)', color: selThemes.has(th.ThemeID) ? 'var(--bg0)' : 'var(--tx3)' }}>
                  {th.Nom}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>Commentaires</div>
            <textarea value={commentaires} onChange={e => setCommentaires(e.target.value)}
              style={{ ...FIS, height: 120, resize: 'vertical', fontSize: 13 }} placeholder="Notes internes…" />
          </div>

          <div style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>Historique / Provenance</div>
            <textarea value={historique} onChange={e => setHistorique(e.target.value)}
              style={{ ...FIS, height: 140, resize: 'vertical', fontSize: 12, fontFamily: 'var(--font-mono)' }} placeholder="Historique des mouvements…" />
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--tx3)', lineHeight: 1.4 }}>
              Les changements de localisation sont ajoutés automatiquement si le contact change.
            </div>
          </div>
        </div>

        {/* Main form */}
        <div style={{ flex: 1, padding: '40px 60px', overflow: 'auto' }}>
          <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 56 }}>

            {/* 1. Identity */}
            <section>
              <SectionHeader title="1. Identité" />
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20 }}>
                <Field label="Titre"><input name="titre" value={titre} onChange={e => setTitre(cap(e.target.value))} style={FIS} /></Field>
                <Field label="Année (AAAA/MM/JJ)"><input name="annee" value={annee} onChange={e => setAnnee(e.target.value)} style={FIS} placeholder="1999/10/31" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 16 }}>
                <Field label="Technique">
                  <CreatableSelect value={techniqueId} options={localTechniques.map(t => ({ id: String(t.TechniqueID), label: t.Technique ?? '' }))} onChange={setTechniqueId} onAdd={name => saveLookup('Technique', name)} name="technique" />
                </Field>
                <Field label="Support">
                  <CreatableSelect value={supportId} options={localSupports.map(s => ({ id: String(s.SupportID), label: s.Support ?? '' }))} onChange={setSupportId} onAdd={name => saveLookup('Support', name)} name="support" />
                </Field>
                <Field label="Format">
                  <CreatableSelect value={formatId} options={localFormats.map(f => ({ id: String(f.FormatID), label: f.Format ?? '' }))} onChange={setFormatId} onAdd={name => saveLookup('Format', name)} name="format" />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 16 }}>
                <Field label={isDigital ? "H (px)" : "H (cm)"}><input name="hauteur" value={hauteur} onChange={e => setHauteur(e.target.value)} style={FIS} /></Field>
                <Field label={isDigital ? "W (px)" : "W (cm)"}><input name="largeur" value={largeur} onChange={e => setLargeur(e.target.value)} style={FIS} /></Field>
                <Field label="D (cm)"><input name="profondeur" value={profondeur} onChange={e => setProfondeur(e.target.value)} style={FIS} /></Field>
              </div>
              {isDigital && (
                <div style={{ marginTop: 24, padding: 24, border: '1px solid var(--bd)', background: 'var(--bg2)' }}>
                  <div className="t-eyebrow" style={{ fontSize: 11, marginBottom: 16 }}>Format numérique</div>
                  <div className="t-mono-xs" style={{ color: 'var(--ac)', fontSize: 12 }}>≈ {pxToCm(hauteur)} × {pxToCm(largeur)} cm (@300dpi)</div>
                </div>
              )}
            </section>

            {/* 2. Production State */}
            <section style={{ opacity: (isOwnershipTransferred || isArchived) ? 0.5 : 1 }}>
              <SectionHeader title="2. État de production" />
              <PipeProgress stages={PRODUCTION_STAGES} current={prodStage} onSelect={id => {
                if (isOwnershipTransferred || isArchived) return
                setProdStage(id)
              }} color="var(--sage)" />
              <div style={{ display: 'flex', gap: 32, marginTop: 20 }}>
                <Switch label="Photo requise" checked={needsPhoto} onChange={v => {
                  if (isOwnershipTransferred || isArchived) return
                  setNeedsPhoto(v)
                }} />
                <Switch label="Exposable" checked={exposable} onChange={setExposable} />
              </div>
              {needsPhoto && prodStage === 'catalogued' && (
                <div style={{ marginTop: 12, padding: '8px 14px', background: 'var(--dust)22', border: '1px solid var(--dust)44', fontSize: 12, color: 'var(--tx2)' }}>
                  En attente de photographie — décocher "Photo requise" pour passer en Disponible.
                </div>
              )}
            </section>

            {/* 3. Ownership & Flow */}
            <section>
              <SectionHeader title="3. Propriété et circulation" />
              <PipeProgress
                stages={OWNERSHIP_STAGES.map(s => ({
                  ...s,
                  disabled: isOwnershipTransferred && s.id !== 'sold' && s.id !== 'gift',
                }))}
                current={ownStage}
                onSelect={setOwnStage}
                color="var(--cyan)"
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
                <Field label={ownStage === 'consigned' || ownStage === 'loan' ? 'Dépositaire' : ownStage === 'reserved' ? 'Acheteur pressenti' : 'Contact / Acquéreur'}>
                  {ownStage === 'artist' || ownStage === 'artist_archive' ? (
                    <div style={{ ...FIS, display: 'flex', alignItems: 'center', background: 'var(--bg2)44', opacity: 0.8, cursor: 'default' }}>
                      {pemContact?.NomInstitution ?? 'Pem (Artiste)'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={contactId} onChange={e => setContactId(e.target.value)} style={FIS}>
                        <option value="">— Sélectionner —</option>
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
                  <div className="t-label" style={{ fontSize: 10, marginBottom: 6 }}>LOCALISATION ACTUELLE</div>
                  <div className="t-mono-sm" style={{ color: 'var(--ac)', fontSize: 12 }}>{currentLoc}</div>
                </div>
              </div>
            </section>

            {/* 4. Financials */}
            <section style={{ background: paymentDone ? 'transparent' : 'var(--rust)08', border: `1px solid ${paymentDone ? 'var(--bd)' : 'var(--rust)44'}`, padding: 24 }}>
              <SectionHeader title="4. Finances" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                <Field label="Prix de base (€)">
                  <input value={prix} onChange={e => setPrix(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
                </Field>
                <Field label="Remise (%)">
                  <input value={discount} onChange={e => setDiscount(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
                </Field>
                <div style={{ alignSelf: 'flex-end' }}>
                  <div className="t-label" style={{ fontSize: 11, color: paymentDone ? 'var(--tx3)' : 'var(--rust)', marginBottom: 6 }}>MONTANT FINAL</div>
                  <div className="t-mono-md" style={{ fontWeight: 700, fontSize: 18 }}>€ {prixFinal.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
                <Switch label="Paiement reçu" checked={paymentDone} onChange={setPaymentDone} disabled={ownStage === 'gift'} />
              </div>
              {isOwnershipTransferred && ownStage !== 'gift' && (
                <div style={{ marginTop: 24, padding: 16, background: 'var(--bg2)', borderLeft: `3px solid ${paymentDone ? 'var(--ac)' : 'var(--rust)'}` }}>
                  <div className="t-eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>Règlement</div>
                  <div style={{ display: 'flex', gap: 24, color: 'var(--tx2)' }}>
                    <div className="t-mono-xs" style={{ fontSize: 12 }}>Payé : € {(paymentDone ? prixFinal : 0).toLocaleString()}</div>
                    <div className="t-mono-xs" style={{ fontSize: 12 }}>Dû : € {(paymentDone ? 0 : prixFinal).toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}>
                <Field label="Groupes">
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

function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer', fontSize: 13, opacity: disabled ? 0.5 : 1 }}>
      <div onClick={() => !disabled && onChange(!checked)}
        style={{ width: 16, height: 16, border: '1px solid var(--bd)', background: checked ? 'var(--ac)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg0)', fontSize: 11 }}>
        {checked ? '✓' : ''}
      </div>
      <span style={{ color: checked ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
    </label>
  )
}

function CreatableSelect({ value, options, onChange, onAdd, name }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; onAdd: (v: string) => void; name: string }) {
  const [isAdding, setIsAdding] = useState(false)
  const [newVal, setNewVal] = useState('')
  if (isAdding) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={newVal} onChange={e => setNewVal(e.target.value)} style={{ ...FIS, height: 42 }} placeholder="Nouveau…" autoFocus />
        <button type="button" className="btn primary sm" onClick={() => { onAdd(newVal); setIsAdding(false); setNewVal('') }}>OK</button>
        <button type="button" className="btn ghost sm" onClick={() => setIsAdding(false)}>✕</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select name={name} value={value} onChange={e => onChange(e.target.value)} style={FIS}>
        <option value="">— Sélectionner —</option>
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
    setBusy(true)
    const fd = new FormData(); fd.append('image', file); fd.append('oeuvre_id', String(oeuvreId))
    const res = await addWorkImage(fd); if ('image' in res) setImgs(p => [...p, res.image]); setBusy(false)
  }
  async function onDelete(id: number) {
    if (!confirm('Supprimer cette image ?')) return
    const res = await deleteWorkImage(id, oeuvreId); if ('ok' in res) setImgs(p => p.filter(img => img.ImageID !== id))
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="t-eyebrow" style={{ fontSize: 12 }}>Images</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {imgs.map(img => (
          <div key={img.ImageID} style={{ position: 'relative', aspectRatio: '1', background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
            <img src={thumbUrl(img.txtImageNameLink ?? '')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button type="button" onClick={() => onDelete(img.ImageID)}
              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
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
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 40, width: 720, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
        <div className="t-eyebrow" style={{ marginBottom: 24, fontSize: 13, color: 'var(--ac)' }}>Nouveau contact</div>
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
          <button type="button" className="btn ghost sm" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
          <button type="button" className="btn primary sm" onClick={handleSave} style={{ flex: 1, background: 'var(--ac)' }} disabled={busy}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────

const FIS: React.CSSProperties = {
  padding: '10px 14px', fontSize: 14,
  background: 'var(--bg2)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
