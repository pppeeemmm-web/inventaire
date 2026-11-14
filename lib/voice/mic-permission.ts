'use client'

/**
 * Microphone permission, as far as a web page can see it.
 *
 * The browser decides — no code can make the mic "always allowed". What we can do: ask through
 * `getUserMedia` right after a tap (the voice-note button), read the state where the
 * Permissions API exposes it, and explain how to undo a refusal. On iPhone the answer is kept
 * per site; Safari and a home-screen web app may still ask again after a restart.
 */

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

export async function queryMicPermission(): Promise<MicPermissionState> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') return status.state
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Why the recorder could not start, from the `getUserMedia` / `MediaRecorder` error. */
export type MicFailure = 'denied' | 'no-device' | 'busy' | 'insecure' | 'unsupported' | 'other'

export function classifyMicError(e: unknown): MicFailure {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure'
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-device'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy'
  if (name === 'NotSupportedError' || name === 'TypeError') return 'unsupported'
  return 'other'
}

/** iPhone / iPad (iPadOS reports as a Mac with touch). */
export function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true
  return /Macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1
}

/** Remembers that the mic was granted once on this device, for when the Permissions API is silent. */
const GRANTED_ONCE_KEY = 'pem.mic.granted-once.v1'

export function markMicGrantedOnce(): void {
  try {
    window.localStorage.setItem(GRANTED_ONCE_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function micGrantedBefore(): boolean {
  try {
    return window.localStorage.getItem(GRANTED_ONCE_KEY) === '1'
  } catch {
    return false
  }
}
