'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveOllamaClientUrl } from '@/lib/contact-url-enrich'
import { OLLAMA_SCRIPT_INSTRUCTIONS } from '@/lib/ollama-script'

export type OllamaScriptResult =
  | { ok: true; reply: string; model: string; host: string }
  | { error: string }

/** Team-only: run the fixed instruction bundle against local/cloud Ollama (same host/model as contact enrich). */
export async function runOllamaInstructionScript(): Promise<OllamaScriptResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  const host = resolveOllamaClientUrl().replace(/\/$/, '')
  const model = process.env.OLLAMA_MODEL || 'llama3.2:1b'

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 120_000)
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'Tu suis exactement les instructions utilisateur. Réponses en français, concis.',
          },
          { role: 'user', content: OLLAMA_SCRIPT_INSTRUCTIONS },
        ],
      }),
    })
    clearTimeout(timer)
    if (!res.ok) {
      const txt = await res.text()
      return { error: `Ollama ${res.status}: ${txt.slice(0, 500)}` }
    }
    const data = (await res.json()) as { message?: { content?: string } }
    const reply = data.message?.content?.trim() ?? ''
    return { ok: true, reply, model, host }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur réseau'
    return { error: /abort/i.test(msg) ? 'Timeout (120s)' : msg.slice(0, 300) }
  }
}
