'use client'

// Sales — KPI stats + order list + new order modal form.

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { addCalendarDaysIso } from '@/lib/sale-return-window'
import { useI18n }      from '@/lib/i18n/context'
import { statusOf, yearOf, thumbUrl, type StatusKey } from '@/lib/data'
import type { Oeuvre }  from '@/lib/types/database'
import type { Agg, Dim } from '@/lib/pivot'
import { createSaleOrder, updateOrderStatut, deleteSaleOrder, fetchOrders, regenerateOrderPdf, type SaleOrderRow, type PaymentRow, skipSaleReturnWindow, updateSaleReturnFields } from '@/app/atelier/sales/actions'
import { getSignedUrl } from '@/app/atelier/vault/actions'
import { stringifyError } from '@/lib/error'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import { PivotPanel } from '@/components/atelier/PivotPanel'
import { useMediaQuery } from '@/lib/useMediaQuery'

// ── Types ────────────────────────────────────────────────────

interface Props {
  oeuvres:        Oeuvre[]
  statusLabelMap: Record<number, string>
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  groups:         { id: string; name: string }[]
  cM:             Record<number, string>
  tM:             Record<number, string>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
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

const pulseAnim = `
  @keyframes pulse-red {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.05); }
    100% { opacity: 1; transform: scale(1); }
  }
`

// ── Component ────────────────────────────────────────────────

export function Sales({ oeuvres, statusLabelMap, contacts, groups, cM, tM }: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [orders,    setOrders]    = useState<SaleOrderRow[]>([])
  const [sortKey,   setSortKey]   = useState<string>('date')
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc')
  const toggleSort = (k: string) => {
    if (sortKey === k) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }
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

  useEffect(() => {
    try {
      if (sessionStorage.getItem('pem_sales_open_new_order') !== '1') return
      sessionStorage.removeItem('pem_sales_open_new_order')
      setShowForm(true)
    } catch {
      /* ignore storage availability */
    }
  }, [])

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
      return k !== 'sold' && k !== 'gift' && k !== 'artist_archive' && k !== 'private_archive'
    }).sort((a, b) => b.OeuvreID - a.OeuvreID),
    [oeuvres, statusLabelMap],
  )

  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) => (a.NomInstitution || a.Nom || '').localeCompare(b.NomInstitution || b.Nom || '', 'fr')),
    [contacts]
  )

  const salesPivotDims: Dim<Oeuvre>[] = useMemo(
    () => [
      {
        id: 'year',
        label: t('year'),
        get: (o) =>
          String(o.DateLivraison ? o.DateLivraison.slice(0, 4) : yearOf(o.Année) ?? '—'),
      },
      {
        id: 'buyer',
        label: t('buyer'),
        get: (o) =>
          o.AcheteurID != null ? (cM[o.AcheteurID] ?? `#${o.AcheteurID}`) : '—',
      },
      {
        id: 'technique',
        label: t('technique'),
        get: (o) => (o.Technique != null ? (tM[o.Technique] ?? String(o.Technique)) : '—'),
      },
    ],
    [t, cM, tM],
  )

  const salesPivotValues: Agg<Oeuvre>[] = useMemo(
    () => [
      { id: 'count', label: t('pivotCount'), kind: 'count' },
      {
        id: 'sumRev',
        label: `${t('pivotSum')} (${t('revenue')})`,
        kind: 'sum',
        get: (o) => Number(o.PrixFinal ?? o.Prix ?? 0),
      },
    ],
    [t],
  )

  const sortedOrders = useMemo(() => {
    const list = [...orders]
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'ref')   return (a.order_ref || '').localeCompare(b.order_ref || '') * dir
      if (sortKey === 'date')  return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
      if (sortKey === 'prix')  return ((a.prix_final || 0) - (b.prix_final || 0)) * dir
      if (sortKey === 'statut') return a.statut.localeCompare(b.statut) * dir
      if (sortKey === 'buyer') {
        const ba = a.buyer_id ? (cM[a.buyer_id] || '') : ''
        const bb = b.buyer_id ? (cM[b.buyer_id] || '') : ''
        return ba.localeCompare(bb) * dir
      }
      if (sortKey === 'work') {
        const wa = oeuvres.find(o => o.OeuvreID === a.oeuvre_id)?.Titre || ''
        const wb = oeuvres.find(o => o.OeuvreID === b.oeuvre_id)?.Titre || ''
        return wa.localeCompare(wb) * dir
      }
      return 0
    })
    return list
  }, [orders, sortKey, sortDir, cM, oeuvres])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid var(--bd)', flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, color: 'var(--tx2)' }}>
          {orders.length} commande{orders.length !== 1 ? 's' : ''}
        </div>
        <button className="btn primary sm" onClick={() => setShowForm(true)}>
          + Nouvelle commande
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 24px 20px',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: 0, flexShrink: 0,
          borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
        }}>
          <KpiCard label={t('sold')}  value={String(soldWorks.length)}  detail={t('salesSoldWorksDetail')} />
          <KpiCard label={t('revenue')}    value={fmt(totalRevenue)}          detail={t('salesRevenueDetail')} border />
          <KpiCard label={t('salesAvgPriceLabel')}      value={fmt(avgPrice)}              detail={t('salesAvgPriceDetail')} border />
          <KpiCard label={t('consigned')} value={String(consignedCount)}     detail={t('salesConsignedDetail')} border />
        </div>

        {byYear.length > 0 && (
          <div className="panel pad-sm" style={{ flexShrink: 0 }}>
            <div className="t-label" style={{ marginBottom: 12 }}>{t('salesRevenueByYear')}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 120 }}>
              {byYear.map(([yr, { count, revenue }]) => {
                const pct = maxRevYear > 0 ? (revenue / maxRevYear) * 100 : 0
                return (
                  <div key={yr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center' }}>{revenue > 0 ? fmt(revenue) : '—'}</div>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${pct}%`, background: revenue > 0 ? 'var(--ac)' : 'var(--bd)', minHeight: revenue > 0 ? 2 : 0 }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{yr}</div>
                    {count > 0 && <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: -2 }}>{count}×</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ flexShrink: 0 }}>
          <PivotPanel<Oeuvre>
            rows={soldWorks}
            availableDims={salesPivotDims}
            availableValues={salesPivotValues}
            defaultRowDimId="year"
            defaultColDimId="buyer"
            defaultValueIds={['count', 'sumRev']}
            title={t('pivot')}
            exportFileName="sales-sold-pivot"
          />
        </div>

        <div
          className="panel pad-sm"
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="t-label" style={{ marginBottom: 10, color: 'var(--ac)', flexShrink: 0 }}>{t('orders')}</div>
          {loading ? (
            <div style={{ color: 'var(--tx3)', fontSize: 13, flexShrink: 0 }}>{t('loading')}</div>
          ) : orders.length === 0 ? (
            <div style={{ color: 'var(--tx3)', fontSize: 13, flexShrink: 0 }}>
              {t('salesOrdersEmpty').replace(/\{label\}/g, t('newOrder'))}
            </div>
          ) : (
            <table className="tbl" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('ref')} style={{ width: 100, cursor: 'pointer' }}>Réf. <SortInd k="ref" current={sortKey} dir={sortDir} /></th>
                  <th onClick={() => toggleSort('work')} style={{ width: 220, cursor: 'pointer' }}>Œuvre <SortInd k="work" current={sortKey} dir={sortDir} /></th>
                  <th onClick={() => toggleSort('buyer')} style={{ width: 180, cursor: 'pointer' }}>Acheteur <SortInd k="buyer" current={sortKey} dir={sortDir} /></th>
                  <th onClick={() => toggleSort('date')} style={{ width: 100, cursor: 'pointer' }}>Date <SortInd k="date" current={sortKey} dir={sortDir} /></th>
                  <th onClick={() => toggleSort('prix')} className="num" style={{ width: 120, cursor: 'pointer' }}>Prix final <SortInd k="prix" current={sortKey} dir={sortDir} /></th>
                  <th style={{ width: 150 }}>Règlement (Grains)</th>
                  <th onClick={() => toggleSort('statut')} style={{ width: 120, cursor: 'pointer' }}>Statut <SortInd k="statut" current={sortKey} dir={sortDir} /></th>
                  <th style={{ width: 60 }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((ord) => {
                  const work  = oeuvres.find((o) => o.OeuvreID === ord.oeuvre_id)
                  const buyer = ord.buyer_id ? (cM[ord.buyer_id] ?? `#${ord.buyer_id}`) : '—'
                  return (
                    <tr key={ord.id} style={{ cursor: 'pointer' }} onClick={() => setInspected(ord)}>
                      <td style={{ color: 'var(--ac)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{ord.order_ref ?? '—'}</td>
                      <td style={{ color: 'var(--tx)', fontWeight: 500, fontSize: 13 }}>{work?.Titre ?? `#${ord.oeuvre_id}`}</td>
                      <td style={{ color: 'var(--tx2)', fontSize: 13 }}>{buyer}</td>
                      <td style={{ color: 'var(--tx3)', fontSize: 11 }}>{ord.created_at.slice(0, 10)}</td>
                      <td className="num" style={{ color: 'var(--ac)', fontWeight: 600 }}>{ord.prix_final ? fmt(ord.prix_final) : '—'}</td>
                      <td><PaymentProgress order={ord} /></td>
                      <td>
                        <span style={{
                          fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: STATUT_COLORS[ord.statut] ?? 'var(--tx3)',
                          border: `1px solid ${STATUT_COLORS[ord.statut] ?? 'var(--bd)'}`,
                          padding: '2px 8px',
                          display: 'inline-block'
                        }}>
                          {STATUT_LABELS[ord.statut] ?? ord.statut}
                        </span>
                      </td>
                      <td>
                        {ord.pdf_path ? (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                const res = await getSignedUrl(ord.pdf_path!)
                                if ('url' in res) window.open(res.url, '_blank')
                                else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                              } catch (err) {
                                alert(`${t('error_prefix')} ${stringifyError(err)}`)
                              }
                            }}
                            className="t-mono-sm"
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--cyan)', cursor: 'pointer', opacity: 0.8 }}
                          >
                            PDF
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>—</span>
                        )}
                      </td>
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
          oeuvres={availableWorks} contacts={sortedContacts} groups={groups} tM={tM}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); loadOrders() }}
        />
      )}
      {inspected && (
        <OrderDetailPanel
          order={inspected} oeuvres={oeuvres} cM={cM}
          setInspectedOrder={setInspected}
          onClose={() => setInspected(null)} onUpdated={loadOrders}
        />
      )}
    </div>
  )
}

// ── Order form modal ─────────────────────────────────────────

function OrderFormModal({ oeuvres, contacts, groups, tM, onClose, onCreated }: {
  oeuvres:   Oeuvre[]
  contacts:  { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
  groups:    { id: string; name: string }[]
  tM:        Record<number, string>
  onClose:   () => void
  onCreated: () => void
}) {
  const { t } = useI18n()
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [oeuvreIds,   setOeuvreIds]   = useState<number[]>([])
  const [prixCat,     setPrixCat]     = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [prixFinal,   setPrixFinal]   = useState('')
  const [depositPct,  setDepositPct]  = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  
  const [search,      setSearch]      = useState('')
  const [dirty,       setDirty]       = useState(false)
  const formRef       = useRef<HTMLFormElement>(null)

  async function handleGroupSelect(groupId: string) {
    if (!groupId) return
    setSelectedGroup(groupId)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase.from('working_group_work').select('oeuvre_id').eq('group_id', groupId)
    if (data) {
      const newIds = data.map(x => x.oeuvre_id).filter(id => !oeuvreIds.includes(id))
      setOeuvreIds(prev => [...prev, ...newIds])
      if (newIds.length) setDirty(true)
    }
    setSelectedGroup('') // Reset dropdown
  }

  useEffect(() => {
    const p = parseFloat(prixCat), d = parseFloat(discountPct)
    if (isFinite(p) && isFinite(d)) setPrixFinal(String(Math.round(p * (1 - d / 100))))
    else if (isFinite(p) && !discountPct) setPrixFinal(String(p))
  }, [prixCat, discountPct])

  useEffect(() => {
    if (oeuvreIds.length === 0) return
    const total = oeuvreIds.reduce((sum, id) => {
      const o = oeuvres.find(x => x.OeuvreID === id)
      return sum + (o?.Prix || 0)
    }, 0)
    setPrixCat(String(total))
    
    // Auto-apply discount if the first work has one
    const first = oeuvres.find(x => x.OeuvreID === oeuvreIds[0])
    if (first?.Discount) setDiscountPct(String(first.Discount))
  }, [oeuvreIds, oeuvres])

  async function submitOrder(): Promise<boolean> {
    setSaving(true); setError(null)
    const form = formRef.current
    if (!form) { setSaving(false); return false }
    const fd = new FormData(form)
    fd.delete('oeuvre_id')
    oeuvreIds.forEach(id => fd.append('oeuvre_ids', String(id)))
    const res = await createSaleOrder(fd)
    setSaving(false)
    if ('error' in res) { setError(stringifyError(res.error)); return false }
    onCreated()
    return true
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submitOrder()
  }

  const isDirty = dirty

  const { attemptClose, unsavedDialog } = useUnsavedCloseGuard({
    isDirty,
    onClose,
    performSave: submitOrder,
  })

  return (
    <>
    {unsavedDialog}
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={(e) => { if (e.target === e.currentTarget) attemptClose() }}>
      <div style={{ width: 680, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>Nouvelle commande</div>
          <button type="button" onClick={attemptClose} aria-label={t('close')} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 24, minHeight: 44, minWidth: 44 }}>×</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onChange={() => setDirty(true)}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <Section label="Import depuis Groupe">
                <select 
                  value={selectedGroup} 
                  onChange={e => handleGroupSelect(e.target.value)} 
                  style={{ ...inputStyle, border: '1px solid var(--ac)', color: 'var(--ac)' }}
                >
                  <option value="">— Sélectionner un groupe pour ajouter ses œuvres</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Section>
            </div>
          </div>

          <Section label="Batch de Œuvres">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {oeuvreIds.map(id => {
                const o = oeuvres.find(x => x.OeuvreID === id)
                return (
                  <div key={id} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg2)', padding:'6px 12px', border:'1px solid var(--bd2)', position: 'relative' }}>
                    {o?.txtImageNameLink && (
                      <div style={{ width: 32, height: 32, position: 'relative' }}>
                        <WorkThumb file={o.txtImageNameLink} size={64} alt="" />
                      </div>
                    )}
                    <span style={{ fontSize:12, fontFamily:'var(--font-mono)' }}>#{id}</span>
                    <button type="button" onClick={() => { setDirty(true); setOeuvreIds(prev => prev.filter(x => x !== id)) }} style={{ background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontSize: 16 }}>×</button>
                  </div>
                )
              })}
              {oeuvreIds.length === 0 && <div style={{ fontSize:13, color:'var(--tx3)', fontStyle:'italic' }}>Aucune œuvre sélectionnée</div>}
            </div>

            <div style={{ position: 'relative' }}>
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Rechercher par #ID ou Titre..." 
                style={{ ...inputStyle, marginBottom: 4 }}
              />
              {search && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg1)', border:'1px solid var(--bd)', zIndex:10, maxHeight:200, overflow:'auto', boxShadow:'0 10px 30px rgba(0,0,0,0.5)' }}>
                  {oeuvres
                    .filter(o => !oeuvreIds.includes(o.OeuvreID))
                    .filter(o => String(o.OeuvreID).includes(search) || o.Titre?.toLowerCase().includes(search.toLowerCase()))
                    .slice(0, 10)
                    .map(o => (
                      <div key={o.OeuvreID} onClick={() => { setDirty(true); setOeuvreIds(prev => [...prev, o.OeuvreID]); setSearch('') }}
                        style={{ padding:'10px 16px', fontSize:13, borderBottom:'1px solid var(--bd2)', cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}
                        className="hover-bg"
                      >
                        <div style={{ width:32, height:32, position: 'relative', flexShrink: 0 }}>
                          {o.txtImageNameLink && <WorkThumb file={o.txtImageNameLink} size={64} alt="" />}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600 }}>#{o.OeuvreID} — {o.Titre ?? 'S/T'}</div>
                          <div style={{ opacity:0.6 }}>{o.Technique ? tM[o.Technique] : ''}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
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
                <div className="t-label" style={{ marginBottom: 4 }}>Mode d&apos;expédition</div>
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
          {error && <div style={{ color: 'var(--rust)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={attemptClose} className="btn ghost sm">Annuler</button>
            <button type="submit" disabled={saving} className="btn primary sm">
              {saving ? 'Création…' : 'Créer la commande + PDF'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}

// ── Order detail panel ───────────────────────────────────────

function OrderDetailPanel({ order, oeuvres, cM, setInspectedOrder, onClose, onUpdated }: {
  order:     SaleOrderRow
  oeuvres:   Oeuvre[]
  cM:        Record<number, string>
  setInspectedOrder: (o: SaleOrderRow) => void
  onClose:   () => void
  onUpdated: () => void
}) {
  const { t, lang } = useI18n()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [amt, setAmt] = useState('')
  const [meth, setMeth] = useState('Virement')
  const [retDays, setRetDays] = useState(String(order.return_window_days ?? 14))
  const [retStart, setRetStart] = useState(
    order.return_window_starts_at && order.return_window_starts_at.length >= 10
      ? order.return_window_starts_at.slice(0, 10)
      : '',
  )

  useEffect(() => {
    setRetDays(String(order.return_window_days ?? 14))
    setRetStart(
      order.return_window_starts_at && order.return_window_starts_at.length >= 10
        ? order.return_window_starts_at.slice(0, 10)
        : '',
    )
  }, [order.id, order.return_window_days, order.return_window_starts_at])

  const returnCountdown = useMemo(() => {
    if (order.statut !== 'completed') return null
    const daysTotal = Number(order.return_window_days ?? 14)
    if (order.return_window_skipped) return t('sales_return_skipped_hint')
    if (daysTotal <= 0) return t('sales_return_days_zero_hint')
    if (!order.return_window_starts_at) return t('sales_return_no_start_hint')
    const today = new Date().toISOString().slice(0, 10)
    const expiresOn = addCalendarDaysIso(order.return_window_starts_at.slice(0, 10), daysTotal)
    const ms = new Date(`${expiresOn}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()
    const daysLeft = Math.max(0, Math.ceil(ms / 86400000))
    return t('sales_return_countdown_fmt')
      .replace(/\{days\}/g, String(daysLeft))
      .replace(/\{expires\}/g, expiresOn)
  }, [order, t])

  async function syncInspectedFromServer() {
    const rows = await fetchOrders()
    const row = rows.find((r) => r.id === order.id)
    if (row) setInspectedOrder(row)
    onUpdated()
  }

  useEffect(() => {
    async function load() {
      const { fetchPayments } = await import('@/app/atelier/sales/actions')
      const rows = await fetchPayments(order.id)
      setPayments(rows)
      setLoading(false)
    }
    void load()
  }, [order.id])

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0)
  const remaining = (order.prix_final || 0) - totalPaid

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!amt || isNaN(Number(amt))) return
    setAdding(true)
    const { addPayment } = await import('@/app/atelier/sales/actions')
    const res = await addPayment(order.id, Number(amt), meth)
    if ('ok' in res) {
      const { fetchPayments } = await import('@/app/atelier/sales/actions')
      setPayments(await fetchPayments(order.id))
      setAmt('')
    }
    setAdding(false)
  }

  const work  = oeuvres.find((o) => o.OeuvreID === order.oeuvre_id)
  const buyer = order.buyer_id ? (cM[order.buyer_id] ?? `#${order.buyer_id}`) : '—'
  const fmt   = (n: number | null) =>
    n ? `€ ${Number(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}` : '—'

  async function advance() {
    const next: Record<string, [string, ('deposit_paid'|'balance_paid'|'delivered')?]> = {
      draft:        ['confirmed'],
      confirmed:    ['deposit_paid', 'deposit_paid'],
      deposit_paid: ['completed',    'balance_paid'],
      completed:    ['completed'],
    }
    const [statut, field] = next[order.statut] ?? ['completed']
    await updateOrderStatut(order.id, statut, field)
    await syncInspectedFromServer()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 540, background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ac)', fontSize: 13 }}>{order.order_ref}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)', marginTop: 4 }}>{work?.Titre ?? `Œuvre #${order.oeuvre_id}`}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 24, minHeight: 44, minWidth: 44 }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 13, marginBottom: 24 }}>
          <span style={{ color: 'var(--tx3)' }}>Acheteur</span>       <span>{buyer}</span>
          <span style={{ color: 'var(--tx3)' }}>Prix catalogue</span>  <span>{fmt(order.prix_catalogue)}</span>
          {order.discount_pct    ? <><span style={{ color: 'var(--tx3)' }}>Remise</span>     <span>{order.discount_pct}%</span></> : null}
          <span style={{ color: 'var(--tx3)' }}>Prix final</span>      <span style={{ color: 'var(--ac)' }}>{fmt(order.prix_final)}</span>
          {order.consignment_order_id && order.commission_amount ? (
            <>
              <span style={{ color: 'var(--tx3)' }}>Commission galerie</span>
              <span style={{ color: 'var(--rust)' }}>– {fmt(order.commission_amount)}</span>
              <span style={{ color: 'var(--tx3)' }}>Net artiste</span>
              <span style={{ color: 'var(--sage)', fontWeight: 600 }}>{fmt((order.prix_final ?? 0) - (order.commission_amount ?? 0))}</span>
            </>
          ) : null}

          <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--bd)', margin: '8px 0' }} />
          
          <span style={{ color: 'var(--tx3)' }}>Total Réglé</span>    <span style={{ color: 'var(--sage)', fontWeight: 600 }}>{fmt(totalPaid)}</span>
          <span style={{ color: 'var(--tx3)' }}>Reste à payer</span>   <span style={{ color: remaining > 0 ? 'var(--rust)' : 'var(--tx3)' }}>{fmt(remaining)}</span>
          
          <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--bd)', margin: '8px 0' }} />

          {order.notes           ? <><span style={{ color: 'var(--tx3)' }}>Notes</span>      <span style={{ opacity: 0.8 }}>{order.notes}</span></> : null}
        </div>

        {/* --- Payment History (Grains) --- */}
        <div style={{ marginBottom: 24 }}>
          <div className="t-label" style={{ marginBottom: 12, color: 'var(--tx2)' }}>Historique des règlements (Grains)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {loading ? <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Chargement...</div> :
             payments.length === 0 ? <div style={{ fontSize: 12, color: 'var(--tx3)', fontStyle: 'italic' }}>Aucun versement enregistré.</div> :
             payments.map(p => (
               <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', padding: '6px 12px', fontSize: 12, border: '1px solid var(--bd2)' }}>
                 <div>
                   <span style={{ color: 'var(--tx2)', fontWeight: 600 }}>{fmt(p.amount)}</span>
                   <span style={{ color: 'var(--tx3)', marginLeft: 8 }}>via {p.method}</span>
                 </div>
                 <div style={{ color: 'var(--tx3)', fontSize: 11 }}>{p.payment_date}</div>
               </div>
             ))
            }
          </div>

          <form onSubmit={handleAddPayment} style={{ display: 'flex', gap: 8, background: 'var(--bg0)', padding: 12, border: '1px dashed var(--bd)' }}>
            <input 
              type="number" 
              placeholder="Montant (€)" 
              value={amt} 
              onChange={e => setAmt(e.target.value)}
              style={{ ...inputStyle, width: 100 }}
            />
            <select value={meth} onChange={e => setMeth(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="Virement">Virement</option>
              <option value="Chèque">Chèque</option>
              <option value="Espèces">Espèces</option>
              <option value="Family">Family / Geste</option>
            </select>
            <button type="submit" disabled={adding} className="btn primary sm" style={{ padding: '6px 12px' }}>
              + Ajouter
            </button>
          </form>
        </div>

        {order.statut === 'completed' && (
          <div style={{ marginBottom: 24, padding: 14, border: '1px solid var(--bd2)', borderRadius: 8, background: 'var(--bg0)' }}>
            <div className="t-label" style={{ marginBottom: 10, color: 'var(--tx2)' }}>{t('sales_return_section_title')}</div>
            {returnCountdown && (
              <div style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 12 }}>{returnCountdown}</div>
            )}
            {!order.delivered && (
              <button
                type="button"
                className="btn ghost sm"
                style={{ marginBottom: 12, minHeight: 44 }}
                onClick={async () => {
                  if (!confirm(t('sales_mark_delivered_confirm'))) return
                  const res = await updateOrderStatut(order.id, order.statut, 'delivered')
                  if ('ok' in res) await syncInspectedFromServer()
                  else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                }}
              >
                {t('sales_mark_delivered_btn')}
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>{t('sales_return_days_label')}</div>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={retDays}
                  onChange={(e) => setRetDays(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>{t('sales_return_start_label')}</div>
                <input type="date" value={retStart} onChange={(e) => setRetStart(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className="btn primary sm"
                style={{ minHeight: 44 }}
                onClick={async () => {
                  const d = Number(retDays)
                  if (!Number.isFinite(d) || d < 0) return
                  const res = await updateSaleReturnFields(order.id, {
                    return_window_days: d,
                    return_window_starts_at: retStart ? retStart : null,
                  })
                  if ('ok' in res) await syncInspectedFromServer()
                  else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                }}
              >
                {t('sales_return_save_btn')}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44 }}
                onClick={async () => {
                  if (!confirm(t('sales_return_skip_confirm'))) return
                  const res = await skipSaleReturnWindow(order.id)
                  if ('ok' in res) await syncInspectedFromServer()
                  else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                }}
              >
                {t('sales_return_skip_btn')}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: STATUT_COLORS[order.statut] ?? 'var(--tx3)',
            border: `1px solid ${STATUT_COLORS[order.statut] ?? 'var(--bd)'}`,
            padding: '3px 10px',
          }}>
            {STATUT_LABELS[order.statut] ?? order.statut}
          </span>
          {order.statut !== 'completed' && order.statut !== 'cancelled' && (
            <button className="btn ghost sm" onClick={advance} style={{ fontSize: 12 }}>Avancer →</button>
          )}
          {order.pdf_path && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button 
                onClick={async () => {
                  if (!confirm(t('sales_confirm_delete_order'))) return
                  const res = await deleteSaleOrder(order.id)
                  if ('ok' in res) {
                    onUpdated()
                    onClose()
                  } else {
                    alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                  }
                }}
                className="btn ghost sm"
                style={{ fontSize: 11, color: 'var(--rust)', marginRight: 10 }}
              >
                Supprimer
              </button>
              <button 
                onClick={async (e) => {
                  if (!confirm(t('sales_confirm_regenerate_pdf'))) return
                  const btn = (e.currentTarget as HTMLButtonElement)
                  const oldText = btn.innerText
                  btn.innerText = 'BUSY...'
                  btn.disabled = true
                  try {
                    const res = await regenerateOrderPdf(order.id)
                    if ('ok' in res && res.ok) {
                      alert(t('sales_pdf_regenerated_hint'))
                      onUpdated() // refresh list
                    } else alert(`${t('error_prefix')} ${stringifyError('error' in res ? res.error : res)}`)
                  } catch (err) {
                    alert(`${t('error_prefix')} ${stringifyError(err)}`)
                  } finally {
                    btn.innerText = oldText
                    btn.disabled = false
                  }
                }}
                className="btn ghost sm"
                style={{ fontSize: 11, color: 'var(--tx3)' }}
              >
                ↻ Re-générer
              </button>
              <button 
                onClick={async () => {
                  try {
                    const res = await getSignedUrl(order.pdf_path!)
                    if ('url' in res) window.open(res.url, '_blank')
                    else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                  } catch (err) {
                    alert(`${t('error_prefix')} ${stringifyError(err)}`)
                  }
                }}
                className="btn ghost sm" 
                style={{ fontSize: 11, color: 'var(--cyan)' }}
              >
                ↓ Télécharger PDF
              </button>
            </div>
          )}
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
        {detail && <span className="d" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>{detail}</span>}
      </div>
    </div>
  )
}

function SortInd({ k, current, dir }: { k: string; current: string; dir: 'asc' | 'desc' }) {
  if (k !== current) return <span style={{ opacity: 0.2, marginLeft: 4, fontSize: 13 }}>↕</span>
  return <span style={{ color: 'var(--ac)', marginLeft: 4, fontSize: 13 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

function PaymentProgress({ order }: { order: SaleOrderRow }) {
  const [paid, setPaid] = useState(0)
  const total = order.prix_final || 0
  
  const today = new Date().toISOString().split('T')[0]
  const isDepositOverdue = !order.deposit_paid && order.deposit_due && order.deposit_due < today
  const isBalanceOverdue = !order.balance_paid && order.balance_due && order.balance_due < today
  const isOverdue = isDepositOverdue || isBalanceOverdue

  useEffect(() => {
    import('@/app/atelier/sales/actions').then(({ fetchPayments }) => {
      fetchPayments(order.id).then(rows => {
        setPaid(rows.reduce((s, p) => s + p.amount, 0))
      })
    })
  }, [order.id])

  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const isDone = paid >= total && total > 0
  
  return (
    <div style={{ width: '100%', minWidth: 100 }}>
      <style>{pulseAnim}</style>
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', fontSize: 9, 
        color: isOverdue ? 'var(--rust)' : 'var(--tx3)', 
        marginBottom: 4, fontFamily: 'var(--font-mono)',
        animation: isOverdue ? 'pulse-red 2s infinite ease-in-out' : 'none'
      }}>
        <span>{isOverdue ? '⚠️ OVERDUE' : `${Math.round(pct)}%`}</span>
        <span>{isDone ? 'CLEAR' : `${(total - paid).toLocaleString()}€ REST.`}</span>
      </div>
      <div style={{ 
        height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden',
        border: isOverdue ? '1px solid var(--rust)44' : 'none'
      }}>
        <div style={{ 
          height: '100%', width: `${pct}%`, 
          background: isDone ? 'var(--sage)' : isOverdue ? 'var(--rust)' : pct > 0 ? 'var(--cyan)' : 'var(--bd)',
          transition: 'width 0.4s ease'
        }} />
      </div>
    </div>
  )
}
