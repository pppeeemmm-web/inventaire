'use client'

// R6 — the event list: grouped En cours / À venir / Passés (passés folded), kind filter, one-line strip.

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { EventListItem } from '@/app/atelier/(portal)/exhibitions/event-actions'
import { EVENT_CHIP, EVENT_KINDS, EVENT_KIND_LABEL, asEventKind, asEventStatus, type EventKind } from '@/lib/events/event-model'
import { EVENT_CHIP_BG, chipStyle, contactName, countText, daysUntil, fmtDay, todayIso, type EventContact } from './events-shared'

type Group = 'now' | 'next' | 'past'

export function groupOf(e: EventListItem): Group {
  const st = asEventStatus(e.statut)
  const today = todayIso()
  if (st === 'termine') return 'past'
  if (st === 'en_cours' || e.works_out > 0) return 'now'
  if (e.date_fin && e.date_fin < today && e.works_out === 0) return 'past'
  if (e.date_debut && e.date_debut <= today) return 'now'
  return 'next'
}

interface Props {
  events: EventListItem[]
  contactsById: Map<number, EventContact>
  selectedId: string | null
  narrow: boolean
  onSelect: (id: string) => void
  onCreate: (nom: string, kind: EventKind) => Promise<string | null>
}

export function EventList({ events, contactsById, selectedId, narrow, onSelect, onCreate }: Props) {
  const { t, lang } = useI18n()
  const [filter, setFilter] = useState<EventKind | 'all'>('all')
  const [pastOpen, setPastOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newKind, setNewKind] = useState<EventKind>('exposition')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const shown = useMemo(() => events.filter((e) => filter === 'all' || asEventKind(e.type) === filter), [events, filter])
  const groups = useMemo(() => {
    const g: Record<Group, EventListItem[]> = { now: [], next: [], past: [] }
    for (const e of shown) g[groupOf(e)].push(e)
    g.next.sort((a, b) => (a.date_debut ?? '9999').localeCompare(b.date_debut ?? '9999'))
    return g
  }, [shown])

  // Top strip (notes « Top strip, one line »): works out now and with whom, returns within 14 days, late prep, editions.
  const strip = useMemo(() => {
    const out = events.reduce((n, e) => n + e.works_out, 0)
    const holders = [...new Set(events.flatMap((e) => e.out_party_ids))].map((id) => contactName(contactsById.get(id), id))
    const returns = events.filter((e) => e.next_return && daysUntil(e.next_return) <= 14).length
    const late = events.reduce((n, e) => n + e.steps_late, 0)
    const editions = events.filter((e) => asEventKind(e.type) === 'edition' && groupOf(e) !== 'past').length
    return { out, holders, returns, late, editions }
  }, [events, contactsById])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nom = String(new FormData(e.currentTarget).get('nom') ?? '').trim()
    if (!nom) return
    setCreating(true)
    const err = await onCreate(nom, newKind)
    setCreating(false)
    if (err) { setCreateErr(err); return }
    setCreateErr(null); setNewOpen(false)
  }

  const row = (e: EventListItem) => {
    const kind = asEventKind(e.type)
    const place = e.contact_id ? contactsById.get(e.contact_id) : undefined
    const bits: string[] = []
    if (e.works_total) bits.push(countText(t, e.works_total, 'ev_list_works_fmt', 'ev_list_works_one'))
    if (e.works_out) bits.push(countText(t, e.works_out, 'ev_list_out_fmt', 'ev_list_out_one'))
    if (e.works_sold) bits.push(countText(t, e.works_sold, 'ev_list_sold_fmt', 'ev_list_sold_one'))
    if (e.next_return) bits.push(t('ev_list_back_fmt').replace('{date}', fmtDay(e.next_return, lang)))
    if (e.steps_late) bits.push(t('ev_list_late_fmt').replace('{n}', String(e.steps_late)))
    const active = e.id === selectedId
    return (
      <button
        key={e.id} type="button" onClick={() => onSelect(e.id)}
        style={{
          display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', minHeight: 56,
          background: active ? 'var(--bg2)' : 'transparent', border: 'none', borderBottom: '1px solid var(--bd)',
          borderLeft: `3px solid ${active ? 'var(--ac)' : 'transparent'}`, color: 'var(--tx)', cursor: 'pointer',
        }}
      >
        <span style={chipStyle(EVENT_CHIP_BG[kind])} title={t(EVENT_KIND_LABEL[kind])}>{EVENT_CHIP[kind]}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nom}</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[place ? contactName(place) : null, place?.Ville, e.date_debut ? `${fmtDay(e.date_debut, lang)}${e.date_fin ? ` – ${fmtDay(e.date_fin, lang)}` : ''}` : t('ev_no_dates')].filter(Boolean).join(' · ')}
          </span>
          {bits.length > 0 && <span style={{ display: 'block', fontSize: 11, color: 'var(--tx2)', marginTop: 2 }}>{bits.join(' · ')}</span>}
        </span>
      </button>
    )
  }

  const head = (label: string, n: number, extra?: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 4px', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)' }}>
      <span>{label}</span><span>{n}</span>{extra}
    </div>
  )

  return (
    <div style={{ width: narrow ? '100%' : 300, flexShrink: 0, borderRight: narrow ? 'none' : '1px solid var(--bd)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, flex: 1 }}>{t(narrow ? 'ev_title_short' : 'ev_title')}</h2>
          {!narrow && (
            <button type="button" className="btn sm" onClick={() => setNewOpen((v) => !v)} style={{ minHeight: 32 }}>{t('ev_new')}</button>
          )}
        </div>
        {(strip.out > 0 || strip.returns > 0 || strip.late > 0 || strip.editions > 0) && (
          <div data-testid="events-strip" style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 6, lineHeight: 1.5 }}>
            {[
              strip.out ? `${countText(t, strip.out, 'ev_strip_out_fmt', 'ev_strip_out_one')}${strip.holders.length ? ` (${strip.holders.join(', ')})` : ''}` : null,
              strip.returns ? countText(t, strip.returns, 'ev_strip_returns_fmt', 'ev_strip_returns_one') : null,
              strip.late ? countText(t, strip.late, 'ev_strip_late_fmt', 'ev_strip_late_one') : null,
              strip.editions ? countText(t, strip.editions, 'ev_strip_editions_fmt', 'ev_strip_editions_one') : null,
            ].filter(Boolean).join(' · ')}
          </div>
        )}
        {newOpen && !narrow && (
          <form onSubmit={submit} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div role="radiogroup" aria-label={t('ev_new_kind')} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {EVENT_KINDS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={newKind === k} onClick={() => setNewKind(k)}
                  className={`btn sm${newKind === k ? ' primary' : ' ghost'}`} style={{ minHeight: 32 }}>
                  {t(EVENT_KIND_LABEL[k])}
                </button>
              ))}
            </div>
            <input name="nom" className="input" aria-label={t('ev_new_name')} placeholder={t('ev_new_name')} autoFocus style={{ minHeight: 36, fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className="btn primary sm" disabled={creating} style={{ minHeight: 32 }}>{creating ? '…' : t('ev_new_create')}</button>
              <button type="button" className="btn ghost sm" onClick={() => setNewOpen(false)} style={{ minHeight: 32 }}>{t('cancel')}</button>
            </div>
            {createErr && <div role="alert" style={{ fontSize: 11, color: 'var(--rust)' }}>{createErr}</div>}
          </form>
        )}
        <div role="radiogroup" aria-label={t('ev_filter')} style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {(['all', ...EVENT_KINDS] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)}
              className={`btn sm${filter === k ? ' primary' : ' ghost'}`}
              title={k === 'all' ? undefined : t(EVENT_KIND_LABEL[k])}
              style={{ minHeight: narrow ? 44 : 28, minWidth: narrow ? 44 : 32, fontSize: 11 }}>
              {k === 'all' ? t('ev_filter_all') : EVENT_CHIP[k]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {events.length === 0 && <div style={{ padding: 16, fontSize: 12, color: 'var(--tx3)' }}>{t('ev_list_empty')}</div>}
        {groups.now.length > 0 && <>{head(t('ev_group_now'), groups.now.length)}{groups.now.map(row)}</>}
        {groups.next.length > 0 && <>{head(t('ev_group_next'), groups.next.length)}{groups.next.map(row)}</>}
        {groups.past.length > 0 && (
          <>
            <button type="button" onClick={() => setPastOpen((v) => !v)} aria-expanded={pastOpen}
              style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: 36 }}>
              {head(t('ev_group_past'), groups.past.length, <span aria-hidden>{pastOpen ? '▾' : '▸'}</span>)}
            </button>
            {pastOpen && groups.past.map(row)}
          </>
        )}
        {narrow && <div style={{ padding: 12, fontSize: 11, color: 'var(--tx3)' }}>{t('ev_phone_desktop_hint')}</div>}
      </div>
    </div>
  )
}
