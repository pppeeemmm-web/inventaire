'use client'

import type { OwnStageId } from '@/lib/work-editor-model'
import type { Lang } from '@/lib/i18n/dictionary'
import { FIS, Label, SectionTitle, WfSwitch } from './drawer-widgets'

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
  t: (k: string) => string
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
  return (
    <section>
      <SectionTitle title={t('wf_section_finance')} />
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '80px 1fr 80px 1fr', gap: '8px 10px', fontSize: 12 }}>
        <Label>{t('wf_price')}</Label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--tx3)', fontSize: 11 }}>€</span>
          <input className="input" value={prix} onChange={(e) => setPrix(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
        </div>
        <Label>{t('wf_discount')}</Label>
        <input className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} style={FIS} disabled={ownStage === 'gift'} />
        <Label>{t('wf_vat')}</Label>
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={tvaRate}
          onChange={(e) => setTvaRate(e.target.value)}
          style={FIS}
          disabled={ownStage === 'gift'}
        />
        <Label>{t('wf_final_ht')}</Label>
        <div className="t-mono-md" style={{ fontWeight: 700, paddingTop: 4 }}>
          € {prixFinalComputed.toLocaleString(loc)}
        </div>
        <div style={{ gridColumn: narrow ? '1 / -1' : '1 / -1', marginTop: 4 }}>
          <WfSwitch label={t('wf_payment_rcvd')} checked={paymentDone} onChange={setPaymentDone} disabled={ownStage === 'gift'} />
        </div>
      </div>
    </section>
  )
}
