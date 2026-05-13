import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { readInventoryBroadcastCredential } from '@/lib/inventory-broadcast-secret'

/** Best-effort per-instance limiter (serverless: not global across isolates). */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 120
const MAX_KEYS = 2000

const buckets = new Map<string, number[]>()

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')?.trim()
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return 'unknown'
}

function pruneKey(key: string, now: number): number[] {
  const ts = buckets.get(key) ?? []
  const fresh = ts.filter((t) => now - t < WINDOW_MS)
  if (fresh.length === 0) buckets.delete(key)
  else buckets.set(key, fresh)
  return fresh
}

function evictIfNeeded(): void {
  if (buckets.size <= MAX_KEYS) return
  const drop = Math.ceil(buckets.size * 0.2)
  let i = 0
  for (const k of buckets.keys()) {
    buckets.delete(k)
    if (++i >= drop) break
  }
}

/**
 * After `validateInventoryBroadcastSecret` succeeds. Returns false when over limit.
 * Key = SHA-256(credential) prefix + client IP (first XFF hop).
 */
export function consumeInventoryBroadcastRateSlot(req: NextRequest): boolean {
  const credential = readInventoryBroadcastCredential(req)
  if (!credential) return true
  const id = crypto.createHash('sha256').update(credential, 'utf8').digest('hex').slice(0, 16)
  const key = `${id}:${clientIp(req)}`
  const now = Date.now()
  evictIfNeeded()
  const fresh = pruneKey(key, now)
  if (fresh.length >= MAX_PER_WINDOW) return false
  fresh.push(now)
  buckets.set(key, fresh)
  return true
}

export function inventoryBroadcastRateLimitRetryAfterSec(): number {
  return Math.ceil(WINDOW_MS / 1000)
}
