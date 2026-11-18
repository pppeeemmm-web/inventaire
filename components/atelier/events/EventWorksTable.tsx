'use client'

// R6 — « Œuvres »: the event's selection (a work group linked to the event) + the works on its orders,
// where each one is now (from the R7 orders), per-work prep ticks, and « Créer la commande » for the ticked
// rows → the R7 form prefilled (a draft; works move only at the order's steps, in Commandes).

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { WorkLoupeThumb } from '@/components/atelier/WorkThumbLabel'
import { useI18n } from '@/lib/i18n/context'
import { useEventsSqlLive } from './events-sql-live'
import type { DictKey } from '@/lib/i18n/dictionary'
import { searchWorksForOrder, type OrderWorkHit } from '@/app/atelier/(portal)/sales/orders-actions'
import type { EventDetail, EventPrepRow } from '@/app/atelier/(portal)/exhibitions/event-actions'
import {
  ORDER_CHIP, PREP_HINT, PREP_LABEL, STUDIO_CONTACT_ID, asEventKind, orderStepKey, type PrepKey,
} from '@/lib/events/event-model'
import { insuranceOf, whereIs, type Whereabouts } from '@/lib/events/whereabouts'
import { ORDER_CHIP_BG, chipStyle, contactName, fmtDay, fmtMoney, type EventContact } from './events-shared'

type OrderKindFromEvent = 'loan' | 'consignment' | 'entrusted'
const ORDER_KIND_LABEL: Record<OrderKindFromEvent, DictKey> = { loan: 'ord_kind_loan', consignment: 'ord_kind_consignment', entrusted: 'ord_kind_entrusted' }

export function whereLabel(w: Whereabouts, t: (k: DictKey) => string, lang: 'fr' | 'en'): string {
  if (w.at === 'studio') return t(w.shownInPlace ? 'ev_where_shown_in_place' : 'ev_where_studio')
  const ref = w.order.ref ?? ''
  if (w.sold) return `${t('ev_where_sold')} · ${ref}`
  if (w.lineStatus === 'returned' || w.order.status === 'closed') return `${t('ord_st_closed_m')} · ${ref}`
  const step = t(orderStepKey(w.order.kind, w.order.status))
  const date = w.order.status === 'out' && w.order.start_date ? ` ${fmtDay(w.order.start_date, lang)}` : ''
  return `${step}${date} · ${ref}`
}

interface Props {
  event: EventDetail
  prepCols: PrepKey[]
  contactsById: Map<number, EventContact>
  inventorySelection: Set<number>
  groups: { id: string; name: string }[]
  groupWorkCount: Record<string, number>
  onOpenWork: (id: number) => void
  onTick: (oeuvreId: number, key: PrepKey, on: boolean) => void
  onRelation: (oeuvreId: number, relation: string | null) => Promise<string | null>
  onCreateSelection: (ids: number[]) => Promise<string | null>
  onLinkGroup: (groupId: string) => Promise<string | null>
  onAddWorks: (ids: number[]) => Promise<string | null>
  onRemoveWork: (id: number) => Promise<string | null>
}

export function EventWorksTable(p: Props) {
  const { t, lang } = useI18n()
  const sqlLive = useEventsSqlLive()
  const { event } = p
  const kind = asEventKind(event.type)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [orderKind, setOrderKind] = useState<OrderKindFromEvent>(kind === 'edition' ? 'entrusted' : 'loan')
  const [partyId, setPartyId] = useState<number | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<OrderWorkHit[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [linkPick, setLinkPick] = useState('')

  const prepBy = useMemo(() => new Map(event.prep.map((r) => [r.oeuvre_id, r])), [event.prep])
  const workById = useMemo(() => new Map(event.works.map((w) => [w.id, w])), [event.works])
  // Selection order first, then works that are only on an order.
  const rows = useMemo(() => {
    const ids = [...(event.selection?.work_ids ?? [])]
    for (const o of event.orders) for (const l of o.lines) if (!ids.includes(l.oeuvre_id)) ids.push(l.oeuvre_id)
    return ids.filter((id) => workById.has(id))
  }, [event.selection, event.orders, workById])

  // The order's other party: every person of the event, the place first (Q4).
  const parties = useMemo(() => {
    const ids: number[] = []
    if (event.contact_id && event.contact_id !== STUDIO_CONTACT_ID) ids.push(event.contact_id)
    for (const pp of event.people) if (!ids.includes(pp.contact_id) && pp.contact_id !== STUDIO_CONTACT_ID) ids.push(pp.contact_id)
    return ids
  }, [event.contact_id, event.people])
  const party = partyId ?? parties[0] ?? null

  const orderHref = useMemo(() => {
    if (!party || checked.size === 0) return null
    const sp = new URLSearchParams({ new: orderKind, works: [...checked].join(','), party: String(party), process: event.id })
    if (event.date_debut) sp.set('start', event.date_debut)
    if (event.date_fin) sp.set('end', event.date_fin)
    sp.set('notes', event.nom)
    return `/atelier/sales?${sp.toString()}`
  }, [party, checked, orderKind, event.id, event.date_debut, event.date_fin, event.nom])

  async function run(fn: () => Promise<string | null>) {
    setBusy(true)
    const e = await fn()
    setBusy(false)
    setErr(e)
  }

  async function search(text: string) {
    setQ(text)
    if (text.trim().length < 2) { setHits([]); return }
    setHits(await searchWorksForOrder(text.trim()))
  }

  const toggle = (id: number) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const sqlTitle = sqlLive ? undefined : t('ev_sql_waiting_short')

  const tickCell = (id: number, key: PrepKey, row: EventPrepRow | undefined) => {
    const at = row?.[`${key}_at`] ?? null
    // Before the SQL: « Présentation » reads the work's « encadrée » flag (read only).
    const readOnlyOn = !sqlLive && key === 'presentation' && !!workById.get(id)?.framed
    const on = !!at || readOnlyOn
    return (
      <td key={key} style={{ textAlign: 'center', padding: '4px 2px' }}>
        <button
          type="button" aria-pressed={on} disabled={!sqlLive}
          aria-label={`${t(PREP_LABEL[key])} — #${id}`}
          title={at ? `${t(PREP_LABEL[key])} · ${fmtDay(at, lang)}` : sqlTitle ?? t(PREP_HINT[key] ?? PREP_LABEL[key])}
          onClick={() => p.onTick(id, key, !on)}
          style={{
            width: 28, height: 28, borderRadius: 4, cursor: sqlLive ? 'pointer' : 'default',
            border: `1px solid ${on ? '#4caf82' : 'var(--bd)'}`, background: on ? '#4caf8222' : 'transparent',
            color: on ? '#4caf82' : 'var(--tx3)', fontSize: 13, opacity: sqlLive ? 1 : 0.6,
          }}
        >{on ? '✓' : ''}</button>
      </td>
    )
  }

  return (
    <div>
      {/* No selection yet: create one from the Inventory selection, or link a work group (Round 2). */}
      {!event.selection && (
        <div style={{ border: '1px dashed var(--bd)', padding: 12, marginBottom: 10, fontSize: 12, color: 'var(--tx2)' }}>
          <div style={{ marginBottom: 8 }}>{t('ev_sel_none')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn primary sm" disabled={!sqlLive || busy} title={sqlTitle}
              onClick={() => void run(() => p.onCreateSelection([...p.inventorySelection]))} style={{ minHeight: 32 }}>
              {p.inventorySelection.size > 0 ? t('ev_sel_create_from_fmt').replace('{n}', String(p.inventorySelection.size)) : t('ev_sel_create_empty')}
            </button>
            <select className="input" aria-label={t('ev_sel_link')} value={linkPick} disabled={!sqlLive || busy} title={sqlTitle}
              onChange={(e) => setLinkPick(e.target.value)} style={{ minHeight: 32, fontSize: 12, maxWidth: 260 }}>
              <option value="">{t('ev_sel_link')}</option>
              {[...p.groups].sort((a, b) => a.name.localeCompare(b.name, lang)).map((g) => (
                <option key={g.id} value={g.id}>{`${g.name} (${p.groupWorkCount[g.id] ?? 0})`}</option>
              ))}
            </select>
            {linkPick && (
              <button type="button" className="btn sm" disabled={busy} onClick={() => void run(() => p.onLinkGroup(linkPick))} style={{ minHeight: 32 }}>{t('ev_sel_link_do')}</button>
            )}
          </div>
          {!sqlLive && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--tx3)' }}>{t('ev_sql_waiting')}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button type="button" className="btn sm" disabled={!sqlLive || !event.selection} title={sqlTitle}
          onClick={() => setSearchOpen((v) => !v)} style={{ minHeight: 32 }}>{t('ev_works_add')}</button>
        {event.selection && p.inventorySelection.size > 0 && (
          <button type="button" className="btn ghost sm" disabled={busy}
            onClick={() => void run(() => p.onAddWorks([...p.inventorySelection]))} style={{ minHeight: 32 }}>
            {t('ev_works_add_selection_fmt').replace('{n}', String(p.inventorySelection.size))}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('ev_order_for_checked')}</span>
        <select className="input" aria-label={t('ev_order_kind')} value={orderKind} onChange={(e) => setOrderKind(e.target.value as OrderKindFromEvent)} style={{ minHeight: 32, fontSize: 12 }}>
          {(['loan', 'consignment', 'entrusted'] as const).map((k) => <option key={k} value={k}>{t(ORDER_KIND_LABEL[k])}</option>)}
        </select>
        <select className="input" aria-label={t('ev_order_party')} value={party ?? ''} onChange={(e) => setPartyId(Number(e.target.value) || null)} style={{ minHeight: 32, fontSize: 12, maxWidth: 200 }}>
          {parties.length === 0 && <option value="">{t('ev_order_party_none')}</option>}
          {parties.map((id) => <option key={id} value={id}>{contactName(p.contactsById.get(id), id)}</option>)}
        </select>
        {orderHref ? (
          <Link href={orderHref} className="btn primary sm" style={{ minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>
            {t('ev_order_create_fmt').replace('{n}', String(checked.size))}
          </Link>
        ) : (
          <button type="button" className="btn primary sm" disabled title={parties.length === 0 ? t('ev_order_party_none') : t('ev_order_tick_first')} style={{ minHeight: 32 }}>
            {t('ev_order_create_fmt').replace('{n}', String(checked.size))}
          </button>
        )}
      </div>
      {err && <div role="alert" style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 6 }}>{err}</div>}

      {searchOpen && (
        <div style={{ border: '1px solid var(--bd)', padding: 8, marginBottom: 8 }}>
          <input className="input" aria-label={t('ev_works_search')} placeholder={t('ev_works_search')} value={q}
            onChange={(e) => void search(e.target.value)} style={{ width: '100%', minHeight: 32, fontSize: 12 }} />
          {hits.slice(0, 8).map((h) => (
            <button key={h.id} type="button" disabled={busy || rows.includes(h.id)}
              onClick={() => void run(() => p.onAddWorks([h.id]))}
              style={{ display: 'flex', width: '100%', gap: 8, padding: '6px 4px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--bg2)', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer', fontSize: 12 }}>
              <span style={{ color: 'var(--tx3)' }}>{`#${h.id}`}</span><span>{h.title ?? t('ev_untitled')}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)', fontStyle: 'italic' }}>{t('ev_works_none')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg1)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--bd)', color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <th aria-label={t('ev_col_pick')} style={{ width: 28 }} />
                <th style={{ textAlign: 'left', padding: '6px 4px' }}>{t('ev_col_work')}</th>
                <th style={{ textAlign: 'left', padding: '6px 4px' }}>{t('ev_col_where')}</th>
                {p.prepCols.map((k) => <th key={k} title={t(PREP_HINT[k] ?? PREP_LABEL[k])} style={{ padding: '6px 2px', fontWeight: 500 }}>{t(PREP_LABEL[k])}</th>)}
                {kind === 'collaboration' && <th style={{ textAlign: 'left', padding: '6px 4px' }}>{t('ev_col_relation')}</th>}
                <th style={{ textAlign: 'right', padding: '6px 4px' }}>{t('ev_col_insurance')}</th>
                {event.selection && <th aria-label={t('ev_col_remove')} style={{ width: 28 }} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((id) => {
                const w = workById.get(id)!
                const where = whereIs(id, event.orders, event.contact_id)
                const prep = prepBy.get(id)
                const inSelection = event.selection?.work_ids.includes(id) ?? false
                return (
                  <tr key={id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                      <input type="checkbox" aria-label={`#${id}`} checked={checked.has(id)} onChange={() => toggle(id)} style={{ width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: '4px' }}>
                      <button type="button" onClick={() => p.onOpenWork(id)} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--tx)', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                        <WorkLoupeThumb id={id} image={w.image} title={w.title} px={36} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', color: 'var(--tx3)', fontSize: 10 }}>{`#${id}`}{!inSelection && event.selection ? ` · ${t('ev_only_on_order')}` : ''}</span>
                          <span style={{ display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title ?? t('ev_untitled')}</span>
                        </span>
                      </button>
                    </td>
                    <td style={{ padding: '4px', whiteSpace: 'nowrap' }}>
                      {where.at === 'order' ? (
                        <Link href={`/atelier/sales?order=${where.order.id}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--tx)', textDecoration: 'none' }} title={t('ev_open_order')}>
                          <span style={chipStyle(ORDER_CHIP_BG[where.order.kind] ?? 'var(--tx3)')}>{ORDER_CHIP[where.order.kind] ?? '?'}</span>
                          <span>{whereLabel(where, t, lang)}</span>
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--tx2)' }}>{whereLabel(where, t, lang)}</span>
                      )}
                    </td>
                    {p.prepCols.map((k) => tickCell(id, k, prep))}
                    {kind === 'collaboration' && (
                      <td style={{ padding: '4px', minWidth: 140 }}>
                        <RelationInput value={prep?.relation ?? null} disabled={!sqlLive} onSave={(v) => p.onRelation(id, v)} label={`${t('ev_col_relation')} #${id}`} />
                      </td>
                    )}
                    <td style={{ padding: '4px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--tx2)' }}>{fmtMoney(insuranceOf(id, event.orders) ?? (w.price || null), lang)}</td>
                    {event.selection && (
                      <td style={{ textAlign: 'center' }}>
                        {inSelection && (
                          <button type="button" className="btn ghost sm" aria-label={`${t('ev_col_remove')} #${id}`} title={t('ev_col_remove')}
                            onClick={() => { if (confirm(t('ev_sel_remove_confirm'))) void run(() => p.onRemoveWork(id)) }}
                            style={{ minHeight: 28, padding: '0 6px' }}>×</button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RelationInput({ value, disabled, onSave, label }: { value: string | null; disabled: boolean; onSave: (v: string | null) => Promise<string | null>; label: string }) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value ?? '')
  return (
    <input
      list="ev-relation-list" aria-label={label} value={draft} disabled={disabled} placeholder={t('ev_relation_ph')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() !== (value ?? '')) void onSave(draft.trim() || null) }}
      style={{ width: '100%', minHeight: 28, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '2px 6px' }}
    />
  )
}
