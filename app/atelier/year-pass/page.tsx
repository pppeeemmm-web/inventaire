// Year pass (week-1 report §3.1; Pem « go year pass », 2026-11-28): works with no year, one at a time, on the phone.
// Order: the Therapeia / Paréidolie selection first (docs/agent/selections/2027_therapeia-pareidolie.md), then the
// drawings by technique, then every other work. One page of 20 (principle 5); « n sans année » is asked of the
// database (principle 7). Skipped works (« Je ne sais pas ») ride in `?skip=` so the next page moves on. Admin only.

import { createClient } from '@/lib/supabase/server'
import { YearPassClient, type YearPassWork } from '@/components/atelier/year-pass/YearPassClient'

export const dynamic = 'force-dynamic'

/** The selection's works still without a year (2026-11-27 proposal, Pem chooses). */
const SELECTION = [1493, 1846, 1870, 1862, 1416, 1844, 1840, 1492, 1501, 1308, 1868]
/** Drawing techniques, the dossiers' strongest card (report §2.1). The page lists them by technique id, then work id. */
const DRAWING = ['Crayons', 'Encre noire', 'Graphite', 'Pastel', 'Pierre noire', 'Feutre', 'Scratchboard', 'Marker', 'Sanguine', 'Encre couleur', 'Lavis brun', 'Fusain liquide']
const PAGE = 20

type Row = { OeuvreID: number; Titre: string | null; Hauteur: string | null; Largeur: string | null; txtImageNameLink: string | null; Technique: number | null; Support: number | null }

export default async function YearPassPage({ searchParams }: { searchParams: Promise<{ skip?: string }> }) {
  const { skip: skipRaw } = await searchParams
  const skip = (skipRaw ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500)
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return <YearPassClient works={[]} remaining={0} skipped={skip} adminOnly />

  const cols = 'OeuvreID, Titre, Hauteur, Largeur, txtImageNameLink, Technique, Support'
  const base = () => {
    let q = supabase.from('Oeuvres').select(cols).is('Année', null).is('deleted_at', null)
    if (skip.length) q = q.not('OeuvreID', 'in', `(${skip.join(',')})`)
    return q
  }
  const [{ data: techs }, { data: sups }, { count }] = await Promise.all([
    supabase.from('Technique').select('TechniqueID, Technique'),
    supabase.from('Support').select('SupportID, Support'),
    supabase.from('Oeuvres').select('OeuvreID', { count: 'exact', head: true }).is('Année', null).is('deleted_at', null),
  ])
  const techName = new Map((techs ?? []).map((t) => [t.TechniqueID as number, (t.Technique as string | null) ?? '']))
  const drawingIds = (techs ?? []).filter((t) => DRAWING.includes(String(t.Technique))).map((t) => t.TechniqueID as number)

  const rows: Row[] = []
  const take = async (q: ReturnType<typeof base>) => {
    if (rows.length >= PAGE) return
    const { data } = await q.limit(PAGE - rows.length)
    for (const r of (data ?? []) as Row[]) if (!rows.some((x) => x.OeuvreID === r.OeuvreID)) rows.push(r)
  }
  await take(base().in('OeuvreID', SELECTION))
  if (drawingIds.length) await take(base().in('Technique', drawingIds).order('Technique').order('OeuvreID'))
  await take(base().order('OeuvreID'))

  // Hint: the years already known in the same themes (« la série : 2019–2024 »).
  const ids = rows.map((r) => r.OeuvreID)
  const { data: links } = ids.length ? await supabase.from('oeuvre_theme').select('oeuvre_id, theme_id').in('oeuvre_id', ids) : { data: [] }
  const themeIds = [...new Set((links ?? []).map((l) => l.theme_id as number))]
  const [{ data: themes }, { data: members }] = await Promise.all([
    themeIds.length ? supabase.from('theme').select('id, name').in('id', themeIds) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    themeIds.length ? supabase.from('oeuvre_theme').select('oeuvre_id, theme_id').in('theme_id', themeIds).limit(5000) : Promise.resolve({ data: [] as { oeuvre_id: number; theme_id: number }[] }),
  ])
  const memberIds = [...new Set((members ?? []).map((m) => m.oeuvre_id as number))]
  const yearOfWork = new Map<number, number>()
  for (let k = 0; k < memberIds.length; k += 500) {
    const { data: ys } = await supabase.from('Oeuvres').select('OeuvreID, "Année"').in('OeuvreID', memberIds.slice(k, k + 500)).not('Année', 'is', null).is('deleted_at', null)
    for (const y of ys ?? []) {
      const n = Number(String((y as { Année: string | null }).Année ?? '').slice(0, 4))
      if (n) yearOfWork.set(y.OeuvreID as number, n)
    }
  }
  const range = new Map<number, { min: number; max: number; n: number }>()
  for (const m of members ?? []) {
    const y = yearOfWork.get(m.oeuvre_id as number)
    if (!y) continue
    const r = range.get(m.theme_id as number) ?? { min: y, max: y, n: 0 }
    range.set(m.theme_id as number, { min: Math.min(r.min, y), max: Math.max(r.max, y), n: r.n + 1 })
  }
  const themeName = new Map((themes ?? []).map((t) => [t.id as number, String(t.name ?? '')]))
  const supName = (id: number | null) => String((sups ?? []).find((x) => x.SupportID === id)?.Support ?? '')

  const works: YearPassWork[] = rows.map((r) => ({
    id: r.OeuvreID,
    title: r.Titre?.trim() || null,
    image: r.txtImageNameLink,
    technique: r.Technique != null ? techName.get(r.Technique) ?? '' : '',
    support: supName(r.Support),
    size: r.Hauteur && r.Largeur ? `${r.Hauteur} × ${r.Largeur} cm` : '',
    inSelection: SELECTION.includes(r.OeuvreID),
    themes: (links ?? [])
      .filter((l) => l.oeuvre_id === r.OeuvreID)
      .map((l) => ({ name: themeName.get(l.theme_id as number) ?? '', ...(range.get(l.theme_id as number) ?? { min: 0, max: 0, n: 0 }) }))
      .filter((x) => x.name),
  }))

  // A new page of 20 starts a fresh screen (position, count and « Précédente » belong to one page).
  return <YearPassClient key={works.map((w) => w.id).join(',')} works={works} remaining={count ?? 0} skipped={skip} />
}
