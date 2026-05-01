'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Theme  { ThemeID: number; Nom: string }
interface Group  { id: string; name: string }

interface Props {
  initialThemes: Theme[]
  initialGroups: Group[]
  themeWorkCount: Record<number, number>
  groupWorkCount:  Record<string, number>
}

export function ThemesTab({ initialThemes, initialGroups, themeWorkCount, groupWorkCount }: Props) {
  const sb = createClient()

  const [themes,     setThemes]     = useState<Theme[]>(initialThemes)
  const [groups,     setGroups]     = useState<Group[]>(initialGroups)
  const [newTheme,   setNewTheme]   = useState('')
  const [newGroup,   setNewGroup]   = useState('')
  const [editTheme,  setEditTheme]  = useState<number | null>(null)
  const [editGroup,  setEditGroup]  = useState<string | null>(null)
  const [editVal,    setEditVal]    = useState('')
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState<string | null>(null)

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 2500) }

  // ── THEMES ──────────────────────────────────────────────────────────

  async function addTheme() {
    const name = newTheme.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await (sb.from('tblTheme') as any)
      .insert({ Nom: name }).select('ThemeID, Nom').single()
    if (!error && data) { setThemes(t => [...t, data].sort((a,b) => a.Nom.localeCompare(b.Nom))); setNewTheme(''); flash('Thème ajouté') }
    else flash('Erreur: ' + (error?.message ?? ''))
    setBusy(false)
  }

  async function saveTheme(id: number) {
    const name = editVal.trim()
    if (!name) return
    setBusy(true)
    const { error } = await (sb.from('tblTheme') as any).update({ Nom: name }).eq('ThemeID', id)
    if (!error) { setThemes(t => t.map(x => x.ThemeID === id ? { ...x, Nom: name } : x)); setEditTheme(null); flash('Thème renommé') }
    else flash('Erreur: ' + (error?.message ?? ''))
    setBusy(false)
  }

  async function deleteTheme(id: number) {
    if (!confirm('Supprimer ce thème ? Les liens avec les œuvres seront supprimés.')) return
    setBusy(true)
    await (sb.from('OeuvreTheme') as any).delete().eq('ThemeID', id)
    const { error } = await (sb.from('tblTheme') as any).delete().eq('ThemeID', id)
    if (!error) { setThemes(t => t.filter(x => x.ThemeID !== id)); flash('Thème supprimé') }
    else flash('Erreur: ' + (error?.message ?? ''))
    setBusy(false)
  }

  // ── GROUPS ──────────────────────────────────────────────────────────

  async function addGroup() {
    const name = newGroup.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await (sb.from('working_group') as any)
      .insert({ name }).select('id, name').single()
    if (!error && data) { setGroups(g => [...g, data].sort((a,b) => a.name.localeCompare(b.name))); setNewGroup(''); flash('Groupe ajouté') }
    else flash('Erreur: ' + (error?.message ?? ''))
    setBusy(false)
  }

  async function saveGroup(id: string) {
    const name = editVal.trim()
    if (!name) return
    setBusy(true)
    const { error } = await (sb.from('working_group') as any).update({ name }).eq('id', id)
    if (!error) { setGroups(g => g.map(x => x.id === id ? { ...x, name } : x)); setEditGroup(null); flash('Groupe renommé') }
    else flash('Erreur: ' + (error?.message ?? ''))
    setBusy(false)
  }

  async function deleteGroup(id: string) {
    if (!confirm('Supprimer ce groupe ? Les liens avec les œuvres seront supprimés.')) return
    setBusy(true)
    await (sb.from('working_group_work') as any).delete().eq('group_id', id)
    const { error } = await (sb.from('working_group') as any).delete().eq('id', id)
    if (!error) { setGroups(g => g.filter(x => x.id !== id)); flash('Groupe supprimé') }
    else flash('Erreur: ' + (error?.message ?? ''))
    setBusy(false)
  }

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bd)' }
  const name_: React.CSSProperties = { flex: 1, fontSize: 12, color: 'var(--tx)' }
  const cnt_: React.CSSProperties = { fontSize: 10, color: 'var(--tx3)', minWidth: 60, textAlign: 'right' }
  const btn_: React.CSSProperties = { fontSize: 9, letterSpacing: 1, padding: '3px 8px', border: '1px solid var(--bd2)', color: 'var(--tx2)', background: 'none', cursor: 'pointer', textTransform: 'uppercase' }

  return (
    <div style={{ padding: 32, maxWidth: 760, margin: '0 auto' }}>

      {msg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--ac)', color: '#000', padding: '8px 20px', fontSize: 11, zIndex: 999 }}>
          {msg}
        </div>
      )}

      {/* ── THEMES ── */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 24, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>
          Thèmes <span style={{ marginLeft: 8, color: 'var(--tx3)' }}>{themes.length}</span>
        </div>

        {themes.map(t => (
          <div key={t.ThemeID} style={row}>
            {editTheme === t.ThemeID ? (
              <>
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTheme(t.ThemeID); if (e.key === 'Escape') setEditTheme(null) }}
                  style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--ac)', color: 'var(--tx)', padding: '4px 8px', fontSize: 12 }}
                />
                <button style={btn_} onClick={() => saveTheme(t.ThemeID)} disabled={busy}>Sauver</button>
                <button style={{ ...btn_, borderColor: 'transparent' }} onClick={() => setEditTheme(null)}>Annuler</button>
              </>
            ) : (
              <>
                <span style={name_}>{t.Nom}</span>
                <span style={cnt_}>{themeWorkCount[t.ThemeID] ?? 0} œuvre{(themeWorkCount[t.ThemeID] ?? 0) !== 1 ? 's' : ''}</span>
                <button style={btn_} onClick={() => { setEditTheme(t.ThemeID); setEditVal(t.Nom) }}>Renommer</button>
                <button style={{ ...btn_, color: 'var(--rust)' }} onClick={() => deleteTheme(t.ThemeID)} disabled={busy}>Supprimer</button>
              </>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <input
            placeholder="Nouveau thème..."
            value={newTheme}
            onChange={e => setNewTheme(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTheme()}
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--bd2)', color: 'var(--tx)', padding: '6px 10px', fontSize: 11 }}
          />
          <button className="btn primary sm" onClick={addTheme} disabled={busy || !newTheme.trim()}>+ Ajouter</button>
        </div>
      </div>

      {/* ── GROUPS ── */}
      <div>
        <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 24, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>
          Groupes de travail <span style={{ marginLeft: 8, color: 'var(--tx3)' }}>{groups.length}</span>
        </div>

        {groups.map(g => (
          <div key={g.id} style={row}>
            {editGroup === g.id ? (
              <>
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGroup(g.id); if (e.key === 'Escape') setEditGroup(null) }}
                  style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--ac)', color: 'var(--tx)', padding: '4px 8px', fontSize: 12 }}
                />
                <button style={btn_} onClick={() => saveGroup(g.id)} disabled={busy}>Sauver</button>
                <button style={{ ...btn_, borderColor: 'transparent' }} onClick={() => setEditGroup(null)}>Annuler</button>
              </>
            ) : (
              <>
                <span style={name_}>{g.name}</span>
                <span style={cnt_}>{groupWorkCount[g.id] ?? 0} œuvre{(groupWorkCount[g.id] ?? 0) !== 1 ? 's' : ''}</span>
                <button style={btn_} onClick={() => { setEditGroup(g.id); setEditVal(g.name) }}>Renommer</button>
                <button style={{ ...btn_, color: 'var(--rust)' }} onClick={() => deleteGroup(g.id)} disabled={busy}>Supprimer</button>
              </>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <input
            placeholder="Nouveau groupe..."
            value={newGroup}
            onChange={e => setNewGroup(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGroup()}
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--bd2)', color: 'var(--tx)', padding: '6px 10px', fontSize: 11 }}
          />
          <button className="btn primary sm" onClick={addGroup} disabled={busy || !newGroup.trim()}>+ Ajouter</button>
        </div>
      </div>

    </div>
  )
}
