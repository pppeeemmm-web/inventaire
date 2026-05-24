/**
 * Serializable props for Atelier RSC → TeamPortalClient. Kept separate from
 * TeamPortalClient.tsx so thin wrappers (e.g. AtelierTeamPortalLoader) do not
 * pull the full client module graph at the server entry.
 */
import type { Oeuvre, SuiviReminderListRow, ConceptBurningRow } from '@/lib/types/database'
import type { PipelinePulseItem } from '@/lib/pipeline-deadlines'
import type { PipelineCalendarEvent } from '@/lib/pipeline-calendar'
import type { AtelierJunctionDerived } from '@/lib/atelier/atelier-junction-bootstrap'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'

export interface AtelierOverviewBootstrap {
  expenseTotalTtc: number
  upcomingPulse: PipelinePulseItem[]
  overviewCalendarEvents: PipelineCalendarEvent[]
  burningConcepts: ConceptBurningRow[]
}

export interface TeamPortalClientProps extends Partial<AtelierJunctionDerived> {
  /** Admin-only: pending `pending_changes` rows for Review tab badge. */
  initialPendingReviewCount?: number
  /** Unread `suivi_reminder` rows (RLS); refreshed after Pipeline mutations. */
  initialReminderUnread?: number
  /** Unread reminders for overview + pipeline initial paint (`listUnreadSuiviReminders`). */
  initialReminders?: SuiviReminderListRow[]
  /** Overview tab: expense + pipeline calendar + pulse + concepts (RSC via `fetchAtelierOverviewBootstrap`). */
  initialOverviewBootstrap?: AtelierOverviewBootstrap
  /** When set, this shell instance is pinned to a segmented tab route (Slice 3). */
  routeTab?: SegmentedAtelierTab
  /** When more rows exist than the initial chunk, client loads further pages. */
  oeuvresPaging?: {
    totalCount: number
    nextCursor: number | null
    pageSize: number
    /** True when RSC skipped the keyset chunk (audit/logistics/etc. cold start). */
    catalogueDeferred?: boolean
  }
  /** Bumps on each RSC render so the client refetches deferred shell rows after `router.refresh()`. */
  atelierShellNonce?: number
  /** From `is_admin()` on the server — avoids a browser Supabase `is_admin` RPC on the shell. */
  initialIsAdmin?: boolean
  /** Layout `(portal)` — catalogue + postPaint survive segment tab navigation. */
  shellPersistsAcrossTabs?: boolean
  oeuvres:        Oeuvre[]
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  themes:         { id:          number; name:      string }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  initialGroups:  { id: string; name: string }[]
  presentations:  { PresentationID: number; Nom: string | null }[]
}

/** Stable `contacts={…}` when RSC defers the full `Contact` scan (`fetchAtelierShellPostPaint` in TeamPortalClient). */
export const ATELIER_CONTACTS_EMPTY: TeamPortalClientProps['contacts'] = []

export const ATELIER_TECHNIQUES_EMPTY: TeamPortalClientProps['techniques'] = []
export const ATELIER_SUPPORTS_EMPTY: TeamPortalClientProps['supports'] = []
export const ATELIER_FORMATS_EMPTY: TeamPortalClientProps['formats'] = []
export const ATELIER_THEMES_EMPTY: TeamPortalClientProps['themes'] = []
export const ATELIER_GROUPS_EMPTY: TeamPortalClientProps['initialGroups'] = []
export const ATELIER_PRESENTATIONS_EMPTY: TeamPortalClientProps['presentations'] = []
