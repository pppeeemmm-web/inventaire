'use client'

// BatchEditModal — edit multiple fields across a work selection at once.
// Only fields explicitly set by the user are updated; others are untouched.

import { useState, useTransition } from 'react'
import { batchEdit, type BatchChanges } from '@/app/atelier/selection/actions'

interface Props {
  ids:            number[]
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  themes:         { ThemeID: number; Nom: string }[]
  statusLabelMap: Record<number, string>
  onClose:        () => void
  onDone:         (count: number) => void
}

// Tri-state for boolean fields: null = unchanged, true/false = set
type Tri = null | boolean

export function BatchEditModal({ ids, techniques, supports, formats, contacts, themes, statusLabelMap, onClose, onDone }: Props) {
  const [pending, startEdit] = useTransition()
  const [error,   setError]  = useState<string | null>(null)

  // Scalar fields — empty string = unchanged
  const [statusId,          setStatusId]         = useState('')
  const [technique,         setTechnique]        = useState('')
  const [support,           setSupport]          = useState('')
  const [format,            setFormat]           = useState('')
  const [contactId,         setContactId]        = useState('')
  const [prix,              setPrix]             = useState('')
  const [discount,          setDiscount]         = useState('')
  const [annee,             setAnnee]            = useState('')
  const [locDetail,         setLocDetail]        = useState('')
  const [commentaires,      setCommentaires]     = useState('')

  // Boolean fields — null = unchanged
  const [exposable,    setExposable]    = useState<Tri>(null)
  const [montee,       setMontee]       = useState<Tri>(null)
  const [encadree,     setEncadree]     = useState<Tri>(null)
  const [catalogued,   setCatalogued]   = useState<Tri>(null)
  const [isPublic,     setIsPublic]     = useState<Tri>(null)
  const [isCommission, setIsCommission] = useState<Tri>(null)

  // Theme junction — sets of IDs to add or remove
  const [addThemes,    setAddThemes]    = useState<Set<number>>(new Set())
  const [removeThemes, setRemoveThemes] = useState<Set<number>>(new Set())

  function toggleTheme(id: number) {
    setAddThemes(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
      // Can't add and remove the same theme
      setRemoveThemes(r => { const nr = new Set(r); nr.delete(id); return nr })
      return next
    })
  }
  function toggleRemoveTheme(id: number) {
    setRemoveThemes(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
      setAddThemes(a => { const na = new Set(a); na.delete(id); return na })
      return next
    })
  }

  const changed = (
    statusId !== '' || technique !== '' || support !== '' || format !== '' ||
    contactId !== '' || prix !== '' || discount !== '' ||
    annee !== '' || locDetail !== '' || commentaires !== '' ||
    exposable !== null || montee !== null || encadree !== null || catalogued !== null ||
    isPublic !== null || isCommission !== null ||
    addThemes.size > 0 || removeThemes.size > 0
  )

  function handleSubmit() {
    const changes: BatchChanges = {}
    if (statusId   !== '')  changes.statusId   = statusId   === 'null' ? null : Number(statusId)
    if (technique  !== '')  changes.Technique  = technique  === 'null' ? null : Number(technique)
    if (support    !== '')  changes.Support    = support    === 'null' ? null : Number(support)
    if (format     !== '')  changes.Format     = format     === 'null' ? null : Number(format)
    if (contactId  !== '')  changes.ContactID  = contactId  === 'null' ? null : Number(contactId)
    if (prix       !== '')  changes.Prix       = prix       === ''     ? null : parseFloat(prix)
    if (discount   !== '')  changes.Discount   = discount   === ''     ? null : parseFloat(discount)
    if (annee      !== '')  changes.Année      = annee.trim() || null
    if (locDetail  !== '')  changes.LocalisationDetail = locDetail.trim() || null
    if (commentaires !== '') changes.Commentaires = commentaires.trim() || null

    if (exposable    !== null) changes.Exposable    = exposable
    if (montee       !== null) changes.Montee       = montee
    if (encadree     !== null) changes.Encadree     = encadree
    if (catalogued   !== null) changes['Catalogué'] = catalogued
    if (isPublic     !== null) changes.is_public    = isPublic
    if (isCommission !== null) changes.IsCommission = isCommission
    if (addThemes.size    > 0) changes.addThemeIds    = [...addThemes]
    if (removeThemes.size > 0) changes.removeThemeIds = [...removeThemes]

    // Auto-compute PrixFinal if Prix/Discount changed
    if (changes.Prix !== undefined) {
      const p = changes.Prix ?? 0
      const d = changes.Discount ?? (discount !== '' ? parseFloat(discount) : 0)
      if (p > 0) changes.PrixFinal = d > 0 ? Math.round(p * (1 - d / 100)) : p
    }

    startEdit(async () => {
      try {
        const r = await batchEdit(ids, changes)
        if ('error' in r) { setError(r.error); return }
        onDone(r.updated)
        window.location.reload() // Force a full refresh to clear any stale client state
      } catch (e) {
        setError(String(e))
      }
    })
  }

  const statuses = Object.entries(statusLabelMap).map(([id, label]) => ({ id: Number(id), label }))

  const contactLabel = (c: Props['contacts'][0]) =>
    c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`

  return (
    <Overlay onClose={onClose}>
      <div className="t-eyebrow" style={{ marginBottom: 6 }}>Modification groupée</div>
      <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 24 }}>
        {ids.length} œuvre{ids.length > 1 ? 's' : ''} sélectionnée{ids.length > 1 ? 's' : ''}
        {' · '}Seuls les champs modifiés seront mis à jour.
      </div>

      {/* ── Section: Classification ─────────────────────────────── */}
      <SectionLabel>Classification</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>

        <FieldWrap label="Statut" active={statusId !== ''}>
          <select className="input" style={{ width: '100%' }} value={statusId}
            onChange={(e) => setStatusId(e.target.value)}>
            <option value="">— Inchangé —</option>
            <option value="null">Retirer le statut</option>
            {statuses.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label="Année" active={annee !== ''}>
          <input className="input" type="text" style={{ width: '100%' }}
            placeholder="Inchangé (ex. 2024)" value={annee}
            onChange={(e) => setAnnee(e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Technique" active={technique !== ''}>
          <select className="input" style={{ width: '100%' }} value={technique}
            onChange={(e) => setTechnique(e.target.value)}>
            <option value="">— Inchangé —</option>
            <option value="null">Retirer</option>
            {techniques.map((t) => (
              <option key={t.TechniqueID} value={t.TechniqueID}>{t.Technique}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label="Support" active={support !== ''}>
          <select className="input" style={{ width: '100%' }} value={support}
            onChange={(e) => setSupport(e.target.value)}>
            <option value="">— Inchangé —</option>
            <option value="null">Retirer</option>
            {supports.map((s) => (
              <option key={s.SupportID} value={s.SupportID}>{s.Support}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label="Format" active={format !== ''}>
          <select className="input" style={{ width: '100%' }} value={format}
            onChange={(e) => setFormat(e.target.value)}>
            <option value="">— Inchangé —</option>
            <option value="null">Retirer</option>
            {formats.map((f) => (
              <option key={f.FormatID} value={f.FormatID}>{f.Format}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label="Contact" active={contactId !== ''}>
          <select className="input" style={{ width: '100%' }} value={contactId}
            onChange={(e) => setContactId(e.target.value)}>
            <option value="">— Inchangé —</option>
            <option value="null">Retirer</option>
            {contacts.map((c) => (
              <option key={c.ContactID} value={c.ContactID}>{contactLabel(c)}</option>
            ))}
          </select>
        </FieldWrap>

      </div>

      {/* ── Section: Prix ────────────────────────────────────────── */}
      <SectionLabel>Prix</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>

        <FieldWrap label="Prix (€)" active={prix !== ''}>
          <input className="input" type="number" style={{ width: '100%' }}
            placeholder="Inchangé" value={prix}
            onChange={(e) => setPrix(e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Remise (%)" active={discount !== ''}>
          <input className="input" type="number" style={{ width: '100%' }}
            placeholder="Inchangé" value={discount} min={0} max={100}
            onChange={(e) => setDiscount(e.target.value)} />
        </FieldWrap>

      </div>

      {/* ── Section: Localisation & notes ────────────────────────── */}
      <SectionLabel>Localisation & notes</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: 20 }}>

        <FieldWrap label="Localisation (détail)" active={locDetail !== ''}>
          <input className="input" type="text" style={{ width: '100%' }}
            placeholder="Inchangé (ex. Marseille, France)" value={locDetail}
            onChange={(e) => setLocDetail(e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Commentaires" active={commentaires !== ''}>
          <textarea className="input" style={{ width: '100%', minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Inchangé — remplacera le commentaire existant"
            value={commentaires}
            onChange={(e) => setCommentaires(e.target.value)} />
        </FieldWrap>

      </div>

      {/* ── Section: Thèmes ──────────────────────────────────────── */}
      {themes.length > 0 && (
        <>
          <SectionLabel>Thèmes</SectionLabel>
          <div style={{ marginBottom: 8 }}>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8 }}>
              Clic = ajouter · Clic droit = retirer · gris = inchangé
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {themes.map(th => {
                const isAdd    = addThemes.has(th.ThemeID)
                const isRemove = removeThemes.has(th.ThemeID)
                return (
                  <button
                    key={th.ThemeID}
                    onContextMenu={(e) => { e.preventDefault(); toggleRemoveTheme(th.ThemeID) }}
                    onClick={() => toggleTheme(th.ThemeID)}
                    style={{
                      padding: '4px 10px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                      border: `1px solid ${isAdd ? 'var(--sage)' : isRemove ? '#c0392b' : 'var(--bd)'}`,
                      background: isAdd ? 'rgba(100,180,100,0.12)' : isRemove ? 'rgba(192,57,43,0.12)' : 'transparent',
                      color: isAdd ? 'var(--sage)' : isRemove ? '#e74c3c' : 'var(--tx3)',
                    }}
                  >
                    {isAdd ? '+ ' : isRemove ? '− ' : ''}{th.Nom}
                  </button>
                )
              })}
            </div>
            {(addThemes.size > 0 || removeThemes.size > 0) && (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 6 }}>
                {addThemes.size > 0 && `Ajouter : ${[...addThemes].map(id => themes.find(t => t.ThemeID === id)?.Nom).join(', ')}`}
                {addThemes.size > 0 && removeThemes.size > 0 && ' · '}
                {removeThemes.size > 0 && `Retirer : ${[...removeThemes].map(id => themes.find(t => t.ThemeID === id)?.Nom).join(', ')}`}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Section: Attributs ───────────────────────────────────── */}
      <SectionLabel>Attributs</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        <TriField label="Exposable"   value={exposable}    onChange={setExposable}   />
        <TriField label="Montée"      value={montee}       onChange={setMontee}      />
        <TriField label="Encadrée"    value={encadree}     onChange={setEncadree}    />
        <TriField label="Cataloguée"  value={catalogued}   onChange={setCatalogued}  />
        <TriField label="Publique"    value={isPublic}     onChange={setIsPublic}    />
        <TriField label="Commission"  value={isCommission} onChange={setIsCommission}/>
      </div>

      {!changed && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
          Modifiez au moins un champ pour appliquer.
        </div>
      )}

      {error && <div className="t-mono-sm" style={{ color: '#c0392b', marginTop: 12 }}>{error}</div>}

      <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={!changed || pending} onClick={handleSubmit}>
          {pending ? 'Modification…' : `Appliquer aux ${ids.length} œuvre${ids.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </Overlay>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="t-label" style={{ marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid var(--bd)', color: 'var(--tx3)' }}>
      {children}
    </div>
  )
}

function FieldWrap({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="t-label" style={{
        display: 'block', marginBottom: 6,
        color: active ? 'var(--ac)' : undefined,
      }}>
        {label}{active ? ' ·' : ''}
      </label>
      {children}
    </div>
  )
}

function TriField({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  return (
    <div style={{
      padding: '8px 10px', border: `1px solid ${value !== null ? 'var(--ac)' : 'var(--bd)'}`,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}
      onClick={() => onChange(value === null ? true : value === true ? false : null)}
    >
      <span className="t-mono-sm" style={{ color: value !== null ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
      <span className="t-mono-sm" style={{ color: value === true ? 'var(--sage)' : value === false ? '#c0392b' : 'var(--tx3)' }}>
        {value === null ? '—' : value ? 'Oui' : 'Non'}
      </span>
    </div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 32, width: 620, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
