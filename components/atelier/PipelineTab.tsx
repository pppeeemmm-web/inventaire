'use client'

// PipelineTab — parallel process tracker: Gantt + deadline sidebar + reminder panel.

import { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import { stringifyError } from '@/lib/error'
import type { Lang } from '@/lib/i18n/dictionary'

// ── Types ──────────────────────────────────────────────────────────────

export type ProcessType =
  | 'prix' | 'residence' | 'expedition' | 'consignment' | 'exposition'
  | 'pr' | 'visite_atelier' | 'salon' | 'livre' | 'collaboration'
  | 'evenement' | 'correspondance' | 'vente' | 'autre'

type ProcessStatut = 'en_cours' | 'gagne' | 'perdu' | 'annule' | 'termine'
type EtapeStatut   = 'a_faire' | 'en_cours' | 'fait' | 'bloque'

interface Etape {
  id:               string
  process_id:       string
  nom:              string
  date_echeance:    string | null
  statut:           EtapeStatut
  position:         number
  notes:            string | null
  overdue_override: boolean
}

interface Responsable { nom: string; contact_id: number | null; role: string }

interface Process {
  id:             string
  nom:            string
  type:           ProcessType
  date_debut:     string | null
  date_fin:       string | null
  deadline_time:  string | null
  statut:         ProcessStatut
  notes:          string | null
  localisation:   string | null
  url:            string | null
  scope:          string | null
  stakeholders:   string | null
  responsables:   Responsable[]
  vault_tags:     string[]
  vault_path:     string | null
  pdf_path:       string | null
  asset_notes:    string | null
  oeuvre_id:      number | null
  contact_id:     number | null
  /** Optional link to an exhibition-hub process (same table); cleared if that project is deleted. */
  exhibition_process_id?: string | null
  created_at:     string
  etapes:         Etape[]
}

import { createConsignmentOrder, regenerateConsignmentPdf, closeConsignmentByPdfPath } from '@/app/atelier/consignments/actions'
import { createSaleOrder } from '@/app/atelier/sales/actions'
import { getSignedUrl } from '@/app/atelier/vault/actions'
import type { Oeuvre } from '@/lib/types/database'
import { EXHIBITION_READY_TYPES } from '@/lib/data'
import { WorkThumb } from './WorkThumb'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'

interface Props {
  oeuvres:     Oeuvre[]
  contacts:    any[]
  groups:      { id: string; name: string }[]
}

interface Reminder {
  id:         string
  process_id: string | null
  etape_id:   string | null
  message:    string
  remind_at:  string
  lu:         boolean
}

const FIS: React.CSSProperties = {
  padding: '8px 12px', fontSize: 13,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}

// ── Config ─────────────────────────────────────────────────────────────

export const TYPE_LABELS: Record<ProcessType, string> = {
  collaboration:   'Collaboration',
  consignment:     'Consignation',
  correspondance:  'Correspondance',
  evenement:       'Événement',
  expedition:      'Expédition',
  exposition:      'Exposition',
  livre:           'Livre / Publication',
  pr:              'Relations publiques',
  prix:            'Prix',
  residence:       'Résidence / Bourse',
  salon:           'Salon / Foire',
  visite_atelier:  'Visite d\'atelier',
  vente:           'Vente',
  autre:           'Autre',
}

export const TYPE_LABELS_EN: Record<ProcessType, string> = {
  collaboration:   'Collaboration',
  consignment:     'Consignment',
  correspondance:  'Correspondence',
  evenement:       'Event',
  expedition:      'Shipment',
  exposition:      'Exhibition',
  livre:           'Book / Publication',
  pr:              'Public Relations',
  prix:            'Prize / Award',
  residence:       'Residency / Grant',
  salon:           'Art Fair',
  visite_atelier:  'Studio Visit',
  vente:           'Sale',
  autre:           'Other',
}

export function pipelineTypeLabel(typ: ProcessType, lang: Lang): string {
  return lang === 'en' ? TYPE_LABELS_EN[typ] : TYPE_LABELS[typ]
}

export const TYPE_COLORS: Record<ProcessType, string> = {
  collaboration:   '#b07040',
  consignment:     '#c08080',
  correspondance:  '#708090',
  evenement:       '#80a060',
  expedition:      '#80c090',
  exposition:      '#a060c0',
  livre:           '#c0a030',
  pr:              '#60b0c0',
  prix:            '#c0a060',
  residence:       '#6090c0',
  salon:           '#c06090',
  visite_atelier:  '#70b080',
  vente:           '#60a060',
  autre:           '#888888',
}

const ETAPE_STATUT_COLORS: Record<EtapeStatut, string> = {
  a_faire:  'var(--tx3)',
  en_cours: '#c0a030',
  fait:     '#60a060',
  bloque:   '#c06060',
}

const ETAPE_STATUT_ORDER: EtapeStatut[] = ['a_faire', 'en_cours', 'fait', 'bloque']

function useSuiviLabels() {
  const { t, lang } = useI18n()
  const statutLabels = useMemo(
    () =>
      ({
        en_cours: t('proc_stat_en_cours'),
        gagne: t('proc_stat_gagne'),
        perdu: t('proc_stat_perdu'),
        annule: t('proc_stat_annule'),
        termine: t('proc_stat_termine'),
      }) as Record<ProcessStatut, string>,
    [t],
  )
  const etapeLabels = useMemo(
    () =>
      ({
        a_faire: t('etape_stat_a_faire'),
        en_cours: t('etape_stat_en_cours'),
        fait: t('etape_stat_fait'),
        bloque: t('etape_stat_bloque'),
      }) as Record<EtapeStatut, string>,
    [t],
  )
  const typeLabel = useCallback((typ: ProcessType) => pipelineTypeLabel(typ, lang), [lang])
  return { statutLabels, etapeLabels, typeLabel, t, lang }
}

function nextEtapeStatut(current: EtapeStatut): EtapeStatut {
  const i = ETAPE_STATUT_ORDER.indexOf(current)
  return ETAPE_STATUT_ORDER[(i + 1) % ETAPE_STATUT_ORDER.length]
}

const DEFAULT_ETAPES: Record<ProcessType, string[]> = {
  collaboration:   ['Premier contact', 'Proposition', 'Accord', 'Production', 'Livraison'],
  consignment:     ['Proposition', 'Contrat', 'Livraison', 'En vente', 'Retour / Vente'],
  correspondance:  ['Brouillon', 'Envoyé', 'Réponse reçue'],
  evenement:       ['Concept', 'Planning', 'Communication', 'Jour J', 'Suivi'],
  expedition:      ['Préparation', 'Emballage', 'En transit', 'Livré', 'Confirmé'],
  exposition:      ['Concept', 'Sélection', 'Production', 'Installation', 'Vernissage', 'Décrochage'],
  livre:           ['Concept', 'Éditorial', 'Textes & Images', 'Mise en page', 'Impression', 'Distribution'],
  pr:              ['Stratégie', 'Contact', 'En cours', 'Publié'],
  prix:            ['Dossier', 'Soumission', 'Présélection', 'Résultat'],
  residence:       ['Dossier', 'Soumission', 'Entretien', 'Résultat'],
  salon:           ['Candidature', 'Sélection', 'Logistique', 'Installation', 'Foire', 'Retour'],
  visite_atelier:  ['Invitation', 'Confirmation', 'Visite', 'Suivi'],
  vente:           ['Négociation', 'Accord', 'Acompte', 'Préparation', 'Livraison', 'Solde'],
  autre:           ['Étape 1', 'Étape 2', 'Étape 3'],
}

const SORTED_TYPES = (Object.keys(TYPE_LABELS) as ProcessType[])
  .sort((a, b) => TYPE_LABELS[a].localeCompare(TYPE_LABELS[b], 'fr'))

// ── Helpers ────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  const n = new Date();        n.setHours(0,0,0,0)
  return Math.ceil((d.getTime() - n.getTime()) / 86400000)
}

function urgencyColor(days: number): string {
  if (days < 0)   return '#c06060'
  if (days <= 7)  return '#c08040'
  if (days <= 21) return '#a0a040'
  return 'var(--tx3)'
}

function dateLocaleTag(lang: Lang): 'fr-FR' | 'en-GB' {
  return lang === 'en' ? 'en-GB' : 'fr-FR'
}

function fmtDate(s: string, includeTime?: string | null, locale: 'fr' | 'en' = 'fr'): string {
  const d = new Date(s)
  const loc = locale === 'en' ? 'en-GB' : 'fr-FR'
  const base = d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })
  return includeTime ? `${base} · ${includeTime}` : base
}


// ── Main component ─────────────────────────────────────────────────────

export function PipelineTab({ oeuvres, contacts, groups }: Props) {
  const { statutLabels, etapeLabels, typeLabel, t, lang } = useSuiviLabels()
  const dateLocTag = dateLocaleTag(lang)
  const [processes,   setProcesses]   = useState<Process[]>([])
  const [reminders,   setReminders]   = useState<Reminder[]>([])
  const [typeFilter,  setTypeFilter]  = useState<ProcessType | 'all'>('all')
  const [showDone,    setShowDone]    = useState(false)
  const [editing,     setEditing]     = useState<Process | 'new' | null>(null)
  const [inspectedId, setInspectedId] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)

  const load = useCallback(async () => {
    const sb = createClient()
    const [{ data: procs }, { data: etapes }, { data: rems }] = await Promise.all([
      (sb.from('suivi_process')  as any).select('*').order('date_fin', { ascending: true, nullsFirst: false }),
      (sb.from('suivi_etape')    as any).select('*').order('position'),
      (sb.from('suivi_reminder') as any).select('*').eq('lu', false).order('remind_at'),
    ])
    const etapeMap: Record<string, Etape[]> = {}
    ;(etapes ?? []).forEach((e: Etape) => {
      if (!etapeMap[e.process_id]) etapeMap[e.process_id] = []
      etapeMap[e.process_id].push(e)
    })
    setProcesses((procs ?? []).map((p: any) => ({
      ...p,
      responsables: p.responsables ?? [],
      vault_tags:   p.vault_tags   ?? [],
      vault_path:   p.vault_path   ?? null,
      etapes:       (etapeMap[p.id] ?? []).map((e: any) => ({
        ...e,
        overdue_override: e.overdue_override ?? false,
      })),
    })))
    setReminders(rems ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Derive the open drawer's process from live state — always fresh after optimistic updates
  const inspected = useMemo(
    () => inspectedId ? (processes.find(p => p.id === inspectedId) ?? null) : null,
    [inspectedId, processes]
  )

  const filtered = useMemo(() => processes.filter((p) => {
    if (!showDone && ['perdu','annule','termine'].includes(p.statut)) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    return true
  }), [processes, typeFilter, showDone])

  const upcoming = useMemo(() => {
    const items: { label: string; date: string; time: string | null; type: ProcessType; processId: string; etapeId?: string }[] = []
    processes.forEach((p) => {
      if (['perdu','annule','termine'].includes(p.statut)) return
      
      let skipDateFin = false;
      if (p.date_fin) {
        const days = daysUntil(p.date_fin);
        const hasCompletedSameDay = p.etapes.some(e => e.statut === 'fait' && e.date_echeance === p.date_fin);
        const hasFutureSteps = p.etapes.some(e => e.statut !== 'fait' && e.date_echeance && daysUntil(e.date_echeance) >= 0);
        const hasPendingSameDay = p.etapes.some(e => e.statut !== 'fait' && e.date_echeance === p.date_fin);
        
        if (hasCompletedSameDay || (days < 0 && hasFutureSteps) || hasPendingSameDay) {
          skipDateFin = true;
        }
      }
      
      if (p.date_fin && !skipDateFin) {
        items.push({ label: p.nom, date: p.date_fin, time: p.deadline_time, type: p.type, processId: p.id })
      }

      p.etapes.forEach((e) => {
        if (e.statut !== 'fait' && !e.overdue_override && e.date_echeance)
          items.push({ label: `${p.nom} · ${e.nom}`, date: e.date_echeance, time: null, type: p.type, processId: p.id, etapeId: e.id })
      })
    })
    return items.filter((i) => daysUntil(i.date) <= 60).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [processes])

  async function tickEtape(etapeId: string) {
    const { error } = await (createClient().from('suivi_etape') as any).update({ statut: 'fait' }).eq('id', etapeId)
    if (error) alert(`${t('error_prefix')} ${stringifyError(error)}`)
    await load()
  }
  async function cycleEtapeStatut(etapeId: string, current: EtapeStatut) {
    const next = nextEtapeStatut(current)
    const { error } = await (createClient().from('suivi_etape') as any).update({ statut: next }).eq('id', etapeId)
    if (error) {
      alert(`${t('error_prefix')} ${stringifyError(error)}`)
      return
    }
    // Optimistic patch — drawer re-renders immediately without a round-trip
    setProcesses(prev => prev.map(p => ({
      ...p,
      etapes: p.etapes.map(e => e.id === etapeId ? { ...e, statut: next } : e),
    })))
  }
  async function toggleOverdueOverride(etapeId: string, current: boolean) {
    const { error } = await (createClient().from('suivi_etape') as any).update({ overdue_override: !current }).eq('id', etapeId)
    if (error) {
      alert(`${t('error_prefix')} ${stringifyError(error)}`)
      return
    }
    setProcesses(prev => prev.map(p => ({
      ...p,
      etapes: p.etapes.map(e => e.id === etapeId ? { ...e, overdue_override: !current } : e),
    })))
  }
  async function cycleStatut(processId: string, current: ProcessStatut) {
    const order: ProcessStatut[] = ['en_cours', 'gagne', 'termine', 'perdu', 'annule']
    const next = order[(order.indexOf(current) + 1) % order.length]
    const { error } = await (createClient().from('suivi_process') as any).update({ statut: next }).eq('id', processId)
    if (error) alert(`${t('error_prefix')} ${stringifyError(error)}`)
    await load()
  }

  const cM = useMemo(() => Object.fromEntries(contacts.map(c => [c.ContactID, c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)])), [contacts])

  if (loading) return <div style={{ padding: 40 }} className="t-mono-sm">{t('pipeline_loading')}</div>

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          padding: '10px 28px', borderBottom: '1px solid var(--bd)',
          background: 'var(--bg1)', flexShrink: 0,
        }}>
          <button className="btn ghost sm"
            style={{ background: typeFilter==='all' ? 'var(--ac)' : undefined, color: typeFilter==='all' ? 'var(--bg0)' : undefined }}
            onClick={() => setTypeFilter('all')}>{t('pipeline_filter_all')}</button>
          {SORTED_TYPES.map((typ) => (
            <button key={typ} className="btn ghost sm"
              style={{
                background: typeFilter===typ ? TYPE_COLORS[typ] : undefined,
                color: typeFilter===typ ? '#111' : undefined,
                borderColor: `${TYPE_COLORS[typ]}88`,
                opacity: typeFilter!=='all' && typeFilter!==typ ? 0.35 : 1,
              }}
              onClick={() => setTypeFilter(typeFilter===typ ? 'all' : typ)}>
              {typeLabel(typ)}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx3)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              {t('pipeline_show_completed')}
            </label>
            <button className="btn ghost sm" onClick={() => setEditing('new')}>{t('pipeline_new_process')}</button>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {editing && (
          <ProcessModal
            oeuvres={oeuvres}
            contacts={contacts}
            groups={groups}
            process={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null)
              await load()
            }}
          />
        )}

        {/* Gantt */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
          {filtered.length === 0
            ? <div className="t-mono-sm" style={{ color:'var(--tx3)', paddingTop:40, textAlign:'center' }}>{t('pipeline_no_processes')}</div>
            : <GanttView processes={filtered} dateLocaleTag={dateLocTag} onSelect={p=>setInspectedId(p.id)} onEdit={setEditing} onRefresh={load} onCycleStatut={cycleStatut} />
          }
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', background: 'var(--bg1)', overflow: 'auto' }}>
        <div style={{ padding: '16px 16px 0' }}>
          <div className="t-eyebrow" style={{ marginBottom: 12 }}>{t('pipeline_upcoming_deadlines')}</div>
          {upcoming.length === 0
            ? <div className="t-mono-sm" style={{ color:'var(--tx3)' }}>{t('pipeline_no_upcoming_60')}</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {upcoming.slice(0,20).map((item,i) => {
                  const days = daysUntil(item.date)
                  const col  = urgencyColor(days)
                  return (
                    <div key={i} style={{ padding:'10px 14px', borderLeft:`3px solid ${TYPE_COLORS[item.type]}`, background:'var(--bg0)', display:'flex', alignItems:'flex-start', gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:'var(--tx)', fontWeight:500, lineHeight:1.3 }}>{item.label}</div>
                        <div style={{ fontSize:11, color:col, fontWeight:days<=7?700:400, marginTop:4 }}>
                          {days < 0
                            ? t('pipeline_sidebar_overdue_fmt').replace(/\{days\}/g, String(Math.abs(days)))
                            : days === 0
                              ? t('pipeline_sidebar_today')
                              : t('pipeline_sidebar_in_days_fmt').replace(/\{days\}/g, String(days))}
                          {' · '}{new Date(item.date).toLocaleDateString(dateLocTag,{day:'numeric',month:'short'})}
                          {item.time ? ` · ${item.time}` : ''}
                        </div>
                      </div>
                      {item.etapeId && (
                        <button
                          onClick={async (ev) => {
                            try {
                              await tickEtape(item.etapeId!)
                            } catch (err) {
                              alert(`${t('error_prefix')} ${stringifyError(err)}`)
                            }
                          }}
                          title={t('pipeline_etape_tick_title')}
                          style={{ flexShrink:0, width:24, height:24, border:'1px solid var(--bd)', background:'var(--bg1)', color:'var(--tx3)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}
                        >✓</button>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </div>

        {reminders.length > 0 && (
          <div style={{ padding:'16px 16px 0', marginTop:12 }}>
            <div className="t-eyebrow" style={{ marginBottom:12 }}>{t('pipeline_reminders_header')}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {reminders.map((r) => {
                const days = daysUntil(r.remind_at)
                return (
                  <div key={r.id} style={{ padding:'10px 14px', background:'var(--bg0)', display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ fontSize:12, color:urgencyColor(days), marginTop:1, flexShrink:0 }}>{days<=0?'●':'○'}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:'var(--tx)', lineHeight:1.3 }}>{r.message}</div>
                      <div style={{ fontSize:11, color:'var(--tx3)', marginTop:4 }}>
                        {new Date(r.remind_at).toLocaleDateString(dateLocTag,{day:'numeric',month:'short'})}
                      </div>
                    </div>
                    <button style={{ fontSize:12, color:'var(--tx3)', flexShrink:0 }}
                      onClick={async() => {
                        try {
                          await (createClient().from('suivi_reminder') as any).update({lu:true}).eq('id',r.id)
                          setReminders(p => p.filter(x => x.id !== r.id))
                        } catch (err) {
                          alert(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                        }
                      }}>✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {inspected !== null && (
        <ProcessDrawer
          process={inspected}
          onClose={()=>setInspectedId(null)}
          onEdit={()=>{setEditing(inspected);setInspectedId(null)}}
          onRefresh={async()=>{await load()}}
          onCycleEtape={cycleEtapeStatut}
          onOverdueOverride={toggleOverdueOverride}
        />
      )}
    </div>
  </div>
  )
}

// ── Gantt ──────────────────────────────────────────────────────────────

function GanttView({ processes, dateLocaleTag: ganttDateLoc, onSelect, onEdit, onRefresh, onCycleStatut }: {
  processes: Process[]
  dateLocaleTag: 'fr-FR' | 'en-GB'
  onSelect:(p:Process)=>void; onEdit:(p:Process)=>void; onRefresh:()=>void; onCycleStatut:(id:string,s:ProcessStatut)=>void
}) {
  const { statutLabels, etapeLabels, typeLabel, t } = useSuiviLabels()
  const today = new Date(); today.setHours(0,0,0,0)
  const allDates = processes.flatMap(p=>[p.date_debut,p.date_fin].filter(Boolean) as string[])
  const minDate  = new Date(allDates.length>0 ? Math.min(...allDates.map(d=>new Date(d).getTime())) : today)
  const maxDate  = new Date(allDates.length>0 ? Math.max(...allDates.map(d=>new Date(d).getTime())) : today)
  minDate.setMonth(minDate.getMonth()-1); maxDate.setMonth(maxDate.getMonth()+2)
  const totalMs = maxDate.getTime()-minDate.getTime()
  function pct(d:Date|string){ return Math.max(0,Math.min(100,(new Date(d).getTime()-minDate.getTime())/totalMs*100)) }
  const months:{ label:string;left:number }[] = []
  const cur = new Date(minDate); cur.setDate(1)
  while(cur<=maxDate){ months.push({label:cur.toLocaleDateString(ganttDateLoc,{month:'short',year:'2-digit'}),left:pct(cur)}); cur.setMonth(cur.getMonth()+1) }
  const todayPct = pct(today)

  return (
    <div>
      <div style={{ position:'relative', height:24, marginBottom:8, marginLeft:240 }}>
        {months.map(m=>(
          <div key={m.label} style={{ position:'absolute', left:`${m.left}%`, fontSize:11, color:'var(--tx3)', letterSpacing:'0.05em', transform:'translateX(-50%)' }}>{m.label}</div>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {processes.map(p=>{
          const color   = TYPE_COLORS[p.type as ProcessType]??'#888'
          const isDone  = ['perdu','annule','termine'].includes(p.statut)
          const barL    = p.date_debut ? pct(p.date_debut) : todayPct-0.5
          const barR    = p.date_fin   ? pct(p.date_fin)   : todayPct+0.5
          const barW    = Math.max(0.5, barR-barL)
          const done    = p.etapes.filter(e=>e.statut==='fait').length
          const progress= p.etapes.length>0 ? done/p.etapes.length : 0
          return (
            <div key={p.id} style={{ display:'flex', alignItems:'center', opacity:isDone?0.5:1 }}>
              <div style={{ width:240, flexShrink:0, paddingRight:16 }}>
                <div style={{ fontSize:13, color:'var(--tx)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }} onClick={()=>onSelect(p)}>{p.nom}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                  <span style={{ fontSize:11, color }}>{typeLabel(p.type as ProcessType)}</span>
                  <button
                    onClick={() => onCycleStatut(p.id, p.statut)}
                    title={t('pipeline_gantt_process_statut_title').replace(/\{status\}/g, statutLabels[p.statut])}
                    style={{ fontSize:10, padding:'2px 8px', background:'var(--bg0)', border:`1px solid ${color}55`, color, cursor:'pointer', letterSpacing:'0.04em', textTransform:'uppercase', flexShrink:0 }}
                  >{statutLabels[p.statut]}</button>
                </div>
              </div>
              <div style={{ flex:1, position:'relative', height:28 }}>
                {months.map(m=>(
                  <div key={m.label} style={{ position:'absolute', left:`${m.left}%`, top:0, bottom:0, width:1, background:'var(--bd)', opacity:0.4 }} />
                ))}
                <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:1, background:'var(--ac)', opacity:0.6 }} />
                <div style={{ position:'absolute', left:`${barL}%`, width:`${barW}%`, top:'50%', transform:'translateY(-50%)', height:16, background:isDone?'#222':`${color}22`, border:`1px solid ${isDone?'#444':color}`, cursor:'pointer', overflow:'hidden' }}
                  onClick={()=>onSelect(p)}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${progress*100}%`, background:`${color}55` }} />
                  {p.etapes.filter(e=>e.date_echeance).map(e=>{
                    const leftPct    = Math.max(0,Math.min(100,((pct(e.date_echeance!)-barL)/barW)*100))
                    const isFait     = e.statut === 'fait'
                    const isBloque   = e.statut === 'bloque'
                    const isEnCours  = e.statut === 'en_cours'
                    const days       = daysUntil(e.date_echeance!)
                    const isOverdue  = days < 0 && !isFait && !e.overdue_override
                    const markerColor = isOverdue ? '#c06060' : isFait ? color : isBloque ? '#c06060' : isEnCours ? '#c0a030' : `${color}66`
                    return (
                      <div key={e.id}
                        title={t('pipeline_gantt_etape_marker_title')
                          .replace(/\{step\}/g, e.nom)
                          .replace(/\{stepStatus\}/g, etapeLabels[e.statut])
                          .replace(/\{overdue\}/g, isOverdue ? t('pipeline_gantt_overdue_suffix') : '')}
                        onClick={async(ev)=>{
                          ev.stopPropagation()
                          try {
                            const next = nextEtapeStatut(e.statut)
                            await (createClient().from('suivi_etape') as any).update({statut:next}).eq('id',e.id)
                            onRefresh()
                          } catch (err) {
                            alert(`${t('error_prefix')} ${stringifyError(err)}`)
                          }
                        }}
                        style={{ position:'absolute', left:`${leftPct}%`, top:0, bottom:0, width:12, transform:'translateX(-50%)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}
                      >
                        <div style={{ width: isFait?4:3, height:'100%', background: markerColor, boxShadow: isOverdue?'0 0 6px #c06060':undefined }} />
                        {(isFait || isBloque || isEnCours) && (
                          <div style={{ position:'absolute', top:2, left:'50%', transform:'translateX(-50%)', fontSize:10, color: isFait?color:isBloque?'#c06060':'#c0a030', fontWeight:700, whiteSpace:'nowrap', pointerEvents:'none' }}>
                            {isFait?'✓':isBloque?'✕':'…'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {p.statut!=='en_cours' && (
                  <div style={{ position:'absolute', left:`${barR+0.5}%`, top:'50%', transform:'translateY(-50%)', fontSize:10, color, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', whiteSpace:'nowrap', paddingLeft:8 }}>
                    {statutLabels[p.statut]}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Detail drawer ──────────────────────────────────────────────────────

function ProcessDrawer({ process, onClose, onEdit, onRefresh, onCycleEtape, onOverdueOverride }: {
  process:Process; onClose:()=>void; onEdit:()=>void; onRefresh:()=>Promise<void>
  onCycleEtape:(id:string,current:EtapeStatut)=>Promise<void>
  onOverdueOverride:(id:string,current:boolean)=>Promise<void>
}) {
  const { statutLabels, etapeLabels, typeLabel, t, lang } = useSuiviLabels()
  const dateLocale = lang === 'en' ? 'en' : 'fr'
  const color = TYPE_COLORS[process.type as ProcessType]??'#888'

  function Row({label,value,href}:{label:string;value?:string|null;href?:string}) {
    if(!value) return null
    return (
      <div style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
        <div className="t-mono-sm" style={{ color:'var(--tx3)', minWidth:140, flexShrink:0 }}>{label}</div>
        <div style={{ fontSize:13, wordBreak:'break-word' }}>
          {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color:'var(--ac)' }}>{value}</a> : value}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', right:0, top:0, bottom:0, width:400, zIndex:100, background:'var(--bg1)', borderLeft:'1px solid var(--bd)', overflow:'auto', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:18 }}>{process.nom}</div>
          <div style={{ fontSize:11, color, marginTop:4, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            {typeLabel(process.type as ProcessType)} · {statutLabels[process.statut]}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn ghost sm" onClick={onEdit}>{t('edit')}</button>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
      </div>

      <Row label={t('pd_row_location')} value={process.localisation} />
      <Row label={t('pd_row_url')} value={process.url} href={process.url?.startsWith('http')?process.url:`https://${process.url}`} />
      {process.date_debut && <Row label={t('pd_row_start')} value={fmtDate(process.date_debut, undefined, dateLocale)} />}
      {process.date_fin   && (() => {
        const days = daysUntil(process.date_fin);
        const hasCompletedSameDay = process.etapes.some(e => e.statut === 'fait' && e.date_echeance === process.date_fin);
        const hasFutureSteps = process.etapes.some(e => e.statut !== 'fait' && e.date_echeance && daysUntil(e.date_echeance) >= 0);
        const isOverdue = days < 0 && !hasCompletedSameDay && !hasFutureSteps;
        const color = isOverdue ? '#c06060' : (days >= 0 ? urgencyColor(days) : 'var(--tx)');
        return (
          <div style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
            <div className="t-mono-sm" style={{ color:'var(--tx3)', minWidth:140, flexShrink:0 }}>{t('pd_row_deadline')}</div>
            <div style={{ fontSize:13, color, fontWeight:600 }}>
              {fmtDate(process.date_fin, process.deadline_time, dateLocale)}
              <span style={{ fontSize:11, fontWeight:400, marginLeft:6, color:'var(--tx3)' }}>
                {days >= 0
                  ? t('pd_deadline_in_days_paren').replace(/\{days\}/g, String(days))
                  : isOverdue
                    ? t('pd_deadline_overdue_paren').replace(/\{days\}/g, String(Math.abs(days)))
                    : t('pd_deadline_on_track')}
              </span>
            </div>
          </div>
        )
      })()}
      <Row label={t('pd_row_scope')} value={process.scope} />
      <Row label={t('pd_row_stakeholders')} value={process.stakeholders} />

      {process.responsables?.length > 0 && (
        <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:6 }}>{t('pd_in_charge')}</div>
          {process.responsables.map((r,i)=>(
            <div key={i} style={{ fontSize:13, padding:'4px 0' }}>{r.nom} <span style={{ color:'var(--tx3)', fontSize:11 }}>· {r.role}</span></div>
          ))}
        </div>
      )}

      {process.vault_path && (
        <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:6 }}>{t('pd_vault_folder')}</div>
          <a
            href={process.vault_path.startsWith('http') ? process.vault_path : `https://${process.vault_path}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize:13, color:'var(--ac)', wordBreak:'break-all', display:'flex', alignItems:'center', gap:8 }}
          >
            <span style={{ fontSize:18 }}>📁</span>
            <span>{process.vault_path}</span>
          </a>
        </div>
      )}
      {process.vault_tags?.length > 0 && (
        <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:6 }}>{t('pd_assets_tags')}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {process.vault_tags.map(tag=>(
              <span key={tag} style={{ fontSize:11, padding:'3px 10px', border:'1px solid var(--bd)', color:'var(--tx3)' }}>{tag}</span>
            ))}
          </div>
        </div>
      )}
      {process.asset_notes && <Row label={t('pd_asset_notes')} value={process.asset_notes} />}

      {process.pdf_path && (
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)' }}>
          <div className="t-label" style={{ marginBottom: 8, color: 'var(--cyan)' }}>{t('pd_commercial_bond_pdf')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={async (e) => {
                if (!confirm(t('pd_confirm_regenerate_pdf'))) return
                const btn = (e.currentTarget as HTMLButtonElement)
                const old = btn.innerText
                btn.innerText = t('pd_operation_in_progress')
                btn.disabled = true
                try {
                  const res = await regenerateConsignmentPdf(process.id)
                  if (res.ok) {
                    alert(t('pd_pdf_updated_reload'))
                    await onRefresh()
                  } else alert(res.error)
                } catch (err) {
                  alert(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                } finally {
                  btn.innerText = old
                  btn.disabled = false
                }
              }}
              className="btn ghost sm"
              style={{ flex: 1, fontSize: 12, border: '1px solid rgba(34,211,238,0.3)' }}
            >
              {t('pd_regenerate_pdf_btn')}
            </button>
            <button 
              onClick={async () => {
                try {
                  const res = await getSignedUrl(process.pdf_path!)
                  if ('url' in res) window.open(res.url, '_blank')
                  else alert(res.error)
                } catch (err) {
                  alert(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                }
              }}
              className="btn primary sm"
              style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 10, padding: '8px 12px' }}
            >
              <span style={{ fontSize: 20 }}>↓</span>
              <span style={{ fontSize: 14 }}>{t('pd_download_pdf_btn')}</span>
            </button>
          </div>
          {process.type === 'consignment' && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={async (e) => {
                  if (!confirm(t('pd_confirm_close_consignment'))) return
                  const btn = (e.currentTarget as HTMLButtonElement)
                  const old = btn.innerText
                  btn.innerText = t('pd_operation_in_progress')
                  btn.disabled = true
                  try {
                    const res = await closeConsignmentByPdfPath(process.pdf_path!)
                    if ('ok' in res) {
                      let msg = t('pd_close_consignment_intro')
                      if (res.reverted.length > 0) {
                        msg += ` ${t('pd_consignment_reverted_line').replace(/\{n\}/g, String(res.reverted.length))}`
                      }
                      if (res.skipped.length > 0) {
                        msg += ` ${t('pd_consignment_skipped_line').replace(/\{n\}/g, String(res.skipped.length))}`
                      }
                      alert(msg.trim())
                      await onRefresh()
                    } else alert(res.error)
                  } catch (err) {
                    alert(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                  } finally {
                    btn.innerText = old
                    btn.disabled = false
                  }
                }}
                className="btn ghost sm"
                style={{ width: '100%', fontSize: 12, color: 'var(--rust)', border: '1px solid rgba(202,89,73,0.4)' }}
              >
                {t('pd_close_consignment_btn')}
              </button>
            </div>
          )}
        </div>
      )}

      {process.etapes.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div className="t-label" style={{ marginBottom:8 }}>{t('pd_steps_section')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {process.etapes.map(e=>{
              const days      = e.date_echeance ? daysUntil(e.date_echeance) : null
              const isFait    = e.statut === 'fait'
              const isBloque  = e.statut === 'bloque'
              const isEnCours = e.statut === 'en_cours'
              const isOverdue = days !== null && days < 0 && !isFait && !e.overdue_override
              const statColor = ETAPE_STATUT_COLORS[e.statut]
              return (
                <div key={e.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px', background:'var(--bg0)', opacity:isFait?0.5:1 }}>
                  <button
                    title={t('pd_etape_cycle_hint').replace(/\{status\}/g, etapeLabels[e.statut])}
                    onClick={()=>void onCycleEtape(e.id, e.statut)}
                    style={{ width:20, height:20, border:`1.5px solid ${statColor}`, background:isFait?statColor:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', marginTop:1, color:isFait?'#111':statColor, fontSize:12 }}
                  >
                    {isFait ? '✓' : isBloque ? '✕' : isEnCours ? '…' : ''}
                  </button>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, textDecoration:isFait?'line-through':'none', color:'var(--tx)' }}>{e.nom}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color:statColor, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        {etapeLabels[e.statut]}
                      </span>
                      {e.date_echeance && days !== null && (
                        <span style={{ fontSize:11, color: isFait ? 'var(--tx3)' : isOverdue ? '#c06060' : urgencyColor(days) }}>
                          {new Date(e.date_echeance).toLocaleDateString(dateLocale === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'short'})}
                          {days !== null && days >= 0
                            ? t('pd_etape_days_remaining').replace(/\{days\}/g, String(days))
                            : isOverdue && days !== null
                              ? t('pd_etape_days_overdue_label').replace(/\{days\}/g, String(Math.abs(days)))
                              : ''}
                        </span>
                      )}
                      {isOverdue && (
                        <button
                          title={t('pd_ignore_overdue_title')}
                          onClick={()=>void onOverdueOverride(e.id, e.overdue_override)}
                          style={{ fontSize:11, color:'var(--tx3)', background:'none', border:'1px solid var(--bd)', padding:'2px 8px', cursor:'pointer' }}
                        >{t('pd_ignore_overdue_btn')}</button>
                      )}
                      {e.overdue_override && !isFait && (
                        <button
                          title={t('pd_restore_overdue_title')}
                          onClick={()=>void onOverdueOverride(e.id, e.overdue_override)}
                          style={{ fontSize:11, color:'var(--tx3)', background:'none', border:'1px solid var(--bd)', padding:'2px 8px', cursor:'pointer' }}
                        >{t('pd_overdue_ignored_btn')}</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {process.notes && (
        <div style={{ marginTop:24 }}>
          <div className="t-label" style={{ marginBottom:10 }}>{t('notes')}</div>
          <div style={{ fontSize:14, color:'var(--tx2)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{process.notes}</div>
        </div>
      )}
    </div>
  )
}

// ── Create / edit modal ────────────────────────────────────────────────

function ProcessModal({ oeuvres, contacts, groups, process, onClose, onSaved }: {
  oeuvres:     any[]
  contacts:    any[]
  groups:      { id: string; name: string }[]
  process:     any | null
  onClose:     () => void
  onSaved:     () => Promise<void>
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
    process?.etapes?.map(e=>({nom:e.nom, date_echeance:e.date_echeance??'', statut:e.statut})) ??
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
    ;(sb.from('suivi_process') as any)
      .select('id, nom, localisation, contact_id, date_debut, date_fin')
      .in('type', EXHIBITION_READY_TYPES)
      .order('date_fin', { ascending: false, nullsFirst: false })
      .then(({ data }: { data: typeof exhibitionProcessOptions | null }) => {
        setExhibitionProcessOptions(data ?? [])
      })
  }, [])

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
        const { data: nc, error: ncErr } = await (sb.from('contacts') as any).insert({
          NomInstitution: newContactName,
          Email: newContactEmail || null,
          Type: newContactType,
          created_at: new Date().toISOString()
        }).select('ContactID').single()
        
        if (ncErr) throw new Error(t('pm_err_contact_create_prefix') + ncErr.message)
        effectiveContactId = (nc as any).ContactID
      }

      if (!effectiveContactId && type !== 'autre') {
        throw new Error(t('pm_err_contact_required'))
      }

      const tags = vaultTags.split(',').map(t=>t.trim()).filter(Boolean)
      const payload = {
        nom, type, date_debut:debut||null, date_fin:fin||null, deadline_time:deadlineTime||null,
        statut, localisation:localisation||null, url:url||null, scope:scope||null,
        stakeholders:stakeholders||null, responsables, vault_tags:tags,
        vault_path:vaultPath||null,
        asset_notes:assetNotes||null, notes:notes||null, updated_at:new Date().toISOString(),
        oeuvre_id: oeuvreIds[0] || null,
        contact_id: effectiveContactId,
        exhibition_process_id: exhibitionProcessId || null,
      }

      let pid = process?.id
      if(isNew) {
        const {data,error} = await(sb.from('suivi_process')as any).insert(payload).select('id').single()
        if(error) throw new Error(error.message)
        pid = (data as any).id
        
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
            await (sb.from('suivi_process') as any).update({ pdf_path: res.order.pdf_path }).eq('id', pid)
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
            await (sb.from('suivi_process') as any).update({ pdf_path: res.order.pdf_path }).eq('id', pid)
          }
        }
      } else {
        const {error} = await(sb.from('suivi_process')as any).update(payload).eq('id',pid)
        if(error) throw new Error(error.message)
      }

      await(sb.from('suivi_etape')as any).delete().eq('process_id',pid)
      const rows = etapes.filter(e=>e.nom.trim()).map((e,i)=>({process_id:pid,nom:e.nom,date_echeance:e.date_echeance||null,statut:e.statut,position:i}))
      if(rows.length>0) await(sb.from('suivi_etape')as any).insert(rows)

      if(reminderMsg.trim()&&reminderDate)
        await(sb.from('suivi_reminder')as any).insert({process_id:pid,message:reminderMsg,remind_at:reminderDate})
      
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
          <button type="button" onClick={attemptClose} disabled={busy} style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 32, cursor: 'pointer' }}>×</button>
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
                {SORTED_TYPES.map((typ) => <option key={typ} value={typ}>{typeLabel(typ)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ padding: 16, background: 'rgba(200,168,110,0.05)', border: '1px solid rgba(200,168,110,0.2)', borderRadius: 2 }}>
            <div className="t-label" style={{marginBottom:8, color: 'var(--ac)'}}>{t('pm_exhibition_link')}</div>
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
                  <button onClick={() => setContactId(null)} style={{ background: 'none', border: 'none', color: 'var(--rust)', cursor: 'pointer', fontSize: 14 }}>×</button>
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
                  <button onClick={()=>setEtapes(p=>p.filter((_,j)=>j!==i))} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer' }}>×</button>
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
                  const { error } = await (sb.from('suivi_process') as any).delete().eq('id', process.id)
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
