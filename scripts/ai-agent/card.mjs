/**
 * Business card → contact suggestion, on the studio PC (AI desk phase 3, docs/design/2026-11-18/AiDesk.notes.md).
 * Reads the card photo the capture screen kept in the Vault, asks the local vision model (Ollama gemma3:4b) for the
 * text and the fields. Nothing leaves the PC except the Vault read. The result is a SUGGESTION: it reaches the contact
 * only when an admin opens it in the contact editor and saves.
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { requireEnv } from '../embed-worker/supabase-admin.mjs'
import { ollamaBaseUrl } from '../embed-worker/ollama-client.mjs'

export const CARD_MODEL = process.env.AI_CARD_MODEL?.trim() || 'gemma3:4b'
/** The only keys a card job may name (written by keepCardPhoto in app/atelier/capture/card-actions.ts). */
export const CARD_KEY_RE = /^cards\/K_(\d+)_[0-9a-f]{8}\.avif$/
const TIMEOUT_MS = 180_000

const PROMPT = `This is a photo of a business card. Read it carefully.
Answer with JSON only, in this exact shape (use null or [] when absent, never invent anything not printed on the card):
{"text": "all the text printed on the card, line by line",
 "prenom": string|null, "nom": string|null, "institution": string|null, "role": string|null,
 "emails": [string], "phones": [string],
 "addresses": [{"adresse": string|null, "code_postal": string|null, "ville": string|null, "pays": string|null}],
 "websites": [string]}
"prenom" is the given name, "nom" the family name, "institution" the company / gallery / organisation, "role" the job title.`

let s3 = null
function vault() {
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.eu.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: requireEnv('R2_ACCESS_KEY_ID'), secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY') },
    })
  }
  return s3
}

/**
 * A card job may only point at a card photo of that same contact: the key pattern AND a Vault `document` row
 * (kind « carte », that storage path, that contact). Team members can queue a card job with any payload (RLS
 * policy ai_job_team_card_insert), so this check is what keeps the agent from reading anything else.
 */
export async function checkCardKey(sb, key, targetId) {
  const m = typeof key === 'string' ? CARD_KEY_RE.exec(key) : null
  if (!m) return 'not a card photo key'
  if (targetId != null && String(targetId) !== m[1]) return 'key does not belong to this contact'
  const { data, error } = await sb
    .from('document')
    .select('id')
    .eq('kind', 'carte')
    .eq('storage_path', key)
    .eq('contact_id', Number(m[1]))
    .limit(1)
  if (error) return `document check failed: ${error.message}`
  if (!data?.length) return 'no card document for this key'
  return null
}

async function readVaultJpeg(key) {
  const out = await vault().send(new GetObjectCommand({ Bucket: process.env.R2_VAULT_BUCKET?.trim() || 'vault', Key: key }))
  const raw = Buffer.from(await out.Body.transformToByteArray())
  return sharp(raw).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null)
const strs = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 6) : [])

/** Model JSON → the ImportedContact shape (lib/contact-import-types.ts) the contact editor already takes. */
function toContact(j) {
  const addresses = (Array.isArray(j.addresses) ? j.addresses : [])
    .map((a) => ({
      label: 'Travail',
      adresse: str(a?.adresse),
      code_postal: str(a?.code_postal),
      ville: str(a?.ville),
      pays: str(a?.pays),
    }))
    .filter((a) => a.adresse || a.code_postal || a.ville || a.pays)
    .slice(0, 3)
  return {
    prenom: str(j.prenom),
    nom: str(j.nom),
    institution: str(j.institution),
    role: str(j.role),
    notes: null,
    emails: strs(j.emails).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).map((email) => ({ email: email.toLowerCase(), label: 'Travail' })),
    phones: strs(j.phones).map((phone) => ({ country_code: null, phone, label: 'Travail' })),
    addresses,
    websites: strs(j.websites).map((url) => ({ url, label: 'Site' })),
  }
}

/** Read one card photo. Returns { text, contact, model } or throws. */
export async function readCard(key) {
  const jpeg = await readVaultJpeg(key)
  const res = await fetch(`${ollamaBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: CARD_MODEL,
      stream: false,
      format: 'json',
      options: { temperature: 0 },
      messages: [{ role: 'user', content: PROMPT, images: [jpeg.toString('base64')] }],
    }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const body = await res.json()
  let j
  try {
    j = JSON.parse(body?.message?.content ?? '')
  } catch {
    throw new Error(`model answer is not JSON: ${String(body?.message?.content ?? '').slice(0, 200)}`)
  }
  return { text: str(j.text) ? String(j.text).slice(0, 4000) : null, contact: toContact(j), model: CARD_MODEL }
}
