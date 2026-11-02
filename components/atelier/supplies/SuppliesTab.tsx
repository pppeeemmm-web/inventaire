'use client'

// Fournitures / Supplies — one studio tab over `stock_item` (owner 2026-11-02): the stock list
// (was "Fournisseurs", filed under Catalogue), the shelf count (was the Stock-take tab), and
// restock / order. Sub-view lives in `?view=` so links and the old /atelier/stock-take land
// on the right one.

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import type { StockContactLike } from '@/lib/stock-item'

function TabPanelFallback() {
  return <div style={{ flex: 1 }} />
}

const SupplierHub = dynamic(() => import('@/components/atelier/SupplierHub').then((m) => ({ default: m.SupplierHub })), { loading: () => <TabPanelFallback />, ssr: false })
const StockTake = dynamic(() => import('@/app/atelier/(portal)/stock-take/_components/StockTake').then((m) => ({ default: m.StockTake })), { loading: () => <TabPanelFallback />, ssr: false })
const SuppliesRestock = dynamic(() => import('@/components/atelier/supplies/SuppliesRestock').then((m) => ({ default: m.SuppliesRestock })), { loading: () => <TabPanelFallback />, ssr: false })

export type SuppliesView = 'stock' | 'count' | 'restock'
const VIEWS: SuppliesView[] = ['stock', 'count', 'restock']

export function parseSuppliesView(raw: string | null | undefined): SuppliesView {
  return raw === 'count' || raw === 'restock' ? raw : 'stock'
}

export function SuppliesTab({ contacts }: { contacts: StockContactLike[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const view = parseSuppliesView(params.get('view'))

  const setView = (v: SuppliesView) => {
    const next = new URLSearchParams(params.toString())
    if (v === 'stock') next.delete('view'); else next.set('view', v)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div data-testid="supplies-tab" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        role="tablist"
        aria-label={t('supplies_views_aria')}
        style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', padding: '0 16px', flexShrink: 0, overflowX: 'auto' }}
      >
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            data-testid={`supplies-view-${v}`}
            onClick={() => setView(v)}
            style={{
              padding: '12px 16px', minHeight: 44, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              color: view === v ? 'var(--ac)' : 'var(--tx3)',
              borderBottom: `2px solid ${view === v ? 'var(--ac)' : 'transparent'}`,
            }}
          >
            {t(`supplies_view_${v}`)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {view === 'stock' ? <SupplierHub contacts={contacts} /> : null}
        {view === 'count' ? <StockTake contacts={contacts} /> : null}
        {view === 'restock' ? <SuppliesRestock contacts={contacts} /> : null}
      </div>
    </div>
  )
}
