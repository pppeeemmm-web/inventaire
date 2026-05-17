import { createServiceClient } from '@/lib/supabase/server'

export type StorageObjectStatus = 'present' | 'deleted' | 'recycled' | 'missing'
export type StorageObjectClassification =
  | 'linked'
  | 'unidentified'
  | 'transient'
  | 'recycle'
  | 'backup'
  | 'ignored'

export type StorageObjectLinkedRef = {
  table: string
  column: string
  row_id?: string | number | null
  label?: string | null
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type RecordStorageObjectInput = {
  bucket: string
  objectKey: string
  sizeBytes?: number | null
  contentType?: string | null
  etag?: string | null
  lastModifiedAt?: string | Date | null
  source?: string
  status?: StorageObjectStatus
  classification?: StorageObjectClassification
  linkedRefs?: StorageObjectLinkedRef[]
  uploadedBy?: string | null
  metadata?: Record<string, JsonValue>
}

type MarkStorageObjectInput = {
  bucket: string
  objectKey: string
  status: Exclude<StorageObjectStatus, 'present'>
  metadata?: Record<string, JsonValue>
}

function normalizeTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

/**
 * Best-effort object inventory. Uploads/deletes should not fail just because the
 * optional ledger migration has not been applied yet.
 */
export async function recordStorageObject(input: RecordStorageObjectInput): Promise<void> {
  try {
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    const { error } = await supabase.from('storage_object_ledger').upsert(
      {
        provider: 'r2',
        bucket: input.bucket,
        object_key: input.objectKey,
        size_bytes: input.sizeBytes ?? null,
        content_type: input.contentType ?? null,
        etag: input.etag ?? null,
        last_modified_at: normalizeTimestamp(input.lastModifiedAt),
        last_seen_at: now,
        status: input.status ?? 'present',
        source: input.source ?? 'app',
        classification: input.classification ?? 'unidentified',
        linked_refs: input.linkedRefs ?? [],
        uploaded_by: input.uploadedBy ?? null,
        metadata: input.metadata ?? {},
      },
      { onConflict: 'bucket,object_key' },
    )
    if (error) console.error('[storage-ledger] record failed:', error.message)
  } catch (e) {
    console.error('[storage-ledger] record failed:', e)
  }
}

export async function markStorageObject(input: MarkStorageObjectInput): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('storage_object_ledger')
      .update({
        status: input.status,
        last_seen_at: new Date().toISOString(),
        metadata: input.metadata ?? {},
      })
      .eq('bucket', input.bucket)
      .eq('object_key', input.objectKey)
    if (error) console.error('[storage-ledger] mark failed:', error.message)
  } catch (e) {
    console.error('[storage-ledger] mark failed:', e)
  }
}
