export type PageViewRow = {
  path: string
  referrer: string | null
  country: string | null
  created_at: string
  visitor_id: string | null
  is_team_session: boolean | null
}

export function parseExcludedVisitorIds(): Set<string> {
  const raw = process.env.ANALYTICS_EXCLUDE_VISITOR_IDS?.trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** Public traffic only — excludes team Atelier sessions and configured visitor ids. */
export function isNetPageView(row: PageViewRow, excludedIds: Set<string>): boolean {
  if (row.is_team_session === true) return false
  const vid = row.visitor_id?.trim()
  if (vid && excludedIds.has(vid.toLowerCase())) return false
  return true
}

function devHostname(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '').toLowerCase()
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0:0:0:0:0:0:0:1' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local')
  )
}

/** Host header value (may include port) → bare hostname. */
function hostnameFromHostHeader(hostHeader: string): string {
  const host = hostHeader.split(',')[0]?.trim().toLowerCase() ?? ''
  if (!host) return ''
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    if (end !== -1) return host.slice(1, end)
  }
  return host.split(':')[0]
}

/**
 * Local/dev host, referrer, or origin — used to skip inserts and query-time aggregates.
 */
export function isDevAnalyticsHost(input: string | null | undefined): boolean {
  const raw = input?.trim()
  if (!raw) return false

  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
    try {
      const u = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
      return devHostname(u.hostname)
    } catch {
      /* fall through */
    }
  }

  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return devHostname(u.hostname)
  } catch {
    /* not a URL */
  }

  return devHostname(hostnameFromHostHeader(raw))
}

/** Exclude historical page_view rows whose referrer/origin is local/dev. */
export function isDevAnalyticsPageView(row: PageViewRow): boolean {
  return isDevAnalyticsHost(row.referrer)
}
