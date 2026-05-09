'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { savePortfolioConfig, loadPortfolioConfig, extractDocumentText, setWorkPublic } from '@/app/atelier/portfolio/actions'
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
  works_collections: CollectionItem[]
}

type ThemeWork = { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }

interface Props {
  oeuvres: Oeuvre[]
  themes:  { ThemeID: number; Nom: string }[]
  themePublicStats?: Record<number, { total: number; pub: number }>
  themePrivateWorks?: Record<number, ThemeWork[]>
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PortfolioConfig = {
  general: { artist_name: '', contact_email: '', instagram: '', phone: '', media_tagline_fr: '', media_tagline_en: '' },
  about:   { intro_fr: '', intro_en: '' },
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
  const [saving,     setSaving]     = useState(false)
  const [activeTab,  setActiveTab]  = useState<'website' | 'portfolio' | 'analytics'>('website')
  const [activeSlot, setActiveSlot] = useState<{
    type: 'theme'
    page: 'works' | 'sections'
    index: number
  } | null>(null)

  const themeNames = themes.map(t => t.Nom).sort((a, b) => a.localeCompare(b, 'fr'))

  const themeNameStats = useMemo(() => {
    const map: Record<string, { total: number; pub: number }> = {}
    for (const t of themes) {
      const s = themePublicStats[t.ThemeID]
      if (s) map[t.Nom] = s
    }
    return map
  }, [themes, themePublicStats])

  const themeNamePrivateWorks = useMemo(() => {
    const map: Record<string, ThemeWork[]> = {}
    for (const t of themes) {
      const ws = themePrivateWorks[t.ThemeID]
      if (ws?.length) map[t.Nom] = ws
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

  const handleSave = async () => {
    setSaving(true)
    const result = await savePortfolioConfig(config)
    setSaving(false)
    if ('error' in result) alert(`Error: ${result.error}`)
    else alert('Published successfully.')
  }

  const handleTransfer = (value: string) => {
    if (!activeSlot) return
    const { page, index } = activeSlot
    const next = { ...config }
    const listKey = page === 'works' ? 'works_collections' : 'sections'
    next[listKey][index].theme = value
    setConfig(next)
    setActiveSlot(null)
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
          <button className="btn primary" onClick={handleSave} disabled={saving} style={{ fontSize: 9, letterSpacing: 2 }}>
            {saving ? 'Publication...' : 'Publier'}
          </button>
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
                        onDelete={() => setConfig({ ...config, works_collections: config.works_collections.filter(x => x.id !== item.id) })}
                        themeStats={themeNameStats}
                        privateWorks={item.theme ? themeNamePrivateWorks[item.theme] : undefined}
                        onMakePublic={handleMakePublic} />
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
                    Chaque section génère une carte d&apos;introduction dans le portfolio, suivie des œuvres du thème assigné.
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
              <AnalyticsPanel />
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
  const max = Math.max(...trend.map(d => d.views), 1)
  const h = 48
  const w = 100
  const pts = trend.map((d, i) => {
    const x = (i / (trend.length - 1)) * w
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

function AnalyticsPanel() {
  const [days,    setDays]    = useState(30)
  const [result,  setResult]  = useState<AnalyticsResult | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (d: number) => {
    setLoading(true)
    setResult(await getAnalyticsStats(d))
    setLoading(false)
  }, [])

  useEffect(() => { load(days) }, [load, days])

  return (
    <div style={{ maxWidth: 720 }}>
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
              <div className="t-label" style={{ marginBottom: 10 }}>Pages vues</div>
              <div style={{ fontSize: 32, fontWeight: 300, color: 'var(--tx)', fontFamily: 'var(--font-serif, serif)', letterSpacing: -0.5 }}>
                {result.pageviews.toLocaleString('fr-FR')}
              </div>
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

          {/* Referrers */}
          {result.topReferrers.length > 0 && (
            <div>
              <div className="t-label" style={{ marginBottom: 14 }}>Sources</div>
              <BarList items={result.topReferrers} labelKey="referrer" valueKey="views" />
            </div>
          )}

          <div className="t-mono-xs" style={{ color: 'var(--tx3)', opacity: 0.5 }}>
            Supabase · temps réel
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


function CollectionRow({ item, isTarget, onAssign, onUpdate, onDelete, themeStats, privateWorks, onMakePublic }: {
  item: CollectionItem; isTarget: boolean
  onAssign: () => void
  onUpdate: (p: Partial<CollectionItem>) => void
  onDelete: () => void
  themeStats?: Record<string, { total: number; pub: number }>
  privateWorks?: ThemeWork[]
  onMakePublic?: (id: number) => void
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
          {privateWorks && privateWorks.length > 0 && (() => {
            const hidden  = privateWorks.filter(w => !w.isPublic)
            const visible = privateWorks.filter(w =>  w.isPublic)
            const Thumb = ({ w }: { w: ThemeWork }) => (
              <div style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                {/* image or no-image placeholder */}
                <div style={{
                  width: 64, height: 64, overflow: 'hidden', flexShrink: 0,
                  background: 'repeating-linear-gradient(45deg, var(--bg2), var(--bg2) 6px, var(--bg1) 6px, var(--bg1) 12px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: !w.isPublic ? '2px solid var(--rust)' : '2px solid transparent',
                  boxSizing: 'border-box',
                  position: 'relative',
                }}>
                  {w.txtImageNameLink
                    ? <WorkThumb file={w.txtImageNameLink} size={128} alt="" />
                    : <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--tx3)', opacity: 0.4, userSelect: 'none', lineHeight: 1 }}>{w.OeuvreID}</span>
                  }
                </div>
                {/* ID below the card */}
                <div className="t-mono-xs" style={{
                  fontSize: 9, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: w.isPublic ? 'var(--tx3)' : 'var(--rust)', fontWeight: w.isPublic ? 400 : 700,
                }}>#{w.OeuvreID}</div>
                {/* make-public button for private works */}
                {!w.isPublic && onMakePublic && (
                  <button
                    onClick={() => onMakePublic(w.OeuvreID)}
                    title={`Rendre #${w.OeuvreID} public (→ Disponible)`}
                    style={{
                      width: '100%', background: 'var(--rust)', color: '#fff',
                      border: 'none', borderRadius: 2, fontSize: 8, padding: '2px 0',
                      cursor: 'pointer', letterSpacing: 0.3, textAlign: 'center', fontWeight: 600,
                    }}>→ publier</button>
                )}
              </div>
            )
            return (
              <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {hidden.length > 0 && (
                  <div>
                    <div className="t-mono-xs" style={{ color: 'var(--rust)', fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
                      ⚠ NON-PUBLIQUES ({hidden.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {hidden.map(w => <Thumb key={w.OeuvreID} w={w} />)}
                    </div>
                  </div>
                )}
                {hidden.length > 0 && visible.length > 0 && (
                  <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--bd)', flexShrink: 0, marginTop: 20 }} />
                )}
                {visible.length > 0 && (
                  <div>
                    <div className="t-mono-xs" style={{ color: 'var(--tx3)', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>
                      PUBLIQUES ({visible.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {visible.map(w => <Thumb key={w.OeuvreID} w={w} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
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
