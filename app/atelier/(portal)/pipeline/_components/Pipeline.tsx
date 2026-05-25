'use client'

// Pipeline — parallel process tracker: Gantt + deadline sidebar + reminder panel.

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { stringifyError } from '@/lib/error'
import { toast } from '@/lib/ui/toast'
import {
  ATELIER_NARROW_MQ,
  TYPE_COLORS,
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
import { PipelineToolbar } from '@/components/atelier/pipeline/PipelineToolbar'
import { usePipelineLoad } from '@/components/atelier/pipeline/usePipelineLoad'
import {
  markSuiviReminderRead,
} from '@/app/atelier/reminders-actions'
import type { Oeuvre } from '@/lib/types/database'
import { fromSuiviProcess, fromSuiviEtape } from '@/lib/pipeline/suivi-client'
import {
  dateLocaleTag,
  nextEtapeStatut,
  processToPulseProcess,
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
  const { typeLabel, t, lang } = useSuiviLabels()
  const dateLocTag = dateLocaleTag(lang)
  const atelierNarrow = useMediaQuery(ATELIER_NARROW_MQ)
  const { processes, setProcesses, reminders, setReminders, loading, load } = usePipelineLoad(initialReminders)
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

  if (loading) return <div style={{ padding: 40 }} className="t-mono-sm">{t('pipeline_loading')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: atelierNarrow ? 'column' : 'row', height: '100%', minHeight: 0 }}>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>

        <PipelineToolbar
          atelierNarrow={atelierNarrow}
          mainView={mainView}
          setMainView={setMainView}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          showDone={showDone}
          setShowDone={setShowDone}
          setEditing={setEditing}
          t={t as (key: string) => string}
          typeLabel={typeLabel}
        />

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
