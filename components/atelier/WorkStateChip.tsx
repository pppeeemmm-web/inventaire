'use client'

// WorkStateChip — single unified chip replacing the old StageChip + StatusChip pair.
// Derives state from statusId → OeuvreStatus label, with boolean fallback.

import { statusOf } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { StatusChip } from '@/components/ui/StatusChip'
import type { Oeuvre } from '@/lib/types/database'

interface Props {
  o: Oeuvre
  statusLabelMap: Record<number, string>
  /** Dense table cell: dot + label, fate as a short suffix. */
  compact?: boolean
}

export function WorkStateChip({ o, statusLabelMap, compact }: Props) {
  const { t } = useI18n()
  const st = statusOf(o, statusLabelMap)
  // Catalogued but still in production (explicit status or photo pending) → yellow, not rust.
  const cls = st === 'en_production' && o.Catalogué ? 'yellow' : undefined
  // Sold / gift keep their status after a destruction or loss; the fate rides along.
  const fate = o.fate && st !== 'destroyed' && st !== 'lost' ? o.fate : null
  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}>
        <StatusChip s={st} cls={cls} compact />
        {fate ? <span style={{ fontSize: 11, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>· {t(fate === 'destroyed' ? 'fate_destroyed_suffix' : 'fate_lost_suffix')}</span> : null}
      </span>
    )
  }
  return (
    <>
      <StatusChip s={st} cls={cls} />
      {fate ? (
        <span className="chip mt" style={{ marginLeft: 4 }}>
          {t(fate === 'destroyed' ? 'fate_destroyed_suffix' : 'fate_lost_suffix')}
        </span>
      ) : null}
    </>
  )
}
