'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { createVoiceNote } from '@/app/atelier/notes/actions'
import { VOICE_NOTE_BUCKETS, VOICE_NOTE_KINDS, type VoiceNoteBucket, type VoiceNoteKind } from '@/lib/voice-note-domain'
import { startLiveDictation, startMicRecorder } from '@/lib/voice/web-speech'
import { toast } from '@/lib/ui/toast'

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

export type VoiceNoteSheetProps = {
  open: boolean
  onClose: () => void
  /** Optional œuvre labels for link picker (Atelier); Hub passes `[]`. */
  oeuvreOptions?: { OeuvreID: number; Titre: string | null }[]
  defaultOeuvreId?: number | null
  onSaved?: () => void
}

/** Ring B — voice / dictation capture (Verb 2). */
export function VoiceNoteSheet({
  open,
  onClose,
  oeuvreOptions = [],
  defaultOeuvreId = null,
  onSaved,
}: VoiceNoteSheetProps) {
  const { t, lang } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  const dictStopRef = useRef<(() => void) | null>(null)
  const interimRef = useRef('')
  const recordStartedAt = useRef<number | null>(null)
  const recorderSessionRef = useRef<Awaited<ReturnType<typeof startMicRecorder>> | null>(null)

  const [kind, setKind] = useState<VoiceNoteKind>('memo')
  const [bucket, setBucket] = useState<VoiceNoteBucket>('general')
  const [subject, setSubject] = useState('')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [oeuvreId, setOeuvreId] = useState('')
  const [recording, setRecording] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [audioBlob, setAudioBlob] = useState<{ blob: Blob; mime: string } | null>(null)

  const speechLang = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const resetForm = useCallback(() => {
    setKind('memo')
    setBucket('general')
    setSubject('')
    setTranscript('')
    setInterim('')
    setOeuvreId('')
    setAudioBlob(null)
    recordStartedAt.current = null
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => closeRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    if (defaultOeuvreId != null && defaultOeuvreId > 0) setOeuvreId(String(defaultOeuvreId))
    else setOeuvreId('')
  }, [open, defaultOeuvreId])

  useEffect(() => {
    if (open) return
    dictStopRef.current?.()
    dictStopRef.current = null
    setDictating(false)
    setInterim('')
    void (async () => {
      if (recorderSessionRef.current) {
        try {
          await recorderSessionRef.current.stop()
        } catch {
          /* ignore */
        }
        recorderSessionRef.current = null
      }
      setRecording(false)
    })()
    resetForm()
  }, [open, resetForm])

  const appendTranscript = useCallback((prev: string, bit: string) => {
    const chunk = bit.trim()
    if (!chunk) return prev
    if (!prev) return chunk
    const join = prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '
    return `${prev}${join}${chunk}`
  }, [])

  const toastDictationError = useCallback(
    (code: string) => {
      if (code === 'insecure') toast.error(t('voice_dictate_insecure'))
      else if (code === 'not-allowed' || code === 'audio-capture') toast.error(t('voice_mic_error'))
      else if (code === 'network' || code === 'service-not-available') toast.error(t('voice_dictate_unavailable'))
      else toast.error(t('voice_dictate_unsupported'))
    },
    [t],
  )

  const stopDictation = useCallback(() => {
    dictStopRef.current?.()
    dictStopRef.current = null
    setDictating(false)
    const tail = interimRef.current.trim()
    interimRef.current = ''
    setInterim('')
    if (tail) setTranscript((prev) => appendTranscript(prev, tail))
  }, [appendTranscript])

  const startDictation = useCallback(async () => {
    stopDictation()
    if (recording && recorderSessionRef.current) {
      const session = recorderSessionRef.current
      recorderSessionRef.current = null
      setRecording(false)
      try {
        await session.stop()
      } catch {
        /* ignore — dictation needs exclusive mic */
      }
    }
    const session = await startLiveDictation(speechLang, {
      onInterim: (txt) => {
        interimRef.current = txt
        setInterim(txt)
      },
      onFinal: (txt) => {
        interimRef.current = ''
        setInterim('')
        setTranscript((prev) => appendTranscript(prev, txt))
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
  }, [appendTranscript, recording, speechLang, stopDictation, toastDictationError])

  const transcriptDisplay =
    dictating && interim
      ? appendTranscript(transcript, interim)
      : transcript

  const toggleRecord = async () => {
    if (dictating) stopDictation()
    if (recording) {
      const session = recorderSessionRef.current
      recorderSessionRef.current = null
      setRecording(false)
      if (!session) return
      try {
        const { blob, mime } = await session.stop()
        setAudioBlob({ blob, mime })
      } catch {
        toast.error(t('voice_mic_error'))
      }
      return
    }
    try {
      const session = await startMicRecorder()
      recorderSessionRef.current = session
      recordStartedAt.current = Date.now()
      setRecording(true)
      setAudioBlob(null)
    } catch {
      toast.error(t('voice_mic_error'))
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('kind', kind)
      fd.append('bucket', bucket)
      fd.append('subject', subject.trim())
      fd.append('transcript', transcript)
      if (oeuvreId.trim()) fd.append('oeuvre_id', oeuvreId.trim())
      if (audioBlob) {
        const ext = audioBlob.mime.includes('mp4') ? 'm4a' : 'webm'
        fd.append('audio', audioBlob.blob, `note.${ext}`)
        fd.append('duration_ms', String(recordStartedAt.current ? Date.now() - recordStartedAt.current : 0))
      }
      const res = await createVoiceNote(fd)
      if ('error' in res) {
        if (res.error === 'auth') toast.error(t('login_restricted'))
        else if (res.error === 'audio_too_large') toast.error(t('voice_note_err_audio_size'))
        else if (res.error === 'audio_mime') toast.error(t('voice_note_err_audio_mime'))
        else toast.error(t('voice_note_save_failed'))
        return
      }
      toast.success(t('voice_note_saved'))
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ring-b-voice-title"
      data-testid="ring-b-voice-sheet"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 155,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'min(92vh, 720px)',
          overflow: 'auto',
          background: 'var(--bg1)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: '20px 20px max(20px, env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--bd)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div id="ring-b-voice-title" className="serif" style={{ fontSize: 18, marginBottom: 8 }}>
          {t('ring_b_voice_sheet_title')}
        </div>
        <p className="t-mono-sm" style={{ color: 'var(--tx2)', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
          {t('ring_b_voice_sheet_body')}
        </p>

        <div className="t-label" style={{ marginBottom: 6 }}>{t('voice_kind_label')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {VOICE_NOTE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className="btn sm"
              onClick={() => setKind(k)}
              style={{
                minHeight: 40,
                background: kind === k ? 'var(--ac)' : 'var(--bg0)',
                color: kind === k ? 'var(--bg1)' : 'var(--tx)',
                border: `1px solid ${kind === k ? 'var(--ac)' : 'var(--bd)'}`,
              }}
            >
              {t(kindKey(k))}
            </button>
          ))}
        </div>

        <div className="t-label" style={{ marginBottom: 6 }}>{t('voice_bucket_label')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {VOICE_NOTE_BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              className="btn sm"
              onClick={() => setBucket(b)}
              style={{
                minHeight: 40,
                background: bucket === b ? 'var(--ac)' : 'var(--bg0)',
                color: bucket === b ? 'var(--bg1)' : 'var(--tx)',
                border: `1px solid ${bucket === b ? 'var(--ac)' : 'var(--bd)'}`,
              }}
            >
              {t(bucketKey(b))}
            </button>
          ))}
        </div>

        <label className="t-label" style={{ display: 'block', marginBottom: 6 }} htmlFor="voice-note-subject">{t('voice_subject_label')}</label>
        <input
          id="voice-note-subject"
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('voice_subject_ph')}
          style={{ width: '100%', marginBottom: 12, minHeight: 44, fontSize: 14 }}
        />

        {oeuvreOptions.length > 0 ? (
          <>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }} htmlFor="voice-note-work">{t('voice_link_work')}</label>
            <select
              id="voice-note-work"
              className="input"
              value={oeuvreId}
              onChange={(e) => setOeuvreId(e.target.value)}
              style={{ width: '100%', marginBottom: 12, minHeight: 44, fontSize: 13 }}
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className="btn ghost sm"
            data-testid="ring-b-voice-record-toggle"
            aria-pressed={recording}
            aria-label={recording ? t('voice_record_stop_aria') : t('voice_record_start_aria')}
            onClick={() => void toggleRecord()}
            style={{ minHeight: 44, flex: '1 1 140px' }}
          >
            {recording ? t('voice_record_stop') : t('voice_record_start')}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            data-testid="ring-b-voice-dictate-toggle"
            aria-pressed={dictating}
            aria-label={dictating ? t('voice_dictate_stop_aria') : t('voice_dictate_start_aria')}
            onClick={() => void (dictating ? stopDictation() : startDictation())}
            style={{ minHeight: 44, flex: '1 1 140px' }}
          >
            {dictating ? t('voice_dictate_stop') : t('voice_dictate_start')}
          </button>
        </div>

        <label className="t-label" style={{ display: 'block', marginBottom: 6 }} htmlFor="voice-note-transcript">{t('voice_transcript_label')}</label>
        <textarea
          id="voice-note-transcript"
          className="input"
          value={transcriptDisplay}
          onChange={(e) => {
            interimRef.current = ''
            setInterim('')
            setTranscript(e.target.value)
          }}
          placeholder={t('voice_transcript_ph')}
          rows={5}
          aria-live={dictating ? 'polite' : undefined}
          style={{ width: '100%', marginBottom: 12, fontSize: 13, lineHeight: 1.5, minHeight: 100 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="btn primary"
            data-testid="ring-b-voice-save"
            style={{ minHeight: 44, width: '100%' }}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t('voice_saving') : t('voice_save')}
          </button>
          <button
            ref={closeRef}
            type="button"
            className="btn ghost"
            data-testid="ring-b-voice-sheet-close"
            style={{ minHeight: 44, width: '100%' }}
            onClick={onClose}
          >
            {t('ring_b_voice_sheet_close')}
          </button>
        </div>
      </div>
    </div>
  )
}
