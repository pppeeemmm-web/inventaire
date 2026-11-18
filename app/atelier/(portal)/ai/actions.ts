'use server'

// « Bureau IA », phase 1 (Pem « go for ai build », 2026-11-18; design docs/design/2026-11-18/AiDesk.notes.md):
// read only — which AI engines this server can use, what is waiting for the PC's local jobs, and the command
// that runs each queue. Nothing is written. Admin only.

import { createClient } from '@/lib/supabase/server'
import { countEmbeddingBacklog, countVoiceTranscriptBacklog } from '@/app/atelier/embedding-status-actions'
import { resolveCardVisionMode } from '@/lib/contact-card-vision'
import { resolveLlmMode, resolveOllamaClientUrl } from '@/lib/contact-url-enrich'

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
    /** Business cards kept with their photo (the AI pass itself is not recorded before phase 3). */
    cards: { count: number; latest: string | null } | null
  }
  /** The PC agent (`npm run ai:agent`): last check-in and the models it found; null = never seen. */
  agent: { id: string; seenAt: string; models: { name: string; present: boolean }[] } | null
  /** The 10 latest jobs, newest first (`log` tail kept for failures only). */
  jobs: { id: number; kind: string; status: string; createdAt: string; doneAt: string | null; error: string | null; log: string | null }[]
}

export type AiRunKind = 'voice' | 'embed' | 'describe'

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

async function cardPhotos(supabase: Awaited<ReturnType<typeof createClient>>): Promise<AiDeskData['queues']['cards']> {
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

  const [voice, index, describe, cards, ollama, aj] = await Promise.all([
    countVoiceTranscriptBacklog(),
    countEmbeddingBacklog(),
    describeBacklog(supabase),
    cardPhotos(supabase),
    ollamaModels(),
    agentAndJobs(supabase),
  ])
  return {
    server: process.env.VERCEL ? 'live' : 'pc',
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
    cardPhoto: resolveCardVisionMode(),
    cardText: resolveLlmMode(),
    ollama,
    queues: { voice, index, describe, cards },
    ...aj,
  }
}
