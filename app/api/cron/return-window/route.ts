import { NextResponse } from 'next/server'
import { applyExpiredSaleReturnWindows } from '@/lib/sale-return-window-cron'
import { logSystemCronEvent } from '@/lib/utils/logging'

/**
 * POST /api/cron/return-window
 * Secured with Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await applyExpiredSaleReturnWindows()
  await logSystemCronEvent({
    eventType: 'CRON_JOB',
    newValue: 'return_window',
    metadata: result,
  })
  return NextResponse.json({ ok: true, ...result })
}
