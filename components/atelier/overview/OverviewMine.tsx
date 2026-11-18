'use client'

// R1 step 6 slice 4b — a team member's « Pour vous » (docs/design/2026-11-17/R1_InputsFeed.notes.md
// « Where the feed lives », open question 4): their own lines (works, ideas, « Proposer une idée »),
// newest first, and what happened to each — still standing, or taken out by Pem (with the date).
// That is the notification: in-app only. RLS lets an author read their own discarded lines.
// Work card proposals (`pending_changes`) sit in the same list: waiting, approved, or rejected with
// Pem's reason (« sans raison » when none) — RLS `pending_changes_select` lets the author read their own.

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { WorkRef } from '@/components/atelier/WorkRef'
import { listMyNoteLines, type MyNoteLine } from '@/app/atelier/fil/note-lines-actions'
import { listMyProposals, type MyProposal } from '@/app/atelier/(portal)/audit/pending-actions'
import { isUndatedOldNote } from '@/lib/note-line-dates'

const ELLIPSIS: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

export function OverviewMine({ onGoIdeas, narrow = false }: { onGoIdeas: () => void; narrow?: boolean }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [lines, setLines] = useState<MyNoteLine[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [proposals, setProposals] = useState<MyProposal[] | null>(null)
  const [proposalsFailed, setProposalsFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void listMyProposals()
      .then((res) => {
        if (cancelled) return
        if ('error' in res) {
          setProposals([])
          setProposalsFailed(true)
        } else setProposals(res.proposals)
      })
      .catch(() => {
        if (cancelled) return
        setProposals([])
        setProposalsFailed(true)
      })
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

  const date = (iso: string) =>
    isUndatedOldNote(iso)
      ? t('nl_before_may_2026')
      : new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })
  const out = lines?.filter((l) => l.discardedAt).length ?? 0
  const refused = proposals?.filter((p) => p.status === 'rejected').length ?? 0
  const ready = lines != null && proposals != null
  // One list, newest first: lines and proposals side by side.
  const items: Array<{ at: string; line?: MyNoteLine; prop?: MyProposal }> = ready
    ? [...lines.map((l) => ({ at: l.createdAt, line: l })), ...proposals.map((p) => ({ at: p.createdAt, prop: p }))].sort((a, b) =>
        b.at.localeCompare(a.at),
      )
    : []

  return (
    <div data-testid="overview-mine" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: narrow ? '8px 16px' : '8px 12px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-instrument-next), serif', fontWeight: 400, fontSize: 20 }}>{t('my_title')}</h2>
        <b>{ready ? items.length : '…'}</b>
        {out > 0 && <span data-testid="overview-mine-out" style={{ fontSize: 12, color: 'var(--rust)' }}>{t('my_discarded_count').replace('{n}', String(out))}</span>}
        {refused > 0 && <span data-testid="overview-mine-refused" style={{ fontSize: 12, color: 'var(--rust)' }}>{t('my_prop_rejected_count').replace('{n}', String(refused))}</span>}
        <span style={{ fontSize: 12, color: 'var(--tx3)', flex: '1 1 200px', minWidth: 0 }}>{t('my_intro')}</span>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: narrow ? undefined : 'auto' }}>
        {failed ? (
          <p style={{ margin: 0, padding: '10px 12px', color: 'var(--rust)', fontSize: 13 }}>{t('my_load_error')}</p>
        ) : !ready ? (
          <p style={{ margin: 0, padding: '10px 12px', color: 'var(--tx3)', fontSize: 13 }}>{t('nl_loading')}</p>
        ) : (
          <>
          {proposalsFailed && <p style={{ margin: 0, padding: '10px 12px', color: 'var(--rust)', fontSize: 13 }}>{t('my_prop_load_error')}</p>}
          {items.length === 0 ? (
          <p data-testid="overview-mine-empty" style={{ margin: 0, padding: '10px 12px', color: 'var(--tx3)', fontSize: 13 }}>{t('my_empty')}</p>
          ) : items.map(({ line: l, prop: p }) => {
            if (p) return <ProposalRow key={`p${p.id}`} p={p} narrow={narrow} date={date} />
            if (!l) return null
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
                  {l.work ? <>{' · '}<WorkRef id={l.work.id} style={{ color: 'var(--tx2)' }} /></> : null}
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
          })}
          </>
        )}
      </div>
    </div>
  )
}

/** One work card proposal: where, when, and what Pem did with it (a rejection shows its reason). */
function ProposalRow({ p, narrow, date }: { p: MyProposal; narrow: boolean; date: (iso: string) => string }) {
  const { t } = useI18n()
  const label =
    p.kind === 'create'
      ? `${t('my_prop_create')}${p.title ? ` · ${p.title}` : ''}`
      : `${t(p.kind === 'image_add' ? 'my_prop_image' : 'my_prop_edit').replace('{id}', String(p.work?.id ?? '—'))}${p.work?.title ? ` · ${p.work.title}` : ''}`
  const where = p.work ? (
    <Link href={`/atelier/inventory?work=${p.work.id}`} style={{ color: 'var(--tx2)', ...ELLIPSIS }}>{label}</Link>
  ) : (
    <span style={ELLIPSIS}>{label}</span>
  )
  const rejected = p.status === 'rejected'
  const body = rejected
    ? p.reason
      ? t('my_prop_reason').replace('{reason}', p.reason)
      : t('my_prop_no_reason')
    : p.kind === 'edit' && p.fields > 0
      ? t('my_prop_fields').replace('{n}', String(p.fields))
      : null
  return (
    <div
      data-testid="overview-mine-proposal"
      data-state={p.status}
      style={{ display: 'grid', gap: 2, padding: narrow ? '8px 16px' : '7px 12px', borderBottom: '1px solid var(--bg2)', minHeight: narrow ? 44 : undefined }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 8px', fontSize: 11, color: 'var(--tx3)' }}>
        {where}
        <span>{date(p.createdAt)}</span>
        <span style={{ flex: 1 }} />
        {rejected ? (
          <span style={{ color: 'var(--rust)', fontWeight: 600 }}>{t('my_prop_rejected').replace('{date}', p.reviewedAt ? date(p.reviewedAt) : '—')}</span>
        ) : p.status === 'approved' ? (
          <span style={{ color: 'var(--sage, var(--tx2))' }}>{t('my_prop_approved').replace('{date}', p.reviewedAt ? date(p.reviewedAt) : '—')}</span>
        ) : (
          <span style={{ color: 'var(--ac)' }}>{t('my_prop_pending')}</span>
        )}
      </div>
      {body && (
        <div
          data-testid={rejected ? 'overview-mine-proposal-reason' : undefined}
          style={{ fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: rejected ? 'var(--tx)' : 'var(--tx2)' }}
        >
          {body}
        </div>
      )}
    </div>
  )
}
