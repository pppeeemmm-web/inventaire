export type ToastKind = 'success' | 'error' | 'info'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastItem = {
  id: string
  kind: ToastKind
  message: string
  createdAt: number
  ttlMs: number
  action?: ToastAction
}

type Subscriber = (items: ToastItem[]) => void

let items: ToastItem[] = []
const subs = new Set<Subscriber>()

const timers = new Map<string, number>()

function emit() {
  for (const fn of subs) fn(items)
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function clearTimer(id: string) {
  const t = timers.get(id)
  if (t != null) {
    clearTimeout(t)
    timers.delete(id)
  }
}

function push(
  kind: ToastKind,
  message: string,
  opts?: { ttlMs?: number; action?: ToastAction },
): string {
  const ttlMs = Math.max(1200, Math.min(12_000, opts?.ttlMs ?? 4000))
  const t: ToastItem = {
    id: uid(),
    kind,
    message,
    createdAt: Date.now(),
    ttlMs,
    action: opts?.action,
  }
  items = [t, ...items].slice(0, 4)
  emit()
  const id = t.id
  const timer = window.setTimeout(() => {
    timers.delete(id)
    const next = items.filter((x) => x.id !== id)
    if (next.length === items.length) return
    items = next
    emit()
  }, ttlMs)
  timers.set(id, timer)
  return id
}

/** Remove a toast by id (e.g. when undo is consumed early). */
export function dismissToast(id: string) {
  clearTimer(id)
  const next = items.filter((x) => x.id !== id)
  if (next.length === items.length) return
  items = next
  emit()
}

export const toast = {
  success: (message: string, opts?: { ttlMs?: number; action?: ToastAction }) =>
    push('success', message, opts),
  error: (message: string, opts?: { ttlMs?: number; action?: ToastAction }) =>
    push('error', message, opts),
  info: (message: string, opts?: { ttlMs?: number; action?: ToastAction }) =>
    push('info', message, opts),
}

export function subscribeToasts(fn: Subscriber) {
  subs.add(fn)
  fn(items)
  return () => {
    subs.delete(fn)
  }
}
