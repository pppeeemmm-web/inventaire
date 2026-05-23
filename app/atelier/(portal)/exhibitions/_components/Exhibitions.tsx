'use client'

// Exhibitions — full exhibition hub.
// Left sidebar: all pipeline processes (exhibitions / residencies / fairs).
// Right: selected exhibition detail — steps progress, linked works, contact,
//        dates, notes, and (inside "Mise en espace" sub-tab) the floor plan tool.

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import type { Oeuvre } from '@/lib/types/database'
import { thumbUrl } from '@/lib/data'
import {
  fetchLayouts, createLayout, saveLayout, uploadFloorplan, deleteLayout, getFloorplanSignedUrl,
  listExhibitionsWithSteps,
  createExhibitionProcess,
  deleteExhibitionProcess,
  updateExhibitionProcess,
  assignWorksToExhibitionContact,
  type ExhibitionLayout, type Wall, type Placement,
} from '@/app/atelier/(portal)/exhibitions/actions'
import {
  disconnectCalendar,
  getCalendarConnectStatus,
  pushExhibitionToCalendars,
  startCalendarOAuth,
} from '@/app/atelier/calendar/actions'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { ConstellationCanvas, type NodeMap, type Pt } from '@/components/atelier/ConstellationCanvas'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { ExhibitionsTabSkeleton } from '@/components/atelier/ExhibitionsTabSkeleton'
import { ExhibitionsListPanel } from '@/components/atelier/exhibitions/ExhibitionsListPanel'
import { ExhibitionStepsPanel } from '@/components/atelier/exhibitions/ExhibitionStepsPanel'
import { ExhibitionFloorPlanEditor } from '@/components/atelier/exhibitions/ExhibitionFloorPlanEditor'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Step {
  id:               string
  process_id:       string
  nom:              string
  statut:           string
  date_echeance:    string | null
  position:         number
  notes:            string | null
  overdue_override: boolean | null
}

interface Exhibition {
  id:          string
  nom:         string
  type:        string | null
  statut:      string
  date_debut:  string | null
  date_fin:    string | null
  contact_id:  number | null
  localisation:string | null
  url:         string | null
  notes:       string | null
  steps:       Step[]
  created_at:  string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '' // used for work thumbnails only

const WALL_COLORS = ['#c8a86e','#60a0a0','#a060a0','#a0a060','#c06060','#6080c0','#80c080','#c08060']

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

const STATUT_COLORS: Record<string, string> = {
  a_confirmer: '#a0a040', // To confirm (Gold/Mustard)
  prevue:      '#6080c0', // Planned (Blue)
  en_cours:    'var(--ac)', // Current (Orange/Action)
  passee:      '#888',     // Passed (Grey)
}

const STATUT_LABELS: Record<string, string> = {
  a_confirmer: 'À confirmer',
  prevue:      'Prévue',
  en_cours:    'En cours',
  passee:      'Passée',
}

const STEP_COLORS: Record<string, string> = {
  fait:     '#4caf82',
  en_cours: 'var(--ac)',
  a_faire:  'var(--bd)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Step pill ─────────────────────────────────────────────────────────────────

function StepPill({ step, onToggle, onRename, onDelete }: { 
  step: Step; 
  onToggle?: (id: string, next: string) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
}) {
  const color = STEP_COLORS[step.statut] ?? 'var(--bd)'
  const isDone = step.statut === 'fait'
  const isActive = step.statut === 'en_cours'
  const [editing, setEditing] = useState(false)
  const [temp, setTemp] = useState(step.nom)

  function handleToggle() {
    if (!onToggle) return
    const sequence = ['a_faire', 'en_cours', 'fait']
    const idx = sequence.indexOf(step.statut)
    const next = sequence[(idx + 1) % sequence.length]
    onToggle(step.id, next)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
      borderBottom: '1px solid var(--bg2)',
    }}>
      <div 
        onClick={handleToggle}
        style={{
          width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
          background: isDone ? color : 'transparent',
          border: `2px solid ${color}`,
          cursor: onToggle ? 'pointer' : 'default',
          transition: 'all 0.2s'
        }} 
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {editing ? (
          <input 
            autoFocus
            value={temp}
            onChange={e => setTemp(e.target.value)}
            onBlur={() => { setEditing(false); if (temp.trim() && temp !== step.nom) onRename?.(step.id, temp.trim()) }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            style={{ ...inputSt, padding: '4px 8px', fontSize: 12, height: 24 }}
          />
        ) : (
          <span 
            onDoubleClick={() => setEditing(true)}
            style={{
              fontSize: 13, color: isDone ? 'var(--tx3)' : 'var(--tx)',
              textDecoration: isDone ? 'line-through' : 'none',
              cursor: 'text'
            }}>{step.nom}</span>
        )}
        {step.date_echeance && !editing && (
          <span style={{ fontSize: 11, color: isActive ? 'var(--ac)' : 'var(--tx3)', marginLeft: 10 }}>
            {fmtDate(step.date_echeance)}
          </span>
        )}
      </div>
      {isActive && !editing && (
        <span style={{ fontSize: 11, color: 'var(--ac)', letterSpacing: 0.5 }}>EN COURS</span>
      )}
      {onDelete && (
        <button 
          onClick={() => onDelete(step.id)}
          style={{ border: 'none', background: 'transparent', color: 'var(--tx3)', fontSize: 14, cursor: 'pointer', padding: '0 4px', opacity: 0.5 }}
        >×</button>
      )}
    </div>
  )
}

// ── WorkChip (draggable for floor plan) ──────────────────────────────────────

function WorkChip({ oeuvre, onDragStart }: { oeuvre: Oeuvre; onDragStart: (id: number, e: React.DragEvent) => void }) {
  const thumb = oeuvre.txtImageNameLink
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(oeuvre.OeuvreID, e)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
        border: '1px solid var(--bd)', background: 'var(--bg1)',
        cursor: 'grab', marginBottom: 4, userSelect: 'none',
      }}
    >
      {oeuvre.txtImageNameLink && (
        <div style={{ width: 40, height: 40, position: 'relative', flexShrink: 0 }}>
          <WorkThumb file={oeuvre.txtImageNameLink} size={256} alt="" />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {oeuvre.Titre ?? 'S/T'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>#{oeuvre.OeuvreID}</div>
      </div>
    </div>
  )
}

// ── FloorPlanTool ─────────────────────────────────────────────────────────────

function FloorPlanTool({ exhibitionId, oeuvres, themes, tM }: { 
  exhibitionId: string; 
  oeuvres: Oeuvre[]; 
  themes: { id: number; name: string }[];
  tM: Record<number, string>;
}) {
  const { t } = useI18n()
  const [layouts, setLayouts]   = useState<ExhibitionLayout[]>([])
  const [selected, setSelected] = useState<ExhibitionLayout | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [subTab, setSubTab]     = useState<'murs' | 'parametres'>('murs')
  const [bgOpacity, setBgOpacity] = useState(0.7)

  const load = useCallback(async () => {
    const ls = await fetchLayouts()
    // Show layouts linked to this exhibition, plus unlinked ones as candidates
    const linked = ls.filter((l) => l.process_id === exhibitionId || l.process_id === null)
    setLayouts(linked)
    // Auto-select first linked one, else first available
    const preferred = ls.find((l) => l.process_id === exhibitionId) ?? linked[0] ?? null
    setSelected((prev) => prev ?? preferred)
  }, [exhibitionId])

  useEffect(() => { load() }, [load])

  const layout = selected

  function patchLocal(p: Partial<ExhibitionLayout>) {
    if (!layout) return
    const updated = { ...layout, ...p }
    setSelected(updated)
    setLayouts((prev) => prev.map((l) => l.id === updated.id ? updated : l))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const res = await createLayout(newName.trim(), exhibitionId)
    setCreating(false)
    if ('ok' in res) {
      setLayouts((prev) => [res.layout, ...prev])
      setSelected(res.layout)
      setNewName('')
    }
  }

  async function handleSave() {
    if (!layout) return
    setSaving(true)
    await saveLayout(layout.id, { walls: layout.walls, placements: layout.placements, notes: layout.notes, nom: layout.nom })
    setSaving(false)
  }

  async function handleFloorplanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !layout) return
    setUploading(true)
    setUploadError(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await uploadFloorplan(layout.id, fd)
      if ('ok' in res) {
        patchLocal({ floorplan_path: res.key })
      } else {
        setUploadError(res.error)
      }
    } catch (err) {
      setUploadError(String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function addWall() {
    if (!layout) return
    const i = layout.walls.length % WALL_COLORS.length
    const id = `w${Date.now()}`
    patchLocal({ walls: [...layout.walls, { id, nom: `Mur ${layout.walls.length + 1}`, color: WALL_COLORS[i] }] })
  }

  function updateWall(id: string, field: 'nom' | 'color', value: string) {
    if (!layout) return
    patchLocal({ walls: layout.walls.map((w) => w.id === id ? { ...w, [field]: value } : w) })
  }

  function removeWall(id: string) {
    if (!layout) return
    patchLocal({
      walls: layout.walls.filter((w) => w.id !== id),
      placements: layout.placements.filter((p) => p.wall_id !== id),
    })
  }

  const exposable = useMemo(() => oeuvres.filter((o) => o.Exposable), [oeuvres])

  // Direct public URL for floor plans (stored in public paintings bucket)
  const floorplanUrl = layout?.floorplan_path
    ? `${R2}/${layout.floorplan_path}`
    : null

  // Convert placements to NodeMap for ConstellationCanvas
  const initialPositions = useMemo(() => {
    if (!layout) return new Map()
    const m = new Map()
    layout.placements.forEach(p => {
      if (p.x != null && p.y != null) {
        // In ConstellationCanvas, we work with logical pixels. 
        // Exhibition layout currently uses percentages (0-100).
        // Let's assume a 1000px base for the floorplan if it's percentage-based?
        // Actually, ConstellationCanvas doesn't care about the scale as long as it's consistent.
        m.set(p.oeuvre_id, { x: p.x * 10, y: p.y * 10 })
      }
    })
    return m
  }, [layout])

  const handleConstellationDrop = (id: number, wx: number, wy: number) => {
    if (!layout) return
    // Convert logical coordinates back to percentages
    const x = wx / 10
    const y = wy / 10

    const existingIdx = layout.placements.findIndex(p => p.oeuvre_id === id)
    if (existingIdx >= 0) {
      const next = [...layout.placements]
      next[existingIdx] = { ...next[existingIdx], x, y }
      patchLocal({ placements: next })
    } else {
      patchLocal({ placements: [...layout.placements, { oeuvre_id: id, wall_id: 'canvas', position: 50, scale: 1, x, y }] })
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Layout list */}
      <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 6 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nouvelle mise…" style={{ ...inputSt, flex: 1, fontSize: 11 }} />
            <button type="submit" className="btn sm" disabled={creating || !newName.trim()}>+</button>
          </form>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {layouts.length === 0 ? (
            <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--tx3)', fontStyle: 'italic' }}>{t('exh_layout_none')}</div>
          ) : layouts.map((l) => (
            <button key={l.id} onClick={() => setSelected(l)} style={{
              width: '100%', textAlign: 'left', padding: '8px 10px',
              background: selected?.id === l.id ? 'var(--bg2)' : 'transparent',
              border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
              borderLeft: selected?.id === l.id ? '2px solid var(--ac)' : '2px solid transparent',
            }}>
              <div style={{ fontSize: 13, color: 'var(--tx)' }}>{l.nom}</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{l.placements.length} œuvre{l.placements.length !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      {layouts.length === 0 && !layout ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--tx3)' }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.3 }}>
            <rect x="8" y="8" width="48" height="48" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
            <rect x="8" y="8" width="22" height="22" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <rect x="34" y="8" width="22" height="14" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <rect x="8" y="34" width="14" height="22" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
          <div style={{ fontSize: 13 }}>{t('exh_layout_none_for_exhibition')}</div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('exh_layout_create_hint')}</div>
        </div>
      ) : layout ? (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Work sidebar */}
          <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', fontSize: 11, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)' }}>
              {t('exh_candidate_works')}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
              {exposable.map((o) => (
                <WorkChip key={o.OeuvreID} oeuvre={o} onDragStart={(id, e) => {
                  e.dataTransfer.setData('oeuvre_id', String(id))
                }} />
              ))}
            </div>
          </div>

          {/* Canvas + walls */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
              {(['murs', 'parametres'] as const).map((t) => (
                <button key={t} onClick={() => setSubTab(t)} style={{
                  padding: '8px 16px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                  background: subTab === t ? 'var(--bg2)' : 'transparent',
                  border: 'none', borderBottom: subTab === t ? '2px solid var(--ac)' : '2px solid transparent',
                  color: subTab === t ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer',
                }}>
                  {t === 'murs' ? 'Placement spatial' : 'Paramètres'}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={handleSave} disabled={saving} className="btn sm" style={{ margin: '4px 8px' }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>

            {subTab === 'murs' ? (
              <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                {/* Floor plan Canvas */}
                <div style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div 
                    style={{ 
                      flex: 1, position: 'relative', background: 'var(--bg0)', 
                      border: '1px solid var(--bd)', overflow: 'hidden',
                      display: 'flex', alignItems: 'stretch'
                    }}
                  >
                    <ConstellationCanvas
                      oeuvres={oeuvres}
                      themes={themes}
                      tM={tM}
                      selection={new Set()}
                      setSelection={() => {}}
                      onOpen={() => {}}
                      onSaveGroup={async () => null}
                      backgroundImage={floorplanUrl || undefined}
                      backgroundOpacity={bgOpacity}
                      onBackgroundOpacity={setBgOpacity}
                      initialPositions={initialPositions}
                      onDropExternal={handleConstellationDrop}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 24px', borderTop: '1px solid var(--bd)', background: 'var(--bg1)' }}>
                    <label className="btn sm" style={{ cursor: uploading ? 'wait' : 'pointer', fontSize: 12, opacity: uploading ? 0.6 : 1 }}>
                      {uploading ? 'Upload en cours…' : floorplanUrl ? 'Changer le plan' : 'Uploader un plan'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFloorplanUpload} disabled={uploading} />
                    </label>
                    <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Glissez les œuvres sur le plan</div>
                    {uploadError && (
                      <div style={{ fontSize: 12, color: '#c06060', marginLeft: 16 }}>
                        ⚠ {uploadError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Wall strips Sidebar (Optional) */}
                <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--bd)', overflowY: 'auto', padding: 12, background: 'var(--bg1)' }}>
                  <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{t('exh_placements_heading')}</div>
                  {layout.placements.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--tx3)', fontStyle: 'italic' }}>Aucune œuvre placée.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {layout.placements.map(p => {
                        const o = oeuvres.find(x => x.OeuvreID === p.oeuvre_id)
                        return (
                          <div key={p.oeuvre_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4 }}>
                            <div style={{ flex: 1, fontSize: 10, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o?.Titre || `#${p.oeuvre_id}`}</div>
                            <button onClick={() => patchLocal({ placements: layout.placements.filter(px => px.oeuvre_id !== p.oeuvre_id) })} style={{ border: 'none', background: 'transparent', color: 'var(--tx3)', cursor: 'pointer', fontSize: 12 }}>×</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Nom</div>
                  <input value={layout.nom} onChange={(e) => patchLocal({ nom: e.target.value })} style={inputSt} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Murs</div>
                  {layout.walls.map((w) => (
                    <div key={w.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <input type="color" value={w.color} onChange={(e) => updateWall(w.id, 'color', e.target.value)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }} />
                      <input value={w.nom} onChange={(e) => updateWall(w.id, 'nom', e.target.value)}
                        style={{ ...inputSt, flex: 1 }} />
                      <button onClick={() => removeWall(w.id)} className="btn sm" style={{ color: '#c06060', flexShrink: 0, fontSize: 14 }}>×</button>
                    </div>
                  ))}
                  <button onClick={addWall} className="btn sm">+ Mur</button>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Notes</div>
                  <textarea value={layout.notes ?? ''} onChange={(e) => patchLocal({ notes: e.target.value })}
                    rows={4} style={{ ...inputSt, resize: 'vertical', fontSize: 13 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Calendar export (Google + Microsoft) ─────────────────────────────────────

function CalendarExportStrip({ exhibition }: { exhibition: Exhibition }) {
  const { t, lang } = useI18n()
  const [google, setGoogle] = useState(false)
  const [microsoft, setMicrosoft] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await getCalendarConnectStatus()
    if (!r.ok) return
    setGoogle(r.google)
    setMicrosoft(r.microsoft)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasExportableDates = !!(
    exhibition.date_debut ||
    exhibition.date_fin ||
    exhibition.steps.some((s) => s.date_echeance)
  )

  async function connect(provider: 'google' | 'microsoft') {
    setMsg(null)
    const r = await startCalendarOAuth(provider)
    if (r.ok) {
      window.location.href = r.url
      return
    }
    setMsg(t(r.errKey as DictKey))
  }

  async function disconnect(provider: 'google' | 'microsoft') {
    setMsg(null)
    const r = await disconnectCalendar(provider)
    if (!r.ok) {
      setMsg(t(r.errKey as DictKey))
      return
    }
    await load()
  }

  async function push() {
    setMsg(null)
    if (!hasExportableDates) {
      setMsg(t('calendar_sync_nothing'))
      return
    }
    if (!google && !microsoft) {
      setMsg(t('calendar_err_no_accounts'))
      return
    }
    setBusy(true)
    const r = await pushExhibitionToCalendars(exhibition.id, lang)
    setBusy(false)
    if (!r.ok) {
      const base = t(r.errKey as DictKey)
      setMsg(r.detail ? `${base} (${r.detail})` : base)
      return
    }
    if (r.pushed === 0) setMsg(t('calendar_sync_nothing'))
    else setMsg(t('calendar_sync_done').replace('{n}', String(r.pushed)))
  }

  return (
    <div
      style={{
        marginBottom: 24,
        padding: 14,
        border: '1px solid var(--bd)',
        borderRadius: 6,
        background: 'var(--bg1)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'var(--tx3)',
          marginBottom: 10,
        }}
      >
        {t('calendar_export_heading')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {!google && (
          <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => void connect('google')}>
            {t('calendar_connect_google_btn')}
          </button>
        )}
        {google && (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => void disconnect('google')}>
            {t('calendar_disconnect_google_btn')}
          </button>
        )}
        {!microsoft && (
          <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => void connect('microsoft')}>
            {t('calendar_connect_microsoft_btn')}
          </button>
        )}
        {microsoft && (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => void disconnect('microsoft')}>
            {t('calendar_disconnect_microsoft_btn')}
          </button>
        )}
      </div>
      <button
        type="button"
        className="btn primary sm"
        style={{ minHeight: 44 }}
        disabled={busy || (!google && !microsoft)}
        onClick={() => void push()}
      >
        {busy ? t('calendar_sync_busy') : t('calendar_push_btn')}
      </button>
      {msg && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--tx2)', whiteSpace: 'pre-wrap' }} role="status">
          {msg}
        </div>
      )}
    </div>
  )
}

// ── ExhibitionDetail ──────────────────────────────────────────────────────────

function ExhibitionDetail({ exhibition, oeuvres, contacts, themes, tM, selection, setSelection, onDelete, onUpdate }: {
  exhibition: Exhibition
  oeuvres:    Oeuvre[]
  contacts:   { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Email?: string | null; Tel?: string | null }[]
  themes:     { id: number; name: string }[]
  tM:         Record<number, string>
  selection:  Set<number>
  setSelection: (s: Set<number>) => void
  onDelete:   () => void
  onUpdate:   (p: Partial<Exhibition> & { _isEditing?: boolean }) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'overview' | 'works' | 'floorplan' | 'calendar'>('overview')

  const contact = contacts.find((c) => c.ContactID === exhibition.contact_id)
  const contactName = contact
    ? (contact.NomInstitution ?? [contact.Prénom, contact.Nom].filter(Boolean).join(' ') ?? '—')
    : '—'

  const stepsTotal = exhibition.steps.length
  const stepsDone  = exhibition.steps.filter((s) => s.statut === 'fait').length
  const pct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0

  // Works linked to this exhibition via PresentationID — approximate by contact match for now
  // (true linking would require exhibition_layout placements)
  const linkedWorks = useMemo(() => {
    if (!exhibition.contact_id) return []
    return oeuvres.filter((o) => o.ContactID === exhibition.contact_id)
  }, [oeuvres, exhibition.contact_id])

  const TABS = [
    { id: 'overview' as const, label: t('exhibition_tab_overview') },
    { id: 'calendar' as const, label: t('exhibition_tab_calendar') },
    { id: 'works' as const, label: t('exhibition_tab_works_label').replace('{n}', String(linkedWorks.length)) },
    { id: 'floorplan' as const, label: t('exhibition_tab_floorplan') },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 0', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--tx)' }}>{exhibition.nom}</div>
              <button onClick={onDelete} className="btn ghost sm" style={{ color: 'var(--rust)', fontSize: 11, borderColor: 'var(--rust)', opacity: 0.8 }}>{t('exh_delete_exhibition')}</button>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--tx3)', flexWrap: 'wrap' }}>
              {contact && <span>📍 {contactName}</span>}
              {contact?.Email && <span title={contact.Email}>✉️ {contact.Email}</span>}
              {contact?.Tel && <span title={contact.Tel}>📞 {contact.Tel}</span>}
              {exhibition.localisation && <span>🗺 {exhibition.localisation}</span>}
              {exhibition.date_debut && <span>Du {fmtDate(exhibition.date_debut)}</span>}
              {exhibition.date_fin && <span>au {fmtDate(exhibition.date_fin)}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <select
              value={exhibition.statut}
              onChange={(e) => onUpdate({ statut: e.target.value })}
              style={{
                background: `${STATUT_COLORS[exhibition.statut] ?? 'var(--bd)'}22`,
                color: STATUT_COLORS[exhibition.statut] ?? 'var(--tx3)',
                border: `1px solid ${STATUT_COLORS[exhibition.statut] ?? 'var(--bd)'}`,
                padding: '4px 12px', fontSize: 11, letterSpacing: 1,
                textTransform: 'uppercase', borderRadius: 2, outline: 'none', cursor: 'pointer'
              }}
            >
              {Object.entries(STATUT_LABELS).map(([k, v]) => (
                <option key={k} value={k} style={{ background: 'var(--bg1)', color: 'var(--tx)' }}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4caf82' : 'var(--ac)', transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', flexShrink: 0 }}>{stepsDone}/{stepsTotal} étapes</div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '8px 18px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--ac)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: activeTab === 'floorplan' ? 'none' : 'block', overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <ExhibitionStepsPanel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
              {/* Steps Management */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)' }}>Étapes</div>
                  <button 
                    onClick={() => {
                      const newStep: Step = { id: `s${Date.now()}`, process_id: exhibition.id, nom: 'Nouvelle étape', statut: 'a_faire', date_echeance: null, position: exhibition.steps.length, notes: null, overdue_override: false }
                      onUpdate({ steps: [...exhibition.steps, newStep] })
                    }}
                    className="btn sm" style={{ fontSize: 11, padding: '4px 10px' }}>+ Ajouter</button>
                </div>
                
                {exhibition.steps.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--tx3)', fontStyle: 'italic' }}>{t('exh_no_steps_defined')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {exhibition.steps.map((s) => (
                      <StepPill 
                        key={s.id} 
                        step={s} 
                        onToggle={(id, next) => {
                          onUpdate({ steps: exhibition.steps.map(sx => sx.id === id ? { ...sx, statut: next } : sx) })
                        }}
                        onRename={(id, name) => {
                          onUpdate({ steps: exhibition.steps.map(sx => sx.id === id ? { ...sx, nom: name } : sx) })
                        }}
                        onDelete={(id) => {
                          if (confirm(t('exhib_step_delete_confirm'))) {
                            onUpdate({ steps: exhibition.steps.filter(sx => sx.id !== id) })
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 16, fontSize: 11, color: 'var(--tx3)', fontStyle: 'italic' }}>
                  Double-cliquez sur un nom pour le modifier. Cliquez sur le cercle pour changer le statut.
                </div>
              </div>

              {/* Info Editing */}
              <div style={{ borderLeft: '1px solid var(--bg2)', paddingLeft: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)' }}>Infos</div>
                  <button 
                    onClick={() => onUpdate({ _isEditing: !exhibition['_isEditing' as keyof Exhibition] })}
                    className="btn sm" style={{ fontSize: 11, padding: '4px 10px' }}>
                    {exhibition['_isEditing' as keyof Exhibition] ? 'Terminer' : 'Éditer'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Type',    key: 'type',         val: exhibition.type },
                    { label: 'Lieu',    key: 'localisation', val: exhibition.localisation },
                    { label: 'URL',     key: 'url',          val: exhibition.url },
                    { label: 'Début',   key: 'date_debut',   val: exhibition.date_debut, type: 'date' },
                    { label: 'Fin',     key: 'date_fin',     val: exhibition.date_fin,   type: 'date' },
                  ].map((field) => (
                    <div key={field.key} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 80, flexShrink: 0, color: 'var(--tx3)', fontSize: 12 }}>{field.label}</div>
                      {exhibition['_isEditing' as keyof Exhibition] ? (
                        <input 
                          type={field.type || 'text'}
                          value={field.val ?? ''}
                          onChange={(e) => onUpdate({ [field.key]: e.target.value || null })}
                          style={{ ...inputSt, flex: 1, fontSize: 13, padding: '6px 10px' }}
                        />
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {field.key === 'url' && field.val ? (
                            <a href={field.val} target="_blank" rel="noreferrer" style={{ color: 'var(--ac)' }}>{field.val}</a>
                          ) : (
                            field.type === 'date' ? fmtDate(field.val) : (field.val ?? '—')
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 60, flexShrink: 0, color: 'var(--tx3)', fontSize: 10 }}>Contact</div>
                    {exhibition['_isEditing' as keyof Exhibition] ? (
                      <select 
                        value={exhibition.contact_id ?? ''}
                        onChange={(e) => onUpdate({ contact_id: Number(e.target.value) || null })}
                        style={{ ...inputSt, flex: 1, fontSize: 10, padding: '4px 8px' }}
                      >
                        <option value="">— Aucun —</option>
                        {contacts.map(c => (
                          <option key={c.ContactID} value={c.ContactID}>
                            {c.NomInstitution || [c.Prénom, c.Nom].filter(Boolean).join(' ') || `#${c.ContactID}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--tx)' }}>{contactName}</div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 6 }}>Notes</div>
                  {exhibition['_isEditing' as keyof Exhibition] ? (
                    <textarea 
                      value={exhibition.notes ?? ''}
                      onChange={(e) => onUpdate({ notes: e.target.value || null })}
                      rows={4}
                      style={{ ...inputSt, fontSize: 10, resize: 'vertical' }}
                    />
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--tx)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{exhibition.notes ?? '—'}</div>
                  )}
                </div>
              </div>
            </div>
          </ExhibitionStepsPanel>
        )}

        {activeTab === 'calendar' && (
          <div style={{ padding: 24 }}>
            <CalendarExportStrip exhibition={exhibition} />
            <div style={{ position: 'relative', borderLeft: '1px solid var(--bd)', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Start Date */}
              {exhibition.date_debut && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -29, top: 2, width: 9, height: 9, borderRadius: '50%', background: 'var(--ac)' }} />
                  <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('exh_calendar_start_label')}</div>
                  <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>{fmtDate(exhibition.date_debut)}</div>
                </div>
              )}

              {/* Steps */}
              {exhibition.steps.slice().sort((a,b) => (a.date_echeance ?? '').localeCompare(b.date_echeance ?? '')).map(s => (
                <div key={s.id} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -29, top: 4, width: 9, height: 9, borderRadius: '50%', background: STEP_COLORS[s.statut] ?? 'var(--bd)', border: '2px solid var(--bg1)' }} />
                  <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.statut === 'fait' ? t('exh_step_status_done') : s.statut === 'en_cours' ? t('exh_step_status_in_progress') : t('exh_step_status_todo')}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx)', marginBottom: 2 }}>{s.nom}</div>
                  {s.date_echeance && <div style={{ fontSize: 10, color: 'var(--tx2)' }}>{t('exh_step_deadline_label')} {fmtDate(s.date_echeance)}</div>}
                </div>
              ))}

              {/* End Date */}
              {exhibition.date_fin && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -29, top: 2, width: 9, height: 9, borderRadius: '50%', background: 'var(--tx3)' }} />
                  <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('exh_calendar_end_label')}</div>
                  <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>{fmtDate(exhibition.date_fin)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'works' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--tx2)' }}>
                {linkedWorks.length} œuvre{linkedWorks.length !== 1 ? 's' : ''} liée{linkedWorks.length !== 1 ? 's' : ''}
              </div>
              {selection.size > 0 && (
                <button
                  className="btn primary sm"
                  onClick={async () => {
                    if (!exhibition.contact_id) {
                      alert(t('exhib_link_contact_first'))
                      return
                    }
                    const ids = Array.from(selection)
                    const result = await assignWorksToExhibitionContact({
                      oeuvreIds: ids,
                      contactId: exhibition.contact_id,
                    })
                    if ('ok' in result) {
                      alert(t('exhib_works_linked_count_fmt').replace('{n}', String(ids.length)))
                      window.location.reload() // lazy refresh
                    }
                  }}
                >
                  Ajouter la sélection ({selection.size})
                </button>
              )}
            </div>
            {linkedWorks.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--tx3)', fontStyle: 'italic' }}>
                Aucune œuvre liée à ce contact pour le moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {linkedWorks.map((o) => {
                  const thumb = thumbUrl(o.txtImageNameLink)
                  return (
                    <div key={o.OeuvreID} style={{ width: 120, flexShrink: 0 }}>
                      <div style={{ width: 120, height: 120, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden', position: 'relative' }}>
                        {thumb
                          ? <Image src={thumb} alt={o.Titre ?? ''} fill sizes="120px" style={{ objectFit: 'cover' }} />
                          : <span style={{ fontSize: 9, color: 'var(--tx3)' }}>#{o.OeuvreID}</span>}
                      </div>
                      {o.anonymity_level === 2 && (
                        <div style={{
                          fontSize: 8, background: 'rgba(200,140,40,0.12)',
                          border: '1px solid rgba(200,140,40,0.5)', color: '#c88a20',
                          padding: '1px 5px', borderRadius: 2, marginBottom: 3,
                        }}>⚠ Non public</div>
                      )}
                      <div style={{ fontSize: 9, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.Titre ?? 'S/T'}</div>
                      <div style={{ fontSize: 8, color: 'var(--tx3)' }}>#{o.OeuvreID}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Floor plan — outside scroll container so it can fill remaining height */}
      {activeTab === 'floorplan' && (
        <ExhibitionFloorPlanEditor>
          <FloorPlanTool exhibitionId={exhibition.id} oeuvres={oeuvres} themes={themes} tM={tM} />
        </ExhibitionFloorPlanEditor>
      )}
    </div>
  )
}

// ── Exhibitions ───────────────────────────────────────────────────────────────

export function Exhibitions({ oeuvres, contacts, themes, tM, selection, setSelection }: {
  oeuvres: Oeuvre[]; 
  contacts: { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Email?: string | null; Tel?: string | null }[]; 
  themes: { id: number; name: string }[];
  tM: Record<number, string>;
  selection: Set<number>; 
  setSelection: (next: Set<number>) => void
}) {
  const { lang, t } = useI18n()
  const [oauthBanner, setOauthBanner] = useState<string | null>(null)
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [selected,    setSelected]    = useState<Exhibition | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<'all' | 'en_cours' | 'gagne' | 'termine'>('all')
  const [creating,    setCreating]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [newNom,      setNewNom]      = useState('')
  const [newType,     setNewType]     = useState('exposition')
  const [deepLinkId,  setDeepLinkId]  = useState<string | null>(null)

  // Optional deep-link: /atelier/exhibitions?exhibition=<processId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('exhibition')
    if (id) setDeepLinkId(id)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('calendar')
    if (!c) return
    if (c === 'google_ok') setOauthBanner(t('calendar_oauth_ok_google'))
    else if (c === 'microsoft_ok') setOauthBanner(t('calendar_oauth_ok_microsoft'))
    else if (c === 'google_err' || c === 'microsoft_err') {
      const code =
        params.get('calendar_err_code') ?? params.get('calendar_detail')
      setOauthBanner(
        code ? `${t('calendar_oauth_err')} (${code})` : t('calendar_oauth_err'),
      )
    }
    const u = new URL(window.location.href)
    u.searchParams.delete('calendar')
    u.searchParams.delete('calendar_err_code')
    u.searchParams.delete('calendar_detail')
    const q = u.searchParams.toString()
    window.history.replaceState({}, '', `${u.pathname}${q ? `?${q}` : ''}${u.hash}`)
  }, [t])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await listExhibitionsWithSteps()
    const list: Exhibition[] = 'ok' in result
      ? result.exhibitions.map((ex) => ({ ...ex, steps: ex.steps as Step[] }))
      : []

    setExhibitions(list)
    if (list.length > 0 && !selected) {
      const fromDeepLink = deepLinkId ? (list.find((x) => x.id === deepLinkId) ?? null) : null
      setSelected(fromDeepLink ?? list[0])
    }
    setLoading(false)
  }, [selected, deepLinkId])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!selected) return
    if (!confirm(t('exhib_delete_confirm_fmt').replace(/\{name\}/g, selected.nom))) return
    setLoading(true)
    const result = await deleteExhibitionProcess(selected.id)
    if ('ok' in result) {
      const next = exhibitions.filter(e => e.id !== selected.id)
      setExhibitions(next)
      setSelected(next[0] ?? null)
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Read live DOM value — avoids empty submit when Enter is pressed before React
    // commits the last onChange, which also kept the submit button disabled.
    const nom = String(new FormData(e.currentTarget).get('nom') ?? '').trim()
    if (!nom) return
    setCreating(true)
    const result = await createExhibitionProcess({ nom, type: newType })
    setCreating(false)
    if ('ok' in result) {
      setExhibitions((prev) => [result.exhibition as Exhibition, ...prev])
      setSelected(result.exhibition as Exhibition)
      setNewNom(''); setShowNew(false)
    }
  }

  async function handleUpdateStatus(id: string, patch: Partial<Exhibition> & { _isEditing?: boolean }) {
    const current = exhibitions.find((e) => e.id === id)?.steps ?? []
    const result = await updateExhibitionProcess({
      exhibitionId: id,
      patch: { ...patch, steps: patch.steps as Step[] | undefined },
      currentSteps: current,
    })
    if (!('ok' in result)) {
      console.error('[exhibitions] update error:', result.error)
      return
    }
    const syncedPatch = result.steps ? { ...patch, steps: result.steps as Step[] } : patch

    setExhibitions(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, ...syncedPatch }
        return updated
      }
      return e
    }))
    if (selected?.id === id) {
      setSelected(prev => {
        if (!prev) return null
        const updated = { ...prev, ...syncedPatch }
        return updated
      })
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return exhibitions
    return exhibitions.filter((e) => e.statut === filter)
  }, [exhibitions, filter])

  const showInitialSkeleton = loading && exhibitions.length === 0

  if (showInitialSkeleton) return <ExhibitionsTabSkeleton />

  return (
    <div data-testid="exhibitions-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {oauthBanner && (
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--bg2)',
            borderBottom: '1px solid var(--bd)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12 }}>{oauthBanner}</span>
          <button type="button" className="btn ghost sm" onClick={() => setOauthBanner(null)}>
            {t('close')}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

      <ExhibitionsListPanel
        selectedId={selected?.id ?? null}
        exhibitions={exhibitions}
        filteredExhibitions={filtered}
        filter={filter}
        showNew={showNew}
        creating={creating}
        newNom={newNom}
        newType={newType}
        lang={lang}
        onSelect={(id) => setSelected(exhibitions.find((ex) => ex.id === id) ?? null)}
        onToggleNew={() => setShowNew((v) => !v)}
        onSetFilter={setFilter}
        onCreate={handleCreate}
        onCancelCreate={() => setShowNew(false)}
        onSetNewNom={setNewNom}
        onSetNewType={setNewType}
      />

      {/* ── Detail ────────────────────────────────────────────── */}
      {selected ? (
        <ExhibitionDetail
          key={selected.id}
          exhibition={selected}
          oeuvres={oeuvres}
          contacts={contacts}
          themes={themes}
          tM={tM}
          selection={selection}
          setSelection={setSelection}
          onDelete={handleDelete}
          onUpdate={(p) => handleUpdateStatus(selected.id, p)}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 11 }}>
          {t('exh_select_or_create')}
        </div>
      )}
    </div>
    </div>
  )
}
