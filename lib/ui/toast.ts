export type ToastKind = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  kind: ToastKind
  message: string
  createdAt: number
  ttlMs: number
}

type Subscriber = (items: ToastItem[]) => void

let items: ToastItem[] = []
const subs = new Set<Subscriber>()

function emit() {
  for (const fn of subs) fn(items)
}

function uid() {
  // Stable enough for UI; avoids adding a dependency.
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function push(kind: ToastKind, message: string, opts?: { ttlMs?: number }) {
  const ttlMs = Math.max(1200, Math.min(12_000, opts?.ttlMs ?? 4000))
  const t: ToastItem = { id: uid(), kind, message, createdAt: Date.now(), ttlMs }
  items = [t, ...items].slice(0, 4)
  emit()
  const id = t.id
  window.setTimeout(() => {
    const next = items.filter((x) => x.id !== id)
    if (next.length === items.length) return
    items = next
    emit()
  }, ttlMs)
}

export const toast = {
  success: (message: string, opts?: { ttlMs?: number }) => push('success', message, opts),
  error: (message: string, opts?: { ttlMs?: number }) => push('error', message, opts),
  info: (message: string, opts?: { ttlMs?: number }) => push('info', message, opts),
}

export function subscribeToasts(fn: Subscriber) {
  subs.add(fn)
  fn(items)
  return () => {
    subs.delete(fn)
  }
}

