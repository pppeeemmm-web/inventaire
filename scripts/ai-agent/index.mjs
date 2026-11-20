/**
 * PEM AI agent — runs on the studio PC (Pem « go for ai build », local only, 2026-11-18).
 * docs/design/2026-11-18/AiDesk.notes.md, table `ai_job` (supabase/sql/ai_job.sql).
 *
 *   npm run ai:agent             run what is waiting now, one job after the other, then exit (the default:
 *                                Pem 2026-11-19 « on when I need it » — started by Bureau IA's « Lancer sur ce PC »
 *                                (pem-ai: link) or at Windows sign-in, scripts/register-ai-agent.ps1)
 *   npm run ai:agent -- --watch  keep running: heartbeat every minute, pick waiting jobs every 15 s (by hand)
 *
 * The Bureau IA screen queues jobs; this process picks them ONE AT A TIME (Whisper large-v3 and the Ollama
 * models do not fit together in 8 GB of GPU memory) and runs the same scripts as before:
 *   voice    → scripts/transcribe/voice_batch.py --run --write, then the search index
 *   describe → scripts/transcribe/describe_batch.py --write, then the search index
 *   embed    → scripts/embed-worker/index.mjs --drain
 *   card     → card.mjs: the Vault card photo read by gemma3:4b → a contact SUGGESTION in `result` (phase 3)
 *   npm run ai:agent -- --try cards/K_…avif   read one card photo, print the suggestion, write nothing
 * Kind 'web' is left waiting until this agent can read it.
 * Uses the service key from .env.local (never leaves the PC). Nothing is sent to any other AI service.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { supabaseAdmin } from '../embed-worker/supabase-admin.mjs'
import { ollamaBaseUrl } from '../embed-worker/ollama-client.mjs'
import { ensureOllamaRunning } from '../embed-worker/ensure-ollama.mjs'
import { checkCardKey, readCard } from './card.mjs'

const AGENT_ID = process.env.AI_AGENT_ID?.trim() || 'studio-pc'
const KINDS = ['voice', 'describe', 'embed', 'card']
const MODELS = ['nomic-embed-text', 'llama3.2:1b', 'gemma3:4b']
const POLL_MS = 15_000
const HEARTBEAT_MS = 60_000
const LOG_TAIL = 4000
const PYTHON = path.join(os.homedir(), '.venvs', 'transcribe', 'Scripts', 'python.exe')
const WATCH = process.argv.includes('--watch')

const sb = supabaseAdmin()

function log(...a) {
  console.log(new Date().toISOString().slice(11, 19), ...a)
}

/** Run one command, keep the tail of its output (stdout + stderr) for the job row. */
function run(cmd, args) {
  return new Promise((resolve) => {
    let out = ''
    const p = spawn(cmd, args, { cwd: process.cwd(), env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true })
    const keep = (b) => {
      const s = b.toString()
      process.stdout.write(s)
      out = (out + s).slice(-LOG_TAIL)
    }
    p.stdout.on('data', keep)
    p.stderr.on('data', keep)
    p.on('error', (e) => resolve({ code: -1, out: `${out}\n${e.message}` }))
    p.on('close', (code) => resolve({ code: code ?? -1, out }))
  })
}

const drainIndex = () => run(process.execPath, ['scripts/embed-worker/index.mjs', '--drain'])

/** Card job: the key must be this contact's card photo (checkCardKey), then the local vision model reads it. */
async function runCardJob(job) {
  const refused = await checkCardKey(sb, job.payload?.key, job.target_id)
  if (refused) return { code: 1, out: `refused: ${refused}` }
  await ensureOllamaRunning()
  try {
    const r = await readCard(job.payload.key)
    return { code: 0, out: `${r.model}: read`, result: r }
  } catch (e) {
    return { code: 1, out: e instanceof Error ? e.message : String(e) }
  }
}

async function runJob(job) {
  const kind = job.kind
  if (kind === 'card') return runCardJob(job)
  if (kind === 'embed') {
    await ensureOllamaRunning()
    return drainIndex()
  }
  if (!existsSync(PYTHON)) return { code: -1, out: `No Python venv at ${PYTHON}` }
  const step =
    kind === 'voice'
      ? await run(PYTHON, ['scripts/transcribe/voice_batch.py', '--run', '--write'])
      : await run(PYTHON, ['scripts/transcribe/describe_batch.py', '--write'])
  if (step.code !== 0) return step
  // New transcripts / descriptions change the works' search text: index them right after (as the .ps1 scripts did).
  await ensureOllamaRunning()
  const idx = await drainIndex()
  return { code: idx.code, out: `${step.out}\n--- search index ---\n${idx.out}`.slice(-LOG_TAIL) }
}

async function heartbeat() {
  let names = null
  try {
    const res = await fetch(`${ollamaBaseUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) names = ((await res.json()).models ?? []).map((m) => m.name ?? '')
  } catch {
    names = null
  }
  const models = [
    ...MODELS.map((m) => ({ name: m, present: names ? names.some((n) => n === m || n === `${m}:latest`) : false })),
    { name: 'whisper', present: existsSync(PYTHON) },
  ]
  const { error } = await sb
    .from('ai_agent')
    .upsert({ id: AGENT_ID, seen_at: new Date().toISOString(), models, version: process.env.npm_package_version ?? null })
  if (error) log('heartbeat failed:', error.message)
}

/** Take the oldest waiting job of a kind this agent runs; null when none (or another agent took it first). */
async function claim() {
  const { data, error } = await sb
    .from('ai_job')
    .select('id')
    .eq('status', 'waiting')
    .in('kind', KINDS)
    .order('created_at')
    .limit(1)
  if (error) {
    log('read failed:', error.message)
    return null
  }
  const job = data?.[0]
  if (!job) return null
  const { data: got, error: e2 } = await sb
    .from('ai_job')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'waiting')
    .select('id, kind, target_id, payload')
  if (e2) log('claim failed:', e2.message)
  return got?.[0] ?? null
}

async function drainQueue() {
  for (;;) {
    const job = await claim()
    if (!job) return
    log(`job ${job.id} (${job.kind}) started`)
    const r = await runJob(job)
    const ok = r.code === 0
    const { error } = await sb
      .from('ai_job')
      .update({
        status: ok ? 'done' : 'failed',
        done_at: new Date().toISOString(),
        result: r.result ? { ...r.result, log: r.out } : { log: r.out },
        error: ok ? null : `exit ${r.code}`,
      })
      .eq('id', job.id)
    if (error) log('save failed:', error.message)
    log(`job ${job.id} (${job.kind}) ${ok ? 'done' : `failed (exit ${r.code})`}`)
  }
}

async function main() {
  const tryAt = process.argv.indexOf('--try')
  if (tryAt > -1) {
    const key = process.argv[tryAt + 1]
    const refused = await checkCardKey(sb, key, null)
    if (refused) throw new Error(refused)
    await ensureOllamaRunning()
    console.log(JSON.stringify(await readCard(key), null, 1))
    return
  }
  // A job left « running » belongs to a previous agent that was stopped: mark it failed so it can be queued again.
  const { error } = await sb
    .from('ai_job')
    .update({ status: 'failed', error: 'agent restarted while running', done_at: new Date().toISOString() })
    .eq('status', 'running')
    .in('kind', KINDS)
  if (error) log('reset failed:', error.message)

  await heartbeat()
  if (!WATCH) {
    // One pass: the desk shows « En cours » from the running job, then « Dernier passage » from this last check-in.
    log(`PEM AI agent « ${AGENT_ID} »: one pass`)
    await drainQueue()
    // The desk starts this pass at the click, before its job is saved: look again for a few seconds.
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      await drainQueue()
    }
    await heartbeat()
    log('nothing left — stopping')
    return
  }
  log(`PEM AI agent « ${AGENT_ID} » running — Ctrl+C to stop`)
  setInterval(() => void heartbeat(), HEARTBEAT_MS)
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      await drainQueue()
    } catch (e) {
      log('error:', e instanceof Error ? e.message : e)
    } finally {
      busy = false
    }
  }
  await tick()
  setInterval(() => void tick(), POLL_MS)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
