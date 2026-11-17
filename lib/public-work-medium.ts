import type { DictKey } from '@/lib/i18n/dictionary'

/**
 * Public caption medium from `Oeuvres.Support` (`Support` table). The Atelier labels
 * are short internal French (« P. huile », « Yupo/Legion »), so known ids get a
 * FR/EN caption label; any other id shows its Atelier label as-is.
 */
const SUPPORT_MEDIUM_KEYS: Record<number, DictKey> = {
  1: 'pub_medium_board',
  2: 'pub_medium_canson',
  3: 'pub_medium_canvas',
  4: 'pub_medium_rhodia',
  5: 'pub_medium_yupo',
  6: 'pub_medium_oil_paper',
  7: 'pub_medium_paper',
  9: 'pub_medium_aluminium',
  10: 'pub_medium_gold_paper',
  11: 'pub_medium_silver_paper',
  12: 'pub_medium_photo_paper',
  13: 'pub_medium_kraft',
  14: 'pub_medium_transparent_paper',
  15: 'pub_medium_wood',
  16: 'pub_medium_round_canvas',
  17: 'pub_medium_round_paper',
  18: 'pub_medium_round_board',
  19: 'pub_medium_japanese_paper',
  21: 'pub_medium_print_offset',
}

export function publicWorkMedium(
  work: { supportId?: number | null; supportLabel?: string | null },
  t: (key: DictKey) => string,
): string | null {
  const key = work.supportId != null ? SUPPORT_MEDIUM_KEYS[work.supportId] : undefined
  if (key) return t(key)
  const raw = work.supportLabel?.trim()
  return raw || null
}
