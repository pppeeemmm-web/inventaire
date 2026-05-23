'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { DictKey } from '@/lib/i18n/dictionary'
import { VoiceNoteSheet } from '@/components/shared/VoiceNoteSheet'
import { tryOpenLightroomIosApp, LIGHTROOM_IOS_APP_STORE_URL } from '@/lib/mobile/lightroom-return'
import type { FieldPulseCard, FieldPulseData, FieldPulseMetricKey } from '@/app/atelier/field-inbox/data'
import { getSessionNewPageContext } from '@/app/atelier/session/actions'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'

const LEGACY_TILES = [
  { key: 'hub_launcher_field' as const, subKey: 'hub_launcher_field_sub' as const, tab: 'inventory' },
  { key: 'hub_launcher_studio' as const, subKey: 'hub_launcher_studio_sub' as const, tab: 'overview' },
  { key: 'hub_launcher_commercial' as const, subKey: 'hub_launcher_commercial_sub' as const, tab: 'pipeline' },
  { key: 'hub_launcher_admin' as const, subKey: 'hub_launcher_admin_sub' as const, tab: 'contacts' },
]

type FieldRow =
  | { kind: 'link'; testId: string; emoji: string; labelKey: DictKey; subKey: DictKey; href: string }
  | { kind: 'note'; testId: string; emoji: string; labelKey: DictKey; subKey: DictKey }

/** Ring B.1 — field verbs first; order matches iPhone SE plan. */
const LIGHTROOM_INTRO_KEY = 'pem_lightroom_intro_seen'

const FIELD_ROWS: FieldRow[] = [
  { kind: 'link', testId: 'hub-field-verb-lightroom', emoji: '🎨', labelKey: 'hub_field_lightroom', subKey: 'hub_field_lightroom_sub', href: '/atelier/share-triage' },
  { kind: 'link', testId: 'hub-field-verb-session', emoji: '📷', labelKey: 'hub_field_session', subKey: 'hub_field_session_sub', href: '/atelier/session/new' },
  { kind: 'note', testId: 'hub-field-verb-note', emoji: '🎤', labelKey: 'hub_field_note', subKey: 'hub_field_note_sub' },
  { kind: 'link', testId: 'hub-field-verb-scan-doc', emoji: '📄', labelKey: 'hub_field_scan_doc', subKey: 'hub_field_scan_doc_sub', href: '/atelier/capture?mode=doc' },
  { kind: 'link', testId: 'hub-field-verb-pipeline', emoji: '📅', labelKey: 'hub_field_pipeline', subKey: 'hub_field_pipeline_sub', href: '/atelier/pipeline' },
  { kind: 'link', testId: 'hub-field-verb-sale', emoji: '💳', labelKey: 'hub_field_sale', subKey: 'hub_field_sale_sub', href: '/atelier/sale/new' },
  { kind: 'link', testId: 'hub-field-verb-triage', emoji: '📣', labelKey: 'hub_field_triage', subKey: 'hub_field_triage_sub', href: '/atelier/triage' },
  { kind: 'link', testId: 'hub-field-verb-contact', emoji: '👤', labelKey: 'hub_field_contact', subKey: 'hub_field_contact_sub', href: '/atelier/capture?mode=card' },
  { kind: 'link', testId: 'hub-field-verb-document', emoji: '✍️', labelKey: 'hub_field_document', subKey: 'hub_field_document_sub', href: '/atelier/documents/new' },
  { kind: 'link', testId: 'hub-field-verb-issue', emoji: '⚠️', labelKey: 'hub_field_issue', subKey: 'hub_field_issue_sub', href: '/atelier/issue/new' },
]

const METRIC_LABELS: Record<FieldPulseMetricKey, DictKey> = {
  past_due: 'field_pulse_metric_past_due',
  today: 'field_pulse_metric_today',
  pending_review: 'field_pulse_metric_pending_review',
  inbox: 'field_pulse_metric_inbox',
}

function fieldRowSubKey(row: FieldRow, isAdmin: boolean): DictKey {
  if (isAdmin && row.testId === 'hub-field-verb-session') return 'hub_field_session_sub_admin'
  return row.subKey
}

function fieldRowHref(row: FieldRow, isAdmin: boolean): string {
  if (row.kind === 'link' && row.testId === 'hub-field-verb-session') {
    if (!isAdmin) return '/atelier?tab=journal'
    return `/atelier/session/new?date=${todayCalendarDayInParis()}`
  }
  return row.kind === 'link' ? row.href : ''
}

function renderCardText(card: FieldPulseCard, field: 'title' | 'detail', t: (key: DictKey) => string): string {
  const raw = field === 'title' ? card.title : card.detail
  const key = field === 'title' ? card.titleKey : card.detailKey
  const vars = field === 'title' ? card.titleVars : card.detailVars
  const template = raw ?? (key ? t(key) : '')
  return Object.entries(vars ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template,
  )
}

function FieldPulsePanel({ fieldPulse }: { fieldPulse: FieldPulseData }) {
  const { t } = useI18n()
  const firstCard = fieldPulse.cards[0]
  const firstTitle = firstCard ? renderCardText(firstCard, 'title', t) : ''
  const firstDetail = firstCard ? renderCardText(firstCard, 'detail', t) : ''

  return (
    <section
      data-testid="hub-field-pulse"
      aria-label={t('field_pulse_title')}
      style={{
        width: '100%',
        maxWidth: 420,
        border: '1px solid var(--bd)',
        borderRadius: 12,
        padding: 14,
        background: 'var(--bg1)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="t-eyebrow" style={{ fontSize: 10 }}>{t('field_pulse_title')}</div>
          <p className="t-mono-sm" style={{ margin: '6px 0 0', color: 'var(--tx2)', fontSize: 11, lineHeight: 1.35 }}>
            {t('field_pulse_subtitle')}
          </p>
        </div>
        <Link href="/atelier/field-inbox" className="btn ghost sm" style={{ minHeight: 36, flexShrink: 0 }}>
          {t('field_pulse_open')}
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {fieldPulse.metrics.map((metric) => (
          <Link
            key={metric.key}
            href={metric.href}
            className="btn ghost sm"
            style={{
              minHeight: 58,
              padding: '8px 4px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              borderColor: metric.tone === 'urgent' && metric.count > 0 ? 'var(--rust)' : 'var(--bd)',
            }}
          >
            <strong style={{ fontSize: 18, lineHeight: 1 }}>{metric.count}</strong>
            <span style={{ fontSize: 9, opacity: 0.65, textAlign: 'center', lineHeight: 1.1 }}>
              {t(METRIC_LABELS[metric.key])}
            </span>
          </Link>
        ))}
      </div>

      {firstCard ? (
        <Link
          href={firstCard.href}
          className="btn ghost"
          data-testid="hub-field-pulse-top-card"
          style={{
            minHeight: 54,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 4,
            padding: 12,
            textAlign: 'left',
            whiteSpace: 'normal',
          }}
        >
          <span className="t-eyebrow" style={{ fontSize: 9 }}>{t('field_pulse_next')}</span>
          <span style={{ fontSize: 12, fontWeight: 650 }}>{firstTitle}</span>
          <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx2)', lineHeight: 1.3 }}>
            {firstDetail}
          </span>
        </Link>
      ) : (
        <div className="t-mono-sm" style={{ color: 'var(--tx2)', fontSize: 11, lineHeight: 1.4 }}>
          {t('field_pulse_empty')}
        </div>
      )}
    </section>
  )
}

export function HubLauncherClient({ fieldPulse }: { fieldPulse: FieldPulseData }) {
  const { t } = useI18n()
  const router = useRouter()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [viewportReady, setViewportReady] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [lightroomModalOpen, setLightroomModalOpen] = useState(false)

  useEffect(() => {
    setViewportReady(true)
  }, [])

  useEffect(() => {
    void getSessionNewPageContext().then((ctx) => setIsAdmin(ctx.isAdmin))
  }, [])

  useEffect(() => {
    if (!viewportReady || narrow) return
    router.replace('/atelier?tab=overview')
  }, [narrow, router, viewportReady])

  useEffect(() => {
    if (!viewportReady || !narrow) return
    try {
      if (localStorage.getItem(LIGHTROOM_INTRO_KEY) === '1') return
    } catch {
      return
    }
    setLightroomModalOpen(true)
  }, [viewportReady, narrow])

  const rootPad = narrow
    ? {
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
      }
    : { padding: 24 }

  if (!viewportReady || !narrow) {
    return (
      <div
        data-testid="hub-desktop-redirecting"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          color: 'var(--tx2)',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div className="t-label" style={{ fontSize: 11, letterSpacing: 2, opacity: 0.5 }}>
            {t('hub_launcher_subtitle')}
          </div>
          <div className="serif s-lg" style={{ marginTop: 8 }}>
            {t('hub_desktop_redirecting')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: narrow ? 'flex-start' : 'center',
        overflowY: 'auto',
        overflowX: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        gap: narrow ? 20 : 32,
        ...rootPad,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div className="t-label" style={{ fontSize: 11, letterSpacing: 2, opacity: 0.5 }}>{t('hub_launcher_subtitle')}</div>
        <div className="serif s-lg" style={{ marginTop: 8 }}>{t('hub_launcher_title')}</div>
      </div>

      <VoiceNoteSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} oeuvreOptions={[]} />

      {lightroomModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-lightroom-modal-title"
          data-testid="hub-lightroom-modal"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
          }}
          onClick={() => {
            try {
              localStorage.setItem(LIGHTROOM_INTRO_KEY, '1')
            } catch { /* ignore */ }
            setLightroomModalOpen(false)
          }}
        >
          <div
            style={{
              maxWidth: 400,
              width: '100%',
              background: 'var(--bg1)',
              border: '1px solid var(--bd)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="hub-lightroom-modal-title" className="serif" style={{ fontSize: 20, margin: 0 }}>
              {t('hub_lightroom_modal_title')}
            </h2>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
                color: 'var(--tx2)',
              }}
            >
              {t('hub_lightroom_modal_body')}
            </pre>
            <button
              type="button"
              className="btn ghost"
              style={{ minHeight: 44 }}
              data-testid="hub-lightroom-try-open"
              onClick={() => tryOpenLightroomIosApp()}
            >
              {t('lightroom_try_open_app')}
            </button>
            <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0, lineHeight: 1.45 }}>
              {t('lightroom_open_failed_hint')}
            </p>
            <a
              href={LIGHTROOM_IOS_APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn ghost sm"
              style={{ minHeight: 40, textAlign: 'center', textDecoration: 'none' }}
            >
              {t('lightroom_app_store')}
            </a>
            <button
              type="button"
              className="btn primary"
              style={{ minHeight: 44 }}
              onClick={() => {
                try {
                  localStorage.setItem(LIGHTROOM_INTRO_KEY, '1')
                } catch { /* ignore */ }
                setLightroomModalOpen(false)
              }}
            >
              {t('hub_lightroom_modal_got_it')}
            </button>
          </div>
        </div>
      ) : null}

      {narrow ? (
        <div data-testid="hub-field-launcher-root" data-hub-copy-rev="2026-05-15" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldPulsePanel fieldPulse={fieldPulse} />

          {FIELD_ROWS.map((row) => {
            const subKey = fieldRowSubKey(row, isAdmin)
            const content = (
              <>
                <span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }} aria-hidden>{row.emoji}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t(row.labelKey)}</span>
                    <span style={{ fontSize: 10, opacity: 0.55, letterSpacing: 0.4 }}>{t(subKey)}</span>
                  </span>
                </span>
                <span style={{ fontSize: 14, opacity: 0.35, flexShrink: 0 }} aria-hidden>›</span>
              </>
            )
            const rowStyle = {
              minHeight: 64,
              width: '100%',
              display: 'flex',
              flexDirection: 'row' as const,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              textAlign: 'left' as const,
              gap: 12,
              color: 'inherit',
              textDecoration: 'none',
              boxSizing: 'border-box' as const,
            }

            if (row.kind === 'link') {
              return (
                <Link
                  key={row.labelKey}
                  href={fieldRowHref(row, isAdmin)}
                  className="btn ghost"
                  data-testid={row.testId}
                  aria-label={`${t(row.labelKey)}. ${t(subKey)}`}
                  style={rowStyle}
                >
                  {content}
                </Link>
              )
            }

            return (
              <button
                key={row.labelKey}
                type="button"
                className="btn ghost"
                data-testid={row.testId}
                aria-label={`${t(row.labelKey)}. ${t(subKey)}`}
                onClick={() => setVoiceOpen(true)}
                style={rowStyle}
              >
                {content}
              </button>
            )
          })}

          <button
            type="button"
            className="btn ghost"
            data-testid="hub-field-more-toggle"
            onClick={() => setLegacyOpen((v) => !v)}
            aria-expanded={legacyOpen}
            style={{
              minHeight: 44,
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              marginTop: 4,
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t('hub_field_more')}</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{t('hub_field_more_sub')}</span>
            </span>
            <span style={{ fontSize: 12, opacity: 0.45 }} aria-hidden>{legacyOpen ? '▴' : '▾'}</span>
          </button>

          {legacyOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
              {LEGACY_TILES.map(({ key, subKey, tab }) => (
                <button
                  key={key}
                  type="button"
                  className="btn ghost"
                  aria-label={`${t(key)}. ${t(subKey)}`}
                  onClick={() => void router.push(`/atelier?tab=${tab}`)}
                  style={{
                    minHeight: 56,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '14px 18px',
                    gap: 6,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t(key)}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, letterSpacing: 0.5 }}>{t(subKey)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            width: '100%',
            maxWidth: 480,
          }}
        >
          {LEGACY_TILES.map(({ key, subKey, tab }) => (
            <button
              key={key}
              type="button"
              className="btn ghost"
              aria-label={`${t(key)}. ${t(subKey)}`}
              onClick={() => void router.push(`/atelier?tab=${tab}`)}
              style={{
                minHeight: 80,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '16px 18px',
                gap: 6,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t(key)}</span>
              <span style={{ fontSize: 10, opacity: 0.5, letterSpacing: 0.5 }}>{t(subKey)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn primary"
        data-testid="hub-launcher-enter-atelier"
        onClick={() => void router.push('/atelier')}
        style={{
          minHeight: 44,
          fontSize: 12,
          letterSpacing: 1,
          width: narrow ? '100%' : undefined,
          maxWidth: narrow ? 420 : undefined,
          marginTop: narrow ? 'auto' : undefined,
          flexShrink: 0,
          paddingBottom: narrow ? 'max(4px, env(safe-area-inset-bottom, 0px))' : undefined,
        }}
      >
        {t('hub_launcher_enter_atelier')}
      </button>
    </div>
  )
}
