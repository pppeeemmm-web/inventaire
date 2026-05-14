/** localStorage key for anonymous public-site analytics (distinct visitors / net). */
export const PUBLIC_VISITOR_STORAGE_KEY = 'pem_public_vid'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isLikelyVisitorUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** Browser-only: stable id for public marketing pages. */
export function getOrCreatePublicVisitorId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = window.localStorage.getItem(PUBLIC_VISITOR_STORAGE_KEY)?.trim()
    if (id && isLikelyVisitorUuid(id)) return id
    id = crypto.randomUUID()
    window.localStorage.setItem(PUBLIC_VISITOR_STORAGE_KEY, id)
    return id
  } catch {
    return null
  }
}
