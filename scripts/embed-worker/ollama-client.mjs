import { EMBEDDING_MODEL } from './config.mjs'

const DEFAULT_URL = 'http://127.0.0.1:11435'

export function ollamaBaseUrl() {
  const raw =
    process.env.OLLAMA_ORIGIN?.trim() ||
    process.env.OLLAMA_URL?.trim() ||
    process.env.OLLAMA_HOST?.trim() ||
    DEFAULT_URL
  let s = raw
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  try {
    const u = new URL(s)
    if (u.hostname === '0.0.0.0') u.hostname = '127.0.0.1'
    return u.origin
  } catch {
    return DEFAULT_URL
  }
}

export async function embedText(prompt, { model = EMBEDDING_MODEL } = {}) {
  const res = await fetch(`${ollamaBaseUrl()}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  if (!Array.isArray(json.embedding)) {
    throw new Error('Ollama response missing embedding array')
  }
  return json.embedding
}

export function isOllamaConnectionError(err) {
  const code = err?.cause?.code ?? err?.code
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND'
}
