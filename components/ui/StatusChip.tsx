// StatusChip — maps a StatusKey to a coloured chip.
// Hardcoded French labels; no i18n dependency for portability.

import type { StatusKey } from '@/lib/data'

const MAP: Record<StatusKey, { cls: string; lbl: string }> = {
  en_production:   { cls: 'rust', lbl: 'En production' },
  available:       { cls: 'sage', lbl: 'Disponible'    },
  reserved:        { cls: 'magenta', lbl: 'Réservé'  },
  consigned:       { cls: 'magenta', lbl: 'Consigné' },
  loan:            { cls: 'magenta', lbl: 'Prêt'     },
  sold:            { cls: 'teal', lbl: 'Vendu'         },
  gift:            { cls: 'mono', lbl: 'Don'           },
  artist_archive:  { cls: 'mt',   lbl: 'Archive (Pem)' },
  private_archive: { cls: 'mt',   lbl: 'Archive privée'},
}

export function StatusChip({ s, cls }: { s: StatusKey; cls?: string }) {
  const m = MAP[s] ?? MAP.en_production
  return <span className={`chip ${cls ?? m.cls}`}>{m.lbl}</span>
}
