import { spawn } from 'node:child_process'
import { ollamaBaseUrl } from './ollama-client.mjs'

function ollamaHostFromOrigin(origin) {
  const u = new URL(origin)
  const host = u.hostname === '0.0.0.0' ? '127.0.0.1' : u.hostname
  const port = u.port || '11435'
  return `${host}:${port}`
}

export async function isOllamaReachable(origin = ollamaBaseUrl(), timeoutMs = 3000) {
  try {
    const res = await fetch(`${origin}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok
  } catch {
    return false
  }
}

function autostartDisabled() {
  return process.env.EMBED_WORKER_NO_OLLAMA_AUTOSTART === '1'
}

/**
 * Ping configured Ollama origin; if down, spawn `ollama serve` on that host:port (detached).
 * Set EMBED_WORKER_NO_OLLAMA_AUTOSTART=1 to require a manual serve.
 */
export async function ensureOllamaRunning() {
  const origin = ollamaBaseUrl()
  if (await isOllamaReachable(origin)) {
    return { origin, started: false }
  }

  if (autostartDisabled()) {
    throw new Error(
      `Ollama not reachable at ${origin}. Start it: $env:OLLAMA_HOST="${ollamaHostFromOrigin(origin)}"; ollama serve`,
    )
  }

  const host = ollamaHostFromOrigin(origin)
  console.log(`[embed-worker] Ollama offline — starting on ${host}…`)

  const child = spawn('ollama', ['serve'], {
    env: { ...process.env, OLLAMA_HOST: host },
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  child.unref()

  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    if (await isOllamaReachable(origin, 5000)) {
      console.log(`[embed-worker] Ollama ready at ${origin}`)
      return { origin, started: true, pid: child.pid ?? null }
    }
  }

  throw new Error(
    `Ollama did not become ready at ${origin} within 45s. Try: $env:OLLAMA_HOST="${host}"; ollama serve`,
  )
}
