'use server'

// Kaizen — ideas and improvements (owner 2026-11-02). Sections: Création, Site web, Business;
// NULL section = migrated entry waiting for the owner to confirm its suggested section.
// Entries are ticked done / reopened, never deleted (no DELETE grant or policy).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseKaizenSection as parseSection, type KaizenItem } from '@/lib/kaizen'

export type KaizenErr = { error: string }

const MAX_TITLE = 300
const MAX_BODY = 20_000

/** Works mentioned as `#1234` in the text, kept only when the work exists. */
async function worksMentioned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  text: string,
): Promise<number[]> {
  const ids = [...new Set([...text.matchAll(/#\s?(\d{1,5})/g)].map((m) => Number(m[1])))]
  if (!ids.length) return []
  const { data } = await supabase.from('Oeuvres').select('OeuvreID').in('OeuvreID', ids)
  return (data ?? []).map((r) => r.OeuvreID).sort((a, b) => a - b)
}

export async function listKaizen(): Promise<
  | { items: KaizenItem[]; names: Record<string, string>; me: string; isAdmin: boolean }
  | KaizenErr
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const [itemsRes, adminRes] = await Promise.all([
    supabase.from('kaizen_item').select('*').order('created_at', { ascending: false }).limit(2000),
    supabase.rpc('is_admin'),
  ])
  if (itemsRes.error) return { error: itemsRes.error.message }
  const items = (itemsRes.data ?? []) as KaizenItem[]

  const authorIds = [...new Set(items.flatMap((i) => [i.author_id, i.done_by]).filter((x): x is string => !!x))]
  const names: Record<string, string> = {}
  if (authorIds.length) {
    // `select('*')`: the typed select parser rejects the accented `Prénom` column name.
    const { data } = await supabase.from('Contact').select('*').in('auth_user_id', authorIds)
    for (const c of (data ?? []) as { auth_user_id: string | null; Prénom: string | null; Nom: string | null }[]) {
      if (!c.auth_user_id) continue
      names[c.auth_user_id] = [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—'
    }
  }
  return { items, names, me: user.id, isAdmin: adminRes.data === true }
}

export async function createKaizen(input: {
  title: string
  body: string
  section: string
}): Promise<{ ok: true; item: KaizenItem } | KaizenErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const title = input.title.trim().slice(0, MAX_TITLE)
  if (!title) return { error: 'empty' }
  const body = input.body.trim().slice(0, MAX_BODY) || null
  const section = parseSection(input.section) ?? 'creation'
  const work_ids = await worksMentioned(supabase, `${title} ${body ?? ''}`)

  const { data, error } = await supabase
    .from('kaizen_item')
    .insert({ author_id: user.id, title, body, section, work_ids })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'insert' }
  revalidatePath('/atelier')
  return { ok: true, item: data as KaizenItem }
}

export async function updateKaizen(
  id: number,
  patch: { title?: string; body?: string; section?: string },
): Promise<{ ok: true; item: KaizenItem } | KaizenErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) {
    const title = patch.title.trim().slice(0, MAX_TITLE)
    if (!title) return { error: 'empty' }
    update.title = title
  }
  if (patch.body !== undefined) update.body = patch.body.trim().slice(0, MAX_BODY) || null
  if (patch.section !== undefined) {
    const section = parseSection(patch.section)
    if (!section) return { error: 'section' }
    update.section = section
  }
  if (update.title !== undefined || update.body !== undefined) {
    const { data: cur } = await supabase.from('kaizen_item').select('title, body').eq('id', id).maybeSingle()
    const title = (update.title as string | undefined) ?? cur?.title ?? ''
    const body = (update.body as string | null | undefined) ?? cur?.body ?? ''
    update.work_ids = await worksMentioned(supabase, `${title} ${body ?? ''}`)
  }

  const { data, error } = await supabase.from('kaizen_item').update(update).eq('id', id).select('*').maybeSingle()
  if (error) return { error: error.message }
  // RLS hides the row from the update when the user is neither its author nor admin.
  if (!data) return { error: 'forbidden' }
  revalidatePath('/atelier')
  return { ok: true, item: data as KaizenItem }
}

export async function setKaizenDone(id: number, done: boolean): Promise<{ ok: true; item: KaizenItem } | KaizenErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const { data, error } = await supabase
    .from('kaizen_item')
    .update(done ? { done_at: new Date().toISOString(), done_by: user.id } : { done_at: null, done_by: null })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'forbidden' }
  revalidatePath('/atelier')
  return { ok: true, item: data as KaizenItem }
}

/** Owner confirms the sections of migrated entries (one or many). */
export async function confirmKaizenSections(
  rows: { id: number; section: string }[],
): Promise<{ ok: true; items: KaizenItem[] } | KaizenErr> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'forbidden' }

  const items: KaizenItem[] = []
  for (const r of rows) {
    const section = parseSection(r.section)
    if (!section) return { error: 'section' }
    const { data, error } = await supabase
      .from('kaizen_item')
      .update({ section })
      .eq('id', r.id)
      .select('*')
      .maybeSingle()
    if (error) return { error: error.message }
    if (data) items.push(data as KaizenItem)
  }
  revalidatePath('/atelier')
  return { ok: true, items }
}
