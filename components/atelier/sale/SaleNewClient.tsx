'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { statusOf } from '@/lib/data'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'
import { completeMobileSale, type CompleteMobileSaleResult } from '@/app/atelier/sale/new/actions'

export type MobileSaleWork = {
  OeuvreID: number
  Titre: string | null
  Technique: number | null
  Année: string | null
  Prix: number | null
  PrixFinal: number | null
  Discount: number | null
  statusId: number | null
  Catalogué: boolean | null
  NeedsPhotograph: boolean | null
  txtImageNameLink: string | null
}

export type MobileSaleContact = {
  ContactID: number
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Ville?: string | null
  Pays?: string | null
}

export type MobileSaleGroup = {
  id: string
  name: string
  created_at?: string | null
}

export type MobileSaleGroupLink = {
  group_id: string
  oeuvre_id: number
}

export type MobileSaleStatusRow = {
  id: number
  label: string
}

type Props = {
  works: MobileSaleWork[]
  contacts: MobileSaleContact[]
  groups: MobileSaleGroup[]
  groupLinks: MobileSaleGroupLink[]
  statuses: MobileSaleStatusRow[]
  techniques: { TechniqueID: number; Technique: string | null }[]
}

const STEPS = ['sale_mobile_step_work', 'sale_mobile_step_buyer', 'sale_mobile_step_payment', 'sale_mobile_step_review'] as const
const PAYMENT_METHODS = [
  ['Card terminal', 'sale_mobile_method_card'],
  ['Espèces', 'sale_mobile_method_cash'],
  ['Virement bancaire', 'sale_mobile_method_bank'],
  ['Chèque', 'sale_mobile_method_cheque'],
  ['PayPal', 'sale_mobile_method_paypal'],
] as const

function contactLabel(contact: MobileSaleContact): string {
  return contact.NomInstitution || `${contact.Prénom ?? ''} ${contact.Nom ?? ''}`.trim() || `#${contact.ContactID}`
}

function numberInputValue(n: number): string {
  return Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : ''
}

export function SaleNewClient({ works, contacts, groups, groupLinks, statuses, techniques }: Props) {
  const { t, lang } = useI18n()
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [cataloguePrice, setCataloguePrice] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [finalPrice, setFinalPrice] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0][0])
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<CompleteMobileSaleResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const statusLabelMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.id, s.label])) as Record<number, string>,
    [statuses],
  )
  const techniqueMap = useMemo(
    () => Object.fromEntries(techniques.map((tech) => [tech.TechniqueID, tech.Technique ?? ''])) as Record<number, string>,
    [techniques],
  )
  const workMap = useMemo(() => new Map(works.map((work) => [work.OeuvreID, work])), [works])
  const selectedWorks = useMemo(
    () => selectedIds.flatMap((id) => {
      const work = workMap.get(id)
      return work ? [work] : []
    }),
    [selectedIds, workMap],
  )
  const saleableWorks = useMemo(
    () =>
      works.filter((work) => {
        const key = statusOf(work, statusLabelMap)
        return key !== 'sold' && key !== 'gift' && key !== 'artist_archive' && key !== 'private_archive'
      }),
    [works, statusLabelMap],
  )
  const filteredWorks = useMemo(() => {
    const q = search.trim().toLowerCase()
    const pool = saleableWorks.filter((work) => !selectedIds.includes(work.OeuvreID))
    if (!q) return pool.slice(0, 14)
    return pool
      .filter((work) => String(work.OeuvreID).includes(q) || (work.Titre ?? '').toLowerCase().includes(q))
      .slice(0, 14)
  }, [saleableWorks, search, selectedIds])
  const groupMap = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const link of groupLinks) {
      if (!map[link.group_id]) map[link.group_id] = []
      map[link.group_id].push(link.oeuvre_id)
    }
    return map
  }, [groupLinks])
  const selectedBuyer = useMemo(
    () => contacts.find((contact) => String(contact.ContactID) === buyerId) ?? null,
    [buyerId, contacts],
  )
  const selectedTotal = useMemo(
    () => selectedWorks.reduce((sum, work) => sum + Number(work.PrixFinal ?? work.Prix ?? 0), 0),
    [selectedWorks],
  )
  const finalNumber = Number(finalPrice || 0)
  const paidNumber = Number(paymentAmount || 0)
  const remaining = Math.max(0, finalNumber - paidNumber)

  function formatEur(n: number): string {
    return n > 0 ? `€ ${n.toLocaleString(locale)}` : '—'
  }

  function addWork(work: MobileSaleWork) {
    const nextIds = [...selectedIds, work.OeuvreID]
    setSelectedIds(nextIds)
    const nextWorks = nextIds.flatMap((id) => {
      const found = workMap.get(id)
      return found ? [found] : []
    })
    const total = nextWorks.reduce((sum, item) => sum + Number(item.PrixFinal ?? item.Prix ?? 0), 0)
    setCataloguePrice(numberInputValue(total))
    setFinalPrice(numberInputValue(total))
    if (!discountPct) {
      const firstDiscount = nextWorks.find((item) => item.Discount != null)?.Discount
      if (firstDiscount != null) setDiscountPct(String(firstDiscount))
    }
  }

  function removeWork(id: number) {
    const nextIds = selectedIds.filter((selectedId) => selectedId !== id)
    setSelectedIds(nextIds)
    const total = nextIds.reduce((sum, selectedId) => {
      const work = workMap.get(selectedId)
      return sum + Number(work?.PrixFinal ?? work?.Prix ?? 0)
    }, 0)
    setCataloguePrice(numberInputValue(total))
    setFinalPrice(numberInputValue(total))
  }

  function addGroup(groupId: string) {
    const ids = (groupMap[groupId] ?? []).filter((id) => workMap.has(id) && !selectedIds.includes(id))
    if (ids.length === 0) return
    const nextIds = [...selectedIds, ...ids]
    setSelectedIds(nextIds)
    const total = nextIds.reduce((sum, id) => {
      const work = workMap.get(id)
      return sum + Number(work?.PrixFinal ?? work?.Prix ?? 0)
    }, 0)
    setCataloguePrice(numberInputValue(total))
    setFinalPrice(numberInputValue(total))
  }

  function recalcFinal(price: string, discount: string) {
    const p = Number(price)
    const d = Number(discount)
    if (!Number.isFinite(p) || p <= 0) return ''
    if (!Number.isFinite(d) || d <= 0) return numberInputValue(p)
    return numberInputValue(p * (1 - d / 100))
  }

  function canContinue(): boolean {
    if (step === 0) return selectedIds.length > 0
    if (step === 1) return buyerId !== ''
    if (step === 2) return finalNumber > 0 && paidNumber >= 0
    return true
  }

  function nextStep() {
    setError(null)
    if (!canContinue()) {
      setError(t('sale_mobile_validation_step'))
      return
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function submit() {
    setError(null)
    const fd = new FormData()
    selectedIds.forEach((id) => fd.append('oeuvre_ids', String(id)))
    fd.set('buyer_id', buyerId)
    fd.set('prix_catalogue', cataloguePrice)
    fd.set('discount_pct', discountPct)
    fd.set('prix_final', finalPrice)
    fd.set('payment_amount', paymentAmount)
    fd.set('payment_method', paymentMethod)
    fd.set('deposit_pct', finalNumber > 0 && paidNumber > 0 && paidNumber < finalNumber ? String(Math.round((paidNumber / finalNumber) * 100)) : '')
    fd.set('notes', notes)

    startTransition(() => {
      void completeMobileSale(fd).then((response) => {
        setResult(response)
        if ('error' in response) setError(response.error)
      })
    })
  }

  if (result && 'ok' in result) {
    return (
      <main data-testid="mobile-sale-root" style={rootStyle}>
        <div className="panel pad" style={cardStyle}>
          <div className="t-label" style={{ color: 'var(--sage)' }}>{t('sale_mobile_done_kicker')}</div>
          <h1 className="serif" style={titleStyle}>{t('sale_mobile_done_title')}</h1>
          <p style={mutedStyle}>
            {t(result.status === 'completed' ? 'sale_mobile_done_completed' : 'sale_mobile_done_pending')}
          </p>
          <div style={summaryGridStyle}>
            <span>{t('sale_mobile_summary_order')}</span>
            <strong>{result.order.order_ref ?? result.order.id}</strong>
            <span>{t('sale_mobile_summary_paid')}</span>
            <strong>{formatEur(result.totalPaid)}</strong>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            <Link className="btn primary" href="/hub" style={actionButtonStyle}>
              {t('sale_mobile_done_hub')}
            </Link>
            <Link className="btn ghost" href="/atelier/sales" style={actionButtonStyle}>
              {t('sale_mobile_done_sales')}
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main data-testid="mobile-sale-root" style={rootStyle}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <FieldHubBackLink style={{ marginTop: 0, marginBottom: 14 }} />
        <div className="panel pad" style={cardStyle}>
          <div className="t-label">{t('sale_mobile_kicker')}</div>
          <h1 className="serif" style={titleStyle}>{t('sale_mobile_title')}</h1>
          <p style={mutedStyle}>{t('sale_mobile_intro')}</p>

          <div style={stepsStyle} aria-label={t('sale_mobile_steps_aria')}>
            {STEPS.map((key, index) => (
              <button
                key={key}
                type="button"
                onClick={() => setStep(index)}
                style={{
                  ...stepButtonStyle,
                  borderColor: index === step ? 'var(--ac)' : 'var(--bd)',
                  color: index === step ? 'var(--ac)' : 'var(--tx3)',
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <section style={{ display: step === 0 ? 'block' : 'none' }}>
            <StepTitle label={t('sale_mobile_step_work')} />
            {groups.length > 0 ? (
              <select defaultValue="" onChange={(event) => addGroup(event.target.value)} style={inputStyle} data-testid="mobile-sale-group-select">
                <option value="">{t('sale_mobile_group_placeholder')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            ) : null}
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('sale_mobile_work_search')}
              style={{ ...inputStyle, marginTop: 10 }}
              data-testid="mobile-sale-work-search"
            />
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {selectedWorks.map((work) => (
                <SelectedWorkRow key={work.OeuvreID} work={work} onRemove={() => removeWork(work.OeuvreID)} />
              ))}
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {filteredWorks.map((work) => (
                <button key={work.OeuvreID} type="button" className="btn ghost" onClick={() => addWork(work)} style={workButtonStyle}>
                  <WorkMini work={work} technique={work.Technique != null ? techniqueMap[work.Technique] : null} />
                  <span style={{ marginLeft: 'auto', opacity: 0.55 }}>{formatEur(Number(work.PrixFinal ?? work.Prix ?? 0))}</span>
                </button>
              ))}
            </div>
          </section>

          <section style={{ display: step === 1 ? 'block' : 'none' }}>
            <StepTitle label={t('sale_mobile_step_buyer')} />
            <select value={buyerId} onChange={(event) => setBuyerId(event.target.value)} style={inputStyle} data-testid="mobile-sale-buyer">
              <option value="">{t('sale_mobile_buyer_placeholder')}</option>
              {contacts.map((contact) => (
                <option key={contact.ContactID} value={contact.ContactID}>{contactLabel(contact)}</option>
              ))}
            </select>
          </section>

          <section style={{ display: step === 2 ? 'block' : 'none' }}>
            <StepTitle label={t('sale_mobile_step_payment')} />
            <div style={fieldGridStyle}>
              <label style={labelStyle}>{t('sale_mobile_catalogue_price')}</label>
              <input
                value={cataloguePrice}
                onChange={(event) => {
                  setCataloguePrice(event.target.value)
                  setFinalPrice(recalcFinal(event.target.value, discountPct))
                }}
                inputMode="decimal"
                style={inputStyle}
              />
              <label style={labelStyle}>{t('sale_mobile_discount')}</label>
              <input
                value={discountPct}
                onChange={(event) => {
                  setDiscountPct(event.target.value)
                  setFinalPrice(recalcFinal(cataloguePrice, event.target.value))
                }}
                inputMode="decimal"
                style={inputStyle}
              />
              <label style={labelStyle}>{t('sale_mobile_final_price')}</label>
              <input value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} inputMode="decimal" style={inputStyle} data-testid="mobile-sale-final-price" />
              <label style={labelStyle}>{t('sale_mobile_payment_amount')}</label>
              <input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} inputMode="decimal" style={inputStyle} data-testid="mobile-sale-payment-amount" />
              <label style={labelStyle}>{t('sale_mobile_payment_method')}</label>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} style={inputStyle}>
                {PAYMENT_METHODS.map(([value, key]) => (
                  <option key={value} value={value}>{t(key)}</option>
                ))}
              </select>
              <label style={labelStyle}>{t('sale_mobile_notes')}</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </section>

          <section style={{ display: step === 3 ? 'block' : 'none' }}>
            <StepTitle label={t('sale_mobile_step_review')} />
            <div style={summaryGridStyle}>
              <span>{t('sale_mobile_summary_works')}</span>
              <strong>{String(selectedWorks.length)}</strong>
              <span>{t('sale_mobile_summary_buyer')}</span>
              <strong>{selectedBuyer ? contactLabel(selectedBuyer) : '—'}</strong>
              <span>{t('sale_mobile_final_price')}</span>
              <strong>{formatEur(finalNumber)}</strong>
              <span>{t('sale_mobile_summary_paid')}</span>
              <strong>{formatEur(paidNumber)}</strong>
              <span>{t('sale_mobile_summary_remaining')}</span>
              <strong>{formatEur(remaining)}</strong>
            </div>
          </section>

          {error ? <div style={errorStyle}>{error}</div> : null}

          <div style={{ display: 'grid', gridTemplateColumns: step === 0 ? '1fr' : '1fr 1fr', gap: 10, marginTop: 18 }}>
            {step > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setStep((current) => Math.max(0, current - 1))} style={actionButtonStyle}>
                {t('back')}
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn primary" onClick={nextStep} style={actionButtonStyle} data-testid="mobile-sale-next">
                {t('sale_mobile_next')}
              </button>
            ) : (
              <button type="button" className="btn primary" disabled={busy} onClick={submit} style={actionButtonStyle} data-testid="mobile-sale-complete">
                {busy ? t('sale_mobile_completing') : t('sale_mobile_complete')}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function StepTitle({ label }: { label: string }) {
  return <h2 style={{ fontSize: 16, margin: '18px 0 12px' }}>{label}</h2>
}

function WorkMini({ work, technique }: { work: MobileSaleWork; technique: string | null | undefined }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={{ width: 44, height: 44, position: 'relative', flexShrink: 0, overflow: 'hidden', background: 'var(--bg0)' }}>
        {work.txtImageNameLink ? <WorkThumb file={work.txtImageNameLink} size={88} alt="" /> : null}
      </span>
      <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
        <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          #{work.OeuvreID} · {work.Titre || 'S/T'}
        </strong>
        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{technique || work.Année || '—'}</span>
      </span>
    </span>
  )
}

function SelectedWorkRow({ work, onRemove }: { work: MobileSaleWork; onRemove: () => void }) {
  const { t } = useI18n()
  return (
    <div style={{ ...workButtonStyle, borderStyle: 'solid' }}>
      <WorkMini work={work} technique={null} />
      <button type="button" onClick={onRemove} aria-label={t('sale_mobile_remove_work')} className="btn ghost sm" style={{ minHeight: 44, marginLeft: 'auto' }}>
        ×
      </button>
    </div>
  )
}

const rootStyle: React.CSSProperties = {
  minHeight: '100dvh',
  padding: 'max(18px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right, 0px)) max(18px, env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left, 0px))',
  display: 'flex',
  justifyContent: 'center',
  boxSizing: 'border-box',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
}

const titleStyle: React.CSSProperties = {
  margin: '8px 0 8px',
  fontSize: 26,
}

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--tx2)',
  fontSize: 13,
  lineHeight: 1.5,
}

const stepsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 18,
}

const stepButtonStyle: React.CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  border: '1px solid var(--bd)',
  background: 'var(--bg0)',
  color: 'var(--tx3)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '10px 12px',
  background: 'var(--bg0)',
  color: 'var(--tx)',
  border: '1px solid var(--bd)',
  boxSizing: 'border-box',
  font: 'inherit',
}

const workButtonStyle: React.CSSProperties = {
  minHeight: 60,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  textAlign: 'left',
  boxSizing: 'border-box',
  border: '1px solid var(--bd)',
}

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--tx3)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginTop: 6,
}

const actionButtonStyle: React.CSSProperties = {
  minHeight: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '10px 14px',
  marginTop: 12,
  fontSize: 13,
}

const errorStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  border: '1px solid var(--rust)',
  color: 'var(--rust)',
  fontSize: 13,
}
