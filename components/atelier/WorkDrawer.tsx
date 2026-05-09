'use client'

// WorkDrawer — 460 px right-rail overlay for full work detail.
// Shown from any tab when a work FIS "opened" (double-click / Details button).

import { imageUrl, thumbUrl, yearOf, statusOf } from '@/lib/data'
import { StatusChip } from '@/components/ui/StatusChip'
import { deleteWork } from '@/app/atelier/works/actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { saveWork, createLookup } from '@/app/atelier/works/actions'
import type { Oeuvre } from '@/lib/types/database'
import { WorkStateChip } from './WorkStateChip'
import { WorkThumb } from './WorkThumb'

interface Props {
  o:               Oeuvre
  tM:              Record<number, string>   // technique map      id → label
  sM:              Record<number, string>   // support map        id → label
  cM:              Record<number, string>   // contact map        id → label
  pM:              Record<number, string>   // presentation map   id → label
  statusLabelMap:  Record<number, string>   // OeuvreStatus       id → label
  selection:       Set<number>
  setSelection:    (s: Set<number>) => void
  onClose:         () => void
  // Curation maps
  thM:             Record<number, string>   // themeID → name
  oeuvreThemeMap:  Map<number, number[]>    // workID → themeIDs
  oeuvreGroupMap:  Map<number, string[]>    // workID → groupIDs
  groupNameMap:    Record<string, string>   // groupID → name
  // Reference data for editing
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  themes:         { ThemeID:     number; Nom:       string }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  groups:         { id: string; name: string }[]
  presentations:  { PresentationID: number; Nom: string | null }[]
}

interface ActionType { id: number; label: string; color: string; field_key: string | null }
interface WorkAction { action_type_id: number; done: boolean }

export function WorkDrawer({ 
  o, tM, sM, cM, pM, statusLabelMap, selection, setSelection, onClose,
  thM, oeuvreThemeMap, oeuvreGroupMap, groupNameMap,
  techniques: initialTechniques, supports: initialSupports, formats: initialFormats,
  themes: initialThemes, contacts: initialContacts, groups: initialGroups,
  presentations: initialPresentations
}: Props) {
  const { t }  = useI18n()
  const router = useRouter()
  const isSel  = selection.has(o.OeuvreID)
  const st     = statusOf(o, statusLabelMap)
  const isSold = st === 'sold'
  const isLoan = st === 'loan' || st === 'consigned'

  // ── Inline Editing State ────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving,  startSave]    = useTransition()

  // Form states
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

  // Sync when work changes
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
    
    setIsEditing(false)
  }, [o.OeuvreID, oeuvreThemeMap, oeuvreGroupMap, o])

  // Lookups
  const [localTechniques, setLocalTechniques] = useState(initialTechniques)
  const [localSupports,   setLocalSupports]   = useState(initialSupports)
  const [localFormats,    setLocalFormats]    = useState(initialFormats)

  async function saveLookup(table: string, name: string) {
    if (!name) return
    const res = await createLookup(table, cap(name))
    if ('error' in res) { alert('Erreur : ' + res.error); return }
    if (table === 'Technique') { setLocalTechniques(p => [...p, { TechniqueID: res.id, Technique: cap(name) }]); setTechniqueId(String(res.id)) }
    else if (table === 'Support') { setLocalSupports(p => [...p, { SupportID: res.id, Support: cap(name) }]); setSupportId(String(res.id)) }
    else if (table === 'Format') { setLocalFormats(p => [...p, { FormatID: res.id, Format: cap(name) }]); setFormatId(String(res.id)) }
  }

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
    
    selThemes.forEach(id => fd.append('themes', String(id)))
    selGroups.forEach(id => fd.append('groups', id))

    startSave(async () => {
      const res = await saveWork(fd)
      if ('error' in res) {
        alert(res.error)
      } else {
        setIsEditing(false)
        router.refresh()
      }
    })
  }

  function fmtDate(d: string | null | undefined) {
    if (!d) return null
    try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
  }

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
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  function toggleSel() {
    const next = new Set(selection)
    if (next.has(o.OeuvreID)) next.delete(o.OeuvreID)
    else next.add(o.OeuvreID)
    setSelection(next)
  }

  const dims = o.Hauteur && o.Largeur
    ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm`
    : null

  // ── Pipeline (manual steps) ─────────────────────────────
  const [pipeline,    setPipeline]    = useState<ActionType[]>([])
  const [workActions, setWorkActions] = useState<Record<number, boolean>>({})
  const [loadingPipe, setLoadingPipe] = useState(false)


  const loadPipeline = useCallback(async () => {
    const sb = createClient()
    setLoadingPipe(true)
    const [{ data: types }, { data: acts }] = await Promise.all([
      sb.from('work_action_type').select('id, label, color, field_key').order('sort_order'),
      sb.from('work_action').select('action_type_id, done').eq('oeuvre_id', o.OeuvreID)
    ])
    if (types) setPipeline(types)
    if (acts) {
      const m: Record<number, boolean> = {}
      acts.forEach(a => { m[a.action_type_id] = a.done })
      setWorkActions(m)
    }
    setLoadingPipe(false)
  }, [o.OeuvreID])

  useEffect(() => { loadPipeline() }, [loadPipeline])

  async function toggleAction(type: ActionType) {
    const sb = createClient()
    const isDone = workActions[type.id] ?? false
    const nextDone = !isDone

    // Update local state for instant feedback
    setWorkActions(prev => ({ ...prev, [type.id]: nextDone }))

    // Persist to work_action
    await sb.from('work_action').upsert({
      oeuvre_id: o.OeuvreID,
      action_type_id: type.id,
      done: nextDone,
      done_at: nextDone ? new Date().toISOString() : null
    }, { onConflict: 'oeuvre_id,action_type_id' })

    // If type has a field_key, sync to Oeuvres table
    if (type.field_key) {
      await sb.from('Oeuvres').update({ [type.field_key]: nextDone }).eq('OeuvreID', o.OeuvreID)
    }
    
    router.refresh()
  }

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'transparent',
        zIndex: 60,
        display: 'flex', justifyContent: 'flex-end',
        pointerEvents: 'none'
      }}
    >
      {/* Rail */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, height: '100%',
          background: 'var(--bg1)',
          borderLeft: '1px solid var(--bd)',
          padding: 28,
          overflow: 'auto',
          display: 'flex', flexDirection: 'column',
          pointerEvents: 'auto',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.3)'
        }}
      >
        {/* Header */}
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>Œuvre #{o.OeuvreID}</div>
          <button onClick={onClose} className="btn ghost sm">{t('close')} ×</button>
        </div>

        {/* Image */}
        <div className="thumb" style={{ marginBottom: 20, background: 'var(--bg0)', flexShrink: 0, position: 'relative' }}>
          {o.txtImageNameLink
            ? <WorkThumb file={o.txtImageNameLink} size={1080} alt={o.Titre ?? ''} style={{ height: 'auto', objectFit: 'contain' }} />
            : <div className="ph">—</div>}
        </div>

        {/* Non-public warning */}
        {(o as any).anonymity_level === 2 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(200,140,40,0.12)', border: '1px solid rgba(200,140,40,0.3)',
            padding: '4px 10px', borderRadius: 4, color: '#c88c28', fontSize: 11, marginBottom: 16
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c88c28' }} />
            CONFIDENTIAL / NON-PUBLIC
          </div>
        )}

        {/* Title */}
        {isEditing ? (
          <input
            className="input"
            value={titre}
            onChange={e => setTitre(cap(e.target.value))}
            style={{ ...FIS, fontSize: 24, fontFamily: 'var(--font-serif)', marginBottom: 16, height: 48 }}
            placeholder={t('untitled')}
          />
        ) : (
          <h2 className="serif" style={{ fontSize: 32, color: 'var(--tx)', lineHeight: 1.1, marginBottom: 16 }}>
            {o.Titre || t('untitled')}
          </h2>
        )}

        {/* Metadata Pipes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 28 }}>
          
          {/* Pipe 1: Identity & Physicality */}
          <section>
            <SectionTitle title="Identity & Physicality" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('year')}</div>
              {isEditing ? (
                <input className="input" value={annee} onChange={e => setAnnee(e.target.value)} style={{ ...FIS, height: 32 }} placeholder="YYYY/MM/DD" />
              ) : (
                <div style={{ color: 'var(--tx2)' }}>{yearOf(o.Année) ?? '—'}</div>
              )}

              <div className="t-label">{t('technique')}</div>
              {isEditing ? (
                <CreatableSelect value={techniqueId} options={localTechniques.map(t => ({ id: String(t.TechniqueID), label: t.Technique ?? '' }))} onChange={setTechniqueId} onAdd={name => saveLookup('Technique', name)} />
              ) : (
                <div style={{ color: 'var(--tx2)' }}>{(o.Technique != null && tM[o.Technique]) || '—'}</div>
              )}

              <div className="t-label">{t('support')}</div>
              {isEditing ? (
                <CreatableSelect value={supportId} options={localSupports.map(s => ({ id: String(s.SupportID), label: s.Support ?? '' }))} onChange={setSupportId} onAdd={name => saveLookup('Support', name)} />
              ) : (
                <div style={{ color: 'var(--tx2)' }}>{(o.Support != null && sM[o.Support]) || '—'}</div>
              )}

              <div className="t-label">{t('dimensions')}</div>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input className="input" value={hauteur} onChange={e => setHauteur(e.target.value)} style={{ ...FIS, height: 32 }} placeholder="H" />
                  <span style={{ color: 'var(--tx3)' }}>×</span>
                  <input className="input" value={largeur} onChange={e => setLargeur(e.target.value)} style={{ ...FIS, height: 32 }} placeholder="W" />
                  <span style={{ color: 'var(--tx3)' }}>×</span>
                  <input className="input" value={profondeur} onChange={e => setProfondeur(e.target.value)} style={{ ...FIS, height: 32 }} placeholder="D" />
                </div>
              ) : (
                <div style={{ color: 'var(--tx2)' }}>{dims ?? '—'}</div>
              )}

              <div className="t-label">Presentation</div>
              {isEditing ? (
                <select className="input" value={presentationId} onChange={e => setPresentationId(e.target.value)} style={{ ...FIS, height: 32 }}>
                  <option value="">—</option>
                  {initialPresentations.map(p => <option key={p.PresentationID} value={p.PresentationID}>{p.Nom}</option>)}
                </select>
              ) : (
                <div style={{ color: (o as any).PresentationID != null ? 'var(--tx2)' : 'var(--tx3)' }}>
                  {(o as any).PresentationID != null ? (pM[(o as any).PresentationID] ?? '—') : '—'}
                </div>
              )}

              <div className="t-label">{t('themes')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {isEditing ? (
                  initialThemes.map(th => {
                    const active = selThemes.has(th.ThemeID)
                    return (
                      <button key={th.ThemeID} type="button"
                        onClick={() => setSelThemes(p => { const s = new Set(p); if (s.has(th.ThemeID)) s.delete(th.ThemeID); else s.add(th.ThemeID); return s })}
                        style={{ padding: '2px 8px', fontSize: 10, borderRadius: 2, border: '1px solid var(--bd)', background: active ? 'var(--ac)' : 'var(--bg2)', color: active ? 'var(--bg1)' : 'var(--tx3)' }}>
                        {th.Nom}
                      </button>
                    )
                  })
                ) : (
                  (() => {
                    const ids = oeuvreThemeMap?.get?.(o.OeuvreID) ?? []
                    if (ids.length === 0) return <span style={{ color: 'var(--tx3)' }}>—</span>
                    return ids.map(tid => (
                      <span key={tid} style={{ 
                        fontSize: 11, background: 'var(--bg0)', border: '1px solid var(--bd)', 
                        padding: '3px 10px', color: 'var(--tx2)', borderRadius: 2 
                      }}>
                        {thM[tid] ?? tid}
                      </span>
                    ))
                  })()
                )}
              </div>
            </div>
          </section>

          {/* Pipe 2: Logistics & Ownership */}
          <section>
            <SectionTitle title="Logistics & Ownership" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('contact')}</div>
              {isEditing ? (
                <select className="input" value={contactId} onChange={e => setContactId(e.target.value)} style={{ ...FIS, height: 32 }}>
                  <option value="">—</option>
                  {initialContacts.map(c => (
                    <option key={c.ContactID} value={c.ContactID}>{c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()}</option>
                  ))}
                </select>
              ) : (
                <div style={{ color: 'var(--tx2)' }}>
                  {o.ContactID != null ? (cM[o.ContactID] ?? 'Pem') : 'Pem'}
                </div>
              )}

              <div className="t-label">{t('localisation')}</div>
              {isEditing ? (
                <select className="input" value={locId} onChange={e => setLocId(e.target.value)} style={{ ...FIS, height: 32 }}>
                  <option value="">—</option>
                  {initialContacts.map(c => (
                    <option key={c.ContactID} value={c.ContactID}>{c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()}</option>
                  ))}
                </select>
              ) : (
                <div style={{ color: 'var(--tx2)' }}>
                  {o.LocalisationID != null ? (cM[o.LocalisationID] ?? 'Atelier') : 'Atelier'}
                </div>
              )}

              {isLoan && !isEditing && (
                <>
                  <div className="t-label">Retour prévu</div>
                  <div style={{ color: (o as any).ReturnDate ? 'var(--ac)' : 'var(--tx3)' }}>
                    {fmtDate((o as any).ReturnDate) ?? '—'}
                  </div>
                </>
              )}

              <div className="t-label">{t('workingGroups')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {isEditing ? (
                  initialGroups.map(g => {
                    const active = selGroups.has(g.id)
                    return (
                      <button key={g.id} type="button"
                        onClick={() => setSelGroups(p => { const s = new Set(p); if (s.has(g.id)) s.delete(g.id); else s.add(g.id); return s })}
                        style={{ padding: '2px 8px', fontSize: 10, borderRadius: 2, border: '1px solid var(--bd)', background: active ? 'var(--ac)44' : 'var(--bg2)', color: active ? 'var(--ac)' : 'var(--tx3)' }}>
                        {g.name}
                      </button>
                    )
                  })
                ) : (
                  (() => {
                    const ids = oeuvreGroupMap?.get?.(o.OeuvreID) ?? []
                    if (ids.length === 0) return <span style={{ color: 'var(--tx3)' }}>—</span>
                    return ids.map(gid => (
                      <span key={gid} style={{ 
                        fontSize: 11, background: 'color-mix(in srgb, var(--ac) 10%, var(--bg0))', 
                        border: '1px solid var(--bd)', padding: '3px 10px', color: 'var(--tx)', borderRadius: 2 
                      }}>
                        {groupNameMap[gid] ?? gid}
                      </span>
                    ))
                  })()
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle title="Production & Readiness" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('status')}</div>
              {isEditing ? (
                <select className="input" value={statusId} onChange={e => setStatusId(e.target.value)} style={{ ...FIS, height: 32 }}>
                  {Object.entries(statusLabelMap).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              ) : (
                <div><StatusChip s={st} /></div>
              )}

              <div className="t-label">{t('framed')}</div>
              {isEditing ? (
                <Switch label="Encadrée" checked={encadree} onChange={setEncadree} />
              ) : (
                <div style={{ color: o.Encadree ? 'var(--tx2)' : 'var(--tx3)' }}>{o.Encadree ? '✓' : '—'}</div>
              )}

              <div className="t-label">Exposable</div>
              {isEditing ? (
                <Switch label="Exposable" checked={exposable} onChange={setExposable} />
              ) : (
                <div style={{ color: o.Exposable ? 'var(--sage)' : 'var(--tx3)' }}>
                  {o.Exposable ? '✓' : '—'}
                </div>
              )}
            </div>

            {/* Pipeline Steps inside Production Pipe */}
            {!isEditing && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {pipeline.map(at => {
                  const isDone = workActions[at.id] ?? false
                  return (
                    <div
                      key={at.id}
                      onClick={() => toggleAction(at)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        background: isDone ? 'var(--bg2)' : 'var(--bg0)',
                        border: `1px solid ${isDone ? at.color : 'var(--bd)'}`,
                        cursor: 'pointer', transition: 'all 0.1s ease'
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 2, border: `1px solid ${at.color}`,
                        background: isDone ? at.color : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg0)', fontSize: 11, fontWeight: 700
                      }}>
                        {isDone && '✓'}
                      </div>
                      <span style={{ fontSize: 12, color: isDone ? 'var(--tx)' : 'var(--tx3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {at.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Pipe 4: Financials & Sales */}
          <section>
            <SectionTitle title="Financials & Sales" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('price')}</div>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--tx3)' }}>€</span>
                  <input className="input" value={prix} onChange={e => setPrix(e.target.value)} style={{ ...FIS, height: 32 }} placeholder="Prix de base" />
                </div>
              ) : (
                <div style={{ color: 'var(--tx2)' }}>
                  {(() => {
                    const p = (o as any).PrixFinal ?? o.Prix
                    if (p && p > 0) return `€\u202f${Number(p).toLocaleString('fr-FR')}`
                    return isSold ? '—' : t('priceOnRequest')
                  })()}
                </div>
              )}

              {isEditing ? (
                <>
                  <div className="t-label">Prix Final</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--tx3)' }}>€</span>
                    <input className="input" value={prixFinal} onChange={e => setPrixFinal(e.target.value)} style={{ ...FIS, height: 32 }} placeholder="Prix final" />
                  </div>
                </>
              ) : (
                (o as any).Discount != null && (o as any).Discount > 0 && (
                  <>
                    <div className="t-label">Discount</div>
                    <div style={{ color: 'var(--rust)' }}>{(o as any).Discount}%</div>
                  </>
                )
              )}

              <div className="t-label">{t('commission')}</div>
              <div style={{ color: o.IsCommission ? 'var(--tx2)' : 'var(--tx3)' }}>{o.IsCommission ? '✓' : '—'}</div>

              {o.IsCommission && !isEditing && (
                <>
                  <div className="t-label">Target Delivery</div>
                  <div style={{ color: (o as any).DateLivraison ? 'var(--ac)' : 'var(--tx3)' }}>
                    {fmtDate((o as any).DateLivraison) ?? '—'}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Comments */}
        {o.Commentaires && !isEditing && (
          <div style={{
            fontSize: 13, color: 'var(--tx2)', lineHeight: 1.7,
            padding: '20px 0',
            borderTop: '1px solid var(--bd)',
            marginBottom: 20,
          }}>
            {o.Commentaires}
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div className="row gap-sm">
            <button className={`btn ${isSel ? 'primary' : ''}`} onClick={toggleSel}>
              {isSel ? `✓ ${t('selected')}` : `+ ${t('addToGroup')}`}
            </button>
            
            {isEditing ? (
              <>
                <button className="btn primary" onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? 'Enregistrement…' : 'Sauvegarder'}
                </button>
                <button className="btn ghost" onClick={() => setIsEditing(false)}>
                  Annuler
                </button>
              </>
            ) : (
              <button className="btn ghost" onClick={() => setIsEditing(true)}>
                Éditer
              </button>
            )}

            {!confirmDelete
              ? (
                <button
                  className="btn ghost sm"
                  style={{ marginLeft: 'auto', color: 'var(--tx3)' }}
                  onClick={() => setConfirmDelete(true)}
                >
                  Supprimer
                </button>
              ) : (
                <div className="row gap-sm" style={{ marginLeft: 'auto', alignItems: 'center' }}>
                  <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Confirmer ?</span>
                  <button
                    className="btn ghost sm"
                    style={{ color: '#c0392b' }}
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? '…' : 'Oui, supprimer'}
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                  >
                    Annuler
                  </button>
                </div>
              )
            }
          </div>
          {deleteError && (
            <div className="t-mono-sm" style={{ color: '#c0392b', marginTop: 8 }}>{deleteError}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--tx3)', marginBottom: 16, paddingBottom: 6,
      borderBottom: '1px solid var(--bd2)', display: 'flex', alignItems: 'center', gap: 8
    }}>
      <span style={{ width: 4, height: 4, background: 'var(--ac)' }} />
      {title}
    </div>
  )
}

function Field({ label, children, horizontal = false }: { label: string; children: React.ReactNode; horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="t-label" style={{ fontSize: 11, width: 80, flexShrink: 0 }}>{label}</div>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    )
  }
  return (
    <div style={{ flex: 1 }}>
      <div className="t-label" style={{ marginBottom: 6, fontSize: 11 }}>{label}</div>
      {children}
    </div>
  )
}

function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer', fontSize: 12, opacity: disabled ? 0.5 : 1 }}>
      <div onClick={() => !disabled && onChange(!checked)}
        style={{ width: 14, height: 14, border: '1px solid var(--bd)', background: checked ? 'var(--ac)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg1)', fontSize: 10 }}>
        {checked ? '✓' : ''}
      </div>
      <span style={{ color: checked ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
    </label>
  )
}

function CreatableSelect({ value, options, onChange, onAdd }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; onAdd: (v: string) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [newVal, setNewVal] = useState('')
  if (isAdding) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="input" value={newVal} onChange={e => setNewVal(e.target.value)} style={{ ...FIS, height: 32, padding: '0 8px' }} placeholder="Nouveau…" autoFocus />
        <button type="button" className="btn primary sm" style={{ height: 32, padding: '0 8px' }} onClick={() => { onAdd(newVal); setIsAdding(false); setNewVal('') }}>OK</button>
        <button type="button" className="btn ghost sm" style={{ height: 32, padding: '0 8px' }} onClick={() => setIsAdding(false)}>✕</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select className="input" value={value} onChange={e => onChange(e.target.value)} style={{ ...FIS, height: 32, padding: '0 8px' }}>
        <option value="">—</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <button type="button" className="btn ghost sm" style={{ height: 32, padding: '0 8px' }} onClick={() => setIsAdding(true)}>+</button>
    </div>
  )
}

const FIS: React.CSSProperties = {
  fontSize: 13,
  outline: 'none', width: '100%',
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
