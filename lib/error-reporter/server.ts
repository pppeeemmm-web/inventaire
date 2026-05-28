import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { ErrorReporterContext } from '@/lib/error-reporter/format'
import { errorMessage, errorStack, serializeError } from '@/lib/error-reporter/format'

const RUNTIME_EVENT = 'RUNTIME_ERROR'

async function insertRuntimeLog(
  action: string,
  details: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const row = {
      action,
      event_type: RUNTIME_EVENT,
      details,
      metadata,
      user_id: user?.id ?? null,
      author_id: user?.id ?? null,
    }

    const { error } = await supabase.from('system_log').insert(row)
    if (error) console.error('[error-reporter] system_log insert failed:', error.message)
  } catch (e) {
    console.error('[error-reporter] insert failed:', e)
  }
}

function buildPayload(
  level: 'error' | 'warn',
  message: string,
  err: unknown,
  ctx?: ErrorReporterContext,
): { action: string; details: string; metadata: Record<string, unknown> } {
  const source = ctx?.source ?? 'unknown'
  const serialized = err != null ? serializeError(err) : null
  const action = `${level.toUpperCase()} ${source}`
  const detailParts = [message]
  if (serialized?.message && serialized.message !== message) detailParts.push(serialized.message)
  return {
    action,
    details: detailParts.join(' — '),
    metadata: {
      level,
      source,
      ...ctx?.metadata,
      ...(serialized ? { error: serialized } : {}),
    },
  }
}

/** Server-only: write RUNTIME_ERROR to system_log (best-effort). */
export async function logError(
  message: string,
  err?: unknown,
  ctx?: ErrorReporterContext,
): Promise<void> {
  console.error(`[${ctx?.source ?? 'app'}]`, message, err ?? '')
  const { action, details, metadata } = buildPayload('error', message, err, ctx)
  await insertRuntimeLog(action, details, metadata)
}

export async function logWarn(
  message: string,
  err?: unknown,
  ctx?: ErrorReporterContext,
): Promise<void> {
  console.warn(`[${ctx?.source ?? 'app'}]`, message, err ?? '')
  const { action, details, metadata } = buildPayload('warn', message, err, ctx)
  await insertRuntimeLog(action, details, metadata)
}

export { errorMessage, errorStack }
