'use client'

// ProductionTab — action-based task board for works.
// One column per work_action_type. A work appears in every column
// where it has a pending (done=false) work_action.
// Works that are Catalogué or sold/lost/destroyed are excluded.

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { DictKey } from '@/lib/i18n/dictionary'
import { createClient } from '@/lib/supabase/client'
import { getWorkActionTypes, invalidateWorkActionTypesCache } from '@/lib/work-action-type-cache'
import { workActionTypeDisplayLabel } from '@/lib/work-action-type-label'
import { imageUrl, thumbUrl, yearOf, statusOf, type StatusKey } from '@/lib/data'
import { MissingThumb, WorkThumb, SuggestionThumb } from './WorkThumb'
import type { Oeuvre } from '@/lib/types/database'
import type { Agg, Dim } from '@/lib/pivot'
import { PivotPanel } from './PivotPanel'

// ── Types ────────────────────────────────────────────────────

interface ActionType {
  id:         number
  label:      string
  color:      string
  sort_order: number
  field_key:  string | null  // Oeuvres field to set true when action FIS ticked done
}

interface WorkAction {
  id:             number
  oeuvre_id:      number
  action_type_id: number
  done:           boolean
  note:           string | null
}

interface FieldIssue {
  id:                  number
  created_at:          string
  action:              string
  details:             string | null
  type:                string | null
  status:              string | null
  priority:            string | null
  severity:            string | null
  oeuvre_id:           number | null
  work_action_type_id: number | null
  photo_r2_key:        string | null
}

const EXCLUDED_STATUSES: StatusKey[] = ['sold', 'gift', 'artist_archive', 'private_archive']



// ── Component ────────────────────────────────────────────────

interface Props {
  oeuvres:        Oeuvre[]
  tM:             Record<number, string>
  statusLabelMap: Record<number, string>
  onOpen:         (o: Oeuvre) => void
  /** When the catalogue has more rows than loaded, UI clarifies subset scope. */
  oeuvresPaging?: { totalCount: number; nextCursor: number | null; pageSize: number }
}

export function ProductionTab({ oeuvres, tM, statusLabelMap, onOpen, oeuvresPaging }: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const [search,      setSearch]      = useState('')
  const [actionTypes, setActionTypes] = useState<ActionType[]>([])
  const [actions,     setActions]     = useState<WorkAction[]>([])
  const [fieldIssues, setFieldIssues] = useState<FieldIssue[]>([])
  const [localOeuvres, setLocalOeuvres] = useState<Oeuvre[]>(oeuvres)
  const [loading,     setLoading]     = useState(true)
  const [editingTypes, setEditingTypes] = useState(false)

  // Sync with props when they change
  useEffect(() => {
    setLocalOeuvres(oeuvres)
  }, [oeuvres])

  const sb = createClient()

  const loadData = useCallback(async () => {
    const [types, { data: acts }, { data: issues }] = await Promise.all([
      getWorkActionTypes(sb),
      sb.from('work_action').select('*').eq('done', false),
      sb
        .from('studio_task')
        .select('id,created_at,action,details,type,status,priority,severity,oeuvre_id,work_action_type_id,photo_r2_key')
        .eq('kind', 'field')
        .neq('status', 'completed')
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(12),
    ])
    setActionTypes(types as ActionType[])
    if (acts) setActions(acts)
    setFieldIssues((issues ?? []) as FieldIssue[])
    setLoading(false)
  }, [sb])

  useEffect(() => { loadData() }, [loadData])

  // Map: actionTypeId → Set<oeuvreId> with pending action
  const actionMap = useMemo(() => {
    const m = new Map<number, Set<number>>()
    for (const a of actions) {
      if (!m.has(a.action_type_id)) m.set(a.action_type_id, new Set())
      m.get(a.action_type_id)!.add(a.oeuvre_id)
    }
    return m
  }, [actions])

  // Active works — not catalogued OR has pending actions, not sold/lost/destroyed
  const active = useMemo(() => {
    const sq = search.trim().toLowerCase()
    
    // Set of all oeuvreIds that have at least one pending action
    const worksWithActions = new Set<number>()
    for (const a of actions) worksWithActions.add(a.oeuvre_id)

    return localOeuvres.filter((o) => {
      // Show if not catalogued OR if it specifically needs a photograph OR if it has a pending action
      const needsPhoto = (o as any).NeedsPhotograph || (o as any).needsphotograph
      const hasAction = worksWithActions.has(o.OeuvreID)
      if (o.Catalogué && !needsPhoto && !hasAction) return false
      
      const st = statusOf(o, statusLabelMap)
      if (EXCLUDED_STATUSES.includes(st)) return false
      
      if (sq) {
        const bag = `${o.Titre ?? ''} #${o.OeuvreID} ${o.Technique != null ? (tM[o.Technique] ?? '') : ''}`.toLowerCase()
        if (!bag.includes(sq)) return false
      }
      return true
    })
  }, [localOeuvres, statusLabelMap, tM, search, actions])

  const oeuvresById = useMemo(
    () => new Map(localOeuvres.map((o) => [o.OeuvreID, o])),
    [localOeuvres],
  )

  async function markDone(oeuvreId: number, actionTypeId: number) {
    const actionType = actionTypes.find((at) => at.id === actionTypeId)
    const o = oeuvresById.get(oeuvreId)

    // Mark the action row as done
    const { error } = await sb.from('work_action')
      .update({ done: true, done_at: new Date().toISOString() })
      .eq('oeuvre_id', oeuvreId)
      .eq('action_type_id', actionTypeId)

    if (error) {
      alert(t('prod_tab_err_update').replace('{msg}', error.message))
      return
    }

    let newActionsToAdd: any[] = []

    // Write back to Oeuvres if this action has a linked field
    if (actionType?.field_key || actionTypeId === 6 || actionTypeId === 9) {
      const updates: any = {}
      if (actionType?.field_key) updates[actionType.field_key] = true

      if (actionTypeId === 9) {
        // Cataloguer ticked done → enter photo gate, do NOT skip to Available
        updates['Catalogué']        = true
        updates['NeedsPhotograph']  = true
        updates['statusId']         = 1  // En production — gate not cleared yet

        // Auto-create Photographier task if not already pending
        const { data: existing } = await sb.from('work_action')
          .select('id')
          .eq('oeuvre_id', oeuvreId)
          .eq('action_type_id', 6)
          .eq('done', false)
          .maybeSingle()
        if (!existing) {
          const { data: newAction } = await sb.from('work_action').insert({
            oeuvre_id:      oeuvreId,
            action_type_id: 6,
            done:           false,
          }).select().single()
          if (newAction) newActionsToAdd.push(newAction)
        }
      } else if (actionTypeId === 6) {
        // Photographier ticked done → clear photo gate, move to Disponible
        updates['NeedsPhotograph'] = false
        updates['statusId']        = 2  // Disponible
      } else {
        // Other field_key actions — only advance to Available if fully ready
        const willBeCatalogued = o?.Catalogué
        const willNotNeedPhoto = !o?.NeedsPhotograph
        if (willBeCatalogued && willNotNeedPhoto) {
          updates['statusId'] = 2
        }
      }

      await sb.from('Oeuvres').update(updates).eq('OeuvreID', oeuvreId)

      // Update local oeuvres state so header counts and filters update instantly
      if (Object.keys(updates).length > 0) {
        setLocalOeuvres((prev) =>
          prev.map((item) =>
            item.OeuvreID === oeuvreId ? { ...item, ...updates } : item
          )
        )
      }
    }

    // Remove from local state so card disappears immediately, and inject new actions so they appear instantly
    setActions((prev) => {
      const filtered = prev.filter(
        (a) => !(a.oeuvre_id === oeuvreId && a.action_type_id === actionTypeId)
      )
      return [...filtered, ...newActionsToAdd]
    })
    
    // Sync the main oeuvres list so the tables update their status chips
    router.refresh()
  }

  // Add an action to a work
  async function addAction(oeuvreId: number, actionTypeId: number) {
    const { data } = await sb.from('work_action')
      .upsert({ oeuvre_id: oeuvreId, action_type_id: actionTypeId, done: false },
               { onConflict: 'oeuvre_id,action_type_id' })
      .select()
      .single()
    if (data) setActions((prev) => [...prev.filter(
      (a) => !(a.oeuvre_id === oeuvreId && a.action_type_id === actionTypeId)
    ), data])
  }

  const productionCount = localOeuvres.filter(o => statusOf(o, statusLabelMap) === 'en_production').length
  const availableCount = localOeuvres.filter(o => statusOf(o, statusLabelMap) === 'available').length
  const archivePemCount = localOeuvres.filter(o => statusOf(o, statusLabelMap) === 'artist_archive').length
  const soldCount       = localOeuvres.filter(o => statusOf(o, statusLabelMap) === 'sold').length
  const othersCount     = localOeuvres.length - (productionCount + availableCount + archivePemCount + soldCount)

  const productionPivotRows = useMemo(
    () =>
      localOeuvres.filter(
        (o) => !EXCLUDED_STATUSES.includes(statusOf(o, statusLabelMap)),
      ),
    [localOeuvres, statusLabelMap],
  )

  const prodPivotDims: Dim<Oeuvre>[] = useMemo(
    () => [
      {
        id: 'status',
        label: t('status'),
        get: (o) => statusLabelMap[o.statusId ?? 0] ?? String(statusOf(o, statusLabelMap)),
      },
      {
        id: 'month',
        label: t('pivotDimMonth'),
        get: (o) => {
          const d = (o as { DateLivraison?: string | null }).DateLivraison
          return d && d.length >= 7 ? d.slice(0, 7) : '—'
        },
      },
      {
        id: 'technique',
        label: t('technique'),
        get: (o) => (o.Technique != null ? (tM[o.Technique] ?? String(o.Technique)) : '—'),
      },
    ],
    [t, tM, statusLabelMap],
  )

  const prodPivotValues: Agg<Oeuvre>[] = useMemo(
    () => [{ id: 'count', label: t('pivotCount'), kind: 'count' }],
    [t],
  )

  const narrow = useMediaQuery('(max-width: 767px)')

  if (loading) {
    return <div className="t-mono-sm" style={{ padding: 40, color: 'var(--tx3)' }}>{t('loading')}</div>
  }

  const statParts = [
    t('prod_tab_stat_wip').replace('{n}', String(active.length)),
    t('prod_tab_stat_available').replace('{n}', String(availableCount)),
    t('prod_tab_stat_archive_pem').replace('{n}', String(archivePemCount)),
  ]
  if (soldCount > 0) statParts.push(t('prod_tab_stat_sold').replace('{n}', String(soldCount)))
  if (othersCount > 0) {
    statParts.push(
      othersCount === 1
        ? t('prod_tab_stat_other_one').replace('{n}', String(othersCount))
        : t('prod_tab_stat_others').replace('{n}', String(othersCount)),
    )
  }
  const statLine = statParts.join(' · ')

  const cataloguePartial =
    oeuvresPaging != null && oeuvres.length < oeuvresPaging.totalCount
  const pivotFootnote =
    cataloguePartial && oeuvresPaging
      ? t('prod_tab_pivot_footnote_loaded_subset')
          .replace('{loaded}', String(oeuvres.length))
          .replace('{total}', String(oeuvresPaging.totalCount))
      : undefined

  return (
    <div style={{ padding: narrow ? '12px 16px 0' : '16px 28px 0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', flex: 1 }}>

      {/* Header — Ring A.3: stack on narrow (field terminal) */}
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'center',
          gap: narrow ? 10 : 12,
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        <div>
          <div className="t-label">{t('production')}</div>
          {narrow ? (
            <ul
              className="t-mono-sm"
              style={{
                margin: '8px 0 0',
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                color: 'var(--tx3)',
                fontSize: 11,
                lineHeight: 1.35,
              }}
            >
              {statParts.map((part, i) => (
                <li key={`prod-stat-${i}`}>{part}</li>
              ))}
            </ul>
          ) : (
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 3 }}>
              {statLine}
            </div>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('prod_tab_filter_ph')}
          style={{
            marginLeft: narrow ? 0 : 'auto',
            padding: '8px 14px',
            fontSize: 13,
            background: 'var(--bg1)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            width: narrow ? '100%' : 220,
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={() => setEditingTypes((v) => !v)}
          style={{
            padding: '8px 12px',
            fontSize: 12,
            cursor: 'pointer',
            color: editingTypes ? 'var(--ac)' : 'var(--tx3)',
            background: editingTypes ? 'var(--bg2)' : 'transparent',
            border: '1px solid var(--bd)',
            minHeight: 44,
            alignSelf: narrow ? 'stretch' : undefined,
          }}
          title={t('prod_tab_manage_columns_title')}
        >
          ⚙ {t('prod_tab_columns_btn')}
        </button>
      </div>

      <MaterialOverview
        fieldIssues={fieldIssues}
        actionTypes={actionTypes}
        oeuvresById={oeuvresById}
        onOpen={onOpen}
      />

      <PivotPanel<Oeuvre>
        rows={productionPivotRows}
        availableDims={prodPivotDims}
        availableValues={prodPivotValues}
        defaultRowDimId="status"
        defaultColDimId="month"
        footnote={pivotFootnote}
        defaultValueIds={['count']}
        title={t('pivot')}
        exportFileName="production-throughput"
        initialToolbarCollapsed
      />

      {/* Action type manager */}
      {editingTypes && (
        <ActionTypeManager
          actionTypes={actionTypes}
          onRefresh={loadData}
          onClose={() => setEditingTypes(false)}
        />
      )}

      {/* Kanban — Truly fluid and scrollable */}
      <div style={{ 
        flex: 1, 
        overflowX: 'auto', 
        overflowY: 'hidden', 
        minHeight: 0,
        background: 'var(--bd)', // Grid lines
        display: 'flex',
      }}>
        <div style={{
          display: 'flex',
          gap: 1,
          height: '100%',
          flex: narrow ? '0 0 auto' : 1,
          alignItems: 'stretch',
          width: narrow ? 'max-content' : undefined,
          minWidth: narrow ? '100%' : undefined,
        }}>
          {actionTypes.map((at) => {
            const ids   = actionMap.get(at.id) ?? new Set<number>()
            const isPhotoColumn = at.id === 6 // 'Photographier'
            const works = active.filter((o) => {
              const needsPhoto = (o as any).NeedsPhotograph || (o as any).needsphotograph
              return ids.has(o.OeuvreID) || (isPhotoColumn && needsPhoto)
            })
            return (
              <div
                key={at.id}
                style={{
                  flex: narrow ? '0 0 auto' : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: narrow ? 'min(72vw, 240px)' : 120,
                  width: narrow ? 'min(72vw, 240px)' : undefined,
                  height: '100%',
                }}
              >
                <ActionColumn
                  actionType={at}
                  works={works}
                  active={active}
                  tM={tM}
                  oeuvresById={oeuvresById}
                  onMarkDone={(oid) => markDone(oid, at.id)}
                  onAddAction={(oid) => addAction(oid, at.id)}
                  onOpen={onOpen}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Action column ─────────────────────────────────────────────

function ActionColumn({
  actionType, works, active, tM, onMarkDone, onAddAction, onOpen,
}: {
  actionType:  ActionType
  works:       Oeuvre[]
  active:      Oeuvre[]
  tM:          Record<number, string>
  oeuvresById: Map<number, Oeuvre>
  onMarkDone:  (oid: number) => void
  onAddAction: (oid: number) => void
  onOpen:      (o: Oeuvre) => void
}) {
  const { t } = useI18n()
  const [showAdd, setShowAdd] = useState(false)
  const [addQ,    setAddQ]    = useState('')

  const columnTitle = workActionTypeDisplayLabel(actionType.id, actionType.label, t)

  const sortedWorks = useMemo(() => {
    return [...works].sort((a, b) => {
      const aDl = (a as any).DateLivraison
      const bDl = (b as any).DateLivraison
      const aCom = (a as any).IsCommission
      const bCom = (b as any).IsCommission

      // 1. Commissions with imminent deadlines first
      if (aCom && bCom) {
        if (aDl && bDl) return aDl.localeCompare(bDl)
        if (aDl) return -1
        if (bDl) return 1
        return 0
      }
      if (aCom) return -1
      if (bCom) return 1

      // 2. Others by ID (descending)
      return b.OeuvreID - a.OeuvreID
    })
  }, [works])

  const suggestions = useMemo(() => {
    if (!addQ.trim()) return []
    const sq = addQ.toLowerCase()
    return active.filter(o =>
      !works.find(w => w.OeuvreID === o.OeuvreID) &&
      (`${o.Titre ?? ''} #${o.OeuvreID}`).toLowerCase().includes(sq)
    ).slice(0, 8)
  }, [active, works, addQ])

  return (
    <div style={{ background: 'var(--bg1)', display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%', flex: 1 }}>
      {/* Header */}
      <div style={{
        padding: '12px 10px 10px', borderBottom: '1px solid var(--bd)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg2)',
        borderTop: `3px solid ${actionType.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span
            className="t-eyebrow"
            title={columnTitle}
            style={{
              color: actionType.color, fontSize: 13, fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >{columnTitle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{works.length}</span>
          <button
            onClick={() => { setShowAdd((v) => !v); setAddQ('') }}
            style={{ fontSize: 14, color: 'var(--tx3)', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
            title={t('prod_tab_add_work_title')}
          >+</button>
        </div>
      </div>

      {/* Add work search suggestions */}
      {showAdd && (
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', flexShrink: 0, background: 'var(--bg1)' }}>
          <input
            autoFocus
            value={addQ}
            onChange={(e) => setAddQ(e.target.value)}
            placeholder={t('prod_tab_add_work_ph')}
            style={{
              width: '100%', padding: '6px 10px', fontSize: 13,
              background: 'var(--bg0)', border: '1px solid var(--bd)',
              color: 'var(--tx)',
            }}
          />
          {suggestions.map((o) => (
            <div
              key={o.OeuvreID}
              onClick={() => { onAddAction(o.OeuvreID); setShowAdd(false); setAddQ('') }}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                color: 'var(--tx)', borderBottom: '1px solid var(--bd)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 16, height: 16, background: 'var(--bg0)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                {o.txtImageNameLink && <SuggestionThumb file={o.txtImageNameLink} alt={o.Titre ?? ''} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.Titre ?? '—'}
              </div>
              <span style={{ color: 'var(--tx3)', fontSize: 11 }}>#{o.OeuvreID}</span>
            </div>
          ))}
          {addQ.trim() && suggestions.length === 0 && (
            <div className="t-mono-sm" style={{ padding: '5px 7px', color: 'var(--tx3)' }}>{t('prod_tab_no_results')}</div>
          )}
        </div>
      )}

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 7px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sortedWorks.map((o) => (
          <WorkCard
            key={o.OeuvreID}
            o={o}
            tM={tM}
            onMarkDone={() => onMarkDone(o.OeuvreID)}
            onOpen={onOpen}
          />
        ))}
        {works.length === 0 && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '12px 4px', textAlign: 'center' }}>—</div>
        )}
      </div>
    </div>
  )
}

// ── Work card ─────────────────────────────────────────────────

function WorkCard({ o, tM, onMarkDone, onOpen }: {
  o:          Oeuvre
  tM:         Record<number, string>
  onMarkDone: () => void
  onOpen:     (o: Oeuvre) => void
}) {
  const { t, lang } = useI18n()
  const router     = useRouter()
  const techLabel  = o.Technique != null ? tM[o.Technique] : null
  const year       = yearOf(o.Année)
  const isCommission = (o as any).IsCommission
  const isFramed     = o.Encadree
  const deadline     = (o as any).DateLivraison ? String((o as any).DateLivraison).slice(0, 10) : null
  const deadlinePast = deadline ? new Date(deadline) < new Date() : false

  return (
    <div style={{
      border: `1px solid ${isCommission ? 'var(--ac)' : 'var(--bd)'}`,
      padding: '6px 7px', background: 'var(--bg2)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg0)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
    >
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        {/* Thumbnail */}
        <div onClick={() => onOpen(o)} style={{
          width: 40, height: 40, flexShrink: 0, cursor: 'pointer',
          background: 'var(--bg0)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {o.txtImageNameLink
            ? <WorkThumb file={o.txtImageNameLink} alt={o.Titre ?? ''} />
            : <MissingThumb id={o.OeuvreID} onOpen={() => onOpen(o)} />}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen(o)}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 2 }}>
            #{o.OeuvreID}{year ? ` · ${year}` : ''}
          </div>
          <div style={{
            fontSize: 13, color: 'var(--tx)', lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {o.Titre ?? '—'}
          </div>
          {techLabel && <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>{techLabel}</div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          {/* Mark done */}
          <button
            onClick={(e) => { e.stopPropagation(); onMarkDone() }}
            title={t('prod_tab_mark_done_title')}
            style={{
              fontSize: 13, padding: '2px 6px', color: 'var(--tx3)',
              background: 'transparent', border: '1px solid transparent',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--sage)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--sage)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tx3)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
          >✓</button>
          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/atelier?work=${o.OeuvreID}`) }}
            title={t('edit')}
            style={{
              fontSize: 12, padding: '2px 6px', color: 'var(--tx3)',
              background: 'transparent', border: '1px solid transparent',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ac)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tx3)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
          >✎</button>
        </div>
      </div>

      {/* Badges */}
      {(isFramed || (isCommission && (deadline || true))) && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 47 }}>
          {isFramed && (
            <span style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--tx3)', border: '1px solid var(--bd)', padding: '2px 6px' }}>
              {t('prod_tab_badge_framed')}
            </span>
          )}
          {isCommission && deadline && (
            <span style={{
              fontSize: 10, letterSpacing: 0.5, padding: '2px 6px',
              color: deadlinePast ? 'var(--rust)' : 'var(--ac)',
              border: `1px solid ${deadlinePast ? 'var(--rust)' : 'var(--ac)'}`,
            }}>
              {deadlinePast ? '⚠ ' : '⏱ '}
              {new Date(deadline).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {isCommission && !deadline && (
            <span style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--rust)', border: '1px solid var(--rust)', padding: '2px 6px' }}>
              {t('prod_tab_commission_no_date')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const FIELD_ISSUE_TYPE_KEYS: Partial<Record<string, DictKey>> = {
  suggestion: 'system_task_type_suggestion',
  improvement: 'system_task_type_improvement',
  maintenance: 'system_task_type_maintenance',
  backlog: 'system_task_type_backlog',
  bug: 'system_task_type_bug',
}

function issuePriorityColor(priority: string | null): string {
  if (priority === 'P1') return '#e05252'
  if (priority === 'P2') return '#d4843a'
  if (priority === 'P4') return 'var(--tx3)'
  return 'var(--ac)'
}

function MaterialOverview({
  fieldIssues,
  actionTypes,
  oeuvresById,
  onOpen,
}: {
  fieldIssues: FieldIssue[]
  actionTypes: ActionType[]
  oeuvresById: Map<number, Oeuvre>
  onOpen: (o: Oeuvre) => void
}) {
  const { t, lang } = useI18n()
  const linkedCount = fieldIssues.filter((issue) => issue.oeuvre_id && issue.work_action_type_id).length
  const highCount = fieldIssues.filter((issue) => issue.severity === 'high' || issue.severity === 'critical').length
  const unlinkedCount = fieldIssues.filter((issue) => !issue.oeuvre_id || !issue.work_action_type_id).length
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'

  return (
    <section
      aria-labelledby="material-overview-heading"
      style={{
        flexShrink: 0,
        margin: '0 0 12px',
        padding: 12,
        border: '1px solid var(--bd)',
        background: 'var(--bg0)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 12px' }}>
        <div id="material-overview-heading" className="t-label">
          {t('material_overview_title')}
        </div>
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11 }}>
          {t('material_overview_stats')
            .replace('{open}', String(fieldIssues.length))
            .replace('{high}', String(highCount))
            .replace('{unlinked}', String(unlinkedCount))}
        </div>
      </div>
      <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11, lineHeight: 1.4 }}>
        {t('material_overview_subtitle')}
      </div>

      {fieldIssues.length === 0 ? (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11 }}>
          {t('material_overview_empty')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {fieldIssues.slice(0, 6).map((issue) => {
            const work = issue.oeuvre_id ? oeuvresById.get(issue.oeuvre_id) : undefined
            const actionType = issue.work_action_type_id
              ? actionTypes.find((at) => at.id === issue.work_action_type_id)
              : undefined
            const typeKey = issue.type ? FIELD_ISSUE_TYPE_KEYS[issue.type] : undefined
            const photoSrc = issue.photo_r2_key ? thumbUrl(issue.photo_r2_key) ?? imageUrl(issue.photo_r2_key) : null
            const linkedLabel = work && actionType
              ? t('material_overview_linked')
                  .replace('{work}', `#${work.OeuvreID}${work.Titre ? ` · ${work.Titre}` : ''}`)
                  .replace('{step}', workActionTypeDisplayLabel(actionType.id, actionType.label, t))
              : issue.oeuvre_id
                ? t('material_overview_work_only').replace('{id}', String(issue.oeuvre_id))
                : t('material_overview_needs_triage')

            return (
              <article
                key={issue.id}
                style={{
                  border: '1px solid var(--bd)',
                  background: 'var(--bg1)',
                  padding: 10,
                  display: 'flex',
                  gap: 10,
                  minWidth: 0,
                }}
              >
                {photoSrc ? (
                  <Image
                    src={photoSrc}
                    alt=""
                    width={54}
                    height={54}
                    unoptimized
                    loading="lazy"
                    style={{ width: 54, height: 54, objectFit: 'cover', border: '1px solid var(--bd)', flexShrink: 0 }}
                  />
                ) : null}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                    <span className="t-mono-sm" style={{ color: issuePriorityColor(issue.priority), fontSize: 10 }}>
                      {issue.priority ?? 'P3'}
                    </span>
                    <span className="t-mono-sm" style={{ color: issue.severity === 'high' ? '#d4843a' : 'var(--tx3)', fontSize: 10 }}>
                      {issue.severity ?? 'low'}
                    </span>
                    {typeKey ? (
                      <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>
                        {t(typeKey)}
                      </span>
                    ) : null}
                    <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>
                      {new Date(issue.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {issue.action}
                  </div>
                  <div className="t-mono-sm" style={{ color: work && actionType ? 'var(--ac)' : 'var(--rust)', fontSize: 10, marginTop: 5, lineHeight: 1.35 }}>
                    {linkedLabel}
                  </div>
                  {work ? (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => onOpen(work)}
                      style={{ marginTop: 8, minHeight: 32, fontSize: 11 }}
                    >
                      {t('material_overview_open_work')}
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {linkedCount > 0 ? (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>
          {t('material_overview_linked_count').replace('{n}', String(linkedCount))}
        </div>
      ) : null}
    </section>
  )
}

// ── Action type manager ───────────────────────────────────────

// Fields that can be written back on the Oeuvres table (automation dropdown)
const FIELD_OPTIONS: readonly { value: string; labelKey: DictKey | null }[] = [
  { value: '', labelKey: null },
  { value: 'Montee', labelKey: 'prod_tab_field_mounted' },
  { value: 'Encadree', labelKey: 'prod_tab_field_framed' },
  { value: 'Exposable', labelKey: 'prod_tab_field_exposable' },
  { value: 'Catalogué', labelKey: 'prod_tab_field_catalogued' },
]

function ActionTypeManager({ actionTypes, onRefresh, onClose }: {
  actionTypes: ActionType[]
  onRefresh:   () => void
  onClose:     () => void
}) {
  const { t } = useI18n()
  const sb = createClient()
  const [newLabel,    setNewLabel]    = useState('')
  const [newColor,    setNewColor]    = useState('#6e7a8a')
  const [newFieldKey, setNewFieldKey] = useState('')
  const [saving,      setSaving]      = useState(false)

  async function addType() {
    if (!newLabel.trim()) return
    setSaving(true)
    const { error } = await sb.from('work_action_type').insert({
      label:      newLabel.trim(),
      color:      newColor,
      field_key:  newFieldKey || null,
      sort_order: actionTypes.length,
    })
    if (error) {
      alert(t('prod_tab_err_add_type').replace('{msg}', error.message))
    } else {
      setNewLabel('')
      setNewFieldKey('')
      invalidateWorkActionTypesCache()
      await onRefresh()
    }
    setSaving(false)
  }

  async function deleteType(id: number) {
    if (!confirm(t('prod_tab_confirm_delete_column'))) return
    const { error } = await sb.from('work_action_type').delete().eq('id', id)
    if (error) {
      alert(t('prod_tab_err_delete_type').replace('{msg}', error.message))
    } else {
      invalidateWorkActionTypesCache()
      onRefresh()
    }
  }

  return (
    <div style={{
      marginBottom: 12, padding: '12px 16px',
      background: 'var(--bg0)', border: '1px solid var(--bd)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)' }}>
          {t('prod_tab_col_manager_title')}
        </div>
        <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid var(--bd)', color: 'var(--tx3)' }}>{t('close')}</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {actionTypes.map((at) => (
          <div key={at.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', border: '1px solid var(--bd)', background: 'var(--bg1)',
            borderRadius: 2,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: at.color }} />
            <span style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>{workActionTypeDisplayLabel(at.id, at.label, t)}</span>
            {at.field_key && (
              <span title={t('prod_tab_auto_update_tt').replace('{field}', at.field_key)} style={{ fontSize: 11, color: 'var(--ac)', opacity: 0.8 }}>⚡</span>
            )}
            <button
              type="button"
              onClick={() => deleteType(at.id)}
              title={t('prod_tab_delete_column_title')}
              aria-label={t('prod_tab_delete_column_title')}
              style={{ fontSize: 14, color: 'var(--tx3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', marginLeft: 8, minHeight: 44, minWidth: 44 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#c06060')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--tx3)')}
            >✕</button>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--bg1)', paddingTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase' }}>{t('label')}</div>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addType()}
            placeholder={t('prod_tab_new_type_ph')}
            style={{ padding: '8px 12px', fontSize: 13, background: 'var(--bg1)', border: '1px solid var(--bd)', color: 'var(--tx)', width: 180 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase' }}>{t('prod_tab_color')}</div>
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            style={{ width: 32, height: 32, border: '1px solid var(--bd)', cursor: 'pointer', background: 'none', padding: 0 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase' }}>{t('prod_tab_automation')}</div>
          <select
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
            style={{ padding: '8px 12px', fontSize: 13, background: 'var(--bg1)', border: '1px solid var(--bd)', color: 'var(--tx)', outline: 'none' }}
          >
            {FIELD_OPTIONS.map((f) => {
              const label =
                f.labelKey === null
                  ? t('prod_tab_automation_none')
                  : t('prod_tab_automation_done_fmt').replace('{field}', t(f.labelKey))
              return (
                <option key={f.value || '__none'} value={f.value}>
                  {label}
                </option>
              )
            })}
          </select>
        </div>

        <button
          onClick={addType} disabled={saving || !newLabel.trim()}
          style={{ 
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', 
            background: 'var(--ac)', color: 'var(--bg0)', border: 'none',
            marginTop: 18, alignSelf: 'flex-start'
          }}
        >{saving ? t('prod_tab_saving_btn') : t('prod_tab_add_column_btn')}</button>
      </div>
    </div>
  )
}
