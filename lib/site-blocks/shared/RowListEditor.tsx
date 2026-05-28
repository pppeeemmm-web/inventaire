'use client'

import { useI18n } from '@/lib/i18n/context'

export interface RowListColumn<R extends Record<string, string>> {
  key: keyof R & string
  /** i18n key for the column header. */
  labelKey: Parameters<ReturnType<typeof useI18n>['t']>[0]
  /** Optional input type override. Defaults to 'text'. */
  inputType?: 'text' | 'date' | 'url' | 'number'
  /** Optional CSS flex-basis or width. */
  flex?: number | string
  /** Optional placeholder. */
  placeholder?: string
  /** Render as textarea instead of input. */
  multiline?: boolean
}

interface Props<R extends Record<string, string>> {
  rows: R[]
  columns: RowListColumn<R>[]
  defaultRow: R
  onChange: (next: R[]) => void
  /** i18n key for the "Add row" button. */
  addLabelKey: Parameters<ReturnType<typeof useI18n>['t']>[0]
}

/**
 * Generic dynamic-row editor for structured fields (exhibition history,
 * press mentions, etc.). Takes a column spec + default row shape and
 * handles add / remove / reorder.
 *
 * Rows are keyed by index for simplicity — minor React reconciliation
 * thrash on reorder, but acceptable for short lists (typically < 30).
 */
export default function RowListEditor<R extends Record<string, string>>({
  rows,
  columns,
  defaultRow,
  onChange,
  addLabelKey,
}: Props<R>) {
  const { t } = useI18n()

  function update(i: number, key: keyof R & string, value: string) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }
  function add() {
    onChange([...rows, { ...defaultRow }])
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    const [moved] = next.splice(i, 1)
    next.splice(j, 0, moved)
    onChange(next)
  }

  return (
    <div className="rle-root">
      <style>{`
        .rle-root { display: flex; flex-direction: column; gap: 6px; }
        .rle-head, .rle-row {
          display: grid;
          gap: 6px;
          align-items: center;
        }
        .rle-head {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3);
          padding: 0 4px;
        }
        .rle-row {
          padding: 4px;
          background: var(--bg2);
          border: 1px solid transparent;
        }
        .rle-row:hover { border-color: var(--bd2); }
        .rle-cell input, .rle-cell textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          padding: 5px 6px;
          background: var(--bg1); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .rle-cell textarea { min-height: 36px; resize: vertical; line-height: 1.4; }
        .rle-cell input:focus, .rle-cell textarea:focus {
          outline: none; border-color: var(--bd3);
        }
        .rle-actions {
          display: flex; gap: 1px;
          justify-content: flex-end;
        }
        .rle-actions button {
          border: none; background: transparent;
          width: 22px; height: 22px;
          cursor: pointer;
          color: var(--tx3); font-family: inherit; font-size: 10px;
          transition: color 120ms ease, background 120ms ease;
        }
        .rle-actions button:hover { color: var(--tx); background: var(--bg1); }
        .rle-actions button:disabled { color: var(--bd3); cursor: not-allowed; }
        .rle-actions button.danger:hover { color: var(--rust); }
        .rle-add {
          margin-top: 4px;
          padding: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx2);
          background: transparent;
          border: 1px dashed var(--bd2); border-radius: 0;
          cursor: pointer;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .rle-add:hover { color: var(--ac); border-color: var(--bd3); }
      `}</style>
      <RowGridStyle columns={columns} />
      <div className="rle-head">
        {columns.map(c => (
          <div key={c.key}>{t(c.labelKey)}</div>
        ))}
        <div />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="rle-row">
          {columns.map(c => (
            <div key={c.key} className="rle-cell">
              {c.multiline ? (
                <textarea
                  rows={2}
                  value={row[c.key] ?? ''}
                  placeholder={c.placeholder}
                  onChange={e => update(i, c.key, e.target.value)}
                />
              ) : (
                <input
                  type={c.inputType ?? 'text'}
                  value={row[c.key] ?? ''}
                  placeholder={c.placeholder}
                  onChange={e => update(i, c.key, e.target.value)}
                />
              )}
            </div>
          ))}
          <div className="rle-actions">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              title={t('site_block_action_move_up')} aria-label={t('site_block_action_move_up')}>▴</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
              title={t('site_block_action_move_down')} aria-label={t('site_block_action_move_down')}>▾</button>
            <button type="button" className="danger" onClick={() => remove(i)}
              title={t('site_block_action_remove')} aria-label={t('site_block_action_remove')}>×</button>
          </div>
        </div>
      ))}
      <button type="button" className="rle-add" onClick={add}>{t(addLabelKey)}</button>
    </div>
  )
}

function RowGridStyle<R extends Record<string, string>>({ columns }: { columns: RowListColumn<R>[] }) {
  const template = columns.map(c =>
    typeof c.flex === 'number' ? `${c.flex}fr`
      : typeof c.flex === 'string' ? c.flex
        : '1fr'
  ).concat(['80px']).join(' ')
  return <style>{`
    .rle-head, .rle-row { grid-template-columns: ${template}; }
  `}</style>
}
