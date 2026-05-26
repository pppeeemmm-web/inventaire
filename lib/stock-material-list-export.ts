import type { Lang } from '@/lib/i18n/dictionary'
import type { StockItemRow, StockContactLike } from '@/lib/stock-item'
import { formatStockCurrency, supplierDisplayName } from '@/lib/stock-item'

export type StockMaterialExportRow = {
  id: number
  name: string
  category: string
  quantity: string
  unit: string
  supplier: string
  unitCost: string
  lineValue: string
  minStock: string
  notes: string | null
  low: boolean
}

export function buildStockMaterialExportRows(
  items: StockItemRow[],
  orderIds: number[],
  contacts: StockContactLike[],
  categoryLabel: (raw: string | null) => string,
  lang: Lang,
): StockMaterialExportRow[] {
  const byId = new Map(items.map((it) => [it.id, it]))
  const contactById = new Map(contacts.map((c) => [c.ContactID, c]))
  const rows: StockMaterialExportRow[] = []
  for (const id of orderIds) {
    const it = byId.get(id)
    if (!it) continue
    const sup = it.supplier_id
      ? contactById.get(it.supplier_id)
      : undefined
    const supplier = sup ? supplierDisplayName(sup) : '—'
    const qty = Number(it.quantity)
    const cost = it.cost_unit
    const lineValue =
      cost != null && Number.isFinite(Number(cost))
        ? formatStockCurrency(lang, qty * Number(cost))
        : '—'
    rows.push({
      id,
      name: it.name,
      category: it.category?.trim() ? categoryLabel(it.category) : '—',
      quantity: String(qty),
      unit: it.unit?.trim() || '—',
      supplier,
      unitCost: formatStockCurrency(lang, cost),
      lineValue,
      minStock: String(Number(it.min_stock ?? 0)),
      notes: it.notes?.trim() || null,
      low: qty <= Number(it.min_stock ?? 0),
    })
  }
  return rows
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildStockMaterialsPlainText(
  rows: StockMaterialExportRow[],
  title: string,
  date: string,
  labels: {
    generated: string
    name: string
    category: string
    qty: string
    unit: string
    supplier: string
    unitCost: string
    lineValue: string
    minStock: string
    notes: string
    low: string
  },
): string {
  const header = `${title} — ${date}\n${'—'.repeat(Math.max(24, title.length))}\n`
  const body = rows
    .map((r, i) => {
      const lines = [
        r.name + (r.low ? ` [${labels.low}]` : ''),
        `  ${labels.category}: ${r.category}`,
        `  ${labels.qty}: ${r.quantity} ${r.unit}`,
        `  ${labels.supplier}: ${r.supplier}`,
        `  ${labels.unitCost}: ${r.unitCost} · ${labels.lineValue}: ${r.lineValue}`,
        `  ${labels.minStock}: ${r.minStock}`,
      ]
      if (r.notes) lines.push(`  ${labels.notes}: ${r.notes.replace(/\n/g, ' ')}`)
      return i < rows.length - 1 ? `${lines.join('\n')}\n` : lines.join('\n')
    })
    .join('\n\n')
  return `${header}\n${labels.generated} ${date}\n\n${body}\n`
}

export function buildStockMaterialsPrintHtml(
  rows: StockMaterialExportRow[],
  title: string,
  date: string,
  lang: Lang,
  labels: {
    generated: string
    name: string
    category: string
    qty: string
    unit: string
    supplier: string
    unitCost: string
    lineValue: string
    minStock: string
    notes: string
    low: string
  },
): string {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const th = (s: string) =>
    `<th scope="col">${escapeHtml(s)}</th>`
  const trs = rows
    .map((r) => {
      const nameCell = r.low
        ? `${escapeHtml(r.name)} <span class="low">${escapeHtml(labels.low)}</span>`
        : escapeHtml(r.name)
      const notesCell = r.notes
        ? escapeHtml(r.notes).replace(/\n/g, '<br>')
        : '—'
      return `<tr class="${r.low ? 'row-low' : ''}">
<td class="name">${nameCell}</td>
<td>${escapeHtml(r.category)}</td>
<td class="num">${escapeHtml(r.quantity)}</td>
<td>${escapeHtml(r.unit)}</td>
<td>${escapeHtml(r.supplier)}</td>
<td class="num">${escapeHtml(r.unitCost)}</td>
<td class="num">${escapeHtml(r.lineValue)}</td>
<td class="num">${escapeHtml(r.minStock)}</td>
<td class="notes">${notesCell}</td>
</tr>`
    })
    .join('')

  return `<!DOCTYPE html><html lang="${lang}"><head>
<meta charset="utf-8">
<title>${escapeHtml(title)} ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font: 10pt/1.4 Georgia, 'Times New Roman', serif; color: #111; padding: 12mm 14mm; }
  header { margin-bottom: 8mm; border-bottom: 1px solid #ccc; padding-bottom: 4mm; }
  header h1 { font-size: 13pt; font-weight: 600; }
  header .meta { font: 8pt/1.4 ui-monospace, monospace; color: #555; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { border: 1px solid #ddd; padding: 2.5mm 3mm; vertical-align: top; text-align: left; }
  th { background: #f4f4f4; font: 7.5pt/1.2 ui-monospace, monospace; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.name { font-weight: 600; min-width: 28mm; }
  td.notes { font-size: 8.5pt; color: #333; max-width: 36mm; }
  tr.row-low td.name { color: #8b2500; }
  .low { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #8b2500; margin-left: 2mm; }
  @page { margin: 10mm; size: landscape; }
  @media print { body { padding: 0; } thead { display: table-header-group; } tr { break-inside: avoid; } }
</style>
</head><body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(labels.generated)} ${date} · ${rows.length} · ${locale}</div>
</header>
<table>
<thead><tr>
${th(labels.name)}
${th(labels.category)}
${th(labels.qty)}
${th(labels.unit)}
${th(labels.supplier)}
${th(labels.unitCost)}
${th(labels.lineValue)}
${th(labels.minStock)}
${th(labels.notes)}
</tr></thead>
<tbody>
${trs}
</tbody>
</table>
<script>window.onload = () => setTimeout(() => window.print(), 400)<\/script>
</body></html>`
}

export function openStockMaterialsPrintWindow(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  return true
}

export function downloadStockMaterialsTxt(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
