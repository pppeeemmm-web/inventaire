import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeBroadcastPlatform } from '@/lib/broadcast-eligibility'
import {
  consumeInventoryBroadcastRateSlot,
  inventoryBroadcastRateLimitRetryAfterSec,
} from '@/lib/inventory-broadcast-rate-limit'
import {
  inventoryBroadcastAuthDebug,
  isInventoryBroadcastSecretConfigured,
  validateInventoryBroadcastSecret,
} from '@/lib/inventory-broadcast-secret'

const ALLOWED_TYPES = new Set(['queued', 'posted', 'comment', 'engagement', 'error', 'note'])

function numFromBody(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}
function strOrNull(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return v != null ? String(v).slice(0, max) || null : null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

export async function POST(req: NextRequest) {
  if (!isInventoryBroadcastSecretConfigured()) {
    return NextResponse.json({ error: 'Broadcast event not configured' }, { status: 503 })
  }
  if (!validateInventoryBroadcastSecret(req)) {
    const debug = inventoryBroadcastAuthDebug(req)
    return NextResponse.json(
      { error: 'Unauthorized', ...(debug ? { _debug: debug } : {}) },
      { status: 401 },
    )
  }
  if (!consumeInventoryBroadcastRateSlot(req)) {
    const ra = inventoryBroadcastRateLimitRetryAfterSec()
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(ra) } },
    )
  }

  let raw: Record<string, unknown>
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const oeuvreId = numFromBody(raw.oeuvreId ?? raw.OeuvreId ?? raw.OeuvreID)
  const platform = normalizeBroadcastPlatform(
    (typeof raw.platform === 'string' && raw.platform) ||
      (typeof raw.Platform === 'string' && raw.Platform) ||
      '',
  )
  if (!platform) {
    return NextResponse.json({ error: 'platform required (alphanumeric slug)' }, { status: 400 })
  }

  const eventTypeRaw = strOrNull(raw.eventType ?? raw.EventType ?? raw.event_type, 32)
  const eventType = eventTypeRaw?.toLowerCase() ?? ''
  if (!ALLOWED_TYPES.has(eventType)) {
    return NextResponse.json(
      { error: `eventType must be one of: ${[...ALLOWED_TYPES].join(', ')}` },
      { status: 400 },
    )
  }

  const priorityRaw = strOrNull(raw.priority ?? raw.Priority, 16)?.toLowerCase() ?? 'normal'
  const priority = priorityRaw === 'vip' ? 'vip' : 'normal'

  const summary = strOrNull(raw.summary ?? raw.Summary, 500)
  const externalUrl = strOrNull(raw.externalUrl ?? raw.ExternalUrl ?? raw.external_url, 2000)
  const payloadRaw = raw.payload ?? raw.Payload
  const payload =
    payloadRaw && typeof payloadRaw === 'object' && !Array.isArray(payloadRaw)
      ? (payloadRaw as Record<string, unknown>)
      : null

  const sb = createServiceClient()
  const { data: inserted, error: insErr } = await sb
    .from('broadcast_events')
    .insert({
      oeuvre_id: oeuvreId,
      platform,
      event_type: eventType,
      priority,
      summary,
      external_url: externalUrl,
      payload,
    })
    .select('id, created_at')
    .single()

  if (insErr) {
    console.error('[broadcast-event] insert', insErr.message)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, record: inserted })
}
