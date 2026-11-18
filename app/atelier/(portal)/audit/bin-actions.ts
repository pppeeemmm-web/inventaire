'use server'

// Audit « Corbeille » (TODO §3, admin guide « Supprimer : corbeilles et suppression définitive »):
// the works with `Oeuvres.deleted_at` set, newest first. Read only here — « Restaurer » reuses
// `restoreSoftDeletedWorks` (the toast's undo) and « Supprimer définitivement » `purgeWorkPermanently`,
// both in `app/atelier/works/actions.ts`.

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

export type TrashedWork = {
  id: number
  title: string | null
  /** Cover file name (`txtImageNameLink`) — the client builds the URL with `thumbUrl()`. */
  image: string | null
  deletedAt: string
}

export async function listTrashedWorks(): Promise<{ works: TrashedWork[] } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'admin' }
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, txtImageNameLink, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(500)
  if (error) {
    await logError('works bin list failed', error, { source: 'audit.listTrashedWorks' })
    return { error: error.message }
  }
  return {
    works: (data ?? []).map((w) => ({
      id: w.OeuvreID,
      title: w.Titre,
      image: w.txtImageNameLink,
      deletedAt: w.deleted_at as string,
    })),
  }
}
