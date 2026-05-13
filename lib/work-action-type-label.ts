import type { DictKey } from '@/lib/i18n/dictionary'

/** Strip accents + lowercase for matching labels from `work_action_type`. */
function normWatLabel(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '')
}

/** IDs referenced in `syncPipelineWithBooleans` (app/atelier/works/actions.ts). */
const WAT_ID_TO_KEY: Partial<Record<number, DictKey>> = {
  6: 'wat_photographier',
  9: 'wat_cataloguer',
}

/**
 * Normalized label tokens (French defaults + `WAT_*` machine suffixes) → dict keys.
 * Custom column labels not listed here fall back to the raw DB `label`.
 */
const WAT_LABEL_TOKEN_TO_KEY: Record<string, DictKey> = {
  cataloguer: 'wat_cataloguer',
  catalogue: 'wat_cataloguer',
  photographier: 'wat_photographier',
  photographie: 'wat_photographier',
  retoucher: 'wat_retoucher',
  'a monter': 'wat_a_monter',
  encadrer: 'wat_encadrer',
  exposer: 'wat_exposer',
  'a expedier': 'wat_a_expedier',
}

/** `WAT_CATALOGUE` / `Cataloguer` → shared normalized token for {@link WAT_LABEL_TOKEN_TO_KEY}. */
function normWatDbLabel(dbLabel: string): string {
  const trimmed = dbLabel.trim()
  const machine = trimmed.match(/^WAT[_](.+)$/i)
  if (machine) {
    return normWatLabel(machine[1].replace(/_/g, ' '))
  }
  return normWatLabel(trimmed)
}

export function workActionTypeDisplayLabel(
  id: number,
  dbLabel: string,
  t: (k: DictKey) => string,
): string {
  const byId = WAT_ID_TO_KEY[id]
  if (byId) return t(byId)
  const key = WAT_LABEL_TOKEN_TO_KEY[normWatDbLabel(dbLabel)]
  if (key) return t(key)
  return dbLabel
}
