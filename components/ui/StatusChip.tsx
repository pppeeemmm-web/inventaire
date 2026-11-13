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
  destroyed:       { cls: 'mt',   lbl: 'Détruite'      },
  lost:            { cls: 'mt',   lbl: 'Perdue'        },
}

/** Colour behind each chip class, for the compact (dot + label) form. */
const DOT: Record<string, string> = {
  rust: 'var(--rust)', sage: 'var(--sage)', magenta: 'var(--magenta)', teal: 'var(--teal)',
  yellow: 'var(--yellow)', mono: 'var(--tx)', mt: 'var(--mt)', cyan: 'var(--cyan)', dust: 'var(--dust)',
}

/** `compact`: dot + label, no box — for dense table cells (owner 2026-11-13); full label on hover. */
export function StatusChip({ s, cls, compact }: { s: StatusKey; cls?: string; compact?: boolean }) {
  const m = MAP[s] ?? MAP.en_production
  const c = cls ?? m.cls
  if (compact) {
    return (
      <span title={m.lbl} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%', fontSize: 12, color: 'var(--tx2)' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: DOT[c] ?? 'var(--tx3)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.lbl}</span>
      </span>
    )
  }
  return <span className={`chip ${c}`}>{m.lbl}</span>
}
