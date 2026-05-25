/** Single rule for “the” contact email — editor list beats legacy Contact.Email. */

export type EmailListRow = { email: string; is_primary?: boolean }

export function primaryContactEmail(
  emailList: EmailListRow[],
  legacyEmail?: string | null,
): string | null {
  const fromList =
    emailList.find((e) => e.is_primary)?.email?.trim() ||
    emailList[0]?.email?.trim() ||
    ''
  if (fromList) return fromList
  const legacy = legacyEmail?.trim()
  return legacy || null
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
