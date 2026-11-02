#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { supabaseAdmin } from './supabase-admin.mjs'
import { embedText, isOllamaConnectionError } from './ollama-client.mjs'
import { ensureOllamaRunning } from './ensure-ollama.mjs'
import {
  BATCH_SIZE,
  EMBEDDING_MODEL,
  MAX_EMBEDDING_ATTEMPTS,
  STUCK_EMBEDDING_MINUTES,
} from './config.mjs'

const args = process.argv.slice(2)
const once = args.includes('--once')
const watch = args.includes('--watch')
/** Run passes until a pass embeds nothing, then exit (Overview "Run indexing" button). */
const drain = args.includes('--drain')
const audit = args.includes('--audit')
const reembedAll = args.includes('--reembed-all')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : null

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function truncateErr(msg) {
  return String(msg).slice(0, 500)
}

async function resetStuckEmbedding(supabase) {
  const cutoff = new Date(Date.now() - STUCK_EMBEDDING_MINUTES * 60_000).toISOString()
  const { error } = await supabase
    .from('nodes')
    .update({ embedding_status: 'pending' })
    .eq('embedding_status', 'embedding')
    .lt('embedding_dirty_at', cutoff)
  if (error) console.warn('[embed-worker] reset stuck:', error.message)
}

async function fetchPendingBatch(supabase, n) {
  const { data, error } = await supabase
    .from('nodes')
    .select('node_id, node_type, source_pk, embedding_status, embedding_text_hash, embedding_attempts')
    .in('embedding_status', ['pending', 'error'])
    .order('created_at', { ascending: true })
    .limit(n)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function processNode(supabase, row) {
  const nodeId = row.node_id
  const { data: text, error: textErr } = await supabase.rpc('node_search_text', { p_node_id: nodeId })
  if (textErr) throw new Error(textErr.message)

  if (!text || !String(text).trim()) {
    await supabase
      .from('nodes')
      .update({
        embedding_status: 'skipped',
        embedding_error: null,
        embedded_at: new Date().toISOString(),
      })
      .eq('node_id', nodeId)
    return 'skipped'
  }

  const hash = sha256(String(text))
  if (row.embedding_status === 'ok' && row.embedding_text_hash === hash) {
    return 'unchanged'
  }

  const { error: lockErr } = await supabase
    .from('nodes')
    .update({ embedding_status: 'embedding', embedding_dirty_at: new Date().toISOString() })
    .eq('node_id', nodeId)
  if (lockErr) throw new Error(lockErr.message)

  const vector = await embedText(String(text))

  // The vector lives on the node row (pgvector, supabase/sql/semantic_search_pgvector.sql).
  const { error: okErr } = await supabase
    .from('nodes')
    .update({
      embedding: `[${vector.join(',')}]`,
      embedding_status: 'ok',
      embedding_text_hash: hash,
      embedding_model: EMBEDDING_MODEL,
      embedded_at: new Date().toISOString(),
      embedding_error: null,
    })
    .eq('node_id', nodeId)
  if (okErr) throw new Error(okErr.message)
  return 'ok'
}

async function failNode(supabase, row, err, { ollamaDown = false } = {}) {
  if (ollamaDown) return
  const attempts = (row.embedding_attempts ?? 0) + 1
  const status = attempts >= MAX_EMBEDDING_ATTEMPTS ? 'error' : 'pending'
  await supabase
    .from('nodes')
    .update({
      embedding_status: status,
      embedding_attempts: attempts,
      embedding_error: truncateErr(err?.message ?? err),
    })
    .eq('node_id', row.node_id)
}

async function drainPendingQueries(supabase) {
  const { data, error } = await supabase
    .from('pending_query_embeddings')
    .select('id, query_norm')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  let ok = 0
  for (const row of data) {
    try {
      const vector = await embedText(row.query_norm)
      const { error: cacheErr } = await supabase.from('query_embedding_cache').upsert({
        query_norm: row.query_norm,
        vector,
        model: EMBEDDING_MODEL,
      })
      if (cacheErr) throw new Error(cacheErr.message)
      const { error: delErr } = await supabase
        .from('pending_query_embeddings')
        .delete()
        .eq('id', row.id)
      if (delErr) throw new Error(delErr.message)
      ok += 1
      console.log(`[embed-worker] query cached: ${row.query_norm.slice(0, 40)}`)
    } catch (err) {
      if (isOllamaConnectionError(err)) throw err
      console.error(`[embed-worker] pending query ${row.query_norm}:`, err.message)
    }
  }
  return ok
}

async function runPass(supabase) {
  await resetStuckEmbedding(supabase)

  const queries = await drainPendingQueries(supabase)
  if (queries) console.log(`[embed-worker] pending queries cached: ${queries}`)

  const batchSize = limit && Number.isFinite(limit) ? Math.min(limit, BATCH_SIZE) : BATCH_SIZE
  const pending = await fetchPendingBatch(supabase, batchSize)
  if (!pending.length) return 0

  let ok = 0
  for (const row of pending) {
    try {
      const r = await processNode(supabase, row)
      if (r === 'ok') ok += 1
      console.log(`[embed-worker] ${row.node_type}:${row.source_pk} → ${r}`)
    } catch (err) {
      if (isOllamaConnectionError(err)) {
        console.error('[embed-worker] Ollama unavailable — leaving queue pending')
        throw err
      }
      console.error(`[embed-worker] ${row.node_id}:`, err.message)
      await failNode(supabase, row, err)
    }
  }
  return ok
}

/** Vectors live on their node rows, so orphans cannot exist; report what is still unsearchable. */
async function runAudit(supabase) {
  const { data, error } = await supabase
    .from('nodes')
    .select('embedding_status')
    .or('embedding.is.null,embedding_status.neq.ok')
  if (error) throw new Error(error.message)
  const counts = {}
  for (const r of data ?? []) counts[r.embedding_status] = (counts[r.embedding_status] ?? 0) + 1
  console.log('[embed-worker] audit: nodes without a usable vector', counts)
}

async function runReembedAll(supabase) {
  const { error } = await supabase
    .from('nodes')
    .update({ embedding_status: 'pending', embedding_dirty_at: new Date().toISOString() })
    .neq('embedding_status', 'pending')
  if (error) throw new Error(error.message)
  console.log('[embed-worker] all nodes marked pending')
}

async function main() {
  await ensureOllamaRunning()
  const supabase = supabaseAdmin()

  if (reembedAll) {
    await runReembedAll(supabase)
    if (!once && !watch && !audit) return
  }

  if (audit) {
    await runAudit(supabase)
    return
  }

  if (watch) {
    let ollamaWarned = false
    for (;;) {
      try {
        const n = await runPass(supabase)
        ollamaWarned = false
        if (n === 0) {
          await new Promise((r) => setTimeout(r, 60_000))
        }
      } catch (err) {
        if (isOllamaConnectionError(err)) {
          try {
            await ensureOllamaRunning()
            continue
          } catch (ensureErr) {
            if (!ollamaWarned) {
              console.error('[embed-worker] Ollama unavailable —', ensureErr.message)
              ollamaWarned = true
            }
          }
          await new Promise((r) => setTimeout(r, 60_000))
          continue
        }
        throw err
      }
    }
  }

  if (drain) {
    let total = 0
    for (;;) {
      const n = await runPass(supabase)
      total += n
      if (n === 0) break
    }
    console.log(`[embed-worker] drained: ${total} embedded`)
    return
  }

  const n = await runPass(supabase)
  console.log(`[embed-worker] done: ${n} embedded`)
}

main().catch((err) => {
  console.error('[embed-worker] fatal:', err)
  process.exit(1)
})
