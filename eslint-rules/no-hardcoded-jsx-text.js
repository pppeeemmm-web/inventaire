'use strict'

/**
 * Flag sentence-like Latin/French JSX text that should use i18n (t() / dict).
 * Heuristic: starts with uppercase letter, mostly lowercase body, length ≥ 4.
 * Skips whitespace-only, emoji-only, all-caps tokens, digits, URLs, and short single words.
 */

const UI_COPY = /^[A-ZÀ-Ÿ][a-zà-ÿ\s'’,\.!?\-:/]{2,}$/u

const TRADEMARK_OK = /^(PDF|R2|API|GitHub|OAuth|JSON|CSV|XLSX|OG|SEO|PEM|URL|UUID|HTML|CSS|JS|TS|FR|EN|UK|EU|RGB|OGP)$/i
const JSX_COPY_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'alt',
  'placeholder',
  'title',
])
const DIALOG_CALLS = new Set(['alert', 'confirm', 'prompt'])

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

function staticString(node) {
  if (!node) return null
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (
    node.type === 'JSXExpressionContainer' &&
    node.expression.type === 'Literal' &&
    typeof node.expression.value === 'string'
  ) {
    return node.expression.value
  }
  return null
}

function jsxAttributeName(node) {
  if (!node || !node.name) return null
  if (node.name.type === 'JSXIdentifier') return node.name.name
  if (node.name.type === 'JSXNamespacedName') {
    return `${node.name.namespace.name}:${node.name.name.name}`
  }
  return null
}

function callName(node) {
  if (!node) return null
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression' && node.property.type === 'Identifier') {
    return node.property.name
  }
  return null
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
      JSXAttribute(node) {
        const name = jsxAttributeName(node)
        if (!name || !JSX_COPY_ATTRIBUTES.has(name)) return
        const raw = staticString(node.value)
        if (raw && looksLikeUiCopy(raw)) {
          context.report({ node, messageId: 'useI18n' })
        }
      },
      CallExpression(node) {
        const name = callName(node.callee)
        if (!name || !DIALOG_CALLS.has(name)) return
        const raw = staticString(node.arguments[0])
        if (raw && looksLikeUiCopy(raw)) {
          context.report({ node, messageId: 'useI18n' })
        }
      },
    }
  },
}
