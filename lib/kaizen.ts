/** Kaizen sections and row shape (owner 2026-11-02). Browser-safe; actions in `app/atelier/(portal)/kaizen/actions.ts`. */
export const KAIZEN_SECTIONS = ['creation', 'website', 'business'] as const
export type KaizenSection = (typeof KAIZEN_SECTIONS)[number]

export type KaizenItem = {
  id: number
  created_at: string
  updated_at: string
  author_id: string | null
  /** null = migrated entry waiting for the owner to confirm `suggested_section`. */
  section: KaizenSection | null
  suggested_section: KaizenSection | null
  title: string
  body: string | null
  work_ids: number[]
  done_at: string | null
  done_by: string | null
  /** R2 keys (`kaizen/…avif`); thumbs via `thumbUrl`. */
  screenshots: string[]
}

export function parseKaizenSection(raw: unknown): KaizenSection | null {
  return typeof raw === 'string' && (KAIZEN_SECTIONS as readonly string[]).includes(raw) ? (raw as KaizenSection) : null
}

/** Sidebar entries under the Kaizen group: Création, and Opérations & Stratégie (Système + Business). */
export type KaizenScope = 'creation' | 'ops'

/** Entries waiting for review (section null) count under Opérations & Stratégie. */
export function kaizenScopeOf(section: KaizenSection | null): KaizenScope {
  return section === 'creation' ? 'creation' : 'ops'
}
