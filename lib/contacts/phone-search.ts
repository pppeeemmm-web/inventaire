/**
 * Find a phone number however it was typed (ContactDoor.md step 4): « 06 74 89 02 54 », « 0674890254 »,
 * « +33 6 74 89 02 54 », « 0033674890254 » and « 674890 » all find « +33 » + « 6 74 89 02 54 », old forms too.
 * No library: safe in the browser (lib/contacts/phone.ts, which normalises, stays on the server).
 */

/** The query's digits without « 00 » / « 0 » in front, when it looks like a phone number (≥ 4 digits); else ''. */
export function phoneQueryDigits(q: string): string {
  if (!/^[\d\s+().\-/]+$/.test(q.trim())) return ''
  const d = q.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '')
  return d.length >= 4 ? d : ''
}

/** True when one of the [country code, number] pairs holds those digits (national or with its country code). */
export function phoneMatches(qDigits: string, pairs: ReadonlyArray<readonly [string | null | undefined, string | null | undefined]>): boolean {
  if (!qDigits) return false
  return pairs.some(([cc, ph]) => {
    const nat = (ph ?? '').replace(/\D/g, '').replace(/^0/, '')
    return !!nat && (nat.includes(qDigits) || `${(cc ?? '').replace(/\D/g, '')}${nat}`.includes(qDigits))
  })
}
