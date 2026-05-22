'use client'

import type { ErrorReporterContext } from '@/lib/error-reporter/format'
import { serializeError } from '@/lib/error-reporter/format'
import { toast } from '@/lib/ui/toast'

type ClientLogBody = {
  level: 'error' | 'warn'
  message: string
  source: string
  metadata?: Record<string, unknown>
  error?: { message: string; stack?: string }
}

async function postClientLog(body: ClientLogBody): Promise<void> {
  try {
    await fetch('/api/system/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    /* best-effort */
  }
}

/** Client: toast + POST /api/system/log-error. */
export function surfaceError(
  message: string,
  err?: unknown,
  ctx?: ErrorReporterContext,
): void {
  toast.error(message)
  void postClientLog({
    level: 'error',
    message,
    source: ctx?.source ?? 'client',
    metadata: ctx?.metadata,
    error: err != null ? serializeError(err) : undefined,
  })
}

export function surfaceWarn(
  message: string,
  err?: unknown,
  ctx?: ErrorReporterContext,
): void {
  toast.info(message)
  void postClientLog({
    level: 'warn',
    message,
    source: ctx?.source ?? 'client',
    metadata: ctx?.metadata,
    error: err != null ? serializeError(err) : undefined,
  })
}
