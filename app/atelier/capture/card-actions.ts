'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logSystemEvent } from '@/lib/utils/logging'

function parseCard(text: string): { name: string; email: string | null; phone: string | null; org: string | null } {
  const email = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i)?.[0] ?? null
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? null
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const name = lines[0]?.slice(0, 120) || 'Contact (carte)'
  const org = lines.find((l) => l.length > 3 && l !== name && !l.includes('@'))?.slice(0, 120) ?? null
  return { name, email, phone, org }
}

export async function ingestBusinessCardText(
  raw: string,
): Promise<{ ok: true; href: string; contactId: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' }

  const parsed = parseCard(raw.slice(0, 8000))
  const notes = [raw.trim(), parsed.org ? `Org: ${parsed.org}` : '', parsed.phone ? `Tel: ${parsed.phone}` : '']
    .filter(Boolean)
    .join('\n')

  const { data: row, error } = await (supabase.from('Contact') as any)
    .insert({
      Nom: parsed.name,
      Email: parsed.email,
      Notes: notes.slice(0, 12_000),
      Role: 'other',
    })
    .select('ContactID')
    .single()

  if (error || !row) return { error: error?.message ?? 'insert' }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'Contact',
    rowId: row.ContactID,
    metadata: { source: 'capture_card' },
  })

  revalidatePath('/atelier')
  return { ok: true, href: `/atelier?tab=contacts&contact=${row.ContactID}`, contactId: row.ContactID as number }
}

export async function ingestFromUrl(url: string): Promise<{ ok: true; href: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' }

  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return { error: 'invalid_url' }
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'invalid_url' }

  const res = await fetch(parsed.toString(), { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) return { error: `fetch_${res.status}` }
  const html = (await res.text()).slice(0, 200_000)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? parsed.hostname
  const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]
  const mail = html.match(/mailto:([^"'>\s]+)/i)?.[1]

  const { data: row, error } = await (supabase.from('Contact') as any)
    .insert({
      Nom: (ogTitle || title).slice(0, 120),
      Email: mail ?? null,
      Notes: `URL: ${parsed.toString()}`.slice(0, 12_000),
      Role: 'other',
    })
    .select('ContactID')
    .single()
  if (error || !row) return { error: error?.message ?? 'insert' }

  revalidatePath('/atelier')
  return { ok: true, href: `/atelier?tab=contacts&contact=${row.ContactID}` }
}
