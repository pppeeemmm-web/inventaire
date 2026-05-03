'use client'

// BatchEditModal — edit multiple fields across a work selection at once.
// Only fields explicitly set by the user are updated; others are untouched.

import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { batchEdit, createTheme, type BatchChanges } from '@/app/atelier/selection/actions'

interface Props {
  ids:            number[]
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  themes:         { ThemeID: number; Nom: string }[]
  groups?:        { id: string; name: string }[]
  statusLabelMap: Record<number, string>
  onClose:        () => void
  onDone:         (count: number) => void
}

// Tri-state for boolean fields: null = unchanged, true/false = set
type Tri = null | boolean

export function BatchEditModal({ ids, techniques, supports, formats, contacts, themes: initialThemes, groups = [], statusLabelMap, onClose, onDone }: Props) {
  const { t } = useI18n()
  const [pending, startEdit] = useTransition()
  const [error,   setError]  = useState<string | null>(null)

  // Local themes to support on-the-fly creation
  const [localThemes, setLocalThemes] = useState(initialThemes)
  const [newThemeName, setNewThemeName] = useState('')
  const [creatingTheme, setCreatingTheme] = useState(false)

  async function handleCreateTheme() {
    const name = newThemeName.trim()
    if (!name) return
    setCreatingTheme(true)
    const res = await createTheme(name)
    if (res.theme) {
      setLocalThemes(prev => [...prev, res.theme!])
      toggleTheme(res.theme.ThemeID)
      setNewThemeName('')
    } else if (res.error) {
      setError(res.error)
    }
    setCreatingTheme(false)
  }

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
  const [stageProduction,   setStageProduction]  = useState('')
  const [commentaires,      setCommentaires]     = useState('')
  const [historiqueAppend,  setHistoriqueAppend]  = useState('')

  // Boolean fields — null = unchanged
  const [exposable,    setExposable]    = useState<Tri>(null)
  const [montee,       setMontee]       = useState<Tri>(null)
  const [encadree,     setEncadree]     = useState<Tri>(null)
  const [catalogued,   setCatalogued]   = useState<Tri>(null)
  const [isPublic,     setIsPublic]     = useState<Tri>(null)
  const [isCommission, setIsCommission] = useState<Tri>(null)
  const [isGift,       setIsGift]       = useState<Tri>(null)
  const [isPaid,       setIsPaid]       = useState<Tri>(null)
  const [needsPhoto,   setNeedsPhoto]   = useState<Tri>(null)

  // Theme junction — sets of IDs to add or remove
  const [addThemes,    setAddThemes]    = useState<Set<number>>(new Set())
  const [removeThemes, setRemoveThemes] = useState<Set<number>>(new Set())
  const [themeFilter,  setThemeFilter]  = useState('')

  // Group junction
  const [addGroups,    setAddGroups]    = useState<Set<string>>(new Set())
  const [removeGroups, setRemoveGroups] = useState<Set<string>>(new Set())
  const [groupFilter,  setGroupFilter]  = useState('')

  function toggleTheme(id: number) {
    setAddThemes(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
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

  function toggleGroup(id: string) {
    setAddGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
      setRemoveGroups(r => { const nr = new Set(r); nr.delete(id); return nr })
      return next
    })
  }
  function toggleRemoveGroup(id: string) {
    setRemoveGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
      setAddGroups(a => { const na = new Set(a); na.delete(id); return na })
      return next
    })
  }

  const changed = (
    statusId !== '' || technique !== '' || support !== '' || format !== '' ||
    contactId !== '' || prix !== '' || discount !== '' || stageProduction !== '' ||
    annee !== '' || locDetail !== '' || commentaires !== '' ||
    exposable !== null || montee !== null || encadree !== null || catalogued !== null ||
    isPublic !== null || isCommission !== null || isGift !== null || isPaid !== null || needsPhoto !== null ||
    addThemes.size > 0 || removeThemes.size > 0 ||
    addGroups.size > 0 || removeGroups.size > 0 ||
    historiqueAppend !== ''
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
    if (stageProduction !== '') changes.StageProduction = stageProduction === 'null' ? null : stageProduction
    if (locDetail  !== '')  changes.LocalisationDetail = locDetail.trim() || null
    if (commentaires !== '') changes.Commentaires = commentaires.trim() || null
    
    // For batch historique, we can't really "replace" it easily, but we can have an "append" logic if we wanted.
    // However, the batchEdit action doesn't support "append" yet. 
    // I will add a simple logic here if I can, or just keep it simple.
    // Let's assume for now we don't batch edit historique to avoid data loss.

    if (exposable    !== null) changes.Exposable    = exposable
    if (montee       !== null) changes.Montee       = montee
    if (encadree     !== null) changes.Encadree     = encadree
    if (catalogued   !== null) changes['Catalogué'] = catalogued
    if (isPublic     !== null) changes.is_public    = isPublic
    if (isCommission !== null) changes.IsCommission = isCommission
    if (isGift       !== null) changes.is_gift       = isGift
    if (isPaid       !== null) changes.is_paid       = isPaid
    if (needsPhoto   !== null) changes.NeedsPhotograph = needsPhoto
    
    if (addThemes.size    > 0) changes.addThemeIds    = [...addThemes]
    if (removeThemes.size > 0) changes.removeThemeIds = [...removeThemes]
    if (addGroups.size    > 0) changes.addGroupIds    = [...addGroups]
    if (removeGroups.size > 0) changes.removeGroupIds = [...removeGroups]

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
        // Refresh server data and show success toast via URL param
        window.location.href = window.location.pathname + '?batch=success'
      } catch (e) {
        setError(String(e))
      }
    })
  }

  const statuses = Object.entries(statusLabelMap).map(([id, label]) => ({ id: Number(id), label }))

  const contactLabel = (c: Props['contacts'][0]) =>
    c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`

  const filteredThemes = localThemes
    .filter(th => th.Nom.toLowerCase().includes(themeFilter.toLowerCase()))
    .sort((a, b) => a.Nom.localeCompare(b.Nom))
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(groupFilter.toLowerCase()))

  return (
    <Overlay onClose={onClose}>
      <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('batchEdit')}</div>
      <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 24 }}>
        {ids.length} {t('works')}
        {' · '}{t('onlyChangedUpdated')}
      </div>

      {/* ── Section: Classification ─────────────────────────────── */}
      <SectionLabel>Classification</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>

        <FieldWrap label={t('status')} active={statusId !== ''}>
          <select className="input" style={{ width: '100%' }} value={statusId}
            onChange={(e) => setStatusId(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('removeStatus')}</option>
            {statuses.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label={t('year')} active={annee !== ''}>
          <input className="input" type="text" style={{ width: '100%' }}
            placeholder={`${t('unchanged')} (ex. 2024)`} value={annee}
            onChange={(e) => setAnnee(e.target.value)} />
        </FieldWrap>

        <FieldWrap label={t('technique')} active={technique !== ''}>
          <select className="input" style={{ width: '100%' }} value={technique}
            onChange={(e) => setTechnique(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')}</option>
            {techniques.map((t) => (
              <option key={t.TechniqueID} value={t.TechniqueID}>{t.Technique}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label={t('support')} active={support !== ''}>
          <select className="input" style={{ width: '100%' }} value={support}
            onChange={(e) => setSupport(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')}</option>
            {supports.map((s) => (
              <option key={s.SupportID} value={s.SupportID}>{s.Support}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label="Format" active={format !== ''}>
          <select className="input" style={{ width: '100%' }} value={format}
            onChange={(e) => setFormat(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')}</option>
            {formats.map((f) => (
              <option key={f.FormatID} value={f.FormatID}>{f.Format}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label={t('contact')} active={contactId !== ''}>
          <select className="input" style={{ width: '100%' }} value={contactId}
            onChange={(e) => setContactId(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')}</option>
            {contacts.map((c) => (
              <option key={c.ContactID} value={c.ContactID}>{contactLabel(c)}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label="Stage Production" active={stageProduction !== ''}>
          <select className="input" style={{ width: '100%' }} value={stageProduction}
            onChange={(e) => setStageProduction(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="wip">Production (WIP)</option>
            <option value="catalogued">Catalogué</option>
            <option value="shot">Shot / Photo</option>
            <option value="available">Disponible (Available)</option>
            <option value="archive">Archive</option>
          </select>
        </FieldWrap>

      </div>

      {/* ── Section: Prix ────────────────────────────────────────── */}
      <SectionLabel>Prix</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>

        <FieldWrap label={`${t('price')} (€)`} active={prix !== ''}>
          <input className="input" type="number" style={{ width: '100%' }}
            placeholder={t('unchanged')} value={prix}
            onChange={(e) => setPrix(e.target.value)} />
        </FieldWrap>

        <FieldWrap label={`${t('discount')} (%)`} active={discount !== ''}>
          <input className="input" type="number" style={{ width: '100%' }}
            placeholder={t('unchanged')} value={discount} min={0} max={100}
            onChange={(e) => setDiscount(e.target.value)} />
        </FieldWrap>

      </div>

      {/* ── Section: Custodian & notes ────────────────────────── */}
      <SectionLabel>{t('location')} & {t('notes')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: 20 }}>

        <FieldWrap label={`${t('location')} (City, Venue…)`} active={locDetail !== ''}>
          <input className="input" type="text" style={{ width: '100%' }}
            placeholder={`${t('unchanged')} (ex. Marseille, France)`} value={locDetail}
            onChange={(e) => setLocDetail(e.target.value)} />
        </FieldWrap>

        <FieldWrap label={t('notes')} active={commentaires !== ''}>
          <textarea className="input" style={{ width: '100%', minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder={t('notesBatchPlaceholder')}
            value={commentaires}
            onChange={(e) => setCommentaires(e.target.value)} />
        </FieldWrap>

      </div>

      {/* ── Section: Thèmes ──────────────────────────────────────── */}
      {localThemes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12 }}>
            <SectionLabel style={{ margin: 0 }}>{t('themes')}</SectionLabel>
            
            <div className="row gap-sm" style={{ flex: 1, justifyContent: 'flex-end' }}>
              <input 
                className="input sm" 
                placeholder="Nouveau thème..." 
                value={newThemeName}
                onChange={e => setNewThemeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateTheme()}
                style={{ width: 120, fontSize: 10, padding: '3px 8px' }}
              />
              <button 
                className="btn sm primary" 
                onClick={handleCreateTheme} 
                disabled={creatingTheme || !newThemeName.trim()}
                style={{ fontSize: 9, padding: '3px 8px' }}
              >
                {creatingTheme ? '…' : '+'}
              </button>
              
              <div className="vline" style={{ height: 16 }} />

              <input 
                className="input sm" 
                placeholder={`${t('search')}...`} 
                value={themeFilter}
                onChange={e => setThemeFilter(e.target.value)}
                style={{ width: 100, fontSize: 10, padding: '3px 8px' }}
              />
            </div>
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 12 }}>
            {t('themesBatchHelp')}
          </div>
          <div style={{ 
            display: 'flex', flexWrap: 'wrap', gap: 6, 
            maxHeight: 180, overflowY: 'auto', padding: '12px',
            background: 'var(--bg2)', border: '1px solid var(--bd)'
          }}>
            {filteredThemes.map(th => {
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
            {filteredThemes.length === 0 && (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', width: '100%', textAlign: 'center', padding: 20 }}>
                Aucun thème correspondant
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section: Groupes ─────────────────────────────────────── */}
      {groups.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <SectionLabel style={{ margin: 0 }}>Groupes de travail</SectionLabel>
            <input 
              className="input sm" 
              placeholder={`${t('search')}...`} 
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              style={{ width: 140, fontSize: 10, padding: '3px 8px' }}
            />
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 12 }}>
            Clic gauche pour ajouter à un groupe, clic droit pour retirer.
          </div>
          <div style={{ 
            display: 'flex', flexWrap: 'wrap', gap: 6, 
            maxHeight: 120, overflowY: 'auto', padding: '12px',
            background: 'var(--bg2)', border: '1px solid var(--bd)'
          }}>
            {filteredGroups.map(g => {
              const isAdd    = addGroups.has(g.id)
              const isRemove = removeGroups.has(g.id)
              return (
                <button
                  key={g.id}
                  onContextMenu={(e) => { e.preventDefault(); toggleRemoveGroup(g.id) }}
                  onClick={() => toggleGroup(g.id)}
                  style={{
                    padding: '4px 10px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                    border: `1px solid ${isAdd ? 'var(--ac)' : isRemove ? '#c0392b' : 'var(--bd)'}`,
                    background: isAdd ? 'rgba(200,168,110,0.12)' : isRemove ? 'rgba(192,57,43,0.12)' : 'transparent',
                    color: isAdd ? 'var(--ac)' : isRemove ? '#e74c3c' : 'var(--tx3)',
                  }}
                >
                  {isAdd ? '+ ' : isRemove ? '− ' : ''}{g.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {/* ── Section: Attributs ───────────────────────────────────── */}
      <SectionLabel>{t('attributes')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        <TriField label={t('exposable')}   value={exposable}    onChange={setExposable}   t={t as any} />
        <TriField label={t('montee')}      value={montee}       onChange={setMontee}      t={t as any} />
        <TriField label={t('framed')}      value={encadree}     onChange={setEncadree}    t={t as any} />
        <TriField label={t('catalogued')}  value={catalogued}   onChange={setCatalogued}  t={t as any} />
        <TriField label={t('public')}      value={isPublic}     onChange={setIsPublic}    t={t as any} />
        <TriField label={t('commission')}  value={isCommission} onChange={setIsCommission} t={t as any} />
        <TriField label="Cadeau (Gift)"    value={isGift}       onChange={setIsGift}       t={t as any} />
        <TriField label="Payé (Paid)"      value={isPaid}       onChange={setIsPaid}       t={t as any} />
        <TriField label="Photo à faire"    value={needsPhoto}   onChange={setNeedsPhoto}   t={t as any} />
      </div>

      {!changed && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
          {t('modifyAtLeastOne')}
        </div>
      )}

      {error && <div className="t-mono-sm" style={{ color: '#c0392b', marginTop: 12 }}>{error}</div>}

      <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn ghost" onClick={onClose}>{t('cancel')}</button>
        <button className="btn primary" disabled={!changed || pending} onClick={handleSubmit}>
          {pending ? `${t('modifying')}…` : `${t('applyTo')} ${ids.length} ${t('works')}`}
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

function TriField({ label, value, onChange, t }: { label: string; value: Tri; onChange: (v: Tri) => void; t: (k: string) => string }) {
  return (
    <div style={{
      padding: '8px 10px', border: `1px solid ${value !== null ? 'var(--ac)' : 'var(--bd)'}`,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: value === true ? 'rgba(100,180,100,0.05)' : value === false ? 'rgba(192,57,43,0.05)' : 'transparent'
    }}
      onClick={() => onChange(value === null ? true : value === true ? false : null)}
    >
      <span className="t-mono-sm" style={{ color: value !== null ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
      <span className="t-mono-sm" style={{ color: value === true ? 'var(--sage)' : value === false ? '#c0392b' : 'var(--tx3)' }}>
        {value === null ? '—' : value ? t('yes') : t('no')}
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
