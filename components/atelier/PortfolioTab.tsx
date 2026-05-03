'use client'

import { useState, useEffect, useCallback } from 'react'
import { savePortfolioConfig, loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import type { Oeuvre } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────────────

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
    contact_email: string
    instagram:     string
    phone:         string
  }
  about: {
    intro:            string
    statement_doc_id: string | null
    cv_doc_id:        string | null
  }
  practice: {
    approach:  string
    themes:    string[]
    materials: string
  }
  sections:          CollectionItem[]
  works_collections: CollectionItem[]
}

interface Props {
  oeuvres: Oeuvre[]
  themes:  { ThemeID: number; Nom: string }[]
}

// ── Component ─────────────────────────────────────────────────────────────

export function PortfolioTab({ oeuvres, themes }: Props) {
  const [config, setConfig] = useState<PortfolioConfig>({
    general: { artist_name: '', contact_email: '', instagram: '', phone: '' },
    about: { intro: '', statement_doc_id: null, cv_doc_id: null },
    practice: { approach: '', themes: [], materials: '' },
    sections: [],
    works_collections: []
  })
  
  const [documents, setDocuments] = useState<{id: string, name: string}[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  
  // Selection state for "sliding" content
  const [activeSlot, setActiveSlot] = useState<{ type: 'doc' | 'theme', page: 'about' | 'works' | 'sections', index?: number, key?: string } | null>(null)
  
  const themeNames = themes.map(t => t.Nom).sort((a,b) => a.localeCompare(b, 'fr'))

  // ── Data Loading ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await loadPortfolioConfig()
    if ('ok' in result) {
      const c = result.config
      // Migration logic: if old config was a flat array, use it for both sections
      const isOldArray = Array.isArray(c)
      const oldSections = isOldArray ? c : (c.sections || [])
      const oldWorks    = isOldArray ? c : (c.works_collections || [])

      setConfig({
        general: { 
          artist_name: c.general?.artist_name || '', 
          contact_email: c.general?.contact_email || '', 
          instagram: c.general?.instagram || '',
          phone: c.general?.phone || ''
        },
        about: {
          intro: c.about?.intro || c.general?.about_intro || '',
          statement_doc_id: c.about?.statement_doc_id || c.statement_doc_id || null,
          cv_doc_id: c.about?.cv_doc_id || c.cv_doc_id || null
        },
        practice: {
          approach: c.practice?.approach || '',
          themes: c.practice?.themes || [],
          materials: c.practice?.materials || ''
        },
        sections: oldSections,
        works_collections: oldWorks
      })
      setDocuments(result.documents)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    setSaving(true)
    const result = await savePortfolioConfig(config)
    setSaving(false)
    if ('error' in result) alert(`Error: ${result.error}`)
    else alert('Configuration published successfully.')
  }

  // ── Transfer Actions ────────────────────────────────────────────────────

  const handleTransfer = (value: string) => {
    if (!activeSlot) return
    const { type, page, index, key } = activeSlot
    
    const next = { ...config }

    if (page === 'about' && key) {
      (next.about as any)[key] = value
    } else if ((page === 'works' || page === 'sections') && index !== undefined) {
      next[page][index].theme = value
    }

    setConfig(next)
    setActiveSlot(null)
  }

  const addItem = (target: 'sections' | 'works_collections') => {
    const newItem: CollectionItem = {
      id: Math.random().toString(36).slice(2),
      title: 'New Collection',
      description: '',
      theme: null,
      sort_order: config[target].length,
      is_active: true
    }
    setConfig({ ...config, [target]: [...config[target], newItem] })
  }

  if (loading) return <div className="pad-lg t-mono-sm">Restoring Workspace...</div>

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--bg0)', overflow: 'hidden' }}>
      
      {/* ── Left Sidebar: The Transfer Shelf ── */}
      <div style={{ 
        width: 320, borderRight: '1px solid var(--bd)', background: 'var(--bg1)', 
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--bd)' }}>
          <h3 className="t-eyebrow">Content Sources</h3>
          <p className="t-mono-xs" style={{ opacity: 0.5, marginTop: 4 }}>Select a document or theme to slide into a slot.</p>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="col gap-lg">
          
          {/* Section: Documents */}
          <div>
            <div className="t-label" style={{ marginBottom: 12, fontSize: 10 }}>PDF VAULT</div>
            <div className="col gap-xs">
              {documents.map(doc => (
                <SourceItem 
                  key={doc.id} label={doc.name} 
                  active={activeSlot?.type === 'doc'} 
                  onClick={() => activeSlot?.type === 'doc' && handleTransfer(doc.id)} 
                />
              ))}
            </div>
          </div>

          {/* Section: Themes */}
          <div>
            <div className="t-label" style={{ marginBottom: 12, fontSize: 10 }}>THEMES & GROUPS</div>
            <div className="col gap-xs">
              {themeNames.map(name => (
                <SourceItem 
                  key={name} label={name} 
                  active={activeSlot?.type === 'theme'} 
                  onClick={() => activeSlot?.type === 'theme' && handleTransfer(name)} 
                />
              ))}
            </div>
          </div>

        </div>

        {activeSlot && (
          <div style={{ padding: 20, background: 'var(--ac)', color: 'white', textAlign: 'center' }}>
            <p className="t-mono-sm" style={{ fontWeight: 600 }}>SELECT TARGET CONTAINER</p>
            <button className="btn sm ghost" style={{ marginTop: 8, color: 'white', borderColor: 'white' }} onClick={() => setActiveSlot(null)}>Cancel</button>
          </div>
        )}
      </div>

      {/* ── Main Stage: Website Architecture ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ 
          padding: '20px 40px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 className="serif" style={{ fontSize: 28 }}>Website Management</h2>
            <p className="t-mono-xs" style={{ opacity: 0.5 }}>Assign themes and documents to page containers.</p>
          </div>
          <button className="btn primary lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Publish changes' : 'Publish changes'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
            
            {/* 1. IDENTITY & CONTACT */}
            <PageSection title="General Identity" icon="◈">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                <Slot label="Artist Name">
                  <input className="input full" value={config.general.artist_name} onChange={e => setConfig({...config, general: {...config.general, artist_name: e.target.value}})} />
                </Slot>
                <Slot label="Public Email">
                  <input className="input full" value={config.general.contact_email} onChange={e => setConfig({...config, general: {...config.general, contact_email: e.target.value}})} />
                </Slot>
                <Slot label="Instagram">
                  <input className="input full" value={config.general.instagram} onChange={e => setConfig({...config, general: {...config.general, instagram: e.target.value}})} />
                </Slot>
              </div>
            </PageSection>

            {/* 2. ABOUT PAGE */}
            <PageSection title="About Page" icon="✎">
              <Slot label="Introduction Text">
                <textarea className="input full" rows={3} value={config.about.intro} onChange={e => setConfig({...config, about: {...config.about, intro: e.target.value}})} />
              </Slot>
              <div className="row gap-md">
                <DocumentSlot 
                  label="Artist Statement" 
                  name={documents.find(d => d.id === config.about.statement_doc_id)?.name}
                  active={activeSlot?.key === 'statement_doc_id'}
                  onClick={() => setActiveSlot({ type: 'doc', page: 'about', key: 'statement_doc_id' })}
                  onClear={() => setConfig({...config, about: {...config.about, statement_doc_id: null}})}
                />
                <DocumentSlot 
                  label="Curriculum Vitae" 
                  name={documents.find(d => d.id === config.about.cv_doc_id)?.name}
                  active={activeSlot?.key === 'cv_doc_id'}
                  onClick={() => setActiveSlot({ type: 'doc', page: 'about', key: 'cv_doc_id' })}
                  onClear={() => setConfig({...config, about: {...config.about, cv_doc_id: null}})}
                />
              </div>
            </PageSection>

            {/* 3. WORKS COLLECTIONS (THE CORE) */}
            <PageSection 
              title="Works Collections" icon="▤" 
              action={<button className="btn sm ghost" onClick={() => addItem('works_collections')}>+ Add Collection</button>}
            >
              <div className="col gap-md">
                {config.works_collections.map((item, i) => (
                  <CollectionRow 
                    key={item.id} item={item} 
                    isTarget={activeSlot?.page === 'works' && activeSlot?.index === i}
                    onAssign={() => setActiveSlot({ type: 'theme', page: 'works', index: i })}
                    onUpdate={p => {
                      const next = [...config.works_collections]; next[i] = { ...item, ...p };
                      setConfig({ ...config, works_collections: next });
                    }}
                    onDelete={() => setConfig({ ...config, works_collections: config.works_collections.filter(x => x.id !== item.id) })}
                  />
                ))}
              </div>
            </PageSection>

            {/* 4. PORTFOLIO SECTIONS */}
            <PageSection 
              title="Portfolio Interactive Sections" icon="◪"
              action={<button className="btn sm ghost" onClick={() => addItem('sections')}>+ Add Section</button>}
            >
              <div className="col gap-md">
                {config.sections.map((item, i) => (
                  <CollectionRow 
                    key={item.id} item={item} 
                    isTarget={activeSlot?.page === 'sections' && activeSlot?.index === i}
                    onAssign={() => setActiveSlot({ type: 'theme', page: 'sections', index: i })}
                    onUpdate={p => {
                      const next = [...config.sections]; next[i] = { ...item, ...p };
                      setConfig({ ...config, sections: next });
                    }}
                    onDelete={() => setConfig({ ...config, sections: config.sections.filter(x => x.id !== item.id) })}
                  />
                ))}
              </div>
            </PageSection>

          </div>
        </div>
      </div>

      <style jsx>{`
        .full { width: 100%; }
        .hover-card:hover { border-color: var(--ac); background: var(--bg2); }
      `}</style>
    </div>
  )
}

// ── UI Components ─────────────────────────────────────────────────────────

function SourceItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      style={{
        padding: '10px 14px', borderRadius: 6, border: '1px solid var(--bd)',
        background: active ? 'var(--bg2)' : 'var(--bg1)',
        cursor: active ? 'pointer' : 'default', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: active ? 1 : 0.6,
        transform: active ? 'scale(1.02)' : 'none',
        boxShadow: active ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
      }}
      className={active ? 'hover-card' : ''}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--ac)' : 'var(--bd)' }} />
      <span className="t-mono-sm" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  )
}

function PageSection({ title, icon, subtitle, children, action }: { title: string, icon: string, subtitle?: string, children: React.ReactNode, action?: React.ReactNode }) {
  return (
    <section>
      <div className="row between bb" style={{ paddingBottom: 16, marginBottom: 24, alignItems: 'center' }}>
        <div className="row gap-md center">
          <span style={{ fontSize: 20, color: 'var(--ac)' }}>{icon}</span>
          <h3 className="serif" style={{ fontSize: 22 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Slot({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{label}</label>
      {children}
    </div>
  )
}

function DocumentSlot({ label, name, active, onClick, onClear }: { label: string, name?: string, active: boolean, onClick: () => void, onClear: () => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{label}</label>
      <div 
        onClick={onClick}
        style={{ 
          height: 70, border: `1px ${name ? 'solid' : 'dashed'} ${active ? 'var(--ac)' : 'var(--bd)'}`, 
          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 12, cursor: 'pointer', background: name ? 'rgba(200,168,110,0.05)' : 'var(--bg0)',
          transition: 'all 0.2s'
        }}
      >
        {name ? (
          <div className="row between full">
            <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--ac)' }}>{name}</span>
            <button className="t-mono-xs" style={{ color: 'var(--rust)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onClear(); }}>Remove</button>
          </div>
        ) : (
          <span className="t-mono-xs" style={{ opacity: 0.3 }}>{active ? 'READY FOR TRANSFER' : 'CLICK TO ASSIGN'}</span>
        )}
      </div>
    </div>
  )
}

function CollectionRow({ item, isTarget, onAssign, onUpdate, onDelete }: { item: CollectionItem, isTarget: boolean, onAssign: () => void, onUpdate: (p: Partial<CollectionItem>) => void, onDelete: () => void }) {
  return (
    <div className="panel pad-md row gap-lg" style={{ border: isTarget ? '1px solid var(--ac)' : undefined, background: isTarget ? 'rgba(200,168,110,0.03)' : undefined }}>
      <div className="flex col gap-md">
        <div className="row gap-md">
          <div className="flex">
            <label className="t-label" style={{ marginBottom: 4, display: 'block', fontSize: 9 }}>TITLE</label>
            <input className="input full" value={item.title} onChange={e => onUpdate({ title: e.target.value })} />
          </div>
          <div style={{ width: 260 }}>
            <label className="t-label" style={{ marginBottom: 4, display: 'block', fontSize: 9 }}>ASSIGNED THEME / GROUP</label>
            <div 
              onClick={onAssign}
              style={{ 
                height: 38, border: `1px ${item.theme ? 'solid' : 'dashed'} ${isTarget ? 'var(--ac)' : 'var(--bd)'}`,
                borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer',
                background: item.theme ? 'var(--bg0)' : undefined
              }}
            >
              <span className="t-mono-sm" style={{ fontSize: 11, color: item.theme ? 'var(--ac)' : 'var(--tx3)' }}>
                {item.theme || (isTarget ? 'READY FOR THEME' : 'CLICK TO CHOOSE')}
              </span>
            </div>
          </div>
        </div>
        <div>
          <label className="t-label" style={{ marginBottom: 4, display: 'block', fontSize: 9 }}>INTRO TEXT</label>
          <textarea className="input full" rows={1} value={item.description} onChange={e => onUpdate({ description: e.target.value })} />
        </div>
      </div>
      <div className="flex-0 col gap-sm center" style={{ borderLeft: '1px solid var(--bd)', paddingLeft: 24, width: 110 }}>
        <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none' }} onClick={onDelete}>Delete</button>
        <div className="hairline" style={{ width: '100%' }} />
        <label className="row gap-xs pointer center">
          <input type="checkbox" checked={item.is_active} onChange={e => onUpdate({ is_active: e.target.checked })} />
          <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIVE</span>
        </label>
      </div>
    </div>
  )
}
