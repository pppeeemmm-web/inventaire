'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Oeuvre } from '@/lib/types/database'
import {
  fetchLayouts, createLayout, saveLayout, uploadFloorplan,
  type ExhibitionLayout,
} from '@/app/atelier/(portal)/exhibitions/actions'
import { useI18n } from '@/lib/i18n/context'
import { ConstellationCanvas } from '@/components/atelier/ConstellationCanvas'
import { WorkChip } from './WorkChip'
import { WALL_COLORS, inputSt } from './exhibitions-types'

// Direct public URL for floor plans (stored in public paintings bucket)
const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''

// ── FloorPlanTool ─────────────────────────────────────────────────────────────

export function FloorPlanTool({ exhibitionId, oeuvres, themes, tM }: {
  exhibitionId: string
  oeuvres:      Oeuvre[]
  themes:       { id: number; name: string }[]
  tM:           Record<number, string>
}) {
  const { t } = useI18n()
  const [layouts,     setLayouts]     = useState<ExhibitionLayout[]>([])
  const [selected,    setSelected]    = useState<ExhibitionLayout | null>(null)
  const [creating,    setCreating]    = useState(false)
  const [newName,     setNewName]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [subTab,      setSubTab]      = useState<'murs' | 'parametres'>('murs')
  const [bgOpacity,   setBgOpacity]   = useState(0.7)

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

  async function handleCreate(e: FormEvent) {
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

  async function handleFloorplanUpload(e: ChangeEvent<HTMLInputElement>) {
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
    const i  = layout.walls.length % WALL_COLORS.length
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
      walls:      layout.walls.filter((w) => w.id !== id),
      placements: layout.placements.filter((p) => p.wall_id !== id),
    })
  }

  const exposable = useMemo(() => oeuvres.filter((o) => o.Exposable), [oeuvres])

  const floorplanUrl = layout?.floorplan_path
    ? `${R2}/${layout.floorplan_path}`
    : null

  // Convert placements to NodeMap for ConstellationCanvas
  const initialPositions = useMemo(() => {
    if (!layout) return new Map()
    const m = new Map()
    layout.placements.forEach(p => {
      if (p.x != null && p.y != null) {
        m.set(p.oeuvre_id, { x: p.x * 10, y: p.y * 10 })
      }
    })
    return m
  }, [layout])

  const handleConstellationDrop = (id: number, wx: number, wy: number) => {
    if (!layout) return
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
            <button type="submit" className="btn sm" disabled={creating || !newName.trim()} aria-label={t('exh_create_layout_aria')}>+</button>
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
              {/* eslint-disable-next-line @typescript-eslint/no-shadow */}
              {(['murs', 'parametres'] as const).map((tab) => (
                <button key={tab} onClick={() => setSubTab(tab)} aria-pressed={subTab === tab} style={{
                  padding: '8px 16px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                  background: subTab === tab ? 'var(--bg2)' : 'transparent',
                  border: 'none', borderBottom: subTab === tab ? '2px solid var(--ac)' : '2px solid transparent',
                  color: subTab === tab ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer',
                }}>
                  {tab === 'murs' ? 'Placement spatial' : 'Paramètres'}
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
                  <div style={{
                    flex: 1, position: 'relative', background: 'var(--bg0)',
                    border: '1px solid var(--bd)', overflow: 'hidden',
                    display: 'flex', alignItems: 'stretch',
                  }}>
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
                      <div style={{ fontSize: 12, color: '#c06060', marginLeft: 16 }}>⚠ {uploadError}</div>
                    )}
                  </div>
                </div>

                {/* Placements sidebar */}
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
                            <button onClick={() => patchLocal({ placements: layout.placements.filter(px => px.oeuvre_id !== p.oeuvre_id) })} aria-label={t('exh_remove_placement_aria')} style={{ border: 'none', background: 'transparent', color: 'var(--tx3)', cursor: 'pointer', fontSize: 12 }}>×</button>
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
                      <button onClick={() => removeWall(w.id)} className="btn sm" aria-label={t('exh_remove_wall_aria')} style={{ color: '#c06060', flexShrink: 0, fontSize: 14 }}>×</button>
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
