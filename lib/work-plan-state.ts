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

/**
 * Read guard (TODO §1, the split second between a card save's read and its write): the planned write also
 * requires every column it writes to still hold the value read when it was planned — in the same UPDATE, so
 * an order step, batch edit or board change landing in between makes it write nothing (then re-planned once).
 * Not guarded: what the save itself stamps or merges, the retired long text, and any text longer than
 * PLAN_READ_MAX_TEXT (each guarded value rides in the request URL; a long caption would make it too long).
 */
export const PLAN_READ_FIELD = '__plan_read'
const PLAN_READ_SKIP = new Set(['edited_at', 'edited_by', 'Historique', 'Commentaires', 'txtImageNameLink'])
const PLAN_READ_MAX_TEXT = 300

export function planReadGuardJson(state: Record<string, unknown>): string {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(state)) {
    if (k === 'themes' || k === 'groups' || PLAN_READ_SKIP.has(k)) continue
    if (typeof v === 'string' && v.length > PLAN_READ_MAX_TEXT) continue
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return JSON.stringify(out)
}

/** Column → value the write must still find; only columns the write sets. Null when no guard was sent. */
export function planReadGuard(raw: FormDataEntryValue | null, written: readonly string[]): [string, string | number | boolean | null][] | null {
  if (typeof raw !== 'string' || !raw) return null
  let read: Record<string, unknown>
  try {
    read = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  return written
    .filter((c) => !PLAN_READ_SKIP.has(c) && c in read)
    .map((c) => [c, read[c] as string | number | boolean | null])
}
