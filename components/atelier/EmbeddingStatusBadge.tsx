'use client'

import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import {
  shouldShowEmbeddingBadge,
  type EmbeddingStatus,
} from '@/lib/graph/embedding-status'

const LABEL_KEY = {
  pending: 'embedding_status_pending',
  embedding: 'embedding_status_embedding',
  error: 'embedding_status_error',
} as const satisfies Record<'pending' | 'embedding' | 'error', DictKey>

interface Props {
  oeuvreId: number
  status: EmbeddingStatus | undefined
}

export function EmbeddingStatusBadge({ oeuvreId, status }: Props) {
  const { t } = useI18n()
  if (!status || !shouldShowEmbeddingBadge(status)) return null

  const labelKey = LABEL_KEY[status]
  const label = t(labelKey)

  return (
    <span
      data-testid={`embedding-badge-${oeuvreId}`}
      className="chip dust"
      title={label}
      style={{
        fontSize: 9,
        letterSpacing: 0.3,
        opacity: status === 'error' ? 1 : 0.85,
        color: status === 'error' ? 'var(--warn, #b45309)' : 'var(--tx3)',
        borderColor: status === 'error' ? 'var(--warn, #b45309)' : undefined,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}
