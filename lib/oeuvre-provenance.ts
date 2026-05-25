/** Resolve auth user ids for Oeuvres created_by / edited_by (incl. pending replay). */

export function provenanceUserId(
  sessionUserId: string,
  pendingAuthorId: string | null | undefined,
): string {
  const pending = pendingAuthorId?.trim()
  return pending || sessionUserId
}

export function provenanceTimestamp(): string {
  return new Date().toISOString()
}
