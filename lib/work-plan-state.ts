import type { createClient } from '@/lib/supabase/server'

/**
 * The work as `planPendingEdit` reads it: the `Oeuvres` row + theme / group ids joined (the baseline's shape).
 * Server only, not a door: called by the approval of a proposal and by `saveWork` for a card save.
 * `binned`: the row exists but is in the bin.
 */
export async function loadWorkPlanState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oid: number,
): Promise<{ state: Record<string, unknown>; binned: boolean } | { error: string }> {
  const [{ data: row, error }, { data: themeLinks, error: tErr }, { data: groupLinks, error: gErr }] = await Promise.all([
    supabase.from('Oeuvres').select('*').eq('OeuvreID', oid).maybeSingle(),
    supabase.from('oeuvre_theme').select('theme_id').eq('oeuvre_id', oid),
    supabase.from('working_group_work').select('group_id').eq('oeuvre_id', oid),
  ])
  const readErr = error ?? tErr ?? gErr
  if (readErr) return { error: readErr.message }
  const work = row as Record<string, unknown> | null
  if (!work) return { error: 'Œuvre introuvable ou supprimée' }
  return {
    binned: work.deleted_at != null,
    state: {
      ...work,
      themes: (themeLinks ?? []).map((r) => String(r.theme_id)).join(','),
      groups: (groupLinks ?? []).map((r) => r.group_id).join(','),
    },
  }
}
