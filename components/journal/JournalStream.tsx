'use client'

// The Journal stream (design docs/design/2026-11-22/JournalDesign.md, mockup Journal_Mockup.html).
// One list of days, newest first; inside a day, cards in the order they were noted. Each day opens with a
// sticky divider that is also its summary; tapping it folds the day. Older days load as the list is
// scrolled (`/api/journal/stream`). A time scale shrinks the list to one line per day (« Mois ») or one
// line per month (« Années »): two-finger pinch on the phone, a switch on the desk. Each card shows one
// main action — the thing it needs now — and the rest under « ⋯ » (§7 of the design).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { AuthorBadges } from '@/components/shared/AuthorBadge'
import { toast } from '@/lib/ui/toast'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { imageUrl, thumbUrl } from '@/lib/data'
import { JournalDayMoments } from '@/components/atelier/journal/JournalDayMoments'
import { WorkRef } from '@/components/atelier/WorkRef'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { EntryText } from '@/components/atelier/journal/EntryText'
import { CorrectedOriginal } from '@/components/atelier/journal/CorrectedOriginal'
import { InspirationText } from '@/components/atelier/journal/InspirationText'
import { WorkRefText } from '@/components/atelier/journal/WorkRefText'
import { EntryCorrectAction, canCorrectEntry } from '@/components/atelier/journal/EntryCorrection'
import { VoiceNoteLinkPanel } from '@/components/atelier/journal/VoiceNoteLinkPanel'
import { versionFieldLabel } from '@/lib/oeuvre-version-fields'
import { isNothingHeard, isPlaceholderText, isWaitingTranscript } from '@/lib/journal/nothing-heard'
import { CaptureQueueFlusher, QueuedCaptureCards } from '@/components/journal/CaptureQueue'
import { addJournalLabel, addJournalSuite, moveJournalEntry, removeJournalLabel } from '@/app/atelier/(portal)/journal/step-b-actions'
import { JOURNAL_LABELS } from '@/lib/journal/labels'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import { PlantIdeaSheet } from '@/components/atelier/concepts/PlantIdeaSheet'
import {
  decideJournalLink,
  setJournalEntryHidden,
  type JournalDayEntry,
  type JournalDayVoice,
  type VoiceNoteLinks,
} from '@/app/atelier/(portal)/journal/entry-actions'
import { deleteVoiceNote } from '@/app/atelier/(portal)/notes/actions'
import { removeInspirationPhoto } from '@/app/atelier/capture/inspiration-actions'
import type { InspirationPhoto } from '@/lib/inspiration-photo'
import type { JournalScaleRow, JournalStreamDay, JournalStreamPage } from '@/lib/journal/stream'

type Scale = 0 | 1 | 2

/** What the desk rail shows for the card clicked (design §4 desk step 4). */
export type JournalSelection = {
  key: string
  day: string
  at: string
  kind: 'entry' | 'voice' | 'photo' | 'remark' | 'creation' | 'session'
  text: string
  works: Array<{ id: number; title: string | null; thumb: string | null }>
  concepts: Array<{ id: string; title: string | null }>
  proposals: JournalDayEntry['proposals']
}
type Act = () => Promise<{ ok: true } | { error: string }>

const workHref = (id: number) => `/atelier/inventory?work=${id}`

function thumbOf(file: string | null): string | null {
  return thumbUrl(file) ?? null
}

/** A work's small square picture (or a blank square when it has none). */
function Thumb({ file, size = 22, round = false }: { file: string | null; size?: number; round?: boolean }) {
  const src = thumbOf(file)
  const style: CSSProperties = { width: size, height: size, borderRadius: round ? '50%' : 4, flex: 'none', objectFit: 'cover', background: 'var(--bg3)', display: 'inline-block' }
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" loading="lazy" style={style} /> : <span aria-hidden="true" style={style} />
}

function useFormat() {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  const dayLong = (day: string, today: string) => {
    const s = new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
    })
    return s.replace(/^./, (c) => c.toUpperCase())
  }
  const shortDay = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', ...(day.slice(0, 4) !== new Date().getFullYear().toString() ? { year: 'numeric' } : {}) })
  const month = (bucket: string) => new Date(`${bucket}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', month: 'long' })
  return { t, time, dayLong, month, locale, shortDay }
}

/** `changes`: works changed that day (admin, from the day's own cards — not part of the database counts). */
function countsLine(c: JournalScaleRow, changes = 0, ideas = 0): ReactNode {
  const parts: string[] = []
  const notes = c.entries + c.remarks + c.creation
  if (notes) parts.push(`✍ ${notes}`)
  if (c.voices) parts.push(`🎤 ${c.voices}`)
  if (c.photos) parts.push(`📷 ${c.photos}`)
  if (c.sessionWorks) parts.push(`🖼 ${c.sessionWorks}`)
  if (changes) parts.push(`✎ ${changes}`)
  const ideaLines = ideas || c.ideas || 0
  if (ideaLines) parts.push(`🌱 ${ideaLines}`)
  return (
    <>
      {parts.join(' · ')}
      {c.proposals ? <span style={{ color: 'var(--ac)' }}>{parts.length ? ' · ' : ''}✦ {c.proposals}</span> : null}
    </>
  )
}

/** The works a day mentions, each once (session works, linked works, remarks), for its divider. */
function dayWorks(d: JournalStreamDay): Array<{ id: number; thumb: string | null }> {
  const out = new Map<number, string | null>()
  for (const w of d.sessionWorks) if (w.id != null && !out.has(w.id)) out.set(w.id, w.thumb)
  for (const r of d.extras.remarks) if (r.oeuvreId != null && !out.has(r.oeuvreId)) out.set(r.oeuvreId, r.workThumb)
  for (const e of d.extras.entries) for (const w of e.works) if (!out.has(w.id)) out.set(w.id, w.thumb ?? null)
  for (const p of d.extras.inspirations) for (const w of p.works ?? []) if (!out.has(w.id)) out.set(w.id, w.thumb ?? null)
  return [...out].map(([id, thumb]) => ({ id, thumb }))
}

/* ───────────────────────────── cards ───────────────────────────── */

const cardStyle: CSSProperties = { border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--bg2)', padding: '10px 12px', position: 'relative', minWidth: 0 }
const metaStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--tx3)', minHeight: 20 }
const textStyle: CSSProperties = { margin: '6px 0 4px', fontSize: 15, lineHeight: 1.5, overflowWrap: 'anywhere' }
const quietBtn: CSSProperties = { minWidth: 44, minHeight: 44, background: 'none', border: 0, color: 'var(--tx3)', cursor: 'pointer', borderRadius: 8, fontSize: 18 }
const chipStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--bd2)', borderRadius: 999, padding: '2px 9px 2px 3px', fontSize: 12, color: 'var(--tx2)', textDecoration: 'none', maxWidth: '100%' }

type MenuItem = { key: string; label: string; on: () => void; danger?: boolean }

/** « ⋯ » and its menu: everything that is not the card's main action. */
function MoreMenu({ items, testId }: { items: MenuItem[]; testId: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  if (!items.length) return null
  return (
    <div ref={ref} style={{ marginLeft: 'auto', position: 'relative' }}>
      <button type="button" aria-label={t('js_more')} aria-expanded={open} data-testid={testId} onClick={() => setOpen((v) => !v)} style={quietBtn}>
        ⋯
      </button>
      {open ? (
        <div role="menu" style={{ position: 'absolute', right: 0, bottom: '100%', zIndex: 30, background: 'var(--bg1)', border: '1px solid var(--bd2)', borderRadius: 10, minWidth: 210, padding: 4, boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                it.on()
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '10px 12px', minHeight: 44, borderRadius: 7, cursor: 'pointer', color: it.danger ? 'var(--rust)' : 'var(--tx)', borderTop: it.danger ? '1px solid var(--bd)' : undefined }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** A red confirm row under a card (delete). */
function ConfirmRow({ text, yes, onYes, onNo, pending }: { text: string; yes: string; onYes: () => void; onNo: () => void; pending: boolean }) {
  const { t } = useI18n()
  return (
    <div role="alertdialog" aria-label={yes} style={{ marginTop: 8, padding: 10, border: '1px solid var(--rust)', borderRadius: 8, display: 'grid', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{text}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn sm" disabled={pending} onClick={onYes} style={{ minHeight: 44, color: 'var(--rust)', borderColor: 'var(--rust)' }}>
          {yes}
        </button>
        <button type="button" className="btn ghost sm" disabled={pending} onClick={onNo} style={{ minHeight: 44 }}>
          {t('je_voice_delete_no')}
        </button>
      </div>
    </div>
  )
}

function Audio({ file }: { file: string | null }) {
  const src = imageUrl(file)
  return src ? <audio controls preload="none" src={src} style={{ display: 'block', width: '100%', margin: '6px 0', height: 36 }} /> : null
}

/** Works, ideas and people a card is linked to, as chips. */
function ChipRow({
  works,
  concepts,
  people,
}: {
  works?: Array<{ id: number }>
  concepts?: Array<{ id: string; title: string | null }>
  people?: Array<{ id: number; name: string }>
}) {
  if (!works?.length && !concepts?.length && !people?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 2px' }}>
      {(works ?? []).map((w) => (
        <WorkRef key={w.id} id={w.id} href={workHref(w.id)} style={chipStyle} />
      ))}
      {(concepts ?? []).map((c) => (
        <a key={c.id} href={`/atelier/concepts?concept=${c.id}`} style={{ ...chipStyle, padding: '2px 9px', borderStyle: 'dashed' }}>
          ✦ {c.title ?? '—'}
        </a>
      ))}
      {(people ?? []).map((q) => (
        <a key={q.id} href={`/atelier/contacts?contact=${q.id}`} data-testid={`js-person-${q.id}`} style={{ ...chipStyle, padding: '2px 9px' }}>
          @ {q.name}
        </a>
      ))}
    </div>
  )
}

function originLabel(e: JournalDayEntry, t: (k: never) => string): string {
  const tt = t as unknown as (k: string) => string
  if (e.provenance === 'typed') return tt('js_origin_typed')
  if (e.provenance === 'voice') return tt('js_origin_voice')
  if (e.provenance === 'import') return tt('js_origin_import')
  return tt('js_origin_other')
}

/** A Journal entry (typed, dictated, imported; a voice note's transcript). */
export function EntryCard({
  e,
  isAdmin,
  run,
  refresh,
  pending,
  today,
  reloadTop,
}: {
  e: JournalDayEntry
  isAdmin: boolean
  run: (fn: Act, done?: string) => void
  refresh: () => Promise<void>
  pending: boolean
  today: string
  /** Reads the newest days again (a suite lands on today, a move on another day). */
  reloadTop: () => Promise<void>
}) {
  const { t, time, shortDay } = useFormat()
  const [linkOpen, setLinkOpen] = useState(false)
  const [fixOpen, setFixOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const [panel, setPanel] = useState<'labels' | 'suite' | 'move' | 'idea' | null>(null)
  const [suiteText, setSuiteText] = useState('')
  const [moveDay, setMoveDay] = useState(e.event_on)
  const [movePrecision, setMovePrecision] = useState<'day' | 'month' | 'year'>((e.event_precision as 'day' | 'month' | 'year') || 'day')
  const [busy, setBusy] = useState(false)
  const errText = (code: string) =>
    code === 'not_allowed'
      ? t('js_err_not_allowed')
      : code === 'same_day'
        ? t('js_err_same_day')
        : code === 'bad_day'
          ? t('js_err_bad_day')
          : /journal_entry_label|journal_move_entry|target_entry_id|schema cache|does not exist/.test(code)
            ? t('js_err_step_b')
            : t('je_err_fmt').replace('{msg}', code)
  const step = async (fn: () => Promise<{ ok: true } | { error: string }>, done: string | null, after: () => Promise<void>) => {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if ('error' in res) {
      toast.error(errText(res.error))
      return false
    }
    if (done) toast.success(done)
    await after()
    return true
  }
  const labelName = (l: string) => t(`js_label_${l}` as never)
  const canMove = (e.mine || isAdmin) && !e.hidden
  const correctable = isAdmin && canCorrectEntry(e) && !e.hidden
  // Not checked by a person: the phone's words, an import, or the PC transcript shown as a correction.
  const unchecked = e.verification === 'unverified'
  const proposal = isAdmin ? e.proposals[0] : undefined
  const noteId = e.voiceNoteId
  const links: VoiceNoteLinks | null = e.voiceLinks

  // The one main action: text read by a machine and not checked → « Vérifier · corriger »; else an open ✦.
  const nothing = isNothingHeard(e)
  const waiting = isWaitingTranscript(e)
  let main: ReactNode = null
  if (correctable && e.pcProposal) {
    // The PC's transcript waits beside the words shown: Pem takes it or keeps his (« show the suggestion and I'll decide »).
    main = <EntryCorrectAction entry={e} primary label={t('js_see_proposal')} onDone={refresh} />
  } else if (correctable && nothing) {
    main = <EntryCorrectAction entry={e} primary startEmpty label={t('js_write_said')} onDone={refresh} />
  } else if (correctable && unchecked && !waiting) {
    main = <EntryCorrectAction entry={e} primary onDone={refresh} />
  } else if (proposal) {
    main = (
      <>
        <button
          type="button"
          className="btn primary sm"
          disabled={pending}
          data-testid={`js-accept-${proposal.linkId}`}
          onClick={() => run(() => decideJournalLink(proposal.linkId, true))}
          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', ...MAIN_ACTION_STYLE }}
        >
          ✓ {proposal.workId != null ? <Thumb file={proposal.thumb} size={20} /> : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('js_link_to').replace('{title}', proposal.title ?? t('js_link_untitled'))}</span>
        </button>
        <button type="button" aria-label={t('js_reject')} title={t('js_reject')} disabled={pending} data-testid={`js-reject-${proposal.linkId}`} onClick={() => run(() => decideJournalLink(proposal.linkId, false))} style={{ ...quietBtn, fontSize: 15 }}>
          ✕
        </button>
        {e.proposals.length > 1 ? <span style={{ fontSize: 12, color: 'var(--ac)' }}>{t('js_more_suggestions').replace('{n}', String(e.proposals.length - 1))}</span> : null}
      </>
    )
  }

  const menu: MenuItem[] = []
  if (!e.hidden) menu.push({ key: 'suite', label: t('js_menu_suite'), on: () => setPanel('suite') })
  if (canMove) menu.push({ key: 'move', label: t('js_menu_move'), on: () => setPanel('move') })
  if (!e.hidden) menu.push({ key: 'labels', label: t('js_menu_labels'), on: () => setPanel('labels') })
  // Idées (design 2026-11-23 §2): the moment stays on its day and becomes the idea's first page.
  if (!e.hidden && !nothing && !waiting) menu.push({ key: 'idea', label: t('js_menu_make_idea'), on: () => setPanel('idea') })
  if (correctable && !nothing && !waiting && !(unchecked && main)) menu.push({ key: 'fix', label: t('js_menu_fix'), on: () => setFixOpen(true) })
  if (noteId && links) menu.push({ key: 'link', label: t('js_menu_link'), on: () => setLinkOpen(true) })
  if (isAdmin) menu.push({ key: 'hide', label: t(e.hidden ? 'js_menu_unhide' : 'js_menu_hide'), on: () => run(() => setJournalEntryHidden(e.id, !e.hidden)) })
  // A voice note's entry: an admin, or its author while only their own words are on it.
  if (noteId && !e.hidden && (isAdmin || (e.mine && !e.original && !e.pcTouched && !e.engine?.startsWith('faster-whisper'))))
    menu.push({ key: 'del', label: t('js_menu_delete'), on: () => setAsking(true), danger: true })

  return (
    <article data-testid={`js-entry-${e.id}`} style={{ ...cardStyle, opacity: e.hidden ? 0.55 : 1 }}>
      <div style={metaStyle}>
        <span>{time(e.created_at)}</span>
        <span style={{ color: 'var(--ac)' }}>{t(noteId ? 'js_kind_voice' : 'js_kind_note')}</span>
        <span>{originLabel(e, t as never)}</span>
        {unchecked && e.provenance !== 'typed' ? <span style={{ color: 'var(--rust)' }}>· {t('js_unverified')}</span> : null}
        {e.original ? <span>· {t(e.verification === 'unverified' ? 'js_pc_transcript' : 'js_corrected')}</span> : null}
        {e.suiteOf ? <span style={{ color: 'var(--ac)' }}>· {t('js_suite_of').replace('{day}', shortDay(e.suiteOf.day))}</span> : null}
        {e.visibility === 'private' ? <span>· {t('js_private')}</span> : null}
        {e.hidden ? <span>· {t('js_hidden')}</span> : null}
        {!e.mine && e.author !== '—' ? <span>· {t('js_by').replace('{name}', e.author)}</span> : null}
      </div>
      {e.audioKey ? <Audio file={e.audioKey} /> : null}
      {nothing ? (
        <p style={{ ...textStyle, color: 'var(--tx3)', fontSize: 14 }}>{t('js_nothing_heard')}</p>
      ) : waiting ? (
        <p style={{ ...textStyle, color: 'var(--tx3)', fontSize: 14 }}>{t('js_waiting')}</p>
      ) : (
        <div style={textStyle}>
          <EntryText text={e.body} />
        </div>
      )}
      <CorrectedOriginal original={e.original} />
      <ChipRow works={e.works} concepts={e.concepts} people={e.people} />

      {e.labels?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 2px' }}>
          {e.labels.map((l) => (
            <span key={l.id} style={{ ...chipStyle, padding: '2px 9px', borderStyle: 'dashed' }}>
              {labelName(l.label)}
            </span>
          ))}
        </div>
      ) : null}
      {panel === 'labels' ? (
        <div data-testid={`js-labels-${e.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {JOURNAL_LABELS.map((l) => {
            const on = e.labels?.find((x) => x.label === l)
            return (
              <button
                key={l}
                type="button"
                aria-pressed={!!on}
                disabled={busy}
                // The label Idée and the idea are one gesture (Pem 2026-11-23): choosing it plants the idea.
                onClick={() => (l === 'idea' && !on ? setPanel('idea') : void step(() => (on ? removeJournalLabel(on.id) : addJournalLabel(e.id, l)), null, refresh))}
                style={{ ...chipStyle, padding: '6px 12px', minHeight: 36, cursor: 'pointer', background: on ? 'var(--ac)' : 'none', color: on ? 'var(--bg0)' : 'var(--tx2)', borderColor: on ? 'var(--ac)' : 'var(--bd2)' }}
              >
                {labelName(l)}
              </button>
            )
          })}
          <button type="button" className="btn ghost sm" onClick={() => setPanel(null)} style={{ minHeight: 36 }}>
            {t('js_labels_done')}
          </button>
        </div>
      ) : null}
      {panel === 'suite' ? (
        <div data-testid={`js-suite-${e.id}`} style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <textarea value={suiteText} onChange={(ev) => setSuiteText(ev.target.value)} rows={3} placeholder={t('js_suite_placeholder')} autoFocus style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, padding: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn sm"
              disabled={busy || !suiteText.trim()}
              onClick={() =>
                void step(() => addJournalSuite(e.id, suiteText, today), t('js_suite_done'), async () => {
                  setSuiteText('')
                  setPanel(null)
                  await Promise.all([refresh(), reloadTop()])
                })
              }
              style={{ minHeight: 44, ...(suiteText.trim() ? MAIN_ACTION_STYLE : {}) }}
            >
              {t('js_suite_add')}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setPanel(null)} style={{ minHeight: 44 }}>
              {t('js_cancel')}
            </button>
          </div>
        </div>
      ) : null}
      {panel === 'move' ? (
        <div data-testid={`js-move-${e.id}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
            {t('js_move_day')}
            <input type="date" className="input" value={moveDay} max={today} onChange={(ev) => setMoveDay(ev.target.value)} style={{ minHeight: 44 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
            {t('js_move_precision')}
            <select className="input" value={movePrecision} onChange={(ev) => setMovePrecision(ev.target.value as 'day' | 'month' | 'year')} style={{ minHeight: 44 }}>
              <option value="day">{t('je_precision_day')}</option>
              <option value="month">{t('je_precision_month')}</option>
              <option value="year">{t('je_precision_year')}</option>
            </select>
          </label>
          <button
            type="button"
            className="btn sm"
            disabled={busy || !moveDay}
            onClick={() =>
              void step(() => moveJournalEntry(e.id, moveDay, movePrecision), t('js_move_done').replace('{day}', shortDay(moveDay)), async () => {
                setPanel(null)
                await Promise.all([refresh(), reloadTop()])
              })
            }
            style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}
          >
            {t('js_move_go')}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setPanel(null)} style={{ minHeight: 44 }}>
            {t('js_cancel')}
          </button>
        </div>
      ) : null}
      {panel === 'idea' ? (
        <div style={{ marginTop: 8 }}>
          <PlantIdeaSheet fromEntry={{ id: e.id, text: e.body }} onClose={() => setPanel(null)} onPlanted={async () => { setPanel(null); await refresh() }} />
        </div>
      ) : null}
      {fixOpen && correctable ? (
        <div style={{ marginTop: 8 }}>
          <EntryCorrectAction entry={e} onDone={async () => { setFixOpen(false); await refresh() }} label={t('js_menu_fix')} />
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {main}
        <MoreMenu items={menu} testId={`js-more-entry-${e.id}`} />
      </div>
      {asking && noteId ? (
        <ConfirmRow text={t('je_voice_delete_ask_entry')} yes={t('je_voice_delete_yes')} pending={pending} onNo={() => setAsking(false)} onYes={() => { setAsking(false); run(() => deleteVoiceNote(noteId), t('je_voice_deleted')) }} />
      ) : null}
      {linkOpen && noteId && links ? (
        <div style={{ marginTop: 8 }}>
          <VoiceNoteLinkPanel noteId={noteId} links={links} onChanged={() => void refresh()} />
          {/* The panel folds back once the links are done (Pem 2026-11-23: it could not be closed). */}
          <button type="button" className="btn ghost sm" data-testid={`js-link-close-${e.id}`} onClick={() => setLinkOpen(false)} style={{ minHeight: 44, marginTop: 6 }}>
            {t('je_voice_link_close')}
          </button>
        </div>
      ) : null}
      {e.suites?.length
        ? e.suites.map((x) => (
            <div key={x.id} data-testid={`js-suite-under-${x.id}`} style={{ margin: '8px 0 0 14px', borderLeft: '2px solid var(--ac2)', padding: '4px 0 2px 10px', fontSize: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>
                <span style={{ color: 'var(--ac)' }}>{t('js_suite')}</span> · {shortDay(x.day)}
              </div>
              <WorkRefText text={x.body} />
            </div>
          ))
        : null}
    </article>
  )
}

/** A voice note that no transcript entry carries yet. */
function VoiceCard({ v, isAdmin, run, refresh, pending }: { v: JournalDayVoice; isAdmin: boolean; run: (fn: Act, done?: string) => void; refresh: () => Promise<void>; pending: boolean }) {
  const { t, time } = useFormat()
  const [linkOpen, setLinkOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const links: VoiceNoteLinks = { subject: v.subject, oeuvre_id: v.oeuvre_id, concept_id: v.concept_id, process_id: v.process_id, condition_report_id: v.condition_report_id }
  const menu: MenuItem[] = [{ key: 'link', label: t('js_menu_link'), on: () => setLinkOpen(true) }]
  if (v.mine || isAdmin) menu.push({ key: 'del', label: t('js_menu_delete'), on: () => setAsking(true), danger: true })
  return (
    <article data-testid={`js-voice-${v.id}`} style={cardStyle}>
      <div style={metaStyle}>
        <span>{time(v.created_at)}</span>
        <span style={{ color: 'var(--ac)' }}>{t('js_kind_voice')}</span>
        {!v.mine && v.author !== '—' ? <span>· {t('js_by').replace('{name}', v.author)}</span> : null}
      </div>
      <Audio file={v.audioKey} />
      {v.transcript?.trim() ? (
        <div style={textStyle}>
          <WorkRefText text={v.transcript} />
        </div>
      ) : null}
      {v.audioKey ? <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--tx3)' }}>{t('js_waiting')}</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <MoreMenu items={menu} testId={`js-more-voice-${v.id}`} />
      </div>
      {asking ? (
        <ConfirmRow text={t('je_voice_delete_ask')} yes={t('je_voice_delete_yes')} pending={pending} onNo={() => setAsking(false)} onYes={() => { setAsking(false); run(() => deleteVoiceNote(v.id), t('je_voice_deleted')) }} />
      ) : null}
      {linkOpen ? (
        <div style={{ marginTop: 8 }}>
          <VoiceNoteLinkPanel noteId={v.id} links={links} onChanged={() => void refresh()} />
          <button type="button" className="btn ghost sm" data-testid={`js-link-close-v${v.id}`} onClick={() => setLinkOpen(false)} style={{ minHeight: 44, marginTop: 6 }}>
            {t('je_voice_link_close')}
          </button>
        </div>
      ) : null}
    </article>
  )
}

function PhotoCard({
  p,
  day,
  isAdmin,
  run,
  refresh,
  pending,
  editing,
}: {
  p: InspirationPhoto
  day: string
  isAdmin: boolean
  run: (fn: Act, done?: string) => void
  refresh: () => Promise<void>
  pending: boolean
  /** Desk: just pasted or dropped — the text box opens at once. */
  editing?: boolean
}) {
  const { t, time, shortDay } = useFormat()
  // Put on another day than the one it was added (desk drop on a past day, a capture that waited offline).
  const addedOn = calendarDayInParisFromIso(p.created_at)
  const [asking, setAsking] = useState(false)
  const src = imageUrl(p.image_key)
  const menu: MenuItem[] = []
  if (p.oeuvre_id != null) menu.push({ key: 'work', label: t('js_menu_open_work'), on: () => window.location.assign(workHref(p.oeuvre_id as number)) })
  if (isAdmin && !p.hidden) menu.push({ key: 'del', label: t('js_menu_delete'), on: () => setAsking(true), danger: true })
  // Camera facts from the file: the day it was taken when that is not this day, the time, the phone model.
  const takenIso = typeof p.meta?.taken_at === 'string' ? p.meta.taken_at : null
  const takenOk = takenIso != null && !Number.isNaN(new Date(takenIso).getTime())
  const takenDay = takenOk ? calendarDayInParisFromIso(takenIso as string) : null
  const model = typeof p.meta?.model === 'string' && p.meta.model.trim() ? p.meta.model.trim() : null
  const otherDay = takenOk && takenDay != null && takenDay !== day
  const showMeta = otherDay || !!model
  const takenPart = takenOk
    ? t(otherDay ? 'js_photo_taken_on' : 'js_photo_taken_at').replace('{d}', takenDay ? shortDay(takenDay) : '').replace('{hm}', time(takenIso as string))
    : null
  const metaText = [takenPart, model].filter(Boolean).join(' · ')
  return (
    <article data-testid={`js-photo-${p.id}`} style={{ ...cardStyle, opacity: p.hidden ? 0.55 : 1 }}>
      <div style={metaStyle}>
        <span>{time(p.created_at)}</span>
        <span style={{ color: 'var(--ac)' }}>{t('js_kind_photo')}</span>
        {addedOn && addedOn !== day ? <span data-testid={`js-photo-added-${p.id}`}>· {t('jd_added_on').replace('{day}', shortDay(addedOn))}</span> : null}
        {p.conceptTitle && !p.concepts?.length ? <span>· ✦ {p.conceptTitle}</span> : null}
        {p.author !== '—' ? <span>· {p.author}</span> : null}
        {showMeta ? <span data-testid={`js-photo-meta-${p.id}`}>· {metaText}</span> : null}
      </div>
      {p.hidden ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, margin: '6px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--tx3)' }}>{t('js_photo_removed_line')}</span>
          {p.entryId != null ? (
            <button type="button" className="btn sm" disabled={pending} data-testid={`js-photo-restore-${p.id}`} onClick={() => run(() => setJournalEntryHidden(p.entryId as number, false), t('js_photo_restored'))} style={{ minHeight: 44 }}>
              {t('js_photo_restore')}
            </button>
          ) : null}
        </div>
      ) : null}
      {/* Hold = the picture large (same piece as the day page); a tap opens it in a tab. */}
      <ImageLoupe file={p.image_key} alt={p.caption ?? ''} caption={p.caption?.trim() || undefined} style={{ display: 'block', maxWidth: '100%', margin: '6px 0' }}>
        <a href={src ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- R2 AVIF thumb, like the day page */}
          <img src={thumbUrl(p.image_key) ?? undefined} alt={p.caption ?? ''} loading="lazy" style={{ display: 'block', maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 8, background: 'var(--bg3)' }} />
        </a>
      </ImageLoupe>
      <InspirationText id={p.id} caption={p.caption} canEdit={isAdmin && !p.hidden} startEditing={isAdmin && !p.hidden && editing} render={(text) => <WorkRefText text={text} />} onSaved={() => void refresh()} />
      <ChipRow works={p.works} concepts={p.concepts} people={p.people} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <MoreMenu items={menu} testId={`js-more-photo-${p.id}`} />
      </div>
      {asking ? (
        <ConfirmRow
          text={t(p.entryId != null ? 'js_photo_delete_ask_hide' : 'js_photo_delete_ask')}
          yes={t('je_voice_delete_yes')}
          pending={pending}
          onNo={() => setAsking(false)}
          onYes={() => {
            setAsking(false)
            // The answer says which way it went: gone for good, or hidden (an admin can bring it back).
            run(async () => {
              const r = await removeInspirationPhoto(p.id)
              if ('ok' in r) toast.success(t(r.result === 'hidden' ? 'js_photo_hidden' : 'insp_deleted'))
              return r
            })
          }}
        />
      ) : null}
    </article>
  )
}

/** One day's cards, in the order they were noted. */
function DayCards({
  d,
  isAdmin,
  run,
  refresh,
  pending,
  onSelect,
  selectedKey,
  after,
  today,
  reloadTop,
  editPhotoId,
}: {
  d: JournalStreamDay
  isAdmin: boolean
  run: (fn: Act, done?: string) => void
  refresh: (day: string) => Promise<void>
  pending: boolean
  onSelect?: (s: JournalSelection) => void
  selectedKey?: string | null
  /** Under the day's cards (desk: the composer on today). */
  after?: ReactNode
  today: string
  reloadTop: () => Promise<void>
  editPhotoId?: string | null
}) {
  const { t, time } = useFormat()
  const x = d.extras
  const [allChanges, setAllChanges] = useState(false)
  const rf = () => refresh(d.day)
  type Item = { at: string; key: string; node: ReactNode; sel?: JournalSelection }
  const items: Item[] = []
  const sel = (key: string, at: string, kind: JournalSelection['kind'], text: string, extra: Partial<JournalSelection> = {}): JournalSelection => ({
    key,
    day: d.day,
    at,
    kind,
    text,
    works: [],
    concepts: [],
    proposals: [],
    ...extra,
  })
  for (const e of x.entries)
    if (isAdmin || !e.hidden)
      items.push({
        at: e.created_at,
        key: `e${e.id}`,
        node: <EntryCard e={e} isAdmin={isAdmin} run={run} refresh={rf} pending={pending} today={today} reloadTop={reloadTop} />,
        sel: sel(`e${e.id}`, e.created_at, e.voiceNoteId ? 'voice' : 'entry', isPlaceholderText(e.body) ? '' : e.body, {
          works: e.works.map((w) => ({ id: w.id, title: w.title, thumb: w.thumb ?? null })),
          concepts: e.concepts,
          proposals: isAdmin ? e.proposals : [],
        }),
      })
  for (const v of x.voices)
    if (!v.hasEntry)
      items.push({
        at: v.created_at,
        key: `v${v.id}`,
        node: <VoiceCard v={v} isAdmin={isAdmin} run={run} refresh={rf} pending={pending} />,
        sel: sel(`v${v.id}`, v.created_at, 'voice', v.transcript ?? '', { works: v.oeuvre_id != null ? [{ id: v.oeuvre_id, title: null, thumb: null }] : [] }),
      })
  for (const p of x.inspirations)
    items.push({
      at: p.created_at,
      key: `p${p.id}`,
      node: <PhotoCard p={p} day={d.day} isAdmin={isAdmin} run={run} refresh={rf} pending={pending} editing={editPhotoId === p.id} />,
      sel: sel(`p${p.id}`, p.created_at, 'photo', p.caption ?? '', {
        // The photo's own links (its entry, journal_step_b2.sql); before it, the two columns.
        works: p.works?.length ? p.works.map((w) => ({ id: w.id, title: w.title, thumb: w.thumb ?? null })) : p.oeuvre_id != null ? [{ id: p.oeuvre_id, title: null, thumb: null }] : [],
        concepts: p.concepts?.length ? p.concepts : p.concept_id ? [{ id: p.concept_id, title: p.conceptTitle }] : [],
      }),
    })
  for (const r of x.remarks) {
    items.push({
      at: r.created_at,
      key: `r${r.id}`,
      sel: sel(`r${r.id}`, r.created_at, 'remark', r.body, {
        works: r.oeuvreId != null ? [{ id: r.oeuvreId, title: r.workTitle, thumb: r.workThumb }] : [],
        concepts: r.conceptId ? [{ id: r.conceptId, title: r.conceptTitle }] : [],
      }),
      node: (
        <article data-testid={`js-remark-${r.id}`} style={cardStyle}>
          <div style={metaStyle}>
            <span>{time(r.created_at)}</span>
            <span style={{ color: 'var(--ac)' }}>{t('js_kind_remark')}</span>
            <span>{t('js_remark_on')}</span>
            {r.oeuvreId != null ? <WorkRef id={r.oeuvreId} href={workHref(r.oeuvreId)} style={{ color: 'var(--ac)' }} /> : r.conceptTitle ? <span>✦ {r.conceptTitle}</span> : null}
            {r.author !== '—' ? <span>· {r.author}</span> : null}
          </div>
          <div style={textStyle}>
            <WorkRefText text={r.body} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {r.imageKey && imageUrl(r.imageKey) ? <img src={imageUrl(r.imageKey) as string} alt="" loading="lazy" style={{ display: 'block', maxWidth: '100%', maxHeight: 260, borderRadius: 8 }} /> : null}
        </article>
      ),
    })
  }
  for (const k of x.creation) {
    items.push({
      at: k.created_at,
      key: `k${k.id}`,
      sel: sel(`k${k.id}`, k.created_at, 'creation', [k.title, k.body].filter(Boolean).join(' — '), { works: k.works.map((id) => ({ id, title: null, thumb: null })) }),
      node: (
        <article data-testid={`js-creation-${k.id}`} style={cardStyle}>
          <div style={metaStyle}>
            <span>{time(k.created_at)}</span>
            <span style={{ color: 'var(--ac)' }}>{t('js_kind_creation')}</span>
            {k.author !== '—' ? <span>· {k.author}</span> : null}
          </div>
          {k.title ? <div style={{ ...textStyle, fontWeight: 600, marginBottom: 0 }}>{k.title}</div> : null}
          {k.body ? (
            <div style={textStyle}>
              <WorkRefText text={k.body} />
            </div>
          ) : null}
          {k.works.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {k.works.map((w) => (
                <WorkRef key={w} id={w} href={workHref(w)} style={chipStyle} />
              ))}
            </div>
          ) : null}
        </article>
      ),
    })
  }
  // Ideas planted, moved, reworked or grafted that day (Idées 2026-11-23): a quiet line that opens the idea.
  const SEED: Record<string, string> = { graine: '🌰', pousse: '🌱', mure: '🌳' }
  for (const c of x.ideaChanges ?? []) {
    const title = c.title ?? '—'
    const what =
      c.what === 'planted'
        ? t('js_idea_planted')
        : c.what === 'stage'
          ? t('js_idea_stage').replace('{seed}', `${SEED[c.to ?? ''] ?? ''} ${c.to ? t(`ideas_maturity_${c.to}` as never) : ''}`.trim())
          : c.what === 'text'
            ? t('js_idea_text')
            : c.what === 'title'
              ? t('js_idea_title')
              : t(c.to ? 'js_idea_parent' : 'js_idea_trunk')
    items.push({
      at: c.at,
      key: c.key,
      node: (
        <a
          href={`/atelier/concepts?concept=${c.conceptId}`}
          data-testid={`js-idea-${c.key}`}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 44, padding: '6px 12px', border: '1px dashed var(--bd2)', borderRadius: 10, fontSize: 13, color: 'var(--tx3)', textDecoration: 'none' }}
        >
          <span>{time(c.at)}</span>
          <span style={{ color: 'var(--ac)' }}>{t('js_kind_idea')}</span>
          <span style={{ color: 'var(--tx)' }}>{title}</span>
          <span>· {what}</span>
          {c.count > 1 ? <span>· {t('js_idea_times').replace('{n}', String(c.count))}</span> : null}
          {c.by ? <span>· {c.by}</span> : null}
        </a>
      ),
    })
  }
  items.sort((a, b) => a.at.localeCompare(b.at))

  // Works photographed in field sessions, and works changed (admin): one card each, after the notes.
  const photographed = d.sessionWorks
  return (
    <div style={{ display: 'grid', gap: 10, padding: '10px 0 22px' }}>
      {photographed.length ? (
        <article
          data-testid={`js-session-${d.day}`}
          onClickCapture={
            onSelect
              ? () =>
                  onSelect(
                    sel(`s${d.day}`, `${d.day}T00:00:00Z`, 'session', '', {
                      works: photographed.filter((w) => w.id != null).map((w) => ({ id: w.id as number, title: w.title, thumb: w.thumb })),
                    }),
                  )
              : undefined
          }
          style={{ ...cardStyle, ...(selectedKey === `s${d.day}` ? { boxShadow: '0 0 0 2px var(--ac)' } : {}) }}
        >
          <div style={metaStyle}>
            <span style={{ color: 'var(--ac)' }}>{t('js_kind_works')}</span>
            <span>{photographed.length === 1 ? t('js_photographed_one') : t('js_photographed_n').replace('{n}', String(photographed.length))}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {photographed.map((w) =>
              w.id != null ? (
                <WorkRef key={w.key} id={w.id} href={workHref(w.id)} style={chipStyle} />
              ) : (
                <span key={w.key} style={{ ...chipStyle, padding: '2px 9px' }}>{w.title ?? '…'}</span>
              ),
            )}
          </div>
        </article>
      ) : null}
      {items.map((i) => (
        <div
          key={i.key}
          onClickCapture={onSelect && i.sel ? () => onSelect(i.sel as JournalSelection) : undefined}
          style={selectedKey === i.key ? { borderRadius: 11, boxShadow: '0 0 0 2px var(--ac)' } : undefined}
        >
          {i.node}
        </div>
      ))}
      {x.changes.length ? (
        <article data-testid={`js-changes-${d.day}`} style={cardStyle}>
          <div style={metaStyle}>
            <span style={{ color: 'var(--ac)' }}>{t('js_kind_changes')}</span>
          </div>
          <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 4, fontSize: 13 }}>
            {(allChanges ? x.changes : x.changes.slice(0, 8)).map((c) => (
              <li key={c.oeuvre_id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <AuthorBadges authors={c.by} />
                <WorkRef id={c.oeuvre_id} href={workHref(c.oeuvre_id)} style={{ color: 'var(--ac)' }} />
                <span style={{ color: 'var(--tx3)' }}>{c.fields.map((f) => versionFieldLabel(f, t as never)).join(', ')}</span>
              </li>
            ))}
          </ul>
          {x.changes.length > 8 ? (
            <button type="button" className="btn ghost sm" onClick={() => setAllChanges((v) => !v)} style={{ minHeight: 44, marginTop: 6 }}>
              {allChanges ? t('js_changes_less') : t('js_changes_more').replace('{n}', String((x.changedWorks ?? x.changes.length) - 8))}
            </button>
          ) : null}
          {(allChanges || x.changes.length <= 8) && (x.changedWorks ?? 0) > x.changes.length ? (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--tx3)' }}>{t('js_changes_rest').replace('{n}', String((x.changedWorks ?? 0) - x.changes.length))}</p>
          ) : null}
        </article>
      ) : null}
      <JournalDayMoments moments={x.moments} />
      {after}
    </div>
  )
}

/* ───────────────────────────── the stream ───────────────────────────── */

const dividerStyle = (narrow: boolean): CSSProperties => ({
  position: 'sticky',
  top: 0,
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: narrow ? '10px 12px 8px' : '10px 0 8px',
  border: 0,
  borderBottom: '1px solid var(--bd)',
  background: 'color-mix(in srgb, var(--bg0) 94%, transparent)',
  backdropFilter: 'blur(6px)',
  color: 'var(--tx)',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  minHeight: 44,
})

const lineStyle = (narrow: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: narrow ? '10px 12px' : '9px 0',
  border: 0,
  borderBottom: '1px solid var(--bd)',
  background: 'none',
  color: 'var(--tx)',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  minHeight: 44,
})

export function JournalStream({
  initial,
  narrow,
  scale: scaleProp,
  onScaleChange,
  onSelect,
  selectedKey,
  jumpTo,
  todayExtra,
  refreshSignal,
  refreshDaySignal,
  editPhotoId,
  dayTop,
}: {
  initial: JournalStreamPage
  narrow: boolean
  /** Desk: a card clicked → the rail. */
  onSelect?: (s: JournalSelection) => void
  selectedKey?: string | null
  /** Desk « aller au » date: open the stream at that day (changes of the value trigger it). */
  jumpTo?: string | null
  /** Desk: under today's cards (the composer). */
  todayExtra?: ReactNode
  /** Bump to read today again (after the composer wrote). */
  refreshSignal?: number
  /** Desk: read one day again (an image pasted or dropped onto it); a new object each time. */
  refreshDaySignal?: { day: string } | null
  /** Desk: the photo just added — its text box opens. */
  editPhotoId?: string | null
  /** Desk: under a day's divider (the « Sur ce PC » chip and strip). */
  dayTop?: (day: string) => ReactNode
  /** Desk: the scale switch lives in the toolbar and drives this. Phone: pinch drives it. */
  scale?: Scale
  onScaleChange?: (s: Scale) => void
}) {
  const { t, dayLong, month } = useFormat()
  const [days, setDays] = useState<JournalStreamDay[]>(initial.days)
  const [next, setNext] = useState<string | null>(initial.next)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  const [ownScale, setOwnScale] = useState<Scale>(0)
  const scale = scaleProp ?? ownScale
  const setScale = useCallback(
    (s: Scale) => {
      const v = Math.max(0, Math.min(2, s)) as Scale
      if (onScaleChange) onScaleChange(v)
      else setOwnScale(v)
    },
    [onScaleChange],
  )
  const [lines, setLines] = useState<{ grain: 'day' | 'month'; rows: JournalScaleRow[] } | null>(null)
  const [pending, startTransition] = useTransition()
  const sentinel = useRef<HTMLDivElement>(null)
  const isAdmin = initial.isAdmin
  const today = initial.today

  const loadMore = useCallback(async () => {
    if (!next || loading) return
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/journal/stream?before=${next}&days=5`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const page = (await res.json()) as JournalStreamPage
      setDays((cur) => [...cur, ...page.days.filter((d) => !cur.some((c) => c.day === d.day))])
      setNext(page.next)
      // eslint-disable-next-line pem-i18n/no-silent-catch -- shown: the footer turns into « réessayer »
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [next, loading])

  useEffect(() => {
    if (scale !== 0) return
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) void loadMore()
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, scale])

  // After an action: read that one day again and put it in place (a save returns the one thing that changed).
  const refreshDay = useCallback(async (day: string) => {
    try {
      const res = await fetch(`/api/journal/stream?day=${day}`, { cache: 'no-store' })
      if (!res.ok) return
      const page = (await res.json()) as JournalStreamPage
      const fresh = page.days.find((d) => d.day === day)
      setDays((cur) => (fresh ? cur.map((d) => (d.day === day ? fresh : d)) : cur))
      // eslint-disable-next-line pem-i18n/no-silent-catch -- the action itself succeeded; the next scroll shows the day
    } catch {
      /* the next scroll or reload shows it */
    }
  }, [])

  // After captures waiting on the phone were sent: read the newest days again (they may land on an earlier day).
  const reloadTop = useCallback(async () => {
    try {
      const res = await fetch('/api/journal/stream?days=5', { cache: 'no-store' })
      if (!res.ok) return
      const page = (await res.json()) as JournalStreamPage
      setDays((cur) => {
        const fresh = new Map(page.days.map((d) => [d.day, d]))
        const merged = cur.map((d) => fresh.get(d.day) ?? d)
        for (const d of page.days) if (!cur.some((c) => c.day === d.day)) merged.push(d)
        return merged.sort((a, b) => b.day.localeCompare(a.day))
      })
      // eslint-disable-next-line pem-i18n/no-silent-catch -- the captures were sent; the next scroll shows them
    } catch {
      /* shown on the next read */
    }
  }, [])

  const run = useCallback(
    (fn: Act, done?: string, day?: string) => {
      startTransition(async () => {
        const res = await fn()
        if ('error' in res) {
          toast.error(res.error === 'admin_only' ? t('je_voice_delete_admin') : t('je_err_fmt').replace('{msg}', res.error))
          return
        }
        if (done) toast.success(done)
        if (day) await refreshDay(day)
      })
    },
    [refreshDay, t],
  )

  // « Mois » / « Années »: counts asked of the database.
  useEffect(() => {
    if (scale === 0) return
    const grain = scale === 1 ? 'day' : 'month'
    if (lines?.grain === grain) return
    let alive = true
    void fetch(`/api/journal/stream?grain=${grain}&limit=${grain === 'day' ? 120 : 60}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { rows: JournalScaleRow[] }) => {
        if (alive) setLines({ grain, rows: j.rows })
      })
      .catch(() => {
        if (alive) toast.error(t('js_load_error'))
      })
    return () => {
      alive = false
    }
  }, [scale, lines, t])

  // Phone: two-finger pinch in → wider scale (days → months → years); out → back.
  const pinch = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!narrow) return
    const el = rootRef.current
    if (!el) return
    const dist = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch.current = dist(e)
    }
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinch.current == null) return
      const d = dist(e)
      if (d < pinch.current * 0.7) {
        setScale((scale + 1) as Scale)
        pinch.current = null
      } else if (d > pinch.current * 1.4) {
        setScale((scale - 1) as Scale)
        pinch.current = null
      }
    }
    const end = () => {
      pinch.current = null
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: true })
    el.addEventListener('touchend', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
    }
  }, [narrow, scale, setScale])

  // Opening a day from « Mois »: back to the cards, starting at that day.
  const openDay = useCallback(
    async (day: string) => {
      setScale(0)
      if (days.some((d) => d.day === day)) {
        requestAnimationFrame(() => document.getElementById(`js-day-${day}`)?.scrollIntoView({ block: 'start' }))
        return
      }
      const after = new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
      const res = await fetch(`/api/journal/stream?before=${after}&days=5`, { cache: 'no-store' }).catch(() => null)
      if (!res?.ok) return
      const page = (await res.json()) as JournalStreamPage
      setDays(page.days)
      setNext(page.next)
      window.scrollTo({ top: 0 })
    },
    [days, setScale],
  )

  useEffect(() => {
    if (jumpTo && /^\d{4}-\d{2}-\d{2}$/.test(jumpTo)) void openDay(jumpTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo])
  useEffect(() => {
    if (refreshSignal) void refreshDay(today)
  }, [refreshSignal, refreshDay, today])
  useEffect(() => {
    if (refreshDaySignal) void refreshDay(refreshDaySignal.day)
  }, [refreshDaySignal, refreshDay])

  const thumbsCount = narrow ? 3 : 4
  const toggleFold = (day: string) =>
    setFolded((cur) => {
      const n = new Set(cur)
      if (n.has(day)) n.delete(day)
      else n.add(day)
      return n
    })

  const dayView = useMemo(
    () =>
      days.map((d) => {
        const works = dayWorks(d)
        const isToday = d.day === today
        const empty = !d.extras.entries.length && !d.extras.voices.length && !d.extras.inspirations.length && !d.extras.remarks.length && !d.extras.creation.length && !d.sessionWorks.length && !d.extras.changes.length && !(d.extras.ideaChanges ?? []).length && !(d.extras.moments?.length ?? 0)
        return (
          <section key={d.day} id={`js-day-${d.day}`} data-testid={`js-day-${d.day}`} style={{ scrollMarginTop: 0 }}>
            <button type="button" aria-expanded={!folded.has(d.day)} aria-label={t('js_fold')} onClick={() => toggleFold(d.day)} style={dividerStyle(narrow)} data-testid={`js-divider-${d.day}`}>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: isToday ? 'var(--ac)' : 'var(--tx)' }}>
                {isToday ? (narrow ? t('js_today') : `${t('js_today')} · ${dayLong(d.day, today)}`) : dayLong(d.day, today)}
              </span>
              <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {works.slice(0, thumbsCount).map((w) => (
                  <Thumb key={w.id} file={w.thumb} />
                ))}
                {works.length > thumbsCount ? <span style={{ fontSize: 11, color: 'var(--tx3)' }}>+{works.length - thumbsCount}</span> : null}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{countsLine(d.counts, d.extras.changedWorks ?? d.extras.changes.length, (d.extras.ideaChanges ?? []).length)}</span>
            </button>
            {isToday && !folded.has(d.day) ? (
              <div style={{ padding: narrow ? '0 12px' : 0 }}>
                <QueuedCaptureCards onSent={() => void reloadTop()} />
              </div>
            ) : null}
            {dayTop && !folded.has(d.day) ? dayTop(d.day) : null}
            {folded.has(d.day) ? null : empty && isToday ? (
              <div style={{ padding: narrow ? '14px 12px 22px' : '14px 0 22px' }}>
                <p style={{ margin: 0, color: 'var(--tx3)', fontSize: 14 }}>{narrow || !todayExtra ? t('js_empty_today') : null}</p>
                {todayExtra}
              </div>
            ) : (
              <div style={{ padding: narrow ? '0 12px' : 0 }}>
                <DayCards
                  d={d}
                  isAdmin={isAdmin}
                  pending={pending}
                  refresh={refreshDay}
                  run={(fn, done) => run(fn, done, d.day)}
                  onSelect={onSelect}
                  selectedKey={selectedKey}
                  after={isToday ? todayExtra : null}
                  today={today}
                  reloadTop={reloadTop}
                  editPhotoId={editPhotoId}
                />
              </div>
            )}
          </section>
        )
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, folded, narrow, pending, isAdmin, today, selectedKey, todayExtra, onSelect, reloadTop, editPhotoId, dayTop],
  )

  return (
    <div ref={rootRef} data-testid="journal-stream" data-scale={scale} style={{ minWidth: 0 }}>
      <CaptureQueueFlusher onSent={() => void reloadTop()} />
      {scale === 0 ? (
        <>
          {dayView}
          <div ref={sentinel} style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--tx3)' }}>
            {failed ? (
              <button type="button" className="btn ghost sm" onClick={() => void loadMore()} style={{ minHeight: 44 }}>
                {t('js_load_error')}
              </button>
            ) : next ? (
              t('js_loading')
            ) : (
              t('js_end')
            )}
          </div>
        </>
      ) : !lines || lines.grain !== (scale === 1 ? 'day' : 'month') ? (
        <p style={{ padding: 16, color: 'var(--tx3)', fontSize: 13 }}>{t('js_loading')}</p>
      ) : (
        <div>
          {lines.rows.map((r, i) => {
            const year = r.bucket.slice(0, 4)
            const newHead = scale === 1 ? i === 0 || lines.rows[i - 1].bucket.slice(0, 7) !== r.bucket.slice(0, 7) : i === 0 || lines.rows[i - 1].bucket.slice(0, 4) !== year
            const total = r.entries + r.voices + r.photos + r.remarks + r.creation
            return (
              <div key={r.bucket}>
                {newHead ? (
                  <div style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx3)', padding: narrow ? '14px 12px 4px' : '14px 0 4px' }}>
                    {scale === 1 ? `${month(r.bucket)} ${year}` : year}
                  </div>
                ) : null}
                {scale === 1 ? (
                  <button type="button" style={lineStyle(narrow)} aria-label={t('js_open_day')} onClick={() => void openDay(r.bucket)} data-testid={`js-line-${r.bucket}`}>
                    <span style={{ width: narrow ? 88 : 110, flex: 'none', fontWeight: 600, fontSize: 13 }}>{r.bucket === today ? t('js_today') : dayLong(r.bucket, today)}</span>
                    <span style={{ display: 'flex', gap: 3 }}>
                      {(r.works ?? []).slice(0, thumbsCount).map((w) => (
                        <Thumb key={w.key} file={w.thumb} />
                      ))}
                    </span>
                    <span style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{countsLine(r)}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    style={lineStyle(narrow)}
                    aria-label={t('js_open_month')}
                    data-testid={`js-month-${r.bucket.slice(0, 7)}`}
                    onClick={() => {
                      setScale(1)
                      requestAnimationFrame(() => document.querySelector(`[data-testid^="js-line-${r.bucket.slice(0, 7)}"]`)?.scrollIntoView({ block: 'start' }))
                    }}
                  >
                    <span style={{ width: 72, flex: 'none', fontWeight: 600, fontSize: 13 }}>{month(r.bucket)}</span>
                    <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--ac2)', width: Math.min(160, Math.max(2, total * 3)) }} />
                    <span style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 12, whiteSpace: 'nowrap' }}>{t('js_notes').replace('{n}', String(total))}</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Desk: the three-way scale switch for the toolbar. */
export function JournalScaleSwitch({ scale, onChange }: { scale: Scale; onChange: (s: Scale) => void }) {
  const { t } = useI18n()
  const labels = [t('js_scale_days'), t('js_scale_months'), t('js_scale_years')]
  return (
    <div role="group" aria-label={t('js_scale_aria')} style={{ display: 'inline-flex', border: '1px solid var(--bd2)', borderRadius: 8, overflow: 'hidden' }}>
      {labels.map((l, i) => (
        <button
          key={l}
          type="button"
          aria-pressed={scale === i}
          onClick={() => onChange(i as Scale)}
          style={{ background: scale === i ? 'var(--bg3)' : 'none', border: 0, padding: '6px 12px', minHeight: 36, cursor: 'pointer', color: scale === i ? 'var(--tx)' : 'var(--tx2)' }}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
