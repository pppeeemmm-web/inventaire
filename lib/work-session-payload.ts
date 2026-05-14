/** JSON stored in `work_session.payload` (Verb 1 field sessions). */

export interface WorkSessionFieldWeather {
  temperature_c: number | null
  weather_code: number | null
  wind_kmh: number | null
  relative_humidity_pct: number | null
}

export interface WorkSessionFieldContext {
  captured_at: string
  latitude: number
  longitude: number
  accuracy_m?: number | null
  weather: WorkSessionFieldWeather
}

export interface WorkSessionShot {
  r2_key: string
  thumb_r2_key: string | null
  /** SHA-256 hex (64) of raw upload bytes before AVIF normalize. */
  sha256: string
  size_bytes: number
}

export interface WorkSessionPayload {
  notes?: string
  title_hint?: string
  width_cm?: string
  height_cm?: string
  shots: WorkSessionShot[]
  reject_reason?: string
  field_context?: WorkSessionFieldContext
}

export function emptyWorkSessionPayload(): WorkSessionPayload {
  return { shots: [] }
}

function isShot(x: unknown): x is WorkSessionShot {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  return (
    typeof s.r2_key === 'string'
    && typeof s.sha256 === 'string'
    && typeof s.size_bytes === 'number'
    && (s.thumb_r2_key === null || s.thumb_r2_key === undefined || typeof s.thumb_r2_key === 'string')
  )
}

function isFieldWeather(x: unknown): x is WorkSessionFieldWeather {
  if (!x || typeof x !== 'object') return false
  const w = x as Record<string, unknown>
  return (
    (w.temperature_c === null || typeof w.temperature_c === 'number')
    && (w.weather_code === null || typeof w.weather_code === 'number')
    && (w.wind_kmh === null || typeof w.wind_kmh === 'number')
    && (w.relative_humidity_pct === null || typeof w.relative_humidity_pct === 'number')
  )
}

function isFieldContext(x: unknown): x is WorkSessionFieldContext {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.captured_at !== 'string') return false
  if (typeof o.latitude !== 'number' || typeof o.longitude !== 'number') return false
  if (o.accuracy_m != null && typeof o.accuracy_m !== 'number') return false
  if (!isFieldWeather(o.weather)) return false
  return true
}

export function parseWorkSessionPayload(raw: unknown): WorkSessionPayload {
  if (!raw || typeof raw !== 'object') return { shots: [] }
  const o = raw as Record<string, unknown>
  const shots = Array.isArray(o.shots) ? o.shots.filter(isShot) : []
  const out: WorkSessionPayload = { shots }
  if (typeof o.notes === 'string') out.notes = o.notes
  if (typeof o.title_hint === 'string') out.title_hint = o.title_hint
  if (typeof o.width_cm === 'string') out.width_cm = o.width_cm
  if (typeof o.height_cm === 'string') out.height_cm = o.height_cm
  if (typeof o.reject_reason === 'string') out.reject_reason = o.reject_reason
  if (isFieldContext(o.field_context)) out.field_context = o.field_context
  return out
}
