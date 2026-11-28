/**
 * Voice walk (Equipment.md step 4): a spoken or typed list for one shelf → proposed Stock lines Pem ticks. Nothing is
 * saved here and nothing leaves the device: a plain split on commas / « et » / « and » / new lines. (An AI proposal
 * would send the list to an outside service — not without Pem's decision; admin guide: « nothing goes to an outside AI ».)
 */
export type ProposedLine = { name: string; quantity: number }

/** « une molette en verre, deux couteaux et une balance » → three lines. */
export function splitSpokenList(text: string): ProposedLine[] {
  return text
    .slice(0, 4000)
    .split(/[,;\n]|\s+(?:et|and|puis)\s+/i)
    .map((s) => s.trim().replace(/^(un|une|des|le|la|les|a|an|the)\s+/i, '').replace(/[.!?]+$/, '').trim().slice(0, 120))
    .filter((s) => s.length > 1)
    .slice(0, 40)
    .map((name) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), quantity: 1 }))
}
