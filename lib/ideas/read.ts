import 'server-only'

// Idées — the reads (design docs/design/2026-11-23/IdeasDesign.md). Served by GET /api/ideas (reads must not
// queue behind saves, BuildingPrinciples 6). The list comes from the database function `idea_list` (counts asked
// of the database, commandment 7); one idea's desk reads its moments through the Journal's own day read, so a
// moment shows exactly as on its day (corrections, labels, suites, works).

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { readJournalDays } from '@/lib/journal/day-read'
import type { JournalDayEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import type { ConceptDocument } from '@/app/atelier/(portal)/concepts/document-actions'
import { isLabRole, type LabDesk } from '@/lib/lab'
import type { SupabaseClient } from '@supabase/supabase-js'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const IDEA_STAGES = ['graine', 'pousse', 'mure'] as const
export type IdeaStage = (typeof IDEA_STAGES)[number]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type IdeaListRow = {
  id: string
  title: string
  stage: IdeaStage
  parentId: string | null
  parentTitle: string | null
  mine: boolean
  author: string | null
  becameWork: number | null
  moments: number
  days: number
  works: number
  documents: number
  branches: number
  lastAt: string
}

export type IdeaHistory = { id: number; what: 'planted' | 'stage' | 'title' | 'text' | 'parent'; from: string | null; to: string | null; at: string; by: string | null }

/** A moment; a photo's text is one too (`photo` set: the idea page draws the image above the caption). */
export type IdeaMoment = JournalDayEntry & { photo?: { id: string; image_key: string; caption: string | null } }

export type IdeaDesk = {
  idea: IdeaListRow & { text: string; oldNotes: string | null; createdAt: string; canMoveStage: boolean; canDelete: boolean; becameProject: boolean; sketch: string | null }
  /** Moments, newest first (each also lives on its day). */
  moments: IdeaMoment[]
  history: IdeaHistory[]
  documents: ConceptDocument[]
  works: Array<{ id: number; title: string | null; thumb: string | null; mentions: number }>
  branches: IdeaListRow[]
  /** Ideas named in this idea's moments, or whose moments name it. */
  linked: Array<{ id: string; title: string; stage: IdeaStage; day: string }>
  /** The tree path from the trunk to this idea's parent. */
  path: Array<{ id: string; title: string }>
  isAdmin: boolean
  /** Laboratoire part (lab_role set): its ordered children, and a recipe's lines / steps / grid of limits. */
  lab: LabDesk | null
}

type Ctx = { supabase: Supabase; userId: string; isAdmin: boolean }

async function ctx(): Promise<Ctx | { error: string }> {
  const supabase = await createClient()
  const [{ data: { user } }, { data: isAdmin }] = await Promise.all([supabase.auth.getUser(), supabase.rpc('is_admin')])
  if (!user) return { error: 'auth' }
  return { supabase, userId: user.id, isAdmin: isAdmin === true }
}

async function namesOf(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!ids.length) return out
  const { data } = await supabase.from('Contact').select('*').in('auth_user_id', ids)
  for (const c of (data ?? []) as Array<{ auth_user_id: string | null; Prénom: string | null; Nom: string | null }>) {
    if (c.auth_user_id) out.set(c.auth_user_id, [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—')
  }
  return out
}

function asStage(v: unknown): IdeaStage {
  return IDEA_STAGES.includes(v as IdeaStage) ? (v as IdeaStage) : 'graine'
}

type RawListRow = {
  id: string; titre: string | null; maturity: string; parent_id: string | null; created_by: string | null; oeuvre_id: number | null
  created_at: string; moments: number; days: number; works: number; documents: number; branches: number; last_at: string
}

async function listRows(c: Ctx, stage: IdeaStage | null, limit: number, offset: number): Promise<IdeaListRow[] | { error: string }> {
  const { data, error } = await c.supabase.rpc('idea_list', { p_stage: stage ?? undefined, p_limit: limit, p_offset: offset })
  if (error) {
    await logError('idea_list failed', error, { source: 'ideas.read' })
    return { error: 'read' }
  }
  const rows = (data ?? []) as RawListRow[]
  const parentIds = [...new Set(rows.map((r) => r.parent_id).filter((x): x is string => !!x))]
  const [names, parents] = await Promise.all([
    namesOf(c.supabase, [...new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x))]),
    parentIds.length ? c.supabase.from('concept').select('id, titre').in('id', parentIds) : Promise.resolve({ data: [] as Array<{ id: string; titre: string | null }> }),
  ])
  const parentTitle = new Map((parents.data ?? []).map((p) => [p.id, p.titre ?? '—']))
  return rows.map((r) => ({
    id: r.id,
    title: r.titre?.trim() || '—',
    stage: asStage(r.maturity),
    parentId: r.parent_id,
    parentTitle: r.parent_id ? parentTitle.get(r.parent_id) ?? null : null,
    mine: r.created_by === c.userId,
    author: r.created_by ? names.get(r.created_by) ?? null : null,
    becameWork: r.oeuvre_id,
    moments: r.moments,
    days: r.days,
    works: r.works,
    documents: r.documents,
    branches: r.branches,
    lastAt: r.last_at,
  }))
}

/** Ideas by last moment, newest first (one page). */
export async function readIdeaList(stage: IdeaStage | null, offset = 0, limit = 60): Promise<{ rows: IdeaListRow[]; more: boolean } | { error: string }> {
  const c = await ctx()
  if ('error' in c) return c
  const rows = await listRows(c, stage, limit + 1, Math.max(0, offset))
  if ('error' in rows) return rows
  return { rows: rows.slice(0, limit), more: rows.length > limit }
}

/** One idea's desk: the idea, its moments (newest first), history, documents, works, branches, linked ideas. */
export async function readIdeaDesk(id: string): Promise<IdeaDesk | { error: string }> {
  if (!UUID_RE.test(id)) return { error: 'id' }
  const c = await ctx()
  if ('error' in c) return c
  const { supabase } = c

  const { data: row, error } = await supabase
    .from('concept')
    .select('id, titre, description, notes, maturity, parent_id, created_by, oeuvre_id, created_at, statut, image_note')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    await logError('idea read failed', error, { source: 'ideas.read', metadata: { id } })
    return { error: 'read' }
  }
  if (!row) return { error: 'not_found' }

  const [linksRes, historyRes, docsRes, branchRes] = await Promise.all([
    supabase.from('journal_entry_link').select('entry_id').eq('concept_id', id).not('validated_at', 'is', null).is('rejected_at', null).limit(1000),
    supabase.from('concept_change').select('id, what, from_value, to_value, changed_at, changed_by').eq('concept_id', id).order('changed_at', { ascending: false }).limit(200),
    supabase.from('document').select('id, concept_id, name, kind, source, storage_path, external_url, local_location, file_size, mime_type, notes, created_at').eq('concept_id', id).order('created_at', { ascending: false }).limit(200),
    supabase.from('concept').select('id').eq('parent_id', id).limit(500),
  ])

  // The moments: the linked entries, read through the Journal's day read (one read per run of their days).
  // Plus the Journal entries of voice notes routed to the idea before the tree (voice_note.concept_id).
  const { data: notes } = await supabase.from('voice_note').select('id').eq('concept_id', id).limit(500)
  const carriers = notes?.length
    ? ((await supabase.from('journal_entry').select('id').in('voice_note_id', notes.map((n) => n.id)).is('corrects_id', null)).data ?? [])
    : []
  const entryIds = [...new Set([...(linksRes.data ?? []).map((l) => l.entry_id as number), ...carriers.map((c) => c.id as number)])]
  const moments: IdeaMoment[] = []
  if (entryIds.length) {
    const { data: days } = await supabase.from('journal_entry').select('id, event_on').in('id', entryIds).is('corrects_id', null)
    const byDay = [...new Set((days ?? []).map((d) => d.event_on as string))].sort()
    const wanted = new Set(entryIds)
    // Runs of consecutive days read together (most ideas hold few days).
    let i = 0
    while (i < byDay.length) {
      const from = byDay[i]
      let to = from
      while (i + 1 < byDay.length && dayDiff(to, byDay[i + 1]) <= 3) to = byDay[++i]
      i++
      const res = await readJournalDays(supabase, { userId: c.userId, isAdmin: c.isAdmin }, from, to, { folds: false, ideas: false })
      if ('error' in res) continue
      for (const extras of res.values()) {
        for (const e of extras.entries) if (wanted.has(e.id)) moments.push(e)
        // A photo's text is an entry too (journal_entry.photo_id): the day read puts it on the photo, not in `entries`.
        for (const p of extras.inspirations) {
          if (p.hidden || !p.concepts?.some((x) => x.id === id) || moments.some((m) => m.photo?.id === p.id)) continue
          moments.push({
            id: p.entryId ?? 0,
            created_at: p.created_at,
            event_on: p.day,
            event_precision: 'day',
            kind: 'note',
            body: p.caption ?? '',
            provenance: 'photo',
            verification: 'verified',
            visibility: 'team',
            original: null,
            author: p.author,
            mine: false,
            hidden: false,
            voiceNoteId: null,
            audioKey: null,
            engine: null,
            voiceLinks: null,
            works: p.works ?? [],
            concepts: p.concepts ?? [],
            people: p.people,
            proposals: [],
            photo: { id: p.id, image_key: p.image_key, caption: p.caption },
          })
        }
      }
    }
    moments.sort((a, b) => (a.event_on === b.event_on ? b.created_at.localeCompare(a.created_at) : b.event_on.localeCompare(a.event_on)))
  }

  // Works named in its moments (+ the work it became).
  const workCount = new Map<number, { title: string | null; thumb: string | null; n: number }>()
  for (const m of moments) for (const w of m.works) {
    const cur = workCount.get(w.id)
    workCount.set(w.id, { title: w.title, thumb: w.thumb ?? null, n: (cur?.n ?? 0) + 1 })
  }
  if (row.oeuvre_id != null && !workCount.has(row.oeuvre_id)) {
    const { data: w } = await supabase.from('Oeuvres').select('OeuvreID, Titre').eq('OeuvreID', row.oeuvre_id).maybeSingle()
    workCount.set(row.oeuvre_id, { title: (w as { Titre?: string | null } | null)?.Titre ?? null, thumb: null, n: 0 })
  }

  // Linked ideas: other ideas on the same moments.
  const linked: IdeaDesk['linked'] = []
  if (entryIds.length) {
    const { data: other } = await supabase
      .from('journal_entry_link')
      .select('entry_id, concept_id')
      .in('entry_id', entryIds)
      .not('concept_id', 'is', null)
      .neq('concept_id', id)
      .not('validated_at', 'is', null)
      .is('rejected_at', null)
      .limit(500)
    const dayOf = new Map(moments.map((m) => [m.id, m.event_on]))
    const firstDay = new Map<string, string>()
    for (const l of other ?? []) {
      const d = dayOf.get(l.entry_id as number) ?? ''
      const k = l.concept_id as string
      if (!firstDay.has(k) || d > (firstDay.get(k) ?? '')) firstDay.set(k, d)
    }
    if (firstDay.size) {
      const { data: ideas } = await supabase.from('concept').select('id, titre, maturity').in('id', [...firstDay.keys()])
      for (const x of ideas ?? []) linked.push({ id: x.id, title: x.titre?.trim() || '—', stage: asStage(x.maturity), day: firstDay.get(x.id) ?? '' })
    }
  }

  // Branches (with their counts) and the path to the trunk.
  const branchIds = new Set((branchRes.data ?? []).map((b) => b.id as string))
  let branches: IdeaListRow[] = []
  let self: IdeaListRow | undefined
  const all = await listRows(c, null, 200, 0)
  if (!('error' in all)) {
    branches = all.filter((r) => branchIds.has(r.id))
    self = all.find((r) => r.id === id)
  }
  const path: IdeaDesk['path'] = []
  let up = row.parent_id as string | null
  for (let n = 0; up && n < 30; n++) {
    const { data: p } = await supabase.from('concept').select('id, titre, parent_id').eq('id', up).maybeSingle()
    if (!p) break
    path.unshift({ id: p.id, title: p.titre?.trim() || '—' })
    up = p.parent_id as string | null
  }

  const names = await namesOf(supabase, [...new Set([row.created_by, ...(historyRes.data ?? []).map((h) => h.changed_by)].filter((x): x is string => !!x))])
  const base: IdeaListRow = self ?? {
    id, title: row.titre?.trim() || '—', stage: asStage(row.maturity), parentId: row.parent_id, parentTitle: path.at(-1)?.title ?? null,
    mine: row.created_by === c.userId, author: row.created_by ? names.get(row.created_by) ?? null : null, becameWork: row.oeuvre_id,
    moments: moments.length, days: new Set(moments.map((m) => m.event_on)).size, works: workCount.size, documents: (docsRes.data ?? []).length,
    branches: branchIds.size, lastAt: row.created_at,
  }

  return {
    idea: {
      ...base,
      text: row.description ?? '',
      oldNotes: row.notes?.trim() || null,
      createdAt: row.created_at,
      canMoveStage: c.isAdmin || row.created_by === c.userId,
      canDelete: c.isAdmin,
      becameProject: row.statut === 'en_cours',
      sketch: row.image_note?.trim() || null,
    },
    moments,
    history: (historyRes.data ?? []).map((h) => ({
      id: h.id as number,
      what: h.what as IdeaHistory['what'],
      from: h.from_value,
      to: h.to_value,
      at: h.changed_at,
      by: h.changed_by ? names.get(h.changed_by) ?? null : null,
    })),
    documents: ((docsRes.data ?? []) as Array<Record<string, unknown>>).map((d) => ({
      ...(d as unknown as ConceptDocument),
      source: d.source === 'link' || d.source === 'local' ? d.source : 'file',
    })),
    works: [...workCount].map(([wid, w]) => ({ id: wid, title: w.title, thumb: w.thumb, mentions: w.n })),
    branches,
    linked,
    path,
    isAdmin: c.isAdmin,
    lab: await readLab(supabase, id),
  }
}

// laboratoire.sql columns and tables are not in the generated types until `gen:types` runs.
type Loose = SupabaseClient<any, any, any>

/** The Laboratoire part of one idea; null when the idea has no lab_role (an ordinary idea). */
async function readLab(supabase: Supabase, id: string): Promise<LabDesk | null> {
  const sb = supabase as unknown as Loose
  const { data: me } = await sb.from('concept').select('lab_role, lab_version, updated_at').eq('id', id).maybeSingle()
  if (!me || !isLabRole(me.lab_role)) return null
  const isCard = me.lab_role === 'recette' || me.lab_role === 'conjecture'
  const [kids, ing, steps, grid] = await Promise.all([
    sb.from('concept').select('id, titre, lab_role, position, maturity').eq('parent_id', id).not('lab_role', 'is', null).order('position', { ascending: true, nullsFirst: false }).limit(500),
    me.lab_role === 'recette' ? sb.from('recipe_ingredient').select('stock_item_id, label, amount, unit, ratio_pct, note, stock_item(name)').eq('recipe_id', id).order('position') : null,
    me.lab_role === 'recette' ? sb.from('recipe_step').select('body, duration, equipment_stock_item_id, warning, stock_item(name)').eq('recipe_id', id).order('position') : null,
    isCard ? sb.from('lab_assessment').select('criterion, source, sign, score, note, source_ref, journal_entry_id').eq('subject_id', id) : null,
  ])
  for (const r of [kids, ing, steps, grid]) if (r?.error) await logError('lab read failed', r.error, { source: 'ideas.readLab', metadata: { id } })
  const nameOf = (x: unknown) => (x && typeof x === 'object' && 'name' in x ? String((x as { name: unknown }).name ?? '') || null : null)
  return {
    role: me.lab_role,
    version: me.lab_version ?? null,
    updatedAt: me.updated_at,
    children: (kids.data ?? []).filter((k) => isLabRole(k.lab_role)).map((k) => ({ id: k.id, title: k.titre?.trim() || '—', role: k.lab_role, position: k.position ?? null, stage: k.maturity ?? 'graine' })),
    ingredients: (ing?.data ?? []).map((r) => ({ stockItemId: r.stock_item_id ?? null, stockName: nameOf(r.stock_item), label: r.label ?? null, amount: r.amount ?? null, unit: r.unit ?? null, ratioPct: r.ratio_pct ?? null, note: r.note ?? null })),
    steps: (steps?.data ?? []).map((r) => ({ body: r.body, duration: r.duration ?? null, equipmentId: r.equipment_stock_item_id ?? null, equipmentName: nameOf(r.stock_item), warning: r.warning ?? null })),
    assessments: (grid?.data ?? []).map((r) => ({ criterion: r.criterion, source: r.source, sign: r.sign, score: r.score ?? null, note: r.note ?? null, sourceRef: r.source_ref ?? null, journalEntryId: r.journal_entry_id ?? null })),
  }
}

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
}
