'use server'

// « Cette œuvre m'intéresse » / « Écrire à l'atelier » on a collector kit (TODO 11b).
// Not an anon insert like /enquiry: the token is checked with the service role, then ONE `inquiry` row
// (Pem answer 6: several works = one message) lands in the Triage deck tagged with the kit.

import { createServiceClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { KIT_ENQUIRIES_PER_DAY } from '@/lib/collector-kit'
import { readKitLink } from './kit-data'

export type KitEnquiryResult = { ok: true } | { error: 'inactive' | 'limit' | 'empty' | 'failed' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function sendKitEnquiry(input: {
  token: string
  oeuvreIds: number[]
  message: string
  reply: string
}): Promise<KitEnquiryResult> {
  const link = await readKitLink(String(input.token ?? ''))
  if (!link || link === 'inactive') return { error: 'inactive' }

  const message = String(input.message ?? '').trim().slice(0, 4000)
  if (!message) return { error: 'empty' }
  const reply = String(input.reply ?? '').trim().slice(0, 200)

  const sb = createServiceClient()

  // Only works of this kit, in the kit's order.
  const { data: lines }: { data: { oeuvre_id: number; position: number }[] | null } = await sb
    .from('private_link_work').select('oeuvre_id, position').eq('token', link.token).order('position')
  const asked = new Set((input.oeuvreIds ?? []).filter((n) => Number.isInteger(n)))
  const ids = (lines ?? []).map((l) => l.oeuvre_id).filter((id) => asked.has(id))

  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count }: { count: number | null } = await sb
    .from('inquiry').select('id', { count: 'exact', head: true })
    .eq('private_link_token', link.token).gte('created_at', since)
  if ((count ?? 0) >= KIT_ENQUIRIES_PER_DAY) return { error: 'limit' }

  let contactEmail = ''
  if (link.contact_id != null) {
    const { data: c }: { data: { Email: string | null } | null } = await sb.from('Contact').select('Email').eq('ContactID', link.contact_id).maybeSingle()
    contactEmail = c?.Email?.trim() ?? ''
  }
  const replyIsEmail = EMAIL_RE.test(reply)
  const extra: string[] = []
  if (ids.length > 1) extra.push(`#${ids.join(', #')}`)
  if (reply && !replyIsEmail) extra.push(`↩ ${reply}`)

  const { error }: { error: { message: string } | null } = await sb.from('inquiry').insert({
    name: link.recipient_name?.trim() || '—',
    email: replyIsEmail ? reply : contactEmail,
    message: extra.length ? `${message}\n\n${extra.join('\n')}` : message,
    category: 'buy',
    oeuvre_id: ids[0] ?? null,
    private_link_token: link.token,
    status: 'open',
  })
  if (error) {
    await logError('Collector kit enquiry not saved', error, { source: 'c.sendKitEnquiry', metadata: { token: link.token } })
    return { error: 'failed' }
  }
  return { ok: true }
}
