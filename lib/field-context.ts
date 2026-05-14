/**
 * Browser geolocation + weather snapshot for field sessions (Verb 1).
 * Weather is fetched via same-origin `/api/field-weather` (Open-Meteo on the server).
 */

import type { WorkSessionFieldContext, WorkSessionFieldWeather } from '@/lib/work-session-payload'

export type CaptureFieldContextErrorCode =
  | 'geo_denied'
  | 'geo_unavailable'
  | 'geo_timeout'
  | 'weather_failed'

export type CaptureFieldContextResult =
  | { ok: true; snapshot: WorkSessionFieldContext }
  | { ok: false; code: CaptureFieldContextErrorCode }

function mapGeoCode(code: number): CaptureFieldContextErrorCode {
  if (code === 1) return 'geo_denied'
  if (code === 2) return 'geo_unavailable'
  if (code === 3) return 'geo_timeout'
  return 'geo_unavailable'
}

async function fetchWeatherSnapshot(latitude: number, longitude: number): Promise<WorkSessionFieldWeather | null> {
  const u = new URL('/api/field-weather', window.location.origin)
  u.searchParams.set('latitude', String(latitude))
  u.searchParams.set('longitude', String(longitude))
  const res = await fetch(u.toString(), { credentials: 'same-origin' })
  if (!res.ok) return null
  const j = (await res.json()) as unknown
  if (!j || typeof j !== 'object') return null
  const o = j as Record<string, unknown>
  return {
    temperature_c: typeof o.temperature_c === 'number' ? o.temperature_c : null,
    weather_code: typeof o.weather_code === 'number' ? o.weather_code : null,
    wind_kmh: typeof o.wind_kmh === 'number' ? o.wind_kmh : null,
    relative_humidity_pct: typeof o.relative_humidity_pct === 'number' ? o.relative_humidity_pct : null,
  }
}

/**
 * Requests browser geolocation (user gesture recommended), then loads a compact current-weather slice.
 */
export async function captureFieldContext(): Promise<CaptureFieldContextResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return { ok: false, code: 'geo_unavailable' }
  }

  let pos: GeolocationPosition
  try {
    pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 120_000,
      })
    })
  } catch (err) {
    return captureFieldContextFromError(err)
  }

  const { coords } = pos
  const latitude = coords.latitude
  const longitude = coords.longitude
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, code: 'geo_unavailable' }
  }

  let weather: WorkSessionFieldWeather | null = null
  try {
    weather = await fetchWeatherSnapshot(latitude, longitude)
  } catch {
    return { ok: false, code: 'weather_failed' }
  }
  if (!weather) return { ok: false, code: 'weather_failed' }

  const snapshot: WorkSessionFieldContext = {
    captured_at: new Date().toISOString(),
    latitude,
    longitude,
    accuracy_m: coords.accuracy != null && Number.isFinite(coords.accuracy) ? coords.accuracy : null,
    weather,
  }
  return { ok: true, snapshot }
}

export function captureFieldContextFromError(err: unknown): CaptureFieldContextResult {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as GeolocationPositionError).code
    if (typeof code === 'number') return { ok: false, code: mapGeoCode(code) }
  }
  return { ok: false, code: 'geo_unavailable' }
}
