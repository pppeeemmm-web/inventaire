/**
 * IndexedDB queue for work FormData (string fields only — no image blobs).
 * Flushed via AtelierOfflineFlush when online.
 */

const DB_NAME = 'pem-atelier-offline-v1'
const STORE = 'workSaveQueue'

export type OfflineWorkSaveRecord = {
  id: string
  /** Multi-value FormData serialized as string[][] per key */
  fields: Record<string, string[]>
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

export function formDataToStringRecord(fd: FormData): Record<string, string[]> {
  const o: Record<string, string[]> = {}
  for (const [k, v] of fd.entries()) {
    if (typeof v !== 'string') continue
    if (!o[k]) o[k] = []
    o[k].push(v)
  }
  return o
}

export function stringRecordToFormData(fields: Record<string, string[]>): FormData {
  const fd = new FormData()
  for (const [k, arr] of Object.entries(fields)) {
    for (const v of arr) fd.append(k, v)
  }
  return fd
}

export async function enqueueOfflineWorkSave(fields: Record<string, string[]>): Promise<void> {
  const db = await openDb()
  const id = `save-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const rec: OfflineWorkSaveRecord = { id, fields, createdAt: Date.now() }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(rec)
  })
  db.close()
}

export async function listOfflineWorkSaves(): Promise<OfflineWorkSaveRecord[]> {
  const db = await openDb()
  const rows = await new Promise<OfflineWorkSaveRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as OfflineWorkSaveRecord[]) ?? [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export async function removeOfflineWorkSave(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).delete(id)
  })
  db.close()
}

export function isLikelyOfflineSaveError(err: unknown): boolean {
  if (!navigator.onLine) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|networkerror|load failed/i.test(msg)
}
