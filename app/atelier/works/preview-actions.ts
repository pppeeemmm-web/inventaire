'use server'

// Work previews (`WorkRef`, `WorkChip`): the few fields a thumbnail + caption shows. Team only (RLS + check).
// R4 (Pem 2026-11-17): « a work number never travels alone » — lists ask for all their numbers in one call
// (`fetchWorkPreviews`), not one call per number.

import { createClient } from '@/lib/supabase/server'

export type WorkPreview = {
  id: number
  title: string | null
  year: string | null
  technique: string | null
  status: string | null
  image: string | null
  /** « 70 × 70 » (cm), when both are known. */
  size: string | null
}

const MAX_IDS = 500
const COLS = 'OeuvreID, Titre, "Année", Technique, statusId, txtImageNameLink, Hauteur, Largeur'

type Row = {
  OeuvreID: number
  Titre: string | null
  Année: string | null
  Technique: number | null
  statusId: number | null
  txtImageNameLink: string | null
  Hauteur: string | null
  Largeur: string | null
}

const dim = (v: string | null) => {
  const n = v == null ? NaN : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? String(Math.round(n * 10) / 10) : null
}

export async function fetchWorkPreviews(ids: number[]): Promise<WorkPreview[]> {
  const clean = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, MAX_IDS)
  if (!clean.length) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('Oeuvres').select(COLS as 'OeuvreID').in('OeuvreID', clean)
  const rows = (data ?? []) as unknown as Row[]
  const techIds = [...new Set(rows.map((r) => r.Technique).filter((v): v is number => v != null))]
  const statusIds = [...new Set(rows.map((r) => r.statusId).filter((v): v is number => v != null))]
  const [tech, status] = await Promise.all([
    techIds.length ? supabase.from('Technique').select('TechniqueID, Technique').in('TechniqueID', techIds) : Promise.resolve({ data: [] }),
    statusIds.length ? supabase.from('OeuvreStatus').select('id, label').in('id', statusIds) : Promise.resolve({ data: [] }),
  ])
  const techName = new Map(((tech.data ?? []) as { TechniqueID: number; Technique: string | null }[]).map((t) => [t.TechniqueID, t.Technique]))
  const statusName = new Map(((status.data ?? []) as { id: number; label: string | null }[]).map((s) => [s.id, s.label]))
  return rows.map((w) => {
    const h = dim(w.Hauteur)
    const l = dim(w.Largeur)
    return {
      id: w.OeuvreID,
      title: w.Titre?.trim() || null,
      year: w.Année ? String(w.Année).slice(0, 4) : null,
      technique: w.Technique != null ? (techName.get(w.Technique) ?? null) : null,
      status: w.statusId != null ? (statusName.get(w.statusId) ?? null) : null,
      image: w.txtImageNameLink,
      size: h && l ? `${h} × ${l}` : null,
    }
  })
}

export async function fetchWorkPreview(id: number): Promise<WorkPreview | null> {
  return (await fetchWorkPreviews([id]))[0] ?? null
}
