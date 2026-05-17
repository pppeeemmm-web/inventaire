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

export type WorkSessionItemMode = 'existing' | 'new'
export type WorkSessionItemStatus = 'draft' | 'applied' | 'rejected'

export interface WorkSessionItem {
  id: string
  mode: WorkSessionItemMode
  oeuvre_id?: number | null
  oeuvre_title?: string | null
  notes?: string
  title_hint?: string
  width_cm?: string
  height_cm?: string
  shots: WorkSessionShot[]
  status: WorkSessionItemStatus
  created_at?: string
  updated_at?: string
  applied_at?: string
  applied_by?: string
  applied_shot_count?: number
  reject_reason?: string
}

export interface WorkSessionPayload {
  notes?: string
  title_hint?: string
  width_cm?: string
  height_cm?: string
  shots: WorkSessionShot[]
  items: WorkSessionItem[]
  reject_reason?: string
  field_context?: WorkSessionFieldContext
  applied_at?: string
  applied_by?: string
}

export function emptyWorkSessionPayload(): WorkSessionPayload {
  return { shots: [], items: [] }
}

export function createWorkSessionItem(mode: WorkSessionItemMode = 'existing'): WorkSessionItem {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    mode,
    shots: [],
    status: 'draft',
    created_at: now,
    updated_at: now,
  }
}

export function countWorkSessionShots(payload: WorkSessionPayload): number {
  return payload.shots.length + payload.items.reduce((sum, item) => sum + item.shots.length, 0)
}

export function countWorkSessionItems(payload: WorkSessionPayload): number {
  return payload.items.length || (payload.shots.length > 0 ? 1 : 0)
}

export function listWorkSessionLinkedOeuvreIds(payload: WorkSessionPayload): number[] {
  return Array.from(
    new Set(
      payload.items
        .map((item) => item.oeuvre_id)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    ),
  )
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

function isItemMode(x: unknown): x is WorkSessionItemMode {
  return x === 'existing' || x === 'new'
}

function isItemStatus(x: unknown): x is WorkSessionItemStatus {
  return x === 'draft' || x === 'applied' || x === 'rejected'
}

function parseWorkSessionItem(raw: unknown): WorkSessionItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  const mode = isItemMode(o.mode) ? o.mode : 'existing'
  const shots = Array.isArray(o.shots) ? o.shots.filter(isShot) : []
  const out: WorkSessionItem = {
    id: o.id,
    mode,
    shots,
    status: isItemStatus(o.status) ? o.status : 'draft',
  }
  if (typeof o.oeuvre_id === 'number' && o.oeuvre_id > 0) out.oeuvre_id = o.oeuvre_id
  else if (o.oeuvre_id === null) out.oeuvre_id = null
  if (typeof o.oeuvre_title === 'string') out.oeuvre_title = o.oeuvre_title
  if (typeof o.notes === 'string') out.notes = o.notes
  if (typeof o.title_hint === 'string') out.title_hint = o.title_hint
  if (typeof o.width_cm === 'string') out.width_cm = o.width_cm
  if (typeof o.height_cm === 'string') out.height_cm = o.height_cm
  if (typeof o.created_at === 'string') out.created_at = o.created_at
  if (typeof o.updated_at === 'string') out.updated_at = o.updated_at
  if (typeof o.applied_at === 'string') out.applied_at = o.applied_at
  if (typeof o.applied_by === 'string') out.applied_by = o.applied_by
  if (typeof o.applied_shot_count === 'number') out.applied_shot_count = o.applied_shot_count
  if (typeof o.reject_reason === 'string') out.reject_reason = o.reject_reason
  return out
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
  if (!raw || typeof raw !== 'object') return { shots: [], items: [] }
  const o = raw as Record<string, unknown>
  const shots = Array.isArray(o.shots) ? o.shots.filter(isShot) : []
  const items = Array.isArray(o.items)
    ? o.items.map(parseWorkSessionItem).filter((item): item is WorkSessionItem => item != null)
    : []
  const out: WorkSessionPayload = { shots, items }
  if (typeof o.notes === 'string') out.notes = o.notes
  if (typeof o.title_hint === 'string') out.title_hint = o.title_hint
  if (typeof o.width_cm === 'string') out.width_cm = o.width_cm
  if (typeof o.height_cm === 'string') out.height_cm = o.height_cm
  if (typeof o.reject_reason === 'string') out.reject_reason = o.reject_reason
  if (isFieldContext(o.field_context)) out.field_context = o.field_context
  if (typeof o.applied_at === 'string') out.applied_at = o.applied_at
  if (typeof o.applied_by === 'string') out.applied_by = o.applied_by
  return out
}
