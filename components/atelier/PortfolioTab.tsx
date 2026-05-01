'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Oeuvre } from '@/lib/types/database'

interface CollectionItem {
  id:          string
  title:       string
  description: string
  theme:       string | null
  sort_order:  number
  is_active:   boolean
}

interface PortfolioConfig {
  sections:          CollectionItem[] // For /portfolio
  works_collections: CollectionItem[] // For /works
  statement_doc_id:  number | null
  cv_doc_id:         number | null
}

interface Props {
  oeuvres: Oeuvre[]
}

export function PortfolioTab({ oeuvres }: Props) {
  const [config,    setConfig]    = useState<PortfolioConfig>({ sections: [], works_collections: [], statement_doc_id: null, cv_doc_id: null })
  const [documents, setDocuments] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  
  const themes = [...new Set(oeuvres.map(o => o.theme).filter(Boolean))].sort() as string[]
  const sb = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: configDoc }, { data: docs }] = await Promise.all([
      sb.from('document').select('storage_path').eq('name', 'portfolio_sections.json').single(),
      sb.from('document').select('id, name').order('name')
    ])

    if (docs) setDocuments(docs)

    if (configDoc?.storage_path) {
      const { data: fileData } = await sb.storage.from('documents').download(configDoc.storage_path)
      if (fileData) {
        const text = await fileData.text()
        try {
          const parsed = JSON.parse(text)
          // Migration
          const next = {
             sections:          parsed.sections || (Array.isArray(parsed) ? parsed : []),
             works_collections: parsed.works_collections || [],
             statement_doc_id:  parsed.statement_doc_id || null,
             cv_doc_id:         parsed.cv_doc_id || null
          }
          setConfig(next)
        } catch (e) {
          setConfig({ sections: [], works_collections: [], statement_doc_id: null, cv_doc_id: null })
        }
      }
    }
    setLoading(false)
  }, [sb])

  useEffect(() => { loadData() }, [loadData])

  async function saveConfig(newConfig: PortfolioConfig) {
    setSaving(true)
    const blob = new Blob([JSON.stringify(newConfig, null, 2)], { type: 'application/json' })
    const path = `config/portfolio_sections.json`
    
    await sb.storage.from('documents').upload(path, blob, { upsert: true })

    await sb.from('document').upsert({
      name: 'portfolio_sections.json',
      storage_path: path,
      kind: 'autre',
      mime_type: 'application/json',
      file_size: blob.size
    }, { onConflict: 'name' })

    setConfig(newConfig)
    setSaving(false)
  }

  function addItem(target: 'sections' | 'works_collections') {
    const next: CollectionItem = {
      id: Math.random().toString(36).slice(2),
      title: 'Nouvelle Section',
      description: '',
      theme: null,
      sort_order: config[target].length,
      is_active: true
    }
    const nextConfig = { ...config, [target]: [...config[target], next] }
    saveConfig(nextConfig)
  }

  function updateItem(target: 'sections' | 'works_collections', id: string, patch: Partial<CollectionItem>) {
    const nextList = config[target].map(s => s.id === id ? { ...s, ...patch } : s)
    setConfig({ ...config, [target]: nextList })
  }

  if (loading) return <div className="t-mono-sm" style={{ padding: 40, color: 'var(--tx3)' }}>Chargement configuration...</div>

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
      
      {/* Global Content */}
      <section style={{ padding: '20px 24px', background: 'var(--bg0)', border: '1px solid var(--bd)' }}>
        <h3 className="t-label" style={{ marginBottom: 16, letterSpacing: 1.5 }}>Contenus Institutionnels (Vault)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <label className="t-mono-sm" style={{ display: 'block', marginBottom: 6, color: 'var(--tx3)' }}>Artist Statement</label>
            <select 
              value={config.statement_doc_id || ''} 
              onChange={e => setConfig({ ...config, statement_doc_id: Number(e.target.value) || null })}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg1)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 12 }}
            >
              <option value="">— Sélectionner un document</option>
              {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="t-mono-sm" style={{ display: 'block', marginBottom: 6, color: 'var(--tx3)' }}>Curriculum Vitae (CV)</label>
            <select 
              value={config.cv_doc_id || ''} 
              onChange={e => setConfig({ ...config, cv_doc_id: Number(e.target.value) || null })}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg1)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 12 }}
            >
              <option value="">— Sélectionner un document</option>
              {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* WORKS PAGE CONFIG */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bd)', paddingBottom: 12 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 24, color: 'var(--tx)' }}>Page Œuvres (Works)</h2>
            <p className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>Gérez les collections affichées sur la page publique des œuvres.</p>
          </div>
          <button className="btn sm" onClick={() => addItem('works_collections')} disabled={saving}>+ Ajouter une collection</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {config.works_collections.sort((a,b) => a.sort_order - b.sort_order).map((s) => (
            <ItemRow key={s.id} item={s} themes={themes} onUpdate={(p) => updateItem('works_collections', s.id, p)} onDelete={() => saveConfig({ ...config, works_collections: config.works_collections.filter(x => x.id !== s.id) })} />
          ))}
        </div>
      </section>

      {/* PORTFOLIO PAGE CONFIG */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bd)', paddingBottom: 12 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 24, color: 'var(--tx)' }}>Portfolio Interactif</h2>
            <p className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>Gérez les sections de l'expérience portfolio plein écran.</p>
          </div>
          <button className="btn sm" onClick={() => addItem('sections')} disabled={saving}>+ Ajouter une section</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {config.sections.sort((a,b) => a.sort_order - b.sort_order).map((s) => (
            <ItemRow key={s.id} item={s} themes={themes} onUpdate={(p) => updateItem('sections', s.id, p)} onDelete={() => saveConfig({ ...config, sections: config.sections.filter(x => x.id !== s.id) })} />
          ))}
        </div>
      </section>

      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => saveConfig(config)} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer la configuration globale'}
        </button>
      </div>
    </div>
  )
}

function ItemRow({ item, themes, onUpdate, onDelete }: { item: CollectionItem, themes: string[], onUpdate: (p: Partial<CollectionItem>) => void, onDelete: () => void }) {
  return (
    <div style={{ padding: 20, background: 'var(--bg1)', border: '1px solid var(--bd)', display: 'flex', gap: 24 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Titre</label>
            <input 
              value={item.title} 
              onChange={e => onUpdate({ title: e.target.value })}
              style={{ width: '100%', padding: '6px 10px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 13 }}
            />
          </div>
          <div style={{ width: 200 }}>
            <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Thème / Groupe</label>
            <select 
              value={item.theme || ''} 
              onChange={e => onUpdate({ theme: e.target.value || null })}
              style={{ width: '100%', padding: '6px 10px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 13 }}
            >
              <option value="">— Sélectionner</option>
              {themes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Description / Introduction</label>
          <textarea 
            value={item.description} 
            onChange={e => onUpdate({ description: e.target.value })}
            rows={2}
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx2)', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ width: 120, borderLeft: '1px solid var(--bd)', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn ghost sm" onClick={onDelete} style={{ color: 'var(--rust)' }}>Supprimer</button>
        <div style={{ marginTop: 'auto' }}>
           <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
             <input type="checkbox" checked={item.is_active} onChange={e => onUpdate({ is_active: e.target.checked })} />
             <span className="t-mono-sm" style={{ fontSize: 9 }}>Actif</span>
           </label>
        </div>
      </div>
    </div>
  )
}
