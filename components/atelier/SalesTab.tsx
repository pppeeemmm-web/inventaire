'use client'

// SalesTab — KPI stats + order list + new order modal form.

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useI18n }      from '@/lib/i18n/context'
import { statusOf, yearOf, type StatusKey } from '@/lib/data'
import type { Oeuvre }  from '@/lib/types/database'
import { createSaleOrder, updateOrderStatut, fetchOrders, type SaleOrderRow } from '@/app/atelier/sales/actions'

// ── Types ────────────────────────────────────────────────────

interface Props {
  oeuvres:        Oeuvre[]
  statusLabelMap: Record<number, string>
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  cM:             Record<number, string>
  tM:             Record<number, string>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none',
}

const STATUT_LABELS: Record<string, string> = {
  draft:         'Brouillon',
  confirmed:     'Confirmée',
  deposit_paid:  'Acompte reçu',
  completed:     'Soldée',
  cancelled:     'Annulée',
}

const STATUT_COLORS: Record<string, string> = {
  draft:        'var(--tx3)',
  confirmed:    'var(--ac)',
  deposit_paid: 'var(--cyan)',
  completed:    'var(--sage)',
  cancelled:    'var(--rust)',
}

// ── Component ────────────────────────────────────────────────

export function SalesTab({ oeuvres, statusLabelMap, contacts, cM, tM }: Props) {
  const { t, lang } = useI18n()
  const [orders,    setOrders]    = useState<SaleOrderRow[]>([])
  const [showForm,  setShowForm]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [inspected, setInspected] = useState<SaleOrderRow | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const rows = await fetchOrders()
    setOrders(rows)
    setLoading(false)
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const { soldWorks, consignedCount, totalRevenue, avgPrice, byYear } = useMemo(() => {
    const sold: Oeuvre[] = []
    let consigned = 0
    for (const o of oeuvres) {
      const key: StatusKey = statusOf(o, statusLabelMap)
      if (key === 'sold')      sold.push(o)
      if (key === 'consigned') consigned++
    }
    const rev = sold.reduce((acc, o) => acc + (o.PrixFinal ?? o.Prix ?? 0), 0)
    const avg = sold.length > 0 ? Math.round(rev / sold.length) : 0
    const yearMap: Record<string, { count: number; revenue: number }> = {}
    for (const o of sold) {
      const yr = String(o.DateLivraison ? o.DateLivraison.slice(0, 4) : yearOf(o.Année) ?? '?')
      if (!yearMap[yr]) yearMap[yr] = { count: 0, revenue: 0 }
      yearMap[yr].count++
      yearMap[yr].revenue += (o.PrixFinal ?? o.Prix ?? 0)
    }
    return {
      soldWorks:      sold,
      consignedCount: consigned,
      totalRevenue:   rev,
      avgPrice:       avg,
      byYear:         Object.entries(yearMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8),
    }
  }, [oeuvres, statusLabelMap])

  const maxRevYear = byYear.length > 0 ? Math.max(...byYear.map(([, v]) => v.revenue)) : 0
  const fmt = (n: number) => n === 0 ? '—' : `€ ${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}`

  const availableWorks = useMemo(() =>
    oeuvres.filter((o) => {
      const k = statusOf(o, statusLabelMap)
      return k !== 'sold' && k !== 'gift' && k !== 'destroyed' && k !== 'lost'
    }).sort((a, b) => b.OeuvreID - a.OeuvreID),
    [oeuvres, statusLabelMap],
  )

  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) => (a.NomInstitution || a.Nom || '').localeCompare(b.NomInstitution || b.Nom || '', 'fr')),
    [contacts]
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', borderBottom: '1px solid var(--bd)', flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, color: 'var(--tx2)' }}>
          {orders.length} commande{orders.length !== 1 ? 's' : ''}
        </div>
        <button className="btn primary sm" onClick={() => setShowForm(true)}>
          + Nouvelle commande
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0, marginBottom: 24,
          borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
        }}>
          <KpiCard label={t('sold')}  value={String(soldWorks.length)}  detail="œuvres vendues" />
          <KpiCard label={t('revenue')}    value={fmt(totalRevenue)}          detail="prix final" border />
          <KpiCard label="Prix moyen"      value={fmt(avgPrice)}              detail="par vente" border />
          <KpiCard label={t('consigned')} value={String(consignedCount)}     detail="en galerie" border />
        </div>

        {byYear.length > 0 && (
          <div className="panel pad-md" style={{ marginBottom: 20 }}>
            <div className="t-label" style={{ marginBottom: 12 }}>Revenu par année</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 120 }}>
              {byYear.map(([yr, { count, revenue }]) => {
                const pct = maxRevYear > 0 ? (revenue / maxRevYear) * 100 : 0
                return (
                  <div key={yr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <div style={{ fontSize: 8, color: 'var(--tx3)', textAlign: 'center' }}>{revenue > 0 ? fmt(revenue) : '—'}</div>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${pct}%`, background: revenue > 0 ? 'var(--ac)' : 'var(--bd)', minHeight: revenue > 0 ? 2 : 0 }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--tx3)' }}>{yr}</div>
                    {count > 0 && <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: -2 }}>{count}×</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="panel pad-md">
          <div className="t-label" style={{ marginBottom: 12 }}>Commandes</div>
          {loading ? (
            <div style={{ color: 'var(--tx3)', fontSize: 11 }}>Chargement…</div>
          ) : orders.length === 0 ? (
            <div style={{ color: 'var(--tx3)', fontSize: 11 }}>Aucune commande. Créez la première via "+ Nouvelle commande".</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Réf.</th><th>Œuvre</th><th>Acheteur</th><th>Date</th>
                  <th className="num">Prix final</th><th>Statut</th><th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => {
                  const work  = oeuvres.find((o) => o.OeuvreID === ord.oeuvre_id)
                  const buyer = ord.buyer_id ? (cM[ord.buyer_id] ?? `#${ord.buyer_id}`) : '—'
                  return (
                    <tr key={ord.id} style={{ cursor: 'pointer' }} onClick={() => setInspected(ord)}>
                      <td style={{ color: 'var(--ac)', fontFamily: 'var(--font-mono)' }}>{ord.order_ref ?? '—'}</td>
                      <td style={{ color: 'var(--tx)' }}>{work?.Titre ?? `#${ord.oeuvre_id}`}</td>
                      <td style={{ color: 'var(--tx2)' }}>{buyer}</td>
                      <td style={{ color: 'var(--tx3)' }}>{ord.created_at.slice(0, 10)}</td>
                      <td className="num" style={{ color: 'var(--ac)' }}>{ord.prix_final ? fmt(ord.prix_final) : '—'}</td>
                      <td>
                        <span style={{
                          fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: STATUT_COLORS[ord.statut] ?? 'var(--tx3)',
                          border: `1px solid ${STATUT_COLORS[ord.statut] ?? 'var(--bd)'}`,
                          padding: '1px 6px',
                        }}>
                          {STATUT_LABELS[ord.statut] ?? ord.statut}
                        </span>
                      </td>
                      <td>{ord.pdf_path ? <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↓ PDF</span> : <span style={{ fontSize: 9, color: 'var(--tx3)' }}>—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <OrderFormModal
          oeuvres={availableWorks} contacts={sortedContacts} tM={tM}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); loadOrders() }}
        />
      )}
      {inspected && (
        <OrderDetailPanel
          order={inspected} oeuvres={oeuvres} cM={cM}
          onClose={() => setInspected(null)} onUpdated={loadOrders}
        />
      )}
    </div>
  )
}

// ── Order form modal ─────────────────────────────────────────

function OrderFormModal({ oeuvres, contacts, tM, onClose, onCreated }: {
  oeuvres:   Oeuvre[]
  contacts:  { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  tM:        Record<number, string>
  onClose:   () => void
  onCreated: () => void
}) {
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [oeuvreId,    setOeuvreId]    = useState('')
  const [prixCat,     setPrixCat]     = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [prixFinal,   setPrixFinal]   = useState('')
  const [depositPct,  setDepositPct]  = useState('')

  useEffect(() => {
    const p = parseFloat(prixCat), d = parseFloat(discountPct)
    if (isFinite(p) && isFinite(d)) setPrixFinal(String(Math.round(p * (1 - d / 100))))
    else if (isFinite(p) && !discountPct) setPrixFinal(String(p))
  }, [prixCat, discountPct])

  useEffect(() => {
    if (!oeuvreId) return
    const o = oeuvres.find((w) => String(w.OeuvreID) === oeuvreId)
    if (o) {
      if (o.Prix)     setPrixCat(String(o.Prix))
      if (o.Discount) setDiscountPct(String(o.Discount))
    }
  }, [oeuvreId, oeuvres])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(null)
    const res = await createSaleOrder(new FormData(e.currentTarget))
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onCreated()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 680, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: 'var(--tx)' }}>Nouvelle commande</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <Section label="Œuvre">
            <select name="oeuvre_id" required value={oeuvreId} onChange={(e) => setOeuvreId(e.target.value)} style={inputStyle}>
              <option value="">— Sélectionner une œuvre</option>
              {oeuvres.map((o) => (
                <option key={o.OeuvreID} value={o.OeuvreID}>
                  #{o.OeuvreID} — {o.Titre ?? 'S/T'}{o.Technique ? ` · ${tM[o.Technique] ?? ''}` : ''}{o.Année ? ` · ${String(o.Année).slice(0,4)}` : ''}
                </option>
              ))}
            </select>
          </Section>
          <Section label="Acheteur">
            <select name="buyer_id" style={inputStyle}>
              <option value="">— Sélectionner un contact</option>
              {contacts.map((c) => {
                const label = c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)
                return <option key={c.ContactID} value={c.ContactID}>{label}</option>
              })}
            </select>
          </Section>
          <Section label="Prix">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Prix catalogue (€)</div>
                <input name="prix_catalogue" type="number" value={prixCat} onChange={(e) => setPrixCat(e.target.value)} style={inputStyle} placeholder="0" />
              </div>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Remise (%)</div>
                <input name="discount_pct" type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} style={inputStyle} placeholder="0" min="0" max="100" />
              </div>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Prix final (€)</div>
                <input name="prix_final" type="number" value={prixFinal} onChange={(e) => setPrixFinal(e.target.value)} style={inputStyle} placeholder="0" />
              </div>
            </div>
          </Section>
          <Section label="Conditions de paiement">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Mode de paiement</div>
                <select name="payment_method" style={inputStyle}>
                  <option value="">—</option>
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Espèces">Espèces</option>
                  <option value="Carte bancaire">Carte bancaire</option>
                  <option value="PayPal">PayPal</option>
                </select>
              </div>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Acompte (%)</div>
                <input name="deposit_pct" type="number" value={depositPct} onChange={(e) => setDepositPct(e.target.value)} style={inputStyle} placeholder="30" min="0" max="100" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Acompte dû le</div>
                <input name="deposit_due" type="date" style={inputStyle} />
              </div>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Solde dû le</div>
                <input name="balance_due" type="date" style={inputStyle} />
              </div>
            </div>
          </Section>
          <Section label="Livraison">
            <div style={{ marginBottom: 10 }}>
              <div className="t-label" style={{ marginBottom: 4 }}>Adresse de livraison</div>
              <textarea name="delivery_address" rows={2} onBlur={e => e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Rue, code postal, ville, pays…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Mode d'expédition</div>
                <select name="shipping_method" style={inputStyle}>
                  <option value="">—</option>
                  <option value="Remise en main propre">Remise en main propre</option>
                  <option value="Transporteur art">Transporteur art</option>
                  <option value="Colissimo">Colissimo</option>
                  <option value="DHL">DHL</option>
                  <option value="FedEx">FedEx</option>
                  <option value="UPS">UPS</option>
                </select>
              </div>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Date de livraison estimée</div>
                <input name="delivery_date" type="date" style={inputStyle} />
              </div>
            </div>
          </Section>
          <Section label="Notes">
            <textarea name="notes" rows={3} onBlur={e => e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Conditions particulières, remarques…" />
          </Section>
          {error && <div style={{ color: 'var(--rust)', fontSize: 11, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn ghost sm">Annuler</button>
            <button type="submit" disabled={saving} className="btn primary sm">
              {saving ? 'Création…' : 'Créer la commande + PDF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Order detail panel ───────────────────────────────────────

function OrderDetailPanel({ order, oeuvres, cM, onClose, onUpdated }: {
  order:     SaleOrderRow
  oeuvres:   Oeuvre[]
  cM:        Record<number, string>
  onClose:   () => void
  onUpdated: () => void
}) {
  const work  = oeuvres.find((o) => o.OeuvreID === order.oeuvre_id)
  const buyer = order.buyer_id ? (cM[order.buyer_id] ?? `#${order.buyer_id}`) : '—'
  const fmt   = (n: number | null) => n ? `€ ${Number(n).toLocaleString('fr-FR')}` : '—'

  async function advance() {
    const next: Record<string, [string, ('deposit_paid'|'balance_paid'|'delivered')?]> = {
      draft:        ['confirmed'],
      confirmed:    ['deposit_paid', 'deposit_paid'],
      deposit_paid: ['completed',    'balance_paid'],
      completed:    ['completed'],
    }
    const [statut, field] = next[order.statut] ?? ['completed']
    await updateOrderStatut(order.id, statut, field)
    onUpdated(); onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 480, background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ac)', fontSize: 11 }}>{order.order_ref}</div>
            <div style={{ fontSize: 14, color: 'var(--tx)', marginTop: 2 }}>{work?.Titre ?? `Œuvre #${order.oeuvre_id}`}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 11, marginBottom: 20 }}>
          <span style={{ color: 'var(--tx3)' }}>Acheteur</span>       <span>{buyer}</span>
          <span style={{ color: 'var(--tx3)' }}>Prix catalogue</span>  <span>{fmt(order.prix_catalogue)}</span>
          {order.discount_pct    ? <><span style={{ color: 'var(--tx3)' }}>Remise</span>     <span>{order.discount_pct}%</span></> : null}
          <span style={{ color: 'var(--tx3)' }}>Prix final</span>      <span style={{ color: 'var(--ac)' }}>{fmt(order.prix_final)}</span>
          {order.deposit_pct     ? <><span style={{ color: 'var(--tx3)' }}>Acompte</span>    <span>{order.deposit_pct}% {order.deposit_paid ? '✓' : '—'}</span></> : null}
          {order.balance_due     ? <><span style={{ color: 'var(--tx3)' }}>Solde dû le</span><span>{order.balance_due.slice(0,10)}</span></> : null}
          {order.payment_method  ? <><span style={{ color: 'var(--tx3)' }}>Paiement</span>   <span>{order.payment_method}</span></> : null}
          {order.delivery_date   ? <><span style={{ color: 'var(--tx3)' }}>Livraison</span>  <span>{order.delivery_date.slice(0,10)} {order.delivered ? '✓' : ''}</span></> : null}
          {order.shipping_method ? <><span style={{ color: 'var(--tx3)' }}>Expédition</span> <span>{order.shipping_method}</span></> : null}
          {order.delivery_address? <><span style={{ color: 'var(--tx3)' }}>Adresse</span>    <span style={{ whiteSpace: 'pre-line' }}>{order.delivery_address}</span></> : null}
          {order.notes           ? <><span style={{ color: 'var(--tx3)' }}>Notes</span>      <span>{order.notes}</span></> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: STATUT_COLORS[order.statut] ?? 'var(--tx3)',
            border: `1px solid ${STATUT_COLORS[order.statut] ?? 'var(--bd)'}`,
            padding: '2px 8px',
          }}>
            {STATUT_LABELS[order.statut] ?? order.statut}
          </span>
          {order.statut !== 'completed' && order.statut !== 'cancelled' && (
            <button className="btn ghost sm" onClick={advance} style={{ fontSize: 10 }}>Avancer →</button>
          )}
          {order.pdf_path && <span style={{ fontSize: 10, color: 'var(--cyan)', marginLeft: 'auto' }}>↓ PDF généré</span>}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="t-label" style={{ marginBottom: 8, color: 'var(--tx2)', letterSpacing: '0.08em' }}>{label}</div>
      {children}
    </div>
  )
}

function KpiCard({ label, value, detail, border = false }: { label: string; value: string; detail?: string; border?: boolean }) {
  return (
    <div style={{ padding: '18px 20px', borderLeft: border ? '1px solid var(--bd)' : undefined }}>
      <div className="stat">
        <span className="l">{label}</span>
        <span className="v">{value}</span>
        {detail && <span className="d" style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 4 }}>{detail}</span>}
      </div>
    </div>
  )
}
