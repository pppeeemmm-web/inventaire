'use server'

/** Business-card capture — Contact-only (no Oeuvres reads). See docs/archive/GRAPHIFY_NOTES.md. */
import crypto from 'crypto'
import sharp from 'sharp'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { importGoogleContacts } from '@/app/atelier/(portal)/contacts/actions'
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
import { vaultR2Put } from '@/lib/vault-r2-put'
import { logError } from '@/lib/error-reporter/server'

const MAX_BYTES = 12 * 1024 * 1024
/** The optional AI step gives up after this long (Pem 2026-11-18: outdoors the studio AI is out of reach). */
const AI_BUDGET_MS = 30_000

export type CardCaptureMeta = {
  sources: string[]
  llm: 'none' | 'openai' | 'ollama'
  llmNote?: string
  ocrUsed: boolean
}

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null, userId: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null, userId: null }
  return { error: null, supabase, userId: user.id }
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
  // « Analyser » sends text only and never waits for an AI; the photo and the AI come with
  // « Améliorer avec l'IA » (refineWithLlm), which shares one time budget.
  const deadline = Date.now() + AI_BUDGET_MS

  if (hasFile && file instanceof File) {
    if (file.size > MAX_BYTES) return { error: 'file_too_large' }
    const buf = Buffer.from(await file.arrayBuffer())
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) return { error: validated.error }

    if (resolveCardVisionMode() !== 'none') {
      try {
        ocrText = await extractTextFromCardImage(buf, AI_BUDGET_MS)
      } catch (e) {
        ocrText = null // timed out or unreachable: fall back to the pasted text
        await logError('capture_card: photo reading failed', e)
      }
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
        timeoutMs: Math.max(2_000, deadline - Date.now()),
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

/** The card photo goes to the Vault (« Business »), linked to the new contact, so the AI can reread it
 *  later (Pem 2026-11-18). Normalised like a session shot: AVIF q50, long side 2100. False = not kept. */
async function keepCardPhoto(
  supabase: NonNullable<Awaited<ReturnType<typeof guardTeam>>['supabase']>,
  userId: string | null,
  contactId: number,
  label: string,
  file: File,
): Promise<boolean> {
  try {
    if (file.size > MAX_BYTES) return false
    const raw = Buffer.from(await file.arrayBuffer())
    const validated = await validateWorkImageBuffer(raw)
    if ('error' in validated) return false
    const avif = await sharp(raw)
      .rotate()
      .resize({ width: 2100, height: 2100, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 50 })
      .toBuffer()
    const hash8 = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8)
    const key = `cards/K_${contactId}_${hash8}.avif`
    await vaultR2Put(key, avif, 'image/avif', 'capture_card', userId)
    const { error } = await supabase.from('document').insert({
      name: `Carte — ${label}`.slice(0, 200),
      kind: 'carte',
      folder: 'Business',
      source: 'file',
      storage_path: key,
      file_size: avif.length,
      mime_type: 'image/avif',
      contact_id: contactId,
      doc_date: new Date().toISOString().slice(0, 10),
      notes: 'Photo de la carte de visite (capture terrain)',
    })
    if (error) await logError('capture_card: card photo document insert', error)
    return !error
  } catch (e) {
    await logError('capture_card: keeping the card photo', e)
    return false
  }
}

export async function commitBusinessCardCapture(
  contact: ImportedContact,
  photo?: FormData,
): Promise<{ ok: true; href: string; photoKept: boolean | null } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }

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

  const file = photo?.get('file')
  let photoKept: boolean | null = null
  if (file instanceof File && file.size > 0) {
    const label = [contact.prenom, contact.nom].filter(Boolean).join(' ') || contact.institution || String(contactId)
    photoKept = await keepCardPhoto(g.supabase, g.userId, contactId, label, file)
  }

  revalidatePath('/atelier')
  return { ok: true, href: `/atelier/contacts?contact=${contactId}`, photoKept }
}
