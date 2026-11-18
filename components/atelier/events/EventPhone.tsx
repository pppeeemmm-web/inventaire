'use client'

// R6 — the phone at the venue (Round 2, Q11): four moments — Arrivée · Accrochage · Salle · Décrochage.
// Works as 64 px rows with 44 px ticks; tapping a work opens its card (condition reports live there);
// one sticky button = the order's next step for the whole group, done in Commandes (R7 gates apply).
// Creating an event or an order stays on the desktop.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { WorkLoupeThumb } from '@/components/atelier/WorkThumbLabel'
import { useI18n } from '@/lib/i18n/context'
import { useEventsSqlLive } from './events-sql-live'
import { yearOf } from '@/lib/data'
import type { EventDetail } from '@/app/atelier/(portal)/exhibitions/event-actions'
import {
  EVENT_CHIP, PHONE_MOMENTS, PHONE_MOMENT_LABEL, PHONE_MOMENT_TICKS, PREP_LABEL,
  STUDIO_CONTACT_ID, asEventKind, nextGroupStep, type PhoneMoment, type PrepKey,
} from '@/lib/events/event-model'
import { whereIs } from '@/lib/events/whereabouts'
import { EVENT_CHIP_BG, chipStyle, contactName, countText, fmtDay, fmtMoney, todayIso, type EventContact } from './events-shared'
import { whereLabel } from './EventWorksTable'
import type { EventHandlers } from './EventsTab'

interface Props {
  event: EventDetail
  contactsById: Map<number, EventContact>
  tM: Record<number, string>
  statusLabelMap: Record<number, string>
  onBack: () => void
  h: EventHandlers
}

function defaultMoment(e: EventDetail): PhoneMoment {
  const today = todayIso()
  if (e.date_fin && today >= e.date_fin) return 'decrochage'
  if (!e.date_debut || today < e.date_debut) return 'arrivee'
  return 'salle'
}

export function EventPhone({ event, contactsById, tM, statusLabelMap, onBack, h }: Props) {
  const { t, lang } = useI18n()
  const sqlLive = useEventsSqlLive()
  const kind = asEventKind(event.type)
  const [moment, setMoment] = useState<PhoneMoment>(() => defaultMoment(event))
  const today = todayIso()

  const prepBy = useMemo(() => new Map(event.prep.map((r) => [r.oeuvre_id, r])), [event.prep])
  const works = useMemo(() => {
    const ids = [...(event.selection?.work_ids ?? [])]
    for (const o of event.orders) for (const l of o.lines) if (!ids.includes(l.oeuvre_id)) ids.push(l.oeuvre_id)
    const byId = new Map(event.works.map((w) => [w.id, w]))
    return ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
  }, [event])

  const ticks = PHONE_MOMENT_TICKS[moment]
  const live = works.filter((w) => { const x = whereIs(w.id, event.orders, event.contact_id); return !(x.at === 'order' && x.sold) })
  const doneCount = (k: PrepKey) => live.filter((w) => !!prepBy.get(w.id)?.[`${k}_at`]).length

  // The group buttons: each open custody order's next step (« Marquer sorties / rentrées — n œuvres »).
  const groupSteps = event.orders.flatMap((o) => {
    const next = nextGroupStep(o.kind, o.status)
    if (!next) return []
    if (moment === 'arrivee' && next !== 'out') return []
    if (moment === 'decrochage' && next !== 'back') return []
    if (moment !== 'arrivee' && moment !== 'decrochage') return []
    const n = o.lines.filter((l) => l.line_status === 'active').length
    return [{ id: o.id, ref: o.ref, label: next === 'out' ? countText(t, n, 'ev_phone_mark_out_fmt', 'ev_phone_mark_out_one') : countText(t, n, 'ev_phone_mark_back_fmt', 'ev_phone_mark_back_one') }]
  })
  const todaySteps = event.steps.filter((s) => s.statut !== 'fait' && s.date_echeance && s.date_echeance <= today)
  // Who holds a sold work now (the venue until delivery), else the buyer.
  const holderName = (holderId: number | null, buyer: number) => {
    const id = holderId && holderId !== STUDIO_CONTACT_ID ? holderId : buyer
    return contactName(contactsById.get(id), id)
  }
  const mainRef = event.orders.find((o) => o.status !== 'cancelled' && o.kind !== 'sale')?.ref

  return (
    <div data-testid="event-phone" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--bd)', position: 'sticky', top: 0, background: 'var(--bg1)', zIndex: 2 }}>
        <button type="button" onClick={onBack} aria-label={t('ev_back')} className="btn ghost sm" style={{ minHeight: 44, minWidth: 44 }}>‹</button>
        <span style={chipStyle(EVENT_CHIP_BG[kind])}>{EVENT_CHIP[kind]}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.nom}</span>
        {mainRef && <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{mainRef}</span>}
      </div>
      <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--tx2)' }}>
        {[event.contact_id ? contactName(contactsById.get(event.contact_id), event.contact_id) : null, event.date_debut ? `${fmtDay(event.date_debut, lang)}${event.date_fin ? ` → ${fmtDay(event.date_fin, lang)}` : ''}` : null].filter(Boolean).join(' · ')}
      </div>
      <div role="tablist" aria-label={t('ev_moments')} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--bd)' }}>
        {PHONE_MOMENTS.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={moment === m} onClick={() => setMoment(m)}
            style={{ minHeight: 44, fontSize: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: moment === m ? 'var(--tx)' : 'var(--tx3)', borderBottom: `2px solid ${moment === m ? 'var(--ac)' : 'transparent'}` }}>
            {t(PHONE_MOMENT_LABEL[m])}
          </button>
        ))}
      </div>
      {ticks.length > 0 && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--tx2)' }}>
          {ticks.map((k) => t('ev_phone_count_fmt').replace('{n}', String(doneCount(k))).replace('{total}', String(live.length)).replace('{what}', t(PREP_LABEL[k]).toLowerCase())).join(' · ')}
          {!sqlLive && <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{t('ev_sql_waiting_short')}</div>}
        </div>
      )}

      <div style={{ flex: 1 }}>
        {works.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--tx3)' }}>{t('ev_works_none')}</div>}
        {works.map((w) => {
          const where = whereIs(w.id, event.orders, event.contact_id)
          const prep = prepBy.get(w.id)
          const soldElsewhere = where.at === 'order' && where.sold
          return (
            <div key={w.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 64, padding: '6px 12px', borderBottom: '1px solid var(--bg2)' }}>
              <button type="button" onClick={() => h.openWork(w.id)} aria-label={t('ev_open_work_fmt').replace('{title}', w.title ?? `#${w.id}`)}
                style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: 0, color: 'var(--tx)', textAlign: 'left', cursor: 'pointer', minHeight: 52 }}>
                <WorkLoupeThumb id={w.id} image={w.image} title={w.title} px={48} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title ?? t('ev_untitled')}</span>
                  {moment === 'salle' ? (
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--tx2)' }}>
                      {[yearOf(w.year), w.technique != null ? tM[w.technique] : null, w.height && w.width ? `${w.height} × ${w.width} cm` : null].filter(Boolean).join(' · ')}
                    </span>
                  ) : (
                    <span style={{ display: 'block', fontSize: 12, color: soldElsewhere ? 'var(--tx3)' : 'var(--tx2)' }}>
                      {`#${w.id} · ${soldElsewhere ? t('ev_phone_sold_stays_fmt').replace('{party}', holderName(w.holderId, where.order.party_id)) : whereLabel(where, t, lang)}`}
                    </span>
                  )}
                </span>
              </button>
              {moment === 'salle' ? (
                <span style={{ textAlign: 'right', fontSize: 12, flexShrink: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500 }}>{soldElsewhere ? '—' : fmtMoney(w.price || null, lang)}</span>
                  <span style={{ display: 'block', color: soldElsewhere ? 'var(--rust)' : 'var(--tx3)' }}>{soldElsewhere ? t('ev_where_sold') : (w.statusId != null ? statusLabelMap[w.statusId] ?? '' : '')}</span>
                </span>
              ) : !soldElsewhere && ticks.map((k) => {
                const at = prep?.[`${k}_at`] ?? null
                return (
                  <button key={k} type="button" aria-pressed={!!at} disabled={!sqlLive}
                    aria-label={`${t(PREP_LABEL[k])} — ${w.title ?? `#${w.id}`}`}
                    onClick={() => h.tick(w.id, k, !at)}
                    style={{
                      width: 52, minHeight: 44, flexShrink: 0, borderRadius: 6, fontSize: 10, lineHeight: 1.2, cursor: 'pointer',
                      border: `1px solid ${at ? '#4caf82' : 'var(--bd)'}`, background: at ? '#4caf8222' : 'transparent', color: at ? '#4caf82' : 'var(--tx2)',
                      opacity: sqlLive ? 1 : 0.6,
                    }}>
                    <span aria-hidden style={{ display: 'block', fontSize: 14 }}>{at ? '✓' : '○'}</span>
                    {t(PREP_LABEL[k])}
                  </button>
                )
              })}
            </div>
          )
        })}

        {moment !== 'salle' && todaySteps.length > 0 && (
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 4 }}>{t('ev_phone_today')}</div>
            {todaySteps.map((s) => (
              <button key={s.id} type="button" onClick={() => h.toggleStep(s.id, true)}
                style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', minHeight: 44, background: 'transparent', border: 'none', borderBottom: '1px solid var(--bg2)', color: 'var(--tx)', textAlign: 'left', fontSize: 13, cursor: 'pointer' }}>
                <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--bd)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{s.nom}</span>
                <span style={{ fontSize: 11, color: s.date_echeance && s.date_echeance < today ? 'var(--rust)' : 'var(--tx3)' }}>{fmtDay(s.date_echeance, lang)}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ height: groupSteps.length ? 80 : 16 }} />
      </div>

      {groupSteps.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, padding: '8px 12px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', background: 'var(--bg1)', borderTop: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groupSteps.map((g) => (
            <Link key={g.id} href={`/atelier/sales?order=${g.id}`} className="btn primary"
              style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14 }}>
              {g.label}{groupSteps.length > 1 && g.ref ? ` · ${g.ref}` : ''}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
