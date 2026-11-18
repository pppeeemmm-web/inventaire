'use client'

// Commandes — supply orders in Studio → Fournitures (TODO 11 + 11d): planned orders and walk-in purchases in
// one list (Pem 2026-11-18). Open orders by default; « + Commande » and « + Achat » open the order sheet.
// `?order=<id>` opens one (link from Réassort « Créer la commande »).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { listSupplyOrders } from '@/app/atelier/(portal)/stock/supply-order-actions'
import { isOpenSupplyOrder, supplyOrderStatusKey, type SupplyOrderSummary } from '@/lib/supply-orders'
import { type StockContactLike, formatStockCurrency, supplierDisplayName } from '@/lib/stock-item'
import { SupplyOrderSheet } from '@/components/atelier/supplies/SupplyOrderSheet'

const CHIP_COLOR: Record<string, string> = {
  so_status_draft: 'var(--tx3)',
  so_status_ordered: 'var(--cyan)',
  so_status_partial: 'var(--yellow)',
  so_status_received: 'var(--sage)',
  so_status_closed_short: 'var(--sage)',
  so_status_cancelled: 'var(--rust)',
}

export function SupplyOrders({ contacts }: { contacts: StockContactLike[] }) {
  const { t, lang } = useI18n()
  const isPhone = useMediaQuery('(max-width: 767px)')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [orders, setOrders] = useState<SupplyOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [added, setAdded] = useState<StockContactLike[]>([])
  const [sheet, setSheet] = useState<{ id: number | null; mode: 'order' | 'purchase' } | null>(null)

  const allContacts = useMemo(() => [...contacts, ...added], [contacts, added])
  const nameById = useMemo(() => new Map(allContacts.map((c) => [c.ContactID, supplierDisplayName(c)])), [allContacts])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listSupplyOrders()
    setLoading(false)
    if ('error' in res) { toast.error(res.error.startsWith('so_err_') ? t(res.error as DictKey) : res.error); return }
    setOrders(res.orders)
  }, [t])
  useEffect(() => { void load() }, [load])

  // Deep link from Réassort: ?view=orders&order=12
  useEffect(() => {
    const raw = params.get('order')
    const n = raw ? Number(raw) : NaN
    if (Number.isInteger(n) && n > 0) setSheet({ id: n, mode: 'order' })
  }, [params])

  const closeSheet = () => {
    setSheet(null)
    if (params.get('order')) {
      const next = new URLSearchParams(params.toString())
      next.delete('order')
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    }
  }

  const shown = showAll ? orders : orders.filter((o) => isOpenSupplyOrder(o.status))
  const openCount = orders.filter((o) => isOpenSupplyOrder(o.status)).length
  const dateFmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit' }) : '')
  const dates = (o: SupplyOrderSummary) => [
    o.ordered_at ? t('so_date_ordered_fmt').replace('{d}', dateFmt(o.ordered_at)) : '',
    o.received_at ? t('so_date_received_fmt').replace('{d}', dateFmt(o.received_at)) : '',
  ].filter(Boolean).join(' · ')

  const chip = (o: SupplyOrderSummary) => {
    const key = supplyOrderStatusKey(o)
    // « Reçue n / m » counts lines received in full; when every line is still short (each partly in),
    // « 0 / 2 » read as nothing received (stress test 2026-11-18) → « Reçue en partie ».
    const complete = o.lines - o.short_lines
    const label = key === 'so_status_partial'
      ? (complete > 0 ? t(key as DictKey).replace('{n}', String(complete)).replace('{of}', String(o.lines)) : t('so_status_partial_some'))
      : t(key as DictKey)
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, whiteSpace: 'nowrap', color: CHIP_COLOR[key], border: `1px solid color-mix(in srgb, ${CHIP_COLOR[key]} 50%, var(--bd))` }}>
        {label}
      </span>
    )
  }

  const cell: React.CSSProperties = { padding: '9px 10px', borderBottom: '1px solid var(--bd)', fontSize: 13, verticalAlign: 'middle', whiteSpace: 'nowrap' }
  const th: React.CSSProperties = { ...cell, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx3)', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'var(--bg1)', borderBottom: '1px solid var(--bd2, var(--bd))' }
  const num: React.CSSProperties = { ...cell, textAlign: 'right' }
  const tick = (ok: boolean) => <span style={{ color: ok ? 'var(--sage)' : 'var(--tx3)' }}>{ok ? '✓' : '—'}</span>

  return (
    <div data-testid="supply-orders" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: isPhone ? '12px 16px' : '16px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div role="group" aria-label={t('so_filter_aria')} style={{ display: 'inline-flex', border: '1px solid var(--bd)', borderRadius: 3 }}>
          {[false, true].map((all) => (
            <button key={String(all)} type="button" aria-pressed={showAll === all} onClick={() => setShowAll(all)}
              style={{ minHeight: 44, padding: '0 12px', fontSize: 12, background: showAll === all ? 'var(--bg3, var(--bg2))' : 'none', color: showAll === all ? 'var(--tx)' : 'var(--tx3)', border: 'none', cursor: 'pointer' }}>
              {all ? t('so_filter_all_fmt').replace('{n}', String(orders.length)) : t('so_filter_open_fmt').replace('{n}', String(openCount))}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} data-testid="supply-new-purchase" onClick={() => setSheet({ id: null, mode: 'purchase' })}>{t('so_new_purchase')}</button>
        <button type="button" className="btn primary sm" style={{ minHeight: 44 }} data-testid="supply-new-order" onClick={() => setSheet({ id: null, mode: 'order' })}>{t('so_new_order')}</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--tx2)', margin: '0 0 12px', maxWidth: 760 }}>{t('so_intro')}</p>

      {!loading && shown.length === 0 ? <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('so_empty')}</div> : null}

      {isPhone ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {shown.map((o) => (
            <button key={o.id} type="button" onClick={() => setSheet({ id: o.id, mode: 'order' })}
              style={{ textAlign: 'left', border: '1px solid var(--bd)', borderRadius: 6, padding: 12, background: 'var(--bg2)', color: 'var(--tx)', display: 'grid', gap: 6, cursor: 'pointer' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 12, color: 'var(--tx2)' }}>{o.ref}</b>{chip(o)}
              </span>
              <span style={{ fontSize: 15 }}>{nameById.get(o.supplier_id) ?? `#${o.supplier_id}`}</span>
              <span style={{ fontSize: 12, color: 'var(--tx3)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{t('so_lines_fmt').replace('{n}', String(o.lines))}{dates(o) ? ` · ${dates(o)}` : ''}</span>
                <span>{formatStockCurrency(lang, o.total_ht)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : shown.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('so_col_ref')}</th>
              <th style={th}>{t('so_col_supplier')}</th>
              <th style={th}>{t('so_col_status')}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('so_col_lines')}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('so_col_total')}</th>
              <th style={th}>{t('so_col_dates')}</th>
              <th style={th}>{t('so_col_expense')}</th>
              <th style={th}>{t('so_col_files')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id} onClick={() => setSheet({ id: o.id, mode: 'order' })} style={{ cursor: 'pointer' }}>
                <td style={{ ...cell, fontWeight: 700, fontSize: 12, color: 'var(--tx2)' }}>{o.ref}</td>
                <td style={cell}>{nameById.get(o.supplier_id) ?? `#${o.supplier_id}`}</td>
                <td style={cell}>{chip(o)}</td>
                <td style={num}>{o.lines}</td>
                <td style={num}>{formatStockCurrency(lang, o.total_ht)}</td>
                <td style={{ ...cell, color: 'var(--tx3)', fontSize: 12 }}>{dates(o) || '—'}</td>
                <td style={cell}>{tick(o.expense_id != null)}</td>
                <td style={cell}>{tick(o.files > 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {sheet ? (
        <SupplyOrderSheet
          key={`${sheet.mode}-${sheet.id ?? 'new'}`}
          orderId={sheet.id}
          mode={sheet.mode}
          contacts={allContacts}
          onClose={closeSheet}
          onChanged={() => void load()}
          onSupplierAdded={(c) => setAdded((p) => [...p, c])}
        />
      ) : null}
    </div>
  )
}
