import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Oeuvre } from '@/lib/types/database'

export type DrawerContactRow = {
  ContactID: number
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Role: string | null
  Ville?: string | null
  Pays?: string | null
}

export type WorkImageRow = {
  ImageID: number
  txtImageNameLink: string | null
  SeqNo: number | null
}

export type DrawerContentProps = {
  o: Oeuvre
  tM: Record<number, string>
  sM: Record<number, string>
  cM: Record<number, string>
  pM: Record<number, string>
  /** Passed through for parity with shell props; reserved for future field labels. */
  fM?: Record<number, string>
  locMap?: Record<number, string>
  statusLabelMap: Record<number, string>
  selection: Set<number>
  setSelection?: (s: Set<number>) => void
  toggleInSel?: (id: number) => void
  onClose: () => void
  onEdit?: (o: Oeuvre) => void
  thM: Record<number, string>
  oeuvreThemeMap: Map<number, number[]>
  oeuvreGroupMap: Map<number, string[]>
  groupNameMap: Record<string, string>
  initialTechniques: { TechniqueID: number; Technique: string | null }[]
  initialSupports: { SupportID: number; Support: string | null }[]
  initialFormats: { FormatID: number; Format: string | null }[]
  initialThemes: { id: number; name: string }[]
  initialContacts: DrawerContactRow[]
  initialGroups: { id: string; name: string }[]
  initialPresentations: { PresentationID: number; Nom: string | null }[]
  mode: 'panel' | 'overlay'
  isExpanded: boolean
  setExpanded?: (b: boolean) => void
  imgZoom: number
  setImgZoom: Dispatch<SetStateAction<number>>
  imgPan: { x: number; y: number }
  setImgPan: Dispatch<SetStateAction<{ x: number; y: number }>>
  naturalSize: { w: number; h: number } | null
  setNaturalSize: Dispatch<SetStateAction<{ w: number; h: number } | null>>
  workImages: WorkImageRow[]
  setWorkImages: Dispatch<SetStateAction<WorkImageRow[]>>
  activeImgIdx: number
  setActiveImgIdx: Dispatch<SetStateAction<number>>
  imgContainerRef: MutableRefObject<HTMLDivElement | null>
  isDragging: MutableRefObject<boolean>
  dragStart: MutableRefObject<{ x: number; y: number; px: number; py: number }>
  activeImgPath: string | null | undefined
  isSel: boolean
  closeAttemptRef: MutableRefObject<(() => void) | null>
  runGuardedSlot: MutableRefObject<(fn: () => void) => void>
  guardApiRef: MutableRefObject<{
    isDirty: () => boolean
    performSave: () => Promise<boolean>
  }>
  onDrawerDirtyChange?: (dirty: boolean) => void
  /** Admin-only affordances inside the drawer (e.g. delete field sessions). */
  isAdmin?: boolean
}
