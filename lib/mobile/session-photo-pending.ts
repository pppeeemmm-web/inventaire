/** Local pending queue for session photo capture (review before upload). */

export const SESSION_PHOTO_PENDING_MAX = 24

export type SessionPhotoPending = {
  id: string
  file: File
  preview: string
}

export function fileListToPending(
  files: FileList | File[] | null,
  existingCount: number,
): SessionPhotoPending[] {
  if (!files) return []
  // iOS hands back an empty `type` for some library/Files picks (AVIF in particular).
  // Dropping those silently lost the photo; the server validates by magic bytes anyway.
  const list = Array.from(files).filter((f) => !f.type || f.type.startsWith('image/'))
  const room = Math.max(0, SESSION_PHOTO_PENDING_MAX - existingCount)
  const slice = list.slice(0, room)
  return slice.map((file) => ({
    id: crypto.randomUUID(),
    file,
    preview: URL.createObjectURL(file),
  }))
}

export function revokePending(pending: SessionPhotoPending[]) {
  for (const p of pending) URL.revokeObjectURL(p.preview)
}

export function removePendingById(
  pending: SessionPhotoPending[],
  id: string,
): SessionPhotoPending[] {
  const hit = pending.find((p) => p.id === id)
  if (hit) URL.revokeObjectURL(hit.preview)
  return pending.filter((p) => p.id !== id)
}
