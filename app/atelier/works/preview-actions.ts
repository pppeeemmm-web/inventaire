'use server'

// `#1234` hover / hold preview (WorkRef): the few fields a small card shows. Team only (RLS + check).

import { createClient } from '@/lib/supabase/server'

export type WorkPreview = {
  id: number
  title: string | null
  year: string | null
  technique: string | null
  status: string | null
  image: string | null
}

export async function fetchWorkPreview(id: number): Promise<WorkPreview | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  // `select('*')`: the typed select parser rejects the accented `Année` column name.
  const { data: row } = await supabase.from('Oeuvres').select('*').eq('OeuvreID', id).maybeSingle()
  if (!row) return null
  const w = row as unknown as {
    OeuvreID: number
    Titre: string | null
    Année: string | null
    Technique: number | null
    statusId: number | null
    txtImageNameLink: string | null
  }
  const [tech, status] = await Promise.all([
    w.Technique != null
      ? supabase.from('Technique').select('Technique').eq('TechniqueID', w.Technique).maybeSingle()
      : Promise.resolve({ data: null }),
    w.statusId != null
      ? supabase.from('OeuvreStatus').select('label').eq('id', w.statusId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    id: w.OeuvreID,
    title: w.Titre,
    year: w.Année ? String(w.Année).slice(0, 4) : null,
    technique: (tech.data as { Technique: string | null } | null)?.Technique ?? null,
    status: (status.data as { label: string | null } | null)?.label ?? null,
    image: w.txtImageNameLink,
  }
}
