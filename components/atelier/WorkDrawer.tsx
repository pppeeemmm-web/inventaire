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
import type { Oeuvre } from '@/lib/types/database'
import { WorkStateChip } from './WorkStateChip'

// PEM's ContactID — default owner
const PEM_CONTACT_ID = 13

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
}

interface ActionType { id: number; label: string; color: string; field_key: string | null }
interface WorkAction { action_type_id: number; done: boolean }

export function WorkDrawer({ 
  o, tM, sM, cM, pM, statusLabelMap, selection, setSelection, onClose,
  thM, oeuvreThemeMap, oeuvreGroupMap, groupNameMap
}: Props) {
  const { t }  = useI18n()
  const router = useRouter()
  const isSel  = selection.has(o.OeuvreID)
  const st     = statusOf(o, statusLabelMap)
  const isSold = st === 'sold'
  const isLoan = st === 'loan' || st === 'consigned'

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
        <div className="thumb" style={{ aspectRatio: '4/3', marginBottom: 20, background: 'var(--bg0)', flexShrink: 0 }}>
          {o.txtImageNameLink
            ? <img
                src={thumbUrl(o.txtImageNameLink, 1080) ?? ''}
                alt={o.Titre ?? ''}
                style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              />
            : <div className="ph">—</div>}
        </div>

        {/* Title */}
        <h2 className="serif" style={{ fontSize: 32, color: 'var(--tx)', lineHeight: 1.1, marginBottom: 16 }}>
          {o.Titre || t('untitled')}
        </h2>

        {/* Metadata Pipes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 28 }}>
          
          {/* Pipe 1: Identity & Physicality */}
          <section>
            <SectionTitle title="Identity & Physicality" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('year')}</div>
              <div style={{ color: 'var(--tx2)' }}>{yearOf(o.Année) ?? '—'}</div>

              <div className="t-label">{t('technique')}</div>
              <div style={{ color: 'var(--tx2)' }}>{(o.Technique != null && tM[o.Technique]) || '—'}</div>

              <div className="t-label">{t('support')}</div>
              <div style={{ color: 'var(--tx2)' }}>{(o.Support != null && sM[o.Support]) || '—'}</div>

              <div className="t-label">{t('dimensions')}</div>
              <div style={{ color: 'var(--tx2)' }}>{dims ?? '—'}</div>

              <div className="t-label">Presentation</div>
              <div style={{ color: (o as any).PresentationID != null ? 'var(--tx2)' : 'var(--tx3)' }}>
                {(o as any).PresentationID != null ? (pM[(o as any).PresentationID] ?? '—') : '—'}
              </div>

              <div className="t-label">{t('themes')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(() => {
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
                })()}
              </div>
            </div>
          </section>

          {/* Pipe 2: Logistics & Ownership */}
          <section>
            <SectionTitle title="Logistics & Ownership" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('contact')}</div>
              <div style={{ color: 'var(--tx2)' }}>
                {o.ContactID != null ? (cM[o.ContactID] ?? 'Pem') : 'Pem'}
              </div>

              <div className="t-label">{t('localisation')}</div>
              <div style={{ color: 'var(--tx2)' }}>
                {o.LocalisationID != null ? (cM[o.LocalisationID] ?? 'Atelier') : 'Atelier'}
              </div>

              {isLoan && (
                <>
                  <div className="t-label">Retour prévu</div>
                  <div style={{ color: (o as any).ReturnDate ? 'var(--ac)' : 'var(--tx3)' }}>
                    {fmtDate((o as any).ReturnDate) ?? '—'}
                  </div>
                </>
              )}

              <div className="t-label">{t('workingGroups')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(() => {
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
                })()}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle title="Production & Readiness" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('status')}</div>
              <div><StatusChip s={st} /></div>

              <div className="t-label">Production</div>
              <div><WorkStateChip o={o} statusLabelMap={statusLabelMap} /></div>

              <div className="t-label">{t('framed')}</div>
              <div style={{ color: o.Encadree ? 'var(--tx2)' : 'var(--tx3)' }}>{o.Encadree ? '✓' : '—'}</div>

              <div className="t-label">Exposable</div>
              <div style={{ color: o.Exposable ? 'var(--sage)' : 'var(--tx3)' }}>
                {o.Exposable ? '✓' : '—'}
              </div>
            </div>

            {/* Pipeline Steps inside Production Pipe */}
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
          </section>

          {/* Pipe 4: Financials & Sales */}
          <section>
            <SectionTitle title="Financials & Sales" />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div className="t-label">{t('price')}</div>
              <div style={{ color: 'var(--tx2)' }}>
                {(() => {
                  const p = (o as any).PrixFinal ?? o.Prix
                  if (p && p > 0) return `€\u202f${Number(p).toLocaleString('fr-FR')}`
                  return isSold ? '—' : t('priceOnRequest')
                })()}
              </div>

              {(o as any).Discount != null && (o as any).Discount > 0 && (
                <>
                  <div className="t-label">Discount</div>
                  <div style={{ color: 'var(--rust)' }}>{(o as any).Discount}%</div>
                </>
              )}

              <div className="t-label">{t('commission')}</div>
              <div style={{ color: o.IsCommission ? 'var(--tx2)' : 'var(--tx3)' }}>{o.IsCommission ? '✓' : '—'}</div>

              {o.IsCommission && (
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
        {o.Commentaires && (
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
            <button
              className="btn ghost"
              onClick={() => router.push(`/atelier/works/${o.OeuvreID}/edit`)}
            >
              Éditer
            </button>
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
