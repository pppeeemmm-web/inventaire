/** Public origin for OAuth redirect_uri registration. */
export function appOrigin(): string {
  const u = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (u) return u.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  return 'http://localhost:3000'
}
