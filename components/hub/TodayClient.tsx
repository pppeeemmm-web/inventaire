'use client'

// R2 « Aujourd'hui » v1 — light view of the day (docs/design/2026-11-17/PhoneToday.notes.md).
// Read-only first screen + the sticky input bar; actions open the existing full screens.
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState, type CSSProperties } from 'react'
import type { FieldPulseMetric, FieldPulseMetricKey } from '@/app/atelier/field-inbox/data'
import type { SeeAgainSlots, SeeAgainWork } from '@/app/atelier/see-again/actions'
import type { JournalDayEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
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

export function TodayClient({
  day,
  metrics,
  seeAgain,
  entries,
  voiceCount,
  works,
  partialError,
}: {
  day: string
  metrics: FieldPulseMetric[]
  seeAgain: SeeAgainSlots | null
  entries: JournalDayEntry[]
  voiceCount: number
  works: TodayWork[]
  partialError: boolean
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [voiceOpen, setVoiceOpen] = useState(false)

  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const summary = t('today_summary')
    .replace('{e}', String(entries.length))
    .replace('{w}', String(works.length))
    .replace('{v}', String(voiceCount))
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

  const barBtn: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    minHeight: 56, fontSize: 12, color: 'var(--tx)', textDecoration: 'none', background: 'none', border: 0, cursor: 'pointer',
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg0)', color: 'var(--tx)', paddingBottom: 'calc(56px + max(8px, env(safe-area-inset-bottom)))' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 4px' }}>
        <Link href="/atelier" aria-label={t('today_menu')} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--tx)', textDecoration: 'none', fontSize: 20 }}>☰</Link>
        <h1 style={{ fontSize: 22, margin: 0, flex: 1, textTransform: 'capitalize' }}>{date}</h1>
        <Link href="/atelier/journal" aria-label={t('today_days')} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--tx)', textDecoration: 'none', fontSize: 18 }}>📅</Link>
      </header>
      <p style={{ ...muted, padding: '0 16px 8px' }}>{summary}</p>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '0 16px 12px', fontSize: 13 }}>
        {metrics.map((m) => (
          <Link key={m.key} href={m.href} style={{ minHeight: 32, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: m.count === 0 ? 'var(--tx3)' : m.tone === 'urgent' ? 'var(--rust)' : 'var(--tx)' }}>
            <b>{m.count}</b>
            {t(METRIC_LABELS[m.key])}
          </Link>
        ))}
      </nav>

      {partialError ? <p style={{ ...muted, padding: '0 16px 12px', color: 'var(--rust)' }}>{t('today_load_error')}</p> : null}

      {seeAgain && (seeAgain.then || seeAgain.alone || seeAgain.close) ? (
        <section style={section}>
          <h2 style={heading}>{t('today_see_again')}</h2>
          {seeAgain.then ? (
            <Link href={`/atelier/journal?day=${seeAgain.then.day}`} style={{ display: 'block', color: 'var(--tx)', textDecoration: 'none', fontSize: 14, lineHeight: 1.4, minHeight: 44 }}>
              <span style={{ color: 'var(--tx3)' }}>{t(seeAgain.then.sameWeek ? 'sa_then_week' : 'sa_then_older')}</span>
              <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {seeAgain.then.snippet}
              </span>
            </Link>
          ) : seeAgain.alone ? (
            <WorkChip work={seeAgain.alone} />
          ) : seeAgain.close ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <WorkChip work={seeAgain.close.a} />
              <WorkChip work={seeAgain.close.b} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section style={section}>
        <h2 style={heading}>{t('today_works')}</h2>
        {works.length ? (
          <div style={{ display: 'grid', gap: 6 }}>{works.map((w) => <WorkChip key={w.id} work={w} />)}</div>
        ) : (
          <p style={muted}>{t('today_works_empty')}</p>
        )}
      </section>

      <section style={section}>
        <h2 style={heading}>{t('today_entries')}</h2>
        {entries.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {entries.map((e) => (
              <li key={e.id} style={{ fontSize: 14, lineHeight: 1.45 }}>
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

      <nav
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'var(--bg1)', borderTop: '1px solid var(--bd2)', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', zIndex: 20,
        }}
      >
        <Link href="/atelier/journal?today=1" style={barBtn}><span aria-hidden="true">✍️</span>{t('today_bar_write')}</Link>
        <button type="button" onClick={() => setVoiceOpen(true)} style={barBtn}><span aria-hidden="true">🎙️</span>{t('today_bar_voice')}</button>
        <Link href="/atelier/session/new" style={barBtn}><span aria-hidden="true">🖼️</span>{t('today_bar_work')}</Link>
        <Link href="/atelier/capture?mode=doc" style={barBtn}><span aria-hidden="true">📄</span>{t('today_bar_doc')}</Link>
      </nav>

      {voiceOpen ? <VoiceNoteSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} oeuvreOptions={[]} /> : null}
    </div>
  )
}
