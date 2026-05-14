'use strict'

/**
 * Flag sentence-like Latin/French JSX text that should use i18n (t() / dict).
 * Heuristic: starts with uppercase letter, mostly lowercase body, length ≥ 4.
 * Skips whitespace-only, emoji-only, all-caps tokens, digits, URLs, and short single words.
 */

const UI_COPY = /^[A-ZÀ-Ÿ][a-zà-ÿ\s'’,\.!?\-:/]{2,}$/u

const TRADEMARK_OK = /^(PDF|R2|API|GitHub|OAuth|JSON|CSV|XLSX|OG|SEO|PEM|URL|UUID|HTML|CSS|JS|TS|FR|EN|UK|EU|RGB|OGP)$/i

function shouldSkip(trimmed) {
  if (!trimmed || trimmed.length < 4) return true
  if (/^[\s\d.,:%/()[\]{}]+$/.test(trimmed)) return true
  if (/^https?:\/\//i.test(trimmed)) return true
  if (TRADEMARK_OK.test(trimmed)) return true
  if (!/[a-zà-ÿ]/i.test(trimmed)) return true
  if (!trimmed.includes(' ') && trimmed.length < 10) return true
  if (/^[^\p{L}]/u.test(trimmed)) return true
  return false
}

function looksLikeUiCopy(t) {
  const s = t.trim()
  if (shouldSkip(s)) return false
  if (/^[A-ZÀ-Ÿ]{2,}$/.test(s.replace(/\s/g, ''))) return false
  return UI_COPY.test(s)
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow sentence-like hardcoded JSX text; use useI18n().t or dict.',
    },
    schema: [],
    messages: {
      useI18n:
        'Hardcoded JSX copy — move to lib/i18n/dictionary.ts and use t() or dict[lang][key].',
    },
  },
  create(context) {
    return {
      JSXText(node) {
        const raw = node.value
        if (!raw || !/\S/.test(raw)) return
        if (looksLikeUiCopy(raw)) {
          context.report({ node, messageId: 'useI18n' })
        }
      },
    }
  },
}
