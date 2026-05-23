/**
 * IndexedDB queue for work FormData (strings + image blobs).
 * Flushed via AtelierOfflineFlush when online.
 */

const DB_NAME = 'pem-atelier-offline-v2'
const STORE_QUEUE = 'workSaveQueue'
const STORE_BLOBS = 'workSaveBlobs'

export type OfflineFieldEntry =
  | { kind: 'string'; value: string }
  | { kind: 'blob'; blobKey: string; fileName: string; mimeType: string }

export type OfflineWorkSaveRecord = {
  id: string
  fields: Record<string, OfflineFieldEntry[]>
  createdAt: number
}

type LegacyOfflineWorkSaveRecord = {
  id: string
  fields: Record<string, string[]>
  createdAt: number
}

type BlobRow = {
  key: string
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' })
      }
    }
  })
}

function isLegacyRecord(row: unknown): row is LegacyOfflineWorkSaveRecord {
  if (!row || typeof row !== 'object') return false
  const fields = (row as LegacyOfflineWorkSaveRecord).fields
  if (!fields || typeof fields !== 'object') return false
  for (const v of Object.values(fields)) {
    if (!Array.isArray(v)) return false
    if (v.length > 0 && typeof v[0] === 'string') return true
  }
  return false
}

function legacyToFormData(row: LegacyOfflineWorkSaveRecord): FormData {
  const fd = new FormData()
  for (const [k, arr] of Object.entries(row.fields)) {
    for (const v of arr) fd.append(k, v)
  }
  return fd
}

export async function formDataToOfflineFields(fd: FormData): Promise<{
  fields: Record<string, OfflineFieldEntry[]>
  blobs: BlobRow[]
}> {
  const fields: Record<string, OfflineFieldEntry[]> = {}
  const blobs: BlobRow[] = []
  let blobIndex = 0

  for (const [key, value] of fd.entries()) {
    if (value instanceof Blob) {
      const blobKey = `blob-${blobIndex++}`
      const fileName = value instanceof File ? value.name : `${key}.bin`
      const mimeType = value.type || 'application/octet-stream'
      blobs.push({ key: blobKey, blob: value })
      if (!fields[key]) fields[key] = []
      fields[key].push({ kind: 'blob', blobKey, fileName, mimeType })
    } else if (typeof value === 'string') {
      if (!fields[key]) fields[key] = []
      fields[key].push({ kind: 'string', value })
    }
  }

  return { fields, blobs }
}

export async function offlineFieldsToFormData(
  fields: Record<string, OfflineFieldEntry[]>,
): Promise<FormData> {
  const db = await openDb()
  const fd = new FormData()

  const blobRows = await new Promise<Map<string, Blob>>((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly')
    const req = tx.objectStore(STORE_BLOBS).getAll()
    req.onsuccess = () => {
      const map = new Map<string, Blob>()
      for (const row of (req.result as BlobRow[]) ?? []) {
        map.set(row.key, row.blob)
      }
      resolve(map)
    }
    req.onerror = () => reject(req.error)
  })

  for (const [key, entries] of Object.entries(fields)) {
    for (const entry of entries) {
      if (entry.kind === 'string') {
        fd.append(key, entry.value)
      } else {
        const blob = blobRows.get(entry.blobKey)
        if (!blob) continue
        fd.append(key, blob, entry.fileName)
      }
    }
  }

  db.close()
  return fd
}

/** @deprecated Use formDataToOfflineFields — kept for call-site migration. */
export function formDataToStringRecord(fd: FormData): Record<string, string[]> {
  const o: Record<string, string[]> = {}
  for (const [k, v] of fd.entries()) {
    if (typeof v !== 'string') continue
    if (!o[k]) o[k] = []
    o[k].push(v)
  }
  return o
}

export async function enqueueOfflineWorkSaveFromFormData(fd: FormData): Promise<void> {
  const db = await openDb()
  const id = `save-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const { fields, blobs } = await formDataToOfflineFields(fd)
  const rec: OfflineWorkSaveRecord = { id, fields, createdAt: Date.now() }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE, STORE_BLOBS], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE_QUEUE).put(rec)
    for (const row of blobs) {
      tx.objectStore(STORE_BLOBS).put(row)
    }
  })
  db.close()
}

export async function enqueueOfflineWorkSave(fields: Record<string, string[]>): Promise<void> {
  const fd = new FormData()
  for (const [k, arr] of Object.entries(fields)) {
    for (const v of arr) fd.append(k, v)
  }
  await enqueueOfflineWorkSaveFromFormData(fd)
}

export async function listOfflineWorkSaves(): Promise<OfflineWorkSaveRecord[]> {
  const db = await openDb()
  const rows = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly')
    const req = tx.objectStore(STORE_QUEUE).getAll()
    req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
    req.onerror = () => reject(req.error)
  })
  db.close()

  const out: OfflineWorkSaveRecord[] = []
  for (const row of rows) {
    if (isLegacyRecord(row)) {
      out.push({
        id: row.id,
        createdAt: row.createdAt,
        fields: Object.fromEntries(
          Object.entries(row.fields).map(([k, arr]) => [
            k,
            arr.map((v) => ({ kind: 'string' as const, value: v })),
          ]),
        ),
      })
    } else {
      out.push(row as OfflineWorkSaveRecord)
    }
  }
  return out.sort((a, b) => a.createdAt - b.createdAt)
}

export async function offlineRecordToFormData(
  record: OfflineWorkSaveRecord | LegacyOfflineWorkSaveRecord,
): Promise<FormData> {
  if (isLegacyRecord(record)) return legacyToFormData(record)
  return offlineFieldsToFormData(record.fields)
}

export async function removeOfflineWorkSave(id: string): Promise<void> {
  const db = await openDb()
  const record = await new Promise<OfflineWorkSaveRecord | LegacyOfflineWorkSaveRecord | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly')
      const req = tx.objectStore(STORE_QUEUE).get(id)
      req.onsuccess = () => resolve(req.result as OfflineWorkSaveRecord | LegacyOfflineWorkSaveRecord | undefined)
      req.onerror = () => reject(req.error)
    },
  )

  const blobKeys = new Set<string>()
  if (record && !isLegacyRecord(record)) {
    for (const entries of Object.values(record.fields)) {
      for (const e of entries) {
        if (e.kind === 'blob') blobKeys.add(e.blobKey)
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE, STORE_BLOBS], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE_QUEUE).delete(id)
    for (const key of blobKeys) {
      tx.objectStore(STORE_BLOBS).delete(key)
    }
  })
  db.close()
}

export function isLikelyOfflineSaveError(err: unknown): boolean {
  if (!navigator.onLine) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|networkerror|load failed/i.test(msg)
}
