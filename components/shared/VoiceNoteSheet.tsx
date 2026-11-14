'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useUnsavedActionGuard } from '@/hooks/useUnsavedActionGuard'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { createVoiceNote, updateVoiceNoteDetails } from '@/app/atelier/(portal)/notes/actions'
import {
  VOICE_NOTE_BUCKETS,
  VOICE_NOTE_KINDS,
  formatVoiceDuration,
  type VoiceNoteBucket,
  type VoiceNoteKind,
} from '@/lib/voice-note-domain'
import { getLiveDictationAvailability, startLiveDictation, startMicRecorder, type RecorderSession } from '@/lib/voice/web-speech'
import {
  classifyMicError,
  isAppleMobile,
  markMicGrantedOnce,
  micGrantedBefore,
  queryMicPermission,
  type MicFailure,
} from '@/lib/voice/mic-permission'
import { toast } from '@/lib/ui/toast'
import { PEM_Z_INDEX } from '@/components/shared/BottomStack'

/**
 * Ring B — voice note (Verb 2). Record first (Pem 2026-11-14): opening the sheet starts the
 * recorder at once; Stop saves the audio straight away (date/time = when the recording
 * started); title, kind, work, text and follow-up are optional and added after. Every outcome
 * is shown: live timer + level + bytes while recording, « Saved · 0:42 » with a replay, or a
 * red « Not saved » with Retry while the audio is still held in memory.
 */

type NextActionKey = 'today' | 'tomorrow' | 'week' | 'waiting' | 'none'
type Phase = 'starting' | 'recording' | 'saving' | 'saved' | 'failed' | 'blocked' | 'text'
type StopReason = 'user' | 'hidden' | 'size' | 'closed'

const DRAFT_KEY = 'pem.voice-note.draft.v1'
const NEXT_ACTIONS: NextActionKey[] = ['today', 'tomorrow', 'week', 'waiting', 'none']
/** Encoder target (~240 KB/min of Opus); keeps a long note under the upload cap. */
const AUDIO_BITS_PER_SECOND = 32_000
/** A Server Action body is capped at 4.5 MB on Vercel; stop and save before that. */
const MAX_UPLOAD_BYTES = 4_200_000
const LEVEL_BARS = 24

type Details = {
  subject: string
  kind: VoiceNoteKind
  bucket: VoiceNoteBucket
  oeuvreId: string
  transcript: string
  nextAction: NextActionKey
}

const emptyDetails = (oeuvreId: string): Details => ({
  subject: '',
  kind: 'memo',
  bucket: 'general',
  oeuvreId,
  transcript: '',
  nextAction: 'none',
})

type Pending = { blob: Blob; mime: string; durationMs: number; recordedAt: Date }
type SavedNote = { id: string; durationMs: number | null; recordedAt: Date }

function nextActionLabelKey(k: NextActionKey): DictKey {
  switch (k) {
    case 'today':
      return 'voice_next_action_today'
    case 'tomorrow':
      return 'voice_next_action_tomorrow'
    case 'week':
      return 'voice_next_action_week'
    case 'waiting':
      return 'voice_next_action_waiting'
    case 'none':
      return 'voice_next_action_none'
  }
}

function dueForNextAction(k: NextActionKey): string | null {
  const d = new Date()
  if (k === 'none') return null
  if (k === 'today') d.setHours(d.getHours() + 2)
  if (k === 'tomorrow') {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }
  if (k === 'week' || k === 'waiting') {
    d.setDate(d.getDate() + 7)
    d.setHours(9, 0, 0, 0)
  }
  return d.toISOString()
}

/** Local calendar day `YYYY-MM-DD` (reminders are stored as a DATE, not an instant). */
function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function kindKey(k: VoiceNoteKind): DictKey {
  switch (k) {
    case 'memo':
      return 'voice_kind_memo'
    case 'dictation':
      return 'voice_kind_dictation'
    case 'meeting':
      return 'voice_kind_meeting'
    case 'field':
      return 'voice_kind_field'
  }
}

function bucketKey(b: VoiceNoteBucket): DictKey {
  switch (b) {
    case 'terrain':
      return 'voice_bucket_terrain'
    case 'studio':
      return 'voice_bucket_studio'
    case 'commercial':
      return 'voice_bucket_commercial'
    case 'general':
      return 'voice_bucket_general'
  }
}

function micFailureKey(f: MicFailure): DictKey {
  switch (f) {
    case 'denied':
      return isAppleMobile() ? 'vc_mic_denied_ios' : 'vc_mic_denied_other'
    case 'no-device':
      return 'vc_mic_no_device'
    case 'busy':
      return 'vc_mic_busy'
    case 'insecure':
      return 'vc_mic_insecure'
    case 'unsupported':
      return 'vc_mic_unsupported'
    case 'other':
      return 'vc_mic_other'
  }
}

/** Phones/tablets: the page is frozen soon after it goes to the background. */
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return isAppleMobile() || window.matchMedia?.('(pointer: coarse)').matches === true
}

type WakeLockLike = { release: () => Promise<void> }

/** Sticky-bar buttons: share the width and wrap long labels (360 px phones). */
const footBtn = (grow: number) => ({
  minHeight: 48,
  flex: `${grow} 1 0`,
  minWidth: 0,
  whiteSpace: 'normal' as const,
  lineHeight: 1.2,
})

function detailsFormData(d: Details, followUpFallback: string): FormData {
  const fd = new FormData()
  fd.append('kind', d.kind)
  fd.append('bucket', d.bucket)
  fd.append('subject', d.subject.trim())
  fd.append('transcript', d.transcript)
  fd.append('oeuvre_id', d.oeuvreId.trim())
  const due = dueForNextAction(d.nextAction)
  if (due) {
    fd.append('follow_up_due', due)
    fd.append('follow_up_date', localDateKey(new Date(due)))
    fd.append('follow_up_label', d.subject.trim() || followUpFallback)
  }
  return fd
}

export type VoiceNoteSheetProps = {
  open: boolean
  onClose: () => void
  /** Optional œuvre labels for link picker (Atelier); Hub passes `[]`. */
  oeuvreOptions?: { OeuvreID: number; Titre: string | null }[]
  defaultOeuvreId?: number | null
  onSaved?: () => void
}

export function VoiceNoteSheet({
  open,
  onClose,
  oeuvreOptions = [],
  defaultOeuvreId = null,
  onSaved,
}: VoiceNoteSheetProps) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const speechLang = locale
  const defaultWork = defaultOeuvreId != null && defaultOeuvreId > 0 ? String(defaultOeuvreId) : ''

  const [phase, setPhase] = useState<Phase>('starting')
  const [micFailure, setMicFailure] = useState<MicFailure | null>(null)
  const [permHint, setPermHint] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [bytes, setBytes] = useState(0)
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_BARS).fill(0))
  const [stopReason, setStopReason] = useState<StopReason>('user')
  const [failKey, setFailKey] = useState<DictKey | null>(null)
  const [hasPending, setHasPending] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedNote | null>(null)
  const [details, setDetails] = useState<Details>(() => emptyDetails(defaultWork))
  const [baseline, setBaseline] = useState<Details>(() => emptyDetails(defaultWork))
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmLose, setConfirmLose] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [interim, setInterim] = useState('')
  const [dictationAvailability, setDictationAvailability] =
    useState<ReturnType<typeof getLiveDictationAvailability>>('unsupported')

  const phaseRef = useRef<Phase>('starting')
  phaseRef.current = phase
  const genRef = useRef(0)
  const sessionRef = useRef<RecorderSession | null>(null)
  const startedAtRef = useRef<{ ms: number; at: Date } | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const tickRef = useRef<number | null>(null)
  const levelTimerRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const wakeLockRef = useRef<WakeLockLike | null>(null)
  const sizeStopRef = useRef(false)
  const stopAndSaveRef = useRef<(reason: StopReason) => void>(() => {})
  const dictStopRef = useRef<(() => void) | null>(null)
  const interimRef = useRef('')
  const primaryRef = useRef<HTMLButtonElement>(null)
  const detailsRef = useRef(details)
  detailsRef.current = details

  const dirty = useMemo(() => JSON.stringify(details) !== JSON.stringify(baseline), [details, baseline])

  // ── Recorder plumbing ────────────────────────────────────────────────────────

  const teardownMeters = useCallback(() => {
    if (tickRef.current != null) window.clearInterval(tickRef.current)
    tickRef.current = null
    if (levelTimerRef.current != null) window.clearInterval(levelTimerRef.current)
    levelTimerRef.current = null
    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx) void ctx.close().catch(() => {})
    const lock = wakeLockRef.current
    wakeLockRef.current = null
    if (lock) void lock.release().catch(() => {})
  }, [])

  const revokeAudioUrl = useCallback(() => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const stopDictation = useCallback(() => {
    dictStopRef.current?.()
    dictStopRef.current = null
    setDictating(false)
    const tail = interimRef.current.trim()
    interimRef.current = ''
    setInterim('')
    if (tail) setDetails((d) => ({ ...d, transcript: appendText(d.transcript, tail) }))
  }, [])

  /** `background`: the sheet was closed while recording — report by toast only. */
  const upload = useCallback(async (background = false) => {
    const p = pendingRef.current
    if (!p) return
    const gen = genRef.current
    const fail = (key: DictKey) => {
      if (background || gen !== genRef.current) {
        toast.error(`${t('vc_failed_title')} — ${t(key)}`)
        return
      }
      setFailKey(key)
      setPhase('failed')
    }
    if (!background) {
      setPhase('saving')
      setFailKey(null)
    }
    if (p.blob.size > MAX_UPLOAD_BYTES * 1.05) {
      fail('voice_note_err_audio_size')
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      fail('vc_err_offline')
      return
    }
    const fd = new FormData()
    const d = detailsRef.current
    fd.append('kind', d.kind)
    fd.append('bucket', d.bucket)
    fd.append('subject', '')
    fd.append('transcript', '')
    if (d.oeuvreId.trim()) fd.append('oeuvre_id', d.oeuvreId.trim())
    const ext = p.mime.includes('mp4') ? 'm4a' : p.mime.includes('ogg') ? 'ogg' : 'webm'
    fd.append('audio', p.blob, `note.${ext}`)
    fd.append('duration_ms', String(Math.round(p.durationMs)))
    fd.append('recorded_at', p.recordedAt.toISOString())
    let res: Awaited<ReturnType<typeof createVoiceNote>>
    try {
      res = await createVoiceNote(fd)
    } catch {
      fail('vc_err_network')
      return
    }
    if ('error' in res) {
      const key: DictKey =
        res.error === 'auth'
          ? 'login_restricted'
          : res.error === 'audio_too_large'
            ? 'voice_note_err_audio_size'
            : res.error === 'audio_mime'
              ? 'voice_note_err_audio_mime'
              : 'vc_err_server'
      fail(key)
      return
    }
    pendingRef.current = null
    setHasPending(false)
    onSaved?.()
    if (background || gen !== genRef.current) {
      // The sheet is gone: the toast is the only confirmation. Open, the green panel says it.
      toast.success(t('vc_saved_fmt').replace('{d}', formatVoiceDuration(p.durationMs)))
      return
    }
    const savedDetails = { ...detailsRef.current, subject: '', transcript: '', nextAction: 'none' as NextActionKey }
    setSaved({ id: res.id, durationMs: p.durationMs, recordedAt: p.recordedAt })
    setBaseline(savedDetails)
    setDetails(savedDetails)
    setPhase('saved')
  }, [onSaved, t])

  const stopAndSave = useCallback(
    async (reason: StopReason) => {
      const session = sessionRef.current
      if (!session) return
      sessionRef.current = null
      const started = startedAtRef.current
      const durationMs = started ? Date.now() - started.ms : 0
      teardownMeters()
      setStopReason(reason)
      setConfirmDiscard(false)
      if (reason !== 'closed') setPhase('saving')
      let blob: Blob
      let mime: string
      try {
        ;({ blob, mime } = await session.stop())
      } catch {
        if (reason !== 'closed') {
          setFailKey('vc_err_recorder')
          setPhase('failed')
        } else toast.error(`${t('vc_failed_title')} — ${t('vc_err_recorder')}`)
        return
      }
      if (blob.size === 0) {
        if (reason !== 'closed') {
          setFailKey('vc_err_empty')
          setPhase('failed')
        } else toast.error(`${t('vc_failed_title')} — ${t('vc_err_empty')}`)
        return
      }
      pendingRef.current = { blob, mime, durationMs, recordedAt: started?.at ?? new Date() }
      setHasPending(true)
      if (reason !== 'closed') {
        revokeAudioUrl()
        setAudioUrl(URL.createObjectURL(blob))
      }
      await upload(reason === 'closed')
    },
    [revokeAudioUrl, t, teardownMeters, upload],
  )
  stopAndSaveRef.current = (reason) => void stopAndSave(reason)

  const startRecording = useCallback(async () => {
    const gen = ++genRef.current
    stopDictation()
    revokeAudioUrl()
    pendingRef.current = null
    setHasPending(false)
    setSaved(null)
    setFailKey(null)
    setMicFailure(null)
    setConfirmDiscard(false)
    setConfirmLose(false)
    setElapsedMs(0)
    setBytes(0)
    setLevels(Array(LEVEL_BARS).fill(0))
    setStopReason('user')
    sizeStopRef.current = false
    const fresh = emptyDetails(defaultWork)
    setDetails(fresh)
    setBaseline(fresh)
    setPhase('starting')
    setPermHint(false)
    // Not awaited before getUserMedia: the prompt should follow the tap immediately.
    void queryMicPermission().then((state) => {
      if (gen === genRef.current && state !== 'granted' && !micGrantedBefore()) setPermHint(true)
    })

    let session: RecorderSession
    try {
      session = await startMicRecorder({
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        onBytes: (total) => {
          setBytes(total)
          if (total >= MAX_UPLOAD_BYTES && !sizeStopRef.current) {
            sizeStopRef.current = true
            stopAndSaveRef.current('size')
          }
        },
      })
    } catch (e) {
      if (gen !== genRef.current) return
      setMicFailure(classifyMicError(e))
      setPhase('blocked')
      return
    }
    if (gen !== genRef.current) {
      // Closed while the permission prompt was up: release the mic, keep nothing.
      void session.stop().catch(() => {})
      return
    }
    markMicGrantedOnce()
    sessionRef.current = session
    const startMs = Date.now()
    startedAtRef.current = { ms: startMs, at: new Date(startMs) }
    setPhase('recording')
    tickRef.current = window.setInterval(() => setElapsedMs(Date.now() - startMs), 250)

    try {
      const Ctx =
        window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        const ctx = new Ctx()
        audioCtxRef.current = ctx
        void ctx.resume().catch(() => {})
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        ctx.createMediaStreamSource(session.stream).connect(analyser)
        const buf = new Uint8Array(analyser.fftSize)
        levelTimerRef.current = window.setInterval(() => {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / buf.length)
          const level = Math.min(1, rms * 4)
          setLevels((prev) => [...prev.slice(1), level])
        }, 100)
      }
    } catch {
      /* no meter — timer and byte count still show the recording */
    }

    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock
      if (wl) wakeLockRef.current = await wl.request('screen')
    } catch {
      /* not granted / not supported */
    }
  }, [defaultWork, revokeAudioUrl, stopDictation])

  const discardRecording = useCallback(() => {
    genRef.current++
    const session = sessionRef.current
    sessionRef.current = null
    teardownMeters()
    if (session) void session.stop().catch(() => {})
    pendingRef.current = null
    setHasPending(false)
    onClose()
  }, [onClose, teardownMeters])

  // ── Open / close lifecycle ───────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    setDictationAvailability(getLiveDictationAvailability())
    void startRecording()
    // startRecording reads defaultWork; reopening is what should restart, not prop churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) return
    stopDictation()
    if (sessionRef.current) {
      // Closed from outside while recording: never drop it — stop and save in the background.
      genRef.current++
      void stopAndSave('closed')
    } else {
      genRef.current++
      teardownMeters()
    }
    revokeAudioUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Unmounted mid-recording (route change, back gesture): stop and save, report by toast.
  useEffect(
    () => () => {
      if (sessionRef.current) {
        genRef.current++
        stopAndSaveRef.current('closed')
      } else teardownMeters()
    },
    [teardownMeters],
  )

  // Phone goes to the background → iOS freezes the page and the recorder with it: stop and save now.
  useEffect(() => {
    if (!open || phase !== 'recording') return
    if (!isTouchDevice()) return
    const onVis = () => {
      if (document.visibilityState === 'hidden') stopAndSaveRef.current('hidden')
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onVis)
    }
  }, [open, phase])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => primaryRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, phase])

  // Typed note: keep a local draft (offline-safe), as before.
  useEffect(() => {
    if (!open || phase !== 'text') return
    const has = details.subject.trim() || details.transcript.trim()
    try {
      if (!has) window.localStorage.removeItem(DRAFT_KEY)
      else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(details))
    } catch {
      /* private mode */
    }
  }, [details, open, phase])

  // ── Details / text note ──────────────────────────────────────────────────────

  const saveDetails = useCallback(async (): Promise<boolean> => {
    if (!saved) return true
    if (JSON.stringify(detailsRef.current) === JSON.stringify(baseline)) return true
    if (dictStopRef.current) stopDictation()
    const d = detailsRef.current
    setDetailsSaving(true)
    try {
      const res = await updateVoiceNoteDetails(saved.id, detailsFormData(d, t(nextActionLabelKey(d.nextAction))))
      if ('error' in res) {
        toast.error(res.error === 'auth' ? t('login_restricted') : t('vc_details_failed'))
        return false
      }
      if (res.followUpOk === false) toast.error(t('voice_follow_up_save_failed'))
      setBaseline({ ...d, nextAction: 'none' })
      setDetails((cur) => ({ ...cur, nextAction: 'none' }))
      toast.success(t('vc_details_saved'))
      onSaved?.()
      return true
    } catch {
      toast.error(t('vc_details_failed'))
      return false
    } finally {
      setDetailsSaving(false)
    }
  }, [baseline, onSaved, saved, stopDictation, t])

  const saveTextNote = useCallback(async (): Promise<boolean> => {
    if (dictStopRef.current) stopDictation()
    const d = detailsRef.current
    if (!d.subject.trim() && !d.transcript.trim()) return true
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error(t('vc_text_offline'))
      return false
    }
    setDetailsSaving(true)
    try {
      const res = await createVoiceNote(detailsFormData(d, t(nextActionLabelKey(d.nextAction))))
      if ('error' in res) {
        toast.error(res.error === 'auth' ? t('login_restricted') : t('voice_note_save_failed'))
        return false
      }
      if (res.followUpOk === false) toast.error(t('voice_follow_up_save_failed'))
      try {
        window.localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      onSaved?.()
      const after = { ...d, nextAction: 'none' as NextActionKey }
      setSaved({ id: res.id, durationMs: null, recordedAt: new Date() })
      setBaseline(after)
      setDetails(after)
      setPhase('saved')
      return true
    } catch {
      toast.error(`${t('voice_note_save_failed')} — ${t('vc_err_network')}`)
      return false
    } finally {
      setDetailsSaving(false)
    }
  }, [onSaved, stopDictation, t])

  const enterTextMode = useCallback(() => {
    genRef.current++
    const session = sessionRef.current
    sessionRef.current = null
    teardownMeters()
    if (session) void session.stop().catch(() => {})
    let d = emptyDetails(defaultWork)
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as Partial<Details>
        d = {
          ...d,
          subject: typeof draft.subject === 'string' ? draft.subject : '',
          transcript: typeof draft.transcript === 'string' ? draft.transcript : '',
          kind: draft.kind && VOICE_NOTE_KINDS.includes(draft.kind) ? draft.kind : d.kind,
          bucket: draft.bucket && VOICE_NOTE_BUCKETS.includes(draft.bucket) ? draft.bucket : d.bucket,
          oeuvreId: typeof draft.oeuvreId === 'string' && draft.oeuvreId ? draft.oeuvreId : d.oeuvreId,
          nextAction: draft.nextAction && NEXT_ACTIONS.includes(draft.nextAction) ? draft.nextAction : 'none',
        }
      }
    } catch {
      /* malformed draft */
    }
    setSaved(null)
    setBaseline(emptyDetails(defaultWork))
    setDetails(d)
    setPhase('text')
  }, [defaultWork, teardownMeters])

  const guard = useUnsavedActionGuard({
    isDirty: dirty,
    getIsDirty: () => JSON.stringify(detailsRef.current) !== JSON.stringify(baseline),
    onProceed: onClose,
    performSave: phase === 'text' ? saveTextNote : saveDetails,
  })

  const requestClose = useCallback(() => {
    const p = phaseRef.current
    if (p === 'recording') {
      stopAndSaveRef.current('user')
      return
    }
    if (p === 'saving') return
    if (p === 'starting') {
      genRef.current++
      onClose()
      return
    }
    if (p === 'failed' && pendingRef.current) {
      setConfirmLose(true)
      return
    }
    if (p === 'saved' || p === 'text') {
      guard.attemptAction()
      return
    }
    onClose()
  }, [guard, onClose])

  useEscapeClose(open, requestClose)

  const finish = async () => {
    if (await saveDetails()) onClose()
  }

  const newNote = async () => {
    if (await saveDetails()) void startRecording()
  }

  // ── Dictation into the text field (only while the recorder is off) ───────────

  const toastDictationError = useCallback(
    (code: string) => {
      if (code === 'insecure') toast.error(t('voice_dictate_insecure'))
      else if (code === 'not-allowed' || code === 'audio-capture') toast.error(t('voice_mic_error'))
      else if (code === 'network' || code === 'service-not-available') toast.error(t('voice_dictate_unavailable'))
      else toast.error(t('voice_dictate_unsupported'))
    },
    [t],
  )

  const startDictation = useCallback(async () => {
    const availability = getLiveDictationAvailability()
    setDictationAvailability(availability)
    if (availability !== 'ready') {
      toastDictationError(availability)
      return
    }
    stopDictation()
    const session = await startLiveDictation(speechLang, {
      onInterim: (txt) => {
        interimRef.current = txt
        setInterim(txt)
      },
      onFinal: (txt) => {
        interimRef.current = ''
        setInterim('')
        setDetails((d) => ({ ...d, transcript: appendText(d.transcript, txt) }))
      },
      onError: (code) => {
        dictStopRef.current = null
        setDictating(false)
        interimRef.current = ''
        setInterim('')
        toastDictationError(code)
      },
    })
    if (!session.ok) return
    dictStopRef.current = session.stop
    setDictating(true)
  }, [speechLang, stopDictation, toastDictationError])

  if (!open) return null

  const recording = phase === 'recording'
  const busy = phase === 'saving' || phase === 'starting'
  const savedWhen = saved
    ? saved.recordedAt.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ring-b-voice-title"
      data-testid="ring-b-voice-sheet"
      data-phase={phase}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: PEM_Z_INDEX.voiceNoteSheet,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      onClick={() => {
        // A stray tap outside must not stop, lose or close a recording.
        if (recording || phase === 'saving' || phase === 'failed') return
        requestClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'min(92dvh, 760px)',
          minHeight: recording || busy ? 'min(70dvh, 560px)' : undefined,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg1)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTop: '1px solid var(--bd)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 4px' }}>
          <div id="ring-b-voice-title" className="serif" style={{ fontSize: 18, flex: 1, minWidth: 0 }}>
            {t('vc_title')}
          </div>
          {!recording && phase !== 'saving' && phase !== 'failed' ? (
            <button
              type="button"
              className="btn ghost sm"
              data-testid="ring-b-voice-sheet-close"
              onClick={requestClose}
              style={{ minHeight: 44, minWidth: 44 }}
              aria-label={t('vc_close')}
            >
              {t('vc_close')}
            </button>
          ) : null}
        </div>

        <div style={{ flex: 1, padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {phase === 'starting' || phase === 'recording' ? (
            <RecordingPanel
              t={t}
              recording={recording}
              elapsedMs={elapsedMs}
              bytes={bytes}
              levels={levels}
              permHint={permHint && phase === 'starting'}
              confirmDiscard={confirmDiscard}
              onStop={() => stopAndSaveRef.current('user')}
              onAskDiscard={() => setConfirmDiscard(true)}
              onKeep={() => setConfirmDiscard(false)}
              onDiscard={discardRecording}
              stopRef={primaryRef}
            />
          ) : null}

          {phase === 'saving' ? (
            <div role="status" aria-live="polite" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '24px 0' }}>
              <div className="vc-spin" aria-hidden style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid var(--bd)', borderTopColor: 'var(--rust)' }} />
              <div style={{ fontSize: 17, fontWeight: 600 }}>{t('vc_saving')}</div>
              <div className="t-mono-sm" style={{ fontSize: 13, color: 'var(--tx2)' }}>{formatVoiceDuration(elapsedMs)}</div>
            </div>
          ) : null}

          {phase === 'failed' ? (
            <div role="alert" data-testid="ring-b-voice-failed" style={{ border: '2px solid var(--rust)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--rust)' }}>✕ {t('vc_failed_title')}</div>
              {failKey ? <div style={{ fontSize: 14, lineHeight: 1.45 }}>{t(failKey)}</div> : null}
              {hasPending ? (
                <>
                  {audioUrl ? <audio controls src={audioUrl} style={{ width: '100%' }} /> : null}
                  <div className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.45 }}>{t('vc_failed_keep')}</div>
                </>
              ) : null}
              {confirmLose ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t('vc_close_lose_confirm')}</div>
                  <button type="button" className="btn" style={{ minHeight: 44, borderColor: 'var(--rust)', color: 'var(--rust)' }} onClick={() => { pendingRef.current = null; setHasPending(false); onClose() }}>
                    {t('vc_close_anyway')}
                  </button>
                  <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={() => setConfirmLose(false)}>
                    {t('cancel')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === 'blocked' && micFailure ? (
            <div role="alert" data-testid="ring-b-voice-blocked" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--rust)' }}>{t('vc_blocked_title')}</div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{t(micFailureKey(micFailure))}</div>
              <details>
                <summary className="t-mono-sm" style={{ fontSize: 12, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                  {t('vc_perm_why_title')}
                </summary>
                <p className="t-mono-sm" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--tx2)', margin: '4px 0 0' }}>{t('vc_perm_why_body')}</p>
              </details>
            </div>
          ) : null}

          {phase === 'saved' && saved ? (
            <div role="status" aria-live="polite" data-testid="ring-b-voice-saved" style={{ border: '2px solid var(--sage)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: 'color-mix(in srgb, var(--sage) 10%, transparent)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--sage)' }}>
                ✓ {saved.durationMs != null ? t('vc_saved_fmt').replace('{d}', formatVoiceDuration(saved.durationMs)) : t('vc_saved_text')}
              </div>
              <div className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)' }}>
                {t('vc_saved_where_fmt').replace('{when}', savedWhen)}
              </div>
              {audioUrl ? <audio controls src={audioUrl} style={{ width: '100%' }} data-testid="ring-b-voice-replay" /> : null}
              {stopReason === 'hidden' ? <div className="t-mono-sm" style={{ fontSize: 12, lineHeight: 1.45 }}>{t('vc_stopped_hidden')}</div> : null}
              {stopReason === 'size' ? <div className="t-mono-sm" style={{ fontSize: 12, lineHeight: 1.45 }}>{t('vc_stopped_size')}</div> : null}
            </div>
          ) : null}

          {phase === 'saved' || phase === 'text' ? (
            <DetailsFields
              t={t}
              heading={phase === 'saved' ? t('vc_details_heading') : null}
              details={details}
              setDetails={setDetails}
              interim={dictating ? interim : ''}
              dictating={dictating}
              dictationReady={dictationAvailability === 'ready'}
              onToggleDictation={() => void (dictating ? stopDictation() : startDictation())}
              onTranscriptTyped={() => {
                interimRef.current = ''
                setInterim('')
              }}
              oeuvreOptions={oeuvreOptions}
            />
          ) : null}
        </div>

        {!recording && phase !== 'starting' && phase !== 'saving' && !confirmLose ? (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              display: 'flex',
              gap: 8,
              padding: '10px 16px max(12px, env(safe-area-inset-bottom))',
              background: 'var(--bg1)',
              borderTop: '1px solid var(--bd)',
            }}
          >
            {phase === 'saved' ? (
              <>
                <button type="button" className="btn ghost" data-testid="ring-b-voice-new" style={footBtn(1)} disabled={detailsSaving} onClick={() => void newNote()}>
                  <span aria-hidden style={{ color: 'var(--rust)' }}>● </span>
                  {t('vc_new_note')}
                </button>
                <button ref={primaryRef} type="button" className="btn primary" data-testid="ring-b-voice-done" style={footBtn(1.4)} disabled={detailsSaving} onClick={() => void finish()}>
                  {detailsSaving ? t('voice_saving') : t('vc_done')}
                </button>
              </>
            ) : null}
            {phase === 'failed' ? (
              hasPending ? (
                <>
                  <button type="button" className="btn ghost" style={footBtn(1)} onClick={() => setConfirmLose(true)}>
                    {t('vc_discard_yes')}
                  </button>
                  <button ref={primaryRef} type="button" className="btn primary" data-testid="ring-b-voice-retry" style={footBtn(1.4)} onClick={() => void upload(false)}>
                    {t('vc_retry_upload')}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn ghost" style={footBtn(1)} onClick={onClose}>
                    {t('vc_close')}
                  </button>
                  <button ref={primaryRef} type="button" className="btn primary" style={footBtn(1.4)} onClick={() => void startRecording()}>
                    {t('vc_record_again')}
                  </button>
                </>
              )
            ) : null}
            {phase === 'blocked' ? (
              <>
                <button type="button" className="btn ghost" data-testid="ring-b-voice-write" style={footBtn(1)} onClick={enterTextMode}>
                  {t('vc_write_instead')}
                </button>
                <button ref={primaryRef} type="button" className="btn primary" data-testid="ring-b-voice-mic-retry" style={footBtn(1.4)} onClick={() => void startRecording()}>
                  {t('vc_retry')}
                </button>
              </>
            ) : null}
            {phase === 'text' ? (
              <>
                <button type="button" className="btn ghost" style={footBtn(1)} disabled={detailsSaving} onClick={() => void startRecording()}>
                  <span aria-hidden style={{ color: 'var(--rust)' }}>● </span>
                  {t('vc_record_instead')}
                </button>
                <button
                  ref={primaryRef}
                  type="button"
                  className="btn primary"
                  data-testid="ring-b-voice-save"
                  style={footBtn(1.4)}
                  disabled={detailsSaving || (!details.subject.trim() && !details.transcript.trim())}
                  onClick={() => void saveTextNote()}
                >
                  {detailsSaving ? t('voice_saving') : t('vc_save_text')}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {guard.unsavedDialog}
      <style>{`
        @keyframes vc-pulse { 0% { box-shadow: 0 0 0 0 rgba(200,40,40,0.55) } 70% { box-shadow: 0 0 0 22px rgba(200,40,40,0) } 100% { box-shadow: 0 0 0 0 rgba(200,40,40,0) } }
        @keyframes vc-blink { 50% { opacity: 0.25 } }
        @keyframes vc-spin { to { transform: rotate(360deg) } }
        .vc-spin { animation: vc-spin 0.9s linear infinite }
        @media (prefers-reduced-motion: reduce) { .vc-spin, .vc-pulse, .vc-blink { animation: none !important } }
      `}</style>
    </div>
  )
}

function appendText(prev: string, bit: string): string {
  const chunk = bit.trim()
  if (!chunk) return prev
  if (!prev) return chunk
  const join = prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '
  return `${prev}${join}${chunk}`
}

type TFn = (key: DictKey) => string

function RecordingPanel({
  t,
  recording,
  elapsedMs,
  bytes,
  levels,
  permHint,
  confirmDiscard,
  onStop,
  onAskDiscard,
  onKeep,
  onDiscard,
  stopRef,
}: {
  t: TFn
  recording: boolean
  elapsedMs: number
  bytes: number
  levels: number[]
  permHint: boolean
  confirmDiscard: boolean
  onStop: () => void
  onAskDiscard: () => void
  onKeep: () => void
  onDiscard: () => void
  stopRef: RefObject<HTMLButtonElement | null>
}) {
  const noData = recording && elapsedMs > 2000 && bytes === 0
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '8px 0' }}>
      <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600 }}>
        <span
          aria-hidden
          className={recording ? 'vc-blink' : undefined}
          style={{ width: 12, height: 12, borderRadius: '50%', background: recording ? '#c82828' : 'var(--tx3)', animation: recording ? 'vc-blink 1.2s ease-in-out infinite' : undefined }}
        />
        {recording ? t('vc_recording') : t('vc_starting')}
      </div>
      <div
        className="t-mono-sm"
        data-testid="ring-b-voice-timer"
        style={{ fontSize: 44, fontVariantNumeric: 'tabular-nums', letterSpacing: 1, lineHeight: 1, color: recording ? 'var(--tx)' : 'var(--tx3)' }}
      >
        {formatVoiceDuration(elapsedMs)}
      </div>
      <div
        role="meter"
        aria-label={t('vc_level_aria')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((levels[levels.length - 1] ?? 0) * 100)}
        style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40, width: '100%', maxWidth: 280, justifyContent: 'center' }}
      >
        {levels.map((lv, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              maxWidth: 8,
              borderRadius: 2,
              height: `${Math.max(8, Math.round(lv * 100))}%`,
              background: recording ? '#c82828' : 'var(--bd)',
              opacity: recording ? 0.35 + lv * 0.65 : 1,
            }}
          />
        ))}
      </div>
      <button
        ref={stopRef}
        type="button"
        data-testid="ring-b-voice-record-toggle"
        aria-label={t('vc_stop_save')}
        disabled={!recording}
        onClick={onStop}
        className={recording ? 'vc-pulse' : undefined}
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: '4px solid var(--bg1)',
          outline: '3px solid #c82828',
          background: '#c82828',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: recording ? 'pointer' : 'default',
          opacity: recording ? 1 : 0.55,
          animation: recording ? 'vc-pulse 1.6s ease-out infinite' : undefined,
        }}
      >
        <span aria-hidden style={{ width: 30, height: 30, borderRadius: recording ? 5 : '50%', background: '#fff' }} />
      </button>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{recording ? t('vc_stop_save') : ' '}</div>
      <div className="t-mono-sm" style={{ fontSize: 12, color: noData ? 'var(--rust)' : 'var(--tx2)', minHeight: 16 }}>
        {noData ? t('vc_no_data') : recording ? t('vc_bytes_fmt').replace('{kb}', String(Math.round(bytes / 1024))) : ''}
      </div>
      {permHint ? (
        <div style={{ fontSize: 14, lineHeight: 1.5, textAlign: 'center', padding: '0 8px', fontWeight: 600 }}>{t('vc_perm_hint')}</div>
      ) : null}
      {recording ? (
        <div className="t-mono-sm" style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--tx3)', textAlign: 'center', padding: '0 8px' }}>
          {t('vc_lock_hint')}
        </div>
      ) : null}
      {recording ? (
        confirmDiscard ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13 }}>{t('vc_discard_confirm')}</span>
            <button type="button" className="btn sm" style={{ minHeight: 44, borderColor: 'var(--rust)', color: 'var(--rust)' }} onClick={onDiscard}>
              {t('vc_discard_yes')}
            </button>
            <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={onKeep}>
              {t('vc_keep_recording')}
            </button>
          </div>
        ) : (
          <button type="button" className="btn ghost sm" data-testid="ring-b-voice-cancel" style={{ minHeight: 44, minWidth: 120 }} onClick={onAskDiscard}>
            {t('vc_cancel')}
          </button>
        )
      ) : null}
    </div>
  )
}

function DetailsFields({
  t,
  heading,
  details,
  setDetails,
  interim,
  dictating,
  dictationReady,
  onToggleDictation,
  onTranscriptTyped,
  oeuvreOptions,
}: {
  t: TFn
  heading: string | null
  details: Details
  setDetails: Dispatch<SetStateAction<Details>>
  interim: string
  dictating: boolean
  dictationReady: boolean
  onToggleDictation: () => void
  onTranscriptTyped: () => void
  oeuvreOptions: { OeuvreID: number; Titre: string | null }[]
}) {
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setDetails((d) => ({ ...d, [k]: v }))
  const chip = (active: boolean) => ({
    minHeight: 44,
    background: active ? 'var(--ac)' : 'var(--bg0)',
    color: active ? 'var(--bg1)' : 'var(--tx)',
    border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`,
  })
  const transcriptDisplay = dictating && interim ? appendText(details.transcript, interim) : details.transcript
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {heading ? <div className="t-label" style={{ marginBottom: 6 }}>{heading}</div> : null}
      <label className="t-label" style={{ display: 'block', marginBottom: 6 }} htmlFor="voice-note-subject">{t('voice_subject_label')}</label>
      <input
        id="voice-note-subject"
        className="input"
        value={details.subject}
        onChange={(e) => set('subject', e.target.value)}
        placeholder={t('voice_subject_ph')}
        style={{ width: '100%', marginBottom: 10, minHeight: 44, fontSize: 16 }}
      />

      <label className="t-label" style={{ display: 'block', marginBottom: 6 }} htmlFor="voice-note-transcript">{t('voice_transcript_label')}</label>
      <textarea
        id="voice-note-transcript"
        className="input"
        value={transcriptDisplay}
        onChange={(e) => {
          onTranscriptTyped()
          set('transcript', e.target.value)
        }}
        placeholder={t('voice_transcript_ph')}
        rows={3}
        aria-live={dictating ? 'polite' : undefined}
        style={{ width: '100%', marginBottom: 6, fontSize: 16, lineHeight: 1.5, minHeight: 80 }}
      />
      <button
        type="button"
        className="btn ghost sm"
        data-testid="ring-b-voice-dictate-toggle"
        aria-pressed={dictating}
        aria-label={dictating ? t('voice_dictate_stop_aria') : t('voice_dictate_start_aria')}
        onClick={onToggleDictation}
        disabled={!dictating && !dictationReady}
        style={{ minHeight: 44, alignSelf: 'flex-start', marginBottom: 10 }}
      >
        {dictating ? t('voice_dictate_stop') : t('voice_dictate_start')}
      </button>

      <div className="t-label" style={{ marginBottom: 6 }}>{t('voice_kind_label')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {VOICE_NOTE_KINDS.map((k) => (
          <button key={k} type="button" className="btn sm" aria-pressed={details.kind === k} onClick={() => set('kind', k)} style={chip(details.kind === k)}>
            {t(kindKey(k))}
          </button>
        ))}
      </div>

      <div className="t-label" style={{ marginBottom: 6 }}>{t('voice_bucket_label')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {VOICE_NOTE_BUCKETS.map((b) => (
          <button key={b} type="button" className="btn sm" aria-pressed={details.bucket === b} onClick={() => set('bucket', b)} style={chip(details.bucket === b)}>
            {t(bucketKey(b))}
          </button>
        ))}
      </div>

      {oeuvreOptions.length > 0 ? (
        <>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }} htmlFor="voice-note-work">{t('voice_link_work')}</label>
          <select
            id="voice-note-work"
            className="input"
            value={details.oeuvreId}
            onChange={(e) => set('oeuvreId', e.target.value)}
            style={{ width: '100%', marginBottom: 10, minHeight: 44, fontSize: 16 }}
            aria-label={t('voice_link_work')}
          >
            <option value="">{t('voice_link_work_none')}</option>
            {oeuvreOptions.map((o) => (
              <option key={o.OeuvreID} value={String(o.OeuvreID)}>
                {(o.Titre ?? '').trim() ? `${o.Titre} (#${o.OeuvreID})` : `#${o.OeuvreID}`}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <div className="t-label" style={{ marginBottom: 6 }}>{t('voice_next_action_label')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {NEXT_ACTIONS.map((action) => (
          <button key={action} type="button" className="btn sm" aria-pressed={details.nextAction === action} onClick={() => set('nextAction', action)} style={chip(details.nextAction === action)}>
            {t(nextActionLabelKey(action))}
          </button>
        ))}
      </div>
    </div>
  )
}
