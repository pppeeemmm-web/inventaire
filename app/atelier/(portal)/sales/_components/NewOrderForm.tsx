'use client'

// « + Nouvelle commande » (TODO R7 slice 2, docs/design/2026-11-17/R7_Orders.notes.md).
// Kind first, then works, the other party + address, then only that kind's terms. Creates a
// draft: nothing moves until the order is signed (Pem 2026-11-17).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { WorkThumbLabel } from '@/components/atelier/WorkThumbLabel'
import { gateErrorKey } from '@/lib/work-save-error'
import { useUnsavedActionGuard } from '@/hooks/useUnsavedActionGuard'
import { ENTRUSTED_LIVE } from '@/lib/orders/kinds'
import {
  createWorkOrder,
  getWorksForOrder,
  listPartyAddresses,
  searchWorksForOrder,
  type OrderWorkHit,
  type PartyAddress,
  type WorkOrderKind,
} from '@/app/atelier/(portal)/sales/orders-actions'
import { saveContactWithConflictCheck } from '@/app/atelier/(portal)/contacts/actions'
import { VatLine } from '@/app/atelier/(portal)/sales/_components/VatLine'

export type OrderContact = { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Ville?: string | null }

const KINDS: WorkOrderKind[] = ['sale', 'consignment', 'loan', 'gift', ...(ENTRUSTED_LIVE ? ['entrusted' as const] : [])]
const KIND_LABEL: Record<WorkOrderKind, DictKey> = {
  sale: 'ord_kind_sale', consignment: 'ord_kind_consignment', loan: 'ord_kind_loan', gift: 'ord_kind_gift', entrusted: 'ord_kind_entrusted',
}
const PARTY_LABEL: Record<WorkOrderKind, DictKey> = {
  sale: 'ord_new_party_sale', consignment: 'ord_new_party_consignment', loan: 'ord_new_party_loan', gift: 'ord_new_party_gift', entrusted: 'ord_new_party_entrusted',
}
/** Per-line value (Pem 2026-11-17): default = the work's price that day; a gift's is never printed. */
const LINE_VALUE_LABEL: Partial<Record<WorkOrderKind, DictKey>> = {
  consignment: 'ord_line_value_consignment', loan: 'ord_line_value_loan', gift: 'ord_line_value_gift', entrusted: 'ord_line_value_entrusted',
}
const DATED: WorkOrderKind[] = ['consignment', 'loan', 'entrusted']
const PEM = 13

const nameOf = (c: OrderContact) => c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`

/** Server error token → readable text. */
export function orderErrorText(err: string, t: (k: DictKey) => string): string {
  if (err.startsWith('ord_err_busy:')) return `${t('ord_err_busy')} ${err.slice('ord_err_busy:'.length)}`
  if (err.startsWith('ord_err_payment:')) return `${t('ord_err_payment')} ${err.slice('ord_err_payment:'.length)}`
  if (err.startsWith('ord_err_')) return t(err as DictKey)
  const gate = gateErrorKey(err)
  return gate ? t(gate as DictKey) : `${t('error_prefix')} ${err}`
}

/** A form opened from elsewhere (work card, Pipeline, Exhibitions) starts filled in. */
export interface NewOrderInitial {
  kind?: WorkOrderKind
  /** Fixes the kind (the work card « Don… » opens a gift only). */
  lockKind?: boolean
  workIds?: number[]
  partyId?: number
  terms?: Record<string, string>
  notes?: string
  /** Pipeline process or exhibition the order comes from. */
  processId?: string
}

interface Props {
  narrow: boolean
  contacts: OrderContact[]
  onClose: () => void
  onCreated: (id: string, ref: string | null) => void
  initial?: NewOrderInitial
  /** One line under the title (e.g. what a gift order means, from the work card). */
  intro?: string
}

export function NewOrderForm({ narrow, contacts, onClose, onCreated, initial, intro }: Props) {
  const { t } = useI18n()
  const [kind, setKind] = useState<WorkOrderKind | null>(initial?.kind ?? null)
  const [works, setWorks] = useState<OrderWorkHit[]>([])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<OrderWorkHit[]>([])
  const [partyQ, setPartyQ] = useState('')
  const [party, setParty] = useState<OrderContact | null>(
    () => (initial?.partyId && initial.partyId !== PEM ? contacts.find((c) => c.ContactID === initial.partyId) ?? null : null),
  )
  const [addresses, setAddresses] = useState<PartyAddress[]>([])
  const [addressId, setAddressId] = useState('')
  const [terms, setTerms] = useState<Record<string, string>>(initial?.terms ?? {})
  const [lineValues, setLineValues] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState(initial?.notes ?? '')
  /** Sale paid on the spot and taken away (Pem 2026-11-18): « Livrée » follows the full payment. */
  const [takeaway, setTakeaway] = useState(true)
  /** The final price follows price − discount until it is typed by hand. */
  const finalTyped = useRef(!!initial?.terms?.price_final)
  const catalogueTyped = useRef(!!initial?.terms?.price_catalogue)
  /** « + Nouveau contact »: created at once (shared action), then picked as the party. */
  const [newC, setNewC] = useState<Record<string, string> | null>(null)
  const [newCBusy, setNewCBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Dirty = changed from what the form opened with (a prefilled form closes without asking).
  const snap = (k: WorkOrderKind | null, ids: number[], p: number | null, tm: Record<string, string>, n: string) =>
    JSON.stringify([k, [...ids].sort((x, y) => x - y), p, Object.entries(tm).filter(([, v]) => v).sort(), n])
  const [baseline] = useState(() => snap(initial?.kind ?? null, initial?.workIds ?? [], initial?.partyId && initial.partyId !== PEM ? initial.partyId : null, initial?.terms ?? {}, initial?.notes ?? ''))
  // Prices the form worked out by itself are not a change by the person (only typed ones are).
  const typedTerms = Object.fromEntries(Object.entries(terms).filter(([k]) =>
    !(k === 'price_catalogue' && !catalogueTyped.current) && !(k === 'price_final' && !finalTyped.current)))
  const dirty = snap(kind, works.map((w) => w.id), party?.ContactID ?? null, typedTerms, notes) !== baseline
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  // Prefilled party: the Atelier contacts arrive after first paint, so it is picked when they do.
  const partyPicked = useRef(party !== null)
  useEffect(() => {
    if (partyPicked.current || !initial?.partyId || initial.partyId === PEM) return
    const c = contacts.find((x) => x.ContactID === initial.partyId)
    if (c) { partyPicked.current = true; setParty(c) }
  }, [contacts, initial?.partyId])

  // Prefilled works (by number) are looked up once.
  const initialWorkKey = (initial?.workIds ?? []).join(',')
  // Retried: the Atelier shell refreshes after first paint, which can abort a call made at mount.
  useEffect(() => {
    const ids = initialWorkKey ? initialWorkKey.split(',').map(Number) : []
    if (ids.length === 0) return
    let live = true
    const attempt = (left: number) => {
      getWorksForOrder(ids)
        .then((found) => { if (live) setWorks((cur) => (cur.length ? cur : found)) })
        .catch((e: unknown) => {
          if (live && left > 0) setTimeout(() => attempt(left - 1), 800)
          else if (live) setErr(`${t('error_prefix')} ${e instanceof Error ? e.message : String(e)}`)
        })
    }
    attempt(3)
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per prefilled list
  }, [initialWorkKey])

  // Work search (debounced).
  useEffect(() => {
    const term = q.trim()
    if (!term) { setHits([]); return }
    const id = setTimeout(() => { void searchWorksForOrder(term).then(setHits) }, 250)
    return () => clearTimeout(id)
  }, [q])

  // The party's addresses; a single one is picked by itself.
  useEffect(() => {
    setAddresses([]); setAddressId('')
    if (!party) return
    void listPartyAddresses(party.ContactID).then((list) => {
      setAddresses(list)
      if (list.length === 1) setAddressId(String(list[0].id))
    })
  }, [party])

  // Sale prices work themselves out (Pem 2026-11-18: « Calculations in prices not auto »):
  // catalogue = the works' prices added up, final = catalogue − discount; each stops following once typed.
  const worksTotal = works.reduce((sum, w) => sum + (w.price ?? 0), 0)
  useEffect(() => {
    if (kind !== 'sale') return
    setTerms((tm) => {
      const next = { ...tm }
      if (!catalogueTyped.current && worksTotal > 0) next.price_catalogue = String(worksTotal)
      const cat = Number(String(next.price_catalogue ?? '').replace(',', '.'))
      const disc = Number(String(next.discount_pct ?? '').replace(',', '.')) || 0
      if (!finalTyped.current && cat > 0) next.price_final = String(Math.round(cat * (1 - disc / 100) * 100) / 100)
      return next.price_catalogue === tm.price_catalogue && next.price_final === tm.price_final ? tm : next
    })
  }, [kind, worksTotal, terms.price_catalogue, terms.discount_pct])

  async function createContact() {
    if (!newC) return
    if (!newC.prenom?.trim() && !newC.nom?.trim() && !newC.institution?.trim()) { setErr(t('ord_newc_err_name')); return }
    setNewCBusy(true); setErr(null)
    try {
      const fd = new FormData()
      for (const [k, v] of Object.entries(newC)) if (v.trim()) fd.append(k, v)
      const res = await saveContactWithConflictCheck(fd)
      if ('error' in res) { setErr(`${t('error_prefix')} ${res.error}`); return }
      partyPicked.current = true
      setParty({ ContactID: res.id, NomInstitution: newC.institution?.trim() || null, Nom: newC.nom?.trim() || null, Prénom: newC.prenom?.trim() || null, Ville: newC.ville?.trim() || null })
      setNewC(null); setPartyQ('')
    } finally {
      setNewCBusy(false)
    }
  }

  const partyHits = useMemo(() => {
    const term = partyQ.trim().toLowerCase()
    if (!term) return []
    return contacts
      .filter((c) => c.ContactID !== PEM && nameOf(c).toLowerCase().includes(term))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      .slice(0, 8)
  }, [partyQ, contacts])

  async function submit(): Promise<boolean> {
    setErr(null)
    if (!kind) { setErr(t('ord_err_kind')); return false }
    if (works.length === 0) { setErr(t('ord_err_no_work')); return false }
    if (!party) { setErr(t('ord_err_party')); return false }
    if (kind === 'sale' && !(Number(String(terms.price_final ?? '').replace(',', '.')) > 0)) { setErr(t('ord_err_price')); return false }
    if (DATED.includes(kind)) {
      if (!terms.start_date || !terms.end_date) { setErr(t('ord_err_dates')); return false }
      if (terms.end_date < terms.start_date) { setErr(t('ord_err_dates_order')); return false }
    }
    const fd = new FormData()
    fd.append('kind', kind)
    works.forEach((w) => fd.append('oeuvre_ids', String(w.id)))
    fd.append('party_id', String(party.ContactID))
    if (addressId) fd.append('address_id', addressId)
    for (const [k, v] of Object.entries(terms)) if (v) fd.append(k, v)
    if (LINE_VALUE_LABEL[kind]) for (const w of works) { const v = lineValues[w.id]; if (v) fd.append(`line_value_${w.id}`, v) }
    if (notes) fd.append('notes', notes)
    if (initial?.processId) fd.append('process_id', initial.processId)
    if (kind === 'sale' && takeaway) fd.append('takeaway', '1')
    setBusy(true)
    try {
      const res = await createWorkOrder(fd)
      if ('error' in res) { setErr(orderErrorText(res.error, t)); return false }
      onCreated(res.id, res.ref)
      return true
    } finally {
      setBusy(false)
    }
  }

  const { attemptAction: attemptClose, unsavedDialog } = useUnsavedActionGuard({
    isDirty: dirty,
    getIsDirty: () => dirtyRef.current,
    onProceed: onClose,
    performSave: submit,
  })

  const field = (key: string, label: DictKey, type: 'number' | 'date' = 'number', required = false) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', minWidth: 0 }}>
      {required ? `${t(label)} *` : t(label)}
      <input className="input" type={type} required={required} inputMode={type === 'number' ? 'decimal' : undefined} value={terms[key] ?? ''}
        onChange={(e) => {
          if (key === 'price_final') finalTyped.current = e.target.value !== ''
          if (key === 'price_catalogue') catalogueTyped.current = e.target.value !== ''
          setTerms((s) => ({ ...s, [key]: e.target.value }))
        }}
        style={{ minHeight: 44, fontSize: 15, width: '100%', boxSizing: 'border-box' }} />
    </label>
  )

  const sectionLabel = (k: DictKey) => <div className="t-label" style={{ margin: '16px 0 8px' }}>{t(k)}</div>

  const body = (
    <>
      {sectionLabel('ord_new_kind')}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
        {KINDS.filter((k) => !initial?.lockKind || k === initial.kind).map((k) => (
          <button key={k} type="button" onClick={() => { setKind(k); setTerms({}); finalTyped.current = false; catalogueTyped.current = false }} aria-pressed={kind === k} style={{
            minHeight: 52, border: `1px solid ${kind === k ? 'var(--ac)' : 'var(--bd2)'}`, borderRadius: 4,
            background: kind === k ? 'color-mix(in srgb, var(--ac) 10%, transparent)' : 'none',
            color: kind === k ? 'var(--ac)' : 'var(--tx)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t(KIND_LABEL[k])}</button>
        ))}
      </div>

      {kind && (
        <>
          {sectionLabel('ord_new_works')}
          {works.length === 0 && <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 6 }}>{t('ord_new_works_none')}</div>}
          {works.map((w) => (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, fontSize: 13 }}>
                <WorkThumbLabel id={w.id} title={w.title} image={w.image} />
              </span>
              {LINE_VALUE_LABEL[kind] && (
                <input className="input" type="number" inputMode="decimal" aria-label={t(LINE_VALUE_LABEL[kind]!)} title={t(LINE_VALUE_LABEL[kind]!)}
                  placeholder={w.price != null ? String(w.price) : '—'} value={lineValues[w.id] ?? ''}
                  onChange={(e) => setLineValues((m) => ({ ...m, [w.id]: e.target.value }))}
                  style={{ minHeight: 44, width: narrow ? 90 : 110, fontSize: 14, flex: 'none', boxSizing: 'border-box' }} />
              )}
              <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setWorks((l) => l.filter((x) => x.id !== w.id))}>{t('ord_new_remove')}</button>
            </div>
          ))}
          {LINE_VALUE_LABEL[kind] && works.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{`${t(LINE_VALUE_LABEL[kind]!)} — ${t('ord_line_value_hint')}`}</div>
          )}
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ord_new_works_ph')}
            style={{ minHeight: 44, fontSize: 15, width: '100%', boxSizing: 'border-box', marginTop: 6 }} />
          {hits.filter((h) => !works.some((w) => w.id === h.id)).map((h) => (
            <button key={h.id} type="button" onClick={() => { setWorks((l) => [...l, h]); setQ(''); setHits([]) }} style={{
              display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, width: '100%', background: 'none', border: 'none',
              borderBottom: '1px solid var(--bd)', color: 'var(--tx)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13, padding: '0 4px',
            }}>
              <WorkThumbLabel id={h.id} title={h.title} image={h.image} />
              <span style={{ color: 'var(--ac)', fontSize: 12 }}>{t('ord_new_add')}</span>
            </button>
          ))}

          {sectionLabel(PARTY_LABEL[kind])}
          {party ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{nameOf(party)}{party.Ville ? <span style={{ color: 'var(--tx3)', fontSize: 12 }}>{` · ${party.Ville}`}</span> : null}</span>
              <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => { setParty(null); setPartyQ('') }}>{t('ord_new_party_change')}</button>
            </div>
          ) : (
            <>
              <input className="input" value={partyQ} onChange={(e) => setPartyQ(e.target.value)} placeholder={t('ord_new_party_ph')}
                style={{ minHeight: 44, fontSize: 15, width: '100%', boxSizing: 'border-box' }} />
              {partyHits.map((c) => (
                <button key={c.ContactID} type="button" onClick={() => setParty(c)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, width: '100%', background: 'none', border: 'none',
                  borderBottom: '1px solid var(--bd)', color: 'var(--tx)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13, padding: '0 4px',
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{nameOf(c)}</span>
                  {c.Ville && <span style={{ color: 'var(--tx3)', fontSize: 12 }}>{c.Ville}</span>}
                </button>
              ))}
              {newC ? (
                <div data-testid="order-new-contact" style={{ marginTop: 8, padding: 12, border: '1px solid var(--bd2)', borderRadius: 4, display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 8 }}>
                  <div className="t-label" style={{ gridColumn: '1 / -1' }}>{t('ord_newc_title')}</div>
                  {([
                    ['prenom', 'ord_newc_first'], ['nom', 'ord_newc_last'], ['institution', 'ord_newc_inst', true],
                    ['email', 'ord_newc_email'], ['phone', 'ord_newc_phone'], ['adresse', 'ord_newc_street', true],
                    ['code_postal', 'ord_newc_zip'], ['ville', 'ord_newc_city'], ['pays', 'ord_newc_country'],
                  ] as [string, DictKey, boolean?][]).map(([k, label, wide]) => (
                    <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
                      {t(label)}
                      <input className="input" value={newC[k] ?? ''} type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
                        autoComplete="off" onChange={(e) => setNewC((c) => ({ ...(c ?? {}), [k]: e.target.value }))}
                        style={{ minHeight: 44, fontSize: 15, width: '100%', boxSizing: 'border-box' }} />
                    </label>
                  ))}
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexDirection: narrow ? 'column' : 'row' }}>
                    <button type="button" className="btn primary" disabled={newCBusy} onClick={() => { void createContact() }} style={{ minHeight: 44 }}>
                      {newCBusy ? t('ord_newc_saving') : t('ord_newc_save')}
                    </button>
                    <button type="button" className="btn ghost" disabled={newCBusy} onClick={() => setNewC(null)} style={{ minHeight: 44 }}>{t('ord_new_cancel')}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn ghost sm" data-testid="order-new-contact-open" style={{ minHeight: 44, marginTop: 6 }}
                  onClick={() => {
                    // What was typed in the search becomes the name (« Prénom Nom »).
                    const words = partyQ.trim().split(/\s+/).filter(Boolean)
                    setNewC(words.length > 1 ? { prenom: words[0], nom: words.slice(1).join(' ') } : { nom: words[0] ?? '' })
                  }}>
                  {t('ord_newc_open')}
                </button>
              )}
            </>
          )}
          {party && addresses.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', marginTop: 8 }}>
              {t('ord_new_address')}
              <select className="input" value={addressId} onChange={(e) => setAddressId(e.target.value)} style={{ minHeight: 44, fontSize: 15 }}>
                <option value="">{t('ord_new_address_none')}</option>
                {addresses.map((a) => <option key={a.id} value={a.id}>{[a.label, a.ville].filter(Boolean).join(' · ') || `#${a.id}`}</option>)}
              </select>
            </label>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
            {kind === 'sale' && <>
              {field('price_catalogue', 'ord_new_price_catalogue')}
              {field('discount_pct', 'ord_new_discount')}
              {field('price_final', 'ord_new_price_final', 'number', true)}
              {field('deposit_pct', 'ord_new_deposit_pct')}
            </>}
            {kind === 'consignment' && field('commission_pct', 'ord_new_commission')}
            {DATED.includes(kind) && <>
              {field('start_date', 'ord_new_start', 'date', true)}
              {field('end_date', 'ord_new_end', 'date', true)}
            </>}
          </div>
          {kind === 'sale' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 6 }}>{t('ord_price_auto_hint')}</div>
              <VatLine price={Number(String(terms.price_final ?? '').replace(',', '.')) || null} rates={works.map((w) => w.tva_rate)} />
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" checked={takeaway} onChange={(e) => setTakeaway(e.target.checked)} data-testid="order-takeaway"
                  style={{ width: 22, height: 22, marginTop: 2, flex: 'none', accentColor: 'var(--ac)' }} />
                <span style={{ fontSize: 14 }}>
                  {t('ord_takeaway')}
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--tx3)' }}>{t(takeaway ? 'ord_takeaway_on' : 'ord_takeaway_off')}</span>
                </span>
              </label>
            </>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', marginTop: 12 }}>
            {t('ord_new_notes')}
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              style={{ fontSize: 15, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
          </label>
        </>
      )}

      {err && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: 'var(--rust)' }}>{err}</div>}
    </>
  )

  const actions = (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end',
      ...(narrow ? { position: 'sticky' as const, bottom: 0, background: 'var(--bg1)', borderTop: '1px solid var(--bd)', padding: '10px 16px max(10px, env(safe-area-inset-bottom))', margin: '16px -16px 0' } : { marginTop: 20 }),
    }}>
      {!narrow && <span style={{ flex: 1, fontSize: 12, color: 'var(--tx3)' }}>{t('ord_new_draft_hint')}</span>}
      <button type="button" className="btn ghost" disabled={busy} onClick={attemptClose} style={{ minHeight: 44, flex: narrow ? 1 : undefined }}>{t('ord_new_cancel')}</button>
      <button type="button" className="btn primary" disabled={busy || !kind} onClick={() => { void submit() }} style={{ minHeight: 44, flex: narrow ? 2 : undefined }}>
        {busy ? t('ord_creating') : t('ord_new_create')}
      </button>
    </div>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label={t('ord_new_title')} onClick={(e) => { if (e.target === e.currentTarget) attemptClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: narrow ? 'stretch' : 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg1)', border: narrow ? 'none' : '1px solid var(--bd)', boxSizing: 'border-box',
        width: narrow ? '100%' : 'min(720px, calc(100vw - 32px))', maxHeight: narrow ? '100dvh' : 'min(90dvh, 100%)',
        overflowY: 'auto', padding: narrow ? '12px 16px 0' : 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="serif" style={{ fontSize: 24, flex: 1 }}>{t('ord_new_title')}</div>
          <button type="button" onClick={attemptClose} aria-label={t('close')} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 24, minHeight: 44, minWidth: 44 }}>×</button>
        </div>
        {intro && <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 4 }}>{intro}</div>}
        {narrow && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('ord_new_draft_hint')}</div>}
        {body}
        {actions}
      </div>
      {unsavedDialog}
    </div>
  )
}
