'use server'

// « Dans le Journal » on a contact card: the Journal entries that name this person with `@`
// (journal_entry_link.contact_id, supabase/sql/journal_step_b2.sql). Read only, team only.
// The column is not in the generated types (and not live before the SQL runs): read through a loose cast;
// before the SQL is live the link read errors and the answer is an empty list.

import { createClient } from '@/lib/supabase/server'

export type ContactJournalMention = { entryId: number; day: string; snippet: string; photoKey: string | null }

type Loose = { from: (t: string) => any }

function snippetOf(body: string): string {
  const s = body.replace(/\s+/g, ' ').trim()
  return s.length > 120 ? `${s.slice(0, 119).trimEnd()}…` : s
}

export async function readContactJournalMentions(
  contactId: number,
): Promise<{ ok: true; items: ContactJournalMention[] } | { error: string }> {
  if (!Number.isInteger(contactId) || contactId <= 0) return { error: 'not_found' }
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'auth' }
  const loose = supabase as unknown as Loose

  const { data: links, error: linkErr } = await loose
    .from('journal_entry_link')
    .select('entry_id, created_at')
    .eq('contact_id', contactId)
    .not('validated_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (linkErr) return { ok: true, items: [] }
  const entryIds: number[] = Array.from(new Set<number>((links ?? []).map((l: { entry_id: number }) => Number(l.entry_id))))
  if (!entryIds.length) return { ok: true, items: [] }

  const { data: entries, error: entErr } = await loose
    .from('journal_entry')
    .select('id, event_on, body, photo_id, hidden_at')
    .in('id', entryIds)
  if (entErr) return { error: entErr.message }

  const { data: fixes, error: fixErr } = await loose
    .from('journal_entry')
    .select('id, corrects_id, body, created_at')
    .in('corrects_id', entryIds)
    .is('hidden_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (fixErr) return { error: fixErr.message }
  const latestFix = new Map<number, string>()
  for (const f of (fixes ?? []) as Array<{ corrects_id: number; body: string }>) {
    const k = Number(f.corrects_id)
    if (!latestFix.has(k)) latestFix.set(k, f.body)
  }

  type Entry = { id: number; event_on: string; body: string | null; photo_id: string | null; hidden_at: string | null }
  const visible = ((entries ?? []) as Entry[]).filter((e) => !e.hidden_at)
  const photoIds = Array.from(new Set(visible.map((e) => e.photo_id).filter((p): p is string => !!p)))
  const photoKey = new Map<string, string>()
  if (photoIds.length) {
    const { data: photos, error: phErr } = await loose
      .from('inspiration_photo')
      .select('id, image_key, hidden_at')
      .in('id', photoIds)
    if (phErr) return { error: phErr.message }
    for (const p of (photos ?? []) as Array<{ id: string; image_key: string | null; hidden_at: string | null }>) {
      if (!p.hidden_at && p.image_key) photoKey.set(p.id, p.image_key)
    }
  }

  const byId = new Map(visible.map((e) => [Number(e.id), e]))
  const items: ContactJournalMention[] = []
  for (const id of entryIds) {
    const e = byId.get(id)
    if (!e) continue
    items.push({
      entryId: id,
      day: String(e.event_on).slice(0, 10),
      snippet: snippetOf(latestFix.get(id) ?? e.body ?? ''),
      photoKey: e.photo_id ? (photoKey.get(e.photo_id) ?? null) : null,
    })
  }
  return { ok: true, items }
}
