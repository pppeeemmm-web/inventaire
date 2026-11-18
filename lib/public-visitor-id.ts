/** localStorage key for anonymous public-site analytics (distinct visitors / net). */
export const PUBLIC_VISITOR_STORAGE_KEY = 'pem_public_vid'
/** When the id above was made (ISO date). The id lives 13 months at most (CNIL audience-measurement exemption). */
export const PUBLIC_VISITOR_CREATED_KEY = 'pem_public_vid_at'
/** « Ne pas être compté·e » / « Don't count me »: '1' = no id, no page view recorded from this browser. */
export const PUBLIC_COUNT_OPTOUT_KEY = 'pem_public_count_optout'

/** 13 months, then a new id: a returning visitor counts as new once a year. */
const VISITOR_ID_MAX_MONTHS = 13
/**
 * Ids stored before the creation date existed are dated from the day the id shipped (2026-05-14, the
 * oldest any of them can be), so none lives past 13 months.
 */
const LEGACY_ID_CREATED = '2026-05-14T00:00:00.000Z'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isLikelyVisitorUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

function isExpired(createdIso: string, now: Date): boolean {
  const created = new Date(createdIso)
  if (Number.isNaN(created.getTime())) return true
  const limit = new Date(created)
  limit.setUTCMonth(limit.getUTCMonth() + VISITOR_ID_MAX_MONTHS)
  return now >= limit
}

/** Browser-only: true when this browser asked not to be counted. */
export function isPublicCountingOptedOut(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PUBLIC_COUNT_OPTOUT_KEY) === '1'
  } catch {
    return false
  }
}

/** Browser-only: opting out removes the visitor id too (nothing left to count with). */
export function setPublicCountingOptedOut(optedOut: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (optedOut) {
      window.localStorage.setItem(PUBLIC_COUNT_OPTOUT_KEY, '1')
      window.localStorage.removeItem(PUBLIC_VISITOR_STORAGE_KEY)
      window.localStorage.removeItem(PUBLIC_VISITOR_CREATED_KEY)
    } else {
      window.localStorage.removeItem(PUBLIC_COUNT_OPTOUT_KEY)
    }
  } catch {
    /* storage blocked: nothing stored, nothing to change */
  }
}

/** Browser-only: id for public marketing pages, renewed after 13 months; null when opted out. */
export function getOrCreatePublicVisitorId(): string | null {
  if (typeof window === 'undefined') return null
  if (isPublicCountingOptedOut()) return null
  try {
    const ls = window.localStorage
    const now = new Date()
    let id = ls.getItem(PUBLIC_VISITOR_STORAGE_KEY)?.trim()
    if (id && isLikelyVisitorUuid(id)) {
      const created = ls.getItem(PUBLIC_VISITOR_CREATED_KEY)?.trim() || LEGACY_ID_CREATED
      if (!isExpired(created, now)) {
        if (!ls.getItem(PUBLIC_VISITOR_CREATED_KEY)) ls.setItem(PUBLIC_VISITOR_CREATED_KEY, created)
        return id
      }
    }
    id = crypto.randomUUID()
    ls.setItem(PUBLIC_VISITOR_STORAGE_KEY, id)
    ls.setItem(PUBLIC_VISITOR_CREATED_KEY, now.toISOString())
    return id
  } catch {
    return null
  }
}
