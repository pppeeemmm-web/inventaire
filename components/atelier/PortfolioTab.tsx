'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { savePortfolioConfig, loadPortfolioConfig, extractDocumentText } from '@/app/atelier/portfolio/actions'
import { RichEditor, htmlToPlain } from '@/components/atelier/RichEditor'
import type { Oeuvre } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────────────

interface CollectionItem {
  id:              string
  title_fr:        string
  title_en:        string
  description_fr:  string
  description_en:  string
  theme:           string | null
  sort_order:      number
  is_active:       boolean
}

interface PortfolioConfig {
  general: {
    artist_name:       string
    contact_email:     string
    instagram:         string
    phone:             string
    media_tagline_fr:  string
    media_tagline_en:  string
  }
  about: {
    intro_fr:         string
    intro_en:         string
    statement_doc_id: string | null
    cv_doc_id:        string | null
  }
  practice: {
    approach_fr:  string
    approach_en:  string
    themes:       string[]
    materials_fr: string
    materials_en: string
  }
  sections:          CollectionItem[]
  works_collections: CollectionItem[]
}

interface Props {
  oeuvres: Oeuvre[]
  themes:  { ThemeID: number; Nom: string }[]
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PortfolioConfig = {
  general: { artist_name: '', contact_email: '', instagram: '', phone: '', media_tagline_fr: '', media_tagline_en: '' },
  about:   { intro_fr: '', intro_en: '', statement_doc_id: null, cv_doc_id: null },
  practice:{ approach_fr: '', approach_en: '', themes: [], materials_fr: '', materials_en: '' },
  sections: [],
  works_collections: []
}

// Migrate old single-field config to dual-field
function migrate(raw: any): PortfolioConfig {
  const isOldArray = Array.isArray(raw)
  const oldSections = isOldArray ? raw : (raw.sections || [])
  const oldWorks    = isOldArray ? raw : (raw.works_collections || [])

  function migrateCollection(c: any): CollectionItem {
    return {
      id:             c.id || Math.random().toString(36).slice(2),
      title_fr:       c.title_fr || c.title || '',
      title_en:       c.title_en || '',
      description_fr: c.description_fr || c.description || '',
      description_en: c.description_en || '',
      theme:          c.theme ?? null,
      sort_order:     c.sort_order ?? 0,
      is_active:      c.is_active ?? true,
    }
  }

  return {
    general: {
      artist_name:      raw.general?.artist_name      || '',
      contact_email:    raw.general?.contact_email    || '',
      instagram:        raw.general?.instagram        || '',
      phone:            raw.general?.phone            || '',
      media_tagline_fr: raw.general?.media_tagline_fr || '',
      media_tagline_en: raw.general?.media_tagline_en || '',
    },
    about: {
      intro_fr:         raw.about?.intro_fr || raw.about?.intro || raw.general?.about_intro || '',
      intro_en:         raw.about?.intro_en || '',
      statement_doc_id: raw.about?.statement_doc_id || raw.statement_doc_id || null,
      cv_doc_id:        raw.about?.cv_doc_id         || raw.cv_doc_id        || null,
    },
    practice: {
      approach_fr:  raw.practice?.approach_fr  || raw.practice?.approach  || '',
      approach_en:  raw.practice?.approach_en  || '',
      themes:       raw.practice?.themes       || [],
      materials_fr: raw.practice?.materials_fr || raw.practice?.materials || '',
      materials_en: raw.practice?.materials_en || '',
    },
    sections:          oldSections.map(migrateCollection),
    works_collections: oldWorks.map(migrateCollection),
  }
}

// ── FlamePreview ───────────────────────────────────────────────────────────

function FlamePreview({ html }: { html: string }) {
  const plain = htmlToPlain(html)
  return (
    <div style={{
      border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
      background: '#f0ede8', fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11, lineHeight: 2.0, letterSpacing: '0.15em',
      textTransform: 'uppercase', color: '#8a8680',
      textAlign: 'justify', wordSpacing: '0.3em',
      whiteSpace: 'pre-wrap', minHeight: 60,
    }}>
      {plain
        ? plain.replace(/\./g, ' /').replace(/\n/g, ' █ ')
        : <span style={{ opacity: 0.25 }}>—</span>
      }
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────

export function PortfolioTab({ oeuvres, themes }: Props) {
  const [config,     setConfig]     = useState<PortfolioConfig>(DEFAULT_CONFIG)
  const [documents,  setDocuments]  = useState<{id: string, name: string}[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [activeTab,  setActiveTab]  = useState<'website' | 'portfolio'>('website')
  const [activeSlot, setActiveSlot] = useState<{
    type: 'doc' | 'theme'
    page: 'about' | 'works' | 'sections'
    index?: number
    key?: string
  } | null>(null)

  const themeNames = themes.map(t => t.Nom).sort((a, b) => a.localeCompare(b, 'fr'))

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await loadPortfolioConfig()
    if ('ok' in result) {
      setConfig(migrate(result.config))
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
    else alert('Published successfully.')
  }

  const handleTransfer = (value: string) => {
    if (!activeSlot) return
    const { type, page, index, key } = activeSlot
    const next = { ...config }
    if (page === 'about' && key) {
      (next.about as any)[key] = value
    } else if ((page === 'works' || page === 'sections') && index !== undefined) {
      const listKey = page === 'works' ? 'works_collections' : 'sections'
      next[listKey][index].theme = value
    }
    setConfig(next)
    setActiveSlot(null)
  }

  const addItem = (target: 'sections' | 'works_collections') => {
    const newItem: CollectionItem = {
      id: Math.random().toString(36).slice(2),
      title_fr: '', title_en: '',
      description_fr: '', description_en: '',
      theme: null,
      sort_order: config[target].length,
      is_active: true
    }
    setConfig({ ...config, [target]: [...config[target], newItem] })
  }

  if (loading) return <div className="pad-lg t-mono-sm">Chargement...</div>

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg0)', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', flexShrink: 0 }}>
        <div style={{ display: 'flex' }}>
          {(['website', 'portfolio'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '16px 24px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--ac)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--ac)' : 'var(--tx3)',
              cursor: 'pointer', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase',
              fontFamily: 'inherit', fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.2s'
            }}>
              {tab === 'website' ? 'Général' : 'Portfolio'}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={handleSave} disabled={saving} style={{ fontSize: 9, letterSpacing: 2 }}>
          {saving ? 'Publication...' : 'Publier'}
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar — sources */}
        <div style={{ width: 280, borderRight: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>Sources</div>
            <p className="t-mono-xs" style={{ opacity: 0.4 }}>
              {activeSlot ? 'Sélectionner une cible' : 'Cliquer pour assigner'}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="col gap-lg">
            <div>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10 }}>COFFRE — DOCUMENTS</div>
              <div className="col gap-xs">
                {documents.map(doc => (
                  <SourceItem key={doc.id} label={doc.name}
                    active={activeSlot?.type === 'doc'}
                    onClick={() => activeSlot?.type === 'doc' && handleTransfer(doc.id)} />
                ))}
              </div>
            </div>
            <div>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10 }}>THÈMES & GROUPES</div>
              <div className="col gap-xs">
                {themeNames.map(name => (
                  <SourceItem key={name} label={name}
                    active={activeSlot?.type === 'theme'}
                    onClick={() => activeSlot?.type === 'theme' && handleTransfer(name)} />
                ))}
              </div>
            </div>
          </div>
          {activeSlot && (
            <div style={{ padding: 16, background: 'var(--ac)', color: 'white', textAlign: 'center' }}>
              <p className="t-mono-sm" style={{ fontWeight: 600, marginBottom: 8 }}>CLIQUER UNE CIBLE</p>
              <button className="btn sm ghost" style={{ color: 'white', borderColor: 'white' }} onClick={() => setActiveSlot(null)}>Annuler</button>
            </div>
          )}
        </div>

        {/* Main content — no maxWidth constraint */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>

            {activeTab === 'website' && (
              <>
                {/* General identity */}
                <PageSection title="Identité générale" icon="◈">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    <Slot label="Nom de l'artiste">
                      <input className="input full" value={config.general.artist_name}
                        onChange={e => setConfig({ ...config, general: { ...config.general, artist_name: e.target.value } })} />
                    </Slot>
                    <Slot label="Email public">
                      <input className="input full" value={config.general.contact_email}
                        onChange={e => setConfig({ ...config, general: { ...config.general, contact_email: e.target.value } })} />
                    </Slot>
                    <Slot label="Instagram">
                      <input className="input full" value={config.general.instagram}
                        onChange={e => setConfig({ ...config, general: { ...config.general, instagram: e.target.value } })} />
                    </Slot>
                    <Slot label="Téléphone">
                      <input className="input full" value={config.general.phone}
                        onChange={e => setConfig({ ...config, general: { ...config.general, phone: e.target.value } })} />
                    </Slot>
                  </div>
                  <DualField label="Accroche médiums"
                    fr={config.general.media_tagline_fr} en={config.general.media_tagline_en}
                    onFr={v => setConfig({ ...config, general: { ...config.general, media_tagline_fr: v } })}
                    onEn={v => setConfig({ ...config, general: { ...config.general, media_tagline_en: v } })}
                    placeholder={{ fr: 'Peinture · Dessin · Sculpture', en: 'Painting · Drawing · Sculpture' }} />
                </PageSection>

                {/* About */}
                <PageSection title="Page À propos" icon="✎">
                  <DualField label="Texte d'introduction" rich allowImport
                    fr={config.about.intro_fr} en={config.about.intro_en}
                    onFr={v => setConfig({ ...config, about: { ...config.about, intro_fr: v } })}
                    onEn={v => setConfig({ ...config, about: { ...config.about, intro_en: v } })} />
                  <div className="row gap-md" style={{ marginTop: 20 }}>
                    <DocumentSlot label="Démarche artistique"
                      name={documents.find(d => d.id === config.about.statement_doc_id)?.name}
                      active={activeSlot?.key === 'statement_doc_id'}
                      onClick={() => setActiveSlot({ type: 'doc', page: 'about', key: 'statement_doc_id' })}
                      onClear={() => setConfig({ ...config, about: { ...config.about, statement_doc_id: null } })} />
                    <DocumentSlot label="Curriculum Vitae"
                      name={documents.find(d => d.id === config.about.cv_doc_id)?.name}
                      active={activeSlot?.key === 'cv_doc_id'}
                      onClick={() => setActiveSlot({ type: 'doc', page: 'about', key: 'cv_doc_id' })}
                      onClear={() => setConfig({ ...config, about: { ...config.about, cv_doc_id: null } })} />
                  </div>
                </PageSection>

                {/* Practice */}
                <PageSection title="Page Pratique" icon="◉">
                  <DualField label="Approche / statement" rich allowImport
                    fr={config.practice.approach_fr} en={config.practice.approach_en}
                    onFr={v => setConfig({ ...config, practice: { ...config.practice, approach_fr: v } })}
                    onEn={v => setConfig({ ...config, practice: { ...config.practice, approach_en: v } })} />
                  <div style={{ marginTop: 20 }}>
                    <DualField label="Médiums & matériaux"
                      fr={config.practice.materials_fr} en={config.practice.materials_en}
                      onFr={v => setConfig({ ...config, practice: { ...config.practice, materials_fr: v } })}
                      onEn={v => setConfig({ ...config, practice: { ...config.practice, materials_en: v } })} />
                  </div>
                </PageSection>

                {/* Works collections */}
                <PageSection title="Collections Œuvres" icon="▤"
                  action={<button className="btn sm ghost" onClick={() => addItem('works_collections')}>+ Ajouter</button>}>
                  <div className="col gap-md">
                    {config.works_collections.map((item, i) => (
                      <CollectionRow key={item.id} item={item}
                        isTarget={activeSlot?.page === 'works' && activeSlot?.index === i}
                        onAssign={() => setActiveSlot({ type: 'theme', page: 'works', index: i })}
                        onUpdate={p => {
                          const next = [...config.works_collections]; next[i] = { ...item, ...p }
                          setConfig({ ...config, works_collections: next })
                        }}
                        onDelete={() => setConfig({ ...config, works_collections: config.works_collections.filter(x => x.id !== item.id) })} />
                    ))}
                  </div>
                </PageSection>
              </>
            )}

            {activeTab === 'portfolio' && (
              <>
                {/* Portfolio sections */}
                <PageSection title="Sections Portfolio" icon="◪"
                  action={<button className="btn sm ghost" onClick={() => addItem('sections')}>+ Ajouter</button>}>
                  <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 20 }}>
                    Chaque section génère une carte d'introduction dans le portfolio, suivie des œuvres du thème assigné.
                  </p>
                  <div className="col gap-md">
                    {config.sections.map((item, i) => (
                      <CollectionRow key={item.id} item={item}
                        isTarget={activeSlot?.page === 'sections' && activeSlot?.index === i}
                        onAssign={() => setActiveSlot({ type: 'theme', page: 'sections', index: i })}
                        onUpdate={p => {
                          const next = [...config.sections]; next[i] = { ...item, ...p }
                          setConfig({ ...config, sections: next })
                        }}
                        onDelete={() => setConfig({ ...config, sections: config.sections.filter(x => x.id !== item.id) })} />
                    ))}
                    {config.sections.length === 0 && (
                      <div className="t-mono-xs" style={{ opacity: 0.3, padding: '24px 0' }}>Aucune section. Cliquer "+ Ajouter".</div>
                    )}
                  </div>
                </PageSection>
              </>
            )}

          </div>
        </div>
      </div>

      <style jsx>{`
        .full { width: 100%; }
      `}</style>
    </div>
  )
}

// ── UI sub-components ──────────────────────────────────────────────────────

function FileImportButton({ onText, lang }: { onText: (v: string) => void; lang: 'fr' | 'en' }) {
  const ref      = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    const result = await extractDocumentText(fd)
    setBusy(false)
    if ('ok' in result) onText(result.text)
    else alert(result.error)
    e.target.value = ''
  }

  return (
    <>
      <input ref={ref} type="file" accept=".txt,.docx" style={{ display: 'none' }} onChange={handleFile} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        title="Importer depuis fichier (.txt ou .docx)"
        style={{
          background: 'none', border: '1px solid var(--bd)', borderRadius: 3,
          padding: '2px 7px', fontSize: 8, cursor: busy ? 'default' : 'pointer',
          color: 'var(--tx3)', letterSpacing: 1, opacity: busy ? 0.5 : 1,
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {busy ? '…' : '↑ fichier'}
      </button>
    </>
  )
}

function DualField({ label, fr, en, onFr, onEn, rows = 1, placeholder, allowImport, rich }: {
  label: string; fr: string; en: string
  onFr: (v: string) => void; onEn: (v: string) => void
  rows?: number; placeholder?: { fr?: string; en?: string }
  allowImport?: boolean; rich?: boolean
}) {
  const isRich = rich === true
  const minH = isRich ? 180 : undefined

  return (
    <div>
      <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>{label}</div>
      {/* Editors side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)' }}>FR</span>
            {allowImport && isRich && <FileImportButton onText={onFr} lang="fr" />}
          </div>
          {isRich
            ? <RichEditor value={fr} onChange={onFr} minHeight={minH} />
            : <input className="input full" value={fr} onChange={e => onFr(e.target.value)}
                placeholder={placeholder?.fr || ''} style={{ width: '100%' }} />
          }
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)' }}>EN</span>
            {allowImport && isRich && <FileImportButton onText={onEn} lang="en" />}
          </div>
          {isRich
            ? <RichEditor value={en} onChange={onEn} minHeight={minH} />
            : <input className="input full" value={en} onChange={e => onEn(e.target.value)}
                placeholder={placeholder?.en || ''} style={{ width: '100%' }} />
          }
        </div>
      </div>
      {/* FlameText previews side by side — only for rich fields */}
      {isRich && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>APERÇU FR</div>
            <FlamePreview html={fr} />
          </div>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>APERÇU EN</div>
            <FlamePreview html={en} />
          </div>
        </div>
      )}
    </div>
  )
}

function SourceItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 12px', borderRadius: 4, border: '1px solid var(--bd)',
      background: active ? 'var(--bg2)' : 'var(--bg1)',
      cursor: active ? 'pointer' : 'default', transition: 'all 0.15s',
      display: 'flex', alignItems: 'center', gap: 8,
      opacity: active ? 1 : 0.55,
      transform: active ? 'scale(1.01)' : 'none',
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? 'var(--ac)' : 'var(--bd)', flexShrink: 0 }} />
      <span className="t-mono-xs" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  )
}

function PageSection({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="row between bb" style={{ paddingBottom: 14, marginBottom: 24, alignItems: 'center' }}>
        <div className="row gap-md center">
          <span style={{ fontSize: 18, color: 'var(--ac)' }}>{icon}</span>
          <h3 className="serif" style={{ fontSize: 20 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{label}</label>
      {children}
    </div>
  )
}

function DocumentSlot({ label, name, active, onClick, onClear }: {
  label: string; name?: string; active: boolean
  onClick: () => void; onClear: () => void
}) {
  return (
    <div style={{ flex: 1 }}>
      <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{label}</label>
      <div onClick={onClick} style={{
        height: 60, border: `1px ${name ? 'solid' : 'dashed'} ${active ? 'var(--ac)' : 'var(--bd)'}`,
        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 12, cursor: 'pointer', background: name ? 'rgba(200,168,110,0.05)' : 'var(--bg0)',
        transition: 'all 0.2s'
      }}>
        {name ? (
          <div className="row between full">
            <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--ac)' }}>{name}</span>
            <button className="t-mono-xs" style={{ color: 'var(--rust)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onClear() }}>Retirer</button>
          </div>
        ) : (
          <span className="t-mono-xs" style={{ opacity: 0.3 }}>{active ? 'PRÊT' : 'CLIQUER POUR ASSIGNER'}</span>
        )}
      </div>
    </div>
  )
}

function CollectionRow({ item, isTarget, onAssign, onUpdate, onDelete }: {
  item: CollectionItem; isTarget: boolean
  onAssign: () => void
  onUpdate: (p: Partial<CollectionItem>) => void
  onDelete: () => void
}) {
  return (
    <div className="panel pad-md col gap-md" style={{
      border: isTarget ? '1px solid var(--ac)' : undefined,
      background: isTarget ? 'rgba(200,168,110,0.03)' : undefined
    }}>
      {/* Titles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TITRE FR</label>
          <input className="input full" value={item.title_fr} onChange={e => onUpdate({ title_fr: e.target.value })} />
        </div>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TITRE EN</label>
          <input className="input full" value={item.title_en} onChange={e => onUpdate({ title_en: e.target.value })} />
        </div>
      </div>

      {/* Descriptions — rich editors side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TEXTE FR</label>
          <RichEditor value={item.description_fr} onChange={v => onUpdate({ description_fr: v })} minHeight={120} />
        </div>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TEXTE EN</label>
          <RichEditor value={item.description_en} onChange={v => onUpdate({ description_en: v })} minHeight={120} />
        </div>
      </div>

      {/* FlameText previews */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>APERÇU FR</div>
          <FlamePreview html={item.description_fr} />
        </div>
        <div>
          <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>APERÇU EN</div>
          <FlamePreview html={item.description_en} />
        </div>
      </div>

      {/* Theme + controls */}
      <div className="row gap-md" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>THÈME / GROUPE ASSIGNÉ</label>
          <div onClick={onAssign} style={{
            height: 36, border: `1px ${item.theme ? 'solid' : 'dashed'} ${isTarget ? 'var(--ac)' : 'var(--bd)'}`,
            borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer',
            background: item.theme ? 'var(--bg0)' : undefined
          }}>
            <span className="t-mono-sm" style={{ fontSize: 11, color: item.theme ? 'var(--ac)' : 'var(--tx3)' }}>
              {item.theme || (isTarget ? 'PRÊT POUR THÈME' : 'CLIQUER POUR CHOISIR')}
            </span>
          </div>
        </div>
        <label className="row gap-xs pointer center" style={{ paddingBottom: 6 }}>
          <input type="checkbox" checked={item.is_active} onChange={e => onUpdate({ is_active: e.target.checked })} />
          <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIF</span>
        </label>
        <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', paddingBottom: 6 }} onClick={onDelete}>Supprimer</button>
      </div>
    </div>
  )
}
