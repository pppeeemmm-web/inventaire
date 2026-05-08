'use client'

// ProductionTab — action-based task board for works.
// One column per work_action_type. A work appears in every column
// where it has a pending (done=false) work_action.
// Works that are Catalogué or sold/lost/destroyed are excluded.

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import { imageUrl, thumbUrl, yearOf, statusOf, type StatusKey } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'

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

const EXCLUDED_STATUSES: StatusKey[] = ['sold', 'gift', 'artist_archive', 'private_archive']

// ── MissingThumb ─────────────────────────────────────────────
function MissingThumb({ id, onOpen }: { id: number; onOpen?: () => void }) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: 'repeating-linear-gradient(45deg, var(--bg2), var(--bg2) 10px, var(--bg1) 10px, var(--bg1) 20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontSize: 22, fontWeight: 800, color: 'var(--tx)', opacity: 0.18,
        letterSpacing: -1, userSelect: 'none', lineHeight: 1,
      }}>{id}</span>
      {onOpen && (
        <button
          onClick={e => { e.stopPropagation(); onOpen() }}
          title="Ajouter une image"
          style={{
            position: 'absolute', bottom: 2, right: 2,
            background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.8)',
            border: 'none', borderRadius: 3,
            fontSize: 8, padding: '1px 3px', cursor: 'pointer', lineHeight: 1.4,
          }}>⊕</button>
      )}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────

interface Props {
  oeuvres:        Oeuvre[]
  tM:             Record<number, string>
  statusLabelMap: Record<number, string>
  onOpen:         (o: Oeuvre) => void
}

export function ProductionTab({ oeuvres, tM, statusLabelMap, onOpen }: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const [search,      setSearch]      = useState('')
  const [actionTypes, setActionTypes] = useState<ActionType[]>([])
  const [actions,     setActions]     = useState<WorkAction[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editingTypes, setEditingTypes] = useState(false)

  const sb = createClient()

  const loadData = useCallback(async () => {
    const [{ data: types }, { data: acts }] = await Promise.all([
      sb.from('work_action_type').select('*').order('sort_order').order('id'),
      sb.from('work_action').select('*').eq('done', false),
    ])
    if (types) setActionTypes(types)
    if (acts)  setActions(acts)
    setLoading(false)
  }, [])

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

    return oeuvres.filter((o) => {
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
  }, [oeuvres, statusLabelMap, tM, search, actions])

  const oeuvresById = useMemo(
    () => new Map(oeuvres.map((o) => [o.OeuvreID, o])),
    [oeuvres],
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
      alert("Erreur lors de la mise à jour: " + error.message)
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

  const cataloguedCount = oeuvres.filter((o) => o.Catalogué).length

  if (loading) {
    return <div className="t-mono-sm" style={{ padding: 40, color: 'var(--tx3)' }}>Chargement…</div>
  }

  return (
    <div style={{ padding: '16px 28px 0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', flex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0 }}>
        <div>
          <div className="t-label">{t('production')}</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 3 }}>
            {active.length} en production · {cataloguedCount} catalogués
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer…"
          style={{
            marginLeft: 'auto', padding: '8px 14px', fontSize: 13,
            background: 'var(--bg1)', border: '1px solid var(--bd)',
            color: 'var(--tx)', width: 220,
          }}
        />
        <button
          onClick={() => setEditingTypes((v) => !v)}
          style={{
            padding: '8px 12px', fontSize: 12, cursor: 'pointer',
            color: editingTypes ? 'var(--ac)' : 'var(--tx3)',
            background: editingTypes ? 'var(--bg2)' : 'transparent',
            border: '1px solid var(--bd)',
          }}
          title="Gérer les types d'action"
        >⚙ Colonnes</button>
      </div>

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
          flex: 1,
          alignItems: 'stretch',
        }}>
          {actionTypes.map((at) => {
            const ids   = actionMap.get(at.id) ?? new Set<number>()
            const isPhotoColumn = at.id === 6 // 'Photographier'
            const works = active.filter((o) => {
              const needsPhoto = (o as any).NeedsPhotograph || (o as any).needsphotograph
              return ids.has(o.OeuvreID) || (isPhotoColumn && needsPhoto)
            })
            return (
              <div key={at.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 120, height: '100%' }}>
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
  const [showAdd, setShowAdd] = useState(false)
  const [addQ,    setAddQ]    = useState('')

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
          <span className="t-eyebrow" style={{ 
            color: actionType.color, fontSize: 13, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{actionType.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{works.length}</span>
          <button
            onClick={() => { setShowAdd((v) => !v); setAddQ('') }}
            style={{ fontSize: 14, color: 'var(--tx3)', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
            title="Ajouter une œuvre à cette étape"
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
            placeholder="Titre ou #ID…"
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
              <div style={{ width: 16, height: 16, background: 'var(--bg0)', flexShrink: 0, overflow: 'hidden' }}>
                {o.txtImageNameLink && <img 
                  src={thumbUrl(o.txtImageNameLink, 48) ?? ''} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  alt="" 
                  onError={(e) => {
                    const full = imageUrl(o.txtImageNameLink) ?? ''
                    if (full && e.currentTarget.src !== full) e.currentTarget.src = full
                  }}
                />}
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.Titre ?? '—'}
              </div>
              <span style={{ color: 'var(--tx3)', fontSize: 11 }}>#{o.OeuvreID}</span>
            </div>
          ))}
          {addQ.trim() && suggestions.length === 0 && (
            <div className="t-mono-sm" style={{ padding: '5px 7px', color: 'var(--tx3)' }}>Aucun résultat</div>
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
        }}>
          {o.txtImageNameLink
            ? <img src={thumbUrl(o.txtImageNameLink, 128) ?? ''}
                loading="lazy" alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  // Thumb not yet backfilled — fall back to full-res image
                  const full = imageUrl(o.txtImageNameLink) ?? ''
                  if (full && e.currentTarget.src !== full) e.currentTarget.src = full
                }}
              />
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
            title="Marquer comme fait"
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
            onClick={(e) => { e.stopPropagation(); router.push(`/atelier/works/${o.OeuvreID}/edit`) }}
            title="Éditer"
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
              ENCADRÉE
            </span>
          )}
          {isCommission && deadline && (
            <span style={{
              fontSize: 10, letterSpacing: 0.5, padding: '2px 6px',
              color: deadlinePast ? 'var(--rust)' : 'var(--ac)',
              border: `1px solid ${deadlinePast ? 'var(--rust)' : 'var(--ac)'}`,
            }}>
              {deadlinePast ? '⚠ ' : '⏱ '}
              {new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {isCommission && !deadline && (
            <span style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--rust)', border: '1px solid var(--rust)', padding: '2px 6px' }}>
              ⚠ COMMISSION SANS DATE
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Action type manager ───────────────────────────────────────

// Fields that can be written back on the Oeuvres table
const FIELD_OPTIONS = [
  { value: '',          label: '— aucun' },
  { value: 'Montee',    label: 'Montée' },
  { value: 'Encadree',  label: 'Encadrée' },
  { value: 'Exposable', label: 'Exposable' },
  { value: 'Catalogué', label: 'Cataloguée' },
]

function ActionTypeManager({ actionTypes, onRefresh, onClose }: {
  actionTypes: ActionType[]
  onRefresh:   () => void
  onClose:     () => void
}) {
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
      alert("Erreur lors de l'ajout: " + error.message)
    } else {
      setNewLabel('')
      setNewFieldKey('')
      await onRefresh()
    }
    setSaving(false)
  }

  async function deleteType(id: number) {
    if (!confirm("Supprimer cette colonne ? Les actions associées seront également effacées.")) return
    const { error } = await sb.from('work_action_type').delete().eq('id', id)
    if (error) {
      alert("Erreur lors de la suppression: " + error.message)
    } else {
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
          Gestion des colonnes de production
        </div>
        <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid var(--bd)', color: 'var(--tx3)' }}>Fermer</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {actionTypes.map((at) => (
          <div key={at.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', border: '1px solid var(--bd)', background: 'var(--bg1)',
            borderRadius: 2,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: at.color }} />
            <span style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>{at.label}</span>
            {at.field_key && (
              <span title={`Auto-update: ${at.field_key}`} style={{ fontSize: 11, color: 'var(--ac)', opacity: 0.8 }}>⚡</span>
            )}
            <button
              onClick={() => deleteType(at.id)}
              title="Supprimer la colonne"
              style={{ fontSize: 14, color: 'var(--tx3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', marginLeft: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#c06060')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--tx3)')}
            >✕</button>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--bg1)', paddingTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase' }}>Libellé</div>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addType()}
            placeholder="Nouveau type…"
            style={{ padding: '8px 12px', fontSize: 13, background: 'var(--bg1)', border: '1px solid var(--bd)', color: 'var(--tx)', width: 180 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase' }}>Couleur</div>
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            style={{ width: 32, height: 32, border: '1px solid var(--bd)', cursor: 'pointer', background: 'none', padding: 0 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase' }}>Automation (Auto-cochage)</div>
          <select
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
            style={{ padding: '8px 12px', fontSize: 13, background: 'var(--bg1)', border: '1px solid var(--bd)', color: 'var(--tx)', outline: 'none' }}
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label === '— aucun' ? 'Aucune automation' : `Fait ➜ ${f.label}`}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={addType} disabled={saving || !newLabel.trim()}
          style={{ 
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', 
            background: 'var(--ac)', color: 'var(--bg0)', border: 'none',
            marginTop: 18, alignSelf: 'flex-start'
          }}
        >{saving ? 'Enregistrement…' : '+ Ajouter la colonne'}</button>
      </div>
    </div>
  )
}
