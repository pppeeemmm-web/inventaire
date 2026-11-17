/**
 * Historique write-back without losing lines (docs/WORK_RULES.md rule 14, batch 2).
 *
 * The database appends a line to `Oeuvres.Historique` on every change of status, owner or
 * custodian (`oeuvre_history`). A screen that loaded the text, let someone edit it, and wrote the
 * whole text back would drop every line the database added in between. These helpers keep them.
 * Pure functions: no I/O, safe to import anywhere.
 */

function lines(text: string | null | undefined): string[] {
  return (text ?? '').replace(/\r/g, '').split('\n')
}

function lineKeys(text: string | null | undefined): Set<string> {
  return new Set(lines(text).map((l) => l.trim()).filter(Boolean))
}

/** Same text, ignoring `\r` and outer whitespace. */
export function sameHistorique(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').replace(/\r/g, '').trim() === (b ?? '').replace(/\r/g, '').trim()
}

/**
 * `primary` as written, then every non-empty line of `extra` it does not already hold, in
 * `extra`'s order. Never loses a line of either.
 */
export function unionHistorique(primary: string | null | undefined, extra: string | null | undefined): string {
  const have = lineKeys(primary)
  const add: string[] = []
  for (const l of lines(extra)) {
    const k = l.trim()
    if (!k || have.has(k)) continue
    have.add(k)
    add.push(k)
  }
  const head = (primary ?? '').replace(/\r/g, '').trim()
  if (!add.length) return head
  return head ? `${head}\n${add.join('\n')}` : add.join('\n')
}

/**
 * Text to store when someone edited the Historique they loaded.
 *
 * - `edited`  : the text the person saves.
 * - `base`    : the text their screen loaded (`null` = unknown: older client, queued change).
 * - `current` : the text in the database right now.
 *
 * Returns `undefined` when there is nothing to write (no edit). Otherwise the person's text, plus
 * every line that reached the database after they opened the card (lines in `current` that are not
 * in `base`). With no `base`, every line of `current` the person's text lacks is kept: a line they
 * deleted can come back, a line the database wrote can never go.
 */
export function historiqueToStore(
  edited: string | null | undefined,
  base: string | null | undefined,
  current: string | null | undefined,
): string | undefined {
  // Empty edit: keep what is stored (the card never clears the log).
  if (!(edited ?? '').trim()) return undefined
  if (base != null && sameHistorique(edited, base)) return undefined
  if (base != null && sameHistorique(current, base)) return (edited ?? '').replace(/\r/g, '').trim()

  const known = base != null ? lineKeys(base) : new Set<string>()
  const arrived = lines(current).filter((l) => {
    const k = l.trim()
    return k && !known.has(k)
  })
  return unionHistorique(edited, arrived.join('\n'))
}
