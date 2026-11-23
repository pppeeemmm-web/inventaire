'use client'

// Journal day page — entries, Kaizen Création items, voice notes, works changed of one Paris calendar day.
// A voice note is a Journal entry spoken instead of written (R1 step 7): it shows in the day's entries —
// as its PC transcript entry once there, before that on its own — and « Relier » links it (ex Notes triage).
// Création items are read from `kaizen_item` (never copied; owner 2026-11-12).
// Build step 1 (owner GO 2026-11-12, docs/archive/JOURNAL_PROPOSAL.md). Rules are in the DB
// (supabase/sql/journal_entry.sql): append only, never deleted, hide = admin.

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { EntryText } from '@/components/atelier/journal/EntryText'
import { EntryCorrectAction, canCorrectEntry } from '@/components/atelier/journal/EntryCorrection'
import { isNothingHeard, isWaitingTranscript } from '@/lib/journal/nothing-heard'
import { CorrectedOriginal } from '@/components/atelier/journal/CorrectedOriginal'
import { WorkRef } from '@/components/atelier/WorkRef'
import { WorkChip } from '@/components/atelier/WorkChip'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { InspirationText } from '@/components/atelier/journal/InspirationText'
import { imageUrl, thumbUrl } from '@/lib/data'
import { removeInspirationPhoto } from '@/app/atelier/capture/inspiration-actions'
import { SeeAgainCard, JOURNAL_COMPOSE_EVENT } from '@/components/atelier/SeeAgainCard'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import { VoiceNoteSheet } from '@/components/shared/VoiceNoteSheet'
import { VoiceNoteLinkPanel } from '@/components/atelier/journal/VoiceNoteLinkPanel'
import { deleteVoiceNote } from '@/app/atelier/(portal)/notes/actions'
import { formatVoiceDuration } from '@/lib/voice-note-domain'
import { getLiveDictationAvailability, startLiveDictation, type LiveDictationSession } from '@/lib/voice/web-speech'
import { useI18n } from '@/lib/i18n/context'
import { versionFieldLabel } from '@/lib/oeuvre-version-fields'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import {
  createJournalEntry,
  decideJournalLink,
  fetchConceptPreview,
  getJournalDayExtras,
  setJournalEntryHidden,
  type ConceptPreview,
  type JournalDayExtras as Extras,
} from '@/app/atelier/(portal)/journal/entry-actions'

const KINDS = ['spark', 'trigger', 'reflection', 'note'] as const
type Kind = (typeof KINDS)[number]

const KIND_KEY = {
  spark: 'je_kind_spark',
  trigger: 'je_kind_trigger',
  reflection: 'je_kind_reflection',
  note: 'je_kind_note',
} as const

// Kinds written by imports / transcription (not offered in the form).
const OTHER_KIND_KEY = { atlas: 'je_kind_atlas', voice: 'je_kind_voice', handwriting: 'je_kind_handwriting' } as const

function kindLabel(kind: string, t: (k: (typeof KIND_KEY)[Kind] | (typeof OTHER_KIND_KEY)[keyof typeof OTHER_KIND_KEY]) => string): string {
  if ((KINDS as readonly string[]).includes(kind)) return t(KIND_KEY[kind as Kind])
  if (kind in OTHER_KIND_KEY) return t(OTHER_KIND_KEY[kind as keyof typeof OTHER_KIND_KEY])
  return kind
}

function workHref(id: number): string {
  return `/atelier/inventory?work=${id}`
}

const DETAILS_SUMMARY = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  color: 'var(--tx3)',
} as const

export function JournalDayExtras({
  day,
  locale,
  onCapture,
  captureSlot,
  composeSignal = 0,
}: {
  day: string
  locale: string
  /** Admin capture: opens the day's capture section (journal = main tab, owner 2026-11-12). */
  onCapture?: () => void
  /** Rendered right after the entries: the day's works and photo capture. */
  captureSlot?: ReactNode
  /** Bumped by "Écrire aujourd'hui": opens the form with the cursor in the text. */
  composeSignal?: number
}) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [composing, setComposing] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  // Dictation (browser speech → text in the box). The entry is then saved as provenance voice, unverified.
  const [dictated, setDictated] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const dictation = useRef<LiveDictationSession | null>(null)
  const [data, setData] = useState<Extras | null>(null)
  const [kind, setKind] = useState<Kind>('spark')
  const [body, setBody] = useState('')
  const [precision, setPrecision] = useState<'day' | 'month' | 'year'>('day')
  const [conceptId, setConceptId] = useState('')
  /** Voice note whose « Relier » panel is open. */
  const [linkOpen, setLinkOpen] = useState<string | null>(null)
  /** Voice note whose « Supprimer » confirm step is open. */
  const [deleteAsk, setDeleteAsk] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const res = await getJournalDayExtras(day)
    if ('error' in res) {
      toast.error(t('je_err_fmt').replace('{msg}', res.error))
      return
    }
    setData(res)
  }, [day, t])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  function add() {
    if (!body.trim()) {
      toast.error(t('je_err_empty'))
      return
    }
    startTransition(async () => {
      stopDictation()
      const res = await createJournalEntry({ day, kind, body, precision, dictated, conceptIds: conceptId ? [conceptId] : [] })
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      setBody('')
      setPrecision('day')
      setDictated(false)
      setConceptId('')
      await load()
    })
  }

  function stopDictation() {
    dictation.current?.stop()
    dictation.current = null
    setListening(false)
    setInterim('')
  }

  async function toggleDictation() {
    if (listening) {
      stopDictation()
      return
    }
    if (getLiveDictationAvailability() !== 'ready') {
      toast.error(t('je_dictate_unavailable'))
      return
    }
    const session = await startLiveDictation(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      onInterim: (text) => setInterim(text),
      onFinal: (text) => {
        setInterim('')
        setDictated(true)
        setBody((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${text.trim()}` : `${prev}${text.trim()}`))
      },
      onError: (code) => {
        stopDictation()
        toast.error(t('je_err_fmt').replace('{msg}', code))
      },
    })
    if (session.ok) {
      dictation.current = session
      setListening(true)
    }
  }

  useEffect(() => () => dictation.current?.stop(), [])

  function openComposer() {
    setComposing(true)
    window.setTimeout(() => {
      const box = document.getElementById('journal-entry-body') as HTMLTextAreaElement | null
      box?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      box?.focus({ preventScroll: true })
    }, 60)
  }

  // "See again" → "Write about it": the form opens with `#1234 ` prefilled (event on this page,
  // `?write=` when coming from Overview). An existing draft is kept, the mention is added in front.
  const openComposerRef = useRef(openComposer)
  openComposerRef.current = openComposer
  useEffect(() => {
    const prefill = (text: string) => {
      if (!/^(#\d+ ?)+$/.test(text.trim() + ' ')) return
      setBody((b) => (b.includes(text.trim()) ? b : `${text.trim()} ${b}`))
      openComposerRef.current()
    }
    const onCompose = (ev: Event) => prefill(String((ev as CustomEvent<string>).detail ?? ''))
    window.addEventListener(JOURNAL_COMPOSE_EVENT, onCompose)
    const url = new URL(window.location.href)
    const w = url.searchParams.get('write')
    if (w) {
      // `?write=1` (the phone input bar's « Écrire »): open the empty form; otherwise a `#id` mention.
      if (w === '1') openComposerRef.current()
      else prefill(w)
      url.searchParams.delete('write')
      window.history.replaceState(null, '', url.toString())
    }
    return () => window.removeEventListener(JOURNAL_COMPOSE_EVENT, onCompose)
  }, [])
  const isToday = day === calendarDayInParisFromIso(new Date().toISOString())

  useEffect(() => {
    if (composeSignal > 0) openComposer()
  }, [composeSignal])

  function decide(linkId: number, accept: boolean) {
    startTransition(async () => {
      const res = await decideJournalLink(linkId, accept)
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      await load()
    })
  }

  function toggleHidden(id: number, hidden: boolean) {
    startTransition(async () => {
      const res = await setJournalEntryHidden(id, hidden)
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      await load()
    })
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  // Voice notes not yet carried by a transcript entry sit among the entries, by time.
  const pendingVoices = (data?.voices ?? []).filter((v) => !v.hasEntry)
  // Inspiration photos (R1 / R2) sit among the entries too, by time (empty until their SQL is live).
  const dayItems: Array<{
    at: string
    entry?: Extras['entries'][number]
    voice?: Extras['voices'][number]
    photo?: Extras['inspirations'][number]
  }> = [
    ...(data?.entries ?? []).map((e) => ({ at: e.created_at, entry: e })),
    ...pendingVoices.map((v) => ({ at: v.created_at, voice: v })),
    ...(data?.inspirations ?? []).map((p) => ({ at: p.created_at, photo: p })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  function removePhoto(id: string) {
    startTransition(async () => {
      const res = await removeInspirationPhoto(id)
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      setDeleteAsk(null)
      toast.success(t('insp_deleted'))
      await load()
    })
  }

  function removeVoice(noteId: string) {
    startTransition(async () => {
      const res = await deleteVoiceNote(noteId)
      if ('error' in res) {
        toast.error(res.error === 'admin_only' ? t('je_voice_delete_admin') : t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      setDeleteAsk(null)
      setLinkOpen(null)
      toast.success(t('je_voice_deleted'))
      await load()
    })
  }

  /**
   * « Relier » toggle + panel for a voice note (owner or admin: the server checks), its linked work as a
   * preview chip (R4: a work number never travels alone), and « Supprimer » behind a confirm step.
   * `canDelete`: the author or an admin for a note no entry carries yet; an admin once a transcript
   * entry carries it (that entry is hidden, never erased — deleteVoiceNote).
   */
  const linkBlock = (
    noteId: string,
    links: NonNullable<Extras['entries'][number]['voiceLinks']>,
    { canDelete, hasEntry }: { canDelete: boolean; hasEntry: boolean },
  ) => {
    const tags = [
      links.concept_id ? t('je_voice_link_idea') : null,
      links.process_id ? t('notes_triage_process') : null,
      links.condition_report_id != null ? t('notes_triage_constat') : null,
    ].filter(Boolean)
    const open = linkOpen === noteId
    const asking = deleteAsk === noteId
    return (
      <>
        {links.oeuvre_id != null ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }} data-testid={`voice-linked-work-${noteId}`}>
            <WorkChip id={links.oeuvre_id} href={workHref(links.oeuvre_id)} size="chip" />
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn ghost sm"
            aria-expanded={open}
            data-testid={`voice-link-toggle-${noteId}`}
            onClick={() => setLinkOpen(open ? null : noteId)}
            style={{ minHeight: 44 }}
          >
            {t(open ? 'je_voice_link_close' : 'je_voice_link')}
          </button>
          {canDelete && !asking ? (
            <button
              type="button"
              className="btn ghost sm"
              data-testid={`voice-delete-${noteId}`}
              disabled={pending}
              onClick={() => setDeleteAsk(noteId)}
              style={{ minHeight: 44 }}
            >
              {t('je_voice_delete')}
            </button>
          ) : null}
          {tags.length ? (
            <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', overflowWrap: 'anywhere' }}>
              {t('je_voice_linked_fmt').replace('{list}', tags.join(' · '))}
            </span>
          ) : null}
        </div>
        {asking ? (
          <div
            role="alertdialog"
            aria-label={t('je_voice_delete')}
            data-testid={`voice-delete-ask-${noteId}`}
            style={{ marginTop: 8, padding: 10, border: '1px solid var(--rust)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{t(hasEntry ? 'je_voice_delete_ask_entry' : 'je_voice_delete_ask')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className="btn sm"
                data-testid={`voice-delete-yes-${noteId}`}
                disabled={pending}
                onClick={() => removeVoice(noteId)}
                style={{ minHeight: 44, color: 'var(--rust)', borderColor: 'var(--rust)' }}
              >
                {t('je_voice_delete_yes')}
              </button>
              <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setDeleteAsk(null)} style={{ minHeight: 44 }}>
                {t('je_voice_delete_no')}
              </button>
            </div>
          </div>
        ) : null}
        {open ? <VoiceNoteLinkPanel noteId={noteId} links={links} onChanged={() => void load()} /> : null}
      </>
    )
  }

  return (
    <div data-testid="journal-day-extras" style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
      <VoiceNoteSheet
        open={voiceOpen}
        onClose={() => {
          setVoiceOpen(false)
          void load()
        }}
        onSaved={() => void load()}
      />
      {/* Phone: the sticky input bar (PhoneInputBar) replaces this row (R2 design, field map). */}
      {narrow ? null : (
      <div
        data-testid="journal-quick-row"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${onCapture ? 4 : 3}, minmax(0, 1fr))`, gap: 8 }}
      >
        {(
          [
            { id: 'write', emoji: '✍️', label: t('je_quick_write'), on: openComposer },
            {
              id: 'dictate',
              emoji: '🎙',
              label: t(listening ? 'je_dictate_stop' : 'je_quick_dictate'),
              on: () => {
                setComposing(true)
                void toggleDictation()
              },
            },
            { id: 'voice', emoji: '🎤', label: t('je_quick_voice'), on: () => setVoiceOpen(true) },
            ...(onCapture ? [{ id: 'capture', emoji: '📷', label: t('je_quick_capture'), on: onCapture }] : []),
          ] as Array<{ id: string; emoji: string; label: string; on: () => void }>
        ).map((b) => (
          <button
            key={b.id}
            type="button"
            className="btn ghost"
            data-testid={`journal-quick-${b.id}`}
            onClick={b.on}
            style={{
              minHeight: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 4px',
              whiteSpace: 'normal',
              ...(b.id === 'dictate' && listening ? { color: 'var(--rust)', borderColor: 'var(--rust)' } : {}),
            }}
          >
            <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>
              {b.emoji}
            </span>
            <span style={{ fontSize: 10, lineHeight: 1.15, textAlign: 'center' }}>{b.label}</span>
          </button>
        ))}
      </div>
      )}

      {isToday ? <SeeAgainCard context="journal" /> : null}

      <section>
        <h2 className="t-eyebrow" style={{ marginBottom: 12, color: 'var(--tx3)' }}>
          {t('je_heading')}
        </h2>
        {data && dayItems.length === 0 ? (
          <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: '0 0 12px' }}>
            {t('je_empty')}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {dayItems.map(({ entry: e, voice: v, photo: p }) =>
            p ? (
            <article
              key={`photo-${p.id}`}
              data-testid={`journal-inspiration-${p.id}`}
              style={{ borderLeft: '3px solid var(--bd)', background: 'var(--bg1)', borderRadius: '0 8px 8px 0', padding: '12px 14px' }}
            >
              <div className="t-mono-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
                <span style={{ color: 'var(--ac)' }}>✦ {t('insp_label')}</span>
                <span>
                  {p.author} · {time(p.created_at)}
                </span>
              </div>
              {/* Hover (desk) / hold (phone) = the picture large, like a work chip (Pem 2026-11-21); a click still opens it in a tab. */}
              {/* Picture and its text side by side on the desk, stacked on the phone (Pem 2026-11-21: « a text box beside the capture »). */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
                <ImageLoupe file={p.image_key} alt={p.caption ?? ''} caption={p.caption?.trim() || undefined} style={{ flex: '0 1 320px', minWidth: 0, maxWidth: '100%' }}>
                  <a href={imageUrl(p.image_key) ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- R2 AVIF thumb (400 px), like the other Journal pictures */}
                    <img src={thumbUrl(p.image_key) ?? undefined} alt={p.caption ?? ''} loading="lazy" style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 6, background: 'var(--bg2)' }} />
                  </a>
                </ImageLoupe>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <InspirationText
                    id={p.id}
                    caption={p.caption}
                    canEdit={!!data?.isAdmin}
                    render={(text) => <EntryText text={text} />}
                    onSaved={(caption) =>
                      setData((d) => (d ? { ...d, inspirations: d.inspirations.map((x) => (x.id === p.id ? { ...x, caption } : x)) } : d))
                    }
                  />
                </div>
              </div>
              {p.oeuvre_id != null || p.concept_id ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, alignItems: 'center' }}>
                  {p.oeuvre_id != null ? <WorkChip id={p.oeuvre_id} href={workHref(p.oeuvre_id)} size="chip" /> : null}
                  {p.concept_id ? (
                    <Link href={`/atelier/concepts?concept=${p.concept_id}`} className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      {t('je_concept_prefix')} {p.conceptTitle ?? '—'}
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {data?.isAdmin ? (
                deleteAsk === p.id ? (
                  <div role="alertdialog" aria-label={t('je_voice_delete')} style={{ marginTop: 8, padding: 10, border: '1px solid var(--rust)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{t('insp_delete_ask')}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button type="button" className="btn sm" disabled={pending} onClick={() => removePhoto(p.id)} style={{ minHeight: 44, color: 'var(--rust)', borderColor: 'var(--rust)' }}>
                        {t('je_voice_delete_yes')}
                      </button>
                      <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setDeleteAsk(null)} style={{ minHeight: 44 }}>
                        {t('je_voice_delete_no')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setDeleteAsk(p.id)} style={{ minHeight: 44, marginTop: 8 }}>
                    {t('je_voice_delete')}
                  </button>
                )
              ) : null}
            </article>
            ) : v ? (
            <article
              key={`voice-${v.id}`}
              data-testid={`journal-voice-${v.id}`}
              style={{ borderLeft: '3px solid var(--bd)', background: 'var(--bg1)', borderRadius: '0 8px 8px 0', padding: '12px 14px' }}
            >
              <div className="t-mono-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
                <span style={{ color: 'var(--ac)' }}>{t('je_kind_voice')}</span>
                <span>
                  {v.author} · {time(v.created_at)}
                  {v.duration_ms != null ? ` · ${formatVoiceDuration(v.duration_ms)}` : ''}
                </span>
                {v.audioKey && !v.transcript?.trim() ? <span>{t('je_voice_waiting')}</span> : null}
              </div>
              {v.subject?.trim() ? (
                <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{v.subject}</p>
              ) : null}
              {v.audioKey ? (
                <audio controls preload="none" src={imageUrl(v.audioKey) ?? undefined} style={{ width: '100%', maxWidth: 480, margin: '2px 0 8px' }} />
              ) : null}
              {v.transcript?.trim() ? <EntryText text={v.transcript} /> : null}
              {linkBlock(v.id, v, { canDelete: v.mine || !!data?.isAdmin, hasEntry: false })}
            </article>
            ) : e ? (
            <article
              key={e.id}
              data-testid={`journal-entry-${e.id}`}
              style={{
                borderLeft: '3px solid var(--ac)',
                background: 'var(--bg1)',
                borderRadius: '0 8px 8px 0',
                padding: '12px 14px',
                opacity: e.hidden ? 0.5 : 1,
              }}
            >
              <div className="t-mono-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
                <span style={{ color: 'var(--ac)' }}>{kindLabel(e.kind, t)}</span>
                <span>
                  {e.author} · {time(e.created_at)}
                </span>
                {e.event_precision === 'month' ? <span>{t('je_roughly_month')}</span> : null}
                {e.event_precision === 'year' ? <span>{t('je_roughly_year')}</span> : null}
                {e.visibility === 'private' ? <span>{t('je_private_label')}</span> : null}
                {e.original && e.verification !== 'unverified' ? (
                  <span data-testid={`journal-entry-corrected-${e.id}`}>{t('je_fix_corrected')} · {t('je_verified_label')}</span>
                ) : e.engine ? (
                  <span data-testid={`journal-entry-transcript-${e.id}`}>
                    ✦ {t('je_transcript_label')} · {e.engine} · {t(e.verification === 'unverified' ? 'je_unverified_label' : 'je_verified_label')}
                  </span>
                ) : (
                  <>
                    {e.provenance === 'voice' ? <span>{t('je_dictated_label')}</span> : null}
                    {e.verification === 'unverified' ? <span>{t('je_unverified_label')}</span> : null}
                  </>
                )}
                {e.hidden ? <span>{t('je_hidden_label')}</span> : null}
              </div>
              {e.voiceLinks?.subject?.trim() ? (
                <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{e.voiceLinks.subject}</p>
              ) : null}
              {e.audioKey ? (
                <audio controls preload="none" src={imageUrl(e.audioKey) ?? undefined} style={{ width: '100%', maxWidth: 480, margin: '2px 0 8px' }} data-testid={`journal-entry-audio-${e.id}`} />
              ) : null}
              {isNothingHeard(e) ? <p style={{ margin: '4px 0', color: 'var(--tx3)' }}>{t('js_nothing_heard')}</p> : isWaitingTranscript(e) ? <p style={{ margin: '4px 0', color: 'var(--tx3)' }}>{t('js_waiting')}</p> : <EntryText text={e.body} />}
              <CorrectedOriginal original={e.original} />
              {e.concepts.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {e.concepts.map((c) => (
                    <Link key={c.id} href={`/atelier/concepts?concept=${c.id}`} className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      {t('je_concept_prefix')} {c.title ?? '—'}
                    </Link>
                  ))}
                </div>
              ) : null}
              {e.works.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {e.works.map((w) => (
                    <WorkChip key={w.id} id={w.id} href={workHref(w.id)} title={w.title} size="chip" />
                  ))}
                </div>
              ) : null}
              {e.proposals.length > 0 ? (
                <div data-testid={`journal-entry-proposals-${e.id}`} style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--bd)' }}>
                  <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
                    {t('je_ai_proposals')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {e.proposals.map((p) => (
                      <div key={p.linkId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        {p.workId != null ? (
                          // A work: the shared #id preview + loupe, like the confirmed links above (TODO B12, Pem 2026-11-16).
                          // R4: thumbnail + title, hold / hover = the picture with its caption.
                          <WorkChip id={p.workId} href={workHref(p.workId)} title={p.title} sub={t('je_ai_proposals')} style={{ flex: '1 1 160px' }} />
                        ) : (
                          // A concept: unfold its text here (Pem 2026-11-18: « preview rather than leave the journal »).
                          <ConceptPreviewToggle conceptId={p.conceptId} title={p.title} />
                        )}
                        {data?.isAdmin ? (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="btn ghost sm" disabled={pending} onClick={() => decide(p.linkId, true)} style={{ minHeight: 44 }}>
                              {t('je_ai_accept')}
                            </button>
                            <button type="button" className="btn ghost sm" disabled={pending} onClick={() => decide(p.linkId, false)} style={{ minHeight: 44 }}>
                              {t('je_ai_reject')}
                            </button>
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {data?.isAdmin ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {canCorrectEntry(e) ? <EntryCorrectAction key={`${e.id}:${e.body.length}`} entry={e} onDone={load} startEmpty={isNothingHeard(e)} label={isNothingHeard(e) ? t('js_write_said') : undefined} /> : null}
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={pending}
                    onClick={() => toggleHidden(e.id, !e.hidden)}
                    style={{ minHeight: e.engine ? 44 : 36 }}
                  >
                    {t(e.hidden ? 'je_unhide' : 'je_hide')}
                  </button>
                </div>
              ) : null}
              {e.voiceNoteId && e.voiceLinks ? linkBlock(e.voiceNoteId, e.voiceLinks, { canDelete: !!data?.isAdmin && !e.hidden, hasEntry: true }) : null}
            </article>
            ) : null,
          )}
        </div>

        {composing || body ? (
        <div
          data-testid="journal-entry-form"
          style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <p className="t-eyebrow" style={{ margin: 0, color: 'var(--tx3)' }}>
            {t('je_add_heading')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, flex: '1 1 140px' }}>
              {t('je_kind_label')}
              <select className="input" value={kind} onChange={(ev) => setKind(ev.target.value as Kind)} style={{ minHeight: 44 }}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(KIND_KEY[k])}
                  </option>
                ))}
              </select>
            </label>
            <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, flex: '1 1 140px' }}>
              {t('je_precision_label')}
              <select
                className="input"
                value={precision}
                onChange={(ev) => setPrecision(ev.target.value as 'day' | 'month' | 'year')}
                style={{ minHeight: 44 }}
              >
                <option value="day">{t('je_precision_day')}</option>
                <option value="month">{t('je_precision_month')}</option>
                <option value="year">{t('je_precision_year')}</option>
              </select>
            </label>
          </div>
          {data && data.conceptOptions.length > 0 ? (
            <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              {t('je_concept_label')}
              <select
                className="input"
                data-testid="journal-entry-concept"
                value={conceptId}
                onChange={(ev) => setConceptId(ev.target.value)}
                style={{ minHeight: 44 }}
              >
                <option value="">{t('je_concept_none')}</option>
                {data.conceptOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            {t('je_body_label')}
            <textarea
              className="input"
              id="journal-entry-body"
              data-testid="journal-entry-body"
              rows={4}
              value={body}
              // Same cap as `createJournalEntry` (MAX_BODY): the box stops there instead of the save cutting the text unseen.
              maxLength={20_000}
              placeholder={t('je_body_placeholder')}
              onChange={(ev) => setBody(ev.target.value)}
              style={{ fontSize: 16, width: '100%', boxSizing: 'border-box' }}
            />
          </label>
          {listening ? (
            <p className="t-mono-sm" data-testid="journal-dictation-live" style={{ margin: 0, fontSize: 12, color: 'var(--ac)', overflowWrap: 'anywhere' }}>
              {interim || t('je_dictate_listening')}
            </p>
          ) : null}
          {dictated ? (
            <p className="t-mono-sm" style={{ margin: 0, fontSize: 11, color: 'var(--tx3)' }}>
              {t('je_dictated_hint')}
            </p>
          ) : null}
          <p className="t-mono-sm" style={{ margin: 0, fontSize: 11, color: 'var(--tx3)' }}>
            {t('je_append_only_hint')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn primary"
              data-testid="journal-entry-add"
              disabled={pending || !body.trim()}
              onClick={add}
              style={{ minHeight: 44, flex: '1 1 120px' }}
            >
              {t(pending ? 'je_saving' : 'je_save')}
            </button>
            <button
              type="button"
              className={listening ? 'btn sm' : 'btn ghost sm'}
              data-testid="journal-entry-dictate"
              aria-pressed={listening}
              disabled={pending}
              onClick={() => void toggleDictation()}
              style={{ minHeight: 44, flex: '1 1 120px', ...(listening ? { background: 'var(--rust)22', color: 'var(--rust)', border: '1px solid var(--rust)44' } : {}) }}
            >
              {t(listening ? 'je_dictate_stop' : 'je_dictate')}
            </button>
          </div>
        </div>
        ) : null}
      </section>

      {captureSlot}

      <details className="pem-fold" data-testid="journal-day-creation">
        <summary className="t-eyebrow" style={DETAILS_SUMMARY}>
          {t('je_creation_heading')} ({data?.creation.length ?? 0})
        </summary>
        {data && data.creation.length === 0 ? (
          <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: 0 }}>
            {t('je_creation_empty')}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(data?.creation ?? []).map((k) => (
            <article
              key={k.id}
              data-testid={`journal-creation-${k.id}`}
              style={{ borderLeft: '3px solid var(--bd)', background: 'var(--bg1)', borderRadius: '0 8px 8px 0', padding: '12px 14px' }}
            >
              <div className="t-mono-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
                <span>
                  {k.author} · {time(k.created_at)}
                </span>
                {k.done ? <span>{t('je_creation_done')}</span> : null}
              </div>
              {k.title ? (
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{k.title}</p>
              ) : null}
              {k.body ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {k.body}
                </p>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, alignItems: 'center' }}>
                {k.works.map((id) => (
                  <WorkChip key={id} id={id} href={workHref(id)} size="chip" />
                ))}
                <Link
                  href="/atelier/concepts"
                  className="t-mono-sm"
                  style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                >
                  {t('je_creation_open')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </details>

      {data?.isAdmin ? (
        <details className="pem-fold" data-testid="journal-day-changes">
          <summary className="t-eyebrow" style={DETAILS_SUMMARY}>
            {t('je_changes_heading')} ({data.changes.length})
          </summary>
          {data.changes.length === 0 ? (
            <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: 0 }}>
              {t('je_changes_empty')}
            </p>
          ) : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.changes.map((c) => (
              <li key={c.oeuvre_id} className="t-mono-sm" style={{ fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                <WorkChip id={c.oeuvre_id} href={workHref(c.oeuvre_id)} title={c.title} sub={c.fields.map((f) => versionFieldLabel(f, t)).join(', ')} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

/** ✦ concept suggestion: click unfolds the concept (title, text, notes) in place; « Ouvrir dans Idées » stays available. */
function ConceptPreviewToggle({ conceptId, title }: { conceptId: string | null; title: string | null }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ConceptPreview | null>(null)
  const [failed, setFailed] = useState(false)
  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next || data || !conceptId) return
    setFailed(false)
    const res = await fetchConceptPreview(conceptId)
    if ('error' in res) setFailed(true)
    else setData(res)
  }
  return (
    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        className="t-mono-sm"
        style={{ background: 'none', border: 0, padding: '6px 0', minHeight: 44, cursor: 'pointer', color: 'var(--tx2)', textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 2, overflowWrap: 'anywhere' }}
      >
        {open ? '▾' : '▸'} ✦ {t('je_concept_prefix')} {data?.titre ?? title ?? ''}
      </button>
      {open ? (
        <div style={{ margin: '2px 0 6px', padding: '10px 12px', border: '1px solid var(--bd)', background: 'var(--bg1)', fontSize: 14, lineHeight: 1.5 }}>
          {failed ? (
            <span style={{ color: 'var(--rust)' }}>{t('je_concept_preview_error')}</span>
          ) : !data ? (
            <span style={{ color: 'var(--tx3)' }}>…</span>
          ) : (
            <>
              <div style={{ color: 'var(--tx)', fontWeight: 600 }}>{data.titre}</div>
              {data.medium ? <div style={{ color: 'var(--tx3)', fontSize: 12 }}>{data.medium}</div> : null}
              {data.description ? <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', color: 'var(--tx2)' }}>{data.description}</p> : null}
              {data.notes ? <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', color: 'var(--tx3)', fontSize: 13 }}>{data.notes.length > 600 ? `${data.notes.slice(0, 600)}…` : data.notes}</p> : null}
              {!data.description && !data.notes ? <div style={{ color: 'var(--tx3)', fontSize: 13, marginTop: 4 }}>{t('je_concept_preview_empty')}</div> : null}
              <Link href={`/atelier/concepts?concept=${data.id}`} className="t-mono-sm" style={{ display: 'inline-block', marginTop: 8, color: 'var(--ac)' }}>
                {t('je_concept_open_ideas')}
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
