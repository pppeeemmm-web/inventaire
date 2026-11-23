// Client-safe: a photo's own data (time taken, phone, lens, place…) read from the original file's EXIF, in the
// shape the door `addInspirationPhoto` keeps (same mapping as `trayMetaForDoor` in components/journal/PcTray.tsx).
// exifr is loaded only when a photo is pasted or dropped. Never throws: no EXIF → `{ file_name }`.

const pad = (n: number) => String(n).padStart(2, '0')

function wallTime(v: unknown): string | undefined {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return undefined
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`
  }
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(typeof v === 'string' ? v : '')
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : undefined)

export async function readPhotoMeta(file: Blob, name: string): Promise<Record<string, unknown> | null> {
  const out: Record<string, unknown> = { file_name: str(name) }
  try {
    const exifr = (await import('exifr')).default
    const x = (await exifr.parse(file, { gps: true })) as Record<string, unknown> | undefined
    if (x) {
      const lat = num(x.latitude)
      const lon = num(x.longitude)
      const alt = num(x.GPSAltitude)
      Object.assign(out, {
        taken_at: wallTime(x.DateTimeOriginal),
        make: str(x.Make),
        model: str(x.Model),
        lens: str(x.LensModel),
        f_number: num(x.FNumber),
        exposure: num(x.ExposureTime),
        iso: num(x.ISO),
        focal: num(x.FocalLength),
        width: num(x.ExifImageWidth),
        height: num(x.ExifImageHeight),
        gps: lat !== undefined && lon !== undefined ? { lat, lon, ...(alt !== undefined ? { alt } : {}) } : undefined,
      })
    }
    // eslint-disable-next-line pem-i18n/no-silent-catch -- no readable EXIF is normal (PNG, screenshot): the photo is kept without it
  } catch {
    /* keep file_name only */
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
  return Object.keys(out).length ? out : null
}
