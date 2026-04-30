'use client'

// ExhibitionsTab — floor plan layout tool.
// Left: list of exhibition layouts.
// Right: selected layout editor — floor plan canvas + wall strips with draggable work thumbnails.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Oeuvre } from '@/lib/types/database'
import {
  fetchLayouts, createLayout, saveLayout, uploadFloorplan, deleteLayout,
  fetchExhibitionProcesses,
  type ExhibitionLayout, type Wall, type Placement,
} from '@/app/atelier/exhibitions/actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''

const WALL_COLORS = ['#c8a86e','#60a0a0','#a060a0','#a0a060','#c06060','#6080c0','#80c080','#c08060']

const inputSt: React.CSSProperties = {
  width: '100%', padding: '6px 10px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

// ── Thumb helper ──────────────────────────────────────────────────────────────

function thumbUrl(o: Oeuvre): string | null {
  if (!o.txtImageNameLink) return null
  if (R2) {
    const base = o.txtImageNameLink.replace(/\.[^.]+$/, '')
    return `${R2}/thumbs/${base}.avif`
  }
  return null
}

// ── Work chip (draggable from sidebar) ───────────────────────────────────────

function WorkChip({ oeuvre, onDragStart }: {
  oeuvre:      Oeuvre
  onDragStart: (id: number) => void
}) {
  const thumb = thumbUrl(oeuvre)
  return (
    <div
      draggable
      onDragStart={() => onDragStart(oeuvre.OeuvreID)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
        border: '1px solid var(--bd)', background: 'var(--bg1)',
        cursor: 'grab', marginBottom: 4, userSelect: 'none',
      }}
    >
      {thumb && (
        <img src={thumb} alt="" style={{ width: 32, height: 32, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {oeuvre.Titre ?? 'S/T'}
        </div>
        <div style={{ fontSize: 9, color: 'var(--tx3)' }}>#{oeuvre.OeuvreID}</div>
      </div>
    </div>
  )
}

// ── Wall strip (drop target) ──────────────────────────────────────────────────

function WallStrip({ wall, placements, oeuvres, onDrop, onRemove, onReorder }: {
  wall:      Wall
  placements: Placement[]
  oeuvres:   Oeuvre[]
  onDrop:    (wallId: string, oeuvreId: number) => void
  onRemove:  (wallId: string, oeuvreId: number) => void
  onReorder: (wallId: string, fromIdx: number, toIdx: number) => void
}) {
  const [over, setOver] = useState(false)
  const dragIdx = useRef<number | null>(null)

  const wallPlacements = placements.filter((p) => p.wall_id === wall.id)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setOver(false)
    const id = Number(e.dataTransfer.getData('oeuvre_id'))
    if (id) onDrop(wall.id, id)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9, letterSpacing: 1, color: wall.color,
        textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: wall.color, flexShrink: 0 }} />
        {wall.nom}
        <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>({wallPlacements.length} œuvre{wallPlacements.length !== 1 ? 's' : ''})</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        style={{
          minHeight: 72, padding: 6,
          border: `1px solid ${over ? wall.color : 'var(--bd)'}`,
          background: over ? `${wall.color}11` : 'var(--bg0)',
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {wallPlacements.length === 0 ? (
          <div style={{ fontSize: 9, color: 'var(--tx3)', padding: '4px 6px', fontStyle: 'italic' }}>
            Glisser des œuvres ici…
          </div>
        ) : (
          wallPlacements.map((p, idx) => {
            const o = oeuvres.find((w) => w.OeuvreID === p.oeuvre_id)
            const thumb = o ? thumbUrl(o) : null
            return (
              <div
                key={p.oeuvre_id}
                draggable
                onDragStart={() => { dragIdx.current = idx }}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (dragIdx.current !== null && dragIdx.current !== idx) {
                    onReorder(wall.id, dragIdx.current, idx)
                    dragIdx.current = null
                  }
                }}
                style={{
                  position: 'relative', width: 64, cursor: 'grab',
                  border: `1px solid ${wall.color}66`,
                }}
                title={o?.Titre ?? `#${p.oeuvre_id}`}
              >
                {thumb ? (
                  <img src={thumb} alt="" style={{ width: '100%', height: 64, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: 64, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--tx3)' }}>#{p.oeuvre_id}</span>
                  </div>
                )}
                <div style={{ fontSize: 8, color: 'var(--tx3)', padding: '2px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o?.Titre ?? `#${p.oeuvre_id}`}
                </div>
                <button
                  onClick={() => onRemove(wall.id, p.oeuvre_id)}
                  style={{
                    position: 'absolute', top: 2, right: 2,
                    background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                    width: 14, height: 14, fontSize: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0,
                  }}
                  title="Retirer"
                >×</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Layout editor ─────────────────────────────────────────────────────────────

function LayoutEditor({ layout: initial, oeuvres, processes, onSaved, onDeleted }: {
  layout:    ExhibitionLayout
  oeuvres:   Oeuvre[]
  processes: { id: string; nom: string }[]
  onSaved:   (l: ExhibitionLayout) => void
  onDeleted: (id: string) => void
}) {
  const [layout,    setLayout]    = useState<ExhibitionLayout>(initial)
  const [dirty,     setDirty]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [dragId,    setDragId]    = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [tab,       setTab]       = useState<'walls'|'settings'>('walls')
  const fileRef = useRef<HTMLInputElement>(null)

  // Keep in sync if parent changes (e.g. after create)
  useEffect(() => { setLayout(initial); setDirty(false) }, [initial.id])

  function patch(p: Partial<ExhibitionLayout>) {
    setLayout((l) => ({ ...l, ...p }))
    setDirty(true)
  }

  // Works not yet placed anywhere
  const placedIds = new Set(layout.placements.map((p) => p.oeuvre_id))

  // Sidebar oeuvres — all exposable + those already placed
  const sidebarWorks = useMemo(() =>
    oeuvres.filter((o) => o.Exposable || placedIds.has(o.OeuvreID)),
    [oeuvres, layout.placements],
  )

  function handleDragStart(oeuvreId: number) {
    setDragId(oeuvreId)
  }

  function handleDropOnWall(wallId: string, oeuvreId: number) {
    if (layout.placements.some((p) => p.oeuvre_id === oeuvreId && p.wall_id === wallId)) return
    // Remove from other walls first
    const without = layout.placements.filter((p) => p.oeuvre_id !== oeuvreId)
    const newP: Placement = { oeuvre_id: oeuvreId, wall_id: wallId, position: 50, scale: 1 }
    patch({ placements: [...without, newP] })
    setDragId(null)
  }

  function handleRemove(wallId: string, oeuvreId: number) {
    patch({ placements: layout.placements.filter((p) => !(p.oeuvre_id === oeuvreId && p.wall_id === wallId)) })
  }

  function handleReorder(wallId: string, fromIdx: number, toIdx: number) {
    const wallP = layout.placements.filter((p) => p.wall_id === wallId)
    const rest  = layout.placements.filter((p) => p.wall_id !== wallId)
    const reordered = [...wallP]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    patch({ placements: [...rest, ...reordered] })
  }

  function addWall() {
    const id    = `w${Date.now()}`
    const color = WALL_COLORS[layout.walls.length % WALL_COLORS.length]
    patch({ walls: [...layout.walls, { id, nom: `Mur ${layout.walls.length + 1}`, color }] })
  }

  function updateWall(id: string, field: 'nom' | 'color', value: string) {
    patch({ walls: layout.walls.map((w) => w.id === id ? { ...w, [field]: value } : w) })
  }

  function removeWall(id: string) {
    patch({
      walls:      layout.walls.filter((w) => w.id !== id),
      placements: layout.placements.filter((p) => p.wall_id !== id),
    })
  }

  async function save() {
    setSaving(true)
    const res = await saveLayout(layout.id, {
      nom:        layout.nom,
      walls:      layout.walls,
      placements: layout.placements,
      notes:      layout.notes,
      process_id: layout.process_id,
    })
    setSaving(false)
    if ('ok' in res) { setDirty(false); onSaved(layout) }
  }

  async function handleFloorplanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await uploadFloorplan(layout.id, fd)
    setUploading(false)
    if ('ok' in res) {
      patch({ floorplan_path: `floorplans/${layout.id}.${file.name.split('.').pop()}` })
    }
    e.target.value = ''
  }

  async function handleDelete() {
    if (!confirm(`Supprimer la mise en espace "${layout.nom}" ?`)) return
    await deleteLayout(layout.id, layout.floorplan_path)
    onDeleted(layout.id)
  }

  const floorplanUrl = layout.floorplan_path ? `${R2}/${layout.floorplan_path}` : null

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

      {/* ── Left: work sidebar ─────────────────────────────────── */}
      <div style={{
        width: 180, flexShrink: 0, borderRight: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bd)', fontSize: 9, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase' }}>
          Œuvres exposables
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {sidebarWorks.map((o) => (
            <div
              key={o.OeuvreID}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('oeuvre_id', String(o.OeuvreID))
                handleDragStart(o.OeuvreID)
              }}
            >
              <WorkChip oeuvre={o} onDragStart={handleDragStart} />
            </div>
          ))}
          {sidebarWorks.length === 0 && (
            <div style={{ fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic' }}>
              Aucune œuvre exposable.
            </div>
          )}
        </div>
      </div>

      {/* ── Center: editor ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderBottom: '1px solid var(--bd)', flexShrink: 0,
        }}>
          <input
            value={layout.nom}
            onChange={(e) => patch({ nom: e.target.value })}
            style={{ ...inputSt, width: 220, fontSize: 12, fontWeight: 500 }}
          />
          <div style={{ flex: 1 }} />
          {dirty && <span style={{ fontSize: 9, color: 'var(--ac)', letterSpacing: 1 }}>NON SAUVEGARDÉ</span>}
          <button className="btn sm" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          <button className="btn ghost sm" style={{ color: 'var(--rust)' }} onClick={handleDelete}>
            Supprimer
          </button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
          {(['walls', 'settings'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 16px', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
              background: tab === t ? 'var(--bg2)' : 'transparent',
              color: tab === t ? 'var(--tx)' : 'var(--tx3)',
              border: 'none', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--ac)' : '2px solid transparent',
            }}>
              {t === 'walls' ? 'Murs & placement' : 'Paramètres'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {tab === 'walls' && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

              {/* Floor plan image */}
              <div style={{ width: 280, flexShrink: 0 }}>
                <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Plan de salle
                </div>
                <div style={{
                  border: '1px solid var(--bd)', background: 'var(--bg0)',
                  width: 280, minHeight: 200, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {floorplanUrl ? (
                    <img src={floorplanUrl} alt="Plan de salle"
                      style={{ width: '100%', height: 'auto', display: 'block' }} />
                  ) : (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 10 }}>
                        Aucun plan chargé.<br />Importer une image (scan, PDF screenshot, etc.)
                      </div>
                      <DefaultRoomSVG walls={layout.walls} />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ flex: 1 }}>
                    {uploading ? 'Envoi…' : '↑ Importer un plan'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFloorplanUpload} />
                </div>
              </div>

              {/* Walls */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase' }}>
                    Accrochage par mur
                  </div>
                  <button className="btn ghost sm" onClick={addWall} style={{ fontSize: 9 }}>+ Mur</button>
                </div>
                {layout.walls.map((wall) => (
                  <WallStrip
                    key={wall.id}
                    wall={wall}
                    placements={layout.placements}
                    oeuvres={oeuvres}
                    onDrop={handleDropOnWall}
                    onRemove={handleRemove}
                    onReorder={handleReorder}
                  />
                ))}
                {layout.walls.length === 0 && (
                  <div style={{ fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic' }}>
                    Aucun mur. Cliquez "+ Mur" pour commencer.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div style={{ maxWidth: 480 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  Lier à un processus (pipeline)
                </div>
                <select
                  value={layout.process_id ?? ''}
                  onChange={(e) => patch({ process_id: e.target.value || null })}
                  style={inputSt}
                >
                  <option value="">— Aucun processus lié</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  Murs (renommer, couleur)
                </div>
                {layout.walls.map((w) => (
                  <div key={w.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input type="color" value={w.color}
                      onChange={(e) => updateWall(w.id, 'color', e.target.value)}
                      style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--bd)', background: 'none', cursor: 'pointer', flexShrink: 0 }} />
                    <input value={w.nom}
                      onChange={(e) => updateWall(w.id, 'nom', e.target.value)}
                      style={{ ...inputSt, flex: 1 }} />
                    <button onClick={() => removeWall(w.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--rust)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>×</button>
                  </div>
                ))}
                <button className="btn ghost sm" onClick={addWall} style={{ marginTop: 4 }}>+ Ajouter un mur</button>
              </div>

              <div>
                <div style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
                <textarea value={layout.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })}
                  style={{ ...inputSt, height: 96, resize: 'vertical' }}
                  placeholder="Notes sur l'accrochage, contraintes de la salle…" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Default room SVG (no floor plan uploaded) ─────────────────────────────────

function DefaultRoomSVG({ walls }: { walls: Wall[] }) {
  // Simple bird's-eye rectangle with colored wall segments
  const wNames = walls.slice(0, 4)
  return (
    <svg width="200" height="160" viewBox="0 0 200 160" style={{ display: 'block', margin: '0 auto' }}>
      {/* Room outline */}
      <rect x="20" y="20" width="160" height="120" fill="none" stroke="var(--bd)" strokeWidth="1.5" />
      {/* Wall color segments */}
      {wNames[0] && <line x1="20" y1="20" x2="180" y2="20" stroke={wNames[0].color} strokeWidth="4" />}
      {wNames[1] && <line x1="180" y1="20" x2="180" y2="140" stroke={wNames[1].color} strokeWidth="4" />}
      {wNames[2] && <line x1="180" y1="140" x2="20" y2="140" stroke={wNames[2].color} strokeWidth="4" />}
      {wNames[3] && <line x1="20" y1="140" x2="20" y2="20" stroke={wNames[3].color} strokeWidth="4" />}
      {/* Labels */}
      {wNames[0] && <text x="100" y="16" textAnchor="middle" fontSize="7" fill={wNames[0].color}>{wNames[0].nom}</text>}
      {wNames[1] && <text x="194" y="82" textAnchor="middle" fontSize="7" fill={wNames[1].color} transform="rotate(90,194,82)">{wNames[1].nom}</text>}
      {wNames[2] && <text x="100" y="156" textAnchor="middle" fontSize="7" fill={wNames[2].color}>{wNames[2].nom}</text>}
      {wNames[3] && <text x="6" y="82" textAnchor="middle" fontSize="7" fill={wNames[3].color} transform="rotate(-90,6,82)">{wNames[3].nom}</text>}
      {/* Entry arrow */}
      <text x="100" y="90" textAnchor="middle" fontSize="9" fill="var(--tx3)">↓ entrée</text>
    </svg>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function ExhibitionsTab({ oeuvres }: { oeuvres: Oeuvre[] }) {
  const [layouts,   setLayouts]   = useState<ExhibitionLayout[]>([])
  const [processes, setProcesses] = useState<{ id: string; nom: string }[]>([])
  const [selected,  setSelected]  = useState<ExhibitionLayout | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)
  const [newName,   setNewName]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [ls, ps] = await Promise.all([fetchLayouts(), fetchExhibitionProcesses()])
    setLayouts(ls)
    setProcesses(ps)
    if (ls.length > 0 && !selected) setSelected(ls[0])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const res = await createLayout(newName.trim())
    setCreating(false)
    if ('ok' in res) {
      setLayouts((prev) => [res.layout, ...prev])
      setSelected(res.layout)
      setNewName('')
    }
  }

  function handleSaved(updated: ExhibitionLayout) {
    setLayouts((prev) => prev.map((l) => l.id === updated.id ? updated : l))
    setSelected(updated)
  }

  function handleDeleted(id: string) {
    const remaining = layouts.filter((l) => l.id !== id)
    setLayouts(remaining)
    setSelected(remaining[0] ?? null)
  }

  if (loading) return <div style={{ padding: 40, fontSize: 11, color: 'var(--tx3)' }}>Chargement…</div>

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Sidebar: layout list ───────────────────────────────── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bd)' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 6 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nouvelle mise en espace…"
              style={{ ...inputSt, flex: 1, fontSize: 10 }}
            />
            <button type="submit" className="btn sm" disabled={creating || !newName.trim()}>+</button>
          </form>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {layouts.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic' }}>
              Aucune mise en espace.<br />Créez-en une ci-dessus.
            </div>
          ) : layouts.map((l) => {
            const proc = processes.find((p) => p.id === l.process_id)
            const totalWorks = l.placements.length
            return (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: selected?.id === l.id ? 'var(--bg2)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--bd)',
                  cursor: 'pointer',
                  borderLeft: selected?.id === l.id ? '3px solid var(--ac)' : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--tx)', fontWeight: selected?.id === l.id ? 500 : 400 }}>
                  {l.nom}
                </div>
                <div style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 2 }}>
                  {totalWorks} œuvre{totalWorks !== 1 ? 's' : ''}
                  {proc && <span> · {proc.nom}</span>}
                </div>
                <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 1 }}>
                  {new Date(l.updated_at).toLocaleDateString('fr-FR')}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main: selected layout editor ──────────────────────── */}
      {selected ? (
        <LayoutEditor
          key={selected.id}
          layout={selected}
          oeuvres={oeuvres}
          processes={processes}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 11 }}>
          Créez une mise en espace pour commencer.
        </div>
      )}
    </div>
  )
}
