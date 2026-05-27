'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { STOCK_CATEGORY_VALUES, labelStockCategory } from '@/lib/i18n/stockCategories'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import {
  type StockItemRow,
  type StockContactLike,
  supplierDisplayName,
  supplierContactSummary,
  formatStockCurrency,
  pricedInventoryValueEur,
  resolveStockSupplierContacts,
} from '@/lib/stock-item'
import {
  buildSupplierExportDetails,
  buildSuppliersPlainText,
  downloadSuppliersTxt,
} from '@/lib/supplier-list-export'
import {
  buildStockMaterialExportRows,
  buildStockMaterialsPlainText,
  downloadStockMaterialsTxt,
} from '@/lib/stock-material-list-export'

const UNCATEGORIZED = '__stock_uc__'
const SUPPLIERS_OPEN_KEY = 'pem-stock-suppliers-open'

type MaterialSortKey = 'name' | 'category' | 'supplier' | 'qty'

function SortInd({
  k,
  current,
  dir,
}: {
  k: MaterialSortKey
  current: MaterialSortKey
  dir: 'asc' | 'desc'
}) {
  if (k !== current) {
    return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 11 }}>↕</span>
  }
  return (
    <span style={{ color: 'var(--ac)', marginLeft: 4, fontSize: 11 }}>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

type StockEdit = Partial<StockItemRow> & {
  draftCost?: string
  draftNotes?: string
}

type SupplierContactRow = StockContactLike & {
  Ville?: string | null
  Pays?: string | null
}

interface Props {
  contacts: SupplierContactRow[]
}

function matchesSearch(it: StockItemRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  return (
    it.name.toLowerCase().includes(s) ||
    (it.notes ?? '').toLowerCase().includes(s)
  )
}

function downloadBlob(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadCsv(filename: string, lines: string[]) {
  downloadBlob(filename, lines.join('\n'), 'text/csv;charset=utf-8')
}

function matchesSupplierSearch(c: StockContactLike, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const name = supplierDisplayName(c).toLowerCase()
  const bits = [
    name,
    c.Ville ?? '',
    c.Pays ?? '',
    c.Email ?? '',
    c.Téléphone1 ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return bits.includes(s)
}

export function SupplierHub({ contacts }: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [items, setItems] = useState<StockItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<StockEdit | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryKey, setCategoryKey] = useState<string>('')
  const [lowOnly, setLowOnly] = useState(false)
  const [sortKey, setSortKey] = useState<MaterialSortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [materialSupplierFilter, setMaterialSupplierFilter] = useState<number | null>(
    null,
  )
  const [suppliersOpen, setSuppliersOpen] = useState(true)
  const [deleteStep2, setDeleteStep2] = useState(false)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierSelected, setSupplierSelected] = useState<Set<number>>(new Set())
  const [supplierExportBusy, setSupplierExportBusy] = useState(false)
  const [supplierDetails, setSupplierDetails] = useState<Record<number, StockContactLike>>({})
  const [itemSelected, setItemSelected] = useState<Set<number>>(new Set())
  const [itemExportBusy, setItemExportBusy] = useState(false)

  const suppliers = useMemo(
    () => resolveStockSupplierContacts(contacts, items),
    [contacts, items],
  )

  const suppliersEnriched = useMemo(
    () =>
      suppliers.map((s) => ({
        ...s,
        ...(supplierDetails[s.ContactID] ?? {}),
      })),
    [suppliers, supplierDetails],
  )

  const filteredSuppliers = useMemo(() => {
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    return [...suppliersEnriched]
      .filter((s) => matchesSupplierSearch(s, supplierSearch))
      .sort((a, b) =>
        supplierDisplayName(a).localeCompare(supplierDisplayName(b), loc),
      )
  }, [suppliersEnriched, supplierSearch, lang])

  useEffect(() => {
    if (suppliers.length === 0) {
      setSupplierDetails({})
      return
    }
    const ids = suppliers.map((s) => s.ContactID)
    let cancelled = false
    const sb = createClient()
    void (async () => {
      const { data, error } = await sb
        .from('Contact')
        .select(
          'ContactID, Email, IndicatifPays1, "Téléphone1", Ville, Pays',
        )
        .in('ContactID', ids)
      if (cancelled || error) return
      const map: Record<number, StockContactLike> = {}
      for (const row of (data ?? []) as StockContactLike[]) {
        map[row.ContactID] = row
      }
      setSupplierDetails(map)
    })()
    return () => {
      cancelled = true
    }
  }, [suppliers])

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data, error } = await sb.from('stock_item').select('*').order('name')
    if (error) {
      toast.error(`${t('error_prefix')} ${stringifyError(error)}`)
      setItems([])
    } else if (data) {
      setItems(data as StockItemRow[])
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SUPPLIERS_OPEN_KEY) === '0') setSuppliersOpen(false)
    } catch {
      /* sessionStorage unavailable */
    }
  }, [])

  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.ContactID, c])),
    [contacts],
  )

  const supplierNameFor = useCallback(
    (supplierId: number | null | undefined): string => {
      if (supplierId == null) return ''
      const c = contactById.get(supplierId)
      return c ? supplierDisplayName(c) : ''
    },
    [contactById],
  )

  const toggleMaterialSort = (key: MaterialSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'qty' ? 'desc' : 'asc')
  }

  const toggleSuppliersOpen = () => {
    setSuppliersOpen((open) => {
      const next = !open
      try {
        sessionStorage.setItem(SUPPLIERS_OPEN_KEY, next ? '1' : '0')
      } catch {
        /* sessionStorage unavailable */
      }
      return next
    })
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
      categoryKey ||
      lowOnly ||
      materialSupplierFilter != null,
  )

  const clearMaterialFilters = () => {
    setSearch('')
    setCategoryKey('')
    setLowOnly(false)
    setMaterialSupplierFilter(null)
  }

  const filteredSorted = useMemo(() => {
    let rows = items.filter((it) => matchesSearch(it, search))
    if (lowOnly) rows = rows.filter((it) => it.quantity <= it.min_stock)
    if (categoryKey === UNCATEGORIZED) {
      rows = rows.filter((it) => !it.category?.trim())
    } else if (categoryKey) {
      rows = rows.filter((it) => (it.category ?? '').trim() === categoryKey)
    }
    if (materialSupplierFilter != null) {
      rows = rows.filter((it) => it.supplier_id === materialSupplierFilter)
    }
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...rows]
    if (sortKey === 'name') {
      sorted.sort((a, b) => dir * a.name.localeCompare(b.name, loc))
    } else if (sortKey === 'category') {
      sorted.sort((a, b) => {
        const ca = a.category ? labelStockCategory(a.category, t) : ''
        const cb = b.category ? labelStockCategory(b.category, t) : ''
        return dir * ca.localeCompare(cb, loc)
      })
    } else if (sortKey === 'supplier') {
      sorted.sort(
        (a, b) =>
          dir *
          supplierNameFor(a.supplier_id).localeCompare(
            supplierNameFor(b.supplier_id),
            loc,
          ),
      )
    } else {
      sorted.sort((a, b) => dir * (Number(a.quantity) - Number(b.quantity)))
    }
    return sorted
  }, [
    items,
    search,
    lowOnly,
    categoryKey,
    materialSupplierFilter,
    sortKey,
    sortDir,
    lang,
    supplierNameFor,
    t,
  ])

  const kpiLow = useMemo(
    () => items.filter((it) => it.quantity <= it.min_stock).length,
    [items],
  )
  const kpiValue = useMemo(() => pricedInventoryValueEur(items), [items])

  const suppliersForFilter = useMemo(() => {
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    return [...suppliers].sort((a, b) =>
      supplierDisplayName(a).localeCompare(supplierDisplayName(b), loc),
    )
  }, [suppliers, lang])

  const materialSupplierFilterName =
    materialSupplierFilter != null
      ? supplierNameFor(materialSupplierFilter)
      : null

  const openNew = () => {
    setDeleteStep2(false)
    setEditing({
      name: '',
      category: null,
      quantity: 0,
      unit: 'units',
      min_stock: 0,
      supplier_id: null,
      cost_unit: null,
      notes: null,
      draftCost: '',
      draftNotes: '',
    })
  }

  const openEdit = (it: StockItemRow) => {
    setDeleteStep2(false)
    setEditing({
      ...it,
      draftCost: it.cost_unit != null ? String(it.cost_unit) : '',
      draftNotes: it.notes ?? '',
    })
  }

  const parseCost = (): number | null => {
    if (!editing) return null
    const raw = (editing.draftCost ?? '').trim()
    if (!raw) return null
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function handleSave(): Promise<boolean> {
    if (!editing?.name?.trim()) return false
    setBusy(true)
    const sb = createClient()
    const cost = parseCost()
    const payload = {
      name: editing.name.trim(),
      category: editing.category || null,
      quantity: Number(editing.quantity ?? 0),
      unit: (editing.unit || 'units').trim() || 'units',
      min_stock: Number(editing.min_stock ?? 0),
      supplier_id: editing.supplier_id || null,
      cost_unit: cost,
      notes: (editing.draftNotes ?? '').trim() || null,
    }

    try {
      if (editing.id) {
        const { error } = await sb
          .from('stock_item')
          .update(payload)
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('stock_item').insert(payload)
        if (error) throw error
      }
      await load()
      toast.success(t('stock_toast_saved'))
      setEditing(null)
      return true
    } catch (e) {
      toast.error(`${t('stock_save_failed')} ${stringifyError(e)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: number) {
    setBusy(true)
    const sb = createClient()
    const { error } = await sb.from('stock_item').delete().eq('id', id)
    if (error) {
      toast.error(`${t('error_prefix')} ${stringifyError(error)}`)
    } else {
      toast.success(t('stock_toast_deleted'))
      await load()
      setEditing(null)
    }
    setBusy(false)
    setDeleteStep2(false)
  }

  const adjustQty = async (id: number, delta: number) => {
    const it = items.find((i) => i.id === id)
    if (!it) return
    const next = Math.max(0, Number(it.quantity) + delta)
    const sb = createClient()
    const { error } = await sb
      .from('stock_item')
      .update({ quantity: next })
      .eq('id', id)
    if (error) {
      toast.error(`${t('stock_adjust_failed')} ${stringifyError(error)}`)
      return
    }
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, quantity: next } : x)),
    )
  }

  const toggleItemOne = (id: number) => {
    setItemSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllItems = () => {
    if (
      itemSelected.size > 0 &&
      itemSelected.size === filteredSorted.length
    ) {
      setItemSelected(new Set())
      return
    }
    setItemSelected(new Set(filteredSorted.map((it) => it.id)))
  }

  const exportMaterialList = async () => {
    const orderedIds = filteredSorted
      .map((it) => it.id)
      .filter((id) => itemSelected.has(id))
    if (orderedIds.length === 0 || itemExportBusy) return
    setItemExportBusy(true)
    const date = new Date().toISOString().slice(0, 10)
    const title = t('stock_materials_section')
    const categoryLabel = (raw: string | null) =>
      raw?.trim() ? labelStockCategory(raw, t) : '—'
    const labels = {
      generated: t('stock_supplier_export_generated'),
      name: t('stock_th_name'),
      category: t('category'),
      qty: t('stock_th_qty'),
      unit: t('stock_th_unit'),
      supplier: t('stock_th_supplier'),
      unitCost: t('stock_th_unit_price'),
      lineValue: t('stock_material_export_line_value'),
      minStock: t('stock_field_min_stock'),
      notes: t('stock_field_notes'),
      low: t('stock_badge_low'),
    }
    try {
      const rows = buildStockMaterialExportRows(
        items,
        orderedIds,
        contacts,
        categoryLabel,
        lang,
      )
      const plain = buildStockMaterialsPlainText(rows, title, date, labels)
      downloadStockMaterialsTxt(`stock-materials-${date}.txt`, plain)
      toast.success(t('stock_material_export_downloaded'))
      try {
        await navigator.clipboard.writeText(plain)
        toast.success(t('stock_material_export_copied'))
      } catch {
        toast.info(t('stock_material_export_clipboard_failed'))
      }
    } finally {
      setItemExportBusy(false)
    }
  }

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const header = [
      'name',
      'category',
      'quantity',
      'unit',
      'supplier',
      'unit_cost_eur',
      'min_stock',
      'notes',
    ]
    const lines = [header.join(',')]
    for (const it of filteredSorted) {
      const sup = contacts.find((c) => c.ContactID === it.supplier_id)
      const supName = sup ? supplierDisplayName(sup) : ''
      lines.push(
        [
          esc(it.name),
          esc(it.category ? labelStockCategory(it.category, t) : ''),
          String(it.quantity),
          esc(it.unit),
          esc(supName),
          it.cost_unit != null ? String(it.cost_unit) : '',
          String(it.min_stock),
          esc(it.notes ?? ''),
        ].join(','),
      )
    }
    downloadCsv(`stock-export-${new Date().toISOString().slice(0, 10)}.csv`, lines)
  }

  const toggleSupplierOne = (id: number) => {
    setSupplierSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllSuppliers = () => {
    if (
      supplierSelected.size > 0 &&
      supplierSelected.size === filteredSuppliers.length
    ) {
      setSupplierSelected(new Set())
      return
    }
    setSupplierSelected(
      new Set(filteredSuppliers.map((s) => s.ContactID)),
    )
  }

  const exportSupplierList = async () => {
    const orderedIds = filteredSuppliers
      .map((s) => s.ContactID)
      .filter((id) => supplierSelected.has(id))
    if (orderedIds.length === 0 || supplierExportBusy) return
    setSupplierExportBusy(true)
    const date = new Date().toISOString().slice(0, 10)
    const title = t('stock_suppliers_section')
    const labels = {
      contact: t('stock_supplier_export_label_contact'),
      address: t('stock_supplier_export_label_address'),
      notes: t('stock_supplier_export_label_notes'),
      generated: t('stock_supplier_export_generated'),
    }
    try {
      const sb = createClient()
      const [contactRes, addrRes, emailRes, phoneRes] = await Promise.all([
        sb
          .from('Contact')
          .select(
            'ContactID, NomInstitution, Nom, "Prénom", Role, Email, IndicatifPays1, "Téléphone1", Website, Adresse, CodePostal, Ville, Pays, Notes',
          )
          .in('ContactID', orderedIds),
        sb
          .from('contact_addresses')
          .select('contact_id, adresse, code_postal, ville, pays, position')
          .in('contact_id', orderedIds)
          .order('position'),
        sb
          .from('contact_emails')
          .select('contact_id, email, is_primary')
          .in('contact_id', orderedIds),
        sb
          .from('contact_phones')
          .select('contact_id, country_code, phone, is_primary')
          .in('contact_id', orderedIds),
      ])
      if (contactRes.error) throw contactRes.error
      const blocks = buildSupplierExportDetails(
        (contactRes.data ?? []) as Parameters<typeof buildSupplierExportDetails>[0],
        (addrRes.data ?? []) as Parameters<typeof buildSupplierExportDetails>[1],
        (emailRes.data ?? []) as Parameters<typeof buildSupplierExportDetails>[2],
        (phoneRes.data ?? []) as Parameters<typeof buildSupplierExportDetails>[3],
        orderedIds,
      )
      const plain = buildSuppliersPlainText(blocks, title, date, labels)
      downloadSuppliersTxt(`suppliers-list-${date}.txt`, plain)
      toast.success(t('stock_supplier_export_downloaded'))
      try {
        await navigator.clipboard.writeText(plain)
        toast.success(t('stock_supplier_export_copied'))
      } catch {
        toast.info(t('stock_supplier_export_clipboard_failed'))
      }
    } catch (e) {
      toast.error(`${t('error_prefix')} ${stringifyError(e)}`)
    } finally {
      setSupplierExportBusy(false)
    }
  }

  const editKey = editing ? String(editing.id ?? 'new') : ''
  const editingSnap = useMemo(
    () => (editing ? JSON.stringify(editing) : ''),
    [editing],
  )
  const [baselineEdit, setBaselineEdit] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (!editing) {
      setBaselineEdit(null)
      return
    }
    setBaselineEdit(JSON.stringify(editing))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey])
  const isDirtyStock =
    editing != null && baselineEdit != null && editingSnap !== baselineEdit

  const { attemptClose: attemptCloseStock, unsavedDialog: unsavedStockDialog } =
    useUnsavedCloseGuard({
      isDirty: isDirtyStock,
      onClose: () => {
        setEditing(null)
        setDeleteStep2(false)
      },
      performSave: () => handleSave(),
    })

  const pad = narrow ? '12px 12px' : '24px 32px'

  return (
    <div
      data-testid="atelier-stock-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        padding: pad,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
            {t('stock_title')}
          </div>
          <div
            className="t-mono-sm"
            style={{ color: 'var(--tx3)', marginTop: 4 }}
          >
            {t('stock_items_count_fmt').replace(/\{n\}/g, String(items.length))}
          </div>
        </div>
        <button
          type="button"
          className="btn primary sm"
          style={{ minHeight: 44 }}
          data-testid="atelier-stock-new-item"
          onClick={() => openNew()}
        >
          {t('stock_new_item')}
        </button>
      </div>

      <section
        id="atelier-stock-suppliers-anchor"
        data-testid="atelier-stock-suppliers"
        style={{
          marginBottom: 20,
          border: '1px solid var(--bd)',
          borderRadius: 4,
          background: 'var(--bg1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: 'var(--bg1)',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          <button
            type="button"
            data-testid="atelier-stock-suppliers-toggle"
            aria-expanded={suppliersOpen}
            aria-controls="atelier-stock-suppliers-body"
            title={
              suppliersOpen
                ? t('stock_suppliers_collapse')
                : t('stock_suppliers_expand')
            }
            onClick={toggleSuppliersOpen}
            style={{
              width: '100%',
              padding: '12px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                aria-hidden
                style={{
                  color: 'var(--ac)',
                  fontSize: 12,
                  lineHeight: 1,
                  transform: suppliersOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              >
                ▶
              </span>
              <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
                {t('stock_suppliers_section')}
              </div>
            </div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
              {filteredSuppliers.length}
              <span style={{ opacity: 0.5 }}>/{suppliers.length}</span>
            </div>
          </button>
          {suppliersOpen && (
          <>
          <div
            style={{
              padding: '10px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              borderTop: '1px solid var(--bd)',
            }}
          >
          <input
            type="search"
            className="t-mono-sm"
            placeholder={t('stock_supplier_search_ph')}
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            style={{
              flex: '1 1 200px',
              minWidth: 120,
              maxWidth: 360,
              padding: '10px 12px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              color: 'var(--tx)',
              borderRadius: 4,
            }}
          />
          <button
            type="button"
            className="btn ghost sm"
            style={{ minHeight: 44 }}
            onClick={toggleAllSuppliers}
            disabled={filteredSuppliers.length === 0}
          >
            {t('selectAll')} ({filteredSuppliers.length})
          </button>
          {supplierSelected.size > 0 && (
            <>
              <span className="t-mono-sm" style={{ color: 'var(--tx2)' }}>
                {t('stock_supplier_selection_fmt').replace(
                  /\{n\}/g,
                  String(supplierSelected.size),
                )}
              </span>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44 }}
                onClick={() => setSupplierSelected(new Set())}
              >
                {t('stock_supplier_clear')}
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ minHeight: 44, background: 'var(--ac)', borderColor: 'var(--ac)' }}
                data-testid="atelier-stock-supplier-export-list"
                disabled={supplierExportBusy}
                onClick={() => void exportSupplierList()}
              >
                {supplierExportBusy ? '…' : t('stock_supplier_export_list')}
              </button>
            </>
          )}
          </div>
        <div
          id="atelier-stock-suppliers-body"
          style={{ maxHeight: narrow ? 240 : 280, overflow: 'auto' }}
        >
          <table className="tbl" data-testid="atelier-stock-suppliers-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    aria-label={t('stock_supplier_select_all_aria')}
                    checked={
                      filteredSuppliers.length > 0 &&
                      filteredSuppliers.every((s) =>
                        supplierSelected.has(s.ContactID),
                      )
                    }
                    onChange={toggleAllSuppliers}
                  />
                </th>
                <th>{t('stock_th_supplier')}</th>
                <th>{t('stock_supplier_col_contact')}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{ textAlign: 'center', padding: 24, color: 'var(--tx3)' }}
                  >
                    {t('stock_supplier_empty')}
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{ textAlign: 'center', padding: 24, color: 'var(--tx3)' }}
                  >
                    {t('stock_supplier_no_filtered')}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const summary = supplierContactSummary(s)
                  return (
                    <tr
                      key={s.ContactID}
                      data-testid={`atelier-stock-supplier-row-${s.ContactID}`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={supplierSelected.has(s.ContactID)}
                          onChange={() => toggleSupplierOne(s.ContactID)}
                          aria-label={supplierDisplayName(s)}
                        />
                      </td>
                      <td
                        style={{ fontWeight: 500, cursor: 'pointer' }}
                        title={t('stock_supplier_filter_by')}
                        onClick={() => setMaterialSupplierFilter(s.ContactID)}
                      >
                        {supplierDisplayName(s)}
                      </td>
                      <td
                        className="t-mono-sm"
                        style={{ color: 'var(--tx3)', fontSize: 11 }}
                      >
                        {summary ?? '\u2014'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
          </>
          )}
        </div>
      </section>

      <div
        data-testid="atelier-stock-kpis"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          className="t-mono-sm"
          style={{
            padding: '10px 14px',
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
            borderRadius: 4,
          }}
        >
          {t('stock_kpi_skus_fmt').replace(/\{n\}/g, String(items.length))}
        </div>
        <div
          className="t-mono-sm"
          style={{
            padding: '10px 14px',
            border: '1px solid var(--bd)',
            background: kpiLow ? 'var(--rust)18' : 'var(--bg1)',
            borderRadius: 4,
            color: kpiLow ? 'var(--rust)' : 'var(--tx2)',
          }}
        >
          {t('stock_kpi_low_fmt').replace(/\{n\}/g, String(kpiLow))}
        </div>
        <div
          className="t-mono-sm"
          style={{
            padding: '10px 14px',
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
            borderRadius: 4,
          }}
        >
          {t('stock_kpi_value_est')}:{' '}
          {kpiValue != null
            ? formatStockCurrency(lang, kpiValue)
            : '\u2014'}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
          {t('stock_materials_section')}
        </div>
        <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
          {t('stock_filtered_count_fmt')
            .replace(/\{shown\}/g, String(filteredSorted.length))
            .replace(/\{total\}/g, String(items.length))}
        </div>
      </div>

      <div
        data-testid="atelier-stock-toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <input
          type="search"
          className="t-mono-sm"
          placeholder={t('stock_toolbar_search_ph')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px',
            minWidth: 120,
            maxWidth: 360,
            padding: '10px 12px',
            background: 'var(--bg0)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            borderRadius: 4,
          }}
        />
        <select
          className="t-mono-sm"
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value)}
          style={{
            padding: '10px 12px',
            background: 'var(--bg0)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            borderRadius: 4,
          }}
        >
          <option value="">{t('stock_category_all')}</option>
          <option value={UNCATEGORIZED}>{t('stock_uncategorized')}</option>
          {STOCK_CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {labelStockCategory(c, t)}
            </option>
          ))}
        </select>
        <select
          className="t-mono-sm"
          value={materialSupplierFilter ?? ''}
          onChange={(e) =>
            setMaterialSupplierFilter(
              e.target.value ? Number(e.target.value) : null,
            )
          }
          style={{
            padding: '10px 12px',
            background: 'var(--bg0)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            borderRadius: 4,
            maxWidth: 220,
          }}
          data-testid="atelier-stock-supplier-filter"
        >
          <option value="">{t('stock_filter_supplier_all')}</option>
          {suppliersForFilter.map((s) => (
            <option key={s.ContactID} value={s.ContactID}>
              {supplierDisplayName(s)}
            </option>
          ))}
        </select>
        <label
          className="t-mono-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
          />
          {t('stock_low_stock_only')}
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            className="btn ghost sm"
            style={{ minHeight: 44 }}
            onClick={clearMaterialFilters}
            data-testid="atelier-stock-clear-filters"
          >
            {t('stock_filters_clear')}
          </button>
        )}
        {materialSupplierFilterName && (
          <span
            className="t-mono-sm"
            style={{
              padding: '6px 10px',
              border: '1px solid var(--ac)',
              borderRadius: 4,
              color: 'var(--ac)',
            }}
          >
            {t('stock_supplier_filter_chip_fmt').replace(
              /\{name\}/g,
              materialSupplierFilterName,
            )}
          </span>
        )}
        {itemSelected.size > 0 && (
          <>
            <span className="t-mono-sm" style={{ color: 'var(--tx2)' }}>
              {t('stock_material_selection_fmt').replace(
                /\{n\}/g,
                String(itemSelected.size),
              )}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              style={{ minHeight: 44 }}
              onClick={() => setItemSelected(new Set())}
            >
              {t('stock_material_clear')}
            </button>
            <button
              type="button"
              className="btn sm"
              style={{
                minHeight: 44,
                background: 'var(--ac)',
                borderColor: 'var(--ac)',
              }}
              data-testid="atelier-stock-material-export-list"
              disabled={itemExportBusy}
              onClick={() => void exportMaterialList()}
            >
              {itemExportBusy ? '…' : t('stock_material_export_list')}
            </button>
          </>
        )}
        <button
          type="button"
          className="btn ghost sm"
          style={{ minHeight: 44 }}
          onClick={() => exportCsv()}
          data-testid="atelier-stock-export-all-csv"
        >
          {t('stock_export_all_csv')}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="tbl" data-testid="atelier-stock-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  aria-label={t('stock_material_select_all_aria')}
                  checked={
                    filteredSorted.length > 0 &&
                    filteredSorted.every((it) => itemSelected.has(it.id))
                  }
                  onChange={toggleAllItems}
                  disabled={loading || filteredSorted.length === 0}
                />
              </th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleMaterialSort('name')}
              >
                {t('stock_th_name')}
                <SortInd k="name" current={sortKey} dir={sortDir} />
              </th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleMaterialSort('category')}
              >
                {t('category')}
                <SortInd k="category" current={sortKey} dir={sortDir} />
              </th>
              <th
                className="num"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleMaterialSort('qty')}
              >
                {t('stock_th_qty')}
                <SortInd k="qty" current={sortKey} dir={sortDir} />
              </th>
              <th>{t('stock_th_unit')}</th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleMaterialSort('supplier')}
              >
                {t('stock_th_supplier')}
                <SortInd k="supplier" current={sortKey} dir={sortDir} />
              </th>
              <th className="num">{t('stock_th_unit_price')}</th>
              <th className="num" style={{ whiteSpace: 'nowrap' }}>
                {t('stock_th_adjust')}
              </th>
              <th style={{ width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', padding: 40, color: 'var(--tx3)' }}
                >
                  {t('loading')}
                </td>
              </tr>
            ) : filteredSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', padding: 40, color: 'var(--tx3)' }}
                >
                  {items.length === 0 ? t('stock_empty') : t('stock_no_filtered_results')}
                </td>
              </tr>
            ) : (
              filteredSorted.map((it) => {
                const low = it.quantity <= it.min_stock
                const sup = it.supplier_id
                  ? contactById.get(it.supplier_id)
                  : undefined
                const supName = sup ? supplierDisplayName(sup) : '\u2014'
                const stepStyle = narrow
                  ? { minWidth: 44, minHeight: 44, padding: 0 }
                  : { minWidth: 32, minHeight: 32, padding: '2px 6px' }
                return (
                  <tr
                    key={it.id}
                    style={{ opacity: low ? 1 : 0.92 }}
                    data-testid={`atelier-stock-row-${it.id}`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={itemSelected.has(it.id)}
                        onChange={() => toggleItemOne(it.id)}
                        aria-label={it.name}
                      />
                    </td>
                    <td
                      style={{
                        fontWeight: 500,
                        color: low ? 'var(--rust)' : 'var(--tx)',
                      }}
                    >
                      {it.name}{' '}
                      {low && (
                        <span
                          style={{
                            fontSize: 9,
                            marginLeft: 8,
                            color: 'var(--rust)',
                            border: '1px solid var(--rust)',
                            padding: '1px 4px',
                            borderRadius: 2,
                          }}
                        >
                          {t('stock_badge_low')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="t-mono-sm" style={{ opacity: 0.65 }}>
                        {it.category
                          ? labelStockCategory(it.category, t)
                          : '\u2014'}
                      </span>
                    </td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 600,
                        color: low ? 'var(--rust)' : 'var(--tx)',
                      }}
                    >
                      {it.quantity}
                    </td>
                    <td style={{ fontSize: 10, color: 'var(--tx3)' }}>{it.unit}</td>
                    <td
                      style={{
                        fontSize: 10,
                        color: 'var(--tx2)',
                        cursor: it.supplier_id ? 'pointer' : undefined,
                      }}
                      title={
                        it.supplier_id ? t('stock_supplier_filter_by') : undefined
                      }
                      onClick={() => {
                        if (it.supplier_id != null) {
                          setMaterialSupplierFilter(it.supplier_id)
                        }
                      }}
                    >
                      {supName}
                    </td>
                    <td className="num">
                      {formatStockCurrency(lang, it.cost_unit)}
                    </td>
                    <td className="num">
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 4,
                        }}
                      >
                        <button
                          type="button"
                          className="btn sm ghost"
                          style={stepStyle}
                          aria-label={t('stock_aria_minus_one')}
                          onClick={() => void adjustQty(it.id, -1)}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="btn sm ghost"
                          style={stepStyle}
                          aria-label={t('stock_aria_plus_one')}
                          onClick={() => void adjustQty(it.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ minHeight: 44 }}
                        onClick={() => openEdit(it)}
                      >
                        {t('edit')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <>
          {unsavedStockDialog}
          <div
            role="presentation"
            data-testid="atelier-stock-editor-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 100,
              display: 'flex',
              alignItems: narrow ? 'stretch' : 'center',
              justifyContent: 'center',
              padding: narrow ? 0 : 16,
            }}
            onClick={() => void attemptCloseStock()}
          >
            <div
              role="dialog"
              aria-modal
              data-testid="atelier-stock-editor"
              style={{
                background: 'var(--bg1)',
                border: narrow ? 'none' : '1px solid var(--bd2)',
                width: narrow ? '100%' : '100%',
                maxWidth: narrow ? '100%' : 560,
                maxHeight: narrow ? '100%' : '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: narrow ? 'none' : '0 20px 60px rgba(0,0,0,0.5)',
                margin: narrow ? 0 : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  flexShrink: 0,
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--bd)',
                }}
              >
                <div className="t-eyebrow">
                  {editing.id ? t('stock_modal_edit') : t('stock_modal_new')}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_name')}
                  </div>
                  <input
                    value={editing.name || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('category')}
                    </div>
                    <select
                      value={editing.category || ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          category: e.target.value || null,
                        })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    >
                      <option value="">—</option>
                      {STOCK_CATEGORY_VALUES.map((c) => (
                        <option key={c} value={c}>
                          {labelStockCategory(c, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('stock_field_unit')}
                    </div>
                    <input
                      value={editing.unit || ''}
                      placeholder={t('stock_field_unit_ph')}
                      onChange={(e) =>
                        setEditing({ ...editing, unit: e.target.value })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('stock_field_qty_current')}
                    </div>
                    <input
                      type="number"
                      value={editing.quantity ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          quantity: Number(e.target.value),
                        })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('stock_field_min_stock')}
                    </div>
                    <input
                      type="number"
                      value={editing.min_stock ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          min_stock: Number(e.target.value),
                        })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_unit_cost')}
                  </div>
                  <input
                    value={editing.draftCost ?? ''}
                    inputMode="decimal"
                    onChange={(e) =>
                      setEditing({ ...editing, draftCost: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_supplier')}
                  </div>
                  <select
                    value={editing.supplier_id || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        supplier_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                    }}
                  >
                    <option value="">{t('stock_supplier_none_option')}</option>
                    {suppliers.map((s) => (
                      <option key={s.ContactID} value={s.ContactID}>
                        {supplierDisplayName(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_notes')}
                  </div>
                  <textarea
                    value={editing.draftNotes ?? ''}
                    placeholder={t('stock_notes_ph')}
                    rows={3}
                    onChange={(e) =>
                      setEditing({ ...editing, draftNotes: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  padding: `12px 16px max(12px, env(safe-area-inset-bottom))`,
                  borderTop: '1px solid var(--bd)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  className="btn primary"
                  style={{ flex: '1 1 120px', minHeight: 44 }}
                  onClick={() => void handleSave()}
                  disabled={busy || !editing.name?.trim()}
                >
                  {busy ? '…' : t('save')}
                </button>
                {editing.id && (
                  <>
                    {!deleteStep2 ? (
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ color: 'var(--rust)', minHeight: 44 }}
                        onClick={() => setDeleteStep2(true)}
                      >
                        {t('delete')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{
                            color: 'var(--rust)',
                            border: '1px solid var(--rust)',
                            minHeight: 44,
                          }}
                          disabled={busy}
                          onClick={() => void handleDelete(editing.id!)}
                        >
                          {t('stock_delete_step2')}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ minHeight: 44 }}
                          onClick={() => setDeleteStep2(false)}
                        >
                          {t('back')}
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="btn ghost"
                  style={{ marginLeft: narrow ? 0 : 'auto', minHeight: 44 }}
                  onClick={() => void attemptCloseStock()}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
