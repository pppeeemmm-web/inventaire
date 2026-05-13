import type { DictKey } from '@/lib/i18n/dictionary'

/** Strip accents + lowercase for matching canonical French labels from `work_action_type`. */
function normWatLabel(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '')
}

/** IDs referenced in `syncPipelineWithBooleans` (app/atelier/works/actions.ts). */
const WAT_ID_TO_KEY: Partial<Record<number, DictKey>> = {
  6: 'wat_photographier',
  9: 'wat_cataloguer',
}

/** Default French labels (accent-insensitive) → dict keys; custom rows fall back to DB `label`. */
const WAT_FR_LABEL_TO_KEY: Record<string, DictKey> = {
  cataloguer: 'wat_cataloguer',
  photographier: 'wat_photographier',
  retoucher: 'wat_retoucher',
  'a monter': 'wat_a_monter',
  encadrer: 'wat_encadrer',
  exposer: 'wat_exposer',
  'a expedier': 'wat_a_expedier',
}

export function workActionTypeDisplayLabel(
  id: number,
  dbLabel: string,
  t: (k: DictKey) => string,
): string {
  const byId = WAT_ID_TO_KEY[id]
  if (byId) return t(byId)
  const byFr = WAT_FR_LABEL_TO_KEY[normWatLabel(dbLabel)]
  if (byFr) return t(byFr)
  return dbLabel
}
