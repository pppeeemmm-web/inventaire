'use client'

// Access-style field list: tick to show, ▲▼ to order, "Filtrer" to narrow on any field —
// shown or not. Filter editor follows the field kind (text, range, yes/no, list of values).

import { useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  fieldOptions,
  isActiveFilter,
  type FieldFilter,
  type ReportConfig,
  type ReportField,
  type ValuesMode,
} from '@/lib/reports/engine'

type Props = {
  fields: ReportField<unknown>[]
  rows: unknown[]
  cfg: ReportConfig
  onChange: (next: ReportConfig) => void
  locale: string
  narrow: boolean
}

const chip = (on: boolean): CSSProperties => ({
  padding: '4px 10px',
  minHeight: 32,
  fontSize: 11,
  cursor: 'pointer',
  border: '1px solid var(--bd)',
  background: on ? 'var(--tx)' : 'transparent',
  color: on ? 'var(--bg1)' : 'var(--tx2)',
  whiteSpace: 'nowrap',
})

export function ReportFieldsPanel({ fields, rows, cfg, onChange, locale, narrow }: Props) {
  const { t } = useI18n()
  const [openId, setOpenId] = useState<string | null>(null)
  const byId = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields])
  const shown = cfg.fields.map((id) => byId.get(id)).filter((f): f is ReportField<unknown> => !!f)
  const others = fields.filter((f) => !cfg.fields.includes(f.id))

  const setFilter = (id: string, f: FieldFilter | null) => {
    const filters = { ...cfg.filters }
    if (f && isActiveFilter(f)) filters[id] = f
    else delete filters[id]
    onChange({ ...cfg, filters })
  }
  const toggleShown = (id: string) => {
    if (cfg.fields.includes(id)) {
      if (cfg.fields.length <= 1) return
      onChange({ ...cfg, fields: cfg.fields.filter((x) => x !== id) })
    } else onChange({ ...cfg, fields: [...cfg.fields, id] })
  }
  const move = (id: string, d: -1 | 1) => {
    const i = cfg.fields.indexOf(id)
    const j = i + d
    if (i < 0 || j < 0 || j >= cfg.fields.length) return
    const next = [...cfg.fields]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange({ ...cfg, fields: next })
  }

  const rowH = narrow ? 44 : 34
  const iconBtn: CSSProperties = {
    width: narrow ? 40 : 26,
    minHeight: rowH - 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--tx3)',
    cursor: 'pointer',
    fontSize: 11,
  }

  const line = (f: ReportField<unknown>, isShown: boolean, idx: number) => {
    const active = isActiveFilter(cfg.filters[f.id])
    const open = openId === f.id
    return (
      <div key={f.id} data-testid={`report-field-${f.id}`} style={{ borderBottom: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: rowH }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={isShown} onChange={() => toggleShown(f.id)} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
          </label>
          {isShown ? (
            <>
              <button type="button" style={iconBtn} disabled={idx === 0} onClick={() => move(f.id, -1)} aria-label={t('report_move_up')} title={t('report_move_up')}>▲</button>
              <button type="button" style={iconBtn} disabled={idx === shown.length - 1} onClick={() => move(f.id, 1)} aria-label={t('report_move_down')} title={t('report_move_down')}>▼</button>
            </>
          ) : null}
          <button
            type="button"
            data-testid={`report-filter-toggle-${f.id}`}
            aria-expanded={open}
            onClick={() => setOpenId(open ? null : f.id)}
            style={{
              ...iconBtn,
              width: 'auto',
              padding: '0 8px',
              color: active ? 'var(--ac)' : 'var(--tx3)',
              fontWeight: active ? 700 : 400,
            }}
          >
            {active ? '● ' : ''}{t('report_field_filter')} {open ? '▾' : '▸'}
          </button>
        </div>
        {open ? (
          <FilterEditor field={f} rows={rows} filter={cfg.filters[f.id]} onChange={(x) => setFilter(f.id, x)} locale={locale} narrow={narrow} />
        ) : null}
      </div>
    )
  }

  return (
    <div data-testid="report-fields-panel">
      <div className="t-label" style={{ margin: '0 0 4px' }}>{t('report_fields_shown')}</div>
      {shown.map((f, i) => line(f, true, i))}
      <div className="t-label" style={{ margin: '14px 0 4px' }}>{t('report_fields_other')}</div>
      {others.map((f, i) => line(f, false, i))}
    </div>
  )
}

function FilterEditor({
  field,
  rows,
  filter,
  onChange,
  locale,
  narrow,
}: {
  field: ReportField<unknown>
  rows: unknown[]
  filter: FieldFilter | undefined
  onChange: (f: FieldFilter | null) => void
  locale: string
  narrow: boolean
}) {
  const { t } = useI18n()
  const [find, setFind] = useState('')
  const [pendingMode, setPendingMode] = useState<ValuesMode>(filter?.type === 'values' ? filter.mode : 'any')
  const options = useMemo(
    () => (field.kind === 'enum' || field.kind === 'multi' ? fieldOptions(field, rows, locale) : []),
    [field, rows, locale],
  )
  const inputH: CSSProperties = { minHeight: narrow ? 44 : 32, fontSize: 12 }
  const box: CSSProperties = { padding: '8px 0 12px 24px', display: 'flex', flexDirection: 'column', gap: 8 }
  const clear = (
    <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange(null)}>
      {t('report_filter_clear')}
    </button>
  )

  if (field.kind === 'text') {
    const q = filter?.type === 'text' ? filter.q : ''
    return (
      <div style={box}>
        <input className="input" style={inputH} value={q} placeholder={t('report_filter_contains')} aria-label={t('report_filter_contains')} onChange={(e) => onChange({ type: 'text', q: e.target.value })} />
        {q ? clear : null}
      </div>
    )
  }

  if (field.kind === 'number' || field.kind === 'date') {
    const r = filter?.type === 'range' ? filter : { type: 'range' as const, min: '', max: '' }
    const type = field.kind === 'date' ? 'date' : 'number'
    return (
      <div style={box}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" type={type} style={{ ...inputH, flex: 1, minWidth: 100 }} value={r.min} aria-label={t('report_filter_min')} placeholder={t('report_filter_min')} onChange={(e) => onChange({ ...r, min: e.target.value })} />
          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>→</span>
          <input className="input" type={type} style={{ ...inputH, flex: 1, minWidth: 100 }} value={r.max} aria-label={t('report_filter_max')} placeholder={t('report_filter_max')} onChange={(e) => onChange({ ...r, max: e.target.value })} />
        </div>
        {r.min || r.max ? clear : null}
      </div>
    )
  }

  if (field.kind === 'bool') {
    const v = filter?.type === 'bool' ? filter.value : null
    return (
      <div style={{ ...box, flexDirection: 'row', gap: 0 }}>
        <button type="button" style={chip(v === null)} onClick={() => onChange(null)}>{t('report_filter_either')}</button>
        <button type="button" style={chip(v === true)} onClick={() => onChange({ type: 'bool', value: true })}>{t('report_filter_yes')}</button>
        <button type="button" style={chip(v === false)} onClick={() => onChange({ type: 'bool', value: false })}>{t('report_filter_no')}</button>
      </div>
    )
  }

  // enum / multi: tick values; one value per row (enum) → is / is not; several (multi) → any / all / none.
  // The mode is kept locally too: with no value ticked the filter does not exist yet.
  const cur = filter?.type === 'values' ? filter : { type: 'values' as const, mode: pendingMode, values: [] as string[] }
  const modes: [ValuesMode, string][] =
    field.kind === 'multi'
      ? [['any', t('report_filter_any')], ['all', t('report_filter_all')], ['none', t('report_filter_none')]]
      : [['any', t('report_filter_is')], ['none', t('report_filter_is_not')]]
  const toggle = (v: string) =>
    onChange({ ...cur, values: cur.values.includes(v) ? cur.values.filter((x) => x !== v) : [...cur.values, v] })
  const ff = find.trim().toLowerCase()
  const listed = ff ? options.filter((o) => o.value.toLowerCase().includes(ff)) : options
  return (
    <div style={box} data-testid={`report-filter-${field.id}`}>
      <div style={{ display: 'flex', gap: 0 }}>
        {modes.map(([m, label]) => (
          <button
            key={m}
            type="button"
            style={chip(cur.mode === m)}
            onClick={() => {
              setPendingMode(m)
              if (cur.values.length) onChange({ ...cur, mode: m })
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {options.length > 10 ? (
        <input className="input" style={inputH} value={find} placeholder={t('report_filter_search_values')} aria-label={t('report_filter_search_values')} onChange={(e) => setFind(e.target.value)} />
      ) : null}
      <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {listed.map((o) => (
          <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, minHeight: narrow ? 40 : 28, cursor: 'pointer' }}>
            <input type="checkbox" checked={cur.values.includes(o.value)} onChange={() => toggle(o.value)} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.value}</span>
            <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{o.n}</span>
          </label>
        ))}
      </div>
      {cur.values.length ? clear : null}
    </div>
  )
}
