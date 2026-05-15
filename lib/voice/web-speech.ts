'use client'

/**
 * Browser capture helpers for Verb 2 — Web Speech API + MediaRecorder.
 * SpeechRecognition is vendor-prefixed on some engines; types are narrowed locally
 * so `tsc` stays strict without relying on optional DOM lib entries.
 */

type SpeechRecResult = { isFinal: boolean; 0: { transcript: string } }

type SpeechRecResultList = {
  length: number
  [index: number]: SpeechRecResult
}

type SpeechRecEvent = {
  resultIndex: number
  results: SpeechRecResultList
}

type SpeechRecErrorEvent = {
  error: string
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((ev: SpeechRecEvent) => void) | null
  onerror: ((ev: SpeechRecErrorEvent) => void) | null
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function pickMediaRecorderMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      /* ignore */
    }
  }
  return 'audio/webm'
}

export type LiveDictationHandlers = {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError?: (message: string) => void
}

/**
 * Starts continuous dictation in the given BCP-47 `lang` (e.g. fr-FR, en-GB).
 * Returns `stop` to end the session (no-op if SpeechRecognition unavailable).
 */
export function startLiveDictation(lang: string, handlers: LiveDictationHandlers): { stop: () => void } {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    handlers.onError?.('unsupported')
    return { stop: () => {} }
  }
  const rec = new Ctor()
  rec.lang = lang
  rec.interimResults = true
  rec.continuous = true
  rec.onresult = (ev: SpeechRecEvent) => {
    let interim = ''
    let finalChunk = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i]
      const tx = r[0]?.transcript ?? ''
      if (r.isFinal) finalChunk += tx
      else interim += tx
    }
    if (interim) handlers.onInterim(interim)
    if (finalChunk) handlers.onFinal(finalChunk)
  }
  rec.onerror = (ev: SpeechRecErrorEvent) => {
    if (ev.error === 'aborted' || ev.error === 'no-speech') return
    handlers.onError?.(ev.error)
  }
  try {
    rec.start()
  } catch {
    handlers.onError?.('start-failed')
  }
  return {
    stop: () => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    },
  }
}

export type RecorderSession = {
  stop: () => Promise<{ blob: Blob; mime: string }>
}

/**
 * Records microphone input until `stop()` is called. Caller should request mic permission first.
 */
export async function startMicRecorder(): Promise<RecorderSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mime = pickMediaRecorderMime()
  const rec = new MediaRecorder(stream, { mimeType: mime })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  rec.start(250)
  return {
    stop: () =>
      new Promise<{ blob: Blob; mime: string }>((resolve, reject) => {
        rec.onerror = () => {
          stream.getTracks().forEach((t) => t.stop())
          reject(new Error('MediaRecorder error'))
        }
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          const blob = new Blob(chunks, { type: mime })
          resolve({ blob, mime })
        }
        try {
          rec.stop()
        } catch (e) {
          stream.getTracks().forEach((t) => t.stop())
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      }),
  }
}
