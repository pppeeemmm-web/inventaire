/** Œuvre contact-disclosure level: 0 public, 1 masked, 2 private (DB + UI). */
export type AnonymityLevel = 0 | 1 | 2

/** Coerce PostgREST / form values to a valid level (avoids string "2" breaking === checks). */
export function normalizeAnonymityLevel(value: unknown): AnonymityLevel {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN
  if (n === 1) return 1
  if (n === 2) return 2
  return 0
}
