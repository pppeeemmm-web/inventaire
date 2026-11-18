'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'
import { ExhibitionsTabSkeleton } from '@/components/atelier/ExhibitionsTabSkeleton'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre } from '@/lib/types/database'
import type { WorkDrawerGuardHandle } from '@/components/atelier/WorkDrawer'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { TeamPortalClientProps, AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import type { Lang } from '@/lib/i18n/dictionary'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import { SlideshowsTab } from '@/components/atelier/slideshow/SlideshowsTab'
import type { ContactRow } from '@/components/atelier/contact-editor-types'

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

const InventoryTab = dynamic(() => import('@/app/atelier/(portal)/inventory/_components/Inventory').then((m) => ({ default: m.Inventory })), { loading: () => <TabPanelFallback />, ssr: false })
const Constellation = dynamic(() => import('@/app/atelier/(portal)/constellation/_components/Constellation').then((m) => ({ default: m.Constellation })), { loading: () => <TabPanelFallback />, ssr: false })
const ChronologieTab = dynamic(() => import('@/components/atelier/chronologie/ChronologieTab').then((m) => ({ default: m.ChronologieTab })), { loading: () => <TabPanelFallback />, ssr: false })
const Vault = dynamic(() => import('@/app/atelier/(portal)/vault/_components/Vault').then((m) => ({ default: m.Vault })), { loading: () => <TabPanelFallback />, ssr: false })
const ProductionTab = dynamic(() => import('@/app/atelier/(portal)/production/_components/Production').then((m) => ({ default: m.Production })), { loading: () => <TabPanelFallback />, ssr: false })
const Logistics = dynamic(() => import('@/app/atelier/(portal)/logistics/_components/Logistics').then((m) => ({ default: m.Logistics })), { loading: () => <TabPanelFallback />, ssr: false })
const OrdersTab = dynamic(() => import('@/app/atelier/(portal)/sales/_components/Orders').then((m) => ({ default: m.Orders })), { loading: () => <TabPanelFallback />, ssr: false })
const PipelineTab = dynamic(() => import('@/app/atelier/(portal)/pipeline/_components/Pipeline').then((m) => ({ default: m.Pipeline })), { loading: () => <TabPanelFallback />, ssr: false })
const Fiscal = dynamic(() => import('@/app/atelier/(portal)/fiscal/_components/Fiscal').then((m) => ({ default: m.Fiscal })), { loading: () => <TabPanelFallback />, ssr: false })
const Kaizen = dynamic(() => import('@/app/atelier/(portal)/kaizen/_components/Kaizen').then((m) => ({ default: m.Kaizen })), { loading: () => <TabPanelFallback />, ssr: false })
const Concepts = dynamic(() => import('@/app/atelier/(portal)/concepts/_components/Concepts').then((m) => ({ default: m.Concepts })), { loading: () => <TabPanelFallback />, ssr: false })
// R6: « Expositions & événements » replaces the former Exhibitions screen (docs/design/2026-11-17/R6_Events.notes.md).
const EventsTab = dynamic(() => import('@/components/atelier/events/EventsTab').then((m) => ({ default: m.EventsTab })), { loading: () => <ExhibitionsTabSkeleton />, ssr: false })
const Themes = dynamic(() => import('@/app/atelier/(portal)/themes/_components/Themes').then((m) => ({ default: m.Themes })), { loading: () => <TabPanelFallback />, ssr: false })
const Reports = dynamic(() => import('@/app/atelier/(portal)/reports/_components/Reports').then((m) => ({ default: m.Reports })), { loading: () => <TabPanelFallback />, ssr: false })
const Audit = dynamic(() => import('@/app/atelier/(portal)/audit/_components/Audit').then((m) => ({ default: m.Audit })), { loading: () => <TabPanelFallback />, ssr: false })
const Broadcast = dynamic(() => import('@/app/atelier/(portal)/broadcast/_components/Broadcast').then((m) => ({ default: m.Broadcast })), { loading: () => <TabPanelFallback />, ssr: false })
const OverviewTab = dynamic(() => import('@/components/atelier/overview/OverviewTab').then((m) => ({ default: m.OverviewTab })), { loading: () => <TabPanelFallback />, ssr: false })
const WorldMapTab = dynamic(() => import('@/components/atelier/WorldMapTab').then((m) => ({ default: m.WorldMapTab })), { loading: () => <TabPanelFallback />, ssr: false })
const PortfolioConfigShell = dynamic(() => import('@/components/atelier/PortfolioConfigShell').then((m) => ({ default: m.PortfolioConfigShell })), { loading: () => <TabPanelFallback />, ssr: false })
const SuppliesTab = dynamic(() => import('@/components/atelier/supplies/SuppliesTab').then((m) => ({ default: m.SuppliesTab })), { loading: () => <TabPanelFallback />, ssr: false })
const SessionJournalTab = dynamic(() => import('@/components/atelier/SessionJournalTab').then((m) => ({ default: m.SessionJournalTab })), { loading: () => <TabPanelFallback />, ssr: false })
const Aide = dynamic(() => import('@/app/atelier/(portal)/aide/_components/Aide').then((m) => ({ default: m.Aide })), { loading: () => <TabPanelFallback />, ssr: false })
const AiDesk = dynamic(() => import('@/app/atelier/(portal)/ai/_components/AiDesk').then((m) => ({ default: m.AiDesk })), { loading: () => <TabPanelFallback />, ssr: false })
const SystemTab = dynamic(() => import('@/components/atelier/SystemTab').then((m) => ({ default: m.SystemTab })), { loading: () => <TabPanelFallback />, ssr: false })
const ContactsTab = dynamic(() => import('@/components/atelier/ContactsTab').then((m) => ({ default: m.ContactsTab })), { loading: () => <TabPanelFallback />, ssr: false })

export type SegmentRoutePanelProps = {
  tab: SegmentedAtelierTab
  oeuvres: Oeuvre[]
  sortedTechniques: { TechniqueID: number; Technique: string | null }[]
  sortedSupports: { SupportID: number; Support: string | null }[]
  sortedFormats: { FormatID: number; Format: string | null }[]
  sortedThemes: { id: number; name: string }[]
  groups: { id: string; name: string }[]
  contacts: TeamPortalClientProps['contacts']
  /** Contacts tab → the Atelier's list (badge, pickers). */
  onContactsChange?: (rows: TeamPortalClientProps['contacts']) => void
  onContactsMerged?: (fromId: number, intoId: number) => void
  onContactsDeleted?: (ids: number[]) => void
  addresses?: ContactAddress[]
  presentations: { PresentationID: number; Nom: string | null }[]
  tM: Record<number, string>
  sM: Record<number, string>
  cM: Record<number, string>
  pM: Record<number, string>
  locMap: Record<number, string>
  statusLabelMap: Record<number, string>
  selection: Set<number>
  setSelection: (s: Set<number>) => void
  onOpen: (o: Oeuvre) => void
  oeuvreThemeIdsByOeuvre: Record<number, number[]>
  oeuvreGroupIdsByOeuvre: Record<number, string[]>
  oeuvresPaging?: { totalCount: number; nextCursor: number | null; pageSize: number }
  onLoadMore?: () => void
  isAdmin: boolean
  themes: { id: number; name: string }[]
  themeWorkCount: Record<number, number>
  groupWorkCount: Record<string, number>
  themePrivateWorks: Record<number, number[]>
  groupPrivateWorks: Record<string, number[]>
  themeToGroups: Record<number, string[]>
  groupToThemes: Record<string, number[]>
  /** Unused since Notes moved into the Journal (R1 step 7); kept so the portal's props stay as they are. */
  voiceNotesTick: number
  initialReminders: import('@/lib/types/database').SuiviReminderListRow[]
  onRemindersMutated: () => Promise<void>
  handleSaveGroup: (name: string, ids: number[]) => Promise<string | null>
  lang: Lang
  onGoTab: (tab: SegmentedAtelierTab) => void
  initialOverviewBootstrap: AtelierOverviewBootstrap
  reminderCount: number
  conflicts: unknown[]
  oeuvresCataloguePartial?: boolean
  themePublicStats: Record<number, { total: number; pub: number }>
  thM: Record<number, string>
  oeuvreThemeMap: Map<number, number[]>
  onOpenContactFromMap: (contactId: number) => void
  onJunctionSaved?: (oeuvreId: number, themeIds: number[], groupIds: string[]) => void
  onOeuvrePatched?: (oeuvreId: number, patch: Partial<Oeuvre>) => void
  onOeuvreRemoved?: (oeuvreIds: number[]) => void
  inventoryDrawerGuardRef?: React.RefObject<WorkDrawerGuardHandle | null>
  /** Notes tab: unsaved transcript guard (TODO B2). */
  notesGuardRef?: React.RefObject<WorkDrawerGuardHandle | null>
  onInventoryPanelDirtyChange?: (dirty: boolean) => void
  /** ?work= deep link handed to the Inventory side panel (TODO 18). */
  inventoryFocusRequest?: number | null
  onInventoryFocusRequestDone?: (handled: boolean) => void
}

export function SegmentRoutePanel({
  tab,
  oeuvres,
  sortedTechniques,
  sortedSupports,
  sortedFormats,
  sortedThemes,
  groups,
  contacts,
  onContactsChange,
  onContactsMerged,
  onContactsDeleted,
  addresses,
  presentations,
  tM,
  sM,
  cM,
  pM,
  locMap,
  statusLabelMap,
  selection,
  setSelection,
  onOpen,
  oeuvreThemeIdsByOeuvre,
  oeuvreGroupIdsByOeuvre,
  oeuvresPaging,
  onLoadMore,
  isAdmin,
  themes,
  themeWorkCount,
  groupWorkCount,
  themePrivateWorks,
  groupPrivateWorks,
  themeToGroups,
  groupToThemes,
  initialReminders,
  onRemindersMutated,
  handleSaveGroup,
  lang,
  onGoTab,
  initialOverviewBootstrap,
  reminderCount,
  conflicts,
  oeuvresCataloguePartial,
  themePublicStats,
  thM,
  oeuvreThemeMap,
  onOpenContactFromMap,
  onJunctionSaved,
  onOeuvrePatched,
  onOeuvreRemoved,
  inventoryDrawerGuardRef,
  onInventoryPanelDirtyChange,
  inventoryFocusRequest,
  onInventoryFocusRequestDone,
}: SegmentRoutePanelProps) {
  const { t } = useI18n()
  switch (tab) {
    case 'overview':
      return (
        <OverviewTab
          oeuvres={oeuvres}
          tM={tM}
          t={t as (k: string) => string}
          lang={lang}
          onGoTab={onGoTab}
          reminderCount={reminderCount}
          initialReminders={initialReminders}
          initialOverviewBootstrap={initialOverviewBootstrap}
          isAdmin={isAdmin}
          conflicts={conflicts}
          oeuvresCataloguePartial={oeuvresCataloguePartial}
          oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
        />
      )
    case 'contacts':
      return <ContactsTab contacts={contacts} oeuvres={oeuvres} conflicts={conflicts} onContactsChange={onContactsChange as ((rows: ContactRow[]) => void) | undefined} onContactsMerged={onContactsMerged} onContactsDeleted={onContactsDeleted} />
    case 'site':
    case 'portfolio':
    case 'analytics':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <PortfolioConfigShell
            tab={tab}
            oeuvres={oeuvres}
            themes={themes}
            themePublicStats={themePublicStats}
            themePrivateWorks={themePrivateWorks}
            oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
          />
        </div>
      )
    case 'map':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <WorldMapTab
            contacts={contacts}
            oeuvres={oeuvres}
            tM={tM}
            thM={thM}
            statusLabelMap={statusLabelMap}
            oeuvreThemeMap={oeuvreThemeMap}
            onOpenContact={onOpenContactFromMap}
            onOpenOeuvreById={(id) => {
              const o = oeuvres.find((x) => x.OeuvreID === id)
              if (o) onOpen(o)
            }}
          />
        </div>
      )
    case 'stock':
    // Old Stock-take route: /atelier/stock-take redirects to ?view=count; this is the fallback.
    case 'stock-take':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SuppliesTab contacts={contacts} />
        </div>
      )
    case 'kaizen':
    case 'kaizen-ops':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Kaizen key={tab} scope={tab === 'kaizen' ? 'creation' : 'ops'} />
        </div>
      )
    // Notes live in the Journal (R1 step 7); `/atelier/notes` redirects there, this covers the instant before.
    case 'notes':
    case 'journal':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SessionJournalTab />
        </div>
      )
    case 'aide':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Aide isAdmin={isAdmin} />
        </div>
      )
    case 'ai':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <AiDesk isAdmin={isAdmin} />
        </div>
      )
    case 'system':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SystemTab />
        </div>
      )
    case 'inventory':
      return (
        <InventoryTab
          oeuvres={oeuvres}
          techniques={sortedTechniques}
          supports={sortedSupports}
          formats={sortedFormats}
          themes={sortedThemes}
          groups={groups}
          contacts={contacts}
          addresses={addresses}
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
          oeuvresCatalogueTotal={oeuvresPaging?.totalCount}
          onLoadMore={onLoadMore}
          isAdmin={isAdmin}
          onJunctionSaved={onJunctionSaved}
          onOeuvrePatched={onOeuvrePatched}
          onOeuvreRemoved={onOeuvreRemoved}
          inventoryDrawerGuardRef={inventoryDrawerGuardRef}
          onInventoryPanelDirtyChange={onInventoryPanelDirtyChange}
          focusRequest={inventoryFocusRequest}
          onFocusRequestDone={onInventoryFocusRequestDone}
        />
      )
    case 'reports':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <Reports
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
            isAdmin={isAdmin}
          />
        </div>
      )
    case 'constellation':
      return (
        <Constellation
          oeuvres={oeuvres}
          tM={tM}
          themes={sortedThemes}
          themeWorkCount={themeWorkCount}
          oeuvreThemeIdsByOeuvre={oeuvreThemeIdsByOeuvre}
          groupWorkCount={groupWorkCount}
          oeuvreGroupIdsByOeuvre={oeuvreGroupIdsByOeuvre}
          groups={groups}
          selection={selection}
          setSelection={setSelection}
          onOpen={onOpen}
          onSaveGroup={handleSaveGroup}
        />
      )
    case 'production':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, width: '100%' }}>
          <ProductionTab
            oeuvres={oeuvres}
            tM={tM}
            statusLabelMap={statusLabelMap}
            onOpen={onOpen}
            oeuvresPaging={oeuvresPaging}
          />
        </div>
      )
    case 'logistics':
      return <Logistics cM={cM} />
    case 'sales':
      // R7: the tab opens on Orders (all four kinds); the former Sales tab stays folded below
      // until its figures move to Revenue & expenses (docs/design/2026-11-17/R7_Orders.notes.md).
      return (
        <OrdersTab
          contacts={contacts}
          openWork={(id) => {
            const o = oeuvres.find((w) => w.OeuvreID === id)
            if (o) onOpen(o)
            else window.location.assign(`/atelier?work=${id}`)
          }}
        />
      )
    case 'exhibitions':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <EventsTab
            oeuvres={oeuvres}
            contacts={contacts}
            themes={sortedThemes}
            tM={tM}
            statusLabelMap={statusLabelMap}
            selection={selection}
            groupsCtx={{ groups, groupWorkCount, oeuvreGroupIdsByOeuvre, onOpen }}
          />
        </div>
      )
    case 'vault':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Vault oeuvres={oeuvres} tM={tM} />
        </div>
      )
    case 'pipeline':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <PipelineTab
            oeuvres={oeuvres}
            contacts={contacts}
            groups={groups}
            initialReminders={initialReminders}
            onRemindersMutated={onRemindersMutated}
          />
        </div>
      )
    case 'fiscal':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Fiscal oeuvres={oeuvres} contacts={contacts} statusLabelMap={statusLabelMap} cM={cM} tM={tM} />
        </div>
      )
    case 'themes':
      return (
        <Themes
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
      )
    case 'chronologie':
      return <ChronologieTab />
    case 'slideshows':
      return <SlideshowsTab oeuvres={oeuvres} tM={tM} sM={sM} />
    case 'concepts':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Concepts isAdmin={isAdmin} />
        </div>
      )
    case 'audit':
      return <Audit />
    case 'broadcast':
      return <Broadcast />
    default: {
      const _exhaustive: never = tab
      return _exhaustive
    }
  }
}
