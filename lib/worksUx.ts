/** Preview / deploy toggle for /works presentation trials (plan B / A / C). */
export type WorksUxMode = 'default' | 'bridge' | 'intro' | 'chapters'

export function resolveWorksUx(query?: string | null): WorksUxMode {
  const q = query?.toLowerCase()?.trim()
  if (q === 'bridge' || q === 'intro' || q === 'chapters') return q
  const env = typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_WORKS_UX_MODE?.toLowerCase()?.trim()
    : undefined
  if (env === 'bridge' || env === 'intro' || env === 'chapters') return env as WorksUxMode
  return 'default'
}
