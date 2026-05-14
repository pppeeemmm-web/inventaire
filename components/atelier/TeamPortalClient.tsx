'use client'

// TeamPortalClient — fully interactive shell for the /atelier team portal.
// Receives pre-fetched reference data from app/atelier/page.tsx.
// Manages global state: active tab, work drawer, selection, working groups.
// Heavy tab panels load on demand (next/dynamic). SystemTab + ContactsTab eager-loaded to avoid dev ChunkLoadError on those chunks.

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { CommandPalette } from './CommandPalette'
import { useUnsavedActionGuard } from '@/hooks/useUnsavedActionGuard'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { WorkThumb } from './WorkThumb'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { TeamPortalClientProps, AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import { yearOf, formatInventoryDims } from '@/lib/data'
import { daysUntil } from '@/lib/pipeline-deadlines'
import {
  filterEventsInDateKeyRange,
} from '@/lib/pipeline-calendar'
import type { Lang } from '@/lib/i18n/dictionary'

import { useMediaQuery } from '@/lib/useMediaQuery'
import { WorkDrawer, type WorkDrawerGuardHandle } from '@/components/atelier/WorkDrawer'
import { CurationDock }        from '@/components/atelier/CurationDock'
import { fetchContactConflicts } from '@/app/atelier/contacts/conflicts-actions'
import { loadOeuvreLongText } from '@/app/atelier/works/actions'
import { fetchOeuvresKeysetPage } from '@/app/atelier/works/actions'
import { revalidateRemindersTag } from '@/app/atelier/reminders-actions'
import { fetchAtelierShellPostPaint, fetchAtelierJunctionHydrationForOeuvreIds } from '@/app/atelier/atelier-data-actions'
import type { AtelierJunctionDerived } from '@/lib/atelier/atelier-junction-bootstrap'
import { mergeAtelierJunctionDerived } from '@/lib/atelier/atelier-junction-bootstrap'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import { createWorkingGroupWithOeuvres } from '@/app/atelier/selection/actions'
import { PemThemeToggle } from '@/components/PemThemeToggle'
import { ExhibitionsTabSkeleton } from '@/components/atelier/ExhibitionsTabSkeleton'
import { SystemTab } from '@/components/atelier/SystemTab'
import { ContactsTab } from '@/components/atelier/ContactsTab'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/lib/ui/toast'
import { consumeUndo, isUndoKeyBlockedTarget, peekUndo } from '@/lib/ui/undo'

function TabPanelFallback() {
  const { t } = useI18n()
  return (
    <div className="pem-fadeIn" style={{ flex: 1, minHeight: 240, padding: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row between" style={{ opacity: 0.75 }}>
        <span className="t-mono-sm">{t('loading')}</span>
        <Skeleton w={64} h={10} radius={2} />
      </div>
      <Skeleton w="100%" h={12} radius={2} />
      <Skeleton w="92%" h={12} radius={2} />
      <Skeleton w="88%" h={12} radius={2} />
      <div style={{ height: 18 }} />
      <Skeleton w="100%" h={120} radius={4} />
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
const WorldMapTab = dynamic(() => import('@/components/atelier/WorldMapTab').then((m) => ({ default: m.WorldMapTab })), { loading: () => <TabPanelFallback />, ssr: false })
const PipelineTab = dynamic(() => import('@/components/atelier/PipelineTab').then((m) => ({ default: m.PipelineTab })), { loading: () => <TabPanelFallback />, ssr: false })
const FiscalTab = dynamic(() => import('@/components/atelier/FiscalTab').then((m) => ({ default: m.FiscalTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ConceptsTab = dynamic(() => import('@/components/atelier/ConceptsTab').then((m) => ({ default: m.ConceptsTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ExhibitionsTab = dynamic(() => import('@/components/atelier/ExhibitionsTab').then((m) => ({ default: m.ExhibitionsTab })), { loading: () => <ExhibitionsTabSkeleton />, ssr: false })
const ThemesTab = dynamic(() => import('@/components/atelier/ThemesTab').then((m) => ({ default: m.ThemesTab })), { loading: () => <TabPanelFallback />, ssr: false })
const PortfolioTab = dynamic(() => import('@/components/atelier/PortfolioTab').then((m) => ({ default: m.PortfolioTab })), { loading: () => <TabPanelFallback />, ssr: false })
const SupplierHub = dynamic(() => import('@/components/atelier/SupplierHub').then((m) => ({ default: m.SupplierHub })), { loading: () => <TabPanelFallback />, ssr: false })
const StockTakeTab = dynamic(() => import('@/components/atelier/StockTakeTab').then((m) => ({ default: m.StockTakeTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ReportsTab = dynamic(() => import('@/components/atelier/ReportsTab').then((m) => ({ default: m.ReportsTab })), { loading: () => <TabPanelFallback />, ssr: false })
const AuditTab = dynamic(() => import('@/components/atelier/AuditTab').then((m) => ({ default: m.AuditTab })), { loading: () => <TabPanelFallback />, ssr: false })
const BroadcastTab = dynamic(() => import('@/components/atelier/BroadcastTab').then((m) => ({ default: m.BroadcastTab })), { loading: () => <TabPanelFallback />, ssr: false })

// ── Types ────────────────────────────────────────────────────────────

type Tab =
  | 'overview' | 'inventory' | 'reports' | 'constellation' | 'production'
  | 'logistics' | 'sales' | 'exhibitions' | 'vault' | 'contacts' | 'map' | 'pipeline' | 'fiscal' | 'concepts' | 'themes' | 'stock' | 'stock-take' | 'system' | 'portfolio' | 'audit' | 'broadcast'

export type { TeamPortalClientProps }

const DEFAULT_OVERVIEW_BOOTSTRAP: AtelierOverviewBootstrap = {
  expenseTotalTtc: 0,
  upcomingPulse: [],
  overviewCalendarEvents: [],
  burningConcepts: [],
}

function junctionFromServerInitial(init: Partial<AtelierJunctionDerived>): AtelierJunctionDerived {
  return {
    themePublicStats: { ...init.themePublicStats },
    themePrivateWorks: { ...init.themePrivateWorks },
    themeWorkCount: { ...init.themeWorkCount },
    groupWorkCount: { ...init.groupWorkCount },
    groupPrivateWorks: { ...init.groupPrivateWorks },
    oeuvreThemeIdsByOeuvre: { ...init.oeuvreThemeIdsByOeuvre },
    oeuvreGroupIdsByOeuvre: { ...init.oeuvreGroupIdsByOeuvre },
    themeToGroups: { ...init.themeToGroups },
    groupToThemes: { ...init.groupToThemes },
  }
}

// ── Component ────────────────────────────────────────────────────────

export function TeamPortalClient({
  initialPendingReviewCount = 0,
  initialReminderUnread = 0,
  initialReminders = [],
  initialOverviewBootstrap = DEFAULT_OVERVIEW_BOOTSTRAP,
  oeuvresPaging,
  atelierShellNonce = 0,
  initialIsAdmin = false,
  oeuvres: oeuvresChunk,
  techniques: techniquesInitial,
  supports: supportsInitial,
  formats: formatsInitial,
  themes: themesInitial,
  contacts: contactsInitial,
  initialGroups,
  presentations: presentationsInitial,
  themeWorkCount: initialThemeWorkCount = {},
  groupWorkCount: initialGroupWorkCount = {},
  themePublicStats: initialThemePublicStats = {},
  themePrivateWorks: initialThemePrivateWorks = {},
  groupPrivateWorks: initialGroupPrivateWorks = {},
  themeToGroups: initialThemeToGroups = {},
  groupToThemes: initialGroupToThemes = {},
  oeuvreThemeIdsByOeuvre: initialOeuvreThemeIdsByOeuvre = {},
  oeuvreGroupIdsByOeuvre: initialOeuvreGroupIdsByOeuvre = {},
}: TeamPortalClientProps) {
  const junctionHydratedIdsRef = useRef<Set<number>>(new Set())
  const [junction, setJunction] = useState<AtelierJunctionDerived>(() =>
    junctionFromServerInitial({
      themePublicStats: initialThemePublicStats,
      themePrivateWorks: initialThemePrivateWorks,
      themeWorkCount: initialThemeWorkCount,
      groupWorkCount: initialGroupWorkCount,
      groupPrivateWorks: initialGroupPrivateWorks,
      oeuvreThemeIdsByOeuvre: initialOeuvreThemeIdsByOeuvre,
      oeuvreGroupIdsByOeuvre: initialOeuvreGroupIdsByOeuvre,
      themeToGroups: initialThemeToGroups,
      groupToThemes: initialGroupToThemes,
    }),
  )

  const [contacts, setContacts] = useState(contactsInitial)
  const [techniques, setTechniques] = useState(techniquesInitial)
  const [supports, setSupports] = useState(supportsInitial)
  const [formats, setFormats] = useState(formatsInitial)
  const [themes, setThemes] = useState(themesInitial)
  const [statuses, setStatuses] = useState<{ id: number; label: string }[]>([])
  const [presentations, setPresentations] = useState(presentationsInitial)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>(() =>
    [...initialGroups].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  )
  const [curationAddresses, setCurationAddresses] = useState<ContactAddress[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = await fetchAtelierShellPostPaint()
      if (cancelled) return
      setContacts(p.contacts)
      setCurationAddresses(p.addresses)
      setTechniques(p.techniques)
      setSupports(p.supports)
      setFormats(p.formats)
      setThemes(p.themes)
      setStatuses(p.statuses)
      setPresentations(p.presentations)
      setGroups(
        [...p.groups.map((g) => ({ id: g.id, name: g.name }))].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [atelierShellNonce])

  const statusLabelMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const s of statuses) m[s.id] = s.label
    return m
  }, [statuses])

  const { t, lang, setLang } = useI18n()
  const router = useRouter()

  const [pendingReviewCount, setPendingReviewCount] = useState(initialPendingReviewCount)
  useEffect(() => {
    setPendingReviewCount(initialPendingReviewCount)
  }, [initialPendingReviewCount])

  const onRemindersMutated = useCallback(async () => {
    await revalidateRemindersTag()
    router.refresh()
  }, [router])

  const [oeuvres, setOeuvres] = useState<Oeuvre[]>(oeuvresChunk)
  const [oeuvresNextCursor, setOeuvresNextCursor] = useState<number | null>(oeuvresPaging?.nextCursor ?? null)
  const [oeuvresMoreLoading, setOeuvresMoreLoading] = useState(false)

  useEffect(() => {
    setOeuvres(oeuvresChunk)
    setOeuvresNextCursor(oeuvresPaging?.nextCursor ?? null)
    setJunction(
      junctionFromServerInitial({
        themePublicStats: initialThemePublicStats,
        themePrivateWorks: initialThemePrivateWorks,
        themeWorkCount: initialThemeWorkCount,
        groupWorkCount: initialGroupWorkCount,
        groupPrivateWorks: initialGroupPrivateWorks,
        oeuvreThemeIdsByOeuvre: initialOeuvreThemeIdsByOeuvre,
        oeuvreGroupIdsByOeuvre: initialOeuvreGroupIdsByOeuvre,
        themeToGroups: initialThemeToGroups,
        groupToThemes: initialGroupToThemes,
      }),
    )
    const seed = new Set<number>()
    for (const o of oeuvresChunk) {
      const th = initialOeuvreThemeIdsByOeuvre[o.OeuvreID]
      const gr = initialOeuvreGroupIdsByOeuvre[o.OeuvreID]
      if ((th?.length ?? 0) > 0 || (gr?.length ?? 0) > 0) seed.add(o.OeuvreID)
    }
    junctionHydratedIdsRef.current = seed
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initials follow `oeuvresChunk` from RSC; avoid `{}` identity churn
  }, [oeuvresChunk, oeuvresPaging])

  useEffect(() => {
    const pending = oeuvres
      .map((o) => o.OeuvreID)
      .filter((id) => !junctionHydratedIdsRef.current.has(id))
    if (pending.length === 0) return
    let cancelled = false
    void (async () => {
      const res = await fetchAtelierJunctionHydrationForOeuvreIds(pending)
      if (cancelled) return
      if (!res.ok) {
        console.error('[atelier junction hydrate]', res.error)
        return
      }
      for (const id of pending) junctionHydratedIdsRef.current.add(id)
      setJunction((prev) => mergeAtelierJunctionDerived(prev, res.data))
    })()
    return () => {
      cancelled = true
    }
  }, [oeuvres])

  const loadMoreOeuvres = useCallback(async () => {
    if (oeuvresNextCursor == null || oeuvresPaging == null) return
    setOeuvresMoreLoading(true)
    try {
      const { rows, nextCursor, hasMore } = await fetchOeuvresKeysetPage(
        oeuvresNextCursor,
        oeuvresPaging.pageSize,
      )
      setOeuvres((prev) => {
        const seen = new Set(prev.map((o) => o.OeuvreID))
        const add = rows.filter((o) => !seen.has(o.OeuvreID))
        return [...prev, ...add]
      })
      setOeuvresNextCursor(hasMore ? nextCursor : null)
    } catch (e) {
      console.error('loadMoreOeuvres', e)
      toast.error(t('error'))
    } finally {
      setOeuvresMoreLoading(false)
    }
  }, [oeuvresNextCursor, oeuvresPaging, t])

  const oeuvresCataloguePartial =
    oeuvresPaging != null && oeuvres.length < oeuvresPaging.totalCount

  const [inspected,  setInspected]  = useState<Oeuvre | null>(null)
  const workDrawerGuardRef = useRef<WorkDrawerGuardHandle>(null)
  const [drawerDirty, setDrawerDirty] = useState(false)
  const pendingNavRef = useRef<(() => void) | null>(null)

  const runPendingNav = useCallback(() => {
    const fn = pendingNavRef.current
    pendingNavRef.current = null
    fn?.()
  }, [])

  const performDrawerSave = useCallback(async () => {
    return (await workDrawerGuardRef.current?.performSave()) ?? false
  }, [])

  const { attemptAction: attemptNavigateWithDrawerGuard, unsavedDialog: drawerLeaveDialog } = useUnsavedActionGuard({
    isDirty: drawerDirty,
    onProceed: runPendingNav,
    performSave: performDrawerSave,
  })

  useEffect(() => {
    if (!inspected) setDrawerDirty(false)
    if (inspected) setVoiceNoteSheetOpen(false)
  }, [inspected])

  useEffect(() => {
    if (!drawerDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [drawerDirty])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const wid = params.get('work')
    if (!wid) return
    const oid = parseInt(wid, 10)
    if (Number.isNaN(oid)) return
    const found = oeuvres.find((x) => x.OeuvreID === oid)
    if (!found) return

    const stripWorkFromUrl = () => {
      const p = new URLSearchParams(window.location.search)
      p.delete('work')
      const qs = p.toString()
      window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    }

    const open = () => {
      setInspected(found)
      stripWorkFromUrl()
    }

    const g = workDrawerGuardRef.current
    if (g) g.runGuarded(open)
    else open()
  }, [oeuvres])

  const openInspected = useCallback((next: Oeuvre | null) => {
    if (next && inspected && next.OeuvreID === inspected.OeuvreID) return
    if (!inspected) {
      setInspected(next)
      return
    }
    workDrawerGuardRef.current?.runGuarded(() => setInspected(next))
  }, [inspected])

  const onOpen = openInspected

  // ── Global state ───────────────────────────────────────────────

  // Always start with 'overview' on server and client — prevents hydration mismatch.
  // Restore last tab from localStorage after first paint.
  const [tab,            setTab]          = useState<Tab>('overview')
  const [reminderCount,  setReminderCount] = useState(initialReminderUnread)

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('map')) {
      setTab('constellation')
      localStorage.setItem('pem_team_tab', 'constellation')
      return
    }
    const fromUrl = params.get('tab') as Tab | null
    if (fromUrl) {
      setTab(fromUrl)
      localStorage.setItem('pem_team_tab', fromUrl)
      return
    }
    const savedTab = localStorage.getItem('pem_team_tab') as Tab | null
    if (savedTab) {
      setTab(savedTab)
      return
    }
    // Narrow + no saved tab: field-tool first (Overview stays desktop-first KPI; Hub is lobby pulse).
    if (window.matchMedia('(max-width: 767px)').matches) {
      setTab('inventory')
      localStorage.setItem('pem_team_tab', 'inventory')
    }
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
    setReminderCount(initialReminderUnread)
  }, [initialReminderUnread])

  const [selection,  setSelection]  = useState<Set<number>>(new Set())

  useEffect(() => {
    (window as any).setSelection = setSelection
  }, [])

  const [showCompare, setShowCompare] = useState(false)
  const atelierNarrow = useMediaQuery('(max-width: 767px)')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!atelierNarrow) setSidebarOpen(false)
  }, [atelierNarrow])

  const {
    themePublicStats,
    themePrivateWorks,
    themeWorkCount,
    groupWorkCount,
    groupPrivateWorks,
    oeuvreThemeIdsByOeuvre,
    oeuvreGroupIdsByOeuvre,
    themeToGroups,
    groupToThemes,
  } = junction

  const oeuvreThemeMap = useMemo(() => {
    const m = new Map<number, number[]>()
    for (const [k, arr] of Object.entries(oeuvreThemeIdsByOeuvre)) m.set(Number(k), arr)
    return m
  }, [oeuvreThemeIdsByOeuvre])

  const oeuvreGroupMap = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const [k, arr] of Object.entries(oeuvreGroupIdsByOeuvre)) m.set(Number(k), arr)
    return m
  }, [oeuvreGroupIdsByOeuvre])

  const [conflicts,      setConflicts]      = useState<any[]>([])
  const [isAdmin,        setIsAdmin]        = useState(initialIsAdmin)
  const [paletteOpen,    setPaletteOpen]    = useState(false)

  useEffect(() => {
    setIsAdmin(initialIsAdmin)
  }, [initialIsAdmin])

  useEffect(() => {
    fetchContactConflicts().then(setConflicts).catch((err) => console.error('Contact conflicts:', err))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('batch') === 'success') {
      toast.success(t('batchSuccess'))
      // Clean up URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [t])

  useEffect(() => {
    const onPaletteKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K / `/` opens palette
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault(); setPaletteOpen(true)
      }
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); setPaletteOpen(p => !p)
      }
    }
    window.addEventListener('keydown', onPaletteKey)
    return () => window.removeEventListener('keydown', onPaletteKey)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!peekUndo()) return
      if (isUndoKeyBlockedTarget(e.target)) return
      if (e.shiftKey) return
      if (e.key !== 'z' && e.key !== 'Z') return
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      void (async () => {
        try {
          await consumeUndo()
        } catch {
          toast.error(t('undoFailed'))
        }
      })()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [t])

  function handleSetTab(next: Tab) {
    setTab(next)
    localStorage.setItem('pem_team_tab', next)
    setSidebarOpen(false)
  }

  const [subsetChipExpanded, setSubsetChipExpanded] = useState(false)
  const [voiceNoteSheetOpen, setVoiceNoteSheetOpen] = useState(false)
  useEffect(() => {
    setSubsetChipExpanded(false)
  }, [tab])

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

  const compareIdsSorted = useMemo(
    () => Array.from(selection).sort((a, b) => a - b),
    [selection],
  )

  const oeuvresCatalogueCount =
    oeuvresPaging != null ? oeuvresPaging.totalCount : oeuvres.length

  const TABS_RAW: [Tab, string, number?][] = useMemo(
    () => [
      ['overview',      t('overview')],
      ['inventory',     t('inventory'), oeuvresCatalogueCount],
      ['reports',       t('tab_reports')],
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
      ['portfolio',     t('tab_portfolio')],
      ['broadcast',     t('tab_broadcast')],
      ['stock',         t('tab_stock')],
      ['stock-take',    t('tab_stock_take')],
      ['system',        t('tab_system')],
      [
        'audit',
        t('tab_audit'),
        isAdmin && pendingReviewCount > 0 ? pendingReviewCount : undefined,
      ],
    ],
    [t, oeuvresCatalogueCount, contacts.length, isAdmin, pendingReviewCount],
  )

  const activeTabLabel = TABS_RAW.find((x) => x[0] === tab)?.[1] ?? ''

  // ── Save working group (Supabase) ──────────────────────────────

  const handleSaveGroup = useCallback(async (name: string, ids: number[]): Promise<string | null> => {
    const res = await createWorkingGroupWithOeuvres(name, ids)
    if ('error' in res) return null
    setGroups((prev) => [{ id: res.groupId, name: name.trim() || name }, ...prev])
    router.refresh()
    return res.groupId
  }, [router])

  // ── Environment Check ──────────────────────────────────────────
  const isConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  if (!isConfigured) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)', color: 'var(--tx)', textAlign: 'center', padding: 40 }}>
        <div>
          <h2 style={{ color: 'var(--rust)', marginBottom: 20 }}>{t('config_error_title')}</h2>
          <p style={{ opacity: 0.7, maxWidth: 400, margin: '0 auto', fontSize: 14 }}>
            {t('config_error_body')}
          </p>
        </div>
      </div>
    )
  }

  // ── Tab definitions (GROUPS) ───────────────────────────────────

  /** 6 rooms — same structure on narrow and wide; narrow puts Field first. */
  const adminTabs: Tab[] = isAdmin ? ['system', 'audit', 'broadcast'] : ['system']
  const GROUPS: { label: string; tabs: Tab[] }[] = [
    { label: t('nav_group_field'),        tabs: ['inventory', 'production', 'stock-take', 'map'] },
    { label: t('nav_group_studio'),       tabs: ['overview', 'pipeline', 'exhibitions', 'concepts'] },
    { label: t('nav_group_catalogue'),    tabs: ['reports', 'themes', 'stock', 'constellation'] },
    { label: t('nav_group_commercial'),   tabs: ['sales', 'logistics', 'fiscal', 'vault'] },
    { label: t('nav_group_public_tab'),   tabs: ['portfolio'] },
    { label: t('nav_group_admin'),        tabs: ['contacts', ...adminTabs] },
  ]

  const showDock = selection.size > 0 && tab !== 'constellation'

  /** Ring A.2 — hide subset chrome on tabs that do not depend on the loaded œuvres batch. */
  const showSubsetBanner =
    oeuvresCataloguePartial &&
    oeuvresPaging != null &&
    !(['system', 'audit', 'broadcast'] as Tab[]).includes(tab)

  const showMobileActionBar = atelierNarrow && !inspected

  return (
    <>
      {drawerLeaveDialog}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tabs={TABS_RAW.map(([id, label]) => ({ id, label }))}
        oeuvres={oeuvres}
        contacts={contacts}
        onGoTab={(t) => { handleSetTab(t as Tab); setPaletteOpen(false) }}
        onGoWork={(id) => { const o = oeuvres.find(x => x.OeuvreID === id); if (o) setInspected(o); setPaletteOpen(false) }}
        onNewWork={() => router.push('/atelier/works/new')}
        onExportXlsx={() => { handleSetTab('reports') }}
        onRegenBible={() => { handleSetTab('system') }}
      />
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg0)', overflow: 'hidden' }}>
      
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--bd)',
        background: 'var(--bg1)',
        padding: atelierNarrow ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))' : '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          {atelierNarrow && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label={t('aria_open_navigation')}
              style={{
                flexShrink: 0,
                fontSize: 18,
                lineHeight: 1,
                color: 'var(--tx2)',
                background: 'var(--bg0)',
                border: '1px solid var(--bd)',
                padding: '6px 10px',
                cursor: 'pointer',
                minWidth: 44,
                minHeight: 44,
                boxSizing: 'border-box',
              }}
            >
              ☰
            </button>
          )}
          {!atelierNarrow && (
            <>
              <button
                type="button"
                onClick={() => {
                  pendingNavRef.current = () => router.push('/hub')
                  attemptNavigateWithDrawerGuard()
                }}
                className="t-mono-sm"
                style={{ color: 'var(--tx3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7, flexShrink: 0 }}
              >
                Hub
              </button>
              <span style={{ color: 'var(--tx3)', fontSize: 10, opacity: 0.3, flexShrink: 0 }}>/</span>
              <div className="serif" style={{ fontSize: 24, letterSpacing: '-0.01em', color: 'var(--tx)', flexShrink: 0 }}>{t('atelier')}</div>
              <span style={{ color: 'var(--tx3)', fontSize: 10, opacity: 0.3 }}>/</span>
            </>
          )}
          <div
            className="t-eyebrow"
            style={{
              color: 'var(--ac)',
              fontSize: 10,
              overflow: atelierNarrow ? 'visible' : 'hidden',
              textOverflow: atelierNarrow ? 'clip' : 'ellipsis',
              whiteSpace: atelierNarrow ? 'normal' : 'nowrap',
              lineHeight: atelierNarrow ? 1.25 : undefined,
              minWidth: 0,
            }}
          >
            {activeTabLabel}
          </div>
          {!atelierNarrow && (
            <>
              <div className="vline" style={{ height: 16, opacity: 0.3, marginLeft: 8 }} />
              <div
                className="t-mono-sm"
                style={{ opacity: 0.5, fontSize: 9, flexShrink: 0 }}
                title={oeuvresCataloguePartial ? t('atelier_header_works_badge_title') : undefined}
              >
                {oeuvresCataloguePartial
                  ? `${oeuvres.length} / ${oeuvresPaging!.totalCount}`
                  : oeuvres.length}{' '}
                {t('inventoryWorksBadge')}
              </div>
            </>
          )}
        </div>

        {!atelierNarrow && (
        <div className="row gap-sm" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1 }}>
            <PemThemeToggle showLabels={!atelierNarrow} />
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
          <button className="btn ghost sm" title="⌘K" onClick={() => setPaletteOpen(true)} style={{ fontSize: 11, letterSpacing: 1 }}>
            ⌘K
          </button>
          <button className="btn ghost sm" onClick={() => router.push('/atelier/works/new')} title={t('newWork')}>
            {`+ ${t('newWork')}`}
          </button>
        </div>
        )}
      </div>

      {showSubsetBanner && oeuvresPaging && (
        <div
          data-testid="atelier-oeuvres-subset-banner"
          className="t-mono-sm"
          style={{
            flexShrink: 0,
            padding: '8px max(12px, env(safe-area-inset-right)) 8px max(12px, env(safe-area-inset-left))',
            borderBottom: '1px solid var(--bd)',
            background: 'var(--bg2)',
            display: 'flex',
            flexDirection: 'column',
            gap: atelierNarrow ? 8 : 10,
          }}
        >
          {atelierNarrow ? (
            <>
              <button
                type="button"
                onClick={() => setSubsetChipExpanded((v) => !v)}
                aria-expanded={subsetChipExpanded}
                aria-label={t('atelier_subset_batch_toggle_aria')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  minHeight: 44,
                  padding: '0 4px',
                  margin: 0,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--tx)',
                  font: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 12, letterSpacing: 0.04, fontWeight: 600 }}>
                  {oeuvres.length} / {oeuvresPaging.totalCount}
                  <span aria-hidden style={{ marginLeft: 6, opacity: 0.6 }}>{subsetChipExpanded ? '▴' : '▾'}</span>
                </span>
              </button>
              {subsetChipExpanded ? (
                <>
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--tx2)',
                      fontSize: 11,
                      minWidth: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    {t('atelier_oeuvres_subset_banner')
                      .replace('{loaded}', String(oeuvres.length))
                      .replace('{total}', String(oeuvresPaging.totalCount))}
                  </p>
                  {oeuvresNextCursor != null ? (
                    <button
                      type="button"
                      className="btn primary sm"
                      disabled={oeuvresMoreLoading}
                      onClick={() => void loadMoreOeuvres()}
                      style={{
                        minHeight: 44,
                        flexShrink: 0,
                        width: '100%',
                      }}
                    >
                      {oeuvresMoreLoading ? '…' : t('atelier_oeuvres_load_more')}
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  oeuvresNextCursor != null ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: 'var(--tx2)',
                  fontSize: 11,
                  minWidth: 0,
                  lineHeight: 1.45,
                }}
              >
                {t('atelier_oeuvres_subset_banner')
                  .replace('{loaded}', String(oeuvres.length))
                  .replace('{total}', String(oeuvresPaging.totalCount))}
              </p>
              {oeuvresNextCursor != null ? (
                <button
                  type="button"
                  className="btn primary sm"
                  disabled={oeuvresMoreLoading}
                  onClick={() => void loadMoreOeuvres()}
                  style={{
                    minHeight: 44,
                    flexShrink: 0,
                    width: 'auto',
                    justifySelf: 'end',
                  }}
                >
                  {oeuvresMoreLoading ? '…' : t('atelier_oeuvres_load_more')}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
        {atelierNarrow && sidebarOpen && (
          <div
            role="presentation"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 140,
              background: 'rgba(0,0,0,0.45)',
            }}
          />
        )}
        <div style={{
          width: atelierNarrow ? 0 : 200,
          flexShrink: 0,
          borderRight: atelierNarrow ? 'none' : '1px solid var(--bd)',
          overflow: 'visible',
          position: 'relative',
          zIndex: atelierNarrow ? 150 : undefined,
        }}>
          <div style={{
            ...(atelierNarrow
              ? {
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 'min(300px, 88vw)',
                  background: 'var(--bg1)',
                  borderRight: '1px solid var(--bd)',
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 'max(24px, env(safe-area-inset-top)) 0 24px',
                  transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                  transition: 'transform 0.2s ease',
                  boxShadow: sidebarOpen ? '8px 0 28px rgba(0,0,0,0.35)' : undefined,
                }
              : {
                  width: 200,
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px 0',
                  background: 'var(--bg1)',
                }),
          }}>
            <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--bd)', marginBottom: 8, display: atelierNarrow ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="serif" style={{ fontSize: 18, color: 'var(--tx)' }}>{t('atelier')}</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                style={{
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: 'var(--tx2)',
                  background: 'transparent',
                  border: '1px solid var(--bd)',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('close')}
              </button>
            </div>
            <div
              className="t-mono-sm"
              style={{ display: atelierNarrow ? 'block' : 'none', padding: '0 20px 16px', fontSize: 9, opacity: 0.5 }}
              title={oeuvresCataloguePartial ? t('atelier_header_works_badge_title') : undefined}
            >
              {oeuvresCataloguePartial && oeuvresPaging
                ? `${oeuvres.length} / ${oeuvresPaging.totalCount}`
                : oeuvres.length}{' '}
              {t('inventoryWorksBadge')}
            </div>
            {atelierNarrow && (
              <div
                style={{
                  padding: '0 16px 16px',
                  borderBottom: '1px solid var(--bd)',
                  marginBottom: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <PemThemeToggle showLabels />
                <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1, width: 'fit-content' }}>
                  {(['fr', 'en'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      style={{
                        padding: '8px 14px',
                        minHeight: 44,
                        minWidth: 44,
                        boxSizing: 'border-box',
                        background: lang === l ? 'var(--ac)' : 'transparent',
                        color: lang === l ? 'var(--bg0)' : 'var(--tx3)',
                        fontWeight: lang === l ? 600 : 400,
                        border: 'none',
                        borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  title="⌘K"
                  onClick={() => {
                    setPaletteOpen(true)
                    setSidebarOpen(false)
                  }}
                  style={{ fontSize: 11, letterSpacing: 1, alignSelf: 'flex-start', minHeight: 44, padding: '0 14px' }}
                >
                  ⌘K
                </button>
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => {
                    void router.push('/atelier/works/new')
                    setSidebarOpen(false)
                  }}
                  style={{ minHeight: 44, alignSelf: 'stretch' }}
                >
                  + {t('newWork')}
                </button>
              </div>
            )}
          <div data-testid="atelier-nav-groups">
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
                        padding: atelierNarrow ? '10px 20px' : '6px 20px',
                        minHeight: atelierNarrow ? 44 : undefined,
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
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: showMobileActionBar
              ? 'max(12px, calc(68px + env(safe-area-inset-bottom, 0px)))'
              : undefined,
          }}
        >

        {tab === 'overview' && (
          <OverviewTab
            oeuvres={oeuvres}
            tM={tM}
            t={t as (k: string) => string}
            lang={lang}
            onGoTab={handleSetTab}
            reminderCount={reminderCount}
            initialReminders={initialReminders}
            initialOverviewBootstrap={initialOverviewBootstrap}
            isAdmin={isAdmin}
            conflicts={conflicts}
            oeuvresCataloguePartial={oeuvresCataloguePartial}
            oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
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
            onOpen={onOpen}
            oeuvreThemeIdsByOeuvre={oeuvreThemeIdsByOeuvre}
            oeuvreGroupIdsByOeuvre={oeuvreGroupIdsByOeuvre}
            oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
          />
        )}

        {tab === 'reports' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
            <ReportsTab
              oeuvres={oeuvres}
              techniques={sortedTechniques}
              supports={sortedSupports}
              formats={sortedFormats}
              themes={sortedThemes}
              groups={groups}
              tM={tM}
              sM={sM}
              cM={cM}
              pM={pM}
              locMap={locMap}
              statusLabelMap={statusLabelMap}
              oeuvreThemeIdsByOeuvre={oeuvreThemeIdsByOeuvre}
              oeuvreGroupIdsByOeuvre={oeuvreGroupIdsByOeuvre}
              selection={selection}
              oeuvresLoadedCount={oeuvres.length}
              oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
            />
          </div>
        )}

        {tab === 'constellation' && (
          <ConstellationCanvas
            oeuvres={oeuvres}
            tM={tM}
            themes={sortedThemes}
            groups={groups}
            selection={selection}
            setSelection={setSelection}
            onOpen={onOpen}
            onSaveGroup={handleSaveGroup}
          />
        )}

        {tab === 'production' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0, width: '100%' }}>
            <ProductionTab
              oeuvres={oeuvres}
              tM={tM}
              statusLabelMap={statusLabelMap}
              onOpen={onOpen}
              oeuvresPaging={oeuvresPaging}
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
            <PortfolioTab
              oeuvres={oeuvres}
              themes={themes}
              themePublicStats={themePublicStats}
              themePrivateWorks={themePrivateWorks}
              oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
            />
          </div>
        )}
        {tab === 'audit' && <AuditTab />}
        {tab === 'broadcast' && <BroadcastTab />}
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
              onOpenOeuvreById={(id) => {
                const o = oeuvres.find((x) => x.OeuvreID === id)
                if (o) openInspected(o)
              }}
            />
          </div>
        )}
        {tab === 'pipeline' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
            <PipelineTab
              oeuvres={oeuvres}
              contacts={contacts}
              groups={groups}
              initialReminders={initialReminders}
              onRemindersMutated={onRemindersMutated}
            />
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
            oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
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

      {/* ── Work Drawer (always mounted so ref/guards work for ?work= deep links) ── */}
      <WorkDrawer
        ref={workDrawerGuardRef}
        o={inspected}
        tM={tM} sM={sM} cM={cM} pM={pM}
        statusLabelMap={statusLabelMap}
        selection={selection}
        setSelection={setSelection}
        onClose={() => setInspected(null)}
        onDrawerDirtyChange={setDrawerDirty}
        thM={thM}
        oeuvreThemeMap={oeuvreThemeMap}
        oeuvreGroupMap={oeuvreGroupMap}
        groupNameMap={groupNameMap}
        techniques={techniques}
        supports={supports}
        formats={formats}
        themes={themes}
        contacts={contacts}
        groups={groups}
        presentations={presentations}
      />

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
          addresses={curationAddresses}
          onSaveGroup={handleSaveGroup}
          onCompare={() => setShowCompare(true)}
        />
      )}

      {/* ── Compare Modal ────────────────────────────────────────── */}
      {showCompare && (
        <CompareModal
          ids={compareIdsSorted}
          oeuvres={oeuvres}
          tM={tM} sM={sM}
          contacts={contacts}
          addresses={curationAddresses}
          statusLabelMap={statusLabelMap}
          onClose={() => setShowCompare(false)}
        />
      )}

      {voiceNoteSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ring-b-voice-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 155,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setVoiceNoteSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--bg1)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: '20px 20px max(20px, env(safe-area-inset-bottom))',
              borderTop: '1px solid var(--bd)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
            }}
          >
            <div id="ring-b-voice-title" className="serif" style={{ fontSize: 18, marginBottom: 10 }}>
              {t('ring_b_voice_sheet_title')}
            </div>
            <p className="t-mono-sm" style={{ color: 'var(--tx2)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              {t('ring_b_voice_sheet_body')}
            </p>
            <button
              type="button"
              className="btn primary"
              style={{ minHeight: 44, width: '100%' }}
              onClick={() => setVoiceNoteSheetOpen(false)}
            >
              {t('ring_b_voice_sheet_close')}
            </button>
          </div>
        </div>
      )}

      {showMobileActionBar && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            padding: 'max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-right))',
            background: 'var(--bg1)',
            borderTop: '1px solid var(--bd)',
          }}
        >
          <button
            type="button"
            className="btn ghost sm"
            aria-label={t('ring_b_bar_capture_aria')}
            title={t('ring_b_bar_capture_aria')}
            onClick={() => void router.push('/atelier/session/new')}
            style={{ minHeight: 48, fontSize: 18, padding: 4 }}
          >
            📷
          </button>
          <button
            type="button"
            className="btn ghost sm"
            aria-label={t('ring_b_bar_scan_aria')}
            title={t('ring_b_bar_scan_aria')}
            onClick={() => void router.push('/atelier/scan')}
            style={{ minHeight: 48, fontSize: 18, padding: 4 }}
          >
            🔍
          </button>
          <button
            type="button"
            className="btn ghost sm"
            aria-label={t('ring_b_bar_note_aria')}
            title={t('ring_b_bar_note_aria')}
            onClick={() => setVoiceNoteSheetOpen(true)}
            style={{ minHeight: 48, fontSize: 18, padding: 4 }}
          >
            🎤
          </button>
          <button
            type="button"
            className="btn ghost sm"
            aria-label={t('ring_b_bar_reminders_aria')}
            title={t('ring_b_bar_reminders_aria')}
            onClick={() => {
              handleSetTab('overview')
              requestAnimationFrame(() => {
                document.getElementById('atelier-field-reminders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              })
            }}
            style={{ minHeight: 48, fontSize: 18, padding: 4 }}
          >
            ⏰
          </button>
        </div>
      )}

    </div>
  </div>
    </>
  )
}

// ── Overview tab ─────────────────────────────────────────────────────

function pad2Local(n: number) {
  return String(n).padStart(2, '0')
}

function localDateKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2Local(d.getMonth() + 1)}-${pad2Local(d.getDate())}`
}

function mondayStartOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const mon = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - mon)
  return x
}

function OverviewTab({
  oeuvres, tM, t, lang, onGoTab, reminderCount, initialReminders, initialOverviewBootstrap, isAdmin, conflicts,
  oeuvresCataloguePartial,
  oeuvresCatalogueTotal,
}: {
  oeuvres:       Oeuvre[]
  tM:            Record<number, string>
  t:             (k: string) => string
  lang:          Lang
  onGoTab:       (tab: Tab) => void
  reminderCount: number
  initialReminders: SuiviReminderListRow[]
  initialOverviewBootstrap: AtelierOverviewBootstrap
  isAdmin:       boolean
  conflicts:     any[]
  oeuvresCataloguePartial?: boolean
  oeuvresCatalogueTotal?: number
}) {
  const thisYear   = new Date().getFullYear()
  const yearPrefix = String(thisYear)
  let byYear = 0
  let withPrice = 0
  let available = 0
  let exposable = 0
  let missingDims = 0
  let missingImages = 0
  let missingLoc = 0
  /** Sold works (status 4) with revenue attributed to this calendar year — used in Financial Pulse */
  let soldIncomeThisYear = 0
  for (const o of oeuvres) {
    if (o.Année?.startsWith(yearPrefix)) byYear++
    if (o.Prix && o.Prix > 0) withPrice++
    if (o.statusId === 2) {
      available++
      if (o.Exposable) exposable++
    }
    if (!o.Hauteur || !o.Largeur) missingDims++
    if (!o.txtImageNameLink) missingImages++
    if (!o.LocalisationID) missingLoc++
    if (o.statusId === 4 && o.Année?.startsWith(yearPrefix)) {
      soldIncomeThisYear += Number(o.PrixFinal ?? o.Prix ?? 0)
    }
  }

  const recentWorks = [...oeuvres].sort((a, b) => b.OeuvreID - a.OeuvreID).slice(0, 6)

  const reminders = useMemo(
    () =>
      initialReminders.slice(0, 6).map((r) => ({
        id: r.id,
        message: r.message,
        remind_at: r.remind_at,
        process_id: r.process_id,
      })),
    [initialReminders],
  )

  const { expenseTotalTtc, upcomingPulse: upcoming, overviewCalendarEvents, burningConcepts } =
    initialOverviewBootstrap
  const expenseTotal = expenseTotalTtc

  const ovNarrow = useMediaQuery('(max-width: 767px)')
  const localeTagOv = lang === 'en' ? 'en-GB' : 'fr-FR'

  const weekEvents = useMemo(() => {
    const start = mondayStartOfWeek(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const sk = localDateKeyFromDate(start)
    const ek = localDateKeyFromDate(end)
    return filterEventsInDateKeyRange(overviewCalendarEvents, sk, ek)
  }, [overviewCalendarEvents])

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
    <div
      style={{
        padding: ovNarrow ? '20px 16px' : '32px 40px',
        display: 'grid',
        gridTemplateColumns: ovNarrow ? '1fr' : '1fr 300px',
        gap: ovNarrow ? 28 : 60,
        alignItems: 'start',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >

      {/* Left Column: Dashboard Pulse */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        
        {/* Row 1: Executive Stats */}
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.6 }} data-testid="atelier-overview-executive">{t('ov_executive_summary')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, 1fr)', gap: 1, border: '1px solid var(--bd)', background: 'var(--bd)' }}>
            {[
              { l: t('works_cap'),                    v: oeuvres.length },
              { l: `${t('thisYear')} (${thisYear})`,  v: byYear },
              { l: t('ov_stat_available'),              v: available },
              { l: t('exposable'),                    v: exposable },
              { l: t('priced'),                       v: withPrice },
              { l: t('ov_stat_total_value'),           v: `€ ${Math.round(oeuvres.reduce((s,o) => s+(o.Prix||0), 0)/1000)}k` },
            ].map(({ l, v }) => (
              <div key={l} style={{ padding: '20px 24px', background: 'var(--bg1)' }}>
                <div className="stat">
                  <span className="l" style={{ fontSize: 9, letterSpacing: 1.5 }}>{l}</span>
                  <span className="v" style={{ fontSize: 24 }}>{v}</span>
                </div>
              </div>
            ))}
          </div>
          {oeuvresCataloguePartial && oeuvresCatalogueTotal != null && oeuvresCatalogueTotal > oeuvres.length && (
            <div
              className="t-mono-sm"
              style={{ marginTop: 10, fontSize: 10, color: 'var(--tx3)', lineHeight: 1.35, maxWidth: 720 }}
              data-testid="atelier-overview-subset-caption"
            >
              {t('ov_loaded_subset_caption')
                .replace('{loaded}', String(oeuvres.length))
                .replace('{total}', String(oeuvresCatalogueTotal))}
            </div>
          )}
        </div>

        {/* Row 1.5: Financial Pulse */}
        <div>
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>{t('ov_financial_pulse_fmt').replace(/\{year\}/g, String(thisYear))}</div>
            <button className="t-mono-sm" onClick={() => onGoTab('fiscal')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>{t('ov_manage_revenues')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? '1fr' : '1fr 1fr', gap: ovNarrow ? 20 : 40, padding: 24, background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="t-label" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ov_income_vs_expenses')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>{t('ov_income_sales')}</span>
                  <span style={{ color: 'var(--green)' }}>€ {Math.round(soldIncomeThisYear).toLocaleString(localeTagOv)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '100%', background: 'var(--green)', borderRadius: 2 }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span>{t('ov_expenses')}</span>
                  <span style={{ color: 'var(--rust)' }}>€ {Math.round(expenseTotal).toLocaleString(localeTagOv)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (expenseTotal / Math.max(1, soldIncomeThisYear)) * 100)}%`, background: 'var(--rust)', borderRadius: 2 }} />
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: ovNarrow ? 'none' : '1px solid var(--bd)', paddingLeft: ovNarrow ? 0 : 40, paddingTop: ovNarrow ? 12 : 0, borderTop: ovNarrow ? '1px solid var(--bd)' : 'none' }}>
              <div className="t-label" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ov_cash_health')}</div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 700 }}>
                  € {Math.round(soldIncomeThisYear - expenseTotal).toLocaleString(localeTagOv)}
                </div>
                <div className="t-mono-sm" style={{ marginBottom: 8, color: 'var(--tx3)' }}>{t('ov_net_bnc')}</div>
              </div>
              <div style={{ fontSize: 9, color: 'var(--tx3)', fontStyle: 'italic' }}>
                {t('ov_financial_note_fmt').replace(/\{year\}/g, String(thisYear))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Visual Grid (Recent Documentation) */}
        <div>
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>{t('ov_recent_docs')}</div>
            <button className="t-mono-sm" onClick={() => onGoTab('inventory')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>{t('ov_view_all')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'repeat(3, minmax(0, 1fr))' : 'repeat(6, 1fr)', gap: 12 }}>
            {recentWorks.map((o) => (
              <div key={o.OeuvreID} style={{ aspectRatio: '1', background: 'var(--bg1)', border: '1px solid var(--bd2)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                {o.txtImageNameLink ? (
                  <WorkThumb file={o.txtImageNameLink} size={256} alt="" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 10 }}>{t('ov_no_image_placeholder')}</div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, color-mix(in srgb, var(--bg0) 80%, transparent))', color: 'var(--tx)', fontSize: 8, fontFamily: 'var(--font-mono)' }}>
                  #{o.OeuvreID}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Technique & Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? '1fr' : '1fr 1fr', gap: 40 }}>
          {/* Technique breakdown */}
          <div>
            <div className="t-label" style={{ marginBottom: 16, opacity: 0.8 }}>{t('byTechnique')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topTechs.map(([techId, count]) => {
                const pct = Math.round((count / oeuvres.length) * 100)
                return (
                  <div key={techId} style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'minmax(0,1fr) minmax(0,2fr) 28px' : '120px 1fr 30px', alignItems: 'center', gap: 12 }}>
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
                <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 12, color: 'var(--tx3)' }}>{t('ov_studio_health')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <HealthRow label={t('ov_health_missing_dims')} count={missingDims} color={missingDims > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                  <HealthRow label={t('ov_health_missing_photos')} count={missingImages} color={missingImages > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                  <HealthRow label={t('ov_health_missing_loc')} count={missingLoc} color={missingLoc > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Right Column: Deadlines & Concepts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, minWidth: 0 }}>
        <div>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onGoTab('pipeline')}
            style={{ minHeight: 44, width: '100%', justifyContent: 'center' }}
          >
            {t('ov_pipeline_calendar_cta')}
          </button>
          <div className="t-eyebrow" style={{ marginTop: 16, marginBottom: 10 }}>
            {t('ov_this_week')}
          </div>
          {weekEvents.length === 0 ? (
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11 }}>{t('ov_no_deadlines')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weekEvents.slice(0, 12).map((ev) => {
                const d = new Date(`${ev.dateKey}T12:00:00`)
                const dayLine = d.toLocaleDateString(localeTagOv, { weekday: 'short', day: 'numeric', month: 'short' })
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onGoTab('pipeline')}
                    style={{
                      minHeight: 44,
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'var(--bg1)',
                      border: '1px solid var(--bd2)',
                      cursor: 'pointer',
                      borderLeft: `2px solid ${ev.kind === 'reminder' ? 'var(--ac)' : 'var(--tx3)'}`,
                    }}
                  >
                    <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 4 }}>{dayLine}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.35 }}>{ev.label}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Integrity Sentry (Admin Only) */}
        {isAdmin && conflicts.length > 0 && (
          <div style={{ padding: 16, background: 'var(--rust)11', border: '1px solid var(--rust)44' }}>
            <div className="t-eyebrow" style={{ color: 'var(--rust)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚠</span> {t('ov_integrity_title')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conflicts.map(c => (
                <div key={c.id} style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--tx)' }}>{t('ov_integrity_collision')}</strong><br/>
                  {t('ov_integrity_match_line').replace(
                    /\{name\}/g,
                    String(c.public?.NomInstitution || c.public?.Nom || ''),
                  )}
                  <button 
                    onClick={() => onGoTab('contacts')}
                    style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: 'var(--ac)', padding: 0, fontSize: 10, cursor: 'pointer' }}
                  >
                    {t('ov_integrity_resolve')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reminders Pulse — scroll target for Ring B mobile bar */}
        <div id="atelier-field-reminders" style={{ scrollMarginTop: 96 }}>
        {reminders.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              {t('ov_reminders_title')}
              {reminderCount > 0 && <span style={{ background: 'var(--ac)', color: 'var(--bg0)', padding: '1px 6px', borderRadius: 10, fontSize: 8 }}>{reminderCount}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reminders.map((r) => {
                const days = daysUntil(r.remind_at)
                return (
                  <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg1)', border: '1px solid var(--bd2)', borderLeft: `2px solid var(--ac)` }}>
                    <div style={{ fontSize: 10, color: 'var(--tx)', lineHeight: 1.4 }}>{r.message}</div>
                    <div style={{ fontSize: 8, color: urgencyColor(days), marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {days === 0
                        ? t('ov_reminder_today')
                        : days === 1
                          ? t('ov_reminder_tomorrow')
                          : days < 0
                            ? t('ov_reminder_days_ago_fmt').replace(/\{days\}/g, String(Math.abs(days)))
                            : t('ov_reminder_in_days_fmt').replace(/\{days\}/g, String(days))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </div>

        {/* Pipeline Pulse */}
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => onGoTab('pipeline')}>
            {t('ov_active_pipeline')}
          </div>
          {upcoming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map((p) => {
                const days = daysUntil(p.date)
                const col = urgencyColor(days)
                return (
                  <div
                    key={`${p.processId}-${p.etapeId ?? 'fin'}-${p.date}`}
                    onClick={() => onGoTab('pipeline')}
                    style={{
                    padding: '10px 12px', background: 'var(--bg1)',
                    border: '1px solid var(--bd2)', cursor: 'pointer',
                    borderLeft: `2px solid ${col}`,
                  }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--tx)' }}>{p.label}</div>
                    <div style={{ fontSize: 8, color: col, marginTop: 4, letterSpacing: 0.5 }}>
                      {days < 0
                        ? t('ov_pulse_deadline_overdue_fmt').replace(/\{days\}/g, String(Math.abs(days)))
                        : days === 0
                          ? t('ov_pulse_deadline_due_today')
                          : t('ov_pulse_deadline_in_days_fmt').replace(/\{days\}/g, String(days))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="t-mono-sm" style={{ opacity: 0.4, padding: 12, border: '1px dashed var(--bd2)', textAlign: 'center' }}>{t('ov_no_deadlines')}</div>
          )}
        </div>

        {/* Burning Concepts */}
        {burningConcepts.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => onGoTab('concepts')}>
              {t('ov_burning_ideas')}
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
                    {'●'.repeat(c.energie)} <span style={{ marginLeft: 4 }}>{[t('ov_energy_1'), t('ov_energy_2'), t('ov_energy_3'), t('ov_energy_4'), t('ov_energy_5')][c.energie - 1]}</span>
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
  addresses:       ContactAddress[]
  statusLabelMap:  Record<number, string>
  onClose:         () => void
}) {
  const { t } = useI18n()
  const works = oeuvres.filter(o => ids.includes(o.OeuvreID))

  const [longById, setLongById] = useState<
    Record<number, { Commentaires: string | null; Historique: string | null }>
  >({})

  useEffect(() => {
    let cancelled = false
    setLongById({})
    ;(async () => {
      const next: Record<number, { Commentaires: string | null; Historique: string | null }> = {}
      await Promise.all(
        ids.map(async (id) => {
          const r = await loadOeuvreLongText(id)
          if (!('error' in r)) next[id] = { Commentaires: r.Commentaires, Historique: r.Historique }
        }),
      )
      if (!cancelled) setLongById(next)
    })()
    return () => {
      cancelled = true
    }
  }, [ids])

  const contactName = (cid: any) => {
    if (!cid) return '—'
    const c = contacts.find(x => String(x.ContactID) === String(cid))
    if (!c) return `#${cid}`
    return c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${cid}`
  }

  const resolveLocation = (cid: any) => {
    if (!cid) return t('defaultStudioLocation')
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
    { l: 'Dimensions',     k: (o: any) => {
        const raw = formatInventoryDims(o.Hauteur, o.Largeur, o.Support != null ? sM[o.Support] : null, o.Profondeur)
        return raw === '—' ? '—' : `${raw} cm`
      } },
    { l: t('depth'),       k: (o: any) => o.Profondeur ? `${o.Profondeur} cm` : '—' },
    { l: t('status'),      k: (o: any) => (o.statusId != null ? statusLabelMap[o.statusId] : null) ?? '—' },
    { l: t('contact'),     k: (o: any) => contactName(o.ContactID) },
    { l: t('location'),    k: (o: any) => resolveLocation(o.LocalisationID) },
    { l: t('price'),       k: (o: any) => o.Prix ? `€ ${Number(o.Prix).toLocaleString('fr-FR')}` : '—' },
    { l: t('discount'),    k: (o: any) => o.Discount ? `€ ${Number(o.Discount).toLocaleString('fr-FR')}` : '—' },
    { l: 'Prix Final',     k: (o: any) => o.PrixFinal ? `€ ${Number(o.PrixFinal).toLocaleString('fr-FR')}` : '—' },
    { l: t('exhibitable'), k: (o: any) => o.Exposable ? '✓' : '—' },
    { l: 'Encadrée',       k: (o: any) => o.Encadree ? '✓' : '—' },
    { l: 'Montée',         k: (o: any) => o.Montee ? '✓' : '—' },
    { l: t('catalogued'),  k: (o: any) => o.Catalogué ? '✓' : '—' },
    { l: t('confidentiality'), k: (o: any) => {
        const level = (o as any).anonymity_level ?? 0
        return level === 0 ? t('anon_lvl_0') : level === 1 ? t('anon_lvl_1') : t('anon_lvl_2')
      }},
    { l: 'Commission',     k: (o: any) => o.IsCommission ? '✓' : '—' },
    {
      l: t('notes'),
      k: (o: any) => longById[o.OeuvreID]?.Commentaires ?? (o as Oeuvre).Commentaires ?? '—',
    },
    {
      l: t('history'),
      k: (o: any) => longById[o.OeuvreID]?.Historique ?? (o as Oeuvre).Historique ?? '—',
    },
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
