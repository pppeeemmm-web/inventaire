'use client'

// « + Nouvelle commande » (TODO R7 slice 2, docs/design/2026-11-17/R7_Orders.notes.md).
// Kind first, then works, the other party + address, then only that kind's terms. Creates a
// draft: nothing moves until the order is signed (Pem 2026-11-17).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { thumbUrl } from '@/lib/data'
import { gateErrorKey } from '@/lib/work-save-error'
import { useUnsavedActionGuard } from '@/hooks/useUnsavedActionGuard'
import {
  createWorkOrder,
  listPartyAddresses,
  searchWorksForOrder,
  type OrderWorkHit,
  type PartyAddress,
  type WorkOrderKind,
} from '@/app/atelier/(portal)/sales/orders-actions'

export type OrderContact = { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Ville?: string | null }

const KINDS: WorkOrderKind[] = ['sale', 'consignment', 'loan', 'gift']
const KIND_LABEL: Record<WorkOrderKind, DictKey> = {
  sale: 'ord_kind_sale', consignment: 'ord_kind_consignment', loan: 'ord_kind_loan', gift: 'ord_kind_gift',
}
const PARTY_LABEL: Record<WorkOrderKind, DictKey> = {
  sale: 'ord_new_party_sale', consignment: 'ord_new_party_consignment', loan: 'ord_new_party_loan', gift: 'ord_new_party_gift',
}
const PEM = 13

const nameOf = (c: OrderContact) => c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`

/** Server error token → readable text. */
export function orderErrorText(err: string, t: (k: DictKey) => string): string {
  if (err.startsWith('ord_err_busy:')) return `${t('ord_err_busy')} ${err.slice('ord_err_busy:'.length)}`
  if (err.startsWith('ord_err_')) return t(err as DictKey)
  const gate = gateErrorKey(err)
  return gate ? t(gate as DictKey) : `${t('error_prefix')} ${err}`
}

interface Props {
  narrow: boolean
  contacts: OrderContact[]
  onClose: () => void
  onCreated: (id: string) => void
}

export function NewOrderForm({ narrow, contacts, onClose, onCreated }: Props) {
  const { t } = useI18n()
  const [kind, setKind] = useState<WorkOrderKind | null>(null)
  const [works, setWorks] = useState<OrderWorkHit[]>([])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<OrderWorkHit[]>([])
  const [partyQ, setPartyQ] = useState('')
  const [party, setParty] = useState<OrderContact | null>(null)
  const [addresses, setAddresses] = useState<PartyAddress[]>([])
  const [addressId, setAddressId] = useState('')
  const [terms, setTerms] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const dirty = kind !== null || works.length > 0 || party !== null || notes !== '' || Object.values(terms).some(Boolean)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

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
    if (kind === 'consignment' || kind === 'loan') {
      if (!terms.start_date || !terms.end_date) { setErr(t('ord_err_dates')); return false }
      if (terms.end_date < terms.start_date) { setErr(t('ord_err_dates_order')); return false }
    }
    const fd = new FormData()
    fd.append('kind', kind)
    works.forEach((w) => fd.append('oeuvre_ids', String(w.id)))
    fd.append('party_id', String(party.ContactID))
    if (addressId) fd.append('address_id', addressId)
    for (const [k, v] of Object.entries(terms)) if (v) fd.append(k, v)
    if (notes) fd.append('notes', notes)
    setBusy(true)
    try {
      const res = await createWorkOrder(fd)
      if ('error' in res) { setErr(orderErrorText(res.error, t)); return false }
      onCreated(res.id)
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
        onChange={(e) => setTerms((s) => ({ ...s, [key]: e.target.value }))}
        style={{ minHeight: 44, fontSize: 15, width: '100%', boxSizing: 'border-box' }} />
    </label>
  )

  const sectionLabel = (k: DictKey) => <div className="t-label" style={{ margin: '16px 0 8px' }}>{t(k)}</div>

  const body = (
    <>
      {sectionLabel('ord_new_kind')}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
        {KINDS.map((k) => (
          <button key={k} type="button" onClick={() => { setKind(k); setTerms({}) }} aria-pressed={kind === k} style={{
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
              <Thumb file={w.image} />
              <span style={{ fontWeight: 700, color: 'var(--tx2)', fontSize: 13 }}>{`#${w.id}`}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{w.title ?? ''}</span>
              <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setWorks((l) => l.filter((x) => x.id !== w.id))}>{t('ord_new_remove')}</button>
            </div>
          ))}
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ord_new_works_ph')}
            style={{ minHeight: 44, fontSize: 15, width: '100%', boxSizing: 'border-box', marginTop: 6 }} />
          {hits.filter((h) => !works.some((w) => w.id === h.id)).map((h) => (
            <button key={h.id} type="button" onClick={() => { setWorks((l) => [...l, h]); setQ(''); setHits([]) }} style={{
              display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, width: '100%', background: 'none', border: 'none',
              borderBottom: '1px solid var(--bd)', color: 'var(--tx)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13, padding: '0 4px',
            }}>
              <Thumb file={h.image} />
              <span style={{ fontWeight: 700, color: 'var(--tx2)' }}>{`#${h.id}`}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title ?? ''}</span>
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
              {field('price_final', 'ord_new_price_final')}
              {field('deposit_pct', 'ord_new_deposit_pct')}
            </>}
            {kind === 'consignment' && field('commission_pct', 'ord_new_commission')}
            {(kind === 'consignment' || kind === 'loan') && <>
              {field('start_date', 'ord_new_start', 'date', true)}
              {field('end_date', 'ord_new_end', 'date', true)}
            </>}
          </div>

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
        {narrow && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('ord_new_draft_hint')}</div>}
        {body}
        {actions}
      </div>
      {unsavedDialog}
    </div>
  )
}

function Thumb({ file }: { file: string | null }) {
  const src = thumbUrl(file)
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" width={32} height={32} style={{ objectFit: 'cover', borderRadius: 2, flex: 'none' }} />
    : <span style={{ width: 32, height: 32, background: 'var(--bg3)', borderRadius: 2, flex: 'none' }} />
}
