import { yearOf } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'
import type { SlideWork } from '@/lib/slideshow'

/**
 * Works (ids, in order) → slides, from the catalogue already loaded in the Atelier. A work that is not
 * loaded is left out (its count is reported by the caller where it matters).
 */
export function slideWorksFromOeuvres(
  ids: readonly number[],
  oeuvres: readonly Oeuvre[],
  tM: Record<number, string>,
  sM: Record<number, string>,
): SlideWork[] {
  const byId = new Map(oeuvres.map((o) => [o.OeuvreID, o]))
  const num = (v: unknown) => {
    const x = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
    return Number.isFinite(x) && x > 0 ? x : null
  }
  const out: SlideWork[] = []
  for (const id of ids) {
    const o = byId.get(id)
    if (!o) continue
    out.push({
      id,
      file: o.txtImageNameLink ?? null,
      title: o.Titre ?? null,
      year: yearOf(o.Année),
      technique: o.Technique != null ? tM[o.Technique] ?? null : null,
      support: o.Support != null ? sM[o.Support] ?? null : null,
      height: num(o.Hauteur),
      width: num(o.Largeur),
      depth: num(o.Profondeur),
    })
  }
  return out
}
