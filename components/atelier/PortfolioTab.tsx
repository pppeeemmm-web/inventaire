'use client'

import { useState, useEffect, useCallback } from 'react'
import { savePortfolioConfig, loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
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
  general: {
    artist_name:   string
    about_intro:   string
    contact_email: string
    instagram:     string
  }
  sections:          CollectionItem[]
  works_collections: CollectionItem[]
  statement_doc_id:  string | null
  cv_doc_id:         string | null
}

interface Props {
  oeuvres: Oeuvre[]
  themes:  { ThemeID: number; Nom: string }[]
}

export function PortfolioTab({ oeuvres, themes }: Props) {
  const [config, setConfig] = useState<PortfolioConfig>({
    general: { artist_name: '', about_intro: '', contact_email: '', instagram: '' },
    sections: [],
    works_collections: [],
    statement_doc_id: null as string | null,
    cv_doc_id: null as string | null
  })
  const [documents, setDocuments] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  
  const themeNames = [...themes].sort((a,b) => a.Nom.localeCompare(b.Nom, 'fr')).map(t => t.Nom)

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await loadPortfolioConfig()
    if ('ok' in result) {
      setConfig(result.config)
      setDocuments(result.documents)
    } else {
      console.error('Load error:', result.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function saveConfig() {
    setSaving(true)
    const result = await savePortfolioConfig(config)
    setSaving(false)
    if ('error' in result) {
      alert(`Erreur lors de l'enregistrement : ${result.error}`)
    } else {
      alert('Configuration enregistrée avec succès.')
    }
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
    setConfig({ ...config, [target]: [...config[target], next] })
  }

  function updateItem(target: 'sections' | 'works_collections', id: string, patch: Partial<CollectionItem>) {
    const nextList = config[target].map(s => s.id === id ? { ...s, ...patch } : s)
    setConfig({ ...config, [target]: nextList })
  }

  if (loading) return <div className="pad-lg t-mono-sm">Chargement...</div>

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Sticky Header with Save */}
      <div style={{ 
        padding: '20px 32px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10
      }}>
        <div>
          <h2 className="serif" style={{ fontSize: 24 }}>Gestion Site Web</h2>
          <p className="t-mono-sm" style={{ opacity: 0.5 }}>Centralisation des contenus publics</p>
        </div>
        <button className="btn primary" onClick={saveConfig} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>

          {/* PIPELINE VISUALIZATION */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '0 0 20px 0' }}>
             <PipelineStep label="COVER" active={!!config.general.artist_name} subtitle="Présentation" />
             <PipelineLine active={!!config.general.artist_name && (!!config.statement_doc_id || !!config.general.about_intro)} />
             <PipelineStep label="ABOUT" active={!!config.statement_doc_id || !!config.general.about_intro} subtitle="Statement / Intro" />
             <PipelineLine active={(!!config.statement_doc_id || !!config.general.about_intro) && config.works_collections.length > 0} />
             <PipelineStep label="WORKS" active={config.works_collections.length > 0} subtitle="Collections" />
             <PipelineLine active={config.works_collections.length > 0 && !!config.general.contact_email} />
             <PipelineStep label="CONTACT" active={!!config.general.contact_email} subtitle="Formulaire" />
          </div>

          {/* GENERAL INFO */}
          <section className="panel pad-md">
            <h3 className="t-label" style={{ marginBottom: 20 }}>Informations Générales & Contact</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Nom de l'artiste</label>
                <input className="input" style={{ width: '100%' }} value={config.general.artist_name} onChange={e => setConfig({...config, general: {...config.general, artist_name: e.target.value}})} />
              </div>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Email de contact</label>
                <input className="input" style={{ width: '100%' }} value={config.general.contact_email} onChange={e => setConfig({...config, general: {...config.general, contact_email: e.target.value}})} />
              </div>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Instagram (URL)</label>
                <input className="input" style={{ width: '100%' }} value={config.general.instagram} onChange={e => setConfig({...config, general: {...config.general, instagram: e.target.value}})} />
              </div>
            </div>
          </section>

          {/* VAULT DOCS */}
          <section className="panel pad-md">
            <h3 className="t-label" style={{ marginBottom: 20 }}>Documents du Vault (About Page)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Artist Statement (PDF)</label>
                <select className="input" style={{ width: '100%' }} value={config.statement_doc_id || ''} onChange={e => setConfig({ ...config, statement_doc_id: e.target.value || null })}>
                  <option value="">— Sélectionner</option>
                  {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Curriculum Vitae (PDF)</label>
                <select className="input" style={{ width: '100%' }} value={config.cv_doc_id || ''} onChange={e => setConfig({ ...config, cv_doc_id: e.target.value || null })}>
                  <option value="">— Sélectionner</option>
                  {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 24 }}>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Introduction (About)</label>
              <textarea className="input" rows={4} style={{ width: '100%', resize: 'vertical' }} value={config.general.about_intro} onChange={e => setConfig({...config, general: {...config.general, about_intro: e.target.value}})} />
            </div>
          </section>

          {/* WORKS COLLECTIONS */}
          <section>
            <div className="row between bb" style={{ paddingBottom: 12, marginBottom: 20 }}>
              <h3 className="serif" style={{ fontSize: 20 }}>Collections (Page Œuvres)</h3>
              <button className="btn sm" onClick={() => addItem('works_collections')}>+ Ajouter une collection</button>
            </div>
            <div className="col gap-md">
              {config.works_collections.map(item => (
                <ItemRow key={item.id} item={item} themes={themeNames} onUpdate={p => updateItem('works_collections', item.id, p)} onDelete={() => setConfig({ ...config, works_collections: config.works_collections.filter(x => x.id !== item.id) })} />
              ))}
            </div>
          </section>

          {/* PORTFOLIO SECTIONS */}
          <section>
            <div className="row between bb" style={{ paddingBottom: 12, marginBottom: 20 }}>
              <h3 className="serif" style={{ fontSize: 20 }}>Sections Portfolio Interactif</h3>
              <button className="btn sm" onClick={() => addItem('sections')}>+ Ajouter une section</button>
            </div>
            <div className="col gap-md">
              {config.sections.map(item => (
                <ItemRow key={item.id} item={item} themes={themeNames} onUpdate={p => updateItem('sections', item.id, p)} onDelete={() => setConfig({ ...config, sections: config.sections.filter(x => x.id !== item.id) })} />
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

function ItemRow({ item, themes, onUpdate, onDelete }: { item: CollectionItem, themes: string[], onUpdate: (p: Partial<CollectionItem>) => void, onDelete: () => void }) {
  return (
    <div className="panel pad-md row gap-lg">
      <div className="flex col gap-md">
        <div className="row gap-md">
          <div className="flex">
            <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Titre</label>
            <input className="input" style={{ width: '100%' }} value={item.title} onChange={e => onUpdate({ title: e.target.value })} />
          </div>
          <div style={{ width: 220 }}>
            <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Source (Thème/Groupe)</label>
            <select className="input" style={{ width: '100%' }} value={item.theme || ''} onChange={e => onUpdate({ theme: e.target.value || null })}>
              <option value="">— Sélectionner</option>
              {themes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="t-label" style={{ marginBottom: 4, display: 'block' }}>Texte d'introduction</label>
          <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical' }} value={item.description} onChange={e => onUpdate({ description: e.target.value })} />
        </div>
      </div>
      <div className="flex-0 col gap-sm center" style={{ borderLeft: '1px solid var(--bd)', paddingLeft: 24, width: 100 }}>
        <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer' }} onClick={onDelete}>Supprimer</button>
        <div className="hairline" style={{ width: '100%' }} />
        <label className="row gap-xs pointer">
          <input type="checkbox" checked={item.is_active} onChange={e => onUpdate({ is_active: e.target.checked })} />
          <span className="t-mono-sm">Actif</span>
        </label>
      </div>
    </div>
  )
}

function PipelineStep({ label, subtitle, active }: { label: string, subtitle: string, active: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 120 }}>
      <div style={{ 
        width: 32, height: 32, borderRadius: '50%', border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`,
        background: active ? 'rgba(200,168,110,0.1)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8, transition: 'all 0.3s'
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--ac)' : 'var(--bd)' }} />
      </div>
      <div className="t-mono-sm" style={{ color: active ? 'var(--tx)' : 'var(--tx3)', fontSize: 9, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 2, textAlign: 'center' }}>{subtitle}</div>
    </div>
  )
}

function PipelineLine({ active }: { active: boolean }) {
  return (
    <div style={{ flex: 1, height: 1, background: active ? 'var(--ac)' : 'var(--bd)', margin: '0 -20px 24px -20px', position: 'relative', top: -14, zIndex: -1, transition: 'all 0.5s' }} />
  )
}
