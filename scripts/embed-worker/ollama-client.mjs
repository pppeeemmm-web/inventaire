import { EMBEDDING_MODEL } from './config.mjs'

const DEFAULT_URL = 'http://127.0.0.1:11434'

export function ollamaBaseUrl() {
  return (process.env.OLLAMA_URL ?? DEFAULT_URL).replace(/\/$/, '')
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
