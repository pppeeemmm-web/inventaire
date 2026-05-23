'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { importGoogleContacts } from '@/app/atelier/contacts/actions'
import type { ImportedContact } from '@/lib/contact-import-types'
import {
  extractContactFromCardText,
  hasCardIdentity,
  mergeCardTextWithDraft,
} from '@/lib/contact-card-parse'
import { extractTextFromCardImage, resolveCardVisionMode } from '@/lib/contact-card-vision'
import {
  refineContactWithLlm,
  resolveLlmMode,
  resolveOllamaClientUrl,
} from '@/lib/contact-url-enrich'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import { logSystemEvent } from '@/lib/utils/logging'

const MAX_BYTES = 12 * 1024 * 1024

export type CardCaptureMeta = {
  sources: string[]
  llm: 'none' | 'openai' | 'ollama'
  llmNote?: string
  ocrUsed: boolean
}

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null }
  return { error: null, supabase }
}

export async function previewBusinessCardCapture(
  formData: FormData,
): Promise<
  | { ok: true; contact: ImportedContact; meta: CardCaptureMeta }
  | { error: string }
> {
  const g = await guardTeam()
  if (g.error) return { error: g.error }

  const pasted = ((formData.get('text') as string | null) ?? '').trim()
  const refineWithLlm = formData.get('refineWithLlm') === '1'
  const file = formData.get('file')
  const hasFile = file instanceof File && file.size > 0

  if (!hasFile && !pasted) return { error: 'empty' }

  let ocrText: string | null = null
  let ocrUsed = false

  if (hasFile && file instanceof File) {
    if (file.size > MAX_BYTES) return { error: 'file_too_large' }
    const buf = Buffer.from(await file.arrayBuffer())
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) return { error: validated.error }

    if (resolveCardVisionMode() !== 'none') {
      ocrText = await extractTextFromCardImage(buf)
      ocrUsed = Boolean(ocrText)
    }

    if (!ocrText && !pasted) return { error: 'ocr_failed' }
  }

  let draft: ImportedContact
  let sources: string[]

  if (ocrText && pasted) {
    const ocr = extractContactFromCardText(ocrText)
    draft = mergeCardTextWithDraft(ocr.draft, pasted)
    sources = [...new Set([...ocr.sources, 'coller'])]
  } else if (ocrText) {
    const r = extractContactFromCardText(ocrText)
    draft = r.draft
    sources = r.sources
  } else {
    const r = extractContactFromCardText(pasted)
    draft = r.draft
    sources = r.sources
  }

  const meta: CardCaptureMeta = { sources, llm: 'none', ocrUsed }
  const textSample = [ocrText, pasted].filter(Boolean).join('\n').slice(0, 8000)

  if (refineWithLlm) {
    const mode = resolveLlmMode()
    if (mode !== 'none') {
      const env = {
        mode,
        openaiBase: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
        openaiKey: process.env.OPENAI_API_KEY || '',
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        ollamaHost: resolveOllamaClientUrl(),
        ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:1b',
      }
      if (mode === 'openai' && !env.openaiKey) {
        meta.llmNote = 'OPENAI_API_KEY manquante'
      } else {
        try {
          const { merged, llm } = await refineContactWithLlm(draft, textSample, 'capture://card', env)
          draft = merged
          meta.llm = llm
          sources.push('IA')
        } catch (e) {
          meta.llmNote = e instanceof Error ? e.message.slice(0, 240) : 'IA indisponible'
        }
      }
    }
  }

  meta.sources = [...new Set(sources)]
  return { ok: true, contact: draft, meta }
}

export async function commitBusinessCardCapture(
  contact: ImportedContact,
): Promise<{ ok: true; href: string } | { error: string }> {
  const g = await guardTeam()
  if (g.error) return { error: g.error }

  if (!hasCardIdentity(contact)) return { error: 'no_identity' }

  const res = await importGoogleContacts([contact])
  if ('error' in res) return { error: res.error }
  if (res.imported === 0) {
    return { error: res.skipped > 0 ? 'duplicate' : 'insert' }
  }

  const contactId = res.contactIds[0]
  if (!contactId) return { error: 'insert' }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'Contact',
    rowId: contactId,
    metadata: { source: 'capture_card' },
  })

  revalidatePath('/atelier')
  return { ok: true, href: `/atelier/contacts?contact=${contactId}` }
}
