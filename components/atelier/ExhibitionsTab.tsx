'use client'

// ExhibitionsTab — full exhibition hub.
// Left sidebar: all pipeline processes (exhibitions / residencies / fairs).
// Right: selected exhibition detail — steps progress, linked works, contact,
//        dates, notes, and (inside "Mise en espace" sub-tab) the floor plan tool.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Oeuvre } from '@/lib/types/database'
import {
  fetchLayouts, createLayout, saveLayout, uploadFloorplan, deleteLayout, getFloorplanSignedUrl,
  type ExhibitionLayout, type Wall, type Placement,
} from '@/app/atelier/exhibitions/actions'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Step {
  id:               string
  nom:              string
  statut:           string
  date_echeance:    string | null
  position:         number
  notes:            string | null
  overdue_override: boolean
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
  width: '100%', padding: '6px 10px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

const STATUT_COLORS: Record<string, string> = {
  en_cours: 'var(--ac)',
  gagne:    '#4caf82',
  termine:  '#888',
  perdu:    '#c06060',
  annule:   '#c06060',
}

const STEP_COLORS: Record<string, string> = {
  fait:     '#4caf82',
  en_cours: 'var(--ac)',
  a_faire:  'var(--bd)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function thumbUrl(o: Oeuvre): string | null {
  if (!o.txtImageNameLink) return null
  const base = o.txtImageNameLink.replace(/\.[^.]+$/, '')
  return R2 ? `${R2}/thumbs/${base}.avif` : null
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Step pill ─────────────────────────────────────────────────────────────────

function StepPill({ step }: { step: Step }) {
  const color = STEP_COLORS[step.statut] ?? 'var(--bd)'
  const isDone = step.statut === 'fait'
  const isActive = step.statut === 'en_cours'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
      borderBottom: '1px solid var(--bg2)',
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: isDone ? color : 'transparent',
        border: `2px solid ${color}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 11, color: isDone ? 'var(--tx3)' : 'var(--tx)',
          textDecoration: isDone ? 'line-through' : 'none',
        }}>{step.nom}</span>
        {step.date_echeance && (
          <span style={{ fontSize: 9, color: isActive ? 'var(--ac)' : 'var(--tx3)', marginLeft: 8 }}>
            {fmtDate(step.date_echeance)}
          </span>
        )}
      </div>
      {isActive && (
        <span style={{ fontSize: 9, color: 'var(--ac)', letterSpacing: 0.5 }}>EN COURS</span>
      )}
    </div>
  )
}

// ── WorkChip (draggable for floor plan) ──────────────────────────────────────

function WorkChip({ oeuvre, onDragStart }: { oeuvre: Oeuvre; onDragStart: (id: number, e: React.DragEvent) => void }) {
  const thumb = thumbUrl(oeuvre)
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
      {thumb && <img src={thumb} alt="" style={{ width: 32, height: 32, objectFit: 'cover', flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {oeuvre.Titre ?? 'S/T'}
        </div>
        <div style={{ fontSize: 9, color: 'var(--tx3)' }}>#{oeuvre.OeuvreID}</div>
      </div>
    </div>
  )
}

// ── WallStrip ─────────────────────────────────────────────────────────────────

function WallStrip({ wall, placements, oeuvres, onDrop, onRemove, onReorder }: {
  wall: Wall; placements: Placement[]; oeuvres: Oeuvre[]
  onDrop: (wallId: string, oeuvreId: number) => void
  onRemove: (wallId: string, oeuvreId: number) => void
  onReorder: (wallId: string, fromIdx: number, toIdx: number) => void
}) {
  const [over, setOver] = useState(false)
  const dragIdx = useRef<number | null>(null)
  const wallPlacements = placements.filter((p) => p.wall_id === wall.id)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setOver(false)
    const id = Number(e.dataTransfer.getData('oeuvre_id'))
    if (id) onDrop(wall.id, id)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: 1, color: wall.color, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: wall.color, flexShrink: 0 }} />
        {wall.nom}
        <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>({wallPlacements.length})</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        style={{
          minHeight: 56, display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6,
          border: `1px dashed ${over ? wall.color : 'var(--bd)'}`,
          background: over ? 'var(--bg2)' : 'var(--bg0)',
          borderRadius: 2, transition: 'all .15s',
        }}
      >
        {wallPlacements.length === 0 && (
          <div style={{ fontSize: 9, color: 'var(--tx3)', alignSelf: 'center', padding: '0 4px' }}>
            Déposer des œuvres ici
          </div>
        )}
        {wallPlacements.map((p, idx) => {
          const o = oeuvres.find((x) => x.OeuvreID === p.oeuvre_id)
          const thumb = o ? thumbUrl(o) : null
          return (
            <div
              key={p.oeuvre_id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('wall_move', '1'); dragIdx.current = idx }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation()
                if (dragIdx.current !== null && dragIdx.current !== idx) {
                  onReorder(wall.id, dragIdx.current, idx)
                  dragIdx.current = null
                }
              }}
              style={{ position: 'relative', cursor: 'grab' }}
              title={o?.Titre ?? `#${p.oeuvre_id}`}
            >
              {thumb ? (
                <img src={thumb} alt="" style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: 64, height: 64, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--tx3)' }}>
                  #{p.oeuvre_id}
                </div>
              )}
              <button
                onClick={() => onRemove(wall.id, p.oeuvre_id)}
                style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#c00', color: '#fff', border: 'none', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DefaultRoomSVG ────────────────────────────────────────────────────────────

function DefaultRoomSVG({ walls }: { walls: Wall[] }) {
  const n = walls.length
  const segments = [
    { label: 'top',    x1: 60, y1: 40,  x2: 240, y2: 40  },
    { label: 'right',  x1: 240, y1: 40, x2: 240, y2: 160 },
    { label: 'bottom', x1: 240, y1: 160,x2: 60,  y2: 160 },
    { label: 'left',   x1: 60, y1: 160, x2: 60,  y2: 40  },
  ]
  return (
    <svg viewBox="0 0 300 200" style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block' }}>
      <rect x="50" y="30" width="200" height="140" fill="var(--bg1)" stroke="var(--bd)" strokeWidth="1" />
      {segments.slice(0, n).map((seg, i) => (
        <g key={i}>
          <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={walls[i]?.color ?? '#888'} strokeWidth="6" strokeLinecap="round" />
          <text x={(seg.x1 + seg.x2) / 2} y={(seg.y1 + seg.y2) / 2 - 4} textAnchor="middle" fontSize="8" fill={walls[i]?.color ?? '#888'}>
            {walls[i]?.nom}
          </text>
        </g>
      ))}
      <text x="150" y="100" textAnchor="middle" fontSize="9" fill="var(--tx3)">Plan par défaut</text>
    </svg>
  )
}

// ── FloorPlanTool ─────────────────────────────────────────────────────────────

function FloorPlanTool({ exhibitionId, oeuvres }: { exhibitionId: string; oeuvres: Oeuvre[] }) {
  const [layouts, setLayouts]   = useState<ExhibitionLayout[]>([])
  const [selected, setSelected] = useState<ExhibitionLayout | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [subTab, setSubTab]     = useState<'murs' | 'parametres'>('murs')
  const dragOeuvreId = useRef<number | null>(null)

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

  function handleDragStart(oeuvreId: number) {
    dragOeuvreId.current = oeuvreId
  }

  function handleDropOnWall(wallId: string, oeuvreId: number) {
    if (!layout) return
    if (layout.placements.some((p) => p.oeuvre_id === oeuvreId)) return
    patchLocal({ placements: [...layout.placements, { oeuvre_id: oeuvreId, wall_id: wallId, position: 50, scale: 1 }] })
  }

  function handleRemove(wallId: string, oeuvreId: number) {
    if (!layout) return
    patchLocal({ placements: layout.placements.filter((p) => !(p.wall_id === wallId && p.oeuvre_id === oeuvreId)) })
  }

  function handleReorder(wallId: string, fromIdx: number, toIdx: number) {
    if (!layout) return
    const wallPlacements = layout.placements.filter((p) => p.wall_id === wallId)
    const others = layout.placements.filter((p) => p.wall_id !== wallId)
    const moved = [...wallPlacements]
    const [item] = moved.splice(fromIdx, 1)
    moved.splice(toIdx, 0, item)
    patchLocal({ placements: [...others, ...moved] })
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

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Layout list */}
      <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 4 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nouvelle mise…" style={{ ...inputSt, flex: 1, fontSize: 9 }} />
            <button type="submit" className="btn sm" disabled={creating || !newName.trim()}>+</button>
          </form>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {layouts.length === 0 ? (
            <div style={{ padding: '12px 10px', fontSize: 9, color: 'var(--tx3)', fontStyle: 'italic' }}>Aucune mise en espace.</div>
          ) : layouts.map((l) => (
            <button key={l.id} onClick={() => setSelected(l)} style={{
              width: '100%', textAlign: 'left', padding: '8px 10px',
              background: selected?.id === l.id ? 'var(--bg2)' : 'transparent',
              border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
              borderLeft: selected?.id === l.id ? '2px solid var(--ac)' : '2px solid transparent',
            }}>
              <div style={{ fontSize: 10, color: 'var(--tx)' }}>{l.nom}</div>
              <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 1 }}>{l.placements.length} œuvre{l.placements.length !== 1 ? 's' : ''}</div>
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
          <div style={{ fontSize: 11 }}>Aucune mise en espace pour cette exposition.</div>
          <div style={{ fontSize: 10, color: 'var(--tx3)' }}>Créez-en une dans le panneau de gauche pour commencer à placer des œuvres.</div>
        </div>
      ) : layout ? (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Work sidebar */}
          <div style={{ width: 140, flexShrink: 0, borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', fontSize: 9, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)' }}>
              Œuvres exposables
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
              {exposable.map((o) => (
                <WorkChip key={o.OeuvreID} oeuvre={o} onDragStart={(id, e) => {
                  dragOeuvreId.current = id
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
                  padding: '6px 14px', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
                  background: subTab === t ? 'var(--bg2)' : 'transparent',
                  border: 'none', borderBottom: subTab === t ? '2px solid var(--ac)' : '2px solid transparent',
                  color: subTab === t ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer',
                }}>
                  {t === 'murs' ? 'Murs & placement' : 'Paramètres'}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={handleSave} disabled={saving} className="btn sm" style={{ margin: '4px 8px' }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>

            {subTab === 'murs' ? (
              <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                {/* Floor plan */}
                <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  {floorplanUrl ? (
                    <img src={floorplanUrl} alt="Plan" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', border: '1px solid var(--bd)' }} />
                  ) : (
                    <DefaultRoomSVG walls={layout.walls} />
                  )}
                  <label className="btn sm" style={{ cursor: uploading ? 'wait' : 'pointer', fontSize: 9, opacity: uploading ? 0.6 : 1 }}>
                    {uploading ? 'Upload en cours…' : floorplanUrl ? 'Changer le plan' : 'Uploader un plan'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFloorplanUpload} disabled={uploading} />
                  </label>
                  {uploadError && (
                    <div style={{ fontSize: 9, color: '#c06060', background: '#c0606022', border: '1px solid #c06060', padding: '4px 8px', maxWidth: 280, wordBreak: 'break-all' }}>
                      ⚠ {uploadError}
                    </div>
                  )}
                </div>
                {/* Wall strips */}
                <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--bd)', overflowY: 'auto', padding: 10 }}>
                  {layout.walls.map((wall) => (
                    <WallStrip key={wall.id} wall={wall} placements={layout.placements} oeuvres={oeuvres}
                      onDrop={handleDropOnWall} onRemove={handleRemove} onReorder={handleReorder} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Nom</div>
                  <input value={layout.nom} onChange={(e) => patchLocal({ nom: e.target.value })} style={inputSt} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Murs</div>
                  {layout.walls.map((w) => (
                    <div key={w.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <input type="color" value={w.color} onChange={(e) => updateWall(w.id, 'color', e.target.value)}
                        style={{ width: 24, height: 24, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }} />
                      <input value={w.nom} onChange={(e) => updateWall(w.id, 'nom', e.target.value)}
                        style={{ ...inputSt, flex: 1 }} />
                      <button onClick={() => removeWall(w.id)} className="btn sm" style={{ color: '#c06060', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={addWall} className="btn sm">+ Mur</button>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Notes</div>
                  <textarea value={layout.notes ?? ''} onChange={(e) => patchLocal({ notes: e.target.value })}
                    rows={4} style={{ ...inputSt, resize: 'vertical' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 11 }}>
          Créez une mise en espace pour commencer.
        </div>
      )}
    </div>
  )
}

// ── ExhibitionDetail ──────────────────────────────────────────────────────────

function ExhibitionDetail({ exhibition, oeuvres, contacts }: {
  exhibition: Exhibition
  oeuvres:    Oeuvre[]
  contacts:   { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'works' | 'floorplan'>('overview')

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
    { id: 'overview',  label: 'Aperçu'       },
    { id: 'works',     label: `Œuvres${linkedWorks.length ? ` (${linkedWorks.length})` : ''}` },
    { id: 'floorplan', label: 'Mise en espace'},
  ] as const

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 0', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tx)', marginBottom: 4 }}>{exhibition.nom}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--tx3)', flexWrap: 'wrap' }}>
              {contact && <span>📍 {contactName}</span>}
              {exhibition.localisation && <span>🗺 {exhibition.localisation}</span>}
              {exhibition.date_debut && <span>Du {fmtDate(exhibition.date_debut)}</span>}
              {exhibition.date_fin && <span>au {fmtDate(exhibition.date_fin)}</span>}
              {exhibition.url && <a href={exhibition.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ac)', textDecoration: 'none' }}>🔗 Site</a>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              display: 'inline-block', padding: '2px 10px', fontSize: 9, letterSpacing: 1,
              textTransform: 'uppercase', borderRadius: 2,
              background: `${STATUT_COLORS[exhibition.statut] ?? 'var(--bd)'}22`,
              color: STATUT_COLORS[exhibition.statut] ?? 'var(--tx3)',
              border: `1px solid ${STATUT_COLORS[exhibition.statut] ?? 'var(--bd)'}`,
            }}>
              {exhibition.statut.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4caf82' : 'var(--ac)', transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--tx3)', flexShrink: 0 }}>{stepsDone}/{stepsTotal} étapes</div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)} style={{
              padding: '5px 14px', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--ac)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: activeTab === 'floorplan' ? 'none' : 'block', overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Steps */}
              <div>
                <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10 }}>Étapes</div>
                {exhibition.steps.length === 0 ? (
                  <div style={{ fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic' }}>Aucune étape définie.</div>
                ) : (
                  exhibition.steps.map((s) => <StepPill key={s.id} step={s} />)
                )}
              </div>
              {/* Info */}
              <div>
                <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10 }}>Infos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Type',       exhibition.type ?? '—'],
                    ['Contact',    contactName],
                    ['Lieu',       exhibition.localisation ?? '—'],
                    ['Début',      fmtDate(exhibition.date_debut)],
                    ['Fin',        fmtDate(exhibition.date_fin)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                      <div style={{ width: 70, flexShrink: 0, color: 'var(--tx3)', fontSize: 10 }}>{label}</div>
                      <div style={{ color: 'var(--tx)' }}>{val}</div>
                    </div>
                  ))}
                  {exhibition.url && (
                    <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                      <div style={{ width: 70, flexShrink: 0, color: 'var(--tx3)', fontSize: 10 }}>URL</div>
                      <a href={exhibition.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ac)' }}>{exhibition.url}</a>
                    </div>
                  )}
                </div>
                {exhibition.notes && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 6 }}>Notes</div>
                    <div style={{ fontSize: 11, color: 'var(--tx)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{exhibition.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'works' && (
          <div style={{ padding: 16 }}>
            {linkedWorks.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--tx3)', fontStyle: 'italic' }}>
                Aucune œuvre liée à ce contact pour le moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {linkedWorks.map((o) => {
                  const thumb = thumbUrl(o)
                  return (
                    <div key={o.OeuvreID} style={{ width: 120, flexShrink: 0 }}>
                      <div style={{ width: 120, height: 120, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' }}>
                        {thumb
                          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 9, color: 'var(--tx3)' }}>#{o.OeuvreID}</span>}
                      </div>
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <FloorPlanTool exhibitionId={exhibition.id} oeuvres={oeuvres} />
        </div>
      )}
    </div>
  )
}

// ── ExhibitionsTab ────────────────────────────────────────────────────────────

export function ExhibitionsTab({ oeuvres, contacts }: {
  oeuvres:  Oeuvre[]
  contacts: { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
}) {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [selected,    setSelected]    = useState<Exhibition | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<'all' | 'en_cours' | 'gagne' | 'termine'>('all')
  const [creating,    setCreating]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [newNom,      setNewNom]      = useState('')
  const [newType,     setNewType]     = useState('exposition')

  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: processes } = await supabase
      .from('suivi_process')
      .select('id, nom, type, statut, date_debut, date_fin, contact_id, localisation, url, notes, created_at')
      .order('date_fin', { ascending: false, nullsFirst: false })

    const { data: steps } = await supabase
      .from('suivi_etape')
      .select('id, process_id, nom, statut, date_echeance, position, notes, overdue_override')
      .order('position')

    const list: Exhibition[] = (processes ?? []).map((p: any) => ({
      ...p,
      steps: (steps ?? []).filter((s: any) => s.process_id === p.id),
    }))

    setExhibitions(list)
    if (list.length > 0 && !selected) setSelected(list[0])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newNom.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('suivi_process')
      .insert({ nom: newNom.trim(), type: newType, statut: 'en_cours' })
      .select()
      .single()
    setCreating(false)
    if (!error && data) {
      const ex: Exhibition = { ...data, steps: [] }
      setExhibitions((prev) => [ex, ...prev])
      setSelected(ex)
      setNewNom(''); setShowNew(false)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return exhibitions
    return exhibitions.filter((e) => e.statut === filter)
  }, [exhibitions, filter])

  if (loading) return <div style={{ padding: 40, fontSize: 11, color: 'var(--tx3)' }}>Chargement…</div>

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setShowNew((v) => !v)} className="btn sm" style={{ flexShrink: 0 }}>+ Nouveau</button>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{ ...inputSt, fontSize: 9, flex: 1, padding: '4px 6px' }}>
            <option value="all">Tous</option>
            <option value="en_cours">En cours</option>
            <option value="gagne">Gagnés</option>
            <option value="termine">Terminés</option>
          </select>
        </div>

        {/* New form */}
        {showNew && (
          <form onSubmit={handleCreate} style={{ padding: '10px 12px', borderBottom: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={newNom} onChange={(e) => setNewNom(e.target.value)} placeholder="Nom de l'exposition…" style={inputSt} autoFocus />
            <select value={newType} onChange={(e) => setNewType(e.target.value)} style={inputSt}>
              <option value="exposition">Exposition</option>
              <option value="foire">Foire / Salon</option>
              <option value="residence">Résidence</option>
              <option value="autre">Autre</option>
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" disabled={creating || !newNom.trim()} className="btn sm" style={{ flex: 1 }}>Créer</button>
              <button type="button" onClick={() => setShowNew(false)} className="btn sm">Annuler</button>
            </div>
          </form>
        )}

        {/* Exhibition list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic' }}>Aucune exposition.</div>
          ) : filtered.map((ex) => {
            const done  = ex.steps.filter((s) => s.statut === 'fait').length
            const total = ex.steps.length
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0
            const accentColor = STATUT_COLORS[ex.statut] ?? 'var(--bd)'
            return (
              <button key={ex.id} onClick={() => setSelected(ex)} style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                background: selected?.id === ex.id ? 'var(--bg2)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
                borderLeft: selected?.id === ex.id ? `3px solid ${accentColor}` : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--tx)', fontWeight: selected?.id === ex.id ? 500 : 400, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ex.nom}
                  </div>
                  <div style={{ fontSize: 8, color: accentColor, flexShrink: 0, letterSpacing: 0.5 }}>
                    {pct}%
                  </div>
                </div>
                <div style={{ marginTop: 4, height: 2, background: 'var(--bg2)', borderRadius: 1 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: accentColor, borderRadius: 1 }} />
                </div>
                <div style={{ marginTop: 3, fontSize: 8, color: 'var(--tx3)' }}>
                  {ex.type ?? 'exposition'}
                  {ex.date_fin && <span> · {fmtDate(ex.date_fin)}</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Stats footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 12, fontSize: 9, color: 'var(--tx3)' }}>
          <span>{exhibitions.filter((e) => e.statut === 'en_cours').length} en cours</span>
          <span>{exhibitions.filter((e) => e.statut === 'gagne').length} gagnés</span>
          <span>{exhibitions.filter((e) => e.statut === 'termine').length} terminés</span>
        </div>
      </div>

      {/* ── Detail ────────────────────────────────────────────── */}
      {selected ? (
        <ExhibitionDetail
          key={selected.id}
          exhibition={selected}
          oeuvres={oeuvres}
          contacts={contacts}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 11 }}>
          Sélectionnez ou créez une exposition.
        </div>
      )}
    </div>
  )
}
