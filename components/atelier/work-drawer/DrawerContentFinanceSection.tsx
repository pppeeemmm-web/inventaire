'use client'

import type { OwnStageId } from '@/lib/work-editor-model'
import type { DictKey, Lang } from '@/lib/i18n/dictionary'
import type React from 'react'
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
    </div>
  )
}
