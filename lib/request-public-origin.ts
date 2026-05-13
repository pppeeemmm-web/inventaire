import type { NextRequest } from 'next/server'

/**
 * Origin the browser used (custom domain on Vercel, Cloudflare in front, etc.).
 * Prefer `x-forwarded-*` over `request.nextUrl` / `request.url`, which can reflect
 * deployment-internal hosts — wrong `Location` breaks host-scoped auth cookies → OAuth loops.
 */
export function requestPublicOrigin(request: NextRequest): string {
  const xfHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const xfProtoRaw = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const xfProto = xfProtoRaw === 'http' || xfProtoRaw === 'https' ? xfProtoRaw : 'https'
  if (xfHost) return `${xfProto}://${xfHost}`

  const host = request.headers.get('host')?.split(',')[0]?.trim()
  if (host) {
    const proto = request.nextUrl.protocol === 'http:' ? 'http' : 'https'
    return `${proto}://${host}`
  }

  return request.nextUrl.origin
}
