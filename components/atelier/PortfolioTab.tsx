'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  publishPortfolioToWorks,
  publishWorksToPortfolio,
  loadPortfolioConfig,
  extractDocumentText,
  setWorkPublic,
} from '@/app/atelier/portfolio/actions'
import { syncFirstWorksModeToSections, syncSectionsToFirstWorksMode } from '@/lib/portfolio-sync'
import { getAnalyticsStats, type AnalyticsResult } from '@/app/atelier/analytics/actions'
import { useRouter } from 'next/navigation'
import { RichEditor, htmlToPlain } from '@/components/atelier/RichEditor'
import { thumbUrl } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb, MissingThumb } from './WorkThumb'

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
  manual_work_order?: number[]
}

// Reorder helper — returns a new array with element moved from→to.
function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const next = arr.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

interface WorksMode {
  id:           string
  label_fr:     string
  label_en:     string
  is_active:    boolean
  sort_order:   number
  collections:  CollectionItem[]
  outro_fr:     string
  outro_en:     string
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
    intro_fr: string
    intro_en: string
  }
  practice: {
    approach_fr:  string
    approach_en:  string
    themes:       string[]
    materials_fr: string
    materials_en: string
  }
  sections:          CollectionItem[]
  works_collections: CollectionItem[]   // legacy mirror of works_modes[0].collections
  works_modes:       WorksMode[]
}

type ThemeWork = { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }

interface Props {
  oeuvres: Oeuvre[]
  themes:  { id: number; name: string }[]
  themePublicStats?: Record<number, { total: number; pub: number }>
  themePrivateWorks?: Record<number, ThemeWork[]>
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PortfolioConfig = {
  general: { artist_name: '', contact_email: '', instagram: '', phone: '', media_tagline_fr: '', media_tagline_en: '' },
  about:   { intro_fr: '', intro_en: '' },
  practice:{ approach_fr: '', approach_en: '', themes: [], materials_fr: '', materials_en: '' },
  sections: [],
  works_collections: [],
  works_modes: [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    is_active: true, sort_order: 0,
    collections: [], outro_fr: '', outro_en: '',
  }],
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
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : undefined,
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
      intro_fr: raw.about?.intro_fr || raw.about?.intro || raw.general?.about_intro || '',
      intro_en: raw.about?.intro_en || '',
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
    works_modes:       migrateModes(raw, oldWorks.map(migrateCollection)),
  }
}

function migrateModes(raw: any, fallbackCollections: CollectionItem[]): WorksMode[] {
  const list = Array.isArray(raw.works_modes) ? raw.works_modes : []
  if (list.length === 0) {
    return [{
      id: 'default', label_fr: 'Œuvres', label_en: 'Works',
      is_active: true, sort_order: 0,
      collections: fallbackCollections,
      outro_fr: raw.works_outro_fr ?? '',
      outro_en: raw.works_outro_en ?? '',
    }]
  }
  return list.map((m: any, i: number): WorksMode => ({
    id:          m.id || Math.random().toString(36).slice(2),
    label_fr:    m.label_fr || m.label || (i === 0 ? 'Œuvres' : `Mode ${i + 1}`),
    label_en:    m.label_en || m.label || (i === 0 ? 'Works'  : `Mode ${i + 1}`),
    is_active:   m.is_active ?? true,
    sort_order:  m.sort_order ?? i,
    collections: Array.isArray(m.collections) ? m.collections.map((c: any) => ({
      id:             c.id || Math.random().toString(36).slice(2),
      title_fr:       c.title_fr || c.title || '',
      title_en:       c.title_en || '',
      description_fr: c.description_fr || c.description || '',
      description_en: c.description_en || '',
      theme:          c.theme ?? null,
      sort_order:     c.sort_order ?? 0,
      is_active:      c.is_active ?? true,
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : undefined,
    })) : [],
    outro_fr:    m.outro_fr || '',
    outro_en:    m.outro_en || '',
  }))
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

function ProsePreview({ html }: { html: string }) {
  if (!html) return (
    <div style={{
      border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
      background: '#f0ede8', minHeight: 60, display: 'flex', alignItems: 'center',
    }}>
      <span style={{ opacity: 0.25, fontSize: 11 }}>—</span>
    </div>
  )
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
        background: '#f0ede8', fontSize: 12, lineHeight: 1.8,
        color: 'var(--tx2)', minHeight: 60,
      }}
    />
  )
}

// ── Component ─────────────────────────────────────────────────────────────

export function PortfolioTab({ oeuvres, themes, themePublicStats = {}, themePrivateWorks = {} }: Props) {
  const router = useRouter()
  const [config,     setConfig]     = useState<PortfolioConfig>(DEFAULT_CONFIG)
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<'website' | 'portfolio' | 'analytics'>('website')
  const [activeMode, setActiveMode] = useState(0)
  const [activeSlot, setActiveSlot] = useState<{
    type: 'theme'
    page: 'works' | 'sections'
    index: number
    modeIdx?: number
  } | null>(null)
  const [publishBusy, setPublishBusy] = useState<'idle' | 'p2w' | 'w2p'>('idle')

  const themeNames = themes.map(t => t.name).sort((a, b) => a.localeCompare(b, 'fr'))

  const themeNameStats = useMemo(() => {
    const map: Record<string, { total: number; pub: number }> = {}
    for (const t of themes) {
      const s = themePublicStats[t.id]
      if (s) map[t.name] = s
    }
    return map
  }, [themes, themePublicStats])

  const themeNamePrivateWorks = useMemo(() => {
    const map: Record<string, ThemeWork[]> = {}
    for (const t of themes) {
      const ws = themePrivateWorks[t.id]
      if (ws?.length) map[t.name] = ws
    }
    return map
  }, [themes, themePrivateWorks])

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await loadPortfolioConfig()
    if ('ok' in result) {
      setConfig(migrate(result.config))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handlePublishPortfolioToWorks = async () => {
    setPublishBusy('p2w')
    const result = await publishPortfolioToWorks(config)
    setPublishBusy('idle')
    if ('ok' in result) {
      setConfig(syncSectionsToFirstWorksMode(config))
      alert('Publié : blocs « Sections Portfolio » copiés vers le mode 1 de /works (et miroir legacy).')
    } else alert(`Erreur : ${result.error}`)
  }

  const handlePublishWorksToPortfolio = async () => {
    setPublishBusy('w2p')
    const result = await publishWorksToPortfolio(config)
    setPublishBusy('idle')
    if ('ok' in result) {
      setConfig(syncFirstWorksModeToSections(config))
      alert('Publié : collections du mode 1 /works copiées vers « Sections Portfolio » (et miroir legacy).')
    } else alert(`Erreur : ${result.error}`)
  }

  const handleTransfer = (value: string) => {
    if (!activeSlot) return
    const { page, index, modeIdx } = activeSlot
    const next = { ...config }
    if (page === 'sections') {
      next.sections[index] = { ...next.sections[index], theme: value }
    } else {
      const m = modeIdx ?? activeMode
      const modes = next.works_modes.slice()
      const cols = modes[m].collections.slice()
      cols[index] = { ...cols[index], theme: value }
      modes[m] = { ...modes[m], collections: cols }
      next.works_modes = modes
    }
    setConfig(next)
    setActiveSlot(null)
  }

  // Mode helpers
  const updateMode = (i: number, patch: Partial<WorksMode>) => {
    const modes = config.works_modes.slice()
    modes[i] = { ...modes[i], ...patch }
    setConfig({ ...config, works_modes: modes })
  }
  const addMode = () => {
    const newMode: WorksMode = {
      id: Math.random().toString(36).slice(2),
      label_fr: `Mode ${config.works_modes.length + 1}`,
      label_en: `Mode ${config.works_modes.length + 1}`,
      is_active: true,
      sort_order: config.works_modes.length,
      collections: [],
      outro_fr: '', outro_en: '',
    }
    setConfig({ ...config, works_modes: [...config.works_modes, newMode] })
    setActiveMode(config.works_modes.length)
  }
  const deleteMode = (i: number) => {
    if (config.works_modes.length <= 1) { alert('Au moins un mode requis.'); return }
    if (!confirm(`Supprimer le mode "${config.works_modes[i].label_fr}" ?`)) return
    const modes = config.works_modes.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sort_order: idx }))
    setConfig({ ...config, works_modes: modes })
    setActiveMode(Math.max(0, Math.min(activeMode, modes.length - 1)))
  }
  const moveMode = (from: number, to: number) => {
    if (to < 0 || to >= config.works_modes.length) return
    const modes = reorder(config.works_modes, from, to).map((m, i) => ({ ...m, sort_order: i }))
    setConfig({ ...config, works_modes: modes })
    if (activeMode === from) setActiveMode(to)
    else if (from < activeMode && to >= activeMode) setActiveMode(activeMode - 1)
    else if (from > activeMode && to <= activeMode) setActiveMode(activeMode + 1)
  }
  const addModeCollection = (m: number) => {
    const modes = config.works_modes.slice()
    const newItem: CollectionItem = {
      id: Math.random().toString(36).slice(2),
      title_fr: '', title_en: '',
      description_fr: '', description_en: '',
      theme: null,
      sort_order: modes[m].collections.length,
      is_active: true,
    }
    modes[m] = { ...modes[m], collections: [...modes[m].collections, newItem] }
    setConfig({ ...config, works_modes: modes })
  }
  const moveModeCollection = (m: number, from: number, to: number) => {
    const list = config.works_modes[m].collections
    if (to < 0 || to >= list.length) return
    const cols = reorder(list, from, to).map((c, i) => ({ ...c, sort_order: i }))
    updateMode(m, { collections: cols })
  }
  const updateModeCollection = (m: number, i: number, patch: Partial<CollectionItem>) => {
    const cols = config.works_modes[m].collections.slice()
    cols[i] = { ...cols[i], ...patch }
    updateMode(m, { collections: cols })
  }
  const deleteModeCollection = (m: number, id: string) => {
    updateMode(m, { collections: config.works_modes[m].collections.filter(c => c.id !== id) })
  }

  const handleMakePublic = async (oeuvreId: number) => {
    const res = await setWorkPublic(oeuvreId)
    if ('error' in res) { alert(`Erreur : ${res.error}`); return }
    router.refresh()
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

  // Move a collection within its list, then re-stamp sort_order to mirror array index.
  const moveCollection = (target: 'sections' | 'works_collections', from: number, to: number) => {
    const list = config[target]
    if (to < 0 || to >= list.length) return
    const next = reorder(list, from, to).map((c, i) => ({ ...c, sort_order: i }))
    setConfig({ ...config, [target]: next })
  }

  if (loading) return <div className="pad-lg t-mono-sm">Chargement...</div>

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg0)', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', flexShrink: 0 }}>
        <div style={{ display: 'flex' }}>
          {(['website', 'portfolio', 'analytics'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '16px 24px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--ac)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--ac)' : 'var(--tx3)',
              cursor: 'pointer', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase',
              fontFamily: 'inherit', fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.2s'
            }}>
              {tab === 'website' ? 'Général' : tab === 'portfolio' ? 'Portfolio' : 'Analytiques'}
            </button>
          ))}
        </div>
        {activeTab !== 'analytics' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn ghost sm"
              style={{ fontSize: 9, letterSpacing: 2, textDecoration: 'none' }}
            >
              Site public
            </a>
            <button
              type="button"
              className="btn primary sm"
              title="Copie les blocs Portfolio (colonne droite) vers les collections du premier mode /works"
              onClick={handlePublishPortfolioToWorks}
              disabled={publishBusy !== 'idle'}
              style={{ fontSize: 9, letterSpacing: 1.5 }}
            >
              {publishBusy === 'p2w' ? 'Publication…' : 'Publier Portfolio → /works'}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              title="Copie les collections du premier mode /works vers les blocs Sections Portfolio"
              onClick={handlePublishWorksToPortfolio}
              disabled={publishBusy !== 'idle'}
              style={{ fontSize: 9, letterSpacing: 1.5 }}
            >
              {publishBusy === 'w2p' ? 'Publication…' : 'Publier /works → Portfolio'}
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar — sources (hidden on analytics tab) */}
        <div style={{ width: activeTab === 'analytics' ? 0 : 280, borderRight: activeTab === 'analytics' ? 'none' : '1px solid var(--bd)', background: 'var(--bg1)', display: activeTab === 'analytics' ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>Sources</div>
            <p className="t-mono-xs" style={{ opacity: 0.4 }}>
              {activeSlot ? 'Sélectionner une cible' : 'Cliquer pour assigner'}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="col gap-lg">
            <div>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10 }}>THÈMES & GROUPES</div>
              <div className="col gap-xs">
                {themeNames.map(name => {
                  const s = themeNameStats[name]
                  const hasPrivate = s ? s.pub < s.total : false
                  return (
                    <SourceItem key={name} label={name}
                      active={!!activeSlot}
                      onClick={() => activeSlot && handleTransfer(name)}
                      badge={s ? `${s.pub}/${s.total}` : undefined}
                      badgeWarn={hasPrivate} />
                  )
                })}
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
                  <DualField label="Texte d'introduction" rich allowImport preview="prose"
                    fr={config.about.intro_fr} en={config.about.intro_en}
                    onFr={v => setConfig({ ...config, about: { ...config.about, intro_fr: v } })}
                    onEn={v => setConfig({ ...config, about: { ...config.about, intro_en: v } })} />
                </PageSection>

                {/* Practice */}
                <PageSection title="Page Pratique" icon="◉">
                  <DualField label="Approche / statement" rich allowImport preview="prose"
                    fr={config.practice.approach_fr} en={config.practice.approach_en}
                    onFr={v => setConfig({ ...config, practice: { ...config.practice, approach_fr: v } })}
                    onEn={v => setConfig({ ...config, practice: { ...config.practice, approach_en: v } })} />
                  <div style={{ marginTop: 20 }}>
                    <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>
                      THÈMES CENTRAUX (un par ligne)
                    </label>
                    <textarea
                      className="input full"
                      rows={5}
                      value={(config.practice.themes ?? []).join('\n')}
                      onChange={e => setConfig({
                        ...config,
                        practice: {
                          ...config.practice,
                          themes: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean)
                        }
                      })}
                      placeholder="La physiologie de la perception…"
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <DualField label="Médiums & matériaux"
                      fr={config.practice.materials_fr} en={config.practice.materials_en}
                      onFr={v => setConfig({ ...config, practice: { ...config.practice, materials_fr: v } })}
                      onEn={v => setConfig({ ...config, practice: { ...config.practice, materials_en: v } })} />
                  </div>
                </PageSection>

                {/* Works — multi-mode (tabs) */}
                <PageSection title="Page /works — Modes" icon="▤"
                  action={<button className="btn sm ghost" onClick={addMode}>+ Mode</button>}>
                  <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 16 }}>
                    Chaque mode apparaît comme un onglet sur /works avec ses propres collections et sa carte de clôture.
                  </p>

                  {/* Mode tab bar */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--bd)', marginBottom: 20, paddingBottom: 8 }}>
                    {config.works_modes.map((m, i) => {
                      const isActive = i === activeMode
                      return (
                        <div key={m.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 10px', borderRadius: 4,
                          background: isActive ? 'var(--ac)' : 'var(--bg1)',
                          border: '1px solid ' + (isActive ? 'var(--ac)' : 'var(--bd)'),
                          color: isActive ? '#fff' : 'var(--tx2)',
                          opacity: m.is_active ? 1 : 0.5,
                        }}>
                          <button onClick={() => setActiveMode(i)} className="t-mono-xs"
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 10, letterSpacing: 1, fontFamily: 'inherit', textTransform: 'uppercase' }}>
                            {m.label_fr || m.label_en || `Mode ${i + 1}`}
                          </button>
                          <span className="t-mono-xs" style={{ fontSize: 8, opacity: 0.6 }}>{i + 1}/{config.works_modes.length}</span>
                          <button onClick={() => moveMode(i, i - 1)} disabled={i === 0}
                            title="Déplacer à gauche" style={{ ...moveBtnStyle(i === 0), width: 16, height: 16, fontSize: 9 }}>←</button>
                          <button onClick={() => moveMode(i, i + 1)} disabled={i === config.works_modes.length - 1}
                            title="Déplacer à droite" style={{ ...moveBtnStyle(i === config.works_modes.length - 1), width: 16, height: 16, fontSize: 9 }}>→</button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Active mode editor */}
                  {config.works_modes[activeMode] && (() => {
                    const mode = config.works_modes[activeMode]
                    return (
                      <div className="col gap-lg">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
                          <div>
                            <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>LIBELLÉ ONGLET FR</label>
                            <input className="input full" value={mode.label_fr} onChange={e => updateMode(activeMode, { label_fr: e.target.value })} />
                          </div>
                          <div>
                            <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>LIBELLÉ ONGLET EN</label>
                            <input className="input full" value={mode.label_en} onChange={e => updateMode(activeMode, { label_en: e.target.value })} />
                          </div>
                          <label className="row gap-xs pointer center" style={{ paddingBottom: 6 }}>
                            <input type="checkbox" checked={mode.is_active} onChange={e => updateMode(activeMode, { is_active: e.target.checked })} />
                            <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIF</span>
                          </label>
                          <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', paddingBottom: 6, fontSize: 11 }}
                            onClick={() => deleteMode(activeMode)}
                            disabled={config.works_modes.length <= 1}
                            title={config.works_modes.length <= 1 ? 'Au moins un mode requis' : 'Supprimer ce mode'}>
                            Supprimer mode
                          </button>
                        </div>

                        <div>
                          <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>COLLECTIONS DU MODE ({mode.collections.length})</div>
                          <div className="col gap-md">
                            {mode.collections.map((item, i) => (
                              <CollectionRow key={item.id} item={item}
                                index={i} total={mode.collections.length}
                                onMove={(from, to) => moveModeCollection(activeMode, from, to)}
                                isTarget={activeSlot?.page === 'works' && activeSlot?.modeIdx === activeMode && activeSlot?.index === i}
                                onAssign={() => setActiveSlot({ type: 'theme', page: 'works', index: i, modeIdx: activeMode })}
                                onUpdate={p => updateModeCollection(activeMode, i, p)}
                                onDelete={() => deleteModeCollection(activeMode, item.id)}
                                themeStats={themeNameStats}
                                privateWorks={item.theme ? themeNamePrivateWorks[item.theme] : undefined}
                                onMakePublic={handleMakePublic} />
                            ))}
                            <button className="btn sm ghost" onClick={() => addModeCollection(activeMode)} style={{ alignSelf: 'flex-start' }}>
                              + Collection
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="t-label" style={{ marginBottom: 8, fontSize: 9 }}>CARTE DE CLÔTURE — texte affiché après la dernière œuvre</div>
                          <DualField label="" rich allowImport preview="prose"
                            fr={mode.outro_fr} en={mode.outro_en}
                            onFr={v => updateMode(activeMode, { outro_fr: v })}
                            onEn={v => updateMode(activeMode, { outro_en: v })} />
                        </div>
                      </div>
                    )
                  })()}
                </PageSection>
              </>
            )}

            {activeTab === 'portfolio' && (
              <>
                {/* Portfolio sections */}
                <PageSection title="Sections Portfolio" icon="◪"
                  action={<button className="btn sm ghost" onClick={() => addItem('sections')}>+ Ajouter</button>}>
                  <p className="t-mono-xs" style={{ opacity: 0.5, marginBottom: 20 }}>
                    Chaque section génère une carte d&apos;introduction dans le portfolio, suivie des œuvres du thème assigné.
                  </p>
                  <div className="col gap-md">
                    {config.sections.map((item, i) => (
                      <CollectionRow key={item.id} item={item}
                        index={i} total={config.sections.length}
                        onMove={(from, to) => moveCollection('sections', from, to)}
                        isTarget={activeSlot?.page === 'sections' && activeSlot?.index === i}
                        onAssign={() => setActiveSlot({ type: 'theme', page: 'sections', index: i })}
                        onUpdate={p => {
                          const next = [...config.sections]; next[i] = { ...item, ...p }
                          setConfig({ ...config, sections: next })
                        }}
                        onDelete={() => setConfig({ ...config, sections: config.sections.filter(x => x.id !== item.id) })}
                        themeStats={themeNameStats}
                        privateWorks={item.theme ? themeNamePrivateWorks[item.theme] : undefined}
                        onMakePublic={handleMakePublic} />
                    ))}
                    {config.sections.length === 0 && (
                      <div className="t-mono-xs" style={{ opacity: 0.3, padding: '24px 0' }}>Aucune section. Cliquer &quot;+ Ajouter&quot;.</div>
                    )}
                  </div>
                </PageSection>
              </>
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel
                themes={themes}
                oeuvres={oeuvres}
                themePublicStats={themePublicStats}
              />
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

// ── AnalyticsPanel ────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7 jours',  days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
]

function BarList({ items, labelKey, valueKey }: {
  items: Record<string, any>[]
  labelKey: string
  valueKey: string
}) {
  const max = items[0]?.[valueKey] ?? 1
  if (items.length === 0) return (
    <div className="t-mono-xs" style={{ color: 'var(--tx3)', opacity: 0.5 }}>Aucune donnée.</div>
  )
  return (
    <div className="col gap-xs">
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="t-mono-sm" style={{ width: 180, color: 'var(--tx2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item[labelKey]}
          </div>
          <div style={{ flex: 1, height: 4, background: 'var(--bd)', borderRadius: 2 }}>
            <div style={{ width: `${(item[valueKey] / max) * 100}%`, height: '100%', background: 'var(--ac)', borderRadius: 2 }} />
          </div>
          <div className="t-mono-sm" style={{ width: 40, textAlign: 'right', color: 'var(--tx3)', flexShrink: 0 }}>
            {item[valueKey]}
          </div>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ trend }: { trend: { date: string; views: number }[] }) {
  if (trend.length === 0) return null
  const max = Math.max(...trend.map(d => d.views), 1)
  const h = 48
  const w = 100
  const denom = Math.max(trend.length - 1, 1)
  const pts = trend.map((d, i) => {
    const x = (i / denom) * w
    const y = h - (d.views / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
      style={{ width: '100%', height: h, display: 'block' }}>
      <polyline points={pts} fill="none" stroke="var(--ac)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function AnalyticsPanel({
  themes,
  oeuvres,
  themePublicStats,
}: {
  themes: { id: number; name: string }[]
  oeuvres: Oeuvre[]
  themePublicStats: Record<number, { total: number; pub: number }>
}) {
  const [days, setDays] = useState(30)
  const [scope, setScope] = useState<'public_site' | 'all'>('public_site')
  const [result, setResult] = useState<AnalyticsResult | null>(null)
  const [loading, setLoading] = useState(false)

  const cataloguePublic = useMemo(
    () => oeuvres.filter((o) => o.is_public === true).length,
    [oeuvres]
  )

  const themeRows = useMemo(() => {
    return [...themes]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((th) => {
        const s = themePublicStats[th.id]
        return { id: th.id, name: th.name, pub: s?.pub ?? 0, total: s?.total ?? 0 }
      })
      .filter((r) => r.total > 0)
  }, [themes, themePublicStats])

  const load = useCallback(async (d: number, sc: 'public_site' | 'all') => {
    setLoading(true)
    setResult(await getAnalyticsStats(d, { scope: sc }))
    setLoading(false)
  }, [])

  useEffect(() => { load(days, scope) }, [load, days, scope])

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 28, padding: '20px 24px', background: 'var(--bg0)', border: '1px solid var(--bd)' }}>
        <div className="t-label" style={{ marginBottom: 12 }}>Catalogue (données atelier)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'baseline', marginBottom: themeRows.length ? 16 : 0 }}>
          <div>
            <span className="t-mono-xs" style={{ color: 'var(--tx3)', marginRight: 8 }}>Œuvres publiées</span>
            <span style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-serif, serif)' }}>
              {cataloguePublic.toLocaleString('fr-FR')} / {oeuvres.length.toLocaleString('fr-FR')}
            </span>
          </div>
        </div>
        {themeRows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center' }}>
              <div className="t-mono-xs" style={{ color: 'var(--tx3)', letterSpacing: 1 }}>THÈME</div>
              <div className="t-mono-xs" style={{ color: 'var(--tx3)', letterSpacing: 1, textAlign: 'right' }}>PUBL.</div>
              <div className="t-mono-xs" style={{ color: 'var(--tx3)', letterSpacing: 1, textAlign: 'right' }}>TOTAL</div>
            </div>
            {themeRows.map((r) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center' }}>
                <div className="t-mono-sm" style={{ color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div className="t-mono-sm" style={{ textAlign: 'right', color: 'var(--green)' }}>{r.pub}</div>
                <div className="t-mono-sm" style={{ textAlign: 'right', opacity: 0.7 }}>{r.total}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span className="t-mono-xs" style={{ color: 'var(--tx3)', marginRight: 8 }}>TRAFIC</span>
        {(['public_site', 'all'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} style={{
            padding: '6px 14px', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--bd)',
            background: scope === s ? 'var(--ac)' : 'none',
            color: scope === s ? 'white' : 'var(--tx3)',
            borderColor: scope === s ? 'var(--ac)' : 'var(--bd)',
          }}>
            {s === 'public_site' ? 'Pages site' : 'Tout brut'}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => setDays(p.days)} style={{
            padding: '6px 16px', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--bd)',
            background: days === p.days ? 'var(--ac)' : 'none',
            color: days === p.days ? 'white' : 'var(--tx3)',
            borderColor: days === p.days ? 'var(--ac)' : 'var(--bd)',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', paddingTop: 40 }}>Chargement…</div>
      )}

      {!loading && result && 'error' in result && (
        <div style={{ padding: '20px 24px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx3)', fontSize: 13 }}>
          {result.error}
        </div>
      )}

      {!loading && result && 'ok' in result && (
        <div className="col gap-lg" style={{ gap: 36 }}>

          {/* Stat + sparkline */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'stretch' }}>
            <div style={{ padding: '20px 24px', background: 'var(--bg0)', border: '1px solid var(--bd)' }}>
              <div className="t-label" style={{ marginBottom: 10 }}>
                {result.scope === 'public_site' ? 'Pages vues (site)' : 'Pages vues (brut)'}
              </div>
              <div style={{ fontSize: 32, fontWeight: 300, color: 'var(--tx)', fontFamily: 'var(--font-serif, serif)', letterSpacing: -0.5 }}>
                {result.pageviews.toLocaleString('fr-FR')}
              </div>
              {result.scope === 'public_site' && result.offSitePageviews != null && result.offSitePageviews > 0 && (
                <div className="t-mono-xs" style={{ color: 'var(--tx3)', marginTop: 12, lineHeight: 1.4 }}>
                  + {result.offSitePageviews.toLocaleString('fr-FR')} hors routes connues (non inclus ci-dessus)
                </div>
              )}
            </div>
            <div style={{ padding: '16px 20px', background: 'var(--bg0)', border: '1px solid var(--bd)' }}>
              <div className="t-label" style={{ marginBottom: 12 }}>Tendance</div>
              <Sparkline trend={result.trend} />
            </div>
          </div>

          {/* Top pages + countries side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <div className="t-label" style={{ marginBottom: 14 }}>Top pages</div>
              <BarList items={result.topPages} labelKey="path" valueKey="views" />
            </div>
            <div>
              <div className="t-label" style={{ marginBottom: 14 }}>Pays</div>
              <BarList items={result.topCountries} labelKey="country" valueKey="views" />
            </div>
          </div>

          {/* Referrers (includes Direct) */}
          <div>
            <div className="t-label" style={{ marginBottom: 14 }}>Sources</div>
            <BarList items={result.topReferrers} labelKey="referrer" valueKey="views" />
          </div>

          <div className="t-mono-xs" style={{ color: 'var(--tx3)', opacity: 0.5 }}>
            Source : page_view · {result.scope === 'public_site'
              ? 'filtre routes = lib/public-site-paths (trackView)'
              : 'aucun filtre route'} · jours UTC · pagination complète
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg0)', border: '1px solid var(--bd)' }}>
      <div className="t-label" style={{ marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--tx)', fontFamily: 'var(--font-serif, serif)', letterSpacing: -0.5 }}>
        {value}
      </div>
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

function DualField({ label, fr, en, onFr, onEn, rows = 1, placeholder, allowImport, rich, preview = 'flame' }: {
  label: string; fr: string; en: string
  onFr: (v: string) => void; onEn: (v: string) => void
  rows?: number; placeholder?: { fr?: string; en?: string }
  allowImport?: boolean; rich?: boolean; preview?: 'flame' | 'prose'
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
            {preview === 'prose' ? <ProsePreview html={fr} /> : <FlamePreview html={fr} />}
          </div>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>APERÇU EN</div>
            {preview === 'prose' ? <ProsePreview html={en} /> : <FlamePreview html={en} />}
          </div>
        </div>
      )}
    </div>
  )
}

function SourceItem({ label, active, onClick, badge, badgeWarn }: {
  label: string; active: boolean; onClick: () => void
  badge?: string; badgeWarn?: boolean
}) {
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
      <span className="t-mono-xs" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{label}</span>
      {badge && (
        <span className="t-mono-xs" style={{ fontSize: 9, flexShrink: 0, color: badgeWarn ? 'var(--rust)' : 'var(--tx3)' }}>
          {badge}
        </span>
      )}
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


function CollectionRow({ item, index, total, onMove, isTarget, onAssign, onUpdate, onDelete, themeStats, privateWorks, onMakePublic }: {
  item: CollectionItem
  index: number
  total: number
  onMove: (from: number, to: number) => void
  isTarget: boolean
  onAssign: () => void
  onUpdate: (p: Partial<CollectionItem>) => void
  onDelete: () => void
  themeStats?: Record<string, { total: number; pub: number }>
  privateWorks?: ThemeWork[]
  onMakePublic?: (id: number) => void
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      className="panel pad-md col gap-md"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/x-collection-from', String(index))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => {
        e.preventDefault()
        const raw = e.dataTransfer.getData('text/x-collection-from')
        const from = Number(raw)
        if (Number.isFinite(from) && from !== index) onMove(from, index)
        setDragging(false)
      }}
      style={{
        border: isTarget ? '1px solid var(--ac)' : undefined,
        background: isTarget ? 'rgba(200,168,110,0.03)' : undefined,
        opacity: dragging ? 0.5 : 1,
      }}
    >
      {/* Reorder header */}
      <div className="row gap-md" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row gap-xs" style={{ alignItems: 'center' }}>
          <span title="Glisser pour réordonner" style={{
            cursor: 'grab', color: 'var(--tx3)', fontSize: 14, lineHeight: 1,
            padding: '2px 6px', borderRadius: 3, userSelect: 'none',
          }}>⋮⋮</span>
          <span className="t-mono-xs" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 1 }}>
            {index + 1} / {total}
          </span>
          <button onClick={() => onMove(index, index - 1)} disabled={index === 0}
            title="Monter"
            style={moveBtnStyle(index === 0)}>↑</button>
          <button onClick={() => onMove(index, index + 1)} disabled={index === total - 1}
            title="Descendre"
            style={moveBtnStyle(index === total - 1)}>↓</button>
        </div>
        <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', fontSize: 11 }} onClick={onDelete}>
          Supprimer
        </button>
      </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="t-label" style={{ fontSize: 9 }}>TEXTE FR</span>
            <FileImportButton onText={v => onUpdate({ description_fr: v })} lang="fr" />
          </div>
          <RichEditor value={item.description_fr} onChange={v => onUpdate({ description_fr: v })} minHeight={120} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="t-label" style={{ fontSize: 9 }}>TEXTE EN</span>
            <FileImportButton onText={v => onUpdate({ description_en: v })} lang="en" />
          </div>
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
          {privateWorks && privateWorks.length > 0 && (
            <WorksReorder
              privateWorks={privateWorks}
              orderIds={item.manual_work_order ?? []}
              onReorder={ids => onUpdate({ manual_work_order: ids })}
              onMakePublic={onMakePublic}
            />
          )}
        </div>
        <label className="row gap-xs pointer center" style={{ paddingBottom: 6 }}>
          <input type="checkbox" checked={item.is_active} onChange={e => onUpdate({ is_active: e.target.checked })} />
          <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIF</span>
        </label>
      </div>
    </div>
  )
}

// Shared style for arrow buttons used in collection/work reordering.
function moveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 22, height: 22, padding: 0,
    background: disabled ? 'transparent' : 'var(--bg0)',
    border: '1px solid var(--bd)', borderRadius: 3,
    color: disabled ? 'var(--bd)' : 'var(--tx2)',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11, lineHeight: 1, fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }
}

// Reorderable strip of public works for a collection.
// Shows hidden (non-public) works as warnings on the right.
function WorksReorder({ privateWorks, orderIds, onReorder, onMakePublic }: {
  privateWorks: ThemeWork[]
  orderIds: number[]
  onReorder: (ids: number[]) => void
  onMakePublic?: (id: number) => void
}) {
  const visible = privateWorks.filter(w => w.isPublic)
  const hidden  = privateWorks.filter(w => !w.isPublic)

  // Compute current order: known IDs first (in saved order, only if still public),
  // then any new public works appended at the end.
  const visibleMap = new Map(visible.map(w => [w.OeuvreID, w]))
  const seen = new Set<number>()
  const ordered: ThemeWork[] = []
  for (const id of orderIds) {
    const w = visibleMap.get(id)
    if (w && !seen.has(id)) { ordered.push(w); seen.add(id) }
  }
  for (const w of visible) if (!seen.has(w.OeuvreID)) ordered.push(w)

  const setOrder = (next: ThemeWork[]) => onReorder(next.map(w => w.OeuvreID))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length) return
    setOrder(reorder(ordered, from, to))
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {ordered.length > 0 && (
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="t-mono-xs" style={{ color: 'var(--tx3)', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>
            PUBLIQUES ({ordered.length}) — glisser ou ↑↓ pour réordonner
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ordered.map((w, i) => (
              <ReorderableThumb key={w.OeuvreID} w={w} index={i} total={ordered.length} onMove={move}
                onDropFrom={(from, to) => setOrder(reorder(ordered, from, to))} />
            ))}
          </div>
        </div>
      )}
      {hidden.length > 0 && (
        <div>
          <div className="t-mono-xs" style={{ color: 'var(--rust)', fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
            ⚠ NON-PUBLIQUES ({hidden.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hidden.map(w => (
              <div key={w.OeuvreID} style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: 64, height: 64, overflow: 'hidden', flexShrink: 0,
                  background: 'repeating-linear-gradient(45deg, var(--bg2), var(--bg2) 6px, var(--bg1) 6px, var(--bg1) 12px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--rust)', boxSizing: 'border-box', position: 'relative',
                }}>
                  {w.txtImageNameLink
                    ? <WorkThumb file={w.txtImageNameLink} size={128} alt="" />
                    : <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--tx3)', opacity: 0.4, lineHeight: 1 }}>{w.OeuvreID}</span>
                  }
                </div>
                <div className="t-mono-xs" style={{ fontSize: 9, color: 'var(--rust)', fontWeight: 700 }}>#{w.OeuvreID}</div>
                {onMakePublic && (
                  <button onClick={() => onMakePublic(w.OeuvreID)} title={`Rendre #${w.OeuvreID} public`}
                    style={{
                      width: '100%', background: 'var(--rust)', color: '#fff',
                      border: 'none', borderRadius: 2, fontSize: 8, padding: '2px 0',
                      cursor: 'pointer', letterSpacing: 0.3, fontWeight: 600,
                    }}>→ publier</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReorderableThumb({ w, index, total, onMove, onDropFrom }: {
  w: ThemeWork
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onDropFrom: (from: number, to: number) => void
}) {
  const [hover,    setHover]    = useState(false)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/x-work-from', String(index))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => {
        e.preventDefault()
        const from = Number(e.dataTransfer.getData('text/x-work-from'))
        if (Number.isFinite(from) && from !== index) onDropFrom(from, index)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 80, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        opacity: dragging ? 0.4 : 1, cursor: 'grab', position: 'relative',
      }}
    >
      <div style={{
        width: 80, height: 80, overflow: 'hidden', position: 'relative',
        background: 'var(--bg2)',
        border: '2px solid transparent', boxSizing: 'border-box',
      }}>
        {w.txtImageNameLink
          ? <WorkThumb file={w.txtImageNameLink} size={160} alt="" />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 20, fontWeight: 900, color: 'var(--tx3)', opacity: 0.4 }}>{w.OeuvreID}</div>
        }
        {/* Position badge */}
        <div className="t-mono-xs" style={{
          position: 'absolute', top: 2, left: 2,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          fontSize: 9, padding: '1px 4px', borderRadius: 2, letterSpacing: 0.5,
        }}>{index + 1}</div>
        {/* Arrow controls on hover */}
        {hover && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            display: 'flex', gap: 2,
          }}>
            <button onClick={e => { e.stopPropagation(); onMove(index, index - 1) }} disabled={index === 0}
              title="← précédent" style={{ ...moveBtnStyle(index === 0), width: 18, height: 18, fontSize: 9, background: 'rgba(255,255,255,0.9)' }}>←</button>
            <button onClick={e => { e.stopPropagation(); onMove(index, index + 1) }} disabled={index === total - 1}
              title="suivant →" style={{ ...moveBtnStyle(index === total - 1), width: 18, height: 18, fontSize: 9, background: 'rgba(255,255,255,0.9)' }}>→</button>
          </div>
        )}
      </div>
      <div className="t-mono-xs" style={{ fontSize: 9, color: 'var(--tx3)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        #{w.OeuvreID}
      </div>
    </div>
  )
}
