import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildBroadcastFeedItem,
  normalizeBroadcastPlatform,
  type BroadcastFeedWorkRow,
} from '@/lib/broadcast-eligibility'
import {
  inventoryBroadcastAuthDebug,
  isInventoryBroadcastSecretConfigured,
  validateInventoryBroadcastSecret,
} from '@/lib/inventory-broadcast-secret'

export async function GET(req: NextRequest) {
  if (!isInventoryBroadcastSecretConfigured()) {
    return NextResponse.json({ error: 'Broadcast feed not configured' }, { status: 503 })
  }
  if (!validateInventoryBroadcastSecret(req)) {
    const debug = inventoryBroadcastAuthDebug(req)
    return NextResponse.json(
      { error: 'Unauthorized', ...(debug ? { _debug: debug } : {}) },
      { status: 401 },
    )
  }

  const platform = normalizeBroadcastPlatform(req.nextUrl.searchParams.get('platform'))
  if (!platform) {
    return NextResponse.json(
      { error: 'Missing or invalid platform query (use alphanumeric slug, e.g. instagram)' },
      { status: 400 },
    )
  }

  const sb = createServiceClient()

  const { data: doneRows, error: doneErr } = await sb
    .from('oeuvre_broadcasts')
    .select('oeuvre_id')
    .eq('platform', platform)

  if (doneErr) {
    console.error('[broadcast-feed] oeuvre_broadcasts', doneErr.message)
    return NextResponse.json({ error: doneErr.message }, { status: 500 })
  }

  const excludeIds = (doneRows ?? []).map((r: { oeuvre_id: number }) => r.oeuvre_id)

  let q = sb
    .from('Oeuvres')
    .select(
      'OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, Technique, Support, txtImageNameLink, deleted_at, is_public, broadcast_ready',
    )
    .is('deleted_at', null)
    .eq('is_public', true)
    .eq('broadcast_ready', true)
    .not('txtImageNameLink', 'is', null)

  if (excludeIds.length > 0) {
    q = q.not('OeuvreID', 'in', `(${excludeIds.join(',')})`)
  }

  const { data: works, error: wErr } = await q.order('Année', { ascending: false })

  if (wErr) {
    console.error('[broadcast-feed] Oeuvres', wErr.message)
    return NextResponse.json({ error: wErr.message }, { status: 500 })
  }

  const [{ data: techRows }, { data: supRows }] = await Promise.all([
    sb.from('Technique').select('TechniqueID, Technique'),
    sb.from('Support').select('SupportID, Support'),
  ])

  const techMap: Record<number, string> = {}
  for (const t of techRows ?? []) {
    const row = t as { TechniqueID: number; Technique: string | null }
    if (row.TechniqueID != null && row.Technique) techMap[row.TechniqueID] = row.Technique
  }
  const supMap: Record<number, string> = {}
  for (const s of supRows ?? []) {
    const row = s as { SupportID: number; Support: string | null }
    if (row.SupportID != null && row.Support) supMap[row.SupportID] = row.Support
  }

  const items = ((works ?? []) as BroadcastFeedWorkRow[]).map((row) =>
    buildBroadcastFeedItem(
      row,
      row.Technique != null ? techMap[row.Technique] ?? null : null,
      row.Support != null ? supMap[row.Support] ?? null : null,
    ),
  )

  return NextResponse.json({ platform, count: items.length, items })
}
