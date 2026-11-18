import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logSystemCronEvent } from '@/lib/utils/logging'

/**
 * GET (Vercel cron, monthly — vercel.json) / POST (manual) /api/cron/retention
 * Secured with Authorization: Bearer <CRON_SECRET> (Vercel sends it on cron calls when CRON_SECRET is set).
 *
 * Retention, legal A.2 n° 3: `public.retention_page_view_inquiry()` (supabase/sql/retention_page_view_inquiry.sql,
 * service_role only) deletes page views older than 25 months and enquiries older than 3 years with no follow-up.
 * Until that SQL is applied the call fails and the error is returned + logged; nothing else is touched.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 503 })
  }

  const sb = createServiceClient()
  const { data, error } = await sb.rpc('retention_page_view_inquiry')
  const row = (Array.isArray(data) ? data[0] : data) as
    | { deleted_page_view: number | string; deleted_inquiry: number | string }
    | null
  const result = error
    ? { error: error.message as string }
    : {
        deletedPageView: Number(row?.deleted_page_view ?? 0),
        deletedInquiry: Number(row?.deleted_inquiry ?? 0),
      }

  await logSystemCronEvent({
    eventType: 'CRON_JOB',
    newValue: 'retention',
    metadata: result,
  })
  if (error) return NextResponse.json({ ok: false, ...result }, { status: 500 })
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
