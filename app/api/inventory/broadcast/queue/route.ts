import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  isBroadcastEligible,
  normalizeBroadcastPlatform,
  type BroadcastOeuvreRow,
} from '@/lib/broadcast-eligibility'
import {
  consumeInventoryBroadcastRateSlot,
  inventoryBroadcastRateLimitRetryAfterSec,
} from '@/lib/inventory-broadcast-rate-limit'
import {
  inventoryBroadcastAuthDebug,
  isInventoryBroadcastSecretConfigured,
  validateInventoryBroadcastSecret,
} from '@/lib/inventory-broadcast-secret'

type QueueBody = {
  oeuvreId?: number
  platform?: string
}

function numFromBody(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!isInventoryBroadcastSecretConfigured()) {
    return NextResponse.json({ error: 'Broadcast queue not configured' }, { status: 503 })
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

  let body: QueueBody
  try {
    const raw = (await req.json()) as Record<string, unknown>
    body = {
      oeuvreId: numFromBody(raw.oeuvreId ?? raw.OeuvreId ?? raw.OeuvreID) ?? undefined,
      platform:
        (typeof raw.platform === 'string' && raw.platform) ||
        (typeof raw.Platform === 'string' && raw.Platform) ||
        '',
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const oeuvreId = body.oeuvreId != null ? numFromBody(body.oeuvreId) : null
  if (oeuvreId == null || oeuvreId <= 0) {
    return NextResponse.json({ error: 'oeuvreId required' }, { status: 400 })
  }
  const platform = normalizeBroadcastPlatform(body.platform ?? '')
  if (!platform) {
    return NextResponse.json({ error: 'platform required (alphanumeric slug)' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data: row, error: selErr } = await sb
    .from('Oeuvres')
    .select('OeuvreID, deleted_at, is_public, broadcast_ready, txtImageNameLink')
    .eq('OeuvreID', oeuvreId)
    .maybeSingle()

  if (selErr) {
    console.error('[broadcast-queue] select', selErr.message)
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }
  if (!row) return NextResponse.json({ error: 'Work not found' }, { status: 404 })
  if (!isBroadcastEligible(row as BroadcastOeuvreRow)) {
    return NextResponse.json({ error: 'Work is not eligible for broadcast' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()

  // Existing row? If posted, refuse. If queued, bump attempt_count + queued_at.
  const { data: existing, error: exErr } = await sb
    .from('oeuvre_broadcasts')
    .select('id, status, attempt_count')
    .eq('oeuvre_id', oeuvreId)
    .eq('platform', platform)
    .maybeSingle()

  if (exErr) {
    console.error('[broadcast-queue] existing lookup', exErr.message)
    return NextResponse.json({ error: exErr.message }, { status: 500 })
  }

  if (existing?.status === 'posted') {
    return NextResponse.json(
      { error: 'Already posted on this platform', oeuvreId, platform },
      { status: 409 },
    )
  }

  if (existing?.id) {
    const nextCount = (existing.attempt_count ?? 0) + 1
    const { data: updated, error: upErr } = await sb
      .from('oeuvre_broadcasts')
      .update({ status: 'queued', queued_at: nowIso, attempt_count: nextCount })
      .eq('id', existing.id)
      .select('id, oeuvre_id, platform, status, queued_at, attempt_count')
      .single()
    if (upErr) {
      console.error('[broadcast-queue] update', upErr.message)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, record: updated, action: 'requeued' })
  }

  const { data: inserted, error: insErr } = await sb
    .from('oeuvre_broadcasts')
    .insert({
      oeuvre_id: oeuvreId,
      platform,
      status: 'queued',
      queued_at: nowIso,
      attempt_count: 1,
    })
    .select('id, oeuvre_id, platform, status, queued_at, attempt_count')
    .single()

  if (insErr) {
    console.error('[broadcast-queue] insert', insErr.message)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, record: inserted, action: 'queued' })
}
