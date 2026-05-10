/**
 * Serializable props for Atelier RSC → TeamPortalClient. Kept separate from
 * TeamPortalClient.tsx so thin wrappers (e.g. AtelierTeamPortalLoader) do not
 * pull the full client module graph at the server entry.
 */
import type { Oeuvre } from '@/lib/types/database'

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
  exhibitions:    any[]
  themeWorkCount?: Record<number, number>
  groupWorkCount?: Record<string, number>
  addresses?:     any[]
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
