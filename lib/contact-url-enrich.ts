/**
 * Deterministic URL → ImportedContact extraction (JSON-LD, meta, mailto/tel),
 * plus optional LLM merge via OpenAI-compatible API or Ollama.
 */

import type { ImportedContact } from '@/lib/contact-import-types'

export type UrlEnrichMeta = {
  sources: string[]
  llm: 'none' | 'openai' | 'ollama'
  llmNote?: string
}

export function emptyImportedContact(): ImportedContact {
  return {
    prenom: null,
    nom: null,
    institution: null,
    role: null,
    notes: null,
    emails: [],
    phones: [],
    addresses: [],
    websites: [],
  }
}

/** Block obvious SSRF targets (localhost / RFC1918 hostnames). */
export function assertSafePublicUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    throw new Error('URL invalide')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Seuls http et https sont autorisés')
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) {
    throw new Error('URL locale interdite')
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) {
    throw new Error('Adresse privée interdite')
  }
  return u
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function metaTag(html: string, attr: 'property' | 'name', key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`,
    'i',
  )
  let m = html.match(re)
  if (m) return decodeEntities(m[1]).trim() || null
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`,
    'i',
  )
  m = html.match(re2)
  return m ? (decodeEntities(m[1]).trim() || null) : null
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ldCollect(o: unknown): Record<string, unknown>[] {
  if (!o || typeof o !== 'object') return []
  if (Array.isArray(o)) return o.flatMap(ldCollect)
  const x = o as Record<string, unknown>
  if (Array.isArray(x['@graph'])) return (x['@graph'] as unknown[]).flatMap(ldCollect)
  return [x]
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node['@type']
  if (!t) return []
  if (typeof t === 'string') return [t]
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string')
  return []
}

function pickStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function extractPostal(addr: unknown): ImportedContact['addresses'][0] | null {
  if (!addr || typeof addr !== 'object') return null
  const a = addr as Record<string, unknown>
  const street = pickStr(a.streetAddress)
  const ville = pickStr(a.addressLocality)
  const cp = pickStr(a.postalCode)
  const pays = pickStr(a.addressCountry)
  if (!street && !ville && !cp && !pays) return null
  return {
    label: 'Principal',
    adresse: street,
    code_postal: cp,
    ville,
    pays,
  }
}

function mergeAddr(into: ImportedContact, a: ImportedContact['addresses'][0]) {
  const dup = into.addresses.some(
    (x) =>
      x.ville === a.ville &&
      x.pays === a.pays &&
      x.adresse === a.adresse &&
      x.code_postal === a.code_postal,
  )
  if (!dup) into.addresses.push(a)
}

/** Parse JSON-LD, meta, mailto/tel, social hints from HTML. */
export function extractContactFromHtml(html: string, pageUrl: string): { draft: ImportedContact; sources: string[]; textSample: string } {
  const sources: string[] = []
  const draft = emptyImportedContact()
  let base: URL
  try {
    base = new URL(pageUrl)
  } catch {
    base = new URL('https://example.com')
  }

  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of scripts) {
    let json: unknown
    try {
      json = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    for (const node of ldCollect(json)) {
      const types = typesOf(node)
      const isOrg =
        types.some((t) =>
          /Organization|LocalBusiness|ArtGallery|Museum|Place|StoreCorporation/i.test(t),
        )
      const isPerson = types.some((t) => /Person/i.test(t))
      if (isOrg) {
        const name =
          pickStr(node.name) ||
          pickStr(node.legalName) ||
          pickStr((node as { alternateName?: unknown }).alternateName)
        if (name) {
          draft.institution = draft.institution || name
          sources.push(`JSON-LD Organization: ${name}`)
        }
        const email = pickStr(node.email)
        if (email) {
          draft.emails.push({ email: email.toLowerCase(), label: 'Principal' })
          sources.push('JSON-LD email')
        }
        const tel = pickStr(node.telephone) || pickStr((node as { tel?: unknown }).tel)
        if (tel) {
          draft.phones.push({ country_code: null, phone: tel.replace(/\s+/g, ' '), label: 'Principal' })
          sources.push('JSON-LD téléphone')
        }
        const url = pickStr(node.url)
        if (url) {
          draft.websites.push({ url, label: 'Site' })
          sources.push('JSON-LD url')
        }
        const same = (node as { sameAs?: unknown }).sameAs
        if (Array.isArray(same)) {
          for (const s of same) {
            const u = pickStr(s)
            if (u) draft.websites.push({ url: u, label: 'Lien' })
          }
          if (same.length) sources.push('JSON-LD sameAs')
        }
        const addr = (node as { address?: unknown }).address
        if (addr) {
          if (typeof addr === 'object' && addr !== null && !Array.isArray(addr)) {
            const ad = extractPostal(addr)
            if (ad) mergeAddr(draft, ad)
          } else if (Array.isArray(addr)) {
            for (const x of addr) {
              const ad = extractPostal(x)
              if (ad) mergeAddr(draft, ad)
            }
          }
          if (draft.addresses.length) sources.push('JSON-LD address')
        }
      }
      if (isPerson) {
        const gn = pickStr(node.givenName)
        const fn = pickStr(node.familyName)
        const n = pickStr(node.name)
        if (gn || fn) {
          draft.prenom = draft.prenom || gn || null
          draft.nom = draft.nom || fn || null
          sources.push('JSON-LD Person')
        } else if (n && !draft.institution) {
          const parts = n.split(/\s+/)
          if (parts.length >= 2) {
            draft.prenom = parts[0]
            draft.nom = parts.slice(1).join(' ')
          } else draft.nom = n
          sources.push('JSON-LD Person name')
        }
        const email = pickStr(node.email)
        if (email) {
          draft.emails.push({ email: email.toLowerCase(), label: 'Personnel' })
          sources.push('JSON-LD Person email')
        }
      }
    }
  }

  const ogTitle = metaTag(html, 'property', 'og:title')
  const ogSite = metaTag(html, 'property', 'og:site_name')
  const ogDesc = metaTag(html, 'property', 'og:description')
  if (ogSite && !draft.institution) {
    draft.institution = ogSite
    sources.push('meta og:site_name')
  }
  if (ogTitle && !draft.institution && !ogSite) {
    draft.institution = ogTitle
    sources.push('meta og:title')
  }
  if (ogDesc) {
    draft.notes = draft.notes ? `${draft.notes}\n${ogDesc}` : ogDesc
    sources.push('meta og:description')
  }

  const tw = metaTag(html, 'name', 'twitter:site') || metaTag(html, 'property', 'twitter:site')
  if (tw && tw.startsWith('@')) {
    draft.notes = draft.notes ? `${draft.notes}\nTwitter: ${tw}` : `Twitter: ${tw}`
    sources.push('twitter meta')
  }

  for (const mm of html.matchAll(/href=["'](mailto:[^"']+)["']/gi)) {
    const raw = mm[1].replace(/^mailto:/i, '').split('?')[0]
    if (raw && !draft.emails.some((e) => e.email === raw.toLowerCase())) {
      draft.emails.push({ email: decodeURIComponent(raw).toLowerCase(), label: 'Web' })
      sources.push('mailto lien')
    }
  }
  for (const tm of html.matchAll(/href=["'](tel:[^"']+)["']/gi)) {
    let digits = tm[1].replace(/^tel:/i, '').replace(/[^\d+]/g, '')
    if (digits && !draft.phones.some((p) => p.phone === digits)) {
      draft.phones.push({ country_code: null, phone: digits.slice(0, 40), label: 'Principal' })
      sources.push('tel lien')
    }
  }

  const origin = `${base.protocol}//${base.host}`
  if (!draft.websites.some((w) => w.url.startsWith(origin))) {
    draft.websites.unshift({ url: pageUrl.split('#')[0], label: 'Site' })
    sources.push('URL page')
  }

  const socialRes = [
    /https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i,
    /https?:\/\/(www\.)?linkedin\.com\/(company|in)\/([a-zA-Z0-9_-]+)/i,
    /https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9_.]+)/i,
  ]
  for (const re of socialRes) {
    const mx = html.match(re)
    if (mx) {
      draft.notes = draft.notes ? `${draft.notes}\n${mx[0]}` : mx[0]
      sources.push('réseau social (page)')
      break
    }
  }

  const textSample = stripTags(html).slice(0, 8000)
  return { draft, sources: [...new Set(sources)], textSample }
}

function dedupeEmails(emails: ImportedContact['emails']) {
  const seen = new Set<string>()
  return emails.filter((e) => {
    const k = e.email.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function dedupePhones(phones: ImportedContact['phones']) {
  const seen = new Set<string>()
  return phones.filter((p) => {
    const k = p.phone
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function parseJsonFromLlm(raw: string): unknown {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : t
  return JSON.parse(body.trim())
}

function normalizeImportedPartial(v: unknown): Partial<ImportedContact> | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const out: Partial<ImportedContact> = {}
  if (typeof o.prenom === 'string' || o.prenom === null) out.prenom = o.prenom as string | null
  if (typeof o.nom === 'string' || o.nom === null) out.nom = o.nom as string | null
  if (typeof o.institution === 'string' || o.institution === null) out.institution = o.institution as string | null
  if (typeof o.role === 'string' || o.role === null) out.role = o.role as string | null
  if (typeof o.notes === 'string' || o.notes === null) out.notes = o.notes as string | null
  if (Array.isArray(o.emails)) out.emails = o.emails as ImportedContact['emails']
  if (Array.isArray(o.phones)) out.phones = o.phones as ImportedContact['phones']
  if (Array.isArray(o.addresses)) out.addresses = o.addresses as ImportedContact['addresses']
  if (Array.isArray(o.websites)) out.websites = o.websites as ImportedContact['websites']
  return out
}

export function mergeImportedContacts(base: ImportedContact, patch: Partial<ImportedContact>): ImportedContact {
  const out: ImportedContact = {
    prenom: patch.prenom ?? base.prenom,
    nom: patch.nom ?? base.nom,
    institution: patch.institution ?? base.institution,
    role: patch.role ?? base.role,
    notes: patch.notes ?? base.notes,
    emails: dedupeEmails([...base.emails, ...(patch.emails ?? [])]),
    phones: dedupePhones([...base.phones, ...(patch.phones ?? [])]),
    addresses: [...base.addresses, ...(patch.addresses ?? [])],
    websites: [...base.websites, ...(patch.websites ?? [])],
  }
  const addrKey = (a: ImportedContact['addresses'][0]) =>
    `${a.adresse}|${a.code_postal}|${a.ville}|${a.pays}`
  const seenA = new Set<string>()
  out.addresses = out.addresses.filter((a) => {
    const k = addrKey(a)
    if (seenA.has(k)) return false
    seenA.add(k)
    return true
  })
  const seenW = new Set<string>()
  out.websites = out.websites.filter((w) => {
    const k = w.url
    if (seenW.has(k)) return false
    seenW.add(k)
    return true
  })
  return out
}

const SYSTEM = `Tu es un assistant qui normalise des fiches contact pour une base CRM artistique.
Réponds UNIQUEMENT par un objet JSON valide (pas de markdown).
Champs possibles: prenom, nom, institution, role, notes (string ou null),
emails: [{ email, label }], phones: [{ country_code, phone, label }],
addresses: [{ label, adresse, code_postal, ville, pays }],
websites: [{ url, label }].
N'invente pas d'emails ou téléphones absents du texte fourni ou des données structurelles déjà extraites.
Tu peux clarifier institution/noms/rôle/notes à partir du texte et des brouillons fournis.`

export async function refineContactWithLlm(
  draft: ImportedContact,
  textSample: string,
  pageUrl: string,
  env: {
    mode: 'openai' | 'ollama'
    openaiBase: string
    openaiKey: string
    openaiModel: string
    ollamaHost: string
    ollamaModel: string
  },
): Promise<{ merged: ImportedContact; llm: 'openai' | 'ollama'; note?: string }> {
  const user = JSON.stringify(
    {
      pageUrl,
      extractedDraft: draft,
      pageTextSample: textSample.slice(0, 6000),
    },
    null,
    0,
  )

  if (env.mode === 'ollama') {
    const host = normalizeOllamaBaseUrl(env.ollamaHost).replace(/\/$/, '')
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.ollamaModel,
        format: 'json',
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Ollama: ${res.status} ${t.slice(0, 200)}`)
    }
    const data = (await res.json()) as { message?: { content?: string } }
    const raw = data.message?.content ?? '{}'
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = parseJsonFromLlm(raw)
    }
    const part = normalizeImportedPartial(parsed)
    if (!part) throw new Error('Réponse IA invalide')
    return { merged: mergeImportedContacts(draft, part), llm: 'ollama' }
  }

  const base = env.openaiBase.replace(/\/$/, '')
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openaiKey}`,
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI-compatible: ${res.status} ${t.slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const raw = data.choices?.[0]?.message?.content ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = parseJsonFromLlm(raw)
  }
  const part = normalizeImportedPartial(parsed)
  if (!part) throw new Error('Réponse IA invalide')
  return { merged: mergeImportedContacts(draft, part), llm: 'openai' }
}

/** Default Ollama HTTP API for this project. */
export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11435'

/**
 * Builds a valid http(s) base URL for Ollama client calls.
 * - Prepends `http://` when the scheme is missing (fixes `0.0.0.0:11435` → invalid fetch URL).
 * - Maps host `0.0.0.0` → `127.0.0.1` (listen address is not a valid outbound target).
 */
export function normalizeOllamaBaseUrl(raw: string): string {
  let s = raw.trim()
  if (!s) return DEFAULT_OLLAMA_URL
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  try {
    const u = new URL(s)
    if (u.hostname === '0.0.0.0') u.hostname = '127.0.0.1'
    return u.origin
  } catch {
    return DEFAULT_OLLAMA_URL
  }
}

/**
 * URL Next uses to call Ollama. Prefer **`OLLAMA_ORIGIN`** in `.env.local` — the same name as
 * `ollama serve`’s `OLLAMA_HOST` is often set in PowerShell (`$env:OLLAMA_HOST=...`) and
 * **shell env overrides `.env.local` in Node**, so you can end up on the wrong port (e.g. 11434).
 */
export function resolveOllamaClientUrl(): string {
  const raw =
    process.env.OLLAMA_ORIGIN?.trim() ||
    process.env.OLLAMA_WEB_URL?.trim() ||
    process.env.OLLAMA_HOST?.trim() ||
    DEFAULT_OLLAMA_URL
  return normalizeOllamaBaseUrl(raw)
}

function hasOllamaConfigured(): boolean {
  return Boolean(
    process.env.OLLAMA_ORIGIN?.trim() ||
      process.env.OLLAMA_WEB_URL?.trim() ||
      process.env.OLLAMA_HOST?.trim(),
  )
}

export function resolveLlmMode(): 'openai' | 'ollama' | 'none' {
  const explicit = process.env.CONTACT_ENRICH_LLM?.toLowerCase()
  if (explicit === 'none') return 'none'
  if (explicit === 'openai') return process.env.OPENAI_API_KEY ? 'openai' : 'none'
  if (explicit === 'ollama') return 'ollama'

  // auto: prefer local Ollama when no OpenAI key, or when any Ollama URL env is set
  if (hasOllamaConfigured() || !process.env.OPENAI_API_KEY) return 'ollama'
  return 'openai'
}
