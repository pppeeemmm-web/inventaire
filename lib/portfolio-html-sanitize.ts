import sanitizeHtml from 'sanitize-html'

/**
 * JSON keys that are fed by TipTap `RichEditor` in Atelier → Public / Portfolio.
 * Plain-text fields (titles, taglines, materials as `<input>`) are intentionally omitted
 * so comparisons like `a < b` in prose are not mangled.
 */
const RICH_HTML_KEYS = new Set([
  'intro_fr',
  'intro_en',
  'description_fr',
  'description_en',
  'approach_fr',
  'approach_en',
  'outro_fr',
  'outro_en',
])

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'h1', 'h2', 'h3', 's', 'u', 'strike'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['style', 'class'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/, /^rgba\(/],
      'font-size': [/^\d+(?:\.\d+)?px$/],
      'line-height': [/^\d+(?:\.\d+)?(?:px)?$/],
    },
  },
}

export function sanitizePortfolioRichHtml(html: string): string {
  if (typeof html !== 'string') return ''
  const s = html.trim()
  if (!s) return ''
  if (!/[<>]/.test(s)) return s
  return sanitizeHtml(s, SANITIZE_OPTS).trim()
}

/** Deep-clone JSON tree and sanitize TipTap HTML fields before R2 / DB persistence. */
export function sanitizePortfolioConfigForPersist(input: Record<string, unknown>): Record<string, unknown> {
  return walk(input) as Record<string, unknown>
}

function walk(node: unknown): unknown {
  if (node === null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(walk)
  const obj = node as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && RICH_HTML_KEYS.has(k)) {
      out[k] = sanitizePortfolioRichHtml(v)
    } else if (v !== null && typeof v === 'object') {
      out[k] = walk(v)
    } else {
      out[k] = v
    }
  }
  return out
}
