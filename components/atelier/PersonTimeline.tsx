'use client'

// The person page's timeline (People.md §5): one stream, newest first, day dividers, kind chips with counts from the
// database (one colour per kind), « Charger plus ancien » 20 at a time. Reads only (`person-timeline.ts`).

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { formatPriceFull } from '@/lib/format-price'
import {
  readPersonTimeline,
  readPersonTimelineCounts,
  type TimelineCursor,
  type TimelineItem,
} from '@/app/atelier/(portal)/contacts/person-timeline'
import { TIMELINE_KINDS, type TimelineKind } from '@/lib/contacts/person-timeline-kinds'

const KIND_COLOUR: Record<TimelineKind, string> = {
  moment: 'var(--ac2)',
  order: 'var(--ac)',
  payment: 'var(--green)',
  shipment: 'var(--teal)',
  event: 'var(--magenta)',
  kit: 'var(--yellow)',
  paper: 'var(--dust)',
  enquiry: 'var(--cyan)',
}

const ORDER_KINDS = ['sale', 'consignment', 'loan', 'gift', 'entrusted']
const ORDER_STATUSES = ['draft', 'signed', 'deposit_paid', 'paid', 'delivered', 'out', 'closed', 'handed_over', 'cancelled', 'returned']

const LABEL: React.CSSProperties = { fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)' }

type State = { items: TimelineItem[]; next: TimelineCursor | null; loading: boolean; failed: boolean }

export function PersonTimeline({ contactId, narrow, reloadKey = 0 }: { contactId: number; narrow: boolean; reloadKey?: number }) {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const [kind, setKind] = useState<TimelineKind | null>(null)
  const [counts, setCounts] = useState<Record<TimelineKind, number> | null>(null)
  const [countsFailed, setCountsFailed] = useState(false)
  const [state, setState] = useState<State>({ items: [], next: null, loading: true, failed: false })

  useEffect(() => {
    setKind(null)
    setCounts(null)
    setCountsFailed(false)
    let live = true
    void readPersonTimelineCounts(contactId).then((res) => {
      if (!live) return
      if ('error' in res) setCountsFailed(true)
      else setCounts(res.counts)
    })
    return () => {
      live = false
    }
  }, [contactId, reloadKey])

  const reqId = useRef(0)

  useEffect(() => {
    let live = true
    const my = ++reqId.current
    setState({ items: [], next: null, loading: true, failed: false })
    void readPersonTimeline(contactId, null, kind).then((res) => {
      if (!live || my !== reqId.current) return
      setState('error' in res ? { items: [], next: null, loading: false, failed: true } : { items: res.items, next: res.next, loading: false, failed: false })
    })
    return () => {
      live = false
    }
  }, [contactId, kind, reloadKey])

  const older = useCallback(() => {
    if (!state.next) return
    const cursor = state.next
    const my = reqId.current
    setState((s) => ({ ...s, loading: true }))
    void readPersonTimeline(contactId, cursor, kind).then((res) => {
      if (my !== reqId.current) return
      setState((s) => ('error' in res ? { ...s, loading: false, failed: true } : { items: [...s.items, ...res.items], next: res.next, loading: false, failed: false }))
    })
  }, [contactId, kind, state.next])

  const total = counts ? TIMELINE_KINDS.reduce((n, k) => n + counts[k], 0) : null
  const dayOf = (at: string) => {
    if (at.length === 10) return at
    const d = new Date(at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: narrow ? undefined : 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const keyed = (prefix: string, v: string, list: string[]) => (list.includes(v) ? t(`${prefix}${v}` as DictKey) : v)

  const describe = (it: TimelineItem): { main: string; side: string } => {
    switch (it.kind) {
      case 'moment':
        return { main: [t(`pp_tl_moment_${it.title}` as DictKey), it.detail].filter(Boolean).join(' · '), side: it.status ?? '' }
      case 'order':
        return { main: [keyed('ord_kind_', it.title, ORDER_KINDS), it.detail].filter(Boolean).join(' · '), side: it.status ? keyed('ord_st_', it.status, ORDER_STATUSES) : '' }
      case 'payment':
        return { main: [t('pp_tl_payment_on'), it.detail, it.title].filter(Boolean).join(' · '), side: it.status === 'refunded' ? t('pp_tl_refunded') : '' }
      case 'shipment':
        return { main: [it.title, it.detail].filter(Boolean).join(' · ') || t('pp_tl_kind_shipment'), side: it.status ?? '' }
      case 'event':
        return { main: [it.title, it.detail].filter(Boolean).join(' · '), side: '' }
      case 'kit':
        return {
          main: t('pp_tl_kit_sent'),
          side: it.status === 'revoked' ? t('pp_tl_kit_revoked') : it.status === 'opened' ? t('pp_tl_kit_opened_fmt').replace('{n}', it.detail ?? '0') : t('pp_tl_kit_unopened'),
        }
      case 'paper':
        return { main: it.title, side: it.detail ?? '' }
      case 'enquiry':
        return { main: [it.title, it.detail].filter(Boolean).join(' · ') || t('pp_tl_kind_enquiry'), side: it.status ?? '' }
    }
  }

  const chip = (k: TimelineKind | null, label: string, n: number | null) => {
    const on = kind === k
    return (
      <button
        key={k ?? 'all'}
        type="button"
        aria-pressed={on}
        onClick={() => setKind(k)}
        data-testid={`person-tl-chip-${k ?? 'all'}`}
        disabled={k != null && n === 0}
        style={{
          minHeight: narrow ? 44 : 28,
          padding: '0 10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: `1px solid ${on ? (k ? KIND_COLOUR[k] : 'var(--tx2)') : 'var(--bd)'}`,
          background: on ? 'var(--bg2)' : 'none',
          color: n === 0 && k ? 'var(--tx3)' : 'var(--tx)',
          borderRadius: 2,
          fontSize: 11,
          cursor: n === 0 && k ? 'default' : 'pointer',
        }}
      >
        {k ? <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: KIND_COLOUR[k], opacity: n === 0 ? 0.35 : 1 }} /> : null}
        {label}
        <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{n ?? '…'}</span>
      </button>
    )
  }

  let lastDay = ''
  return (
    <div data-testid="person-timeline" style={{ marginTop: 18, borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
      <div style={{ ...LABEL, marginBottom: 8 }}>{t('pp_tl_title')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {chip(null, t('pp_tl_all'), total)}
        {TIMELINE_KINDS.map((k) => chip(k, t(`pp_tl_kind_${k}` as DictKey), counts ? counts[k] : null))}
      </div>
      {countsFailed ? <div style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 6 }}>{t('pp_list_err')}</div> : null}
      {state.failed && state.items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--rust)' }}>{t('pp_list_err')}</div>
      ) : state.loading && state.items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('pp_loading')}</div>
      ) : state.items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{kind ? t('pp_tl_none_kind') : t('pp_tl_none')}</div>
      ) : (
        state.items.map((it) => {
          const d = dayOf(it.at)
          const divider = d !== lastDay
          lastDay = d
          const { main, side } = describe(it)
          const body = (
            <>
              <span aria-hidden style={{ width: 3, alignSelf: 'stretch', background: KIND_COLOUR[it.kind], borderRadius: 1, flexShrink: 0 }} />
              <span className="t-mono-sm" style={{ width: narrow ? 64 : 84, flexShrink: 0, color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t(`pp_tl_kind_${it.kind}` as DictKey)}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: narrow ? 'normal' : 'nowrap', overflowWrap: 'anywhere' }}>{main || '—'}</span>
              {side ? <span style={{ color: 'var(--tx3)', flexShrink: 0, fontSize: 11 }}>{side}</span> : null}
              {it.amount != null ? <span className="t-mono-sm" style={{ flexShrink: 0 }}>{formatPriceFull(it.amount, lang)}</span> : null}
            </>
          )
          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 44,
            padding: '4px 0',
            borderBottom: '1px solid var(--bd)',
            fontSize: 12,
            color: 'inherit',
            textDecoration: 'none',
            minWidth: 0,
          }
          return (
            <div key={`${it.kind}:${it.id}`}>
              {divider ? (
                <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx2)', padding: '10px 0 4px', borderBottom: '1px solid var(--bd2)' }}>
                  {dayLabel(d)}
                </div>
              ) : null}
              {it.href ? (
                <Link href={it.href} style={rowStyle} data-testid="person-tl-row">
                  {body}
                </Link>
              ) : (
                <div style={rowStyle} data-testid="person-tl-row">
                  {body}
                </div>
              )}
            </div>
          )
        })
      )}
      {state.next ? (
        <button type="button" className="btn ghost sm" onClick={older} disabled={state.loading} style={{ minHeight: 44, marginTop: 8 }} data-testid="person-tl-older">
          {state.loading ? t('pp_loading') : t('pp_tl_older')}
        </button>
      ) : null}
      {state.failed && state.items.length > 0 ? <div style={{ fontSize: 12, color: 'var(--rust)', marginTop: 6 }}>{t('pp_list_err')}</div> : null}
    </div>
  )
}
