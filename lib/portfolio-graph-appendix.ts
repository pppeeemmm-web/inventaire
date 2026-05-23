import { createClient } from '@/lib/supabase/server'
import type { Lang } from '@/lib/i18n/dictionary'
import type { EdgeFactRow } from '@/lib/graph/edge-fact'

export type PortfolioGraphWorkContext = {
  oeuvreId: number
  title: string
  themes: string[]
  workingGroups: string[]
  concepts: string[]
}

const GRAPH_RELATION_TYPES = new Set(['theme', 'workgroup'])

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const label = v.trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out.sort((a, b) => a.localeCompare(b, 'fr'))
}

function applyEdge(
  byOeuvre: Map<number, PortfolioGraphWorkContext>,
  oeuvreId: number,
  title: string,
  edge: EdgeFactRow,
): void {
  const label = (edge.target_label ?? edge.target_pk ?? '').trim()
  if (!label) return

  let row = byOeuvre.get(oeuvreId)
  if (!row) {
    row = { oeuvreId, title, themes: [], workingGroups: [], concepts: [] }
    byOeuvre.set(oeuvreId, row)
  }

  const rel = edge.relation_type ?? ''
  if (rel === 'theme' && edge.target_node_type === 'theme') {
    row.themes.push(label)
  } else if (rel === 'workgroup' && edge.target_node_type === 'working_group') {
    row.workingGroups.push(label)
  } else if (edge.target_node_type === 'concept') {
    row.concepts.push(label)
  } else if (GRAPH_RELATION_TYPES.has(rel)) {
    // Fallback when node_type hydration is missing.
    if (rel === 'theme') row.themes.push(label)
    if (rel === 'workgroup') row.workingGroups.push(label)
  }
}

export async function loadPortfolioGraphContext(
  works: { OeuvreID: number; Titre: string | null }[],
): Promise<PortfolioGraphWorkContext[]> {
  if (works.length === 0) return []

  const ids = works.map((w) => w.OeuvreID)
  const titleById = new Map(works.map((w) => [w.OeuvreID, (w.Titre ?? '').trim() || `#${w.OeuvreID}`]))

  const supabase = await createClient()
  const byOeuvre = new Map<number, PortfolioGraphWorkContext>()
  const chunkSize = 200

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('edge_fact' as 'entity')
      .select(
        'relation_type, source_legacy_int_id, target_node_type, target_label, target_pk',
      )
      .in('source_legacy_int_id', chunk)

    if (error) {
      console.warn('[portfolio-graph-appendix]', error.message)
      continue
    }

    for (const raw of (data ?? []) as EdgeFactRow[]) {
      const oeuvreId = raw.source_legacy_int_id
      if (oeuvreId == null) continue
      const title = titleById.get(oeuvreId) ?? `#${oeuvreId}`
      applyEdge(byOeuvre, oeuvreId, title, raw)
    }
  }

  return works
    .map((w) => {
      const row = byOeuvre.get(w.OeuvreID)
      if (!row) return null
      row.themes = uniqueLabels(row.themes)
      row.workingGroups = uniqueLabels(row.workingGroups)
      row.concepts = uniqueLabels(row.concepts)
      if (row.themes.length === 0 && row.workingGroups.length === 0 && row.concepts.length === 0) {
        return null
      }
      return row
    })
    .filter((r): r is PortfolioGraphWorkContext => r != null)
}

export function formatPortfolioGraphAppendix(
  rows: PortfolioGraphWorkContext[],
  lang: Lang,
): string {
  if (rows.length === 0) return ''

  const labels =
    lang === 'fr'
      ? { themes: 'Thèmes', groups: 'Groupes de travail', concepts: 'Concepts' }
      : { themes: 'Themes', groups: 'Working groups', concepts: 'Concepts' }

  const blocks: string[] = []
  for (const row of rows) {
    const lines: string[] = [row.title]
    if (row.themes.length) lines.push(`  ${labels.themes}: ${row.themes.join(', ')}`)
    if (row.workingGroups.length) lines.push(`  ${labels.groups}: ${row.workingGroups.join(', ')}`)
    if (row.concepts.length) lines.push(`  ${labels.concepts}: ${row.concepts.join(', ')}`)
    blocks.push(lines.join('\n'))
  }

  return blocks.join('\n\n')
}
