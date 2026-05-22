import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const RUNTIME_EVENT = 'RUNTIME_ERROR'
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30

type Bucket = { times: number[] }
const buckets = new Map<string, Bucket>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { times: [] }
    buckets.set(key, bucket)
  }
  bucket.times = bucket.times.filter((t) => now - t < WINDOW_MS)
  if (bucket.times.length >= MAX_PER_WINDOW) return true
  bucket.times.push(now)
  return false
}

type LogBody = {
  level?: 'error' | 'warn'
  message?: string
  source?: string
  metadata?: Record<string, unknown>
  error?: { message?: string; stack?: string }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (rateLimited(user.id)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  let body: LogBody
  try {
    body = (await req.json()) as LogBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 120) : 'client'
  const level = body.level === 'warn' ? 'warn' : 'error'
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const action = `${level.toUpperCase()} ${source}`
  const details = body.error?.message ? `${message} — ${body.error.message}` : message

  try {
    const service = createServiceClient()
    const { error } = await service.from('system_log').insert({
      action,
      event_type: RUNTIME_EVENT,
      details,
      metadata: {
        level,
        source,
        client: true,
        ...body.metadata,
        ...(body.error ? { error: body.error } : {}),
      },
      user_id: user.id,
      author_id: user.id,
    } as never)

    if (error) {
      console.error('[log-error]', error.message)
      return NextResponse.json({ error: 'Log failed' }, { status: 500 })
    }
  } catch (e) {
    console.error('[log-error]', e)
    return NextResponse.json({ error: 'Log failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
