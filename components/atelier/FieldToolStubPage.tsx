'use client'

import Link from 'next/link'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useI18n } from '@/lib/i18n/context'

export type FieldVerbKind = 'session' | 'capture' | 'documents' | 'triage' | 'default'

type FieldLink = { href: string; labelKey: DictKey }

const KIND_COPY: Record<
  FieldVerbKind,
  { titleKey: DictKey; bodyKey: DictKey; links: FieldLink[] }
> = {
  default: {
    titleKey: 'field_stub_title',
    bodyKey: 'field_stub_body',
    links: [],
  },
  session: {
    titleKey: 'field_verb_session_title',
    bodyKey: 'field_verb_session_body',
    links: [
      { href: '/atelier/works/new', labelKey: 'field_verb_link_new_work' },
      { href: '/atelier/scan', labelKey: 'field_verb_link_scan' },
    ],
  },
  capture: {
    titleKey: 'field_verb_capture_title',
    bodyKey: 'field_verb_capture_body',
    links: [
      { href: '/atelier/share-triage', labelKey: 'field_verb_link_share_triage' },
      { href: '/atelier/works/new', labelKey: 'field_verb_link_new_work' },
    ],
  },
  documents: {
    titleKey: 'field_verb_documents_title',
    bodyKey: 'field_verb_documents_body',
    links: [
      { href: '/atelier?tab=vault', labelKey: 'field_verb_link_vault' },
      { href: '/atelier?tab=portfolio', labelKey: 'tab_portfolio' },
    ],
  },
  triage: {
    titleKey: 'field_verb_triage_title',
    bodyKey: 'field_verb_triage_body',
    links: [
      { href: '/atelier?tab=broadcast', labelKey: 'field_verb_link_broadcast' },
      { href: '/atelier/share-triage', labelKey: 'field_verb_link_share_triage' },
    ],
  },
}

/** Ring C — hub-linked field verb routes; verb-specific guidance + deep links until full flows ship. */
export function FieldToolStubPage({ kind = 'default' }: { kind?: FieldVerbKind }) {
  const { t } = useI18n()
  const meta = KIND_COPY[kind] ?? KIND_COPY.default

  return (
    <main
      data-testid={`field-stub-${kind}`}
      aria-labelledby="field-stub-heading"
      style={{
        minHeight: '100dvh',
        padding: 'max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        maxWidth: 440,
        margin: '0 auto',
        gap: 20,
        background: 'var(--bg0)',
        color: 'var(--tx)',
      }}
    >
      <h1 id="field-stub-heading" className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
        {t(meta.titleKey)}
      </h1>
      <p className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 12 }}>
        {t(meta.bodyKey)}
      </p>
      {meta.links.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {meta.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="btn ghost"
                style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {t(l.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        <Link href="/atelier" className="btn primary" style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {t('field_stub_cta_atelier')}
        </Link>
        <Link href="/hub" className="btn ghost" style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {t('field_stub_cta_hub')}
        </Link>
      </div>
    </main>
  )
}
