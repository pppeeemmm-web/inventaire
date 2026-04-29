// StatusChip — maps a StatusKey to a coloured chip.
// Hardcoded French labels; no i18n dependency for portability.

import type { StatusKey } from '@/lib/data'

const MAP: Record<StatusKey, { cls: string; lbl: string }> = {
  studio:    { cls: 'dust', lbl: 'Atelier' },
  consigned: { cls: 'dust', lbl: 'Consigné' },
  sold:      { cls: 'sage', lbl: 'Vendu' },
  loan:      { cls: 'cyan', lbl: 'Prêt' },
  wip:       { cls: 'rust', lbl: 'En cours' },
  destroyed: { cls: 'mt',   lbl: 'Détruit' },
  lost:      { cls: 'mt',   lbl: 'Perdu' },
}

export function StatusChip({ s }: { s: StatusKey }) {
  const m = MAP[s] ?? MAP.studio
  return <span className={`chip ${m.cls}`}>{m.lbl}</span>
}
