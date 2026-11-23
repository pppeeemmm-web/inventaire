'use client'

// R2 « Aujourd'hui » v1 — light view of the day (docs/design/2026-11-17/PhoneToday.notes.md).
// Phone navigation (docs/design/2026-11-18/PhoneNav.notes.md, option A): this is THE day screen on the
// phone — today or any other day; the phone Journal day page opens here. ☰ opens the menu sheet over
// the page (the Bureau rows and the account moved there), Écrire writes on the day shown.
// Streaming (Speed first, rule 2): `TodayFrame` (header, bar) is in the first HTML; each section below
// is its own component, filled by app/hub/today/page.tsx as its query finishes (Suspense).
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState, useTransition, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { atelierTabHref } from '@/lib/atelier/tab-routes'
import { PhoneMenuButton } from '@/components/shared/PhoneMenu'
import type { FieldPulseMetric, FieldPulseMetricKey } from '@/app/atelier/field-inbox/data'
import type { SeeAgainSlots, SeeAgainWork } from '@/app/atelier/see-again/actions'
import {
  decideJournalLink,
  getJournalDayFolds,
  type JournalDayChange,
  type JournalDayCreation,
  type JournalDayEntry,
  type JournalDayVoice,
} from '@/app/atelier/(portal)/journal/entry-actions'
import type { InspirationPhoto } from '@/lib/inspiration-photo'
import { toast } from '@/lib/ui/toast'
import { imageUrl, thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { versionFieldLabel } from '@/lib/oeuvre-version-fields'
import { PhoneInputBar } from '@/components/shared/PhoneInputBar'
import { CaptureQueueFlusher } from '@/components/journal/CaptureQueue'
import { SeeAgainCard } from '@/components/atelier/SeeAgainCard'
import { WorkChip as WorkPreviewChip } from '@/components/atelier/WorkChip'
import { WorkRefText } from '@/components/atelier/journal/WorkRefText'
import { isNothingHeard, isWaitingTranscript } from '@/lib/journal/nothing-heard'
import { CorrectedOriginal } from '@/components/atelier/journal/CorrectedOriginal'
import { InspirationText } from '@/components/atelier/journal/InspirationText'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import type { DictKey } from '@/lib/i18n/dictionary'

const VoiceNoteSheet = dynamic(
  () => import('@/components/shared/VoiceNoteSheet').then((m) => m.VoiceNoteSheet),
  { ssr: false },
)
/** Pem's « #équipe » voice card (TODO 24): its own chunk, so the phone page stays light. */
const TeamVoiceCard = dynamic(() => import('@/components/hub/TeamVoiceCard'), { ssr: false })
/** Entry / session tools (Relier, hide, Modifier la séance): their own chunk, loaded on tap. */
const DayEntryTools = dynamic(() => import('@/components/hub/DayTools').then((m) => m.DayEntryTools), { ssr: false })
const DaySessionEdit = dynamic(() => import('@/components/hub/DayTools').then((m) => m.DaySessionEdit), { ssr: false })

export type TodayWork = { id: number; title: string | null; thumb: string | null }
/** A session item with no work yet (no catalogue record): shown by its title hint, not a link. */
export type TodayPendingItem = { key: string; title: string | null }

const METRIC_LABELS: Record<FieldPulseMetricKey, DictKey> = {
  past_due: 'field_pulse_metric_past_due',
  today: 'field_pulse_metric_today',
  pending_review: 'field_pulse_metric_pending_review',
  inbox: 'field_pulse_metric_inbox',
}

const workHref = (id: number) => `/atelier/inventory?work=${id}`

/** YYYY-MM-DD ± n days (calendar arithmetic at noon UTC: no DST edge). */
function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const iconLink: CSSProperties = { minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--tx)', textDecoration: 'none', fontSize: 20, flex: 'none' }

const section: CSSProperties = { padding: '14px 16px', borderTop: '1px solid var(--bd)' }
const heading: CSSProperties = { fontSize: 12, letterSpacing: '0.04em', color: 'var(--tx3)', margin: '0 0 8px' }
const muted: CSSProperties = { fontSize: 13, color: 'var(--tx3)', margin: 0 }

function Thumb({ file, size }: { file: string | null; size: number }) {
  const src = thumbUrl(file)
  const box: CSSProperties = { width: size, height: size, borderRadius: 6, objectFit: 'cover', background: 'var(--bg2)', flex: 'none' }
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" width={size} height={size} loading="lazy" style={box} /> : <span style={{ ...box, display: 'inline-block' }} />
}

/** R4: thumbnail + `#id` + title; hold = the picture with its caption. */
function WorkChip({ work }: { work: SeeAgainWork | TodayWork }) {
  const file = 'image' in work ? work.image : work.thumb
  return <WorkPreviewChip id={work.id} href={workHref(work.id)} title={work.title ?? null} image={file ?? null} style={{ fontSize: 14 }} />
}

/** `stream`: the Journal stream (components/journal/JournalPhone.tsx) brings its own header; the frame keeps the record bar. */
export function TodayFrame({ day, today, children, stream = false }: { day: string; today: string; children: ReactNode; stream?: boolean }) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const pathname = usePathname() || '/hub'
  const narrow = useMediaQuery('(max-width: 767px)')
  const [mounted, setMounted] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  useEffect(() => {
    setMounted(true)
    // The voice sheet's code, fetched in the background so the tap never waits on it.
    void import('@/components/shared/VoiceNoteSheet')
  }, [])
  // Phone page: a desktop-wide window goes on to Overview (as the old /hub launcher did).
  useEffect(() => {
    if (mounted && !narrow) router.replace(atelierTabHref('overview'))
  }, [mounted, narrow, router])

  // Short form so the one header row (☰ · date · ‹ › · 📅) fits at 360 px. This year: « Mar. 17 nov. »;
  // another year: « 23/09/2024 », a size smaller.
  const sameYear = day.slice(0, 4) === today.slice(0, 4)
  const date = new Date(`${day}T12:00:00Z`)
    .toLocaleDateString(
      locale,
      sameYear
        ? { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }
        : { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' },
    )
    .replace(/^./, (c) => c.toUpperCase())
  // ‹ › step a day (`?day=` on this same route); today has no query and no « next ».
  const dayHref = (d: string) => (d >= today ? pathname : `${pathname}?day=${d}`)
  const isToday = day >= today

  return (
    <div data-testid="hub-today-root" style={{ minHeight: '100dvh', background: 'var(--bg0)', color: 'var(--tx)', overflowX: stream ? 'clip' : 'hidden', paddingBottom: stream ? 'max(104px, calc(100px + env(safe-area-inset-bottom)))' : 'max(80px, calc(76px + env(safe-area-inset-bottom)))' }}>
      {/* One header row: ☰ · date · ‹ › · 📅 (the signed-in badge is off on the phone: the account is in the menu). */}
      {stream ? null : <header data-testid="hub-today-header" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '12px 8px 4px 8px' }}>
        <PhoneMenuButton />
        <h1 data-testid="hub-today-date" data-day={day} style={{ fontSize: sameYear ? 22 : 18, margin: '0 4px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{date}</h1>
        <Link href={dayHref(shiftDay(day, -1))} aria-label={t('today_prev_day')} data-testid="hub-today-prev" style={iconLink}>‹</Link>
        {isToday ? (
          <span aria-hidden="true" data-testid="hub-today-next" style={{ ...iconLink, color: 'var(--tx3)', opacity: 0.4 }}>›</span>
        ) : (
          <Link href={dayHref(shiftDay(day, 1))} aria-label={t('today_next_day')} data-testid="hub-today-next" style={iconLink}>›</Link>
        )}
        <Link href="/atelier/journal" aria-label={t('today_days')} style={{ ...iconLink, fontSize: 18 }}>📅</Link>
      </header>}

      {children}

      {/* Captures kept on the phone with no network are sent from here too (the stream mounts its own). */}
      {stream ? null : <CaptureQueueFlusher onSent={() => router.refresh()} />}
      <PhoneInputBar onVoice={() => setVoiceOpen(true)} workHref="/atelier/session/new" writeDay={day} stream={stream} />

      {voiceOpen ? <VoiceNoteSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} oeuvreOptions={[]} /> : null}
    </div>
  )
}

/** Grey bars while a section's query runs (fixed heights: nothing jumps when it arrives). */
export function TodaySkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div aria-hidden="true" style={{ ...section, display: 'grid', gap: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} style={{ display: 'block', height: i === 0 ? 12 : 44, width: i === 0 ? '40%' : '100%', borderRadius: 6, background: 'var(--bg2)' }} />
      ))}
    </div>
  )
}

export function TodayLoadError() {
  const { t } = useI18n()
  return <p style={{ ...muted, padding: '0 16px 12px', color: 'var(--rust)' }}>{t('today_load_error')}</p>
}

export function TodaySummary({ entries, works, voices, photos = 0 }: { entries: number; works: number; voices: number; photos?: number }) {
  const { t } = useI18n()
  const part = (n: number, one: DictKey, many: DictKey) => (n === 1 ? t(one) : t(many).replace('{n}', String(n)))
  const summary = [
    part(entries, 'today_sum_entry_one', 'today_sum_entries'),
    part(works, 'today_sum_work_one', 'today_sum_works'),
    part(voices, 'today_sum_note_one', 'today_sum_notes'),
    // Inspiration photos: named only when the day has some (the Journal's day list counts them too).
    ...(photos > 0 ? [part(photos, 'today_sum_photo_one', 'today_sum_photos')] : []),
  ].join(' · ')
  return <p data-testid="hub-today-summary" style={{ ...muted, padding: '0 16px 8px' }}>{summary}</p>
}

/** Pulse line: the Fil count first (R1 step 6; admin only, `fil` null otherwise), then the field inbox. */
export function TodayPulse({ metrics, fil = null }: { metrics: FieldPulseMetric[]; fil?: number | null }) {
  const { t } = useI18n()
  return (
    <nav data-testid="hub-field-pulse" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '0 16px 12px', fontSize: 13 }}>
      {fil != null ? (
        <Link href="/hub/fil" data-testid="hub-pulse-fil" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: fil === 0 ? 'var(--tx3)' : 'var(--tx)' }}>
          <b>{fil}</b>
          {t('fil_title')}
        </Link>
      ) : null}
      {metrics.map((m) => (
        <Link key={m.key} href={m.href} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: m.count === 0 ? 'var(--tx3)' : m.tone === 'urgent' ? 'var(--rust)' : 'var(--tx)' }}>
          <b>{m.count}</b>
          {t(METRIC_LABELS[m.key])}
        </Link>
      ))}
    </nav>
  )
}

export function TodaySeeAgain({ seeAgain }: { seeAgain: SeeAgainSlots }) {
  const has = !!(seeAgain.then || seeAgain.alone || seeAgain.close)
  // Same card and actions as the Journal (Ouvrir, Plus tard, Écrire à ce sujet, Lier, Sans rapport), one slot at a time.
  // Pem's voice card for the team sits above it (renders nothing when there is none).
  return (
    <>
      <TeamVoiceCard />
      {has ? (
        <div data-testid="hub-today-see-again" style={{ padding: '10px 12px', borderTop: '1px solid var(--bd)' }}>
          <SeeAgainCard context="today" initialSlots={seeAgain} oneAtATime />
        </div>
      ) : null}
    </>
  )
}

export function TodayWorks({ works, pending = [], isToday = true }: { works: TodayWork[]; pending?: TodayPendingItem[]; isToday?: boolean }) {
  const { t } = useI18n()
  return (
    <section data-testid="hub-today-works" style={section}>
      <h2 style={heading}>{t('today_works')}</h2>
      {works.length || pending.length ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {works.map((w) => <WorkChip key={w.id} work={w} />)}
          {pending.map((p, i) => (
            <div key={p.key} data-testid="hub-today-work-pending" style={{ fontSize: 14, lineHeight: 1.4, minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, overflowWrap: 'anywhere' }}>
              <span>{p.title || `${t('session_painting_label')} ${works.length + i + 1}`}</span>
              <span style={{ ...muted, fontSize: 12 }}>{t('today_work_no_record')}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={muted}>{t(isToday ? 'today_works_empty' : 'today_works_empty_day')}</p>
      )}
    </section>
  )
}

/** Another day, folded: works whose photo file name carries that date — the day it was photographed, not made. */
export function TodayPhotographed({ works, more }: { works: TodayWork[]; more: number }) {
  const { t } = useI18n()
  return (
    <details className="pem-fold" data-testid="hub-today-photographed" style={section}>
      <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--tx2)' }}>
        {t('today_photographed')} <span style={{ color: 'var(--tx3)' }}>({works.length + more})</span>
      </summary>
      <p style={{ ...muted, fontSize: 12, marginBottom: 8 }}>{t('today_photographed_hint')}</p>
      <div style={{ display: 'grid', gap: 6 }}>{works.map((w) => <WorkChip key={w.id} work={w} />)}</div>
      {more > 0 ? <p style={{ ...muted, marginTop: 6 }}>{t('today_photographed_more').replace('{n}', String(more))}</p> : null}
    </details>
  )
}

type DayItem =
  | { at: string; entry: JournalDayEntry; voice?: undefined; photo?: undefined }
  | { at: string; voice: JournalDayVoice; entry?: undefined; photo?: undefined }
  | { at: string; photo: InspirationPhoto; entry?: undefined; voice?: undefined }

/** The day's writings, voice notes (before their PC transcript) and inspiration photos, by time — the
 *  Journal day page's content in this screen's look. « ⋯ » opens that item's tools (DayTools chunk). */
export function TodayEntries({
  entries,
  voices = [],
  photos = [],
  isToday = true,
  isAdmin = false,
}: {
  entries: JournalDayEntry[]
  voices?: JournalDayVoice[]
  photos?: InspirationPhoto[]
  isToday?: boolean
  isAdmin?: boolean
}) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  const [toolsOpen, setToolsOpen] = useState<string | null>(null)
  const items: DayItem[] = [
    ...entries.map((e) => ({ at: e.created_at, entry: e })),
    ...voices.filter((v) => !v.hasEntry).map((v) => ({ at: v.created_at, voice: v })),
    ...photos.map((p) => ({ at: p.created_at, photo: p })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  const meta: CSSProperties = { fontSize: 12, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4, minHeight: 20 }
  const more = (key: string) => (
    <button
      type="button"
      aria-label={t('pn_entry_tools')}
      aria-expanded={toolsOpen === key}
      data-testid={`hub-today-entry-tools-${key}`}
      onClick={() => setToolsOpen((k) => (k === key ? null : key))}
      style={{ minWidth: 44, minHeight: 44, margin: '-12px -8px -12px auto', background: 'none', border: 0, color: 'var(--tx3)', fontSize: 18, cursor: 'pointer' }}
    >
      ⋯
    </button>
  )
  const audio = (key: string | null) =>
    key ? <audio controls preload="none" src={imageUrl(key) ?? undefined} style={{ display: 'block', width: '100%', margin: '4px 0' }} /> : null

  return (
    <section data-testid="hub-today-entries" style={section}>
      <h2 style={heading}>{t('today_entries')}</h2>
      {items.length ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {items.map((it) => {
            if (it.photo) {
              const p = it.photo
              return (
                <li key={`p-${p.id}`} data-testid={`hub-today-photo-${p.id}`} style={{ fontSize: 14, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                  <span style={meta}>
                    {time(p.created_at)} · {p.author} · ✦ {t('pn_inspiration')}
                  </span>
                  {/* Hold = the picture large, as on the desk Journal (same piece, Pem 2026-11-21); a tap still opens it in a tab. */}
                  <ImageLoupe file={p.image_key} alt={p.caption ?? ''} caption={p.caption?.trim() || undefined} style={{ display: 'inline-block', maxWidth: '100%', marginTop: 4 }}>
                    <a href={imageUrl(p.image_key) ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- R2 AVIF thumb, like the Journal */}
                      <img src={thumbUrl(p.image_key) ?? undefined} alt={p.caption ?? ''} loading="lazy" style={{ display: 'block', maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6, background: 'var(--bg2)' }} />
                    </a>
                  </ImageLoupe>
                  {/* The page is server-rendered: after a save, ask it again so the picture's alt, the loupe and a later « back » show the new text. */}
                  <InspirationText id={p.id} caption={p.caption} canEdit={isAdmin} render={(text) => <WorkRefText text={text} />} onSaved={() => router.refresh()} />
                  {p.oeuvre_id != null ? (
                    <div style={{ marginTop: 4 }}>
                      <WorkPreviewChip id={p.oeuvre_id} href={workHref(p.oeuvre_id)} size="chip" />
                    </div>
                  ) : null}
                </li>
              )
            }
            if (it.voice) {
              const v = it.voice
              const key = `v-${v.id}`
              return (
                <li key={key} data-testid={`hub-today-voice-${v.id}`} style={{ fontSize: 14, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                  <span style={meta}>
                    {time(v.created_at)} · {v.author} · {t('today_voice_note')}
                    {v.duration_ms != null ? ` · ${Math.round(v.duration_ms / 1000)} s` : ''}
                    {more(key)}
                  </span>
                  {v.subject?.trim() ? <b style={{ display: 'block' }}>{v.subject}</b> : null}
                  {audio(v.audioKey)}
                  {v.transcript?.trim() ? <WorkRefText text={v.transcript} /> : null}
                  {v.oeuvre_id != null ? (
                    <div style={{ marginTop: 4 }}>
                      <WorkPreviewChip id={v.oeuvre_id} href={workHref(v.oeuvre_id)} size="chip" />
                    </div>
                  ) : null}
                  {toolsOpen === key ? <DayEntryTools voice={v} isAdmin={isAdmin} /> : null}
                </li>
              )
            }
            const e = it.entry
            const key = `e-${e.id}`
            const hasTools = isAdmin || !!(e.voiceNoteId && e.voiceLinks)
            return (
              <li key={key} data-testid={`hub-today-entry-${e.id}`} style={{ fontSize: 14, lineHeight: 1.45, overflowWrap: 'anywhere', opacity: e.hidden ? 0.5 : 1 }}>
                <span style={meta}>
                  {time(e.created_at)}
                  {' · '}
                  {e.author}
                  {e.voiceNoteId ? <>{' · '}{t('today_voice_note')}</> : null}
                  {e.hidden ? <>{' · '}{t('je_hidden_label')}</> : null}
                  {hasTools ? more(key) : null}
                </span>
                {e.voiceLinks?.subject?.trim() ? <b style={{ display: 'block' }}>{e.voiceLinks.subject}</b> : null}
                {audio(e.audioKey)}
                {isNothingHeard(e) ? <span style={{ color: 'var(--tx3)' }}>{t('js_nothing_heard')}</span> : isWaitingTranscript(e) ? <span style={{ color: 'var(--tx3)' }}>{t('js_waiting')}</span> : <WorkRefText text={e.body} />}
                <CorrectedOriginal original={e.original} />
                {e.voiceLinks?.oeuvre_id != null ? (
                  <div style={{ marginTop: 4 }}>
                    <WorkPreviewChip id={e.voiceLinks.oeuvre_id} href={workHref(e.voiceLinks.oeuvre_id)} size="chip" />
                  </div>
                ) : null}
                {toolsOpen === key ? <DayEntryTools entry={e} isAdmin={isAdmin} /> : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p style={muted}>{t(isToday ? 'today_entries_empty' : 'today_entries_empty_day')}</p>
      )}
    </section>
  )
}

/** The day's field session: its note for everyone, « Modifier la séance » for an admin. */
export function TodaySession({ sessionId, day, notes, isAdmin }: { sessionId: string; day: string; notes: string | null; isAdmin: boolean }) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  if (!notes?.trim() && !isAdmin) return null
  return (
    <section data-testid="hub-today-session" style={section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ ...heading, margin: 0, flex: 1 }}>{t('pn_session_notes')}</h2>
        {isAdmin && !editing ? (
          <button type="button" className="btn ghost sm" data-testid="hub-today-session-edit" onClick={() => setEditing(true)} style={{ minHeight: 44 }}>
            {t('pn_session_edit')}
          </button>
        ) : null}
      </div>
      {editing ? (
        <DaySessionEdit sessionId={sessionId} day={day} notes={notes ?? ''} onDone={() => setEditing(false)} />
      ) : notes?.trim() ? (
        <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{notes}</p>
      ) : null}
    </section>
  )
}

type Suggestion = JournalDayEntry['proposals'][number]

/** ✦ AI link suggestions of the day: thumbnail + `#id` + title; ✓ / ✕ (admin) = the Journal's `decideJournalLink`. */
export function TodaySuggestions({ rows, canDecide }: { rows: Suggestion[]; canDecide: boolean }) {
  const { t } = useI18n()
  const [done, setDone] = useState<Set<number>>(() => new Set())
  const [pending, startTransition] = useTransition()
  const open = rows.filter((r) => !done.has(r.linkId))
  if (!open.length) return null

  function decide(linkId: number, accept: boolean) {
    startTransition(async () => {
      const res = await decideJournalLink(linkId, accept)
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      setDone((prev) => new Set(prev).add(linkId))
    })
  }

  const btn: CSSProperties = { minWidth: 44, minHeight: 44, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg1)', color: 'var(--tx)', fontSize: 16, cursor: 'pointer', flex: 'none' }
  return (
    <section data-testid="hub-today-suggestions" style={section}>
      <h2 style={heading}>{t('je_ai_proposals')}</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {open.map((p) => (
          <li key={p.linkId} data-testid={`hub-today-suggestion-${p.linkId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {p.workId != null ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <WorkPreviewChip id={p.workId} href={workHref(p.workId)} title={p.title ?? null} image={p.thumb ?? null} sub="✦" style={{ fontSize: 14 }} />
              </div>
            ) : (
              <Link
                href={p.conceptId ? `/atelier/concepts?concept=${p.conceptId}` : '/atelier/concepts'}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, flex: 1, minWidth: 0, color: 'var(--tx)', textDecoration: 'none' }}
              >
                <Thumb file={p.thumb} size={44} />
                <span style={{ fontSize: 14, lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere' }}>
                  <span style={{ color: 'var(--tx3)' }}>✦ {t('today_suggestion_idea')}</span>
                  {' · '}
                  {p.title || t('wr_untitled')}
                </span>
              </Link>
            )}
            {canDecide ? (
              <>
                <button type="button" style={btn} disabled={pending} aria-label={t('je_ai_accept')} data-testid={`hub-today-suggestion-accept-${p.linkId}`} onClick={() => decide(p.linkId, true)}>
                  ✓
                </button>
                <button type="button" style={btn} disabled={pending} aria-label={t('je_ai_reject')} data-testid={`hub-today-suggestion-reject-${p.linkId}`} onClick={() => decide(p.linkId, false)}>
                  ✕
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

type Folds = { changes: JournalDayChange[]; creation: JournalDayCreation[] }

/** Two folds, closed; the day's work changes and Création items are read when either opens (once). */
export function TodayFolds({ day, showChanges }: { day: string; showChanges: boolean }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  const [data, setData] = useState<Folds | 'loading' | 'error' | null>(null)

  function load() {
    if (data !== null && data !== 'error') return
    setData('loading')
    getJournalDayFolds(day)
      .then((res) => setData('error' in res ? 'error' : { changes: res.changes, creation: res.creation }))
      .catch(() => setData('error'))
  }
  const onToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open) load()
  }

  const summary: CSSProperties = { minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--tx2)' }
  const status = data === 'loading' ? <p style={muted}>{t('today_fold_loading')}</p> : data === 'error' ? <TodayLoadError /> : null
  const ready = data !== null && typeof data === 'object' ? data : null
  const count = (n: number | undefined) => (n == null ? null : <span style={{ color: 'var(--tx3)' }}>({n})</span>)

  return (
    <>
      {showChanges ? (
        <details className="pem-fold" data-testid="hub-today-fold-changes" style={section} onToggle={onToggle}>
          <summary style={summary}>
            {t('today_fold_changes')} {count(ready?.changes.length)}
          </summary>
          {status}
          {ready ? (
            ready.changes.length ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                {ready.changes.map((c) => (
                  <li key={c.oeuvre_id} style={{ fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                    <WorkPreviewChip id={c.oeuvre_id} href={workHref(c.oeuvre_id)} title={c.title ?? null} sub={c.fields.map((f) => versionFieldLabel(f, t)).join(', ')} />
                  </li>
                ))}
              </ul>
            ) : (
              <p style={muted}>{t('je_changes_empty')}</p>
            )
          ) : null}
        </details>
      ) : null}
      {/* « Création (Kaizen) » fold removed: Création moved to Idées (R1, Pem 2026-11-18). */}
    </>
  )
}
