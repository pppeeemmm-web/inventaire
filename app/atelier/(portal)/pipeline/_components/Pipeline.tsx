'use client'

// Pipeline — parallel process tracker: Gantt + deadline sidebar + reminder panel.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { stringifyError } from '@/lib/error'
import { toast } from '@/lib/ui/toast'
import {
  ATELIER_NARROW_MQ,
  TYPE_COLORS,
  type Etape,
  type EtapeStatut,
  type Process,
  type ProcessStatut,
  type ProcessType,
  type Reminder,
} from '@/components/atelier/pipeline/pipeline-shared'
import { computePipelinePulseItems, daysUntil } from '@/lib/pipeline-deadlines'
import { buildPipelineCalendarEvents, normalizePipelineCalendarAnchor, type PipelineCalendarRange } from '@/lib/pipeline-calendar'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { PipelineCalendarView } from '@/components/atelier/PipelineCalendarView'
import { PipelineGanttView } from '@/components/atelier/pipeline/PipelineGanttView'
import { PipelineGanttChart } from '@/components/atelier/pipeline/PipelineGanttChart'
import { PipelineProcessDrawer } from '@/components/atelier/pipeline/PipelineProcessDrawer'
import { PipelineProcessModal } from '@/components/atelier/pipeline/PipelineProcessModal'
import { PipelineDeadlineSidebar } from '@/components/atelier/pipeline/PipelineDeadlineSidebar'
import { PipelineMobilePulse } from '@/components/atelier/pipeline/PipelineMobilePulse'
import { PipelineRemindersPanel } from '@/components/atelier/pipeline/PipelineRemindersPanel'
import {
  listUnreadSuiviReminders,
  markSuiviReminderRead,
} from '@/app/atelier/reminders-actions'
import type { Oeuvre } from '@/lib/types/database'
import { fromSuiviProcess, fromSuiviEtape } from '@/lib/pipeline/suivi-client'
import {
  dateLocaleTag,
  nextEtapeStatut,
  processToPulseProcess,
  SORTED_PROCESS_TYPES,
  urgencyColor,
  useSuiviLabels,
} from '@/components/atelier/pipeline/pipeline-suivi-labels'

interface Props {
  oeuvres:     Oeuvre[]
  contacts:    any[]
  groups:      { id: string; name: string }[]
  /** Server-loaded unread reminders; refreshed via `load` + `router.refresh`. */
  initialReminders: Reminder[]
  /** After marking reminders read / creating one — revalidates server count + RSC. */
  onRemindersMutated?: () => Promise<void>
}

export function Pipeline({ oeuvres, contacts, groups, initialReminders, onRemindersMutated }: Props) {
  const { statutLabels, etapeLabels, typeLabel, t, lang } = useSuiviLabels()
  const dateLocTag = dateLocaleTag(lang)
  const atelierNarrow = useMediaQuery(ATELIER_NARROW_MQ)
  const [processes,   setProcesses]   = useState<Process[]>([])
  const [reminders,   setReminders]   = useState<Reminder[]>(initialReminders)
  const [typeFilter,  setTypeFilter]  = useState<ProcessType | 'all'>('all')
  const [showDone,    setShowDone]    = useState(false)
  const [mainView,    setMainView]    = useState<'gantt' | 'calendar'>(() =>
    typeof window !== 'undefined' && window.matchMedia(ATELIER_NARROW_MQ).matches ? 'calendar' : 'gantt',
  )
  const [calendarRange, setCalendarRange] = useState<PipelineCalendarRange>('month')
  const [calendarAnchor, setCalendarAnchor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [editing,     setEditing]     = useState<Process | 'new' | null>(null)
  const [inspectedId, setInspectedId] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setReminders(initialReminders)
  }, [initialReminders])

  const load = useCallback(async (signal?: AbortSignal) => {
    const sb = createClient()
    let processQuery = fromSuiviProcess(sb).select('*').order('date_fin', { ascending: true, nullsFirst: false })
    let etapeQuery = fromSuiviEtape(sb).select('*').order('position')
    if (signal) {
      processQuery = processQuery.abortSignal(signal)
      etapeQuery = etapeQuery.abortSignal(signal)
    }
    const [{ data: procs }, { data: etapes }, rems] = await Promise.all([
      processQuery,
      etapeQuery,
      listUnreadSuiviReminders(500),
    ])
    if (signal?.aborted) return
    const etapeMap: Record<string, Etape[]> = {}
    ;(etapes ?? []).forEach((row) => {
      const e = row as Etape
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
    setReminders(rems as Reminder[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

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

  const upcoming = useMemo(() => computePipelinePulseItems(processes), [processes])
  const upcomingFiltered = useMemo(
    () => computePipelinePulseItems(filtered.map(processToPulseProcess)),
    [filtered],
  )
  const remindersFiltered = useMemo(() => {
    const allowed = new Set(filtered.map((p) => p.id))
    return reminders.filter((r) => !r.process_id || allowed.has(r.process_id))
  }, [reminders, filtered])

  const calendarEvents = useMemo(() => {
    const pulseProcs = filtered.map(processToPulseProcess)
    const allowed = new Set(filtered.map((p) => p.id))
    return buildPipelineCalendarEvents(pulseProcs, reminders, { allowedProcessIds: allowed })
  }, [filtered, reminders])
  const activeMainView = atelierNarrow ? 'calendar' : mainView

  const resolveCalendarColor = useCallback(
    (processType: string) => {
      if (processType === 'reminder') return 'var(--ac)'
      const typ = processType as ProcessType
      return TYPE_COLORS[typ] ?? '#888888'
    },
    [],
  )

  const onCalendarRangeChange = useCallback((r: PipelineCalendarRange) => {
    setCalendarRange(r)
    setCalendarAnchor((a) => normalizePipelineCalendarAnchor(r, a))
  }, [])

  async function tickEtape(etapeId: string) {
    const { error } = await fromSuiviEtape(createClient()).update({ statut: 'fait' }).eq('id', etapeId)
    if (error) alert(`${t('error_prefix')} ${stringifyError(error)}`)
    await load()
  }
  async function cycleEtapeStatut(etapeId: string, current: EtapeStatut) {
    const next = nextEtapeStatut(current)
    const { error } = await fromSuiviEtape(createClient()).update({ statut: next }).eq('id', etapeId)
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
    const { error } = await fromSuiviEtape(createClient()).update({ overdue_override: !current }).eq('id', etapeId)
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
    const { error } = await fromSuiviProcess(createClient()).update({ statut: next }).eq('id', processId)
    if (error) alert(`${t('error_prefix')} ${stringifyError(error)}`)
    await load()
  }

  const cM = useMemo(() => Object.fromEntries(contacts.map(c => [c.ContactID, c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)])), [contacts])

  if (loading) return <div style={{ padding: 40 }} className="t-mono-sm">{t('pipeline_loading')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: atelierNarrow ? 'column' : 'row', height: '100%', minHeight: 0 }}>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>

        {/* Toolbar — view switcher separated from type filters */}
        <div style={{
          display: 'flex', flexDirection: atelierNarrow ? 'column' : 'row',
          alignItems: atelierNarrow ? 'stretch' : 'center',
          gap: atelierNarrow ? 12 : 10,
          rowGap: 10,
          padding: atelierNarrow ? '10px 16px' : '10px 28px', borderBottom: '1px solid var(--bd)',
          background: 'var(--bg1)', flexShrink: 0,
        }}>
          <div
            data-testid={atelierNarrow ? 'pipeline-toolbar-compact' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: atelierNarrow ? 8 : 14,
              flexWrap: atelierNarrow ? 'nowrap' : 'wrap',
              width: '100%',
              minWidth: 0,
            }}
          >
            {!atelierNarrow ? (
              <div
                role="group"
                aria-label={t('pipeline_view_mode_aria')}
                style={{
                  display: 'flex',
                  width: 'auto',
                  padding: 3,
                  gap: 0,
                  background: 'var(--bg0)',
                  border: '1px solid var(--bd)',
                  borderRadius: 10,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  minWidth: 0,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  aria-pressed={mainView === 'gantt'}
                  onClick={() => setMainView('gantt')}
                  style={{
                    minWidth: 100,
                    minHeight: 44,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    background: mainView === 'gantt' ? 'var(--ac)' : 'transparent',
                    color: mainView === 'gantt' ? 'var(--bg0)' : 'var(--tx)',
                    borderRadius: '7px 0 0 7px',
                    boxShadow: mainView === 'gantt' ? '0 1px 3px rgba(0,0,0,0.2)' : undefined,
                  }}
                >
                  {t('pipeline_view_gantt')}
                </button>
                <button
                  type="button"
                  aria-pressed={mainView === 'calendar'}
                  onClick={() => setMainView('calendar')}
                  style={{
                    minWidth: 100,
                    minHeight: 44,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    background: mainView === 'calendar' ? 'var(--ac)' : 'transparent',
                    color: mainView === 'calendar' ? 'var(--bg0)' : 'var(--tx)',
                    borderRadius: '0 7px 7px 0',
                    boxShadow: mainView === 'calendar' ? '0 1px 3px rgba(0,0,0,0.2)' : undefined,
                  }}
                >
                  {t('pipeline_view_calendar')}
                </button>
              </div>
            ) : null}
            {atelierNarrow ? (
              <button
                type="button"
                className="btn ghost sm"
                aria-label={t('pipeline_new_process')}
                onClick={() => setEditing('new')}
                style={{ minWidth: 44, minHeight: 44, flexShrink: 0, fontSize: 18, padding: 4 }}
              >
                +
              </button>
            ) : null}
            {!atelierNarrow && (
              <div aria-hidden style={{ width: 1, height: 32, background: 'var(--bd)', flexShrink: 0 }} />
            )}
            {!atelierNarrow ? (
              <div
                className="t-mono-sm"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                  maxWidth: '100%',
                  color: 'var(--tx3)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                  marginTop: 0,
                }}
              >
                <span style={{ marginRight: 6, flexShrink: 0 }}>{t('pipeline_filter_group_label')}</span>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: 6,
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <button type="button" className="btn ghost sm"
                    style={{ background: typeFilter==='all' ? 'var(--ac)' : undefined, color: typeFilter==='all' ? 'var(--bg0)' : undefined }}
                    onClick={() => setTypeFilter('all')}>{t('pipeline_filter_all')}</button>
                  {SORTED_PROCESS_TYPES.map((typ) => (
                    <button key={typ} type="button" className="btn ghost sm"
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
                </div>
              </div>
            ) : null}
          </div>
          {atelierNarrow ? (
            <div
              data-testid="pipeline-toolbar-scroll"
              className="t-mono-sm"
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch' as const,
                paddingBottom: 2,
                color: 'var(--tx3)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}
            >
              <button type="button" className="btn ghost sm"
                style={{ flexShrink: 0, background: typeFilter==='all' ? 'var(--ac)' : undefined, color: typeFilter==='all' ? 'var(--bg0)' : undefined }}
                onClick={() => setTypeFilter('all')}>{t('pipeline_filter_all')}</button>
              {SORTED_PROCESS_TYPES.map((typ) => (
                <button key={typ} type="button" className="btn ghost sm"
                  style={{
                    flexShrink: 0,
                    background: typeFilter===typ ? TYPE_COLORS[typ] : undefined,
                    color: typeFilter===typ ? '#111' : undefined,
                    borderColor: `${TYPE_COLORS[typ]}88`,
                    opacity: typeFilter!=='all' && typeFilter!==typ ? 0.35 : 1,
                  }}
                  onClick={() => setTypeFilter(typeFilter===typ ? 'all' : typ)}>
                  {typeLabel(typ)}
                </button>
              ))}
            </div>
          ) : null}
          {!atelierNarrow ? (
            <div style={{
              marginLeft: 'auto',
              display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx3)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
                {t('pipeline_show_completed')}
              </label>
              <button type="button" className="btn ghost sm" onClick={() => setEditing('new')}>{t('pipeline_new_process')}</button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx3)', cursor: 'pointer', alignSelf: 'flex-start' }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              {t('pipeline_show_completed')}
            </label>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {editing && (
          <PipelineProcessModal
            oeuvres={oeuvres}
            contacts={contacts}
            groups={groups}
            process={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onRemindersMutated={onRemindersMutated}
            onSaved={async () => {
              setEditing(null)
              await load()
            }}
          />
        )}

        {/* Gantt, calendar (desktop), or pulse list (mobile) */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, minWidth: 0 }}>
          {atelierNarrow ? (
            <PipelineMobilePulse
              upcoming={upcomingFiltered}
              reminders={remindersFiltered}
              dateLocTag={dateLocTag}
              t={t as (k: string) => string}
              onOpenProcess={(id) => setInspectedId(id)}
              onTickEtape={tickEtape}
              onDismissReminder={async (rid) => {
                const res = await markSuiviReminderRead(rid)
                if (!res.ok) {
                  toast.error(`${t('error_prefix')} ${res.error}`)
                  return
                }
                setReminders((p) => p.filter((x) => x.id !== rid))
                await onRemindersMutated?.()
              }}
            />
          ) : activeMainView === 'calendar' ? (
            <PipelineCalendarView
              events={calendarEvents}
              range={calendarRange}
              anchor={calendarAnchor}
              onAnchorChange={setCalendarAnchor}
              onRangeChange={onCalendarRangeChange}
              localeTag={dateLocTag}
              t={t as (k: string) => string}
              narrow={false}
              resolveTypeColor={resolveCalendarColor}
              onOpenProcess={(id) => setInspectedId(id)}
              onTickEtape={tickEtape}
              onDismissReminder={async (rid) => {
                const res = await markSuiviReminderRead(rid)
                if (!res.ok) {
                  toast.error(`${t('error_prefix')} ${res.error}`)
                  return
                }
                setReminders((p) => p.filter((x) => x.id !== rid))
                await onRemindersMutated?.()
              }}
            />
          ) : filtered.length === 0 ? (
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '40px 28px', textAlign: 'center' }}>
              {t('pipeline_no_processes')}
            </div>
          ) : (
            <PipelineGanttView narrow={atelierNarrow}>
              <PipelineGanttChart
                processes={filtered}
                dateLocaleTag={dateLocTag}
                narrow={atelierNarrow}
                onSelect={(p) => setInspectedId(p.id)}
                onEdit={setEditing}
                onRefresh={load}
                onCycleStatut={cycleStatut}
              />
            </PipelineGanttView>
          )}
        </div>
      </div>
    </div>

      {/* ── Right sidebar ────────────────────────────────────────── */}
      {!atelierNarrow && (
      <PipelineDeadlineSidebar narrow={atelierNarrow}>
        <div style={{ padding: '16px 16px 0' }}>
          <div className="t-eyebrow" style={{ marginBottom: 12 }}>{t('pipeline_upcoming_deadlines')}</div>
          {upcoming.length === 0
            ? <div className="t-mono-sm" style={{ color:'var(--tx3)' }}>{t('pipeline_no_upcoming_60')}</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {upcoming.slice(0,20).map((item,i) => {
                  const days = daysUntil(item.date)
                  const col  = urgencyColor(days)
                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      aria-label={t('pipeline_sidebar_open_process_aria')}
                      onClick={() => setInspectedId(item.processId)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          setInspectedId(item.processId)
                        }
                      }}
                      style={{ padding:'10px 14px', borderLeft:`3px solid ${TYPE_COLORS[item.type as ProcessType] ?? '#888'}`, background:'var(--bg0)', display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer' }}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:'var(--tx)', fontWeight:500, lineHeight:1.3 }}>{item.label}</div>
                        <div style={{ fontSize:11, color:col, fontWeight:days<=7?700:400, marginTop:4 }}>
                          {days < 0
                            ? t('pipeline_sidebar_overdue_fmt').replace(/\{days\}/g, String(Math.abs(days)))
                            : days === 0
                              ? t('pipeline_sidebar_today')
                              : t('pipeline_sidebar_in_days_fmt').replace(/\{days\}/g, String(days))}
                          {' · '}{new Date(item.date).toLocaleDateString(dateLocTag,{day:'numeric',month:'short'})}
                          {item.deadline_time ? ` · ${item.deadline_time}` : ''}
                        </div>
                      </div>
                      {item.etapeId && (
                        <button
                          type="button"
                          onClick={async (ev) => {
                            ev.stopPropagation()
                            try {
                              await tickEtape(item.etapeId!)
                            } catch (err) {
                              alert(`${t('error_prefix')} ${stringifyError(err)}`)
                            }
                          }}
                          title={t('pipeline_etape_tick_title')}
                          style={{ flexShrink:0, minWidth:44, minHeight:44, width:44, height:44, border:'1px solid var(--bd)', background:'var(--bg1)', color:'var(--tx3)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}
                        >✓</button>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </div>

        {reminders.length > 0 && (
          <PipelineRemindersPanel>
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
                    <button type="button" aria-label={t('delete')} style={{ fontSize:12, color:'var(--tx3)', flexShrink:0, minHeight: 44, minWidth: 44 }}
                      onClick={async() => {
                        try {
                          const res = await markSuiviReminderRead(r.id)
                          if (!res.ok) {
                            alert(`${t('error_prefix')} ${res.error}`)
                            return
                          }
                          setReminders(p => p.filter(x => x.id !== r.id))
                          await onRemindersMutated?.()
                        } catch (err) {
                          alert(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                        }
                      }}>✕</button>
                  </div>
                )
              })}
            </div>
          </PipelineRemindersPanel>
        )}
      </PipelineDeadlineSidebar>
      )}

      {/* Modals */}
      {inspected !== null && (
        <PipelineProcessDrawer
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
