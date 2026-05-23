'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre, VoiceNoteRow } from '@/lib/types/database'
import { imageUrl } from '@/lib/data'
import { deleteVoiceNote, listVoiceNotes, updateVoiceNoteTranscript } from '@/app/atelier/notes/actions'
import {
  VOICE_NOTE_BUCKETS,
  VOICE_NOTE_KINDS,
  type VoiceNoteBucket,
  type VoiceNoteKind,
} from '@/lib/voice-note-domain'
import { EmptyState } from '@/components/shared/EmptyState'
import { toast } from '@/lib/ui/toast'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'

function voiceKindKey(k: VoiceNoteKind): DictKey {
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

function voiceBucketKey(b: VoiceNoteBucket): DictKey {
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

function workLabel(oeuvres: Oeuvre[], id: number | null): string | null {
  if (id == null) return null
  const o = oeuvres.find((x) => x.OeuvreID === id)
  if (!o) return `#${id}`
  const t = (o.Titre ?? '').trim()
  return t || `#${id}`
}

export function Notes({ refreshTick, oeuvres }: { refreshTick: number; oeuvres: Oeuvre[] }) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [rows, setRows] = useState<VoiceNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<string>('')
  const [bucketFilter, setBucketFilter] = useState<string>('')
  const [q, setQ] = useState('')
  const [draftTranscript, setDraftTranscript] = useState('')
  const [savingTx, setSavingTx] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const res = await listVoiceNotes(300)
    if ('error' in res) {
      setErr(res.error)
      setRows([])
    } else {
      setRows(res.rows)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshTick])

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])

  useEffect(() => {
    if (selected) setDraftTranscript(selected.transcript ?? '')
  }, [selected])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (kindFilter && r.kind !== kindFilter) return false
      if (bucketFilter && r.bucket !== bucketFilter) return false
      if (!qq) return true
      const sub = (r.subject ?? '').toLowerCase()
      const tx = (r.transcript ?? '').toLowerCase()
      return sub.includes(qq) || tx.includes(qq)
    })
  }, [rows, kindFilter, bucketFilter, q])

  const preview = (r: VoiceNoteRow) => {
    const tx = (r.transcript ?? '').replace(/\s+/g, ' ').trim()
    if (!tx) return '—'
    return tx.length > 120 ? `${tx.slice(0, 120)}…` : tx
  }

  const saveTranscript = async () => {
    if (!selected) return
    setSavingTx(true)
    try {
      const res = await updateVoiceNoteTranscript(selected.id, draftTranscript)
      if ('error' in res) {
        toast.error(t('error'))
        return
      }
      setRows((prev) => prev.map((x) => (x.id === selected.id ? { ...x, transcript: draftTranscript } : x)))
      toast.success(t('voice_note_saved'))
    } finally {
      setSavingTx(false)
    }
  }

  const runDelete = async (id: string) => {
    const res = await deleteVoiceNote(id)
    if ('error' in res) {
      toast.error(t('error'))
      return
    }
    setRows((prev) => prev.filter((x) => x.id !== id))
    if (selectedId === id) setSelectedId(null)
    setPendingDeleteId(null)
    toast.success(t('voice_note_deleted'))
  }

  const audioSrc = selected?.audio_r2_key ? imageUrl(selected.audio_r2_key) : null

  return (
    <div
      data-testid="notes-tab-root"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: narrow ? 'column' : 'row',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: narrow ? '100%' : 'min(100%, 380px)',
          flexShrink: 0,
          borderRight: narrow ? 'none' : '1px solid var(--bd)',
          borderBottom: narrow ? '1px solid var(--bd)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxHeight: narrow ? '42vh' : undefined,
        }}
      >
        <div style={{ padding: 12, borderBottom: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="serif" style={{ fontSize: 18 }}>{t('tab_notes')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
              {t('notes_refresh')}
            </button>
            <input
              className="input"
              style={{ flex: 1, minWidth: 120, fontSize: 12 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('notes_search_ph')}
              aria-label={t('notes_search_ph')}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <select
              className="input"
              style={{ fontSize: 12, maxWidth: '100%' }}
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              aria-label={t('notes_kind_filter')}
            >
              <option value="">{t('notes_kind_all')}</option>
              {VOICE_NOTE_KINDS.map((k) => (
                <option key={k} value={k}>{t(voiceKindKey(k))}</option>
              ))}
            </select>
            <select
              className="input"
              style={{ fontSize: 12, maxWidth: '100%' }}
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value)}
              aria-label={t('notes_bucket_filter')}
            >
              <option value="">{t('notes_bucket_all')}</option>
              {VOICE_NOTE_BUCKETS.map((b) => (
                <option key={b} value={b}>{t(voiceBucketKey(b))}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <div className="t-mono-sm" style={{ padding: 16, opacity: 0.6 }}>{t('loadingAtelier')}</div>
          ) : err ? (
            <div className="t-mono-sm" style={{ padding: 16, color: 'var(--rust)' }}>{t('notes_load_error')}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState title={t('notes_empty')} />
            </div>
          ) : (
            filtered.map((r) => {
              const active = r.id === selectedId
              const wl = workLabel(oeuvres, r.oeuvre_id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  data-testid={`notes-row-${r.id}`}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: 'none',
                    borderBottom: '1px solid var(--bd)',
                    background: active ? 'var(--bg2)' : 'transparent',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--tx)',
                  }}
                >
                  <div className="t-mono-sm" style={{ opacity: 0.55, fontSize: 10, marginBottom: 4 }}>
                    {new Date(r.created_at).toLocaleString(locale)}
                    {wl ? ` · ${wl}` : ''}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {r.subject?.trim() || t('notes_list_untitled')}
                  </div>
                  <div className="t-mono-sm" style={{ fontSize: 10, opacity: 0.65, marginBottom: 4 }}>
                    {t(voiceKindKey(r.kind))} · {t(voiceBucketKey(r.bucket))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.45 }}>{preview(r)}</div>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        {!selected ? (
          <div className="t-mono-sm" style={{ padding: 24, opacity: 0.55 }}>{t('notes_detail_empty')}</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 16, gap: 12 }}>
            <div className="serif" style={{ fontSize: 20 }}>{selected.subject?.trim() || t('notes_list_untitled')}</div>
            {audioSrc ? (
              <div>
                <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_audio_label')}</div>
                <audio controls src={audioSrc} style={{ width: '100%', maxWidth: 480 }} data-testid="notes-detail-audio" />
              </div>
            ) : null}
            <div>
              <div className="t-label" style={{ marginBottom: 6 }}>{t('notes_transcript')}</div>
              <textarea
                className="input"
                value={draftTranscript}
                onChange={(e) => setDraftTranscript(e.target.value)}
                rows={10}
                style={{ width: '100%', resize: 'vertical', minHeight: 160, fontSize: 13, lineHeight: 1.5 }}
                aria-label={t('notes_transcript')}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn primary sm" onClick={() => void saveTranscript()} disabled={savingTx}>
                {t('notes_save')}
              </button>
              {pendingDeleteId === selected.id ? (
                <>
                  <span className="t-mono-sm" style={{ fontSize: 11 }}>{t('notes_delete_confirm')}</span>
                  <button type="button" className="btn sm" style={{ borderColor: 'var(--rust)', color: 'var(--rust)' }} onClick={() => void runDelete(selected.id)}>
                    {t('notes_delete_yes')}
                  </button>
                  <button type="button" className="btn ghost sm" onClick={() => setPendingDeleteId(null)}>
                    {t('cancel')}
                  </button>
                </>
              ) : (
                <button type="button" className="btn ghost sm" onClick={() => setPendingDeleteId(selected.id)}>
                  {t('notes_delete')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
