/**
 * Serializable props for Atelier RSC → TeamPortalClient. Kept separate from
 * TeamPortalClient.tsx so thin wrappers (e.g. AtelierTeamPortalLoader) do not
 * pull the full client module graph at the server entry.
 */
import type { Oeuvre, SuiviReminderListRow, ConceptBurningRow } from '@/lib/types/database'
import type { PipelinePulseItem } from '@/lib/pipeline-deadlines'
import type { PipelineCalendarEvent } from '@/lib/pipeline-calendar'

export interface AtelierOverviewBootstrap {
  expenseTotalTtc: number
  upcomingPulse: PipelinePulseItem[]
  overviewCalendarEvents: PipelineCalendarEvent[]
  burningConcepts: ConceptBurningRow[]
}

export interface TeamPortalClientProps {
  /** Admin-only: pending `pending_changes` rows for Review tab badge. */
  initialPendingReviewCount?: number
  /** Unread `suivi_reminder` rows (RLS); refreshed after Pipeline mutations. */
  initialReminderUnread?: number
  /** Unread reminders for overview + pipeline initial paint (`listUnreadSuiviReminders`). */
  initialReminders?: SuiviReminderListRow[]
  /** Overview tab: expense + pipeline calendar + pulse + concepts (RSC via `fetchAtelierOverviewBootstrap`). */
  initialOverviewBootstrap?: AtelierOverviewBootstrap
  /** When more rows exist than the initial chunk, client loads further pages. */
  oeuvresPaging?: { totalCount: number; nextCursor: number | null; pageSize: number }
  oeuvres:        Oeuvre[]
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  themes:         { id:          number; name:      string }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  statusLabelMap: Record<number, string>
  initialGroups:  { id: string; name: string }[]
  presentations:  { PresentationID: number; Nom: string | null }[]
  themeWorkCount?: Record<number, number>
  groupWorkCount?: Record<string, number>
  themePublicStats?: Record<number, { total: number; pub: number }>
  /** œuvre IDs per theme/group — resolve thumb/public from `oeuvres` */
  themePrivateWorks?: Record<number, number[]>
  groupPrivateWorks?: Record<string, number[]>
  /** Serialized junction maps (same rows as `oeuvre_theme` / `working_group_work`) */
  oeuvreThemeIdsByOeuvre?: Record<number, number[]>
  oeuvreGroupIdsByOeuvre?: Record<number, string[]>
  themeToGroups?: Record<number, string[]>
  groupToThemes?: Record<string, number[]>
}
