/** Helpers for selection full-size image ZIP export. */

export const WORK_IMAGE_ZIP_MAX_IDS = 100

export type WorkImageZipEntry = {
  oeuvreId: number
  titre: string | null
  storageKey: string
  seqNo?: number | null
}

export function sanitizeZipBaseName(titre: string | null, oeuvreId: number): string {
  const raw = (titre?.trim() || `oeuvre-${oeuvreId}`)
    .replace(/[^\w.\- ()[\]]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return (raw || `oeuvre-${oeuvreId}`).slice(0, 80)
}

/** ZIP member name = canonical R2 object leaf (e.g. W_2011_01_a1b2c3d4.avif), same as browser save URL. */
export function zipEntryName(entry: WorkImageZipEntry): string {
  const leaf = entry.storageKey.split(/[/\\]/).filter(Boolean).pop()?.trim() ?? ''
  if (!leaf || leaf.includes('..')) {
    const fallback = sanitizeZipBaseName(entry.titre, entry.oeuvreId)
    const ext = entry.storageKey.match(/\.[^./\\]+$/)?.[0]?.toLowerCase() ?? '.avif'
    return `W_${entry.oeuvreId}_00_${fallback}${ext}`
  }
  return leaf
}

export function dedupeZipEntryNames(entries: WorkImageZipEntry[]): { entry: WorkImageZipEntry; name: string }[] {
  const seen = new Map<string, number>()
  return entries.map((entry) => {
    const base = zipEntryName(entry)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    if (n === 0) return { entry, name: base }
    const dot = base.lastIndexOf('.')
    const stem = dot >= 0 ? base.slice(0, dot) : base
    const ext = dot >= 0 ? base.slice(dot) : ''
    return { entry, name: `${stem}_v${n + 1}${ext}` }
  })
}
