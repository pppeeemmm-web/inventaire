'use client'

// WorkStateChip — single unified chip replacing the old StageChip + StatusChip pair.
// Derives state from statusId → OeuvreStatus label, with boolean fallback.

import { statusOf } from '@/lib/data'
import { StatusChip } from '@/components/ui/StatusChip'
import type { Oeuvre } from '@/lib/types/database'

interface Props {
  o: Oeuvre
  statusLabelMap: Record<number, string>
}

export function WorkStateChip({ o, statusLabelMap }: Props) {
  const st = statusOf(o, statusLabelMap)
  return <StatusChip s={st} />
}
