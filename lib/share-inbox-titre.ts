import type { ShareInboxPayloadV1 } from '@/lib/share-inbox-types'

const MAX_TITRE_LEN = 200

/** Prefer share title; else derive a human titre from the first image filename. */
export function titreSeedFromSharePayload(
  payload: ShareInboxPayloadV1,
  fileIndex = 0,
): string {
  const fromTitle = payload.title?.trim()
  if (fromTitle) return fromTitle.slice(0, MAX_TITRE_LEN)

  const file = payload.files[fileIndex]
  if (!file?.name) return ''

  return titreSeedFromFilename(file.name)
}

export function titreSeedFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim()
  if (!base) return ''

  const spaced = base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!spaced) return ''

  return spaced
    .split(' ')
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
    .slice(0, MAX_TITRE_LEN)
}

export function shareImageFiles(payload: ShareInboxPayloadV1) {
  return payload.files.filter((f) => f.mime.startsWith('image/'))
}
