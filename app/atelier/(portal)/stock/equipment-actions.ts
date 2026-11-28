'use server'

// Studio equipment (docs/design/2026-11-28/Equipment.md steps 3–4): the studio tree with what sits where, the
// one Stock door (`save_stock_item`, equipment.sql), places added to the tree.
// Every export checks the team first (principle 4); writes go through the door or the RLS-guarded place table.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter'

/** Error codes the view turns into copy (`eq_err_*`); raw database text is logged, never shown. */
type Err = { error: 'auth' | 'forbidden' | 'bad_field' | 'not_found' | 'db' }
// equipment.sql columns are not in the generated types until `gen:types` runs.
type Loose = SupabaseClient<any, any, any>

const STUDIO_KINDS = ['studio', 'zone', 'furniture', 'container'] as const
export type StudioKind = (typeof STUDIO_KINDS)[number]
export type EquipmentCondition = 'bon' | 'a_reparer' | 'hors_service' | 'prete'

export type StudioPlace = { id: number; name: string; kind: StudioKind; parent_id: number | null; code: string | null }
export type EquipmentItem = {
  id: number; name: string; category: string | null; quantity: number; unit: string; place_id: number | null
  condition: EquipmentCondition | null; acquired_on: string | null; acquired_precision: string | null; notes: string | null
  updated_at: string
}

async function guardTeam(): Promise<{ sb: Loose } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' }
  return { sb: supabase as unknown as Loose }
}

function dbError(where: string, e: unknown): Err {
  void logError(`equipment: ${where}`, e)
  return { error: 'db' }
}

/**
 * The studio tree only: places whose chain of parents reaches a `studio` place. A contact's floor is also a
 * `zone` (save_contact_places) but hangs under an address, so it is left out.
 */
async function studioTree(sb: Loose): Promise<StudioPlace[] | Err> {
  const { data, error } = await sb.from('place').select('id, name, kind, parent_id, code')
    .in('kind', STUDIO_KINDS).is('archived_at', null).order('name')
  if (error) return dbError('place list', error)
  const all = (data ?? []) as StudioPlace[]
  const byId = new Map(all.map((p) => [p.id, p]))
  const inStudio = (p: StudioPlace): boolean => {
    for (let n: StudioPlace | undefined = p, hops = 0; n && hops < 20; n = n.parent_id != null ? byId.get(n.parent_id) : undefined, hops++) {
      if (n.kind === 'studio') return true
    }
    return false
  }
  return all.filter(inStudio)
}

/** The studio tree and every Stock line that is placed or filed under « Équipement » (equipment is a few hundred lines at most). */
export async function listEquipment(): Promise<{ places: StudioPlace[]; items: EquipmentItem[] } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const [places, i] = await Promise.all([
    studioTree(g.sb),
    g.sb.from('stock_item')
      .select('id, name, category, quantity, unit, place_id, condition, acquired_on, acquired_precision, notes, updated_at')
      .or('place_id.not.is.null,category.eq.Équipement').order('name').limit(1000),
  ])
  if ('error' in places) return places
  if (i.error) return dbError('stock list', i.error)
  return { places, items: (i.data ?? []) as EquipmentItem[] }
}

/** A zone, a piece of furniture or a box under a place of the studio tree. */
export async function addStudioPlace(name: string, kind: StudioKind, parentId: number): Promise<{ ok: true; place: StudioPlace } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const clean = typeof name === 'string' ? name.trim().slice(0, 120) : ''
  if (!clean || !STUDIO_KINDS.includes(kind) || kind === 'studio') return { error: 'bad_field' }
  const tree = await studioTree(g.sb)
  if ('error' in tree) return tree
  if (!tree.some((p) => p.id === parentId)) return { error: 'not_found' }
  const { data, error } = await g.sb.from('place').insert({ name: clean, kind, parent_id: parentId })
    .select('id, name, kind, parent_id, code').single()
  if (error) return dbError('place insert', error)
  return { ok: true, place: data as StudioPlace }
}

export type SaveStockItemResult =
  | { ok: true; item: EquipmentItem; created?: boolean }
  | { unchanged: true; item: EquipmentItem }
  | { refused: string; detail?: string; item?: EquipmentItem }
  | Err

/** The one Stock door (`save_stock_item`): create (no id) or update; `readUpdatedAt` refuses a stale save. */
export async function saveStockItem(input: {
  id?: number | null
  readUpdatedAt?: string | null
  fields: Partial<Omit<EquipmentItem, 'id' | 'updated_at'>> & { supplier_id?: number | null; min_stock?: number; cost_unit?: number | null; photo_key?: string | null }
}): Promise<SaveStockItemResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const f = input.fields ?? {}
  if ('name' in f && (typeof f.name !== 'string' || !f.name.trim() || f.name.trim().length > 120)) return { refused: 'bad_field', detail: 'name' }
  if ('quantity' in f && !(Number.isFinite(f.quantity) && Number(f.quantity) >= 0)) return { refused: 'bad_field', detail: 'quantity' }
  if ('min_stock' in f && !(Number.isFinite(f.min_stock) && Number(f.min_stock) >= 0)) return { refused: 'bad_field', detail: 'min_stock' }
  const fields = 'name' in f ? { ...f, name: String(f.name).trim() } : f
  const { data, error } = await g.sb.rpc('save_stock_item', {
    p: { id: input.id ?? null, ...(input.readUpdatedAt ? { read_updated_at: input.readUpdatedAt } : {}), fields },
  })
  if (error) return dbError('save_stock_item', error)
  const r = (data ?? {}) as { ok?: boolean; unchanged?: boolean; refused?: string; detail?: string; created?: boolean; row?: EquipmentItem }
  if (r.refused) return { refused: r.refused, ...(r.detail ? { detail: r.detail } : {}), ...(r.row ? { item: r.row } : {}) }
  if (r.unchanged && r.row) return { unchanged: true, item: r.row }
  if (r.ok && r.row) return { ok: true, item: r.row, ...(r.created ? { created: true } : {}) }
  return dbError('save_stock_item: unexpected reply', data)
}
