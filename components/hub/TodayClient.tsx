'use client'

// R2 « Aujourd'hui » v1 — light view of the day (docs/design/2026-11-17/PhoneToday.notes.md).
// Read-only first screen + the sticky input bar; actions open the existing full screens.
// Streaming (Speed first, rule 2): `TodayFrame` (header, bar) is in the first HTML; each section below
// is its own component, filled by app/hub/today/page.tsx as its query finishes (Suspense).
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState, useTransition, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { atelierTabHref } from '@/lib/atelier/tab-routes'
import { AccountActions } from '@/components/shared/AccountActions'
import type { FieldPulseMetric, FieldPulseMetricKey } from '@/app/atelier/field-inbox/data'
import type { SeeAgainSlots, SeeAgainWork } from '@/app/atelier/see-again/actions'
import {
  decideJournalLink,
  getJournalDayFolds,
  type JournalDayChange,
  type JournalDayCreation,
  type JournalDayEntry,
} from '@/app/atelier/(portal)/journal/entry-actions'
import { toast } from '@/lib/ui/toast'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { versionFieldLabel } from '@/lib/oeuvre-version-fields'
import { PhoneInputBar } from '@/components/shared/PhoneInputBar'
import { SeeAgainCard } from '@/components/atelier/SeeAgainCard'
import { WorkChip as WorkPreviewChip } from '@/components/atelier/WorkChip'
import type { DictKey } from '@/lib/i18n/dictionary'

const VoiceNoteSheet = dynamic(
  () => import('@/components/shared/VoiceNoteSheet').then((m) => m.VoiceNoteSheet),
  { ssr: false },
)

export type TodayWork = { id: number; title: string | null; thumb: string | null }

const METRIC_LABELS: Record<FieldPulseMetricKey, DictKey> = {
  past_due: 'field_pulse_metric_past_due',
  today: 'field_pulse_metric_today',
  pending_review: 'field_pulse_metric_pending_review',
  inbox: 'field_pulse_metric_inbox',
}

const workHref = (id: number) => `/atelier/inventory?work=${id}`
const journalDayHref = (day: string, isToday: boolean) => (isToday ? '/atelier/journal?today=1' : `/atelier/journal?day=${day}`)

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

/** Former /hub launcher rows (owner 2026-11-17: « Bureau », folded). */
const BUREAU_ROWS: Array<{ testId: string; emoji: string; labelKey: DictKey; href: string }> = [
  { testId: 'hub-field-verb-pipeline', emoji: '📅', labelKey: 'hub_field_pipeline', href: '/atelier/pipeline' },
  { testId: 'hub-field-verb-sale', emoji: '💳', labelKey: 'hub_field_sale', href: '/atelier/sale/new' },
  { testId: 'hub-field-verb-triage', emoji: '📣', labelKey: 'hub_field_triage', href: '/atelier/triage' },
  { testId: 'hub-field-verb-contact', emoji: '👤', labelKey: 'hub_field_contact', href: '/atelier/capture?mode=card' },
  { testId: 'hub-field-verb-document', emoji: '✍️', labelKey: 'hub_field_document', href: '/atelier/documents/new' },
  { testId: 'hub-field-verb-issue', emoji: '⚠️', labelKey: 'hub_field_issue', href: '/atelier/issue/new' },
]

export function TodayFrame({ day, today, children }: { day: string; today: string; children: ReactNode }) {
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
    <div data-testid="hub-today-root" style={{ minHeight: '100dvh', background: 'var(--bg0)', color: 'var(--tx)', overflowX: 'hidden', paddingBottom: 'max(80px, calc(76px + env(safe-area-inset-bottom)))' }}>
      {/* Right padding keeps 📅 clear of the floating signed-in badge (LoggedInBar). */}
      <header data-testid="hub-today-header" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '12px 48px 4px 8px' }}>
        <Link href="/atelier" aria-label={t('today_menu')} style={iconLink}>☰</Link>
        <h1 data-testid="hub-today-date" data-day={day} style={{ fontSize: sameYear ? 22 : 18, margin: '0 4px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{date}</h1>
        <Link href={dayHref(shiftDay(day, -1))} aria-label={t('today_prev_day')} data-testid="hub-today-prev" style={iconLink}>‹</Link>
        {isToday ? (
          <span aria-hidden="true" data-testid="hub-today-next" style={{ ...iconLink, color: 'var(--tx3)', opacity: 0.4 }}>›</span>
        ) : (
          <Link href={dayHref(shiftDay(day, 1))} aria-label={t('today_next_day')} data-testid="hub-today-next" style={iconLink}>›</Link>
        )}
        <Link href="/atelier/journal" aria-label={t('today_days')} style={{ ...iconLink, fontSize: 18 }}>📅</Link>
      </header>

      {children}

      <details className="pem-fold" data-testid="hub-today-bureau" style={{ ...section }}>
        <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 14, color: 'var(--tx2)' }}>{t('today_bureau')}</span>
          <span style={{ fontSize: 11, color: 'var(--tx3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('today_bureau_sub')}</span>
        </summary>
        {BUREAU_ROWS.map((row) => (
          <Link key={row.testId} href={row.href} data-testid={row.testId} style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--bd)', color: 'var(--tx)', textDecoration: 'none', fontSize: 15 }}>
            <span aria-hidden="true" style={{ width: 22, textAlign: 'center' }}>{row.emoji}</span>
            {t(row.labelKey)}
          </Link>
        ))}
        <AccountActions compact style={{ justifyContent: 'center', marginTop: 12 }} />
      </details>

      <PhoneInputBar onVoice={() => setVoiceOpen(true)} workHref="/atelier/session/new" />

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

export function TodaySummary({ entries, works, voices }: { entries: number; works: number; voices: number }) {
  const { t } = useI18n()
  const summary = t('today_summary').replace('{e}', String(entries)).replace('{w}', String(works)).replace('{v}', String(voices))
  return <p data-testid="hub-today-summary" style={{ ...muted, padding: '0 16px 8px' }}>{summary}</p>
}

/** Pulse line: the Fil count first (R1 step 6; admin only, `fil` null otherwise), then the field inbox. */
export function TodayPulse({ metrics, fil = null }: { metrics: FieldPulseMetric[]; fil?: number | null }) {
  const { t } = useI18n()
  return (
    <nav data-testid="hub-field-pulse" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '0 16px 12px', fontSize: 13 }}>
      {fil != null ? (
        <Link href="/hub/fil" data-testid="hub-pulse-fil" style={{ minHeight: 32, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: fil === 0 ? 'var(--tx3)' : 'var(--tx)' }}>
          <b>{fil}</b>
          {t('fil_title')}
        </Link>
      ) : null}
      {metrics.map((m) => (
        <Link key={m.key} href={m.href} style={{ minHeight: 32, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: m.count === 0 ? 'var(--tx3)' : m.tone === 'urgent' ? 'var(--rust)' : 'var(--tx)' }}>
          <b>{m.count}</b>
          {t(METRIC_LABELS[m.key])}
        </Link>
      ))}
    </nav>
  )
}

export function TodaySeeAgain({ seeAgain }: { seeAgain: SeeAgainSlots }) {
  if (!seeAgain.then && !seeAgain.alone && !seeAgain.close) return null
  // Same card and actions as the Journal (Ouvrir, Plus tard, Écrire à ce sujet, Lier, Sans rapport), one slot at a time.
  return (
    <div data-testid="hub-today-see-again" style={{ padding: '10px 12px', borderTop: '1px solid var(--bd)' }}>
      <SeeAgainCard context="today" initialSlots={seeAgain} oneAtATime />
    </div>
  )
}

export function TodayWorks({ works, isToday = true }: { works: TodayWork[]; isToday?: boolean }) {
  const { t } = useI18n()
  return (
    <section data-testid="hub-today-works" style={section}>
      <h2 style={heading}>{t('today_works')}</h2>
      {works.length ? (
        <div style={{ display: 'grid', gap: 6 }}>{works.map((w) => <WorkChip key={w.id} work={w} />)}</div>
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

export function TodayEntries({ entries, day, isToday = true }: { entries: JournalDayEntry[]; day: string; isToday?: boolean }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  return (
    <section data-testid="hub-today-entries" style={section}>
      <h2 style={heading}>{t('today_entries')}</h2>
      {entries.length ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {entries.map((e) => (
            <li key={e.id} style={{ fontSize: 14, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>
                {time(e.created_at)}
                {' · '}
                {e.author}
                {e.voiceNoteId ? <>{' · '}{t('today_voice_note')}</> : null}
              </span>
              <br />
              {e.body.length > 220 ? `${e.body.slice(0, 220)}…` : e.body}
            </li>
          ))}
        </ul>
      ) : (
        <p style={muted}>{t(isToday ? 'today_entries_empty' : 'today_entries_empty_day')}</p>
      )}
      <Link href={journalDayHref(day, isToday)} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 6, fontSize: 13, color: 'var(--ac)' }}>
        {t('today_open_full')}
      </Link>
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
                href="/atelier/concepts"
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
      <details className="pem-fold" data-testid="hub-today-fold-creation" style={section} onToggle={onToggle}>
        <summary style={summary}>
          {t('je_creation_heading')} {count(ready?.creation.length)}
        </summary>
        {status}
        {ready ? (
          ready.creation.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {ready.creation.map((k) => (
                <li key={k.id} style={{ fontSize: 14, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                  <span style={{ fontSize: 12, color: 'var(--tx3)' }}>
                    {time(k.created_at)}
                    {' · '}
                    {k.author}
                    {k.done ? <>{' · '}{t('je_creation_done')}</> : null}
                  </span>
                  <br />
                  {k.title ? <b>{k.title}</b> : null}
                  {k.title && k.body ? ' — ' : null}
                  {k.body.length > 220 ? `${k.body.slice(0, 220)}…` : k.body}
                  {k.works.length ? (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {k.works.map((id) => (
                        <WorkPreviewChip key={id} id={id} href={workHref(id)} size="chip" style={{ minHeight: 44 }} />
                      ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p style={muted}>{t('je_creation_empty')}</p>
          )
        ) : null}
        {ready ? (
          <Link href="/atelier/kaizen" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 6, fontSize: 13, color: 'var(--ac)' }}>
            {t('je_creation_open')}
          </Link>
        ) : null}
      </details>
    </>
  )
}
