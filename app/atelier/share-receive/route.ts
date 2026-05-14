import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { r2PutObject, r2DeleteObject } from '@/lib/r2-s3-object'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import type { ShareInboxPayloadV1 } from '@/lib/share-inbox-types'

export const maxDuration = 60

const MAX_FILE_BYTES = 12 * 1024 * 1024
const MAX_FILES = 12
const TTL_MS = 24 * 60 * 60 * 1000

function originFromRequest(request: NextRequest): string {
  const u = request.nextUrl
  return `${u.protocol}//${u.host}`
}

function safeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  return base || 'file'
}

function isPdfBuffer(buf: Buffer): boolean {
  return buf.length > 5 && buf.subarray(0, 5).toString('binary') === '%PDF-'
}

function extractUrlsFromString(s: string | null | undefined, out: Set<string>) {
  if (!s?.trim()) return
  const re = /https?:\/\/[^\s<>"']{4,2000}/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    out.add(m[0].replace(/[),.;]+$/, ''))
    if (out.size >= 24) break
  }
}

function supabaseForRedirect(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )
}

async function redirectWithSessionRefresh(
  request: NextRequest,
  url: string,
  status: 303 | 302 = 303,
): Promise<NextResponse> {
  const res = NextResponse.redirect(url, status)
  const sb = supabaseForRedirect(request, res)
  await sb.auth.getUser()
  return res
}

export async function POST(request: NextRequest) {
  const origin = originFromRequest(request)
  const triage = (q: string) => `${origin}/atelier/share-triage${q}`

  const probe = NextResponse.redirect(
    `${origin}/login?next=${encodeURIComponent('/atelier/share-triage')}`,
    303,
  )
  const sbProbe = supabaseForRedirect(request, probe)
  const {
    data: { user },
  } = await sbProbe.auth.getUser()
  if (!user) return probe

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (e) {
    console.warn('[share-receive] formData parse failed', e)
    return redirectWithSessionRefresh(request, triage('?err=empty'))
  }

  const titleRaw = formData.get('title')
  const textRaw = formData.get('text')
  const urlRaw = formData.get('url')
  const title = typeof titleRaw === 'string' ? titleRaw.trim().slice(0, 500) : ''
  const text = typeof textRaw === 'string' ? textRaw.trim().slice(0, 12_000) : ''
  const urlSet = new Set<string>()
  if (typeof urlRaw === 'string' && urlRaw.trim()) urlSet.add(urlRaw.trim().slice(0, 4000))
  extractUrlsFromString(text, urlSet)

  const filesOut: ShareInboxPayloadV1['files'] = []
  const inboxId = crypto.randomUUID()

  for (const [, value] of formData.entries()) {
    if (!(value instanceof File) || !value.size) continue
    if (filesOut.length >= MAX_FILES) break
    if (value.size > MAX_FILE_BYTES) continue

    const buf = Buffer.from(await value.arrayBuffer())
    let r2KeySuffix: string
    let mime: string
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) {
      if (isPdfBuffer(buf)) {
        r2KeySuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeFilename(value.name || 'share.pdf')}`
        if (!r2KeySuffix.toLowerCase().endsWith('.pdf')) r2KeySuffix += '.pdf'
        mime = 'application/pdf'
      } else {
        continue
      }
    } else {
      r2KeySuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeFilename(value.name || `share.${validated.ext}`)}`
      if (!r2KeySuffix.endsWith(`.${validated.ext}`)) {
        r2KeySuffix += `.${validated.ext}`
      }
      mime = validated.mime
    }

    const r2Key = `share-inbox/${inboxId}/${r2KeySuffix}`
    try {
      await r2PutObject(buf, r2Key, mime)
    } catch (e) {
      console.error('[share-receive] R2 put failed', r2Key, e)
      for (const f of filesOut) {
        try {
          await r2DeleteObject(f.r2_key)
        } catch {
          /* noop */
        }
      }
      return redirectWithSessionRefresh(request, triage('?err=save'))
    }

    filesOut.push({
      r2_key: r2Key,
      name: value.name || r2KeySuffix,
      mime,
      bytes: buf.length,
    })
  }

  const urls = [...urlSet].slice(0, 24)
  if (filesOut.length === 0 && urls.length === 0 && !title && !text) {
    return redirectWithSessionRefresh(request, triage('?err=empty'))
  }

  const payload: ShareInboxPayloadV1 = {
    v: 1,
    title: title || null,
    text: text || null,
    urls,
    files: filesOut,
  }

  const expiresAt = new Date(Date.now() + TTL_MS).toISOString()

  const insertRes = NextResponse.redirect(triage('?err=save'), 303)
  const sbIns = supabaseForRedirect(request, insertRes)
  const { data: inserted, error: insErr } = await (sbIns.from('share_inbox') as any)
    .insert({
      id: inboxId,
      user_id: user.id,
      expires_at: expiresAt,
      payload,
    })
    .select('id')
    .maybeSingle()

  if (insErr || !inserted?.id) {
    const msg = String(insErr?.message ?? insErr?.code ?? '')
    console.error('[share-receive] insert failed', insErr)
    if (msg.includes('42P01') || msg.toLowerCase().includes('does not exist')) {
      return redirectWithSessionRefresh(request, triage('?err=schema'))
    }
    for (const f of filesOut) {
      try {
        await r2DeleteObject(f.r2_key)
      } catch {
        /* noop */
      }
    }
    await sbIns.auth.getUser()
    return insertRes
  }

  return redirectWithSessionRefresh(request, triage(`?inbox=${encodeURIComponent(inserted.id)}`))
}

export async function GET(request: NextRequest) {
  const origin = originFromRequest(request)
  return NextResponse.redirect(`${origin}/atelier/share-triage`, 302)
}
