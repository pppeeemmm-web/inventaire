'use client'

// BatchEditModal — edit multiple fields across a work selection at once.
// Only fields explicitly set by the user are updated; others are untouched.

import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { batchEdit, createTheme, type BatchChanges } from '@/app/atelier/selection/actions'

type ContactAddress = { id?: number; contact_id: number; label: string; adresse: string | null; ville: string | null; pays: string | null }

interface Props {
  ids:            number[]
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  addresses?:     ContactAddress[]
  themes:         { id: number; name: string }[]
  groups?:        { id: string; name: string }[]
  statusLabelMap: Record<number, string>
  onClose:        () => void
  onDone:         (count: number) => void
}

// Tri-state for boolean fields: null = unchanged, true/false = set
type Tri = null | boolean

export function BatchEditModal({ ids, techniques, supports, formats, contacts, addresses = [], themes: initialThemes, groups = [], statusLabelMap, onClose, onDone }: Props) {
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
      cycleTheme(res.theme.id)
      setNewThemeName('')
    } else if (res.error) {
      setError(res.error)
    }
    setCreatingTheme(false)
  }

  // Scalar fields — empty string = unchanged
  const [titre,            setTitre]           = useState('')
  const [statusId,         setStatusId]        = useState('')
  const [technique,        setTechnique]       = useState('')
  const [support,          setSupport]         = useState('')
  const [format,           setFormat]          = useState('')
  const [contactId,        setContactId]       = useState('')
  const [prix,             setPrix]            = useState('')
  const [discount,         setDiscount]        = useState('')
  const [annee,            setAnnee]           = useState('')
  const [localisationId,   setLocalisationId]  = useState('')
  const [addressId,        setAddressId]       = useState('')
  const [locDetail,        setLocDetail]       = useState('')
  const [commentaires,     setCommentaires]    = useState('')
  const [historiqueAppend, setHistoriqueAppend] = useState('')

  // Boolean fields — null = unchanged
  const [exposable,    setExposable]    = useState<Tri>(null)
  const [montee,       setMontee]       = useState<Tri>(null)
  const [encadree,     setEncadree]     = useState<Tri>(null)
  const [catalogued,   setCatalogued]   = useState<Tri>(null)
  const [isCommission, setIsCommission] = useState<Tri>(null)
  const [isGift,       setIsGift]       = useState<Tri>(null)
  const [isPaid,       setIsPaid]       = useState<Tri>(null)
  const [needsPhoto,   setNeedsPhoto]   = useState<Tri>(null)
  const [broadcastReady, setBroadcastReady] = useState<Tri>(null)

  // Theme junction — sets of IDs to add or remove
  const [addThemes,    setAddThemes]    = useState<Set<number>>(new Set())
  const [removeThemes, setRemoveThemes] = useState<Set<number>>(new Set())
  const [themeFilter,  setThemeFilter]  = useState('')

  // Group junction
  const [addGroups,    setAddGroups]    = useState<Set<string>>(new Set())
  const [removeGroups, setRemoveGroups] = useState<Set<string>>(new Set())
  const [groupFilter,  setGroupFilter]  = useState('')

  // Single click cycles: neutral → add → remove → neutral
  function cycleTheme(id: number) {
    if (addThemes.has(id)) {
      setAddThemes(prev => { const n = new Set(prev); n.delete(id); return n })
      setRemoveThemes(prev => { const n = new Set(prev); n.add(id); return n })
    } else if (removeThemes.has(id)) {
      setRemoveThemes(prev => { const n = new Set(prev); n.delete(id); return n })
    } else {
      setAddThemes(prev => { const n = new Set(prev); n.add(id); return n })
    }
  }

  function cycleGroup(id: string) {
    if (addGroups.has(id)) {
      setAddGroups(prev => { const n = new Set(prev); n.delete(id); return n })
      setRemoveGroups(prev => { const n = new Set(prev); n.add(id); return n })
    } else if (removeGroups.has(id)) {
      setRemoveGroups(prev => { const n = new Set(prev); n.delete(id); return n })
    } else {
      setAddGroups(prev => { const n = new Set(prev); n.add(id); return n })
    }
  }

  const contactAddresses = (localisationId !== '' && localisationId !== 'null')
    ? addresses.filter(a => a.contact_id === Number(localisationId))
    : []

  function handleLocalisationChange(id: string) {
    setLocalisationId(id)
    setAddressId('')
    if (id !== '' && id !== 'null') {
      const addrs = addresses.filter(a => a.contact_id === Number(id))
      if (addrs.length === 1) setLocDetail(`${addrs[0].label}${addrs[0].ville ? ` — ${addrs[0].ville}` : ''}`)
      else setLocDetail('')
    } else {
      setLocDetail('')
    }
  }

  const changed = (
    titre !== '' || statusId !== '' || technique !== '' || support !== '' || format !== '' ||
    contactId !== '' || localisationId !== '' || prix !== '' || discount !== '' ||
    annee !== '' || locDetail !== '' || commentaires !== '' ||
    exposable !== null || montee !== null || encadree !== null || catalogued !== null ||
    isCommission !== null || isGift !== null || isPaid !== null || needsPhoto !== null ||
    broadcastReady !== null ||
    addThemes.size > 0 || removeThemes.size > 0 ||
    addGroups.size > 0 || removeGroups.size > 0 ||
    historiqueAppend !== ''
  )

  function handleSubmit() {
    const changes: BatchChanges = {}
    if (titre      !== '')  changes.Titre      = titre.trim() || null
    if (statusId   !== '')  changes.statusId   = statusId   === 'null' ? null : Number(statusId)
    if (technique  !== '')  changes.Technique  = technique  === 'null' ? null : Number(technique)
    if (support    !== '')  changes.Support    = support    === 'null' ? null : Number(support)
    if (format     !== '')  changes.Format     = format     === 'null' ? null : Number(format)
    if (contactId      !== '')  changes.ContactID      = contactId      === 'null' ? null : Number(contactId)
    if (localisationId !== '')  changes.LocalisationID = localisationId === 'null' ? null : Number(localisationId)
    if (prix       !== '')  changes.Prix       = prix       === ''     ? null : parseFloat(prix)
    if (discount   !== '')  changes.Discount   = discount   === ''     ? null : parseFloat(discount)
    if (annee      !== '')  changes.Année      = annee.trim() || null
    if (locDetail  !== '')  changes.LocalisationDetail = locDetail.trim() || null
    if (commentaires !== '') changes.Commentaires = commentaires.trim() || null

    if (exposable    !== null) changes.Exposable      = exposable
    if (montee       !== null) changes.Montee         = montee
    if (encadree     !== null) changes.Encadree       = encadree
    if (catalogued   !== null) changes['Catalogué']   = catalogued
    if (isCommission !== null) changes.IsCommission   = isCommission
    if (isGift       !== null) changes.is_gift        = isGift
    if (isPaid       !== null) changes.is_paid        = isPaid
    if (needsPhoto   !== null) changes.NeedsPhotograph = needsPhoto
    if (broadcastReady !== null) changes.broadcast_ready = broadcastReady

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
        window.location.href = window.location.pathname + '?batch=success'
      } catch (e) {
        setError(String(e))
      }
    })
  }

  const contactLabel = (c: Props['contacts'][0]) =>
    c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`

  // All dropdowns sorted alphabetically
  const sortedStatuses   = Object.entries(statusLabelMap)
    .map(([id, label]) => ({ id: Number(id), label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const sortedTechniques = [...techniques].sort((a, b) => (a.Technique ?? '').localeCompare(b.Technique ?? ''))
  const sortedSupports   = [...supports].sort((a, b) => (a.Support ?? '').localeCompare(b.Support ?? ''))
  const sortedFormats    = [...formats].sort((a, b) => (a.Format ?? '').localeCompare(b.Format ?? ''))
  const sortedContacts   = [...contacts].sort((a, b) => contactLabel(a).localeCompare(contactLabel(b)))

  const filteredThemes = localThemes
    .filter(th => th.name.toLowerCase().includes(themeFilter.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const filteredGroups = groups
    .filter(g => g.name.toLowerCase().includes(groupFilter.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <PemModalOverlay
      onClose={onClose}
      panelStyle={{ padding: 32, width: 620, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}
    >
      <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('batchEdit')}</div>
      <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 24 }}>
        {ids.length} {t('works')}
        {' · '}{t('onlyChangedUpdated')}
      </div>

      {/* ── Section: Classification ─────────────────────────────── */}
      <SectionLabel>{t('batch_edit_section_classification')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>

        <FieldWrap label={t('title')} active={titre !== ''} style={{ gridColumn: 'span 2' }}>
          <input className="input" type="text" style={{ width: '100%' }}
            placeholder={`${t('unchanged')} (ex. Sans titre)`} value={titre}
            onChange={(e) => setTitre(e.target.value)} />
        </FieldWrap>

        <FieldWrap label={t('status')} active={statusId !== ''}>
          <select className="input" style={{ width: '100%' }} value={statusId}
            onChange={(e) => setStatusId(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('removeStatus')}</option>
            {sortedStatuses.map(({ id, label }) => (
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
            {sortedTechniques.map((tech) => (
              <option key={tech.TechniqueID} value={tech.TechniqueID}>{tech.Technique}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label={t('support')} active={support !== ''}>
          <select className="input" style={{ width: '100%' }} value={support}
            onChange={(e) => setSupport(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')}</option>
            {sortedSupports.map((s) => (
              <option key={s.SupportID} value={s.SupportID}>{s.Support}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label="Format" active={format !== ''}>
          <select className="input" style={{ width: '100%' }} value={format}
            onChange={(e) => setFormat(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')}</option>
            {sortedFormats.map((f) => (
              <option key={f.FormatID} value={f.FormatID}>{f.Format}</option>
            ))}
          </select>
        </FieldWrap>

        <FieldWrap label={t('contact')} active={contactId !== ''} style={{ gridColumn: 'span 2' }}>
          <select className="input" style={{ width: '100%' }} value={contactId}
            onChange={(e) => setContactId(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')}</option>
            {sortedContacts.map((c) => (
              <option key={c.ContactID} value={c.ContactID}>{contactLabel(c)}</option>
            ))}
          </select>
        </FieldWrap>

      </div>

      {/* ── Section: Prix ────────────────────────────────────────── */}
      <SectionLabel>{t('price')}</SectionLabel>
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

      {/* ── Section: Localisation & Notes ────────────────────────── */}
      <SectionLabel>{t('locationNotes')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: 20 }}>

        <FieldWrap label={t('location')} active={localisationId !== ''}>
          <select className="input" style={{ width: '100%' }} value={localisationId}
            onChange={(e) => handleLocalisationChange(e.target.value)}>
            <option value="">— {t('unchanged')} —</option>
            <option value="null">{t('remove')} (Pem — Atelier)</option>
            {sortedContacts.map((c) => (
              <option key={c.ContactID} value={c.ContactID}>{contactLabel(c)}</option>
            ))}
          </select>
        </FieldWrap>

        {contactAddresses.length >= 2 && (
          <FieldWrap label="Adresse" active={addressId !== ''}>
            <select className="input" style={{ width: '100%' }} value={addressId}
              onChange={(e) => {
                const id = e.target.value
                setAddressId(id)
                if (id !== '') {
                  const a = contactAddresses.find(a => String(a.id) === id)
                  if (a) setLocDetail(`${a.label}${a.ville ? ` — ${a.ville}` : ''}`)
                }
              }}>
              <option value="">— {t('unchanged')} —</option>
              {contactAddresses.map(a => (
                <option key={a.id} value={a.id}>
                  {a.label}{a.ville ? ` — ${a.ville}` : ''}
                </option>
              ))}
            </select>
          </FieldWrap>
        )}

        <FieldWrap label={t('localisationDetail')} active={locDetail !== ''}>
          <input className="input" type="text" style={{ width: '100%' }}
            placeholder={`${t('unchanged')} (ex. Réserve B, caisse 3)`} value={locDetail}
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
            <SectionLabel style={{ marginBottom: 0 }}>{t('themesSection')}</SectionLabel>

            <div className="row gap-sm" style={{ flex: 1, justifyContent: 'flex-end' }}>
              <input
                className="input sm"
                placeholder={t('newTheme')}
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
              const isAdd    = addThemes.has(th.id)
              const isRemove = removeThemes.has(th.id)
              return (
                <button
                  key={th.id}
                  onClick={() => cycleTheme(th.id)}
                  style={{
                    padding: '4px 10px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                    border: `1px solid ${isAdd ? 'var(--sage)' : isRemove ? '#c0392b' : 'var(--bd)'}`,
                    background: isAdd ? 'rgba(100,180,100,0.12)' : isRemove ? 'rgba(192,57,43,0.12)' : 'transparent',
                    color: isAdd ? 'var(--sage)' : isRemove ? '#e74c3c' : 'var(--tx3)',
                  }}
                >
                  {isAdd ? '+ ' : isRemove ? '− ' : ''}{th.name}
                </button>
              )
            })}
            {filteredThemes.length === 0 && (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', width: '100%', textAlign: 'center', padding: 20 }}>
                {t('empty')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section: Groupes de travail ───────────────────────────── */}
      {groups.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <SectionLabel style={{ marginBottom: 0 }}>{t('workingGroups')}</SectionLabel>
            <input
              className="input sm"
              placeholder={`${t('search')}...`}
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              style={{ width: 140, fontSize: 10, padding: '3px 8px' }}
            />
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 12 }}>
            {t('themesBatchHelp')}
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
                  onClick={() => cycleGroup(g.id)}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <TriField label={t('needsPhoto')}  value={needsPhoto}   onChange={setNeedsPhoto}   t={t as any} />
        <TriField label={t('catalogued')}  value={catalogued}   onChange={setCatalogued}   t={t as any} />
        <TriField label={t('exposable')}   value={exposable}    onChange={setExposable}    t={t as any} />
        <TriField label={t('montee')}      value={montee}       onChange={setMontee}       t={t as any} />
        <TriField label={t('framed')}      value={encadree}     onChange={setEncadree}     t={t as any} />
        <TriField label={t('commission')}  value={isCommission} onChange={setIsCommission} t={t as any} />
        <TriField label={t('gift')}        value={isGift}       onChange={setIsGift}       t={t as any} />
        <TriField label={t('paid')}        value={isPaid}       onChange={setIsPaid}       t={t as any} />
        <TriField
          label={t('wf_broadcast_ready')}
          value={broadcastReady}
          onChange={setBroadcastReady}
          t={t as any}
          testId="batch-broadcast-ready-tri"
        />
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
    </PemModalOverlay>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="t-label" style={{ marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid var(--bd)', color: 'var(--tx3)', ...style }}>
      {children}
    </div>
  )
}

function FieldWrap({ label, active, children, style }: { label: string; active: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
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

function TriField({ label, value, onChange, t, testId }: { label: string; value: Tri; onChange: (v: Tri) => void; t: (k: string) => string; testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{
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

