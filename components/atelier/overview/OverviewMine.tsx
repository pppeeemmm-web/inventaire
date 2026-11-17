'use client'

// R1 step 6 slice 4b — a team member's « Pour vous » (docs/design/2026-11-17/R1_InputsFeed.notes.md
// « Where the feed lives », open question 4): their own lines (works, ideas, « Proposer une idée »),
// newest first, and what happened to each — still standing, or taken out by Pem (with the date).
// That is the notification: in-app only. RLS lets an author read their own discarded lines.

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { listMyNoteLines, type MyNoteLine } from '@/app/atelier/fil/note-lines-actions'

const ELLIPSIS: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

export function OverviewMine({ onGoIdeas, narrow = false }: { onGoIdeas: () => void; narrow?: boolean }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [lines, setLines] = useState<MyNoteLine[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void listMyNoteLines()
      .then((res) => {
        if (cancelled) return
        if ('error' in res) setFailed(true)
        else setLines(res.lines)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })
  const out = lines?.filter((l) => l.discardedAt).length ?? 0

  return (
    <div data-testid="overview-mine" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: narrow ? '8px 16px' : '8px 12px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-instrument-next), serif', fontWeight: 400, fontSize: 20 }}>{t('my_title')}</h2>
        <b>{lines ? lines.length : '…'}</b>
        {out > 0 && <span data-testid="overview-mine-out" style={{ fontSize: 12, color: 'var(--rust)' }}>{t('my_discarded_count').replace('{n}', String(out))}</span>}
        <span style={{ fontSize: 12, color: 'var(--tx3)', flex: '1 1 200px', minWidth: 0 }}>{t('my_intro')}</span>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: narrow ? undefined : 'auto' }}>
        {failed ? (
          <p style={{ margin: 0, padding: '10px 12px', color: 'var(--rust)', fontSize: 13 }}>{t('my_load_error')}</p>
        ) : !lines ? (
          <p style={{ margin: 0, padding: '10px 12px', color: 'var(--tx3)', fontSize: 13 }}>{t('nl_loading')}</p>
        ) : lines.length === 0 ? (
          <p data-testid="overview-mine-empty" style={{ margin: 0, padding: '10px 12px', color: 'var(--tx3)', fontSize: 13 }}>{t('my_empty')}</p>
        ) : (
          lines.map((l) => {
            const where =
              l.kind === 'work' && l.work ? (
                <Link href={`/atelier/inventory?work=${l.work.id}`} style={{ color: 'var(--tx2)', ...ELLIPSIS }}>
                  {t('my_kind_work').replace('{id}', String(l.work.id))}
                  {l.work.title ? ` · ${l.work.title}` : ''}
                </Link>
              ) : l.kind === 'idea' ? (
                <button type="button" onClick={onGoIdeas} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--tx2)', cursor: 'pointer', textAlign: 'left', ...ELLIPSIS }}>
                  {t('my_kind_idea')}
                  {l.idea?.title ? ` · ${l.idea.title}` : ''}
                </button>
              ) : (
                <span style={ELLIPSIS}>
                  {t('my_kind_proposal')}
                  {l.work ? ` · #${l.work.id}` : ''}
                </span>
              )
            return (
              <div
                key={l.id}
                data-testid="overview-mine-line"
                data-state={l.discardedAt ? 'discarded' : 'standing'}
                style={{ display: 'grid', gap: 2, padding: narrow ? '8px 16px' : '7px 12px', borderBottom: '1px solid var(--bg2)', minHeight: narrow ? 44 : undefined }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 8px', fontSize: 11, color: 'var(--tx3)' }}>
                  {where}
                  <span>{date(l.createdAt)}</span>
                  {l.flagged && <span style={{ color: 'var(--ac)' }}>{t('nl_flagged')}</span>}
                  <span style={{ flex: 1 }} />
                  {l.discardedAt ? (
                    <span style={{ color: 'var(--rust)', fontWeight: 600 }}>{t('my_discarded').replace('{date}', date(l.discardedAt))}</span>
                  ) : (
                    <span style={{ color: 'var(--sage, var(--tx2))' }}>{t('my_standing')}</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: l.discardedAt ? 'var(--tx3)' : 'var(--tx)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}
                >
                  {l.body}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
