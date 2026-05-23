#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { supabaseAdmin } from './supabase-admin.mjs'
import { embedText, isOllamaConnectionError } from './ollama-client.mjs'
import { ensureCollection, upsertPoints, deletePoints, scrollAllPointIds } from './qdrant-client.mjs'
import {
  BATCH_SIZE,
  EMBEDDING_MODEL,
  MAX_EMBEDDING_ATTEMPTS,
  STUCK_EMBEDDING_MINUTES,
} from './config.mjs'

const args = process.argv.slice(2)
const once = args.includes('--once')
const watch = args.includes('--watch')
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
    .select('node_id, node_type, source_pk, embedding_status, embedding_text_hash, embedding_attempts, qdrant_point_id')
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
  const pointId = row.qdrant_point_id ?? nodeId
  const now = Math.floor(Date.now() / 1000)

  await upsertPoints([
    {
      id: pointId,
      vector,
      payload: {
        node_id: nodeId,
        node_type: row.node_type,
        model: EMBEDDING_MODEL,
        embedded_at: now,
      },
    },
  ])

  const { error: okErr } = await supabase
    .from('nodes')
    .update({
      embedding_status: 'ok',
      embedding_text_hash: hash,
      embedding_model: EMBEDDING_MODEL,
      embedded_at: new Date().toISOString(),
      qdrant_point_id: pointId,
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

async function drainTombstones(supabase) {
  const { data, error } = await supabase
    .from('node_embedding_tombstone')
    .select('node_id')
    .order('deleted_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  await deletePoints(data.map((r) => r.node_id))
  const ids = data.map((r) => r.node_id)
  const { error: delErr } = await supabase.from('node_embedding_tombstone').delete().in('node_id', ids)
  if (delErr) throw new Error(delErr.message)
  return ids.length
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
  const tomb = await drainTombstones(supabase)
  if (tomb) console.log(`[embed-worker] tombstones drained: ${tomb}`)

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

async function runAudit(supabase) {
  const qdrantIds = new Set(await scrollAllPointIds())
  const { data, error } = await supabase.from('nodes').select('node_id')
  if (error) throw new Error(error.message)
  const live = new Set((data ?? []).map((r) => r.node_id))
  const orphans = [...qdrantIds].filter((id) => !live.has(id))
  if (!orphans.length) {
    console.log('[embed-worker] audit: no orphans')
    return
  }
  console.log(`[embed-worker] audit: deleting ${orphans.length} orphan points`)
  for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
    await deletePoints(orphans.slice(i, i + BATCH_SIZE))
  }
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
  const supabase = supabaseAdmin()
  await ensureCollection()

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
          if (!ollamaWarned) {
            console.error('[embed-worker] Ollama ECONNREFUSED — sleep 60s')
            ollamaWarned = true
          }
          await new Promise((r) => setTimeout(r, 60_000))
          continue
        }
        throw err
      }
    }
  }

  const n = await runPass(supabase)
  console.log(`[embed-worker] done: ${n} embedded`)
}

main().catch((err) => {
  console.error('[embed-worker] fatal:', err)
  process.exit(1)
})
