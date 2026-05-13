import crypto from 'crypto'
import type { NextRequest } from 'next/server'

export function isInventoryBroadcastSecretConfigured(): boolean {
  return Boolean(process.env.INVENTORY_BROADCAST_SECRET?.trim())
}

/** Bearer token, or same value in `x-inventory-broadcast-secret` (some clients strip Authorization). */
export function readInventoryBroadcastCredential(req: NextRequest): string {
  const auth = req.headers.get('authorization')?.trim()
  // RFC 6757 uses "Bearer"; some UIs (e.g. Make) lowercase the scheme — accept both.
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim()
  const x = req.headers.get('x-inventory-broadcast-secret')
  if (x?.trim()) return x.trim()
  return ''
}

export function validateInventoryBroadcastSecret(req: NextRequest): boolean {
  const secret = (process.env.INVENTORY_BROADCAST_SECRET ?? '').trim()
  if (!secret) return false
  const credential = readInventoryBroadcastCredential(req)
  if (!credential) return false
  const hCred = crypto.createHash('sha256').update(credential, 'utf8').digest()
  const hSec = crypto.createHash('sha256').update(secret, 'utf8').digest()
  return crypto.timingSafeEqual(hCred, hSec)
}

/** Dev-only JSON body fragment to explain 401 without leaking secrets. */
export function inventoryBroadcastAuthDebug(req: NextRequest): Record<string, unknown> | undefined {
  if (process.env.NODE_ENV !== 'development') return undefined
  const secret = (process.env.INVENTORY_BROADCAST_SECRET ?? '').trim()
  const credential = readInventoryBroadcastCredential(req)
  return {
    hasAuthorizationHeader: Boolean(req.headers.get('authorization')),
    hasXInventoryBroadcastSecretHeader: Boolean(req.headers.get('x-inventory-broadcast-secret')),
    credentialCharLength: credential.length,
    secretCharLength: secret.length,
    lengthsMatch: credential.length === secret.length,
  }
}
