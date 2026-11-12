'use client'

// Journal day page — entries, Kaizen Création items, voice notes, works changed of one Paris calendar day.
// Création items are read from `kaizen_item` (never copied; owner 2026-11-12).
// Build step 1 (owner GO 2026-11-12, docs/JOURNAL_PROPOSAL.md). Rules are in the DB
// (supabase/sql/journal_entry.sql): append only, never deleted, hide = admin.

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { EntryText } from '@/components/atelier/journal/EntryText'
import { getLiveDictationAvailability, startLiveDictation, type LiveDictationSession } from '@/lib/voice/web-speech'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import {
  createJournalEntry,
  decideJournalLink,
  getJournalDayExtras,
  setJournalEntryHidden,
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

export function JournalDayExtras({ day, locale }: { day: string; locale: string }) {
  const { t, lang } = useI18n()
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

  return (
    <div data-testid="journal-day-extras" style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 32 }}>
      <section>
        <h2 className="t-eyebrow" style={{ marginBottom: 12, color: 'var(--tx3)' }}>
          {t('je_heading')}
        </h2>
        {data && data.entries.length === 0 ? (
          <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: '0 0 12px' }}>
            {t('je_empty')}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {(data?.entries ?? []).map((e) => (
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
                {e.provenance === 'voice' ? <span>{t('je_dictated_label')}</span> : null}
                {e.verification === 'unverified' ? <span>{t('je_unverified_label')}</span> : null}
                {e.hidden ? <span>{t('je_hidden_label')}</span> : null}
              </div>
              <EntryText text={e.body} />
              {e.concepts.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {e.concepts.map((c) => (
                    <Link key={c.id} href="/atelier/concepts" className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      {t('je_concept_prefix')} {c.title ?? '—'}
                    </Link>
                  ))}
                </div>
              ) : null}
              {e.works.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {e.works.map((w) => (
                    <Link key={w.id} href={workHref(w.id)} className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      #{w.id}
                      {w.title ? ` ${w.title}` : ''}
                    </Link>
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
                        <Link
                          href={p.workId != null ? workHref(p.workId) : '/atelier/concepts'}
                          className="t-mono-sm"
                          style={{ color: 'var(--tx2)', textDecoration: 'underline', textUnderlineOffset: 2, flex: '1 1 160px', overflowWrap: 'anywhere' }}
                        >
                          ✦ {p.workId != null ? `#${p.workId}` : t('je_concept_prefix')} {p.title ?? ''}
                        </Link>
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
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={pending}
                  onClick={() => toggleHidden(e.id, !e.hidden)}
                  style={{ marginTop: 8, minHeight: 36 }}
                >
                  {t(e.hidden ? 'je_unhide' : 'je_hide')}
                </button>
              ) : null}
            </article>
          ))}
        </div>

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
      </section>

      <section data-testid="journal-day-creation">
        <h2 className="t-eyebrow" style={{ marginBottom: 12, color: 'var(--tx3)' }}>
          {t('je_creation_heading')}
        </h2>
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
                  <Link key={id} href={workHref(id)} className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                    #{id}
                  </Link>
                ))}
                <Link
                  href="/atelier/kaizen"
                  className="t-mono-sm"
                  style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                >
                  {t('je_creation_open')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section data-testid="journal-day-voices">
        <h2 className="t-eyebrow" style={{ marginBottom: 12, color: 'var(--tx3)' }}>
          {t('je_voices_heading')}
        </h2>
        {data && data.voices.length === 0 ? (
          <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: 0 }}>
            {t('je_voices_empty')}
          </p>
        ) : null}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(data?.voices ?? []).map((v) => (
            <li key={v.id} className="t-mono-sm" style={{ fontSize: 12, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, overflowWrap: 'anywhere' }}>
              <Link href="/atelier/notes" style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                {v.subject?.trim() || t('je_voice_untitled')}
              </Link>
              <span style={{ color: 'var(--tx3)' }}>· {time(v.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      {data?.isAdmin ? (
        <section data-testid="journal-day-changes">
          <h2 className="t-eyebrow" style={{ marginBottom: 12, color: 'var(--tx3)' }}>
            {t('je_changes_heading')}
          </h2>
          {data.changes.length === 0 ? (
            <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: 0 }}>
              {t('je_changes_empty')}
            </p>
          ) : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.changes.map((c) => (
              <li key={c.oeuvre_id} className="t-mono-sm" style={{ fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                <Link href={workHref(c.oeuvre_id)} style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  #{c.oeuvre_id}
                  {c.title ? ` ${c.title}` : ''}
                </Link>
                <span style={{ color: 'var(--tx3)' }}> — {c.fields.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
