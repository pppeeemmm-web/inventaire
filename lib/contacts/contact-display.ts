/**
 * One way to write and sort a contact's name (ContactsReview phase 1, Pem 2026-11-18 « Yes, all recommended »).
 *
 * - Lists, pickers, table columns: `DUPONT Marie` (family name first, in capitals) — `contactListLabel`.
 * - Papers, PDFs, sentences:        `Marie DUPONT`                                  — `contactProseLabel`.
 * - Institution only:               the institution as typed, never in capitals.
 * - Person + institution:           the person, then the institution (`DUPONT Marie · Galerie X`).
 * - Capitals are display only: stored `Nom` stays as typed (« de Kooning », « McCoy »).
 * - Sort: family name (particle included: « de Kooning » under D), then first name; institution-only contacts by
 *   their institution. Accent- and case-insensitive, Intl.Collator in the UI language.
 */

export type ContactNameFields = {
  ContactID?: number | null
  NomInstitution?: string | null
  Nom?: string | null
  Prénom?: string | null
}

export type ContactLabelOptions = {
  /**
   * `after` (default): person then institution. `none`: person only (institution when there is no person).
   * `prefer`: the institution when there is one, else the person — legal papers (invoices, order papers) where the
   * institution is the party, as they printed before.
   */
  institution?: 'after' | 'none' | 'prefer'
  /** Shown when the contact has no name at all. Default `#<ContactID>`, else ''. */
  fallback?: string
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

const foldName = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * The family name, or '' when it only repeats the institution (e.g. #35: Nom = « Galerie Patrick Reygade »,
 * Prénom = Nathalie, institution = the same gallery — correct data, Pem 2026-11-18): the institution shows once.
 */
function familyName(c: ContactNameFields): string {
  const nom = clean(c.Nom)
  const inst = clean(c.NomInstitution)
  return nom && inst && foldName(nom) === foldName(inst) ? '' : nom
}

/** Family name = the institution (#35): « person only » places still name the institution, once. */
function nameIsInstitution(c: ContactNameFields): boolean {
  return !!clean(c.Nom) && !familyName(c)
}

function fallbackOf(c: ContactNameFields, opts?: ContactLabelOptions): string {
  if (opts?.fallback != null) return opts.fallback
  return c.ContactID != null ? `#${c.ContactID}` : ''
}

/** `DUPONT Marie`, `DUPONT`, `Marie` or '' (no institution). */
export function contactPersonListName(c: ContactNameFields): string {
  const nom = familyName(c)
  const prenom = clean(c.Prénom)
  return [nom.toUpperCase(), prenom].filter(Boolean).join(' ')
}

/** `Marie DUPONT`, `DUPONT`, `Marie` or '' (no institution). */
export function contactPersonProseName(c: ContactNameFields): string {
  const nom = familyName(c)
  const prenom = clean(c.Prénom)
  return [prenom, nom.toUpperCase()].filter(Boolean).join(' ')
}

/** Lists / pickers / columns: `DUPONT Marie`, `DUPONT Marie · Galerie X`, `Galerie X`, else `#id`. */
export function contactListLabel(c: ContactNameFields | null | undefined, opts?: ContactLabelOptions): string {
  if (!c) return opts?.fallback ?? ''
  const person = contactPersonListName(c)
  const inst = clean(c.NomInstitution)
  const mode = nameIsInstitution(c) && opts?.institution === 'none' ? 'after' : (opts?.institution ?? 'after')
  if (inst && mode === 'prefer') return inst
  if (person && inst && mode === 'after') return `${person} · ${inst}`
  return person || inst || fallbackOf(c, opts)
}

/** Papers / sentences: `Marie DUPONT`, `Marie DUPONT (Galerie X)`, `Galerie X`, else `#id`. */
export function contactProseLabel(c: ContactNameFields | null | undefined, opts?: ContactLabelOptions): string {
  if (!c) return opts?.fallback ?? ''
  const person = contactPersonProseName(c)
  const inst = clean(c.NomInstitution)
  const mode = nameIsInstitution(c) && opts?.institution === 'none' ? 'after' : (opts?.institution ?? 'after')
  if (inst && mode === 'prefer') return inst
  if (person && inst && mode === 'after') return `${person} (${inst})`
  return person || inst || fallbackOf(c, opts)
}

/** Lowercase text to search a name in: matches « marie dupont », « dupont marie » and the institution. */
export function contactSearchText(c: ContactNameFields): string {
  const nom = clean(c.Nom)
  const prenom = clean(c.Prénom)
  return [`${prenom} ${nom}`.trim(), `${nom} ${prenom}`.trim(), clean(c.NomInstitution)].filter(Boolean).join(' | ').toLowerCase()
}

/** Sort parts: [family name or institution, first name, institution]. Lowercase, accents folded. */
function sortParts(c: ContactNameFields): [string, string, string] {
  const nom = foldName(familyName(c))
  const prenom = foldName(clean(c.Prénom))
  const inst = foldName(clean(c.NomInstitution))
  if (nom) return [nom, prenom, inst]
  // Family name = the institution (#35): sorted under the institution, then the first name.
  if (inst && clean(c.Nom)) return [inst, prenom, '']
  if (prenom) return [prenom, '', inst]
  return [inst, '', '']
}

/** A plain-string sort key (family name, first name, institution), for places that sort on strings. */
export function contactSortKey(c: ContactNameFields): string {
  return sortParts(c).join('\u0001')
}

const collators = new Map<string, Intl.Collator>()

function collatorFor(lang: string | undefined): Intl.Collator {
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  let col = collators.get(locale)
  if (!col) {
    col = new Intl.Collator(locale, { sensitivity: 'base', numeric: true, ignorePunctuation: true })
    collators.set(locale, col)
  }
  return col
}

/** Comparator: family name, then first name, then institution, then ContactID (stable). `lang` = UI lang (`fr` / `en`). */
export function compareContactsByName(lang?: string) {
  const col = collatorFor(lang)
  return (a: ContactNameFields, b: ContactNameFields): number => {
    const pa = sortParts(a)
    const pb = sortParts(b)
    for (let i = 0; i < 3; i++) {
      // Empty names last.
      if (!pa[i] !== !pb[i] && i === 0) return pa[i] ? -1 : 1
      const d = col.compare(pa[i], pb[i])
      if (d !== 0) return d
    }
    return (a.ContactID ?? 0) - (b.ContactID ?? 0)
  }
}

/** Sorted copy (never mutates). */
export function sortContactsByName<T extends ContactNameFields>(rows: readonly T[], lang?: string): T[] {
  return [...rows].sort(compareContactsByName(lang))
}

/**
 * « Privé » (Pem 2026-11-19): a private contact is hidden from non-admin team members where they BROWSE, SEARCH or
 * PICK a contact — and only there. Wherever it is already tied to something (a work's owner / holder / buyer, an order,
 * a shipment, an event, a paper) its name and address still show and the team works normally: name lookups use the
 * full list, never this one. `keepIds`: the field's current value(s), so an existing pick stays in its select.
 */
export function pickableContacts<T extends { ContactID: number; is_private?: boolean | null }>(
  rows: readonly T[],
  opts: { isAdmin: boolean; keepIds?: Iterable<number | string | null | undefined> },
): T[] {
  if (opts.isAdmin) return rows as T[]
  const keep = new Set<number>()
  for (const id of opts.keepIds ?? []) if (id != null && id !== '' && Number.isFinite(Number(id))) keep.add(Number(id))
  return rows.filter((c) => !c.is_private || keep.has(c.ContactID))
}
