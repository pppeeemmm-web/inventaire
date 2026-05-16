'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { DictKey } from '@/lib/i18n/dictionary'
import { VoiceNoteSheet } from '@/components/shared/VoiceNoteSheet'

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
const FIELD_ROWS: FieldRow[] = [
  { kind: 'link', testId: 'hub-field-verb-session', emoji: '📷', labelKey: 'hub_field_session', subKey: 'hub_field_session_sub', href: '/atelier/session/new' },
  { kind: 'note', testId: 'hub-field-verb-note', emoji: '🎤', labelKey: 'hub_field_note', subKey: 'hub_field_note_sub' },
  { kind: 'link', testId: 'hub-field-verb-scan-doc', emoji: '📄', labelKey: 'hub_field_scan_doc', subKey: 'hub_field_scan_doc_sub', href: '/atelier/capture?mode=doc' },
  { kind: 'link', testId: 'hub-field-verb-pipeline', emoji: '📅', labelKey: 'hub_field_pipeline', subKey: 'hub_field_pipeline_sub', href: '/atelier?tab=pipeline' },
  { kind: 'link', testId: 'hub-field-verb-triage', emoji: '📣', labelKey: 'hub_field_triage', subKey: 'hub_field_triage_sub', href: '/atelier/triage' },
  { kind: 'link', testId: 'hub-field-verb-contact', emoji: '👤', labelKey: 'hub_field_contact', subKey: 'hub_field_contact_sub', href: '/atelier/capture?mode=card' },
  { kind: 'link', testId: 'hub-field-verb-document', emoji: '✍️', labelKey: 'hub_field_document', subKey: 'hub_field_document_sub', href: '/atelier/documents/new' },
  { kind: 'link', testId: 'hub-field-verb-issue', emoji: '⚠️', labelKey: 'hub_field_issue', subKey: 'hub_field_issue_sub', href: '/atelier/issue/new' },
]

export function HubLauncherClient() {
  const { t } = useI18n()
  const router = useRouter()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [viewportReady, setViewportReady] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)

  useEffect(() => {
    setViewportReady(true)
  }, [])

  useEffect(() => {
    if (!viewportReady || narrow) return
    router.replace('/atelier?tab=overview')
  }, [narrow, router, viewportReady])

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

      {narrow ? (
        <div data-testid="hub-field-launcher-root" data-hub-copy-rev="2026-05-15" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FIELD_ROWS.map((row) => {
            const content = (
              <>
                <span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }} aria-hidden>{row.emoji}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t(row.labelKey)}</span>
                    <span style={{ fontSize: 10, opacity: 0.55, letterSpacing: 0.4 }}>{t(row.subKey)}</span>
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
                  href={row.href}
                  className="btn ghost"
                  data-testid={row.testId}
                  aria-label={`${t(row.labelKey)}. ${t(row.subKey)}`}
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
                aria-label={`${t(row.labelKey)}. ${t(row.subKey)}`}
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
