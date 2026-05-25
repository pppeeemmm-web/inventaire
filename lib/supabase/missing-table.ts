/** PostgREST when a table is not exposed / does not exist on the linked project. */
export function isSupabaseMissingTableError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  if (err.code === 'PGRST205') return true
  const m = err.message ?? ''
  return m.includes('Could not find the table') || m.includes('schema cache')
}
