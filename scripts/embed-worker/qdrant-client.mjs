import { EMBEDDING_VECTOR_SIZE, QDRANT_COLLECTION } from './config.mjs'
import { requireEnv } from './supabase-admin.mjs'

function baseUrl() {
  return requireEnv('QDRANT_URL').replace(/\/$/, '')
}

function headers() {
  const h = { 'Content-Type': 'application/json' }
  const key = process.env.QDRANT_API_KEY?.trim()
  if (key) h['api-key'] = key
  return h
}

export async function ensureCollection() {
  const url = `${baseUrl()}/collections/${QDRANT_COLLECTION}`
  const getRes = await fetch(url, { headers: headers() })
  if (getRes.ok) return

  const createRes = await fetch(url, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      vectors: {
        size: EMBEDDING_VECTOR_SIZE,
        distance: 'Cosine',
        on_disk: true,
      },
    }),
  })
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '')
    throw new Error(`Qdrant create collection ${createRes.status}: ${body.slice(0, 300)}`)
  }
}

export async function upsertPoints(points) {
  if (!points.length) return
  const res = await fetch(`${baseUrl()}/collections/${QDRANT_COLLECTION}/points?wait=true`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ points }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Qdrant upsert ${res.status}: ${body.slice(0, 300)}`)
  }
}

export async function deletePoints(ids) {
  if (!ids.length) return
  const res = await fetch(`${baseUrl()}/collections/${QDRANT_COLLECTION}/points/delete?wait=true`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ points: ids }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Qdrant delete ${res.status}: ${body.slice(0, 300)}`)
  }
}

/** Scroll all point ids (audit). */
export async function scrollAllPointIds() {
  const ids = []
  let offset = null
  for (;;) {
    const res = await fetch(`${baseUrl()}/collections/${QDRANT_COLLECTION}/points/scroll`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        limit: 256,
        offset,
        with_payload: false,
        with_vector: false,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Qdrant scroll ${res.status}: ${body.slice(0, 300)}`)
    }
    const json = await res.json()
    for (const p of json.result?.points ?? []) {
      if (p.id) ids.push(String(p.id))
    }
    offset = json.result?.next_page_offset
    if (!offset) break
  }
  return ids
}

export async function searchVectors(vector, limit = 12) {
  const res = await fetch(`${baseUrl()}/collections/${QDRANT_COLLECTION}/points/search`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      vector,
      limit,
      with_payload: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Qdrant search ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  return json.result ?? []
}
