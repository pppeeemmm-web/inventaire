/** Shared Nominatim lookup (server-only). Queue + cache to respect ~1 req/s policy. */

const MIN_INTERVAL_MS = 1200

const UA =
  process.env.NOMINATIM_USER_AGENT ??
  'PEM-ArtDB/1.0 (contact: set NOMINATIM_USER_AGENT in env per https://operations.osmfoundation.org/policies/nominatim/)'

const successCache = new Map<string, { lat: number; lng: number }>()

let queueTail: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = queueTail.then(() => fn())
  queueTail = p.then(
    () => {},
    () => {},
  )
  return p
}

let lastRequestStart = 0

async function paceBeforeRequest(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestStart))
  if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait))
  lastRequestStart = Date.now()
}

export async function lookupGeocode(
  city: string,
  country: string,
): Promise<{ lat: number; lng: number } | null> {
  const key = `${city}|${country}`.toLowerCase().trim()
  if (!key || key === '|') return null

  const hit = successCache.get(key)
  if (hit) return hit

  return enqueue(async () => {
    const again = successCache.get(key)
    if (again) return again

    await paceBeforeRequest()

    const q = [city, country].filter(Boolean).join(', ')
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        cache: 'no-store',
      })
      if (!res.ok) return null

      const data = (await res.json()) as Array<{ lat: string; lon: string } | undefined>
      const first = data?.[0]
      if (!first) return null

      const lat = parseFloat(first.lat)
      const lng = parseFloat(first.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

      const out = { lat, lng }
      successCache.set(key, out)
      return out
    } catch {
      return null
    }
  })
}
