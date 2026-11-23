/**
 * The Journal stream switch (design 2026-11-22). The stream is the default (Pem 2026-11-23 « Make it default »,
 * after live speed: desk 2.5–2.7 s vs 4.1–4.7 s, phone 1.0 s vs 1.3 s); `?stream=0` stores `0` here and keeps the
 * old day screens, `?stream=1` goes back to the stream.
 */
export const JOURNAL_STREAM_COOKIE = 'journal_stream'

/** The stream shows unless this browser chose the old screens (`?stream=0` now, or stored earlier). */
export function streamChosen(param: string | null | undefined, cookie: string | null | undefined): boolean {
  if (param === '1') return true
  if (param === '0') return false
  return cookie !== '0'
}
