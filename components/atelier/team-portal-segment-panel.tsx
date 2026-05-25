'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'
import { ExhibitionsTabSkeleton } from '@/components/atelier/ExhibitionsTabSkeleton'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre } from '@/lib/types/database'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { TeamPortalClientProps, AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import type { Lang } from '@/lib/i18n/dictionary'

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
const Vault = dynamic(() => import('@/app/atelier/(portal)/vault/_components/Vault').then((m) => ({ default: m.Vault })), { loading: () => <TabPanelFallback />, ssr: false })
const ProductionTab = dynamic(() => import('@/app/atelier/(portal)/production/_components/Production').then((m) => ({ default: m.Production })), { loading: () => <TabPanelFallback />, ssr: false })
const Logistics = dynamic(() => import('@/app/atelier/(portal)/logistics/_components/Logistics').then((m) => ({ default: m.Logistics })), { loading: () => <TabPanelFallback />, ssr: false })
const SalesTab = dynamic(() => import('@/app/atelier/(portal)/sales/_components/Sales').then((m) => ({ default: m.Sales })), { loading: () => <TabPanelFallback />, ssr: false })
const PipelineTab = dynamic(() => import('@/app/atelier/(portal)/pipeline/_components/Pipeline').then((m) => ({ default: m.Pipeline })), { loading: () => <TabPanelFallback />, ssr: false })
const Fiscal = dynamic(() => import('@/app/atelier/(portal)/fiscal/_components/Fiscal').then((m) => ({ default: m.Fiscal })), { loading: () => <TabPanelFallback />, ssr: false })
const Concepts = dynamic(() => import('@/app/atelier/(portal)/concepts/_components/Concepts').then((m) => ({ default: m.Concepts })), { loading: () => <TabPanelFallback />, ssr: false })
const Exhibitions = dynamic(() => import('@/app/atelier/(portal)/exhibitions/_components/Exhibitions').then((m) => ({ default: m.Exhibitions })), { loading: () => <ExhibitionsTabSkeleton />, ssr: false })
const Themes = dynamic(() => import('@/app/atelier/(portal)/themes/_components/Themes').then((m) => ({ default: m.Themes })), { loading: () => <TabPanelFallback />, ssr: false })
const StockTakeTab = dynamic(() => import('@/app/atelier/(portal)/stock-take/_components/StockTake').then((m) => ({ default: m.StockTake })), { loading: () => <TabPanelFallback />, ssr: false })
const Reports = dynamic(() => import('@/app/atelier/(portal)/reports/_components/Reports').then((m) => ({ default: m.Reports })), { loading: () => <TabPanelFallback />, ssr: false })
const Audit = dynamic(() => import('@/app/atelier/(portal)/audit/_components/Audit').then((m) => ({ default: m.Audit })), { loading: () => <TabPanelFallback />, ssr: false })
const Broadcast = dynamic(() => import('@/app/atelier/(portal)/broadcast/_components/Broadcast').then((m) => ({ default: m.Broadcast })), { loading: () => <TabPanelFallback />, ssr: false })
const NotesTab = dynamic(() => import('@/app/atelier/(portal)/notes/_components/Notes').then((m) => ({ default: m.Notes })), { loading: () => <TabPanelFallback />, ssr: false })
const OverviewTab = dynamic(() => import('@/components/atelier/overview/OverviewTab').then((m) => ({ default: m.OverviewTab })), { loading: () => <TabPanelFallback />, ssr: false })
const WorldMapTab = dynamic(() => import('@/components/atelier/WorldMapTab').then((m) => ({ default: m.WorldMapTab })), { loading: () => <TabPanelFallback />, ssr: false })
const PortfolioConfigShell = dynamic(() => import('@/components/atelier/PortfolioConfigShell').then((m) => ({ default: m.PortfolioConfigShell })), { loading: () => <TabPanelFallback />, ssr: false })
const SupplierHub = dynamic(() => import('@/components/atelier/SupplierHub').then((m) => ({ default: m.SupplierHub })), { loading: () => <TabPanelFallback />, ssr: false })
const SessionJournalTab = dynamic(() => import('@/components/atelier/SessionJournalTab').then((m) => ({ default: m.SessionJournalTab })), { loading: () => <TabPanelFallback />, ssr: false })
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
  voiceNotesTick,
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
      return <ContactsTab contacts={contacts} oeuvres={oeuvres} conflicts={conflicts} />
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
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SupplierHub contacts={contacts} />
        </div>
      )
    case 'journal':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SessionJournalTab />
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
      return (
        <SalesTab
          oeuvres={oeuvres}
          statusLabelMap={statusLabelMap}
          contacts={contacts}
          groups={groups}
          cM={cM}
          tM={tM}
        />
      )
    case 'exhibitions':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Exhibitions
            oeuvres={oeuvres}
            contacts={contacts}
            themes={sortedThemes}
            tM={tM}
            selection={selection}
            setSelection={setSelection}
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
          <Fiscal oeuvres={oeuvres} contacts={contacts} />
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
    case 'concepts':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Concepts />
        </div>
      )
    case 'stock-take':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <StockTakeTab contacts={contacts} />
        </div>
      )
    case 'notes':
      return (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <NotesTab refreshTick={voiceNotesTick} oeuvres={oeuvres} />
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
