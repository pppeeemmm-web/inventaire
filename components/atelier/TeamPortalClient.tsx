'use client'

// TeamPortalClient — fully interactive shell for the /atelier team portal.
// Receives pre-fetched reference data from app/atelier/page.tsx.
// Manages global state: active tab, work drawer, selection, working groups.
// Heavy tab panels load on demand (next/dynamic). SystemTab + ContactsTab eager-loaded to avoid dev ChunkLoadError on those chunks.

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { CommandPalette } from './CommandPalette'
import { useUnsavedActionGuard } from '@/hooks/useUnsavedActionGuard'
import dynamic from 'next/dynamic'
import { useRouter, usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { WorkThumb } from './WorkThumb'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { TeamPortalClientProps, AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import { yearOf, formatInventoryDims } from '@/lib/data'
import { daysUntil } from '@/lib/pipeline-deadlines'
import { atelierTabHref, isSegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import { routeTabFromPathname } from '@/lib/atelier/route-tab-from-pathname'
import type { Lang } from '@/lib/i18n/dictionary'
import { useAtelierNarrow } from '@/lib/atelier/use-atelier-narrow'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { BottomStack, BottomStackLayer, PEM_Z_INDEX } from '@/components/shared/BottomStack'
import { SegmentRoutePanel } from '@/components/atelier/team-portal-segment-panel'
import { OeuvresSubsetBanner } from '@/components/atelier/OeuvresSubsetBanner'
import { AtelierCatalogueTotalBadge } from '@/components/atelier/AtelierCatalogueTotalBadge'
import { WorkDrawer, type WorkDrawerGuardHandle } from '@/components/atelier/WorkDrawer'
import { CurationDock }        from '@/components/atelier/CurationDock'
import { fetchContactConflicts } from '@/app/atelier/(portal)/contacts/conflicts-actions'
import { loadOeuvreLongText } from '@/app/atelier/works/actions'
import { fetchOeuvresKeysetPage, fetchOeuvresInitialKeysetPage } from '@/app/atelier/works/actions'
import { tabNeedsCatalogueChunkOnColdStart } from '@/lib/atelier/atelier-catalogue-tabs'
import { revalidateRemindersTag } from '@/app/atelier/reminders-actions'
import { fetchAtelierShellPostPaint, fetchAtelierJunctionHydrationForOeuvreIds } from '@/app/atelier/atelier-data-actions'
import type { AtelierJunctionDerived } from '@/lib/atelier/atelier-junction-bootstrap'
import {
  applyOeuvreJunctionLinks,
  mergeAtelierJunctionDerived,
  reconcileAtelierJunctionRefresh,
} from '@/lib/atelier/atelier-junction-bootstrap'
import { subscribeJunctionSaved } from '@/lib/atelier/junction-refresh-bus'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import { createWorkingGroupWithOeuvres } from '@/app/atelier/selection/actions'
import { PemThemeToggle } from '@/components/PemThemeToggle'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast, dismissToast } from '@/lib/ui/toast'
import { consumeUndo, isUndoKeyBlockedTarget, peekUndo } from '@/lib/ui/undo'
import { VoiceNoteSheet } from '@/components/shared/VoiceNoteSheet'

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

// ── Types ────────────────────────────────────────────────────────────

type Tab = SegmentedAtelierTab

/** Desktop top bar + narrow drawer row — same handlers, drawer uses 44px tap targets. Ring A.1: new work lives on `MobileActionBar`, not here, when `hideNewWork`. */
function AtelierHeaderChrome({
  variant,
  lang,
  setLang,
  onPaletteOpen,
  onNewWork,
  onReports,
  onStudioBible,
  hideNewWork,
}: {
  variant: 'desktop' | 'drawer'
  lang: Lang
  setLang: (l: Lang) => void
  onPaletteOpen: () => void
  onNewWork: () => void
  onReports: () => void
  onStudioBible: () => void
  /** Narrow: + New work is on the bottom field bar, not in the drawer chrome. */
  hideNewWork?: boolean
}) {
  const { t } = useI18n()
  const compact = variant === 'drawer'
  const actionStyle = compact
    ? { minHeight: 44, minWidth: 44, boxSizing: 'border-box' as const, fontSize: 11, letterSpacing: 1 }
    : { fontSize: 11, letterSpacing: 1 }

  return (
    <div className="row gap-sm" style={{ flexShrink: 0, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
      <div
        role="toolbar"
        aria-label={t('quickActions')}
        className="row gap-xs"
        style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}
      >
        <button
          type="button"
          className="btn ghost sm"
          title={t('atelier_quick_search_shortcut')}
          aria-label={t('aria_command_palette')}
          onClick={onPaletteOpen}
          style={actionStyle}
        >
          {t('search')}
        </button>
        {!hideNewWork ? (
          <button
            type="button"
            className="btn ghost sm"
            onClick={onNewWork}
            title={t('newWork')}
            aria-label={t('newWork')}
            style={actionStyle}
          >
            {`+ ${t('newWork')}`}
          </button>
        ) : null}
        <button
          type="button"
          className="btn ghost sm"
          onClick={onReports}
          title={t('tab_reports')}
          aria-label={t('tab_reports')}
          style={actionStyle}
        >
          {t('tab_reports')}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={onStudioBible}
          title={t('atelier_quick_studio_bible')}
          aria-label={t('atelier_quick_studio_bible')}
          style={actionStyle}
        >
          {t('atelier_quick_studio_bible')}
        </button>
      </div>
      <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1, alignItems: 'stretch' }}>
        {compact ? (
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 44, boxSizing: 'border-box' }}>
            <PemThemeToggle showLabels={false} padding="10px 12px" />
          </div>
        ) : (
          <PemThemeToggle showLabels />
        )}
        {(['fr', 'en'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            style={{
              padding: compact ? '10px 14px' : '4px 10px',
              minHeight: compact ? 44 : undefined,
              minWidth: compact ? 44 : undefined,
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
    </div>
  )
}

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

/** Ring B.2 — fixed bottom bar (narrow only; hidden when WorkDrawer open). Ring A.1: includes new work (+). */
function MobileActionBar({
  t,
  onCapture,
  onScan,
  onNote,
  onReminders,
  onNewWork,
}: {
  t: (k: string) => string
  onCapture: () => void
  onScan: () => void
  onNote: () => void
  onReminders: () => void
  onNewWork: () => void
}) {
  return (
    <div
      data-testid="atelier-mobile-action-bar"
      role="toolbar"
      aria-label={t('ring_b_bar_toolbar_aria')}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: PEM_Z_INDEX.mobileActionBar,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 4,
        paddingTop: 8,
        paddingLeft: 'max(6px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(6px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        background: 'var(--bg1)',
        borderTop: '1px solid var(--bd)',
      }}
    >
      <button
        type="button"
        className="btn ghost sm"
        aria-label={t('ring_b_bar_capture_aria')}
        title={t('ring_b_bar_capture_aria')}
        onClick={onCapture}
        style={{ minHeight: 44, minWidth: 0, fontSize: 18, padding: 4 }}
      >
        📷
      </button>
      <button
        type="button"
        className="btn ghost sm"
        aria-label={t('ring_b_bar_scan_aria')}
        title={t('ring_b_bar_scan_aria')}
        onClick={onScan}
        style={{ minHeight: 44, minWidth: 0, fontSize: 18, padding: 4 }}
      >
        🔍
      </button>
      <button
        type="button"
        className="btn ghost sm"
        aria-label={t('ring_b_bar_note_aria')}
        title={t('ring_b_bar_note_aria')}
        onClick={onNote}
        style={{ minHeight: 44, minWidth: 0, fontSize: 18, padding: 4 }}
      >
        🎤
      </button>
      <button
        type="button"
        className="btn ghost sm"
        aria-label={t('ring_b_bar_reminders_aria')}
        title={t('ring_b_bar_reminders_aria')}
        onClick={onReminders}
        style={{ minHeight: 44, minWidth: 0, fontSize: 18, padding: 4 }}
      >
        ⏰
      </button>
      <button
        type="button"
        data-testid="atelier-mobile-bar-new-work"
        className="btn ghost sm"
        aria-label={t('ring_b_bar_new_work_aria')}
        title={t('ring_b_bar_new_work_aria')}
        onClick={onNewWork}
        style={{ minHeight: 44, minWidth: 0, fontSize: 18, padding: 4 }}
      >
        ➕
      </button>
    </div>
  )
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
  routeTab,
  shellPersistsAcrossTabs = false,
}: TeamPortalClientProps) {
  const pathname = usePathname()
  const routeTabFromUrl = routeTabFromPathname(pathname)
  const effectiveRouteTab = shellPersistsAcrossTabs
    ? (routeTabFromUrl ?? routeTab)
    : routeTab
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

  const postPaintLoadedRef = useRef(false)
  const catalogueHydratingRef = useRef(false)

  useEffect(() => {
    if (shellPersistsAcrossTabs && postPaintLoadedRef.current) return
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
      postPaintLoadedRef.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [atelierShellNonce, shellPersistsAcrossTabs])

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
    setOeuvres((prev) => {
      if (!shellPersistsAcrossTabs) return oeuvresChunk
      const byId = new Map<number, Oeuvre>()
      for (const o of prev) byId.set(o.OeuvreID, o)
      for (const o of oeuvresChunk) byId.set(o.OeuvreID, o)
      return [...byId.values()].sort((a, b) => b.OeuvreID - a.OeuvreID)
    })
    setOeuvresNextCursor((prev) =>
      shellPersistsAcrossTabs && prev != null ? prev : (oeuvresPaging?.nextCursor ?? null),
    )
    if (!shellPersistsAcrossTabs) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initials follow `oeuvresChunk` from RSC; avoid `{}` identity churn
  }, [oeuvresChunk, oeuvresPaging, shellPersistsAcrossTabs])

  // Deferred catalogue: hydrate first chunk when user opens a tab that needs œuvres.
  useEffect(() => {
    if (!shellPersistsAcrossTabs) return
    const tab = effectiveRouteTab
    if (!tab || !tabNeedsCatalogueChunkOnColdStart(tab)) return
    if (!oeuvresPaging?.catalogueDeferred) return
    if (oeuvres.length > 0 || oeuvresPaging.totalCount === 0) return
    if (catalogueHydratingRef.current) return

    catalogueHydratingRef.current = true
    let cancelled = false
    void (async () => {
      try {
        const lim = oeuvresPaging.pageSize || 50
        const { rows, nextCursor, hasMore } = await fetchOeuvresInitialKeysetPage(lim)
        if (cancelled) return
        setOeuvres(rows)
        setOeuvresNextCursor(hasMore ? nextCursor : null)
      } catch (e) {
        console.error('[atelier catalogue hydrate]', e)
      } finally {
        catalogueHydratingRef.current = false
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shellPersistsAcrossTabs, effectiveRouteTab, oeuvres.length, oeuvresPaging])

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

  const applyJunctionSaved = useCallback(
    (oeuvreId: number, themeIds: number[], groupIds: string[]) => {
      const isPublic = !!oeuvres.find((w) => w.OeuvreID === oeuvreId)?.is_public
      setJunction((prev) => applyOeuvreJunctionLinks(prev, oeuvreId, themeIds, groupIds, isPublic))
      void (async () => {
        const res = await fetchAtelierJunctionHydrationForOeuvreIds([oeuvreId])
        if (!res.ok) {
          console.error('[atelier junction refresh]', res.error)
          return
        }
        setJunction((prev) =>
          reconcileAtelierJunctionRefresh(prev, res.data, [oeuvreId], { [oeuvreId]: isPublic }),
        )
      })()
    },
    [oeuvres],
  )

  useEffect(() => {
    return subscribeJunctionSaved(({ oeuvreId, themeIds, groupIds }) => {
      applyJunctionSaved(oeuvreId, themeIds, groupIds)
    })
  }, [applyJunctionSaved])

  const onJunctionSaved = applyJunctionSaved

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

  // Background eager-load: fetch remaining pages automatically after first paint.
  // The loop runs once on mount; cursor is managed locally to avoid stale-closure issues.
  useEffect(() => {
    if (oeuvresPaging == null) return
    if (oeuvres.length >= oeuvresPaging.totalCount) return
    const initialCursor = oeuvresPaging.nextCursor
    if (initialCursor == null) return

    const toastId = toast.info(t('catalogue_loading'), { ttlMs: 120_000 })
    let cancelled = false

    ;(async () => {
      let cursor: number | null = initialCursor
      while (cursor != null && !cancelled) {
        try {
          const { rows, nextCursor, hasMore } = await fetchOeuvresKeysetPage(cursor, 500)
          if (cancelled) break
          setOeuvres((prev) => {
            const seen = new Set(prev.map((o) => o.OeuvreID))
            return [...prev, ...rows.filter((o) => !seen.has(o.OeuvreID))]
          })
          setOeuvresNextCursor(hasMore ? nextCursor : null)
          cursor = hasMore ? nextCursor : null
        } catch (e) {
          console.error('[atelier bg load]', e)
          break
        }
      }
      if (!cancelled) dismissToast(toastId)
    })()

    return () => {
      cancelled = true
      dismissToast(toastId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount with SSR values
  }, [])

  const oeuvresCataloguePartial =
    oeuvresPaging != null && oeuvres.length < oeuvresPaging.totalCount

  const [inspected,  setInspected]  = useState<Oeuvre | null>(null)
  const workDrawerGuardRef = useRef<WorkDrawerGuardHandle>(null)
  const inventoryDrawerGuardRef = useRef<WorkDrawerGuardHandle>(null)
  const [drawerDirty, setDrawerDirty] = useState(false)
  const [inventoryPanelDirty, setInventoryPanelDirty] = useState(false)
  const pendingNavRef = useRef<(() => void) | null>(null)

  const patchOeuvreInCatalogue = useCallback((oeuvreId: number, patch: Partial<Oeuvre>) => {
    setOeuvres((prev) => prev.map((row) => (row.OeuvreID === oeuvreId ? { ...row, ...patch } : row)))
    setInspected((prev) => (prev?.OeuvreID === oeuvreId ? { ...prev, ...patch } : prev))
  }, [])

  useEffect(() => {
    if (!inspected || drawerDirty || inventoryPanelDirty) return
    const fresh = oeuvres.find((x) => x.OeuvreID === inspected.OeuvreID)
    if (fresh && fresh !== inspected) setInspected(fresh)
  }, [oeuvres, inspected, drawerDirty, inventoryPanelDirty])

  const runPendingNav = useCallback(() => {
    const fn = pendingNavRef.current
    pendingNavRef.current = null
    fn?.()
  }, [])

  const getAnyDrawerDirty = useCallback(() => {
    return !!(
      workDrawerGuardRef.current?.isDirty() ||
      inventoryDrawerGuardRef.current?.isDirty()
    )
  }, [])

  const performDrawerSave = useCallback(async () => {
    if (workDrawerGuardRef.current?.isDirty()) {
      const ok = await workDrawerGuardRef.current.performSave()
      if (!ok) return false
    }
    if (inventoryDrawerGuardRef.current?.isDirty()) {
      const ok = await inventoryDrawerGuardRef.current.performSave()
      if (!ok) return false
    }
    return true
  }, [])

  const { attemptAction: attemptNavigateWithDrawerGuard, unsavedDialog: drawerLeaveDialog } = useUnsavedActionGuard({
    isDirty: drawerDirty || inventoryPanelDirty,
    getIsDirty: getAnyDrawerDirty,
    onProceed: runPendingNav,
    performSave: performDrawerSave,
  })

  useEffect(() => {
    if (!inspected) setDrawerDirty(false)
    if (inspected) setVoiceNoteSheetOpen(false)
  }, [inspected])

  useEffect(() => {
    if (!drawerDirty && !inventoryPanelDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [drawerDirty, inventoryPanelDirty])

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
    if (next && inspected && next.OeuvreID === inspected.OeuvreID) {
      if (next !== inspected) setInspected(next)
      return
    }
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
    if (effectiveRouteTab) {
      setTab(effectiveRouteTab)
      localStorage.setItem('pem_team_tab', effectiveRouteTab)
      return
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('map')) {
      setTab('constellation')
      localStorage.setItem('pem_team_tab', 'constellation')
      return
    }
    const fromUrl = params.get('tab')
    if (fromUrl && isSegmentedAtelierTab(fromUrl)) {
      void router.replace(atelierTabHref(fromUrl))
      return
    }
    const savedTab = localStorage.getItem('pem_team_tab')
    if (savedTab && isSegmentedAtelierTab(savedTab)) {
      void router.replace(atelierTabHref(savedTab))
      return
    }
    // Narrow + no saved tab: field-tool first — use segmented inventory route.
    if (window.matchMedia('(max-width: 767px)').matches) {
      void router.replace('/atelier/inventory')
    }
  }, [effectiveRouteTab, router])

  useEffect(() => {
    setReminderCount(initialReminderUnread)
  }, [initialReminderUnread])

  const [selection,  setSelection]  = useState<Set<number>>(new Set())

  useEffect(() => {
    (window as any).setSelection = setSelection
  }, [])

  const [showCompare, setShowCompare] = useState(false)
  const portalRootRef = useRef<HTMLDivElement>(null)
  const atelierNarrow = useAtelierNarrow(portalRootRef)
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
    pendingNavRef.current = () => {
      const href = atelierTabHref(next)
      const currentPath = window.location.pathname
      const currentSearch = window.location.search
      const targetPath = href.split('?')[0]
      const needsNavigation =
        targetPath !== currentPath ||
        (href.includes('?') && href !== `${currentPath}${currentSearch}`)

      if (needsNavigation) {
        router.push(href)
        return
      }
      setTab(next)
      localStorage.setItem('pem_team_tab', next)
      setSidebarOpen(false)
    }
    attemptNavigateWithDrawerGuard()
  }

  const [subsetChipExpanded, setSubsetChipExpanded] = useState(false)
  const [voiceNoteSheetOpen, setVoiceNoteSheetOpen] = useState(false)
  const [voiceNotesTick, setVoiceNotesTick] = useState(0)
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
      ['site',          t('portfolio_subtab_website')],
      ['portfolio',     t('portfolio_subtab_portfolio')],
      ['analytics',     t('portfolio_subtab_analytics')],
      ['broadcast',     t('tab_broadcast')],
      ['stock',         t('tab_stock')],
      ['stock-take',    t('tab_stock_take')],
      ['notes',         t('tab_notes')],
      ['journal',       t('tab_journal')],
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
    { label: t('nav_group_field'),        tabs: ['inventory', 'production', 'stock-take', 'journal', 'notes', 'map'] },
    { label: t('nav_group_studio'),       tabs: ['overview', 'pipeline', 'exhibitions', 'concepts'] },
    { label: t('nav_group_catalogue'),    tabs: ['reports', 'themes', 'stock', 'constellation'] },
    { label: t('nav_group_commercial'),   tabs: ['sales', 'logistics', 'fiscal', 'vault'] },
    { label: t('nav_group_public_tab'),   tabs: ['site', 'portfolio', 'analytics'] },
    { label: t('nav_group_admin'),        tabs: ['contacts', ...adminTabs] },
  ]

  const activeTab = effectiveRouteTab ?? tab
  const showDock = selection.size > 0 && activeTab !== 'constellation'

  /** Partial-catalogue strip — Inventaire only; total count stays in header. */
  const showSubsetBanner =
    activeTab === 'inventory' && oeuvresCataloguePartial && oeuvresPaging != null

  const showMobileActionBar = atelierNarrow && !inspected

  function openFieldReminders() {
    handleSetTab('overview')
    requestAnimationFrame(() => {
      document.getElementById('atelier-field-reminders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function openNewSaleOrder() {
    try {
      sessionStorage.setItem('pem_sales_open_new_order', '1')
    } catch {
      /* ignore storage availability */
    }
    handleSetTab('sales')
  }

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
        onCaptureSession={
          isAdmin ? () => void router.push('/atelier/session/new') : undefined
        }
        onScanQr={() => void router.push('/atelier/scan')}
        onFieldNote={() => setVoiceNoteSheetOpen(true)}
        onReminders={openFieldReminders}
        onNewWork={() => router.push('/atelier/works/new')}
        onNewSale={openNewSaleOrder}
        onStockTake={() => handleSetTab('stock-take')}
        onPendingApprovals={isAdmin ? () => handleSetTab('audit') : undefined}
        onExportXlsx={() => { handleSetTab('reports') }}
        onRegenBible={() => { handleSetTab('system') }}
      />
    <div
      ref={portalRootRef}
      className="atelier-portal-root"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg0)', overflow: 'hidden' }}
    >
      
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: atelierNarrow ? 8 : 12, flexShrink: 0 }}>
          {oeuvresPaging ? (
            <AtelierCatalogueTotalBadge
              total={oeuvresPaging.totalCount}
              loaded={oeuvres.length}
              partial={oeuvresCataloguePartial}
              compact={atelierNarrow}
            />
          ) : null}
          {atelierNarrow ? (
          <button
            type="button"
            data-testid="atelier-header-hub"
            onClick={() => {
              pendingNavRef.current = () => router.push('/hub')
              attemptNavigateWithDrawerGuard()
            }}
            className="t-mono-sm"
            aria-label={t('field_stub_cta_hub')}
            style={{
              flexShrink: 0,
              color: 'var(--tx3)',
              cursor: 'pointer',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              padding: '8px 12px',
              minHeight: 44,
              minWidth: 44,
              boxSizing: 'border-box',
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          >
            {t('pub_hub_short')}
          </button>
          ) : (
            <AtelierHeaderChrome
              variant="desktop"
              lang={lang}
              setLang={setLang}
              onPaletteOpen={() => setPaletteOpen(true)}
              onNewWork={() => void router.push('/atelier/works/new')}
              onReports={() => handleSetTab('reports')}
              onStudioBible={() => handleSetTab('system')}
            />
          )}
        </div>
      </div>

      {showSubsetBanner && oeuvresPaging && (
        <OeuvresSubsetBanner
          loaded={oeuvres.length}
          total={oeuvresPaging.totalCount}
          hasMore={oeuvresNextCursor != null}
          loading={oeuvresMoreLoading}
          expanded={subsetChipExpanded}
          onToggleExpanded={() => setSubsetChipExpanded((v) => !v)}
          onLoadMore={() => void loadMoreOeuvres()}
        />
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
          <div className="pem-atelier-sidebar" style={{
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
            <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--bd)', marginBottom: 8, display: atelierNarrow ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                <span className="serif" style={{ fontSize: 18, color: 'var(--tx)' }}>{t('atelier')}</span>
                <span style={{ color: 'var(--tx3)', fontSize: 10, opacity: 0.35 }} aria-hidden>/</span>
                <button
                  type="button"
                  onClick={() => {
                    pendingNavRef.current = () => {
                      setSidebarOpen(false)
                      router.push('/hub')
                    }
                    attemptNavigateWithDrawerGuard()
                  }}
                  className="t-mono-sm"
                  style={{
                    color: 'var(--tx3)',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: '10px 4px',
                    margin: '-10px 0',
                    minHeight: 44,
                    minWidth: 44,
                    boxSizing: 'border-box',
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('pub_hub_short')}
                </button>
              </div>
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
            {atelierNarrow && sidebarOpen && (
              <div
                style={{
                  padding: '0 16px 12px',
                  borderBottom: '1px solid var(--bd)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  minWidth: 0,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <AtelierHeaderChrome
                  variant="drawer"
                  lang={lang}
                  setLang={setLang}
                  onPaletteOpen={() => setPaletteOpen(true)}
                  onNewWork={() => void router.push('/atelier/works/new')}
                  onReports={() => handleSetTab('reports')}
                  onStudioBible={() => handleSetTab('system')}
                  hideNewWork
                />
              </div>
            )}
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

        {effectiveRouteTab ? (
          <SegmentRoutePanel
            tab={effectiveRouteTab}
            oeuvres={oeuvres}
            sortedTechniques={sortedTechniques}
            sortedSupports={sortedSupports}
            sortedFormats={sortedFormats}
            sortedThemes={sortedThemes}
            groups={groups}
            contacts={contacts}
            presentations={presentations}
            tM={tM}
            sM={sM}
            cM={cM}
            pM={pM}
            locMap={locMap}
            statusLabelMap={statusLabelMap}
            selection={selection}
            setSelection={setSelection}
            onOpen={onOpen}
            oeuvreThemeIdsByOeuvre={oeuvreThemeIdsByOeuvre}
            oeuvreGroupIdsByOeuvre={oeuvreGroupIdsByOeuvre}
            oeuvresPaging={oeuvresPaging}
            onLoadMore={oeuvresNextCursor != null ? loadMoreOeuvres : undefined}
            isAdmin={isAdmin}
            themes={themes}
            themeWorkCount={themeWorkCount}
            groupWorkCount={groupWorkCount}
            themePrivateWorks={themePrivateWorks}
            groupPrivateWorks={groupPrivateWorks}
            themeToGroups={themeToGroups}
            groupToThemes={groupToThemes}
            voiceNotesTick={voiceNotesTick}
            initialReminders={initialReminders}
            onRemindersMutated={() => onRemindersMutated()}
            handleSaveGroup={handleSaveGroup}
            lang={lang}
            onGoTab={handleSetTab}
            initialOverviewBootstrap={initialOverviewBootstrap}
            reminderCount={reminderCount}
            conflicts={conflicts}
            oeuvresCataloguePartial={oeuvresCataloguePartial}
            themePublicStats={themePublicStats}
            thM={thM}
            oeuvreThemeMap={oeuvreThemeMap}
            onOpenContactFromMap={(id) => {
              handleSetTab('contacts')
              sessionStorage.setItem('pem_open_contact', String(id))
            }}
            onJunctionSaved={onJunctionSaved}
            onOeuvrePatched={patchOeuvreInCatalogue}
            inventoryDrawerGuardRef={inventoryDrawerGuardRef}
            onInventoryPanelDirtyChange={setInventoryPanelDirty}
          />
        ) : null}
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
        isAdmin={isAdmin}
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
        onJunctionSaved={onJunctionSaved}
        onWorkSaved={patchOeuvreInCatalogue}
      />

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

      <BottomStack>
        <BottomStackLayer layer="curationDock" visible={showDock}>
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
        </BottomStackLayer>

        <BottomStackLayer layer="voiceNote" visible={voiceNoteSheetOpen}>
        <VoiceNoteSheet
          open={voiceNoteSheetOpen}
          onClose={() => setVoiceNoteSheetOpen(false)}
          oeuvreOptions={oeuvres.map((o) => ({ OeuvreID: o.OeuvreID, Titre: o.Titre }))}
          onSaved={() => setVoiceNotesTick((n) => n + 1)}
        />
        </BottomStackLayer>

        <BottomStackLayer layer="mobileActionBar" visible={showMobileActionBar}>
          <MobileActionBar
            t={t as (k: string) => string}
            onCapture={() => void router.push(isAdmin ? '/atelier/session/new' : atelierTabHref('journal'))}
            onScan={() => void router.push('/atelier/scan')}
            onNote={() => setVoiceNoteSheetOpen(true)}
            onReminders={openFieldReminders}
            onNewWork={() => void router.push('/atelier/works/new')}
          />
        </BottomStackLayer>
      </BottomStack>

    </div>
  </div>
    </>
  )
}

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
        <button type="button" onClick={onClose} aria-label={t('close')} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', minHeight: 44, minWidth: 44 }}>×</button>
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
