'use client'

import type { OwnStageId } from '@/lib/work-editor-model'
import type { DictKey, Lang } from '@/lib/i18n/dictionary'
import type React from 'react'
import Link from 'next/link'
import { salePaidFromPayments, type WorkSaleMoney } from '@/lib/sales/work-paid'
import { FIS, WfSwitch } from './drawer-widgets'

export function DrawerContentFinanceSection({
  narrow,
  lang,
  t,
  prix,
  setPrix,
  discount,
  setDiscount,
  tvaRate,
  setTvaRate,
  prixFinalComputed,
  paymentDone,
  setPaymentDone,
  ownStage,
  saleMoney = null,
}: {
  narrow: boolean
  lang: Lang
  t: (k: DictKey) => string
  prix: string
  setPrix: (v: string) => void
  discount: string
  setDiscount: (v: string) => void
  tvaRate: string
  setTvaRate: (v: string) => void
  prixFinalComputed: number
  paymentDone: boolean
  setPaymentDone: (v: boolean) => void
  ownStage: OwnStageId
  /** The work's sale order and the money received on it: says where « Paiement reçu » comes from. */
  saleMoney?: WorkSaleMoney | null
}) {
  const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
  // R3 Objet › Valeur: one compact row (Prix · Remise · TVA · Final HT · Paiement); the part label
  // carries the title. Wraps instead of scrolling; 44 px inputs on the phone.
  const h = narrow ? 44 : 26
  const gift = ownStage === 'gift'
  const inp = { ...FIS, height: h, padding: '0 6px', fontSize: 12 }
  const cell = (label: string, body: React.ReactNode, w: number) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: `1 1 ${w}px`, maxWidth: narrow ? undefined : w + 40 }}>
      <span style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      {body}
    </label>
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'flex-end', minWidth: 0 }}>
      {cell(t('wf_price'), <input className="input" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} style={inp} disabled={gift} />, 80)}
      {cell(t('wf_discount'), <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} style={inp} disabled={gift} />, 64)}
      {cell(
        t('wf_vat'),
        <input className="input" type="number" min={0} max={100} step={0.01} value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} style={inp} disabled={gift} />,
        56,
      )}
      {cell(
        t('wf_final_ht'),
        <span className="t-mono-md" style={{ fontWeight: 700, height: h, display: 'flex', alignItems: 'center' }}>€ {prixFinalComputed.toLocaleString(loc)}</span>,
        80,
      )}
      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
        <WfSwitch label={t('wf_payment_rcvd')} checked={paymentDone} onChange={setPaymentDone} disabled={gift} />
      </div>
      {!gift ? <PaidSource t={t} loc={loc} paymentDone={paymentDone} sale={saleMoney} /> : null}
    </div>
  )
}

/** One line under the switch (TODO 10): « Paiement reçu » follows the sale's payments, or was set by hand. */
function PaidSource({ t, loc, paymentDone, sale }: { t: (k: DictKey) => string; loc: string; paymentDone: boolean; sale: WorkSaleMoney | null }) {
  const line = { flex: '1 1 100%', minWidth: 0, fontSize: 11, lineHeight: 1.4 }
  if (!sale) {
    return paymentDone ? <div data-testid="paid-source" style={{ ...line, color: 'var(--tx3)' }}>{t('paid_src_hand_no_order')}</div> : null
  }
  const byHand = paymentDone !== salePaidFromPayments(sale)
  const amounts = t('paid_src_amounts')
    .replace('{received}', sale.received.toLocaleString(loc))
    .replace('{price}', (sale.price ?? 0).toLocaleString(loc))
  return (
    <div data-testid="paid-source" style={{ ...line, color: byHand ? 'var(--rust)' : 'var(--tx3)' }}>
      {t(byHand ? 'paid_src_hand_vs_order' : 'paid_src_follows')}{' '}
      <Link href={`/atelier/sales?order=${sale.id}`} title={t('paid_src_order_title')} style={{ color: 'inherit', textDecoration: 'underline' }}>
        {sale.ref ?? '—'}
      </Link>
      {' · '}{amounts}
    </div>
  )
}
