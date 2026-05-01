'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Oeuvre } from '@/lib/types/database'

interface PortfolioSection {
  id:          string
  title:       string
  description: string
  theme:       string | null
  sort_order:  number
  is_active:   boolean
}

interface Props {
  oeuvres: Oeuvre[]
}

export function PortfolioTab({ oeuvres }: Props) {
  const [sections, setSections] = useState<PortfolioSection[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  
  const themes = [...new Set(oeuvres.map(o => o.theme).filter(Boolean))].sort() as string[]
  const sb = createClient()

  const loadConfig = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('document')
      .select('storage_path')
      .eq('name', 'portfolio_sections.json')
      .single()

    if (data?.storage_path) {
      const { data: fileData } = await sb.storage.from('documents').download(data.storage_path)
      if (fileData) {
        const text = await fileData.text()
        try {
          setSections(JSON.parse(text))
        } catch (e) {
          setSections([])
        }
      }
    }
    setLoading(false)
  }, [sb])

  useEffect(() => { loadConfig() }, [loadConfig])

  async function saveConfig(newSections: PortfolioSection[]) {
    setSaving(true)
    const blob = new Blob([JSON.stringify(newSections, null, 2)], { type: 'application/json' })
    const path = `config/portfolio_sections.json`
    
    // 1. Upload to storage
    await sb.storage.from('documents').upload(path, blob, { upsert: true })

    // 2. Ensure entry in document table
    await sb.from('document').upsert({
      name: 'portfolio_sections.json',
      storage_path: path,
      kind: 'autre',
      mime_type: 'application/json',
      file_size: blob.size
    }, { onConflict: 'name' })

    setSections(newSections)
    setSaving(false)
  }

  function addSection() {
    const next: PortfolioSection = {
      id: Math.random().toString(36).slice(2),
      title: 'Nouvelle Section',
      description: '',
      theme: null,
      sort_order: sections.length,
      is_active: true
    }
    saveConfig([...sections, next])
  }

  function updateSection(id: string, patch: Partial<PortfolioSection>) {
    const next = sections.map(s => s.id === id ? { ...s, ...patch } : s)
    setSections(next)
  }

  if (loading) return <div className="t-mono-sm" style={{ padding: 40, color: 'var(--tx3)' }}>Chargement configuration...</div>

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="serif" style={{ fontSize: 24, color: 'var(--tx)' }}>Portfolio Public</h2>
          <p className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>Organisez les œuvres en "containers" et ajustez les textes.</p>
        </div>
        <button className="btn sm" onClick={addSection} disabled={saving}>+ Ajouter une section</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.sort((a,b) => a.sort_order - b.sort_order).map((s) => (
          <div key={s.id} style={{ padding: 20, background: 'var(--bg1)', border: '1px solid var(--bd)', display: 'flex', gap: 24 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Titre de la section</label>
                  <input 
                    value={s.title} 
                    onChange={e => updateSection(s.id, { title: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 13 }}
                  />
                </div>
                <div style={{ width: 200 }}>
                  <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Filtrer par Thème</label>
                  <select 
                    value={s.theme || ''} 
                    onChange={e => updateSection(s.id, { theme: e.target.value || null })}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 13 }}
                  >
                    <option value="">— Toutes les œuvres</option>
                    {themes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Texte d'introduction</label>
                <textarea 
                  value={s.description} 
                  onChange={e => updateSection(s.id, { description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx2)', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ width: 120, borderLeft: '1px solid var(--bd)', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn ghost sm" onClick={() => saveConfig(sections.filter(x => x.id !== s.id))} style={{ color: 'var(--rust)' }}>Supprimer</button>
              <div style={{ marginTop: 'auto' }}>
                 <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                   <input type="checkbox" checked={s.is_active} onChange={e => updateSection(s.id, { is_active: e.target.checked })} />
                   <span className="t-mono-sm" style={{ fontSize: 9 }}>Actif</span>
                 </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => saveConfig(sections)} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer la configuration'}
        </button>
      </div>
    </div>
  )
}
