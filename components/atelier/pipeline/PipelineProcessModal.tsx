'use client'

import { useState, useEffect, useMemo, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'
import { createConsignmentOrder } from '@/app/atelier/consignments/actions'
import { createSaleOrder } from '@/app/atelier/(portal)/sales/actions'
import { insertSuiviReminder } from '@/app/atelier/reminders-actions'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { fromSuiviProcess, fromSuiviEtape } from '@/lib/pipeline/suivi-client'
import { toLayoutJson } from '@/lib/exhibitions/exhibition-client'
import {
  DEFAULT_ETAPES,
  SORTED_PROCESS_TYPES,
  useSuiviLabels,
} from '@/components/atelier/pipeline/pipeline-suivi-labels'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import {
  type Etape,
  type EtapeStatut,
  type Process,
  type ProcessStatut,
  type ProcessType,
  type Responsable,
} from '@/components/atelier/pipeline/pipeline-shared'

const FIS: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}

export type PipelineProcessModalProps = {
  oeuvres: Oeuvre[]
  contacts: any[]
  groups: { id: string; name: string }[]
  process: Process | null
  onClose: () => void
  onSaved: () => Promise<void>
  onRemindersMutated?: () => Promise<void>
}

export function PipelineProcessModal({ oeuvres, contacts, groups, process, onClose, onSaved, onRemindersMutated }: {
  oeuvres:     any[]
  contacts:    any[]
  groups:      { id: string; name: string }[]
  process:     any | null
  onClose:     () => void
  onSaved:     () => Promise<void>
  onRemindersMutated?: () => Promise<void>
}) {
  const { typeLabel, t } = useSuiviLabels()
  const isNew = !process
  const [nom,          setNom]          = useState(process?.nom           ?? '')
  const [type,         setType]         = useState<ProcessType>(process?.type as ProcessType ?? 'prix')
  const [debut,        setDebut]        = useState(process?.date_debut    ?? '')
  const [fin,          setFin]          = useState(process?.date_fin      ?? '')
  const [deadlineTime, setDeadlineTime] = useState(process?.deadline_time ?? '')
  const [statut,       setStatut]       = useState<ProcessStatut>(process?.statut ?? 'en_cours')
  const [localisation, setLocalisation] = useState(process?.localisation  ?? '')
  const [url,          setUrl]          = useState(process?.url           ?? '')
  const [scope,        setScope]        = useState(process?.scope         ?? '')
  const [stakeholders, setStakeholders] = useState(process?.stakeholders  ?? '')
  const [responsables, setResponsables] = useState<Responsable[]>(process?.responsables ?? [])
  const [vaultTags,    setVaultTags]    = useState((process?.vault_tags ?? []).join(', '))
  const [vaultPath,    setVaultPath]    = useState(process?.vault_path    ?? '')
  const [assetNotes,   setAssetNotes]   = useState(process?.asset_notes   ?? '')
  const [notes,        setNotes]        = useState(process?.notes         ?? '')
  const [etapes,       setEtapes]       = useState<{ nom:string; date_echeance:string; statut:EtapeStatut }[]>(
    process?.etapes?.map((e: Etape) => ({ nom: e.nom, date_echeance: e.date_echeance ?? '', statut: e.statut })) ??
    DEFAULT_ETAPES['prix'].map(n=>({nom:n, date_echeance:'', statut:'a_faire'}))
  )

  const [oeuvreIds,    setOeuvreIds]    = useState<number[]>(process?.oeuvre_id ? [process.oeuvre_id] : [])
  const [contactId,    setContactId]    = useState<number | null>(process?.contact_id ?? null)
  const [exhibitionProcessId, setExhibitionProcessId] = useState<string | null>(process?.exhibition_process_id ?? null)
  const [exhibitionProcessOptions, setExhibitionProcessOptions] = useState<
    { id: string; nom: string; localisation: string | null; contact_id: number | null; date_debut: string | null; date_fin: string | null }[]
  >([])
  const [insurance,    setInsurance]    = useState<string>('')
  const [catalogPrice, setCatalogPrice] = useState<string>('')
  const [discount,     setDiscount]     = useState<string>('')
  const [prixFinal,    setPrixFinal]    = useState<string>('')
  const [commissionPct, setCommissionPct] = useState<string>('')

  const [reminderMsg,  setReminderMsg]  = useState('')
  const [reminderDate, setReminderDate] = useState('')

  // New Contact Quick-Add
  const [isNewContact, setIsNewContact] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactType,  setNewContactType]  = useState('Galerie')

  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string|null>(null)
  const [selectedGroup, setSelectedGroup] = useState('')

  async function handleGroupSelect(groupId: string) {
    if (!groupId) return
    setSelectedGroup(groupId)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase.from('working_group_work').select('oeuvre_id').eq('group_id', groupId)
    if (data) {
      const newIds = data.map(x => x.oeuvre_id).filter(id => !oeuvreIds.includes(id))
      setOeuvreIds(prev => [...prev, ...newIds])
    }
    setSelectedGroup('') // Reset dropdown
  }

  function handleTypeChange(nextType: ProcessType) {
    setType(nextType)
    if(isNew) setEtapes(DEFAULT_ETAPES[nextType].map(n=>({nom:n, date_echeance:'', statut:'a_faire'})))
  }

  function handleExhibitionProcessSelect(id: string) {
    setExhibitionProcessId(id || null)
    if (!id) return
    const ex = exhibitionProcessOptions.find(x => x.id === id)
    if (ex) {
      if (ex.contact_id) setContactId(ex.contact_id)
      if (ex.date_debut) setDebut(ex.date_debut)
      if (ex.date_fin)   setFin(ex.date_fin)
      if (ex.localisation) setLocalisation(ex.localisation)
      if (!nom.trim())    setNom(ex.nom ? t('pm_exhibition_auto_title_fmt').replace(/\{name\}/g, ex.nom) : nom)
    }
  }

  useEffect(() => {
    const sb = createClient()
    const controller = new AbortController()
    const query = fromSuiviProcess(sb)
      .select('id, nom, localisation, contact_id, date_debut, date_fin')
      .eq('type', 'exposition')
      .order('date_fin', { ascending: false, nullsFirst: false })
    query.abortSignal?.(controller.signal)
    query.then(({ data }: { data: typeof exhibitionProcessOptions | null }) => {
      if (!controller.signal.aborted) setExhibitionProcessOptions(data ?? [])
    })
    return () => controller.abort()
  }, [])

  async function handleCreateExhibitionProject() {
    if (isNew) {
      toast.error(t('pipeline_exhibition_create_requires_save'))
      return
    }
    if (exhibitionProcessId) return

    const hasSchedule = Boolean((debut && debut.trim()) || (fin && fin.trim()))
    if (!hasSchedule) {
      toast.error(t('pipeline_exhibition_create_requires_dates'))
      return
    }

    const sb = createClient()
    try {
      const payload = {
        nom: (nom || '').trim() || t('pipeline_exhibition_project_default_name'),
        type: 'exposition',
        statut: 'prevue',
        date_debut: debut || null,
        date_fin: fin || null,
        contact_id: contactId || null,
        localisation: localisation || null,
        url: url || null,
        notes: notes || null,
      }
      const { data: ex, error: exErr } = await fromSuiviProcess(sb).insert(payload).select('id, nom, localisation, contact_id, date_debut, date_fin').single()
      if (exErr || !ex?.id) {
        toast.error(`${t('error_prefix')} ${exErr?.message ?? 'Insert failed'}`)
        return
      }

      // Link current pipeline process → exhibition project
      const { error: linkErr } = await fromSuiviProcess(sb).update({ exhibition_process_id: ex.id }).eq('id', process.id)
      if (linkErr) {
        toast.error(`${t('error_prefix')} ${linkErr.message}`)
        return
      }

      setExhibitionProcessId(ex.id)
      setExhibitionProcessOptions((prev) => [ex, ...prev.filter((p) => p.id !== ex.id)])
      toast.success(t('pipeline_exhibition_project_created'))
    } catch (err) {
      toast.error(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  useEffect(() => {
    setExhibitionProcessId(process?.exhibition_process_id ?? null)
  }, [process?.id, process?.exhibition_process_id])

  useEffect(() => {
    if (type === 'vente' && oeuvreIds.length > 0) {
      const total = oeuvreIds.reduce((sum, id) => {
        const o = oeuvres.find(x => x.OeuvreID === id)
        return sum + (o?.Prix || 0)
      }, 0)
      setCatalogPrice(String(total))
    }
  }, [oeuvreIds, type, oeuvres])

  useEffect(() => {
    const cat = parseFloat(catalogPrice) || 0
    const disc = parseFloat(discount) || 0
    const final = cat * (1 - disc / 100)
    setPrixFinal(final.toFixed(2))
  }, [catalogPrice, discount])

  async function handleSave(): Promise<boolean> {
    if(!nom.trim()){ setErr(t('pm_err_name_required')); return false }
    setBusy(true); setErr(null)
    try {
      const sb = createClient()

      let effectiveContactId = contactId

      // AUTO-CREATE CONTACT IF NEW
      if (isNewContact && newContactName.trim()) {
        const { data: nc, error: ncErr } = await sb.from('Contact').insert({
          NomInstitution: newContactName,
          Email: newContactEmail || null,
          Type: newContactType,
          created_at: new Date().toISOString(),
        }).select('ContactID').single()

        if (ncErr) throw new Error(t('pm_err_contact_create_prefix') + ncErr.message)
        effectiveContactId = nc?.ContactID ?? null
      }

      if (!effectiveContactId && type !== 'autre') {
        throw new Error(t('pm_err_contact_required'))
      }

      const tags = vaultTags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
      const payload = {
        nom, type, date_debut:debut||null, date_fin:fin||null, deadline_time:deadlineTime||null,
        statut, localisation:localisation||null, url:url||null, scope:scope||null,
        stakeholders:stakeholders||null, responsables: toLayoutJson(responsables), vault_tags:tags,
        vault_path:vaultPath||null,
        asset_notes:assetNotes||null, notes:notes||null, updated_at:new Date().toISOString(),
        oeuvre_id: oeuvreIds[0] || null,
        contact_id: effectiveContactId,
        exhibition_process_id: exhibitionProcessId || null,
      }

      let pid = process?.id
      if(isNew) {
        const {data,error} = await fromSuiviProcess(sb).insert(payload).select('id').single()
        if(error) throw new Error(error.message)
        pid = data?.id ?? null

        if (type === 'consignment' && oeuvreIds.length > 0 && effectiveContactId) {
          const fd = new FormData()
          oeuvreIds.forEach(id => fd.append('oeuvre_ids', String(id)))
          fd.append('partner_id', String(effectiveContactId))
          fd.append('start_date', debut)
          fd.append('end_date', fin)
          fd.append('notes', notes)
          if (commissionPct) fd.append('commission_pct', commissionPct)
          const res = await createConsignmentOrder(fd)
          if ('ok' in res && res.order.pdf_path) {
            await fromSuiviProcess(sb).update({ pdf_path: res.order.pdf_path } as { pdf_path: string }).eq('id', pid!)
          }
        }
        if (type === 'vente' && oeuvreIds.length > 0 && effectiveContactId) {
          const fd = new FormData()
          oeuvreIds.forEach(id => fd.append('oeuvre_ids', String(id)))
          fd.append('buyer_id', String(effectiveContactId))
          fd.append('prix_catalogue', catalogPrice)
          fd.append('discount_pct', discount)
          fd.append('prix_final', prixFinal)
          fd.append('notes', notes)
          const res = await createSaleOrder(fd)
          if ('ok' in res && res.order.pdf_path) {
            await fromSuiviProcess(sb).update({ pdf_path: res.order.pdf_path } as { pdf_path: string }).eq('id', pid!)
          }
        }
      } else {
        const {error} = await fromSuiviProcess(sb).update(payload).eq('id',pid)
        if(error) throw new Error(error.message)
      }

      await fromSuiviEtape(sb).delete().eq('process_id',pid)
      const rows = etapes.filter(e=>e.nom.trim()).map((e,i)=>({process_id:pid,nom:e.nom,date_echeance:e.date_echeance||null,statut:e.statut,position:i}))
      if(rows.length>0) await fromSuiviEtape(sb).insert(rows)

      if (reminderMsg.trim() && reminderDate) {
        const ins = await insertSuiviReminder({
          process_id: pid,
          message: reminderMsg.trim(),
          remind_at: reminderDate,
        })
        if (!ins.ok) throw new Error(ins.error)
        await onRemindersMutated?.()
      }

      await onSaved()
      return true
    } catch(e){ setErr(String(e)); return false } finally { setBusy(false) }
  }

  const [workSearch, setWorkSearch] = useState('')
  const filteredWorks = useMemo(() => {
    const list = oeuvres || []
    if (!workSearch.trim()) return list.slice(0, 10)
    const q = workSearch.toLowerCase()
    return list.filter(o => o.Titre?.toLowerCase().includes(q) || String(o.OeuvreID).includes(q)).slice(0, 10)
  }, [oeuvres, workSearch])

  const [contactSearch, setContactSearch] = useState('')
  const filteredContacts = useMemo(() => {
    const list = contacts || []
    if (!contactSearch.trim()) return list.slice(0, 10)
    const q = contactSearch.toLowerCase()
    return list.filter(c => {
      const name = (c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`).toLowerCase()
      return name.includes(q)
    }).slice(0, 10)
  }, [contacts, contactSearch])

  const processSnapshot = useMemo(() => JSON.stringify({
    nom, type, debut, fin, deadlineTime, statut, localisation, url, scope, stakeholders,
    responsables, vaultTags, vaultPath, assetNotes, notes, etapes,
    oeuvreIds: [...oeuvreIds].sort((a, b) => a - b), contactId, exhibitionProcessId,
    insurance, catalogPrice, discount, prixFinal, commissionPct,
    reminderMsg, reminderDate, isNewContact, newContactName, newContactEmail, newContactType,
    selectedGroup,
  }), [
    nom, type, debut, fin, deadlineTime, statut, localisation, url, scope, stakeholders,
    responsables, vaultTags, vaultPath, assetNotes, notes, etapes, oeuvreIds, contactId, exhibitionProcessId,
    insurance, catalogPrice, discount, prixFinal, commissionPct,
    reminderMsg, reminderDate, isNewContact, newContactName, newContactEmail, newContactType,
    selectedGroup,
  ])

  const processKey = process?.id ?? 'new'
  const [baselineSnap, setBaselineSnap] = useState<string | null>(null)
  useLayoutEffect(() => {
    setBaselineSnap(processSnapshot)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processKey])
  const isDirty = baselineSnap != null && processSnapshot !== baselineSnap

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
      style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,10,12,0.95)', backdropFilter:'blur(20px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={attemptClose}
    >
      <div
        style={{ background:'var(--bg1)', border:'1px solid var(--bd)', width:'100%', maxWidth:720, maxHeight:'90vh', overflow:'auto', padding:40, borderRadius: 2, boxShadow: '0 30px 100px rgba(0,0,0,0.8)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
          <div>
            <div style={{ fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ac)', fontWeight: 700, marginBottom: 8 }}>{t('pm_header_kicker')}</div>
            <div style={{ fontSize: 24, fontWeight: 300, color: '#fff' }}>{isNew ? t('pm_title_new') : t('pm_title_edit').replace(/\{name\}/g, process!.nom)}</div>
          </div>
          <button type="button" onClick={attemptClose} disabled={busy} aria-label={t('close')} style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 32, cursor: 'pointer', minHeight: 44, minWidth: 44 }}>×</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 20 }}>
            <div>
              <div className="t-label" style={{marginBottom:6, opacity: 0.5}}>{t('pm_label_process_name')}</div>
              <input value={nom} onChange={e=>setNom(e.target.value)} style={{...FIS, fontSize: 16, padding: '12px 16px', background: 'var(--bg2)'}} placeholder={t('pm_placeholder_process_name')} />
            </div>
            <div>
              <div className="t-label" style={{marginBottom:6, opacity: 0.5}}>{t('category')}</div>
              <select value={type} onChange={e=>handleTypeChange(e.target.value as ProcessType)} style={{...FIS, fontSize: 13, height: 44, background: 'var(--bg2)'}}>
                {SORTED_PROCESS_TYPES.map((typ) => <option key={typ} value={typ}>{typeLabel(typ)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ padding: 16, background: 'rgba(200,168,110,0.05)', border: '1px solid rgba(200,168,110,0.2)', borderRadius: 2 }}>
            <div className="t-label" style={{marginBottom:8, color: 'var(--ac)'}}>{t('pm_exhibition_link')}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={exhibitionProcessId || ''} onChange={e => handleExhibitionProcessSelect(e.target.value)} style={{...FIS, background: 'var(--bg1)'}}>
                <option value="">{t('pm_exhibition_no_link')}</option>
                {exhibitionProcessOptions
                  .filter((ex) => !process?.id || ex.id !== process.id)
                  .map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.nom}{ex.localisation ? ` (${ex.localisation})` : ''}
                    </option>
                  ))}
              </select>
              {!exhibitionProcessId && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void handleCreateExhibitionProject()}
                  disabled={busy}
                  title={t('pipeline_exhibition_create_btn')}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {t('pipeline_exhibition_create_btn')}
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: 24, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="t-label">{t('pm_selected_works').replace(/\{count\}/g, String(oeuvreIds.length))}</div>
                <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--ac)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pm_batch_mode')}</div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 8,
                marginBottom: oeuvreIds.length > 0 ? 12 : 0,
                maxHeight: 240,
                overflowY: 'auto',
                paddingRight: 4
              }}>
                {oeuvreIds.map(id => {
                  const o = oeuvres?.find(x => x.OeuvreID === id)
                  return (
                    <div key={id} style={{
                      display: 'flex',
                      gap: 10,
                      background: 'var(--bg1)',
                      padding: 6,
                      border: '1px solid var(--bd)',
                      position: 'relative',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ width: 32, height: 32, background: 'var(--bg2)', flexShrink: 0, overflow: 'hidden', border: '1px solid var(--bd)', position: 'relative' }}>
                        {o?.ImageURL || o?.txtImageNameLink ? (
                          <WorkThumb file={o.txtImageNameLink || o.ImageURL} size={64} alt="" />
                        ) : null}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx1)' }}>{o?.Titre || t('untitled')}</div>
                        <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 1 }}>{t('pm_work_id_label')}: {id}</div>
                      </div>
                      <button
                        onClick={() => setOeuvreIds(p => p.filter(x => x !== id))}
                        title={t('pm_remove_batch_title')}
                        style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--rust)', color: 'white', border: '1px solid var(--bg0)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>

              <input
                value={workSearch}
                onChange={e => setWorkSearch(e.target.value)}
                placeholder={t('pm_search_works_ph')}
                style={{ ...FIS, background: 'var(--bg1)', borderStyle: 'dashed' }}
              />

              {workSearch.trim() && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg1)', border: '1px solid var(--ac)', zIndex: 300, maxHeight: 200, overflow: 'auto', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
                  {filteredWorks.filter(o => !oeuvreIds.includes(o.OeuvreID)).map(o => (
                    <div key={o.OeuvreID} onClick={() => { setOeuvreIds(p => [...p, o.OeuvreID]); setWorkSearch('') }} style={{ padding: '8px 12px', borderBottom: '1px solid var(--bd)', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,168,110,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 24, height: 24, background: 'var(--bg2)', border: '1px solid var(--bd)', position: 'relative' }}>
                        {(o.ImageURL || o.txtImageNameLink) && (
                          <WorkThumb file={o.txtImageNameLink || o.ImageURL} size={48} alt="" />
                        )}
                      </div>
                      <div style={{ fontSize: 11 }}>{o.Titre} <span style={{ color: 'var(--tx3)', marginLeft: 4 }}>#{o.OeuvreID}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="t-label">{t('pm_principal_contact')}</div>
                <button
                  onClick={() => setIsNewContact(!isNewContact)}
                  style={{ fontSize: 9, background: isNewContact ? 'var(--ac)' : 'transparent', border: '1px solid var(--bd)', color: isNewContact ? '#111' : 'var(--ac)', cursor: 'pointer', padding: '2px 6px' }}
                >
                  {isNewContact ? t('pm_contact_use_existing') : t('pm_contact_new')}
                </button>
              </div>

              {isNewContact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(200,168,110,0.05)', padding: 12, border: '1px solid rgba(200,168,110,0.2)' }}>
                  <input value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder={t('pm_placeholder_company')} style={FIS} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                    <input value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} placeholder={t('pm_placeholder_email')} style={FIS} />
                    <select value={newContactType} onChange={e => setNewContactType(e.target.value)} style={FIS}>
                      <option value="Galerie">{t('pm_contact_type_gallery')}</option>
                      <option value="Musée">{t('pm_contact_type_museum')}</option>
                      <option value="Collectionneur">{t('pm_contact_type_collector')}</option>
                      <option value="Transporteur">{t('pm_contact_type_shipper')}</option>
                    </select>
                  </div>
                </div>
              ) : contactId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg1)', padding: '6px 12px', border: '1px solid var(--ac)', height: 32 }}>
                  <div style={{ fontSize: 11, flex: 1, fontWeight: 500 }}>{contacts?.find(c => c.ContactID === contactId)?.NomInstitution || t('pm_selected_contact_fallback')}</div>
                  <button type="button" onClick={() => setContactId(null)} aria-label={t('delete')} style={{ background: 'none', border: 'none', color: 'var(--rust)', cursor: 'pointer', fontSize: 14, minHeight: 44, minWidth: 44 }}>×</button>
                </div>
              ) : (
                <>
                  <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder={t('pm_search_gallery_ph')} style={{ ...FIS, background: 'var(--bg1)', borderStyle: 'dashed' }} />
                  {contactSearch.trim() && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg1)', border: '1px solid var(--ac)', zIndex: 300, maxHeight: 200, overflow: 'auto' }}>
                      {filteredContacts.map(c => (
                        <div key={c.ContactID} onClick={() => { setContactId(c.ContactID); setContactSearch('') }} style={{ padding: '10px 15px', fontSize: 11, cursor: 'pointer' }}>{c.NomInstitution || `${c.Prénom} ${c.Nom}`}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div className="t-label" style={{marginBottom:6, opacity: 0.5}}>{t('pm_import_group_label')}</div>
              <select
                value={selectedGroup}
                onChange={e => handleGroupSelect(e.target.value)}
                style={{ ...FIS, border: '1px solid var(--ac)', color: 'var(--ac)' }}
              >
                <option value="">{t('pm_group_placeholder')}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          {type === 'vente' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, background:'rgba(34,197,94,0.05)', padding:24, border:'1px solid rgba(34,197,94,0.2)', marginBottom: 20 }}>
              <div>
                <div className="t-label" style={{marginBottom:8}}>{t('pm_vente_batch_total')}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color: 'var(--tx3)' }}>€</span>
                  <input value={catalogPrice} onChange={e=>setCatalogPrice(e.target.value)} style={{...FIS, fontSize: 16, fontWeight: 700, background:'transparent', border:'none', borderBottom:'1px solid var(--bd)'}} placeholder="0.00" />
                </div>
              </div>
              <div>
                <div className="t-label" style={{marginBottom:8}}>{t('pm_vente_discount')}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input value={discount} onChange={e=>setDiscount(e.target.value)} style={{...FIS, fontSize: 16, fontWeight: 700, background:'transparent', border:'none', borderBottom:'1px solid var(--bd)', textAlign: 'center'}} placeholder="0" />
                  <span style={{ fontSize:12, color: 'var(--tx3)' }}>%</span>
                </div>
              </div>
              <div>
                <div className="t-label" style={{marginBottom:8, color: 'var(--green)'}}>{t('pm_vente_final_net')}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--green)' }}>
                  <span style={{ fontSize:12 }}>€</span>
                  <input value={prixFinal} onChange={e=>setPrixFinal(e.target.value)} style={{...FIS, fontSize: 20, fontWeight: 800, background:'transparent', border:'none', borderBottom:'1px solid var(--bd)', color:'inherit'}} placeholder="0.00" />
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', fontSize: 9, color: 'var(--tx3)', fontStyle: 'italic', marginTop: 8 }}>
                {t('pm_vente_calc_footnote').replace(/\{n\}/g, String(oeuvreIds.length))}
              </div>
            </div>
          )}

          {type === 'consignment' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:20, background:'rgba(200,168,110,0.06)', padding:24, border:'1px solid rgba(200,168,110,0.25)', marginBottom: 20 }}>
              <div>
                <div className="t-label" style={{marginBottom:8}}>{t('pm_consignment_commission')}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={commissionPct}
                    onChange={e=>setCommissionPct(e.target.value)}
                    style={{...FIS, fontSize: 16, fontWeight: 700, background:'transparent', border:'none', borderBottom:'1px solid var(--bd)', textAlign: 'center', maxWidth: 140}}
                    placeholder="0"
                  />
                  <span style={{ fontSize:12, color: 'var(--tx3)' }}>{t('pm_consignment_net_suffix')}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic', marginTop: 6 }}>
                  {t('pm_consignment_hint')}
                </div>
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px', gap:20 }}>
            <div><div className="t-label" style={{marginBottom:6}}>{t('pm_date_start')}</div><input type="date" value={debut} onChange={e=>setDebut(e.target.value)} style={FIS} /></div>
            <div><div className="t-label" style={{marginBottom:6}}>{t('pm_date_deadline')}</div><input type="date" value={fin} onChange={e=>setFin(e.target.value)} style={FIS} /></div>
            <div><div className="t-label" style={{marginBottom:6}}>{t('pm_time_label')}</div><input value={deadlineTime} onChange={e=>setDeadlineTime(e.target.value)} style={FIS} placeholder="23:59" /></div>
          </div>

          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 32 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="t-eyebrow">{t('pm_pipeline_steps')}</div>
              <button className="btn ghost sm" onClick={()=>setEtapes(p=>[...p,{nom:'',date_echeance:'',statut:'a_faire'}])}>{t('pm_add_step')}</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {etapes.map((e,i)=>(
                <div key={i} style={{ display:'flex', gap:12, alignItems:'center', background: 'var(--bg0)', padding: '4px 12px' }}>
                  <input value={e.nom} onChange={ev=>{const v=ev.target.value;setEtapes(p=>p.map((x,j)=>j===i?{...x,nom:v}:x))}} style={{...FIS, border: 'none', background: 'transparent', flex: 1}} placeholder={t('pm_step_name_ph')} />
                  <input type="date" value={e.date_echeance} onChange={ev=>{const v=ev.target.value;setEtapes(p=>p.map((x,j)=>j===i?{...x,date_echeance:v}:x))}} style={{...FIS, width:130, border: 'none', background: 'transparent'}} />
                  <button type="button" onClick={()=>setEtapes(p=>p.filter((_,j)=>j!==i))} aria-label={t('delete')} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', minHeight: 44, minWidth: 44 }}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="t-label" style={{marginBottom:6, opacity: 0.5}}>{t('pm_internal_notes')}</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} style={{...FIS, resize:'vertical', lineHeight:1.6, background: 'var(--bg2)', padding: 16}} placeholder={t('pm_notes_ph')} />
          </div>

          {err && <div style={{ fontSize:11, color:'var(--rust)', padding: 12, border: '1px solid var(--rust)' }}>{err}</div>}

          <div className="row gap-md" style={{ marginTop:20, justifyContent:'flex-end' }}>
            {!isNew && (
              <button
                className="btn ghost"
                style={{ color: 'var(--rust)', marginRight: 'auto' }}
                onClick={async () => {
                  if (!confirm(t('pm_confirm_delete_process'))) return
                  setBusy(true)
                  const sb = createClient()
                  const { error } = await fromSuiviProcess(sb).delete().eq('id', process.id)
                  if (error) {
                    setErr(error.message)
                    setBusy(false)
                  } else {
                    onSaved() // triggers refresh and close
                  }
                }}
                disabled={busy}
              >
                {t('pm_delete_process')}
              </button>
            )}
            <button type="button" className="btn ghost" onClick={attemptClose} disabled={busy}>{t('pm_discard')}</button>
            <button type="button" className="btn primary" onClick={()=>void handleSave()} disabled={busy}>{busy ? t('pm_synchronizing') : t('pm_commit')}</button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
