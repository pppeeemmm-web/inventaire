/** Kaizen sections and row shape (owner 2026-11-02). Browser-safe; actions in `app/atelier/(portal)/kaizen/actions.ts`. */
/** 'app' = reports from the review window (ReviewTool.md, 2026-11-28). */
export const KAIZEN_SECTIONS = ['creation', 'website', 'business', 'app'] as const
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
  /** Review window: page, build, device, pointed element — written once (kaizen_review_tool.sql). */
  context: KaizenContext | null
  /** The build that fixes it (set with « done »). */
  fixed_sha: string | null
  /** Pem confirmed the fix on that build. */
  verified_at: string | null
  /** Pem's OK to act; null = « proposé » (a team report waiting for Pem). Only an admin sets it (database rule). */
  approved_at: string | null
}

export type KaizenContext = {
  page?: string
  build?: string
  device?: string
  pointed?: string
}

/** States read from the columns (no state column): proposé → ouvert → à vérifier → confirmé. */
export type KaizenState = 'proposed' | 'open' | 'to_verify' | 'confirmed'

export function kaizenStateOf(it: Pick<KaizenItem, 'approved_at' | 'done_at' | 'verified_at'>): KaizenState {
  if (it.verified_at) return 'confirmed'
  if (it.done_at) return 'to_verify'
  return it.approved_at ? 'open' : 'proposed'
}

/** The context the window sends, cleaned: short strings only, unknown keys dropped. */
export function parseKaizenContext(raw: unknown): KaizenContext | null {
  if (!raw || typeof raw !== 'object') return null
  const out: KaizenContext = {}
  for (const k of ['page', 'build', 'device', 'pointed'] as const) {
    const v = (raw as Record<string, unknown>)[k]
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 500)
  }
  return Object.keys(out).length ? out : null
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
