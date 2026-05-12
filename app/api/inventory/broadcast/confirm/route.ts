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
  const ext =
    raw.externalPostId ?? raw.ExternalPostId ?? raw.external_post_id ?? null
  const externalPostId =
    typeof ext === 'string' ? ext : ext != null ? String(ext) : null
  const metadata = raw.metadata ?? raw.Metadata
  return {
    oeuvreId: oeuvreId ?? undefined,
    platform: platformRaw,
    externalPostId,
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

  const externalPostId =
    typeof body.externalPostId === 'string' && body.externalPostId.trim()
      ? body.externalPostId.trim().slice(0, 512)
      : null

  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : null

  const { data: inserted, error: insErr } = await sb
    .from('oeuvre_broadcasts')
    .insert({
      oeuvre_id: oeuvreId,
      platform,
      external_post_id: externalPostId,
      metadata,
    })
    .select('id, oeuvre_id, platform, broadcast_at')
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

  return NextResponse.json({ ok: true, record: inserted })
}
