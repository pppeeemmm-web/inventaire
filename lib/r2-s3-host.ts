/**
 * R2 S3 API hostname (no scheme).
 * EU / FedRAMP jurisdiction buckets must use the matching regional API host.
 * @see https://developers.cloudflare.com/r2/reference/data-location/
 *
 * Priority:
 * - `R2_S3_HOST` — host only, e.g. `abc.eu.r2.cloudflarestorage.com`
 * - `R2_S3_API_URL` — paste from dashboard ("S3 API"), e.g. `https://abc.eu.r2.cloudflarestorage.com/paintings` (path ignored)
 * - `R2_JURISDICTION=eu` | `fedramp` with `R2_ACCOUNT_ID`
 * - default global host `<account>.r2.cloudflarestorage.com`
 */
export function r2S3Hostname(accountId: string): string {
  const pasteUrl = process.env.R2_S3_API_URL?.trim()
  if (pasteUrl) {
    try {
      const u = new URL(pasteUrl.startsWith('http') ? pasteUrl : `https://${pasteUrl}`)
      return u.hostname
    } catch {
      /* fall through */
    }
  }

  const hostOverride = process.env.R2_S3_HOST?.trim()
  if (hostOverride) {
    return hostOverride.replace(/^https?:\/\//i, '').split('/')[0]!.replace(/\/$/, '')
  }
  const j = (process.env.R2_JURISDICTION ?? '').trim().toLowerCase()
  if (j === 'eu' || j === 'eu-union' || j === 'weur') {
    return `${accountId}.eu.r2.cloudflarestorage.com`
  }
  if (j === 'fedramp') {
    return `${accountId}.fedramp.r2.cloudflarestorage.com`
  }
  return `${accountId}.r2.cloudflarestorage.com`
}
