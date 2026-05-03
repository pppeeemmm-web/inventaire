// StatusChip — maps a StatusKey to a coloured chip.
// Hardcoded French labels; no i18n dependency for portability.

import type { StatusKey } from '@/lib/data'

const MAP: Record<StatusKey, { cls: string; lbl: string }> = {
  en_production:   { cls: 'rust', lbl: 'En production' },
  available:       { cls: 'sage', lbl: 'Disponible'    },
  reserved:        { cls: 'dust', lbl: 'Réservé'       },
  consigned:       { cls: 'dust', lbl: 'Consigné'      },
  loan:            { cls: 'cyan', lbl: 'Prêt'          },
  sold:            { cls: 'mt',   lbl: 'Vendu'         },
  gift:            { cls: 'mt',   lbl: 'Don'           },
  artist_archive:  { cls: 'mt',   lbl: 'Archive (Pem)' },
  private_archive: { cls: 'mt',   lbl: 'Archive privée'},
}

export function StatusChip({ s }: { s: StatusKey }) {
  const m = MAP[s] ?? MAP.en_production
  return <span className={`chip ${m.cls}`}>{m.lbl}</span>
}
