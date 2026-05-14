/** PostgREST / Postgres error text when `page_view` lacks visitor analytics columns. */
export function missingPageViewVisitorColumns(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('visitor_id') || m.includes('is_team_session')
}
