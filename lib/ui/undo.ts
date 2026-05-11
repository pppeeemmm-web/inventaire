/**
 * Single-level, time-limited undo token (atelier global undo).
 * Pairs with toast action + Ctrl/Cmd+Z in TeamPortalClient.
 */

import { dismissToast } from '@/lib/ui/toast'

export type UndoToken = {
  undo: () => void | Promise<void>
  expiresAt: number
  linkedToastId?: string
}

type Subscriber = (token: UndoToken | null) => void

let token: UndoToken | null = null
let expireTimer: ReturnType<typeof setTimeout> | null = null
const subs = new Set<Subscriber>()

function emit() {
  for (const fn of subs) fn(token)
}

function clearExpireTimer() {
  if (expireTimer != null) {
    clearTimeout(expireTimer)
    expireTimer = null
  }
}

/** True when the browser should keep native undo for text fields. */
export function isUndoKeyBlockedTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.closest('[contenteditable="true"]')) return true
  return false
}

export function subscribeUndo(fn: Subscriber) {
  subs.add(fn)
  fn(token)
  return () => {
    subs.delete(fn)
  }
}

export function peekUndo(): UndoToken | null {
  if (!token) return null
  if (Date.now() > token.expiresAt) {
    clearUndo('expire')
    return null
  }
  return token
}

export type ClearReason = 'expire' | 'replace' | 'consume' | 'manual'

/** Drop token without running undo (e.g. replaced, expired, or failed preflight). */
export function clearUndo(reason: ClearReason) {
  clearExpireTimer()
  const prev = token
  token = null
  if (prev?.linkedToastId && reason !== 'consume') {
    dismissToast(prev.linkedToastId)
  }
  emit()
}

/**
 * Register a new undo token (replaces any existing one).
 * @param linkedToastId — dismiss this toast when undo is consumed or cleared.
 */
export function registerUndo(opts: {
  ttlMs: number
  undo: () => void | Promise<void>
  linkedToastId?: string
}) {
  clearUndo('replace')
  const ttl = Math.max(1200, Math.min(12_000, opts.ttlMs))
  const expiresAt = Date.now() + ttl
  token = { undo: opts.undo, expiresAt, linkedToastId: opts.linkedToastId }
  clearExpireTimer()
  expireTimer = setTimeout(() => {
    expireTimer = null
    clearUndo('expire')
  }, ttl)
  emit()
}

/** Run undo once; returns false if no valid token. */
export async function consumeUndo(): Promise<boolean> {
  const t = peekUndo()
  if (!t) return false
  clearExpireTimer()
  const toastId = t.linkedToastId
  const run = t.undo
  token = null
  emit()
  if (toastId) dismissToast(toastId)
  try {
    await run()
    return true
  } catch (e) {
    console.error('[undo] consume failed:', e)
    throw e
  }
}
