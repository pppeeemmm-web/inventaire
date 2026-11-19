'use server'

// « Bureau IA », phase 1 (Pem « go for ai build », 2026-11-18; design docs/design/2026-11-18/AiDesk.notes.md):
// which AI engines this server can use, what is waiting for the PC's local jobs, and the command that runs each
// queue. Phase 2 queues `ai_job` rows (queueAiJob); phase 3 lists the business cards the PC agent read and records
// the admin's decision (decideAiJob) — a card's fields reach the contact only through the contact editor's Save.
// Admin only.

import { createClient } from '@/lib/supabase/server'
import { countEmbeddingBacklog, countVoiceTranscriptBacklog } from '@/app/atelier/embedding-status-actions'
import { resolveCardVisionMode } from '@/lib/contact-card-vision'
import { resolveLlmMode, resolveOllamaClientUrl } from '@/lib/contact-url-enrich'
import { cardChanges, type CardBefore, type CardChange, type CardSuggestion } from '@/lib/ai-card-suggestion'

/** The models the PC's jobs use (AI_ENGINES.md). */
const OLLAMA_MODELS = ['nomic-embed-text', 'llama3.2:1b', 'gemma3:4b'] as const
/** Must match scripts/transcribe/describe_batch.py (engine = `ollama ${MODEL}`, PROMPT_NAME). */
const DESCRIBE_ENGINE = 'ollama gemma3:4b'
const DESCRIBE_PROMPT = 'labelled+echoes-v1'
const PAGE = 1000

export type AiDeskData = {
  /** Where this server runs: the live site (Vercel) or the app started on a PC. */
  server: 'live' | 'pc'
  openaiKey: boolean
  cardPhoto: 'openai' | 'none'
  cardText: 'openai' | 'ollama' | 'none'
  /** Ollama as this server sees it: null = not reachable; else which of the expected models are present. */
  ollama: { model: string; present: boolean }[] | null
  queues: {
    voice: number | null
    index: number | null
    describe: number | null
    /** Business cards kept with their photo (Vault « carte » documents) — technical details only. */
    cardPhotos: { count: number; latest: string | null } | null
    /** Phase 3: card jobs waiting for the PC agent, and its readings waiting for a decision. */
    cards: { waiting: number; review: CardReview[] } | null
  }
  /** The PC agent (`npm run ai:agent`): last check-in and the models it found; null = never seen. */
  agent: { id: string; seenAt: string; models: { name: string; present: boolean }[] } | null
  /** The 10 latest jobs, newest first (`log` tail kept for failures only). */
  jobs: { id: number; kind: string; status: string; createdAt: string; doneAt: string | null; error: string | null; log: string | null }[]
}

export type AiRunKind = 'voice' | 'embed' | 'describe'

/** One card read by the PC agent, not yet accepted or rejected: what it would add to the contact. */
export type CardReview = {
  jobId: number
  contactId: number
  name: string
  /** The card's text as the model read it (the evidence beside each change). */
  text: string | null
  changes: CardChange[]
  doneAt: string | null
}

const REVIEW_MAX = 50

async function ollamaModels(): Promise<AiDeskData['ollama']> {
  try {
    const res = await fetch(`${resolveOllamaClientUrl()}/api/tags`, { signal: AbortSignal.timeout(1500), cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { models?: { name?: string }[] }
    const names = (body.models ?? []).map((m) => m.name ?? '')
    return OLLAMA_MODELS.map((model) => ({
      model,
      present: names.some((n) => n === model || n === `${model}:latest`),
    }))
  // eslint-disable-next-line pem-i18n/no-silent-catch -- unreachable Ollama is an expected answer (always so on the live site)
  } catch {
    return null
  }
}

/** Works with a cover image not yet described for that cover by the batch's engine + prompt. */
async function describeBacklog(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number | null> {
  const covers = new Map<number, string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('Oeuvres')
      .select('OeuvreID, txtImageNameLink')
      .is('deleted_at', null)
      .not('txtImageNameLink', 'is', null)
      .order('OeuvreID')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[ai-desk] covers', error.message)
      return null
    }
    for (const r of data ?? []) covers.set(Number(r.OeuvreID), String(r.txtImageNameLink))
    if (!data || data.length < PAGE) break
  }
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('work_description')
      .select('oeuvre_id, image_key')
      .eq('engine', DESCRIBE_ENGINE)
      .eq('prompt', DESCRIBE_PROMPT)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[ai-desk] descriptions', error.message)
      return null
    }
    for (const r of data ?? []) {
      if (covers.get(Number(r.oeuvre_id)) === r.image_key) covers.delete(Number(r.oeuvre_id))
    }
    if (!data || data.length < PAGE) break
  }
  return covers.size
}

async function cardPhotos(supabase: Awaited<ReturnType<typeof createClient>>): Promise<AiDeskData['queues']['cardPhotos']> {
  const [count, latest] = await Promise.all([
    supabase.from('document').select('id', { count: 'exact', head: true }).eq('kind', 'carte'),
    supabase.from('document').select('doc_date').eq('kind', 'carte').order('doc_date', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ])
  if (count.error || latest.error) {
    console.error('[ai-desk] cards', count.error?.message ?? latest.error?.message)
    return null
  }
  return { count: count.count ?? 0, latest: latest.data?.doc_date ?? null }
}

type Sb = Awaited<ReturnType<typeof createClient>>
type ContactBeforeRow = {
  ContactID: number
  Prénom: string | null
  Nom: string | null
  NomInstitution: string | null
  Email: string | null
  Téléphone1: string | null
  Téléphone2: string | null
  Adresse: string | null
  CodePostal: string | null
  Ville: string | null
  Pays: string | null
}

/** What each contact has now (columns + its email / phone / website / address rows), for cardChanges. */
async function contactsBefore(supabase: Sb, ids: number[]): Promise<Map<number, CardBefore & { name: string }>> {
  const out = new Map<number, CardBefore & { name: string }>()
  if (ids.length === 0) return out
  const [c, e, p, w, a] = await Promise.all([
    supabase.from('Contact').select('ContactID, "Prénom", Nom, NomInstitution, Email, "Téléphone1", "Téléphone2", Adresse, CodePostal, Ville, Pays').in('ContactID', ids),
    supabase.from('contact_emails').select('contact_id, email').in('contact_id', ids),
    supabase.from('contact_phones').select('contact_id, phone').in('contact_id', ids),
    supabase.from('contact_websites').select('contact_id, url').in('contact_id', ids),
    supabase.from('contact_addresses').select('contact_id, adresse, code_postal, ville, pays').in('contact_id', ids),
  ])
  const err = c.error ?? e.error ?? p.error ?? w.error ?? a.error
  if (err) throw new Error(err.message)
  for (const r of (c.data ?? []) as ContactBeforeRow[]) {
    out.set(r.ContactID, {
      name: [r.Prénom, r.Nom].filter(Boolean).join(' ') || r.NomInstitution || `#${r.ContactID}`,
      prenom: r.Prénom,
      nom: r.Nom,
      institution: r.NomInstitution,
      emails: r.Email ? [r.Email] : [],
      phones: [r.Téléphone1, r.Téléphone2].filter((x): x is string => !!x),
      websites: [], // contact_websites rows only (the Website column is no longer read, 2026-11-19)
      addresses: r.Adresse || r.CodePostal || r.Ville ? [{ adresse: r.Adresse, code_postal: r.CodePostal, ville: r.Ville, pays: r.Pays }] : [],
    })
  }
  for (const r of e.data ?? []) out.get(r.contact_id)?.emails.push(r.email)
  for (const r of p.data ?? []) out.get(r.contact_id)?.phones.push(r.phone)
  for (const r of w.data ?? []) out.get(r.contact_id)?.websites.push(r.url)
  for (const r of a.data ?? []) out.get(r.contact_id)?.addresses.push(r)
  return out
}

function suggestionOf(result: unknown): { contact: CardSuggestion; text: string | null } | null {
  const r = result as { contact?: CardSuggestion; text?: unknown } | null
  if (!r?.contact || !Array.isArray(r.contact.emails)) return null
  return { contact: r.contact, text: typeof r.text === 'string' ? r.text : null }
}

/** Card jobs waiting for the agent + its readings not yet decided (a reading that adds nothing still shows, to close). */
async function cardQueue(supabase: Sb): Promise<AiDeskData['queues']['cards']> {
  const [waiting, done] = await Promise.all([
    supabase.from('ai_job').select('id', { count: 'exact', head: true }).eq('kind', 'card').in('status', ['waiting', 'running']),
    supabase
      .from('ai_job')
      .select('id, target_id, result, done_at')
      .eq('kind', 'card')
      .eq('status', 'done')
      .is('decision', null)
      .order('done_at', { ascending: true })
      .limit(REVIEW_MAX),
  ])
  if (waiting.error || done.error) {
    console.error('[ai-desk] card jobs', waiting.error?.message ?? done.error?.message)
    return null
  }
  const rows = (done.data ?? []).filter((j) => Number(j.target_id) > 0)
  let before: Awaited<ReturnType<typeof contactsBefore>>
  try {
    before = await contactsBefore(supabase, [...new Set(rows.map((j) => Number(j.target_id)))])
  } catch (e) {
    console.error('[ai-desk] card contacts', e instanceof Error ? e.message : e)
    return null
  }
  const review: CardReview[] = []
  for (const j of rows) {
    const s = suggestionOf(j.result)
    const b = before.get(Number(j.target_id))
    if (!s || !b) continue // contact deleted, or a reading without fields: only the job list shows it
    review.push({ jobId: j.id, contactId: Number(j.target_id), name: b.name, text: s.text, changes: cardChanges(b, s.contact), doneAt: j.done_at })
  }
  return { waiting: waiting.count ?? 0, review }
}

async function adminClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return isAdmin ? supabase : null
}

async function agentAndJobs(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Pick<AiDeskData, 'agent' | 'jobs'>> {
  const [agent, jobs] = await Promise.all([
    supabase.from('ai_agent').select('id, seen_at, models').order('seen_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('ai_job').select('id, kind, status, created_at, done_at, error, result').order('created_at', { ascending: false }).limit(10),
  ])
  if (agent.error) console.error('[ai-desk] agent', agent.error.message)
  if (jobs.error) console.error('[ai-desk] jobs', jobs.error.message)
  const a = agent.data
  return {
    agent: a ? { id: a.id, seenAt: a.seen_at, models: Array.isArray(a.models) ? (a.models as { name: string; present: boolean }[]) : [] } : null,
    jobs: (jobs.data ?? []).map((j) => {
      const r = j.result as { log?: unknown } | null
      return {
        id: j.id,
        kind: j.kind,
        status: j.status,
        createdAt: j.created_at,
        doneAt: j.done_at,
        error: j.error,
        log: j.status === 'failed' && typeof r?.log === 'string' ? r.log.slice(-1500) : null,
      }
    }),
  }
}

/**
 * Queue one run for the PC agent (Run button). One open job per kind (unique index `ai_job_one_open`): a second
 * click while one waits or runs answers 'already'.
 */
export async function queueAiJob(kind: AiRunKind): Promise<{ ok: true } | { error: 'auth' | 'already' | 'insert' }> {
  if (kind !== 'voice' && kind !== 'embed' && kind !== 'describe') return { error: 'insert' }
  const supabase = await adminClient()
  if (!supabase) return { error: 'auth' }
  const { error } = await supabase.from('ai_job').insert({ kind })
  if (error) {
    if (error.code === '23505') return { error: 'already' }
    console.error('[ai-desk] queue', error.message)
    return { error: 'insert' }
  }
  return { ok: true }
}

export async function loadAiDesk(): Promise<AiDeskData | { error: 'auth' }> {
  const supabase = await adminClient()
  if (!supabase) return { error: 'auth' }

  const [voice, index, describe, cardPhotoCount, cards, ollama, aj] = await Promise.all([
    countVoiceTranscriptBacklog(),
    countEmbeddingBacklog(),
    describeBacklog(supabase),
    cardPhotos(supabase),
    cardQueue(supabase),
    ollamaModels(),
    agentAndJobs(supabase),
  ])
  return {
    server: process.env.VERCEL ? 'live' : 'pc',
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
    cardPhoto: resolveCardVisionMode(),
    cardText: resolveLlmMode(),
    ollama,
    queues: { voice, index, describe, cardPhotos: cardPhotoCount, cards },
    ...aj,
  }
}

/**
 * The suggestion of one card job, for the contact editor (« Ouvrir et vérifier »): only a read card job not yet
 * decided. The editor fills what is empty and adds what is missing (lib/ai-card-suggestion.ts), the admin saves.
 */
export async function getCardSuggestion(
  jobId: number,
): Promise<{ ok: true; contactId: number; contact: CardSuggestion } | { error: 'auth' | 'gone' }> {
  const supabase = await adminClient()
  if (!supabase) return { error: 'auth' }
  const { data, error } = await supabase
    .from('ai_job')
    .select('target_id, result')
    .eq('id', jobId)
    .eq('kind', 'card')
    .eq('status', 'done')
    .is('decision', null)
    .maybeSingle()
  if (error) console.error('[ai-desk] card suggestion', error.message)
  const s = suggestionOf(data?.result)
  if (!data || !s || !(Number(data.target_id) > 0)) return { error: 'gone' }
  return { ok: true, contactId: Number(data.target_id), contact: s.contact }
}

/**
 * Accept (the contact editor, after its Save went through) or reject (Bureau IA) one card reading. Only an
 * undecided, read card job: a second click or a second tab answers 'gone'. Never touches the contact itself.
 */
export async function decideAiJob(jobId: number, decision: 'accepted' | 'rejected'): Promise<{ ok: true } | { error: 'auth' | 'gone' | 'update' }> {
  if (decision !== 'accepted' && decision !== 'rejected') return { error: 'update' }
  const supabase = await adminClient()
  if (!supabase) return { error: 'auth' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('ai_job')
    .update({ decision, decided_by: user?.id ?? null, decided_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('kind', 'card')
    .eq('status', 'done')
    .is('decision', null)
    .select('id')
  if (error) {
    console.error('[ai-desk] decide', error.message)
    return { error: 'update' }
  }
  return data && data.length > 0 ? { ok: true } : { error: 'gone' }
}

/**
 * Sidebar badge on « Bureau IA » (admin; Pem 2026-11-19 « something on the sidebar that the AI needs to be run »):
 * voice notes to transcribe + items to index + jobs queued for the PC + cards read and not yet decided.
 * Image descriptions are left out (counting them reads the whole catalogue); Bureau IA shows them.
 * 0 when not admin or on any read error (a badge never blocks the menu).
 */
export async function aiDeskBadgeCount(): Promise<number> {
  const supabase = await adminClient()
  if (!supabase) return 0
  const [voice, index, queued, review] = await Promise.all([
    countVoiceTranscriptBacklog(),
    countEmbeddingBacklog(),
    supabase.from('ai_job').select('id', { count: 'exact', head: true }).eq('status', 'waiting'),
    supabase.from('ai_job').select('id', { count: 'exact', head: true }).eq('kind', 'card').eq('status', 'done').is('decision', null),
  ])
  if (queued.error || review.error) console.error('[ai-desk] badge', queued.error?.message ?? review.error?.message)
  return (voice ?? 0) + (index ?? 0) + (queued.count ?? 0) + (review.count ?? 0)
}
