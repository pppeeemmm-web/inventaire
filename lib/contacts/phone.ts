import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/**
 * One stored form for phone numbers (ContactDoor.md step 4, Pem 2026-11-27: « France is the default although can
 * deduce from address or phone »). Google's numbering rules (libphonenumber-js). Stored as two fields, as every
 * reader expects: `country_code` « +33 » and `phone` « 6 74 89 02 54 » (the international grouping without its
 * prefix) — shown « +33 6 74 89 02 54 », dialled +33674890254.
 * The country comes from the number itself (« +… » / « 00… »), else from its own country-code field, else from the
 * contact's address country, else France. A number that can't be read is kept exactly as typed (never dropped).
 */

const COUNTRY_NAMES: Record<string, CountryCode> = {
  france: 'FR', espagne: 'ES', 'españa': 'ES', espana: 'ES', spain: 'ES', 'royaume-uni': 'GB', 'royaume uni': 'GB',
  uk: 'GB', 'united kingdom': 'GB', angleterre: 'GB', england: 'GB', irlande: 'IE', ireland: 'IE', italie: 'IT',
  italia: 'IT', italy: 'IT', allemagne: 'DE', germany: 'DE', deutschland: 'DE', belgique: 'BE', belgium: 'BE',
  suisse: 'CH', switzerland: 'CH', 'pays-bas': 'NL', netherlands: 'NL', portugal: 'PT', danemark: 'DK', denmark: 'DK',
  'grèce': 'GR', grece: 'GR', greece: 'GR', 'états-unis': 'US', 'etats-unis': 'US', usa: 'US', 'united states': 'US',
  canada: 'CA', monaco: 'MC', luxembourg: 'LU', autriche: 'AT', austria: 'AT', 'suède': 'SE', suede: 'SE', sweden: 'SE',
  norvège: 'NO', norway: 'NO', japon: 'JP', japan: 'JP',
}

/** « France », « Espagne », « ES »… → ISO country; null when unknown. */
export function countryFromName(name: string | null | undefined): CountryCode | null {
  const k = (name ?? '').trim().toLowerCase()
  if (!k) return null
  if (/^[a-z]{2}$/.test(k)) return k.toUpperCase() as CountryCode
  return COUNTRY_NAMES[k] ?? null
}

export type PhoneParts = { country_code: string | null; phone: string }

/** Normalised parts, or the input unchanged when the number can't be read. */
export function normalizePhone(parts: PhoneParts, addressCountry?: CountryCode | null): PhoneParts {
  const raw = (parts.phone ?? '').trim()
  const ccDigits = (parts.country_code ?? '').replace(/\D/g, '')
  const digits = raw.replace(/[^\d+]/g, '')
  if (!digits.replace(/\+/g, '')) return parts
  let text: string
  let fallback: CountryCode | undefined
  if (digits.startsWith('+')) text = digits
  else if (digits.startsWith('00')) text = `+${digits.slice(2)}`
  else if (ccDigits) text = `+${ccDigits}${digits.replace(/^0/, '')}` // a code split badly on import (« +336 » + « 23… ») reads back whole
  else {
    text = digits
    fallback = addressCountry ?? 'FR'
  }
  const n = parsePhoneNumberFromString(text, fallback)
  if (!n || !n.isValid()) return parts
  const cc = `+${n.countryCallingCode}`
  const intl = n.formatInternational() // « +33 6 74 89 02 54 »
  return { country_code: cc, phone: intl.startsWith(cc) ? intl.slice(cc.length).trim() : n.nationalNumber }
}
