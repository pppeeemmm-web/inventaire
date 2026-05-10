'use client'

// TeamPortalClient — fully interactive shell for the /atelier team portal.
// Receives pre-fetched reference data from app/atelier/page.tsx.
// Manages global state: active tab, work drawer, selection, working groups.
// Heavy tab panels load on demand (next/dynamic). SystemTab is eager-loaded to avoid dev ChunkLoadError on that chunk.

import { useState, useMemo, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { WorkThumb } from './WorkThumb'
import type { Oeuvre } from '@/lib/types/database'

import { WorkDrawer }          from '@/components/atelier/WorkDrawer'
import { CurationDock }        from '@/components/atelier/CurationDock'
import { fetchContactConflicts } from '@/app/atelier/contacts/actions'
import { ExhibitionsTabSkeleton } from '@/components/atelier/ExhibitionsTabSkeleton'
import { SystemTab } from '@/components/atelier/SystemTab'

function TabPanelFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, color: 'var(--tx3)' }}>
      <span className="t-mono-sm">Loading...</span>
    </div>
  )
}

/** Lazy tabs: ssr:false — panel JS/CSS only runs client-side; avoids hydration mismatch (React #418) */
const InventoryTab = dynamic(() => import('@/components/atelier/InventoryTab').then((m) => ({ default: m.InventoryTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ConstellationCanvas = dynamic(() => import('@/components/atelier/ConstellationCanvas').then((m) => ({ default: m.ConstellationCanvas })), { loading: () => <TabPanelFallback />, ssr: false })
const VaultTab = dynamic(() => import('@/components/atelier/VaultTab').then((m) => ({ default: m.VaultTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ProductionTab = dynamic(() => import('@/components/atelier/ProductionTab').then((m) => ({ default: m.ProductionTab })), { loading: () => <TabPanelFallback />, ssr: false })
const LogisticsTab = dynamic(() => import('@/components/atelier/LogisticsTab').then((m) => ({ default: m.LogisticsTab })), { loading: () => <TabPanelFallback />, ssr: false })
const SalesTab = dynamic(() => import('@/components/atelier/SalesTab').then((m) => ({ default: m.SalesTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ContactsTab = dynamic(() => import('@/components/atelier/ContactsTab').then((m) => ({ default: m.ContactsTab })), { loading: () => <TabPanelFallback />, ssr: false })
const WorldMapTab = dynamic(() => import('@/components/atelier/WorldMapTab').then((m) => ({ default: m.WorldMapTab })), { loading: () => <TabPanelFallback />, ssr: false })
const PipelineTab = dynamic(() => import('@/components/atelier/PipelineTab').then((m) => ({ default: m.PipelineTab })), { loading: () => <TabPanelFallback />, ssr: false })
const FiscalTab = dynamic(() => import('@/components/atelier/FiscalTab').then((m) => ({ default: m.FiscalTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ConceptsTab = dynamic(() => import('@/components/atelier/ConceptsTab').then((m) => ({ default: m.ConceptsTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ExhibitionsTab = dynamic(() => import('@/components/atelier/ExhibitionsTab').then((m) => ({ default: m.ExhibitionsTab })), { loading: () => <ExhibitionsTabSkeleton />, ssr: false })
const ThemesTab = dynamic(() => import('@/components/atelier/ThemesTab').then((m) => ({ default: m.ThemesTab })), { loading: () => <TabPanelFallback />, ssr: false })
const PortfolioTab = dynamic(() => import('@/components/atelier/PortfolioTab').then((m) => ({ default: m.PortfolioTab })), { loading: () => <TabPanelFallback />, ssr: false })
const SupplierHub = dynamic(() => import('@/components/atelier/SupplierHub').then((m) => ({ default: m.SupplierHub })), { loading: () => <TabPanelFallback />, ssr: false })
const StockTakeTab = dynamic(() => import('@/components/atelier/StockTakeTab').then((m) => ({ default: m.StockTakeTab })), { loading: () => <TabPanelFallback />, ssr: false })
const AuditTab = dynamic(() => import('@/components/atelier/AuditTab').then((m) => ({ default: m.AuditTab })), { loading: () => <TabPanelFallback />, ssr: false })

// ── Types ────────────────────────────────────────────────────────────

type Tab =
  | 'overview' | 'inventory' | 'constellation' | 'production'
  | 'logistics' | 'sales' | 'exhibitions' | 'vault' | 'contacts' | 'map' | 'pipeline' | 'fiscal' | 'concepts' | 'themes' | 'stock' | 'stock-take' | 'system' | 'portfolio' | 'audit'

export interface TeamPortalClientProps {
  oeuvres:        Oeuvre[]
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  themes:         { id:          number; name:      string }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  statusLabelMap: Record<number, string>
  initialGroups:  { id: string; name: string }[]
  presentations:  { PresentationID: number; Nom: string | null }[]
  exhibitions:   any[]
  // Optional — not yet passed from page.tsx; defaults to {} to avoid crash
  themeWorkCount?: Record<number, number>
  groupWorkCount?:  Record<string, number>
  addresses?:       any[]
  themePublicStats?: Record<number, { total: number; pub: number }>
  themePrivateWorks?: Record<number, { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }[]>
  groupPrivateWorks?: Record<string, { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }[]>
  themeToGroups?:      Record<number, string[]>
  groupToThemes?:      Record<string, number[]>
}

// ── Component ────────────────────────────────────────────────────────

export function TeamPortalClient({
  oeuvres, techniques, supports, formats, themes, contacts,
  statusLabelMap, initialGroups, presentations, exhibitions,
  themeWorkCount = {}, groupWorkCount = {},
  addresses = [],
  themePublicStats = {},
  themePrivateWorks = {},
  groupPrivateWorks = {},
  themeToGroups = {},
  groupToThemes = {},
}: TeamPortalClientProps) {
  const { t, lang, setLang } = useI18n()
  const router = useRouter()
  
  const [inspected,  setInspected]  = useState<Oeuvre | null>(null)
  const onOpen = setInspected

  // ── Global state ───────────────────────────────────────────────

  // Always start with 'overview' on server and client — prevents hydration mismatch.
  // Restore last tab from localStorage after first paint.
  const [tab,            setTab]          = useState<Tab>('overview')
  const [reminderCount,  setReminderCount] = useState(0)
  const [theme,          setTheme]          = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const savedTab = localStorage.getItem('pem_team_tab') as Tab | null
    if (savedTab) setTab(savedTab)
    const savedTheme = localStorage.getItem('pem_theme') as 'dark' | 'light' | null
    if (savedTheme) setTheme(savedTheme)
  }, [])

  // Warm exhibitions chunk after paint — reduces flash when opening Commercial → Exhibitions
  useEffect(() => {
    const run = () => void import('@/components/atelier/ExhibitionsTab')
    let id: number | ReturnType<typeof setTimeout>
    if (typeof requestIdleCallback !== 'undefined') {
      id = requestIdleCallback(run, { timeout: 2500 })
      return () => cancelIdleCallback(id as number)
    }
    id = setTimeout(run, 1200)
    return () => clearTimeout(id as ReturnType<typeof setTimeout>)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pem_theme', theme)
  }, [theme])

  // Poll unread reminders for the landing badge
  useEffect(() => {
    const sb = createClient()
    ;(sb.from('suivi_reminder') as any)
      .select('id', { count: 'exact', head: true })
      .eq('lu', false)
      .then(({ count }: { count: number | null }) => setReminderCount(count ?? 0))
      .catch(err => console.error("Reminder Poll Error:", err))
  }, [tab])

  const [selection,  setSelection]  = useState<Set<number>>(new Set())
  const [groups,     setGroups]     = useState<{ id: string; name: string }[]>(
    [...initialGroups].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  )

  useEffect(() => {
    (window as any).setSelection = setSelection
  }, [])

  const [showCompare, setShowCompare] = useState(false)
  const [toast,         setToast]        = useState<string | null>(null)

  // Curation maps
  const [oeuvreThemeMap, setOeuvreThemeMap] = useState<Map<number, number[]>>(new Map())
  const [oeuvreGroupMap, setOeuvreGroupMap] = useState<Map<number, string[]>>(new Map())
  const [conflicts,      setConflicts]      = useState<any[]>([])
  const [isAdmin,        setIsAdmin]        = useState(false)

  useEffect(() => {
    const sb = createClient()
    // Fetch Themes
    ;(sb.from('oeuvre_theme') as any).select('oeuvre_id, theme_id').range(0, 10000).then(({ data }: { data: { oeuvre_id: number; theme_id: number }[] | null }) => {
      if (!data) return
      const map = new Map<number, number[]>()
      data.forEach(({ oeuvre_id, theme_id }) => {
        if (!map.has(oeuvre_id)) map.set(oeuvre_id, [])
        map.get(oeuvre_id)!.push(theme_id)
      })
      setOeuvreThemeMap(map)
    }).catch(err => console.error("Theme Map Error:", err))
    // Fetch Groups
    ;(sb.from('working_group_work') as any).select('oeuvre_id, group_id').range(0, 10000).then(({ data }: { data: { oeuvre_id: number; group_id: string }[] | null }) => {
      if (!data) return
      const map = new Map<number, string[]>()
      data.forEach(({ oeuvre_id, group_id }) => {
        if (!map.has(oeuvre_id)) map.set(oeuvre_id, [])
        map.get(oeuvre_id)!.push(group_id)
      })
      setOeuvreGroupMap(map)
    }).catch(err => console.error("Group Map Error:", err))

    // Fetch Conflicts (Admin only)
    fetchContactConflicts().then(data => {
      setConflicts(data)
      if (data.length > 0 || tab === 'overview') {
        // Also check admin status
        sb.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
              .then(({ data: p }) => setIsAdmin(p?.role === 'admin'))
          }
        })
      }
    })
  }, [tab])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('batch') === 'success') {
      setToast(t('batchSuccess'))
      // Clean up URL without reload
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setToast(null), 4000)
    }
  }, [t])

  function handleSetTab(next: Tab) {
    setTab(next)
    localStorage.setItem('pem_team_tab', next)
  }

  // ── Derived lookup maps ────────────────────────────────────────

  const sortedTechniques = useMemo(() => [...techniques].sort((a, b) => (a.Technique ?? '').localeCompare(b.Technique ?? '', 'fr')), [techniques])
  const sortedSupports   = useMemo(() => [...supports].sort((a, b) => (a.Support ?? '').localeCompare(b.Support ?? '', 'fr')), [supports])
  const sortedFormats    = useMemo(() => [...formats].sort((a, b) => (a.Format ?? '').localeCompare(b.Format ?? '', 'fr')), [formats])
  const sortedThemes     = useMemo(() => [...themes].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr')), [themes])

  const tM = useMemo(
    () => Object.fromEntries(techniques.map((x) => [x.TechniqueID, x.Technique ?? ''])),
    [techniques],
  )
  const sM = useMemo(
    () => Object.fromEntries(supports.map((x) => [x.SupportID, x.Support ?? ''])),
    [supports],
  )
  const cM = useMemo(
    () => Object.fromEntries(contacts.map((c) => {
      const label = c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)
      return [c.ContactID, label]
    })),
    [contacts],
  )
  // locMap: ContactID → "Ville, Pays" — used to resolve work location
  const locMap = useMemo(
    () => Object.fromEntries(
      contacts
        .filter((c) => c.Ville || c.Pays)
        .map((c) => {
          const loc = [c.Ville, c.Pays].filter(Boolean).join(', ')
          return [c.ContactID, loc]
        })
    ),
    [contacts],
  )
  const pM = useMemo(
    () => Object.fromEntries(presentations.map((p) => [p.PresentationID, p.Nom ?? ''])),
    [presentations],
  )
  const thM = useMemo(
    () => Object.fromEntries(themes.map((t) => [t.id, t.name])),
    [themes],
  )
  const groupNameMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.name])),
    [groups],
  )

  // ── Save working group (Supabase) ──────────────────────────────

  const handleSaveGroup = useCallback(async (name: string, ids: number[]): Promise<string | null> => {
    const supabase = createClient()
    const { data: grp, error } = await (supabase.from('working_group') as any)
      .insert({ name })
      .select('id')
      .single()

    if (error || !grp) return null

    await (supabase.from('working_group_work') as any).insert(
      ids.map((id, i) => ({ group_id: (grp as any).id, oeuvre_id: id, position: i })),
    )

    setGroups((prev) => [{ id: (grp as any).id, name }, ...prev])
    return (grp as any).id
  }, [])

  // ── Environment Check ──────────────────────────────────────────
  const isConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  if (!isConfigured) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)', color: 'var(--tx)', textAlign: 'center', padding: 40 }}>
        <div>
          <h2 style={{ color: 'var(--rust)', marginBottom: 20 }}>Configuration Error</h2>
          <p style={{ opacity: 0.7, maxWidth: 400, margin: '0 auto', fontSize: 14 }}>
            The application is missing its connection keys. 
            Please ensure <strong>NEXT_PUBLIC_SUPABASE_URL</strong> and <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> are set in Vercel.
          </p>
        </div>
      </div>
    )
  }

  // ── Tab definitions ────────────────────────────────────────────


  const TABS_RAW: [Tab, string, number?][] = [
    ['overview',      t('overview')],
    ['inventory',     t('inventory'), oeuvres.length],
    ['constellation', t('constellation')],
    ['production',    t('production')],
    ['logistics',     t('logistics')],
    ['sales',         t('sales')],
    ['exhibitions',   t('exhibitions')],
    ['vault',         t('vault')],
    ['contacts',      t('contacts'), contacts.length],
    ['pipeline',      t('pipeline')],
    ['map',           t('map')],
    ['fiscal',        t('fiscal')],
    ['concepts',      t('concepts')],
    ['themes',        t('themes')],
    ['portfolio',     'Public'],
    ['stock',         'Stock'],
    ['stock-take',    'Stock-take'],
    ['system',        'System'],
    ['audit',         'Audit Log'],
  ]

  const activeTabLabel = TABS_RAW.find(x => x[0] === tab)?.[1] ?? ''

  const GROUPS: { label: string, tabs: Tab[] }[] = [
    { label: 'Gestion', tabs: ['overview', 'inventory', 'contacts', 'vault'] },
    { label: 'Opérations', tabs: ['production', 'logistics', 'stock', 'stock-take'] },
    { label: 'Vision', tabs: ['constellation', 'concepts', 'themes', 'map'] },
    { label: 'Commercial', tabs: ['sales', 'exhibitions', 'pipeline', 'fiscal'] },
    { label: 'Diffusion', tabs: ['portfolio'] },
    { label: 'Config', tabs: isAdmin ? ['system', 'audit'] : ['system'] },
  ]

  const showDock = selection.size > 0 && tab !== 'constellation'

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg0)', overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/hub')} 
            className="t-mono-sm" 
            style={{ color: 'var(--tx3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>
            Hub
          </button>
          <span style={{ color: 'var(--tx3)', fontSize: 10, opacity: 0.3 }}>/</span>
          <div className="serif" style={{ fontSize: 24, letterSpacing: '-0.01em', color: 'var(--tx)' }}>Atelier</div>
          <span style={{ color: 'var(--tx3)', fontSize: 10, opacity: 0.3 }}>/</span>
          <div className="t-eyebrow" style={{ color: 'var(--ac)', fontSize: 10 }}>{activeTabLabel}</div>
          <div className="vline" style={{ height: 16, opacity: 0.3, marginLeft: 8 }} />
          <div className="t-mono-sm" style={{ opacity: 0.5, fontSize: 9 }}>{oeuvres.length} ŒUVRES</div>
        </div>

        <div className="row gap-sm">
          <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1 }}>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                color: 'var(--tx2)',
                fontWeight: 600,
                borderRight: '1px solid var(--bd)',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
              {theme === 'dark' ? '🌙' : '☀️'}
              <span>{theme === 'dark' ? 'NIGHT' : 'DAY'}</span>
            </button>
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                style={{
                  padding: '4px 10px',
                  background: lang === l ? 'var(--ac)' : 'transparent',
                  color: lang === l ? 'var(--bg0)' : 'var(--tx3)',
                  fontWeight: lang === l ? 600 : 400,
                  borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none',
                }}
              >{l.toUpperCase()}</button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={() => router.push('/atelier/works/new')}>+ {t('newWork')}</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--bd)', background: 'var(--bg1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
          {GROUPS.map((g) => (
            <div key={g.label} style={{ marginBottom: 20 }}>
              <div className="t-eyebrow" style={{ padding: '0 20px', marginBottom: 8, color: 'var(--tx2)', fontSize: 9, letterSpacing: '2px', fontWeight: 600, opacity: 0.8 }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.tabs.map((k) => {
                  const item = TABS_RAW.find(x => x[0] === k)
                  if (!item) return null
                  const [key, label, count] = item
                  const isActive = tab === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSetTab(key)}
                      className={isActive ? 'pem-sidebar-tab pem-sidebar-tab--on' : 'pem-sidebar-tab'}
                      style={{
                        padding: '6px 20px',
                        fontSize: 11,
                        textAlign: 'left',
                        border: 'none',
                        cursor: 'pointer',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontWeight: isActive ? 600 : 400 }}>{label}</span>
                      {count !== undefined && (
                        <span style={{ 
                          fontSize: 9, opacity: 0.7, padding: '1px 4px', 
                          border: '1px solid currentColor', borderRadius: 1,
                          background: isActive ? 'var(--ac)' : 'transparent',
                          color: isActive ? 'var(--bg1)' : 'inherit'
                        }}>{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {tab === 'overview' && (
          <OverviewTab
            oeuvres={oeuvres}
            tM={tM}
            t={t as (k: string) => string}
            onGoTab={handleSetTab}
            reminderCount={reminderCount}
            isAdmin={isAdmin}
            conflicts={conflicts}
          />
        )}

        {tab === 'inventory' && (
          <InventoryTab
            oeuvres={oeuvres}
            techniques={sortedTechniques}
            supports={sortedSupports}
            formats={sortedFormats}
            themes={sortedThemes}
            groups={groups}
            contacts={contacts}
            presentations={presentations}
            tM={tM} sM={sM} cM={cM} pM={pM} locMap={locMap}
            statusLabelMap={statusLabelMap}
            selection={selection}
            setSelection={setSelection}
            onOpen={setInspected}
          />
        )}

        {tab === 'constellation' && (
          <ConstellationCanvas
            oeuvres={oeuvres}
            tM={tM}
            themes={sortedThemes}
            groups={groups}
            selection={selection}
            setSelection={setSelection}
            onOpen={setInspected}
            onSaveGroup={handleSaveGroup}
          />
        )}

        {tab === 'production' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0, width: '100%' }}>
            <ProductionTab
              oeuvres={oeuvres}
              tM={tM}
              statusLabelMap={statusLabelMap}
              onOpen={setInspected}
            />
          </div>
        )}
        {tab === 'logistics' && (
          <LogisticsTab cM={cM} />
        )}
        {tab === 'sales' && (
          <SalesTab
            oeuvres={oeuvres}
            statusLabelMap={statusLabelMap}
            contacts={contacts}
            groups={groups}
            cM={cM}
            tM={tM}
          />
        )}
        {tab === 'exhibitions' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <ExhibitionsTab
              oeuvres={oeuvres}
              contacts={contacts}
              themes={sortedThemes}
              tM={tM}
              selection={selection}
              setSelection={setSelection}
            />
          </div>
        )}
        {tab === 'vault' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <VaultTab oeuvres={oeuvres} tM={tM} />
          </div>
        )}
        {tab === 'contacts' && <ContactsTab contacts={contacts} oeuvres={oeuvres} conflicts={conflicts} />}
        {tab === 'portfolio' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <PortfolioTab oeuvres={oeuvres} themes={themes} themePublicStats={themePublicStats} themePrivateWorks={themePrivateWorks} />
          </div>
        )}
        {tab === 'audit' && <AuditTab />}
        {tab === 'map' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <WorldMapTab
              contacts={contacts}
              oeuvres={oeuvres}
              tM={tM}
              thM={thM}
              statusLabelMap={statusLabelMap}
              oeuvreThemeMap={oeuvreThemeMap}
              onOpenContact={(id) => {
                handleSetTab('contacts')
                // ContactsTab reads openContactId from sessionStorage
                sessionStorage.setItem('pem_open_contact', String(id))
              }}
            />
          </div>
        )}
        {tab === 'pipeline' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <PipelineTab oeuvres={oeuvres} contacts={contacts} exhibitions={exhibitions} groups={groups} />
          </div>
        )}
        {tab === 'fiscal' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <FiscalTab oeuvres={oeuvres} contacts={contacts} />
          </div>
        )}
        {tab === 'themes' && (
          <ThemesTab
            initialThemes={[...themes].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr'))}
            initialGroups={groups}
            themeWorkCount={themeWorkCount}
            groupWorkCount={groupWorkCount}
            themePrivateWorks={themePrivateWorks}
            groupPrivateWorks={groupPrivateWorks}
            themeToGroups={themeToGroups}
            groupToThemes={groupToThemes}
            oeuvres={oeuvres}
            onOpen={onOpen}
            tM={tM}
          />
        )}

        {tab === 'concepts' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <ConceptsTab />
          </div>
        )}
        {tab === 'stock' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <SupplierHub contacts={contacts} />
          </div>
        )}

        {tab === 'stock-take' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <StockTakeTab contacts={contacts} />
          </div>
        )}
        {tab === 'system' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <SystemTab />
          </div>
        )}
      </div>

      {/* ── Work Drawer ─────────────────────────────────────────── */}
      {inspected && (
        <WorkDrawer
          o={inspected}
          tM={tM} sM={sM} cM={cM} pM={pM}
          statusLabelMap={statusLabelMap}
          selection={selection}
          setSelection={setSelection}
          onClose={() => setInspected(null)}
          // Curation props
          thM={thM}
          oeuvreThemeMap={oeuvreThemeMap}
          oeuvreGroupMap={oeuvreGroupMap}
          groupNameMap={groupNameMap}
          // Reference data for editing
          techniques={techniques}
          supports={supports}
          formats={formats}
          themes={themes}
          contacts={contacts}
          groups={groups}
          presentations={presentations}
        />
      )}

      {/* ── Curation Dock (non-constellation tabs with selection) ── */}
      {showDock && (
        <CurationDock
          selection={selection}
          setSelection={setSelection}
          oeuvres={oeuvres}
          techniques={techniques}
          supports={supports}
          formats={formats}
          contacts={contacts}
          themes={themes}
          groups={groups}
          tM={tM}
          sM={sM}
          statusLabelMap={statusLabelMap}
          onGoConstellation={() => {
            sessionStorage.setItem('pem_curation_trigger', 'true')
            handleSetTab('constellation')
          }}
          addresses={addresses ?? []}
          onSaveGroup={handleSaveGroup}
          onCompare={() => setShowCompare(true)}
        />
      )}

      {/* ── Compare Modal ────────────────────────────────────────── */}
      {showCompare && (
        <CompareModal
          ids={[...selection]}
          oeuvres={oeuvres}
          tM={tM} sM={sM}
          contacts={contacts}
          addresses={addresses}
          statusLabelMap={statusLabelMap}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* ── Toast Notification ──────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 200,
          background: 'var(--bg2)', border: '1px solid var(--ac)',
          padding: '12px 20px', borderRadius: 2,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          color: 'var(--ac)', display: 'flex', alignItems: 'center', gap: 12,
          animation: 'toastIn 0.3s ease-out',
        }}>
          <span style={{ fontSize: 16 }}>✓</span>
          <span className="t-mono-sm" style={{ fontWeight: 600 }}>{toast}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  </div>
)
}

// ── Overview tab ─────────────────────────────────────────────────────

function OverviewTab({
  oeuvres, tM, t, onGoTab, reminderCount, isAdmin, conflicts,
}: {
  oeuvres:       Oeuvre[]
  tM:            Record<number, string>
  t:             (k: string) => string
  onGoTab:       (tab: Tab) => void
  reminderCount: number
  isAdmin:       boolean
  conflicts:     any[]
}) {
  const thisYear   = new Date().getFullYear()
  const byYear     = oeuvres.filter((o) => o.Année?.startsWith(String(thisYear))).length
  const withPrice  = oeuvres.filter((o) => o.Prix && o.Prix > 0).length
  const available  = oeuvres.filter((o) => o.statusId === 2).length
  const exposable  = oeuvres.filter((o) => o.Exposable && o.statusId === 2).length

  // New: Recent Works
  const recentWorks = [...oeuvres].sort((a, b) => b.OeuvreID - a.OeuvreID).slice(0, 6)

  // New: Data Health
  const missingDims   = oeuvres.filter(o => !o.Hauteur || !o.Largeur).length
  const missingImages = oeuvres.filter(o => !o.txtImageNameLink).length
  const missingLoc    = oeuvres.filter(o => !o.LocalisationID).length

  // New: Production Summary (Simplified)
  const inProgress = oeuvres.filter(o => o.statusId === 1).length
  const ready      = oeuvres.filter(o => o.statusId === 2 || o.Exposable).length

  // Upcoming deadlines from pipeline
  const [upcoming,  setUpcoming]  = useState<{ nom: string; date_fin: string; deadline_time: string | null; type: string }[]>([])
  const [reminders, setReminders] = useState<{ id: string; message: string; remind_at: string }[]>([])
  const [burningConcepts, setBurningConcepts] = useState<{ id: string; titre: string; energie: number }[]>([])
  const [expenseTotal, setExpenseTotal] = useState(0)

  useEffect(() => {
    const sb = createClient()
    // Fetch total expenses for this year
    ;(sb.from('expense') as any)
      .select('montant_ttc')
      .eq('fiscal_year', thisYear)
      .then(({ data }: { data: { montant_ttc: number }[] | null }) => {
        if (data) setExpenseTotal(data.reduce((s, e) => s + (e.montant_ttc || 0), 0))
      })

    ;(sb.from('suivi_process') as any)
      .select('nom, date_fin, deadline_time, type, statut')
      .not('date_fin', 'is', null)
      .not('statut', 'in', '("perdu","annule","termine")')
      .order('date_fin', { ascending: true })
      .limit(8)
      .then(({ data }: { data: any[] | null }) => {
        if (data) setUpcoming(data.filter((p) => {
          const d = new Date(p.date_fin); d.setHours(0,0,0,0)
          const n = new Date(); n.setHours(0,0,0,0)
          return Math.ceil((d.getTime()-n.getTime())/86400000) <= 45
        }))
      })
    ;(sb.from('suivi_reminder') as any)
      .select('id, message, remind_at')
      .eq('lu', false)
      .order('remind_at')
      .limit(6)
      .then(({ data }: { data: any[] | null }) => { if (data) setReminders(data) })
    ;(sb.from('concept') as any)
      .select('id, titre, energie')
      .gte('energie', 4)
      .not('statut', 'eq', 'abandonne')
      .not('statut', 'eq', 'devenu_oeuvre')
      .order('energie', { ascending: false })
      .limit(5)
      .then(({ data }: { data: any[] | null }) => { if (data) setBurningConcepts(data) })
  }, [thisYear])

  // Technique breakdown
  const byTech = oeuvres.reduce<Record<string, number>>((acc, o) => {
    const k = String(o.Technique ?? 'unknown')
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const topTechs = Object.entries(byTech).sort((a, b) => b[1] - a[1]).slice(0, 5)

  function urgencyColor(days: number) {
    if (days < 0)   return '#c06060'
    if (days <= 7)  return '#c08040'
    if (days <= 21) return '#a0a040'
    return 'var(--tx3)'
  }

  return (
    <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 60, alignItems: 'start' }}>

      {/* Left Column: Dashboard Pulse */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        
        {/* Row 1: Executive Stats */}
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.6 }}>Executive Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, border: '1px solid var(--bd)', background: 'var(--bd)' }}>
            {[
              { l: t('works_cap'),                    v: oeuvres.length },
              { l: `${t('thisYear')} (${thisYear})`,  v: byYear },
              { l: 'Available',                        v: available },
              { l: t('exposable'),                    v: exposable },
              { l: t('priced'),                       v: withPrice },
              { l: 'Total Value',                     v: `€ ${Math.round(oeuvres.reduce((s,o) => s+(o.Prix||0), 0)/1000)}k` },
            ].map(({ l, v }) => (
              <div key={l} style={{ padding: '20px 24px', background: 'var(--bg1)' }}>
                <div className="stat">
                  <span className="l" style={{ fontSize: 9, letterSpacing: 1.5 }}>{l}</span>
                  <span className="v" style={{ fontSize: 24 }}>{v}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 1.5: Financial Pulse */}
        <div>
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>Financial Pulse · {thisYear}</div>
            <button className="t-mono-sm" onClick={() => onGoTab('fiscal')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>MANAGE REVENUES →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, padding: 24, background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="t-label" style={{ fontSize: 10, color: 'var(--tx3)' }}>Income vs Expenses</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Income (Sales)</span>
                  <span style={{ color: 'var(--green)' }}>€ {Math.round(oeuvres.filter(o => o.statusId === 4 && o.Année?.startsWith(String(thisYear))).reduce((s,o) => s+(o.PrixFinal||o.Prix||0), 0)).toLocaleString()}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '100%', background: 'var(--green)', borderRadius: 2 }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span>Expenses</span>
                  <span style={{ color: 'var(--rust)' }}>€ {Math.round(expenseTotal).toLocaleString()}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (expenseTotal / Math.max(1, oeuvres.filter(o => o.statusId === 4 && o.Année?.startsWith(String(thisYear))).reduce((s,o) => s+(o.PrixFinal||o.Prix||0), 0))) * 100)}%`, background: 'var(--rust)', borderRadius: 2 }} />
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '1px solid var(--bd)', paddingLeft: 40 }}>
              <div className="t-label" style={{ fontSize: 10, color: 'var(--tx3)' }}>Cash Health</div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 700 }}>
                  € {Math.round(oeuvres.filter(o => o.statusId === 4 && o.Année?.startsWith(String(thisYear))).reduce((s,o) => s+(o.PrixFinal||o.Prix||0), 0) - expenseTotal).toLocaleString()}
                </div>
                <div className="t-mono-sm" style={{ marginBottom: 8, color: 'var(--tx3)' }}>NET BNC ESTIMATE</div>
              </div>
              <div style={{ fontSize: 9, color: 'var(--tx3)', fontStyle: 'italic' }}>
                * Based on sold works delivered in {thisYear} and recorded expenses.
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Visual Grid (Recent Documentation) */}
        <div>
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>Recent Documentation</div>
            <button className="t-mono-sm" onClick={() => onGoTab('inventory')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>VIEW ALL →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            {recentWorks.map((o) => (
              <div key={o.OeuvreID} style={{ aspectRatio: '1', background: 'var(--bg1)', border: '1px solid var(--bd2)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                {o.txtImageNameLink ? (
                  <WorkThumb file={o.txtImageNameLink} size={256} alt="" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 10 }}>NO IMG</div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, color-mix(in srgb, var(--bg0) 80%, transparent))', color: 'var(--tx)', fontSize: 8, fontFamily: 'var(--font-mono)' }}>
                  #{o.OeuvreID}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Technique & Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          {/* Technique breakdown */}
          <div>
            <div className="t-label" style={{ marginBottom: 16, opacity: 0.8 }}>{t('byTechnique')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topTechs.map(([techId, count]) => {
                const pct = Math.round((count / oeuvres.length) * 100)
                return (
                  <div key={techId} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 30px', alignItems: 'center', gap: 12 }}>
                    <div className="t-mono-sm" style={{ color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tM[Number(techId)] ?? '—'}</div>
                    <div style={{ height: 3, background: 'var(--bg2)', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'var(--ac)' }} />
                    </div>
                    <div className="t-mono-sm" style={{ color: 'var(--tx3)', textAlign: 'right', fontSize: 9 }}>{count}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Production & Health Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
             <div style={{ padding: '16px', background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
                <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 12, color: 'var(--tx3)' }}>Studio Health</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <HealthRow label="Missing Dimensions" count={missingDims} color={missingDims > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                  <HealthRow label="Missing Photos" count={missingImages} color={missingImages > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                  <HealthRow label="No Location Set" count={missingLoc} color={missingLoc > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Right Column: Deadlines & Concepts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Integrity Sentry (Admin Only) */}
        {isAdmin && conflicts.length > 0 && (
          <div style={{ padding: 16, background: 'var(--rust)11', border: '1px solid var(--rust)44' }}>
            <div className="t-eyebrow" style={{ color: 'var(--rust)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚠</span> Integrity Alerts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conflicts.map(c => (
                <div key={c.id} style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--tx)' }}>Contact Collision:</strong><br/>
                  Public entry <em>&quot;{c.public?.NomInstitution || c.public?.Nom}&quot;</em> matches a hidden private record. 
                  <button 
                    onClick={() => onGoTab('contacts')}
                    style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: 'var(--ac)', padding: 0, fontSize: 10, cursor: 'pointer' }}
                  >
                    RESOLVE IN CONTACTS →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reminders Pulse */}
        {reminders.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              Reminders
              {reminderCount > 0 && <span style={{ background: 'var(--ac)', color: 'var(--bg0)', padding: '1px 6px', borderRadius: 10, fontSize: 8 }}>{reminderCount}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reminders.map((r) => {
                const days = Math.ceil((new Date(r.remind_at).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
                return (
                  <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg1)', border: '1px solid var(--bd2)', borderLeft: `2px solid var(--ac)` }}>
                    <div style={{ fontSize: 10, color: 'var(--tx)', lineHeight: 1.4 }}>{r.message}</div>
                    <div style={{ fontSize: 8, color: urgencyColor(days), marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pipeline Pulse */}
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => onGoTab('pipeline')}>
            Active Pipeline →
          </div>
          {upcoming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map((p, i) => {
                const days = Math.ceil((new Date(p.date_fin).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
                const col  = urgencyColor(days)
                return (
                  <div key={i} onClick={() => onGoTab('pipeline')} style={{
                    padding: '10px 12px', background: 'var(--bg1)',
                    border: '1px solid var(--bd2)', cursor: 'pointer',
                    borderLeft: `2px solid ${col}`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--tx)' }}>{p.nom}</div>
                    <div style={{ fontSize: 8, color: col, marginTop: 4, letterSpacing: 0.5 }}>
                      {days < 0 ? `${Math.abs(days)}d OVERDUE` : days === 0 ? 'DUE TODAY' : `IN ${days} DAYS`}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="t-mono-sm" style={{ opacity: 0.4, padding: 12, border: '1px dashed var(--bd2)', textAlign: 'center' }}>No active deadlines</div>
          )}
        </div>

        {/* Burning Concepts */}
        {burningConcepts.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => onGoTab('concepts')}>
              Burning Ideas →
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {burningConcepts.map((c) => (
                <div key={c.id} onClick={() => onGoTab('concepts')} style={{
                  padding: '10px 12px', background: 'var(--bg1)',
                  border: '1px solid var(--bd2)', cursor: 'pointer',
                  borderLeft: `2px solid var(--ac)`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--tx)' }}>{c.titre}</div>
                  <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 4, letterSpacing: 1 }}>
                    {'●'.repeat(c.energie)} <span style={{ marginLeft: 4 }}>{['Vague', 'Naissante', 'Active', 'Urgente', 'Brûlante'][c.energie - 1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HealthRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx2)' }}>{label}</span>
      <span className="t-mono-sm" style={{ fontSize: 10, color, fontWeight: count > 0 ? 700 : 400 }}>{count}</span>
    </div>
  )
}

//
 
// ── Compare Modal ──────────────────────────────────────────────────

function CompareModal({ ids, oeuvres, tM, sM, contacts, addresses, statusLabelMap, onClose }: {
  ids:             number[]
  oeuvres:         Oeuvre[]
  tM:              Record<number, string>
  sM:              Record<number, string>
  contacts:        any[]
  addresses:       any[]
  statusLabelMap:  Record<number, string>
  onClose:         () => void
}) {
  const { t } = useI18n()
  const works = oeuvres.filter(o => ids.includes(o.OeuvreID))

  const contactName = (cid: any) => {
    if (!cid) return '—'
    const c = contacts.find(x => String(x.ContactID) === String(cid))
    if (!c) return `#${cid}`
    return c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${cid}`
  }

  const resolveLocation = (cid: any) => {
    if (!cid) return 'Atelier (Marseille)'
    const c = contacts.find(x => String(x.ContactID) === String(cid))
    if (!c) return `#${cid}`
    
    const relevantAddrs = addresses.filter(a => String(a.contact_id) === String(cid))
    const geo = [c.Ville, c.Pays].filter(Boolean).join(', ')
    
    // If only one address (or none), the location (City/Country) is enough
    if (relevantAddrs.length <= 1) {
      return geo || c.NomInstitution || '—'
    }
    
    // Multiple addresses: show address label + city
    // For now, since we don't have an AddressID in Oeuvre, we look at LocalisationDetail
    // or fallback to the contact name if we can't distinguish.
    const name = c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()
    return geo ? `${name} (${geo})` : name
  }

  // Define ALL fields to compare
  const fields = [
    { l: 'ID',             k: (o: any) => `#${o.OeuvreID}` },
    { l: t('title'),       k: (o: any) => o.Titre || '—' },
    { l: t('year'),        k: (o: any) => yearOf(o.Année) || '—' },
    { l: t('technique'),   k: (o: any) => o.Technique != null ? tM[o.Technique] : '—' },
    { l: t('support'),     k: (o: any) => o.Support != null ? sM[o.Support] : '—' },
    { l: 'Format',         k: (o: any) => o.Format || '—' },
    { l: 'Dimensions',     k: (o: any) => o.Hauteur && o.Largeur ? `${o.Hauteur} × ${o.Largeur} cm` : '—' },
    { l: t('depth'),       k: (o: any) => o.Profondeur ? `${o.Profondeur} cm` : '—' },
    { l: t('tirage'),      k: (o: any) => o.Tirage || '—' },
    { l: t('status'),      k: (o: any) => o.statusId != null ? statusLabelMap[o.statusId] : '—' },
    { l: t('status'),      k: (o: any) => o.statusId != null ? (statusLabelMap[o.statusId] ?? '—') : '—' },
    { l: t('contact'),     k: (o: any) => contactName(o.ContactID) },
    { l: t('location'),    k: (o: any) => resolveLocation(o.LocalisationID) },
    { l: t('price'),       k: (o: any) => o.Prix ? `€ ${Number(o.Prix).toLocaleString('fr-FR')}` : '—' },
    { l: t('discount'),    k: (o: any) => o.Discount ? `€ ${Number(o.Discount).toLocaleString('fr-FR')}` : '—' },
    { l: 'Prix Final',     k: (o: any) => o.PrixFinal ? `€ ${Number(o.PrixFinal).toLocaleString('fr-FR')}` : '—' },
    { l: t('exhibitable'), k: (o: any) => o.Exposable ? '✓' : '—' },
    { l: 'Encadrée',       k: (o: any) => o.Encadree ? '✓' : '—' },
    { l: 'Montée',         k: (o: any) => o.Montee ? '✓' : '—' },
    { l: t('catalogued'),  k: (o: any) => o.Catalogué ? '✓' : '—' },
    { l: 'Anonymat',       k: (o: any) => {
        const level = (o as any).anonymity_level ?? 0
        return level === 0 ? 'Public' : level === 1 ? 'Anonyme' : 'Privé'
      }},
    { l: 'Commission',     k: (o: any) => o.IsCommission ? '✓' : '—' },
    { l: t('notes'),       k: (o: any) => o.Commentaires || '—' },
    { l: t('history'),     k: (o: any) => o.Historique || '—' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,10,12,0.98)',
      display: 'flex', flexDirection: 'column', padding: '40px 60px',
      backdropFilter: 'blur(12px)',
    }} onClick={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="t-eyebrow" style={{ color: '#fff' }}>{t('compare')} — {ids.length} {t('works')}</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
      </div>

      <div style={{
        flex: 1, overflow: 'auto', background: 'var(--bg1)', border: '1px solid var(--bd)',
        scrollbarWidth: 'thin', scrollbarColor: 'var(--ac) transparent',
      }} onClick={e => e.stopPropagation()}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', left: 0, top: 0, zIndex: 20, background: 'var(--bg2)',
                padding: '16px 24px', textAlign: 'left', borderBottom: '2px solid var(--bd)',
                borderRight: '2px solid var(--bd)', color: 'var(--tx3)', fontSize: 9, letterSpacing: 1.5,
              }}>
                CHARACTERISTIC
              </th>
              {works.map(o => (
                <th key={o.OeuvreID} style={{
                  position: 'sticky', top: 0, zIndex: 15,
                  padding: '12px 20px', textAlign: 'left', borderBottom: '2px solid var(--bd)',
                  background: 'var(--bg1)', minWidth: 200, maxWidth: 280,
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, background: '#000', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--bd)', position: 'relative' }}>
                      {o.txtImageNameLink ? (
                        <WorkThumb file={o.txtImageNameLink} size={128} alt="" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 8 }}>—</div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="t-mono-sm" style={{ color: 'var(--ac)', fontSize: 9 }}>#{o.OeuvreID}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.Titre || '—'}
                      </div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={{
                  position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg2)',
                  padding: '10px 24px', borderBottom: '1px solid var(--bd)',
                  borderRight: '2px solid var(--bd)', color: 'var(--tx3)', fontSize: 8,
                  textTransform: 'uppercase', letterSpacing: 1.2,
                }}>
                  {f.l}
                </td>
                {works.map(o => (
                  <td key={o.OeuvreID} style={{
                    padding: '10px 20px', borderBottom: '1px solid var(--bd)',
                    color: 'var(--tx2)', fontSize: 10, verticalAlign: 'top',
                    whiteSpace: (f.l === t('notes') || f.l === t('history')) ? 'pre-wrap' : 'nowrap',
                    maxWidth: 280,
                  }}>
                    {f.k(o)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
