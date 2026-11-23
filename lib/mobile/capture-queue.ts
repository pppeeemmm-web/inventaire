'use client'

/**
 * Captures kept on the phone while there is no network (Journal design 2026-11-22 §3, Pem: « part of this
 * build »). A voice note or an inspiration photo that cannot be sent is stored here (IndexedDB, with its
 * audio / image), shown on today's page as « en attente d'envoi », and sent when the network returns.
 * Each capture carries a one-time id (`client_id`): the server makes it the record's id, so a resend after
 * a lost answer finds the record already there and never writes a second one.
 */

import { createVoiceNote } from '@/app/atelier/(portal)/notes/actions'
import { addInspirationPhoto } from '@/app/atelier/capture/inspiration-actions'

const DB_NAME = 'pem-capture-queue-v1'
const STORE = 'captures'
export const CAPTURE_QUEUE_EVENT = 'pem-capture-queue'

export type QueuedCapture = {
  /** The one-time id; also the voice note's / photo's id once saved. */
  id: string
  kind: 'voice' | 'photo'
  fields: Record<string, string>
  blob: Blob
  blobName: string
  /** When it was recorded / taken (ms). */
  createdAt: number
  tries: number
  /** Last refusal from the server (kept, shown; network failures are not stored). */
  error: string | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CAPTURE_QUEUE_EVENT))
}

export function newCaptureId(): string {
  return crypto.randomUUID()
}

export async function enqueueCapture(c: Omit<QueuedCapture, 'tries' | 'error'>): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...c, tries: 0, error: null } satisfies QueuedCapture))
  announce()
}

export async function listCaptures(): Promise<QueuedCapture[]> {
  if (typeof indexedDB === 'undefined') return []
  const rows = await tx<QueuedCapture[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedCapture[]>)
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export async function removeCapture(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
  announce()
}

/** A failure that means « no network / no answer » (try again later), not a refusal by the server. */
export function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /fetch|network|load failed|offline|timed? ?out|aborted/i.test(msg)
}

async function sendOne(c: QueuedCapture): Promise<{ ok: true; day?: string } | { error: string }> {
  const fd = new FormData()
  for (const [k, v] of Object.entries(c.fields)) fd.set(k, v)
  fd.set('client_id', c.id)
  if (c.kind === 'voice') {
    fd.set('audio', c.blob, c.blobName)
    const res = await createVoiceNote(fd)
    return 'error' in res ? { error: res.error } : { ok: true }
  }
  fd.set('photo', c.blob, c.blobName)
  const res = await addInspirationPhoto(fd)
  return 'error' in res ? { error: res.error } : { ok: true, day: res.day }
}

let flushing: Promise<number> | null = null

/**
 * Sends what waits, oldest first. Stops at the first network failure (still offline); a refusal is kept
 * on the capture (shown, never dropped silently). Returns how many were sent.
 */
export function flushCaptures(): Promise<number> {
  if (flushing) return flushing
  flushing = (async () => {
    let sent = 0
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0
      for (const c of await listCaptures()) {
        let res: Awaited<ReturnType<typeof sendOne>>
        try {
          res = await sendOne(c)
        // eslint-disable-next-line pem-i18n/no-silent-catch -- network → retried later; otherwise stored on the capture and shown
        } catch (err) {
          if (isNetworkFailure(err)) break
          res = { error: err instanceof Error ? err.message : String(err) }
        }
        if ('ok' in res) {
          await removeCapture(c.id)
          sent++
        } else {
          await tx('readwrite', (s) => s.put({ ...c, tries: c.tries + 1, error: res.error } satisfies QueuedCapture))
          announce()
        }
      }
    } finally {
      flushing = null
    }
    return sent
  })()
  return flushing
}
