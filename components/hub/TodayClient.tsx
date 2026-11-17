'use client'

// R2 « Aujourd'hui » v1 — light view of the day (docs/design/2026-11-17/PhoneToday.notes.md).
// Read-only first screen + the sticky input bar; actions open the existing full screens.
// Streaming (Speed first, rule 2): `TodayFrame` (header, bar) is in the first HTML; each section below
// is its own component, filled by app/hub/today/page.tsx as its query finishes (Suspense).
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { atelierTabHref } from '@/lib/atelier/tab-routes'
import { AccountActions } from '@/components/shared/AccountActions'
import type { FieldPulseMetric, FieldPulseMetricKey } from '@/app/atelier/field-inbox/data'
import type { SeeAgainSlots, SeeAgainWork } from '@/app/atelier/see-again/actions'
import type { JournalDayEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { PhoneInputBar } from '@/components/shared/PhoneInputBar'
import { SeeAgainCard } from '@/components/atelier/SeeAgainCard'
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

const section: CSSProperties = { padding: '14px 16px', borderTop: '1px solid var(--bd)' }
const heading: CSSProperties = { fontSize: 12, letterSpacing: '0.04em', color: 'var(--tx3)', margin: '0 0 8px' }
const muted: CSSProperties = { fontSize: 13, color: 'var(--tx3)', margin: 0 }

function Thumb({ file, size }: { file: string | null; size: number }) {
  const src = thumbUrl(file)
  const box: CSSProperties = { width: size, height: size, borderRadius: 6, objectFit: 'cover', background: 'var(--bg2)', flex: 'none' }
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" width={size} height={size} loading="lazy" style={box} /> : <span style={{ ...box, display: 'inline-block' }} />
}

function WorkChip({ work }: { work: SeeAgainWork | TodayWork }) {
  const file = 'image' in work ? work.image : work.thumb
  return (
    <Link href={workHref(work.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, color: 'var(--tx)', textDecoration: 'none' }}>
      <Thumb file={file} size={44} />
      <span style={{ fontSize: 14, lineHeight: 1.3 }}>
        <span style={{ color: 'var(--tx3)' }}>#{work.id}</span>
        {work.title ? <>{' · '}{work.title}</> : null}
      </span>
    </Link>
  )
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

export function TodayFrame({ day, children }: { day: string; children: ReactNode }) {
  const { t, lang } = useI18n()
  const router = useRouter()
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

  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div data-testid="hub-today-root" style={{ minHeight: '100dvh', background: 'var(--bg0)', color: 'var(--tx)', overflowX: 'hidden', paddingBottom: 'max(80px, calc(76px + env(safe-area-inset-bottom)))' }}>
      {/* Right padding keeps 📅 clear of the floating signed-in badge (LoggedInBar). */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 48px 4px 16px' }}>
        <Link href="/atelier" aria-label={t('today_menu')} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--tx)', textDecoration: 'none', fontSize: 20 }}>☰</Link>
        <h1 style={{ fontSize: 22, margin: 0, flex: 1, textTransform: 'capitalize' }}>{date}</h1>
        <Link href="/atelier/journal" aria-label={t('today_days')} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--tx)', textDecoration: 'none', fontSize: 18 }}>📅</Link>
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

export function TodayWorks({ works }: { works: TodayWork[] }) {
  const { t } = useI18n()
  return (
    <section data-testid="hub-today-works" style={section}>
      <h2 style={heading}>{t('today_works')}</h2>
      {works.length ? (
        <div style={{ display: 'grid', gap: 6 }}>{works.map((w) => <WorkChip key={w.id} work={w} />)}</div>
      ) : (
        <p style={muted}>{t('today_works_empty')}</p>
      )}
    </section>
  )
}

export function TodayEntries({ entries }: { entries: JournalDayEntry[] }) {
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
        <p style={muted}>{t('today_entries_empty')}</p>
      )}
      <Link href="/atelier/journal?today=1" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 6, fontSize: 13, color: 'var(--ac)' }}>
        {t('today_open_full')}
      </Link>
    </section>
  )
}
