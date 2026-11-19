'use client'

// R6 — one event on the desktop (mockup left): header, then sections folded except the first two
// (house rule): Œuvres, À préparer, Commandes, Plan d'accrochage, Infos & notes.

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useEventsSqlLive } from './events-sql-live'
import type { Oeuvre } from '@/lib/types/database'
import type { EventDetail } from '@/app/atelier/(portal)/exhibitions/event-actions'
import {
  EVENT_CHIP, EVENT_KINDS, EVENT_KIND_LABEL, EVENT_STATUSES, EVENT_STATUS_LABEL, ORDER_CHIP, PREP_COLUMNS, PREP_LABEL,
  STUDIO_CONTACT_ID, asEventKind, asEventStatus, orderStepKey, prepColumnsOf, type PrepKey,
} from '@/lib/events/event-model'
import { CalendarExportStrip } from '@/components/atelier/exhibitions/CalendarExportStrip'
import { FloorPlanTool } from '@/components/atelier/exhibitions/FloorPlanTool'
import type { ExhibitionGroupsCtx } from '@/components/atelier/exhibitions/exhibitions-types'
import { BlurField } from './BlurField'
import { EventSteps } from './EventSteps'
import { EventWorksTable } from './EventWorksTable'
import { EventPeople } from './EventPeople'
import { compareContactsByName, pickableContacts } from '@/lib/contacts/contact-display'
import { EVENT_CHIP_BG, ORDER_CHIP_BG, chipStyle, contactName, countText, fmtDay, type EventContact } from './events-shared'
import type { EventHandlers } from './EventsTab'
import { useIsAdmin } from '@/hooks/useIsAdmin'

interface Props {
  event: EventDetail
  contacts: EventContact[]
  contactsById: Map<number, EventContact>
  inventorySelection: Set<number>
  groupsCtx: ExhibitionGroupsCtx
  groupWorkCount: Record<string, number>
  oeuvres: Oeuvre[]
  themes: { id: number; name: string }[]
  tM: Record<number, string>
  h: EventHandlers
}

function Section({ id, title, count, open, onToggle, children, right }: { id: string; title: string; count?: string; open: boolean; onToggle: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <section aria-labelledby={`ev-sec-${id}`} style={{ borderTop: '1px solid var(--bd)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button id={`ev-sec-${id}`} type="button" aria-expanded={open} onClick={onToggle}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'var(--tx)', cursor: 'pointer', padding: '10px 0', minHeight: 40, textAlign: 'left' }}>
          <span aria-hidden style={{ color: 'var(--tx3)', width: 12 }}>{open ? '▾' : '▸'}</span>
          <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{title}</span>
          {count && <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{count}</span>}
        </button>
        {open && right}
      </div>
      {open && <div style={{ paddingBottom: 14 }}>{children}</div>}
    </section>
  )
}

export function EventView({ event, contacts, contactsById, inventorySelection, groupsCtx, groupWorkCount, oeuvres, themes, tM, h }: Props) {
  const { t, lang } = useI18n()
  const isAdmin = useIsAdmin()
  const sqlLive = useEventsSqlLive()
  const kind = asEventKind(event.type)
  const status = asEventStatus(event.statut)
  const [open, setOpen] = useState<Record<string, boolean>>({ works: true, prep: true, orders: false, plan: false, info: false, cols: false, cal: false })
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))
  const prepCols = prepColumnsOf(kind, event.contact_id, event.prep_columns)
  const place = event.contact_id ? contactsById.get(event.contact_id) : undefined
  const stepsDone = event.steps.filter((s) => s.statut === 'fait').length
  const sortedContacts = [...contacts].sort(compareContactsByName(lang))
  const workCount = new Set([...(event.selection?.work_ids ?? []), ...event.orders.flatMap((o) => o.lines.map((l) => l.oeuvre_id))]).size

  return (
    <div data-testid="event-view" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '14px 20px 40px' }}>
      <datalist id="ev-relation-list">
        {(['ev_rel_together', 'ev_rel_lent', 'ev_rel_shown', 'ev_rel_response'] as const).map((k) => <option key={k} value={t(k)} />)}
      </datalist>
      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{ ...chipStyle(EVENT_CHIP_BG[kind]), height: 26, minWidth: 30, fontSize: 13 }}>{EVENT_CHIP[kind]}</span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <BlurField value={event.nom} ariaLabel={t('ev_field_name')} onSave={(v) => h.patchField('nom', v)}
            style={{ fontSize: 18, fontWeight: 500, border: '1px solid transparent', background: 'transparent', padding: '2px 4px' }} />
        </div>
        <div role="radiogroup" aria-label={t('ev_field_status')} style={{ display: 'flex', border: '1px solid var(--bd)' }}>
          {EVENT_STATUSES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => void h.patchField('statut', s)}
              style={{ padding: '6px 10px', minHeight: 32, fontSize: 11, border: 'none', cursor: 'pointer', background: status === s ? 'var(--ac)' : 'transparent', color: status === s ? 'var(--bg0)' : 'var(--tx2)' }}>
              {t(EVENT_STATUS_LABEL[s])}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 10, fontSize: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--tx3)' }}>
          {t('ev_field_kind')}
          <select className="input" value={kind} onChange={(e) => void h.patchField('type', e.target.value)} style={{ minHeight: 36, fontSize: 13 }}>
            {EVENT_KINDS.map((k) => <option key={k} value={k}>{t(EVENT_KIND_LABEL[k])}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--tx3)' }}>
          {t('ev_field_place')}
          <select className="input" value={event.contact_id ?? ''} onChange={(e) => void h.patchField('contact_id', e.target.value ? Number(e.target.value) : null)} style={{ minHeight: 36, fontSize: 13 }}>
            <option value="">{t('ev_field_place_none')}</option>
            <option value={STUDIO_CONTACT_ID}>{t('ev_place_studio')}</option>
            {/* « Privé » contacts are not offered to the team (Pem 2026-11-19); the current value stays. */}
            {pickableContacts(sortedContacts, { isAdmin, keepIds: [event.contact_id] }).filter((c) => c.ContactID !== STUDIO_CONTACT_ID).map((c) => <option key={c.ContactID} value={c.ContactID}>{contactName(c)}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--tx3)' }}>
          {t('ev_field_start')}
          <BlurField type="date" value={event.date_debut} ariaLabel={t('ev_field_start')} onSave={(v) => h.patchField('date_debut', v)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--tx3)' }}>
          {t('ev_field_end')}
          <BlurField type="date" value={event.date_fin} ariaLabel={t('ev_field_end')} onSave={(v) => h.patchField('date_fin', v)} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: 12, color: 'var(--tx2)' }}>
        {place && <span>{[contactName(place), place.Ville].filter(Boolean).join(' · ')}</span>}
        {event.contact_id === STUDIO_CONTACT_ID && <span>{t('ev_place_studio_hint')}</span>}
        {event.from_process && (
          <Link href={`/atelier/pipeline?process=${event.from_process.id}`} style={{ color: 'var(--ac)' }}>
            {t('ev_from_pipeline_fmt').replace('{name}', event.from_process.nom)}
          </Link>
        )}
      </div>

      <EventPeople
        people={event.people} contacts={sortedContacts} contactsById={contactsById}
        onAdd={h.addPerson} onRemove={h.removePerson}
      />

      <div style={{ margin: '8px 0 4px' }}>
        <button type="button" className="btn ghost sm" aria-expanded={open.cal} onClick={() => toggle('cal')} style={{ minHeight: 28, fontSize: 11 }}>
          {t('ev_calendar_export')} {open.cal ? '▾' : '▸'}
        </button>
        {open.cal && <div style={{ marginTop: 6 }}><CalendarExportStrip exhibition={{ ...event, steps: event.steps, created_at: '' }} /></div>}
      </div>

      <Section id="works" title={event.selection ? t('ev_sec_works_sel_fmt').replace('{name}', event.selection.name) : t('ev_sec_works')} count={`(${workCount})`}
        open={open.works} onToggle={() => toggle('works')}
        right={
          <button type="button" className="btn ghost sm" aria-expanded={open.cols} onClick={() => toggle('cols')} style={{ minHeight: 28, fontSize: 11 }}>{t('ev_cols_button')}</button>
        }>
        {open.cols && (
          <PrepColumnsEditor current={prepCols} custom={event.prep_columns != null} onSave={h.setPrepColumns} />
        )}
        <EventWorksTable
          event={event} prepCols={prepCols} contactsById={contactsById} inventorySelection={inventorySelection}
          groups={groupsCtx.groups} groupWorkCount={groupWorkCount}
          onOpenWork={h.openWork} onTick={h.tick} onRelation={h.setRelation}
          onCreateSelection={h.createSelection} onLinkGroup={h.linkGroup} onAddWorks={h.addWorks} onRemoveWork={h.removeWork}
        />
      </Section>

      <Section id="prep" title={t('ev_sec_prep')} count={`${stepsDone} / ${event.steps.length}`} open={open.prep} onToggle={() => toggle('prep')}>
        <EventSteps
          steps={event.steps} kind={kind} narrow={false}
          onToggle={h.toggleStep} onPatch={h.patchStep} onAdd={h.addStep} onDelete={h.deleteStep} onTemplate={h.applyTemplate}
        />
      </Section>

      <Section id="orders" title={t('ev_sec_orders')} count={`(${event.orders.length})`} open={open.orders} onToggle={() => toggle('orders')}>
        {event.orders.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('ev_orders_none')}</div>
        ) : event.orders.map((o) => (
          <Link key={o.id} href={`/atelier/sales?order=${o.id}`}
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg2)', color: 'var(--tx)', textDecoration: 'none', fontSize: 12, minHeight: 40 }}>
            <span style={chipStyle(ORDER_CHIP_BG[o.kind] ?? 'var(--tx3)')}>{ORDER_CHIP[o.kind] ?? '?'}</span>
            <span style={{ width: 96, fontWeight: 500 }}>{o.ref ?? '—'}</span>
            <span style={{ flex: 1, minWidth: 0, color: 'var(--tx2)' }}>
              {[contactName(contactsById.get(o.party_id), o.party_id), countText(t, o.lines.filter((l) => l.line_status !== 'removed').length, 'ev_list_works_fmt', 'ev_list_works_one'), o.end_date ? t('ev_list_back_fmt').replace('{date}', fmtDay(o.end_date, lang)) : null].filter(Boolean).join(' · ')}
            </span>
            <span style={{ color: o.status === 'cancelled' ? 'var(--rust)' : 'var(--tx)' }}>{t(orderStepKey(o.kind, o.status))}</span>
            <span aria-hidden style={{ color: 'var(--tx3)' }}>›</span>
          </Link>
        ))}
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>{t('ev_orders_hint')}</div>
      </Section>

      {kind !== 'edition' && (
        <Section id="plan" title={t('ev_sec_plan')} count={event.layouts ? `(${event.layouts})` : undefined} open={open.plan} onToggle={() => toggle('plan')}>
          {/* The floor plan's canvas mounts only when this section opens (speed). */}
          <div style={{ height: 560, display: 'flex', minHeight: 0, border: '1px solid var(--bd)' }}>
            <FloorPlanTool exhibitionId={event.id} oeuvres={oeuvres} themes={themes} tM={tM} groupsCtx={groupsCtx} />
          </div>
        </Section>
      )}

      <Section id="info" title={t('ev_sec_info')} open={open.info} onToggle={() => toggle('info')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'var(--tx3)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {t('ev_field_place_text')}
            <BlurField value={event.localisation} ariaLabel={t('ev_field_place_text')} onSave={(v) => h.patchField('localisation', v)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {t('ev_field_url')}
            <BlurField type="url" value={event.url} ariaLabel={t('ev_field_url')} onSave={(v) => h.patchField('url', v)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: '1 / -1' }}>
            {t('ev_field_notes')}
            <BlurField multiline value={event.notes} ariaLabel={t('ev_field_notes')} onSave={(v) => h.patchField('notes', v)} />
          </label>
        </div>
        {status === 'termine' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, minHeight: 36 }} title={sqlLive ? undefined : t('ev_sql_waiting_short')}>
            <input type="checkbox" checked={event.on_site} disabled={!sqlLive} onChange={(e) => void h.setOnSite(e.target.checked)} style={{ width: 18, height: 18 }} />
            {t('ev_on_site')}
          </label>
        )}
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn ghost sm" onClick={h.deleteEvent} style={{ color: 'var(--rust)', borderColor: 'var(--rust)', minHeight: 32 }}>{t('ev_delete')}</button>
        </div>
      </Section>
    </div>
  )
}

function PrepColumnsEditor({ current, custom, onSave }: { current: PrepKey[]; custom: boolean; onSave: (cols: PrepKey[] | null) => Promise<string | null> }) {
  const { t } = useI18n()
  const sqlLive = useEventsSqlLive()
  const [err, setErr] = useState<string | null>(null)
  return (
    <div style={{ border: '1px solid var(--bd)', padding: 10, marginBottom: 10, fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {PREP_COLUMNS.map((k) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 32 }}>
            <input type="checkbox" checked={current.includes(k)} disabled={!sqlLive}
              onChange={async (e) => {
                const next = e.target.checked ? [...current, k] : current.filter((x) => x !== k)
                setErr(await onSave(PREP_COLUMNS.filter((c) => next.includes(c))))
              }} />
            {t(PREP_LABEL[k])}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, color: 'var(--tx3)', fontSize: 11 }}>
        <span>{custom ? t('ev_cols_custom') : t('ev_cols_default')}</span>
        {custom && <button type="button" className="btn ghost sm" onClick={async () => setErr(await onSave(null))} style={{ minHeight: 28 }}>{t('ev_cols_reset')}</button>}
        {!sqlLive && <span>{t('ev_sql_waiting_short')}</span>}
      </div>
      {err && <div role="alert" style={{ color: 'var(--rust)', fontSize: 11 }}>{err}</div>}
    </div>
  )
}
