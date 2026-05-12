import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  isBroadcastEligible,
  normalizeBroadcastPlatform,
  type BroadcastOeuvreRow,
} from '@/lib/broadcast-eligibility'
import {
  inventoryBroadcastAuthDebug,
  isInventoryBroadcastSecretConfigured,
  validateInventoryBroadcastSecret,
} from '@/lib/inventory-broadcast-secret'

type ConfirmBody = {
  oeuvreId?: number
  platform?: string
  externalPostId?: string | null
  externalUrl?: string | null
  captionFinal?: string | null
  metadata?: Record<string, unknown> | null
}

function numFromBody(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

function strOrNull(v: unknown, max = 2000): string | null {
  if (typeof v !== 'string') return v != null ? String(v).slice(0, max) || null : null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/** Accept camelCase (Make/JS) or PascalCase (PowerShell ConvertTo-Json). */
function parseConfirmBody(raw: Record<string, unknown>): ConfirmBody {
  const oeuvreId =
    numFromBody(raw.oeuvreId) ??
    numFromBody(raw.OeuvreId) ??
    numFromBody(raw.OeuvreID)
  const platformRaw =
    (typeof raw.platform === 'string' && raw.platform) ||
    (typeof raw.Platform === 'string' && raw.Platform) ||
    ''
  const externalPostId = strOrNull(raw.externalPostId ?? raw.ExternalPostId ?? raw.external_post_id, 512)
  const externalUrl = strOrNull(raw.externalUrl ?? raw.ExternalUrl ?? raw.external_url, 2000)
  const captionFinal = strOrNull(raw.captionFinal ?? raw.CaptionFinal ?? raw.caption_final, 8000)
  const metadata = raw.metadata ?? raw.Metadata
  return {
    oeuvreId: oeuvreId ?? undefined,
    platform: platformRaw,
    externalPostId,
    externalUrl,
    captionFinal,
    metadata:
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : null,
  }
}

export async function POST(req: NextRequest) {
  if (!isInventoryBroadcastSecretConfigured()) {
    return NextResponse.json({ error: 'Broadcast confirm not configured' }, { status: 503 })
  }
  if (!validateInventoryBroadcastSecret(req)) {
    const debug = inventoryBroadcastAuthDebug(req)
    return NextResponse.json(
      { error: 'Unauthorized', ...(debug ? { _debug: debug } : {}) },
      { status: 401 },
    )
  }

  let body: ConfirmBody
  try {
    const raw = (await req.json()) as Record<string, unknown>
    body = parseConfirmBody(raw)
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
    console.error('[broadcast-confirm] select', selErr.message)
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Work not found' }, { status: 404 })
  }

  if (!isBroadcastEligible(row as BroadcastOeuvreRow)) {
    return NextResponse.json(
      { error: 'Work is not eligible for broadcast (public + broadcast_ready + image, not deleted)' },
      { status: 400 },
    )
  }

  const externalPostId = strOrNull(body.externalPostId, 512)
  const externalUrl = strOrNull(body.externalUrl, 2000)
  const captionFinal = strOrNull(body.captionFinal, 8000)
  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : null

  // Look up any existing row for (oeuvre, platform) — may be a queued lock from /queue.
  const { data: existing, error: exErr } = await sb
    .from('oeuvre_broadcasts')
    .select('id, status')
    .eq('oeuvre_id', oeuvreId)
    .eq('platform', platform)
    .maybeSingle()

  if (exErr) {
    console.error('[broadcast-confirm] existing lookup', exErr.message)
    return NextResponse.json({ error: exErr.message }, { status: 500 })
  }

  if (existing?.status === 'posted') {
    return NextResponse.json(
      { error: 'Already confirmed for this platform', oeuvreId, platform },
      { status: 409 },
    )
  }

  const nowIso = new Date().toISOString()
  const postedFields = {
    status: 'posted' as const,
    broadcast_at: nowIso,
    queued_at: null as string | null,
    external_post_id: externalPostId,
    external_url: externalUrl,
    caption_final: captionFinal,
    metadata,
  }

  if (existing?.id) {
    const { data: updated, error: upErr } = await sb
      .from('oeuvre_broadcasts')
      .update(postedFields)
      .eq('id', existing.id)
      .select('id, oeuvre_id, platform, broadcast_at, external_url')
      .single()

    if (upErr) {
      console.error('[broadcast-confirm] update', upErr.message)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, record: updated, transition: 'queued_to_posted' })
  }

  const { data: inserted, error: insErr } = await sb
    .from('oeuvre_broadcasts')
    .insert({
      oeuvre_id: oeuvreId,
      platform,
      ...postedFields,
    })
    .select('id, oeuvre_id, platform, broadcast_at, external_url')
    .single()

  if (insErr) {
    if (insErr.code === '23505' || /duplicate key|unique constraint/i.test(insErr.message ?? '')) {
      return NextResponse.json(
        { error: 'Already confirmed for this platform', oeuvreId, platform },
        { status: 409 },
      )
    }
    console.error('[broadcast-confirm] insert', insErr.message)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, record: inserted, transition: 'fresh_post' })
}
