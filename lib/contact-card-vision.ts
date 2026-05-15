/**
 * Optional server-side OCR for business card photos (OpenAI-compatible vision).
 * Card image bytes may leave the device when enabled — set CONTACT_CARD_VISION=none to disable.
 */

import sharp from 'sharp'

const MAX_OCR_TEXT = 8000

export type CardVisionMode = 'openai' | 'none'

export function resolveCardVisionMode(): CardVisionMode {
  const explicit = process.env.CONTACT_CARD_VISION?.toLowerCase()
  if (explicit === 'none') return 'none'
  if (explicit === 'openai') return process.env.OPENAI_API_KEY ? 'openai' : 'none'
  // auto: use vision when OpenAI key is configured
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'none'
}

async function resizeForVision(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
}

export async function extractTextFromCardImage(buf: Buffer): Promise<string | null> {
  if (resolveCardVisionMode() !== 'openai') return null

  const key = process.env.OPENAI_API_KEY ?? ''
  if (!key) return null

  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'

  let jpeg: Buffer
  try {
    jpeg = await resizeForVision(buf)
  } catch {
    return null
  }

  const b64 = jpeg.toString('base64')
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this business card image. Return plain text only, preserving line breaks. No commentary.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${b64}` },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!res.ok) return null
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content?.trim()
  return text && text.length > 0 ? text.slice(0, MAX_OCR_TEXT) : null
}
