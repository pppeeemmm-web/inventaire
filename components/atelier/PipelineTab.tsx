'use client'

// PipelineTab — parallel process tracker: Gantt + deadline sidebar + reminder panel.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────

type ProcessType =
  | 'prix' | 'residence' | 'expedition' | 'consignment' | 'exposition'
  | 'pr' | 'visite_atelier' | 'salon' | 'livre' | 'collaboration'
  | 'evenement' | 'correspondance' | 'autre'

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
  asset_notes:    string | null
  oeuvre_id:      number | null
  contact_id:     number | null
  created_at:     string
  etapes:         Etape[]
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
  padding: '6px 9px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}

// ── Config ─────────────────────────────────────────────────────────────

export const TYPE_LABELS: Record<ProcessType, string> = {
  collaboration:   'Collaboration',
  consignment:     'Consignment',
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
  autre:           'Other',
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
  autre:           '#888888',
}

const STATUT_LABELS: Record<ProcessStatut, string> = {
  en_cours: 'In progress',
  gagne:    'Won / Selected',
  perdu:    'Not selected',
  annule:   'Cancelled',
  termine:  'Completed',
}

const ETAPE_STATUT_LABELS: Record<EtapeStatut, string> = {
  a_faire:  'À faire',
  en_cours: 'En cours',
  fait:     'Fait',
  bloque:   'Bloqué',
}

const ETAPE_STATUT_COLORS: Record<EtapeStatut, string> = {
  a_faire:  'var(--tx3)',
  en_cours: '#c0a030',
  fait:     '#60a060',
  bloque:   '#c06060',
}

const ETAPE_STATUT_ORDER: EtapeStatut[] = ['a_faire', 'en_cours', 'fait', 'bloque']

function nextEtapeStatut(current: EtapeStatut): EtapeStatut {
  const i = ETAPE_STATUT_ORDER.indexOf(current)
  return ETAPE_STATUT_ORDER[(i + 1) % ETAPE_STATUT_ORDER.length]
}

const DEFAULT_ETAPES: Record<ProcessType, string[]> = {
  collaboration:   ['Initial contact', 'Proposal', 'Agreement', 'Production', 'Delivery'],
  consignment:     ['Proposal', 'Contract', 'Delivery', 'On sale', 'Return / Sold'],
  correspondance:  ['Draft', 'Sent', 'Response received'],
  evenement:       ['Concept', 'Planning', 'Communication', 'Event day', 'Follow-up'],
  expedition:      ['Preparation', 'Packing', 'In transit', 'Delivery', 'Confirmed'],
  exposition:      ['Concept', 'Design', 'Production', 'Installation', 'Opening', 'Closing'],
  livre:           ['Concept', 'Editorial', 'Texts & images', 'Layout', 'Print', 'Distribution'],
  pr:              ['Strategy', 'Contact', 'In progress', 'Published'],
  prix:            ['Discovery', 'Application', 'Dossier', 'Submission', 'Shortlist', 'Result'],
  residence:       ['Discovery', 'Application', 'Dossier', 'Submission', 'Interview', 'Result'],
  salon:           ['Application', 'Selection', 'Logistics', 'Installation', 'Fair', 'Return'],
  visite_atelier:  ['Invitation sent', 'Confirmed', 'Visit', 'Follow-up'],
  autre:           ['Step 1', 'Step 2', 'Step 3'],
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

function fmtDate(s: string, includeTime?: string | null): string {
  const d = new Date(s)
  const base = d.toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })
  return includeTime ? `${base} · ${includeTime}` : base
}


// ── Main component ─────────────────────────────────────────────────────

export function PipelineTab() {
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
      if (p.date_fin) items.push({ label: p.nom, date: p.date_fin, time: p.deadline_time, type: p.type, processId: p.id })
      p.etapes.forEach((e) => {
        if (e.statut !== 'fait' && !e.overdue_override && e.date_echeance)
          items.push({ label: `${p.nom} · ${e.nom}`, date: e.date_echeance, time: null, type: p.type, processId: p.id, etapeId: e.id })
      })
    })
    return items.filter((i) => daysUntil(i.date) <= 60).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [processes])

  async function tickEtape(etapeId: string) {
    await (createClient().from('suivi_etape') as any).update({ statut: 'fait' }).eq('id', etapeId)
    await load()
  }
  async function cycleEtapeStatut(etapeId: string, current: EtapeStatut) {
    const next = nextEtapeStatut(current)
    await (createClient().from('suivi_etape') as any).update({ statut: next }).eq('id', etapeId)
    // Optimistic patch — drawer re-renders immediately without a round-trip
    setProcesses(prev => prev.map(p => ({
      ...p,
      etapes: p.etapes.map(e => e.id === etapeId ? { ...e, statut: next } : e),
    })))
  }
  async function toggleOverdueOverride(etapeId: string, current: boolean) {
    await (createClient().from('suivi_etape') as any).update({ overdue_override: !current }).eq('id', etapeId)
    setProcesses(prev => prev.map(p => ({
      ...p,
      etapes: p.etapes.map(e => e.id === etapeId ? { ...e, overdue_override: !current } : e),
    })))
  }
  async function cycleStatut(processId: string, current: ProcessStatut) {
    const order: ProcessStatut[] = ['en_cours', 'gagne', 'termine', 'perdu', 'annule']
    const next = order[(order.indexOf(current) + 1) % order.length]
    await (createClient().from('suivi_process') as any).update({ statut: next }).eq('id', processId)
    await load()
  }

  if (loading) return <div style={{ padding: 40 }} className="t-mono-sm">Loading…</div>

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
            onClick={() => setTypeFilter('all')}>All</button>
          {SORTED_TYPES.map((t) => (
            <button key={t} className="btn ghost sm"
              style={{
                background: typeFilter===t ? TYPE_COLORS[t] : undefined,
                color: typeFilter===t ? '#111' : undefined,
                borderColor: `${TYPE_COLORS[t]}88`,
                opacity: typeFilter!=='all' && typeFilter!==t ? 0.35 : 1,
              }}
              onClick={() => setTypeFilter(typeFilter===t ? 'all' : t)}>
              {TYPE_LABELS[t]}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx3)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              Show completed
            </label>
            <button className="btn ghost sm" onClick={() => setEditing('new')}>+ New process</button>
          </div>
        </div>

        {/* Gantt */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
          {filtered.length === 0
            ? <div className="t-mono-sm" style={{ color:'var(--tx3)', paddingTop:40, textAlign:'center' }}>No active processes.</div>
            : <GanttView processes={filtered} onSelect={p=>setInspectedId(p.id)} onEdit={setEditing} onRefresh={load} onCycleStatut={cycleStatut} />
          }
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', background: 'var(--bg1)', overflow: 'auto' }}>
        <div style={{ padding: '16px 16px 0' }}>
          <div className="t-eyebrow" style={{ marginBottom: 12 }}>Upcoming deadlines</div>
          {upcoming.length === 0
            ? <div className="t-mono-sm" style={{ color:'var(--tx3)' }}>None in 60 days.</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {upcoming.slice(0,20).map((item,i) => {
                  const days = daysUntil(item.date)
                  const col  = urgencyColor(days)
                  return (
                    <div key={i} style={{ padding:'7px 10px', borderLeft:`3px solid ${TYPE_COLORS[item.type]}`, background:'var(--bg0)', display:'flex', alignItems:'flex-start', gap:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:10, color:'var(--tx)', fontWeight:500, lineHeight:1.3 }}>{item.label}</div>
                        <div style={{ fontSize:9, color:col, fontWeight:days<=7?700:400, marginTop:2 }}>
                          {days<0 ? `${Math.abs(days)}d overdue` : days===0 ? 'Today' : `in ${days}d`}
                          {' · '}{new Date(item.date).toLocaleDateString('en',{day:'numeric',month:'short'})}
                          {item.time ? ` · ${item.time}` : ''}
                        </div>
                      </div>
                      {item.etapeId && (
                        <button
                          onClick={() => void tickEtape(item.etapeId!)}
                          title="Marquer comme fait"
                          style={{ flexShrink:0, width:20, height:20, border:'1px solid var(--bd)', background:'var(--bg1)', color:'var(--tx3)', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}
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
            <div className="t-eyebrow" style={{ marginBottom:12 }}>Reminders</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {reminders.map((r) => {
                const days = daysUntil(r.remind_at)
                return (
                  <div key={r.id} style={{ padding:'7px 10px', background:'var(--bg0)', display:'flex', alignItems:'flex-start', gap:8 }}>
                    <div style={{ fontSize:9, color:urgencyColor(days), marginTop:1, flexShrink:0 }}>{days<=0?'●':'○'}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:'var(--tx)', lineHeight:1.3 }}>{r.message}</div>
                      <div style={{ fontSize:9, color:'var(--tx3)', marginTop:2 }}>
                        {new Date(r.remind_at).toLocaleDateString('en',{day:'numeric',month:'short'})}
                      </div>
                    </div>
                    <button style={{ fontSize:8, color:'var(--tx3)', flexShrink:0 }}
                      onClick={async()=>{ await(createClient().from('suivi_reminder')as any).update({lu:true}).eq('id',r.id); setReminders(p=>p.filter(x=>x.id!==r.id)) }}>✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {editing !== null && (
        <ProcessModal process={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSaved={async()=>{setEditing(null);await load()}} />
      )}
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
  )
}

// ── Gantt ──────────────────────────────────────────────────────────────

function GanttView({ processes, onSelect, onEdit, onRefresh, onCycleStatut }: {
  processes: Process[]; onSelect:(p:Process)=>void; onEdit:(p:Process)=>void; onRefresh:()=>void; onCycleStatut:(id:string,s:ProcessStatut)=>void
}) {
  const today = new Date(); today.setHours(0,0,0,0)
  const allDates = processes.flatMap(p=>[p.date_debut,p.date_fin].filter(Boolean) as string[])
  const minDate  = new Date(allDates.length>0 ? Math.min(...allDates.map(d=>new Date(d).getTime())) : today)
  const maxDate  = new Date(allDates.length>0 ? Math.max(...allDates.map(d=>new Date(d).getTime())) : today)
  minDate.setMonth(minDate.getMonth()-1); maxDate.setMonth(maxDate.getMonth()+2)
  const totalMs = maxDate.getTime()-minDate.getTime()
  function pct(d:Date|string){ return Math.max(0,Math.min(100,(new Date(d).getTime()-minDate.getTime())/totalMs*100)) }
  const months:{ label:string;left:number }[] = []
  const cur = new Date(minDate); cur.setDate(1)
  while(cur<=maxDate){ months.push({label:cur.toLocaleDateString('en',{month:'short',year:'2-digit'}),left:pct(cur)}); cur.setMonth(cur.getMonth()+1) }
  const todayPct = pct(today)

  return (
    <div>
      <div style={{ position:'relative', height:20, marginBottom:4, marginLeft:220 }}>
        {months.map(m=>(
          <div key={m.label} style={{ position:'absolute', left:`${m.left}%`, fontSize:8, color:'var(--tx3)', letterSpacing:'0.05em', transform:'translateX(-50%)' }}>{m.label}</div>
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
              <div style={{ width:220, flexShrink:0, paddingRight:12 }}>
                <div style={{ fontSize:10, color:'var(--tx)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }} onClick={()=>onSelect(p)}>{p.nom}</div>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                  <span style={{ fontSize:8, color }}>{TYPE_LABELS[p.type as ProcessType]}</span>
                  <button
                    onClick={() => onCycleStatut(p.id, p.statut)}
                    title={`Statut : ${STATUT_LABELS[p.statut]} — cliquer pour changer`}
                    style={{ fontSize:7, padding:'1px 5px', background:'var(--bg0)', border:`1px solid ${color}55`, color, cursor:'pointer', letterSpacing:'0.04em', textTransform:'uppercase', flexShrink:0 }}
                  >{STATUT_LABELS[p.statut]}</button>
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
                        title={`${e.nom} · ${ETAPE_STATUT_LABELS[e.statut]}${isOverdue?' ⚠ overdue':''} — cliquer pour changer`}
                        onClick={async(ev)=>{
                          ev.stopPropagation()
                          const next = nextEtapeStatut(e.statut)
                          await (createClient().from('suivi_etape') as any).update({statut:next}).eq('id',e.id)
                          onRefresh()
                        }}
                        style={{ position:'absolute', left:`${leftPct}%`, top:0, bottom:0, width:12, transform:'translateX(-50%)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}
                      >
                        <div style={{ width: isFait?3:2, height:'100%', background: markerColor, boxShadow: isOverdue?'0 0 4px #c06060':undefined }} />
                        {(isFait || isBloque || isEnCours) && (
                          <div style={{ position:'absolute', top:1, left:'50%', transform:'translateX(-50%)', fontSize:7, color: isFait?color:isBloque?'#c06060':'#c0a030', fontWeight:700, whiteSpace:'nowrap', pointerEvents:'none' }}>
                            {isFait?'✓':isBloque?'✕':'…'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {p.statut!=='en_cours' && (
                  <div style={{ position:'absolute', left:`${barR+0.5}%`, top:'50%', transform:'translateY(-50%)', fontSize:7, color, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', whiteSpace:'nowrap', paddingLeft:4 }}>
                    {STATUT_LABELS[p.statut]}
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
  const color = TYPE_COLORS[process.type as ProcessType]??'#888'

  function Row({label,value,href}:{label:string;value?:string|null;href?:string}) {
    if(!value) return null
    return (
      <div style={{ display:'flex', gap:8, padding:'5px 0', borderBottom:'1px solid var(--bd)' }}>
        <div className="t-mono-sm" style={{ color:'var(--tx3)', minWidth:120, flexShrink:0 }}>{label}</div>
        <div style={{ fontSize:11, wordBreak:'break-word' }}>
          {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color:'var(--ac)' }}>{value}</a> : value}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', right:0, top:0, bottom:0, width:400, zIndex:100, background:'var(--bg1)', borderLeft:'1px solid var(--bd)', overflow:'auto', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14 }}>{process.nom}</div>
          <div style={{ fontSize:9, color, marginTop:3, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            {TYPE_LABELS[process.type as ProcessType]} · {STATUT_LABELS[process.statut]}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn ghost sm" onClick={onEdit}>Edit</button>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
      </div>

      <Row label="Location"     value={process.localisation} />
      <Row label="URL"          value={process.url} href={process.url?.startsWith('http')?process.url:`https://${process.url}`} />
      {process.date_debut && <Row label="Start"  value={fmtDate(process.date_debut)} />}
      {process.date_fin   && (
        <div style={{ display:'flex', gap:8, padding:'5px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', minWidth:120, flexShrink:0 }}>Deadline</div>
          <div style={{ fontSize:11, color:urgencyColor(daysUntil(process.date_fin)), fontWeight:600 }}>
            {fmtDate(process.date_fin, process.deadline_time)}
            <span style={{ fontSize:9, fontWeight:400, marginLeft:6, color:'var(--tx3)' }}>
              ({daysUntil(process.date_fin)>=0?`in ${daysUntil(process.date_fin)}d`:`${Math.abs(daysUntil(process.date_fin))}d overdue`})
            </span>
          </div>
        </div>
      )}
      <Row label="Scope"        value={process.scope} />
      <Row label="Stakeholders" value={process.stakeholders} />

      {process.responsables?.length > 0 && (
        <div style={{ padding:'5px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:4 }}>In charge</div>
          {process.responsables.map((r,i)=>(
            <div key={i} style={{ fontSize:11, padding:'2px 0' }}>{r.nom} <span style={{ color:'var(--tx3)', fontSize:9 }}>· {r.role}</span></div>
          ))}
        </div>
      )}

      {process.vault_path && (
        <div style={{ padding:'5px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:4 }}>Dossier vault</div>
          <a
            href={process.vault_path.startsWith('http') ? process.vault_path : `https://${process.vault_path}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize:11, color:'var(--ac)', wordBreak:'break-all', display:'flex', alignItems:'center', gap:5 }}
          >
            <span style={{ fontSize:14 }}>📁</span>
            <span>{process.vault_path}</span>
          </a>
        </div>
      )}
      {process.vault_tags?.length > 0 && (
        <div style={{ padding:'5px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:4 }}>Assets / Tags</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {process.vault_tags.map(tag=>(
              <span key={tag} style={{ fontSize:9, padding:'2px 7px', border:'1px solid var(--bd)', color:'var(--tx3)' }}>{tag}</span>
            ))}
          </div>
        </div>
      )}
      {process.asset_notes && <Row label="Asset notes" value={process.asset_notes} />}

      {process.etapes.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div className="t-label" style={{ marginBottom:8 }}>Étapes</div>
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
                    title={`Statut : ${ETAPE_STATUT_LABELS[e.statut]} — cliquer pour avancer`}
                    onClick={()=>void onCycleEtape(e.id, e.statut)}
                    style={{ width:16, height:16, border:`1.5px solid ${statColor}`, background:isFait?statColor:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', marginTop:1, color:isFait?'#111':statColor, fontSize:9 }}
                  >
                    {isFait ? '✓' : isBloque ? '✕' : isEnCours ? '…' : ''}
                  </button>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10, textDecoration:isFait?'line-through':'none', color:'var(--tx)' }}>{e.nom}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2, flexWrap:'wrap' }}>
                      <span style={{ fontSize:8, color:statColor, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        {ETAPE_STATUT_LABELS[e.statut]}
                      </span>
                      {e.date_echeance && days !== null && (
                        <span style={{ fontSize:8, color: isOverdue ? '#c06060' : urgencyColor(days) }}>
                          {new Date(e.date_echeance).toLocaleDateString('fr',{day:'numeric',month:'short'})}
                          {days>=0 ? ` · J-${days}` : ` · ${Math.abs(days)}j dépassé`}
                        </span>
                      )}
                      {isOverdue && (
                        <button
                          title="Ignorer l'alerte de dépassement"
                          onClick={()=>void onOverdueOverride(e.id, e.overdue_override)}
                          style={{ fontSize:8, color:'var(--tx3)', background:'none', border:'1px solid var(--bd)', padding:'1px 5px', cursor:'pointer' }}
                        >ignorer ⚠</button>
                      )}
                      {e.overdue_override && !isFait && (
                        <button
                          title="Réactiver l'alerte de dépassement"
                          onClick={()=>void onOverdueOverride(e.id, e.overdue_override)}
                          style={{ fontSize:8, color:'var(--tx3)', background:'none', border:'1px solid var(--bd)', padding:'1px 5px', cursor:'pointer' }}
                        >⚠ ignoré</button>
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
        <div style={{ marginTop:16 }}>
          <div className="t-label" style={{ marginBottom:6 }}>Notes</div>
          <div style={{ fontSize:11, color:'var(--tx2)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{process.notes}</div>
        </div>
      )}
    </div>
  )
}

// ── Create / edit modal ────────────────────────────────────────────────

function ProcessModal({ process, onClose, onSaved }: {
  process:Process|null; onClose:()=>void; onSaved:()=>Promise<void>
}) {
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
    process?.etapes.map(e=>({nom:e.nom, date_echeance:e.date_echeance??'', statut:e.statut})) ??
    DEFAULT_ETAPES['prix'].map(n=>({nom:n, date_echeance:'', statut:'a_faire'}))
  )
  const [reminderMsg,  setReminderMsg]  = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string|null>(null)

  function handleTypeChange(t:ProcessType) {
    setType(t)
    if(isNew) setEtapes(DEFAULT_ETAPES[t].map(n=>({nom:n, date_echeance:'', statut:'a_faire'})))
  }

  function addResponsable() { setResponsables(p=>[...p,{nom:'',contact_id:null,role:''}]) }
  function setResp(i:number, k:keyof Responsable, v:string) {
    setResponsables(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r))
  }

  async function handleSave() {
    if(!nom.trim()){ setErr('Name FIS required.'); return }
    setBusy(true); setErr(null)
    try {
      const sb = createClient()
      const tags = vaultTags.split(',').map(t=>t.trim()).filter(Boolean)
      const payload = {
        nom, type, date_debut:debut||null, date_fin:fin||null, deadline_time:deadlineTime||null,
        statut, localisation:localisation||null, url:url||null, scope:scope||null,
        stakeholders:stakeholders||null, responsables, vault_tags:tags,
        vault_path:vaultPath||null,
        asset_notes:assetNotes||null, notes:notes||null, updated_at:new Date().toISOString(),
      }
      let pid = process?.id
      if(isNew) {
        const {data,error} = await(sb.from('suivi_process')as any).insert(payload).select('id').single()
        if(error) throw new Error(error.message)
        pid = (data as any).id
        const rows = etapes.filter(e=>e.nom.trim()).map((e,i)=>({process_id:pid,nom:e.nom,date_echeance:e.date_echeance||null,statut:e.statut,position:i}))
        if(rows.length>0) await(sb.from('suivi_etape')as any).insert(rows)
      } else {
        const {error} = await(sb.from('suivi_process')as any).update(payload).eq('id',pid)
        if(error) throw new Error(error.message)
        await(sb.from('suivi_etape')as any).delete().eq('process_id',pid)
        const rows = etapes.filter(e=>e.nom.trim()).map((e,i)=>({process_id:pid,nom:e.nom,date_echeance:e.date_echeance||null,statut:e.statut,position:i}))
        if(rows.length>0) await(sb.from('suivi_etape')as any).insert(rows)
      }
      if(reminderMsg.trim()&&reminderDate)
        await(sb.from('suivi_reminder')as any).insert({process_id:pid,message:reminderMsg,remind_at:reminderDate})
      await onSaved()
    } catch(e){ setErr(String(e)) } finally { setBusy(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bd)', width:'100%', maxWidth:620, maxHeight:'90vh', overflow:'auto', padding:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--tx3)' }}>
            {isNew ? 'New process' : `Edit · ${process!.nom}`}
          </div>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div><div className="t-label" style={{marginBottom:3}}>Name *</div>
            <input value={nom} onChange={e=>{const v=e.target.value;setNom(v)}} style={FIS} placeholder="e.g. Prix Marcel Duchamp 2026" /></div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><div className="t-label" style={{marginBottom:3}}>Type</div>
              <select value={type} onChange={e=>handleTypeChange(e.target.value as ProcessType)} style={FIS}>
                {SORTED_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select></div>
            <div><div className="t-label" style={{marginBottom:3}}>Status</div>
              <select value={statut} onChange={e=>{const v=e.target.value;setStatut(v as ProcessStatut)}} style={FIS}>
                {(Object.entries(STATUT_LABELS) as [ProcessStatut,string][]).sort((a,b)=>a[1].localeCompare(b[1])).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><div className="t-label" style={{marginBottom:3}}>Start</div>
              <input type="date" value={debut} onChange={e=>{const v=e.target.value;setDebut(v)}} style={FIS} /></div>
            <div><div className="t-label" style={{marginBottom:3}}>Deadline date</div>
              <input type="date" value={fin} onChange={e=>{const v=e.target.value;setFin(v)}} style={FIS} /></div>
            <div><div className="t-label" style={{marginBottom:3}}>Time (GMT)</div>
              <input value={deadlineTime} onChange={e=>{const v=e.target.value;setDeadlineTime(v)}} style={FIS} placeholder="23:59 GMT" /></div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><div className="t-label" style={{marginBottom:3}}>Location</div>
              <input value={localisation} onChange={e=>{const v=e.target.value;setLocalisation(v)}} style={FIS} placeholder="City, venue…" /></div>
            <div><div className="t-label" style={{marginBottom:3}}>URL (instructions / website)</div>
              <input value={url} onChange={e=>{const v=e.target.value;setUrl(v)}} style={FIS} placeholder="https://…" /></div>
          </div>

          <div><div className="t-label" style={{marginBottom:3}}>Scope</div>
            <input value={scope} onChange={e=>{const v=e.target.value;setScope(v)}} style={FIS} placeholder="Describe the scope and objectives…" /></div>
          <div><div className="t-label" style={{marginBottom:3}}>Stakeholders</div>
            <input value={stakeholders} onChange={e=>{const v=e.target.value;setStakeholders(v)}} style={FIS} placeholder="Organisations, institutions involved…" /></div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <div className="t-label">People in charge</div>
              <button className="btn ghost sm" style={{fontSize:9}} onClick={addResponsable}>+ Add</button>
            </div>
            {responsables.map((r,i)=>(
              <div key={i} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
                <input value={r.nom} onChange={e=>setResp(i,'nom',e.target.value)} style={{...FIS,flex:1}} placeholder="Name" />
                <input value={r.role} onChange={e=>setResp(i,'role',e.target.value)} style={{...FIS,width:140,flexShrink:0}} placeholder="Role" />
                <button style={{fontSize:10,color:'var(--tx3)',padding:'0 4px'}} onClick={()=>setResponsables(p=>p.filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
          </div>

          <div><div className="t-label" style={{marginBottom:3}}>Dossier vault (lien vers le dossier de documents)</div>
            <input value={vaultPath} onChange={e=>{const v=e.target.value;setVaultPath(v)}} style={FIS} placeholder="https://drive.google.com/… ou chemin local" /></div>
          <div><div className="t-label" style={{marginBottom:3}}>Vault tags (comma-separated)</div>
            <input value={vaultTags} onChange={e=>{const v=e.target.value;setVaultTags(v)}} style={FIS} placeholder="dossier, photo, press release, contract…" /></div>
          <div><div className="t-label" style={{marginBottom:3}}>Assets to produce</div>
            <textarea value={assetNotes} onChange={e=>{const v=e.target.value;setAssetNotes(v)}} rows={2} style={{...FIS,resize:'vertical',lineHeight:1.5}} placeholder="List assets to be produced for this process…" /></div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <div className="t-label">Steps</div>
              <button className="btn ghost sm" style={{fontSize:9}} onClick={()=>setEtapes(p=>[...p,{nom:'',date_echeance:'',statut:'a_faire'}])}>+ Step</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {etapes.map((e,i)=>(
                <div key={i} style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input value={e.nom} onChange={ev=>{const v=ev.target.value;setEtapes(p=>p.map((x,j)=>j===i?{...x,nom:v}:x))}} style={{...FIS,flex:1}} placeholder={`Step ${i+1}`} />
                  <input type="date" value={e.date_echeance} onChange={ev=>{const v=ev.target.value;setEtapes(p=>p.map((x,j)=>j===i?{...x,date_echeance:v}:x))}} style={{...FIS,width:130,flexShrink:0}} />
                  <button style={{fontSize:10,color:'var(--tx3)',padding:'0 4px'}} onClick={()=>setEtapes(p=>p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div><div className="t-label" style={{marginBottom:3}}>Notes</div>
            <textarea value={notes} onChange={e=>{const v=e.target.value;setNotes(v)}} rows={3} style={{...FIS,resize:'vertical',lineHeight:1.6}} placeholder="Information, links, contacts…" /></div>

          <div style={{ borderTop:'1px solid var(--bd)', paddingTop:12 }}>
            <div className="t-label" style={{marginBottom:6}}>Add a reminder</div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={reminderMsg} onChange={e=>{const v=e.target.value;setReminderMsg(v)}} placeholder="Reminder message…" style={{...FIS,flex:1}} />
              <input type="date" value={reminderDate} onChange={e=>{const v=e.target.value;setReminderDate(v)}} style={{...FIS,width:140,flexShrink:0}} />
            </div>
          </div>
        </div>

        {err && <div style={{ fontSize:11, color:'var(--rust)', marginTop:12 }}>{err}</div>}
        <div className="row gap-sm" style={{ marginTop:20, justifyContent:'flex-end' }}>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary sm" onClick={()=>void handleSave()} disabled={busy}>
            {busy ? '…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
