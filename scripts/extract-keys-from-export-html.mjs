/**
 * Read portfolio HTML export; extract R2 main keys from <img src="...r2.../W_..."> (full image = source of truth).
 * Usage:
 *   node scripts/extract-keys-from-export-html.mjs export.html > keys.txt
 *   node scripts/extract-keys-from-export-html.mjs --comma export.html
 */
import { readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const asComma = argv.includes('--comma')
const p = argv.find((a) => !a.startsWith('-'))
if (!p) {
  console.error(
    'Usage: node scripts/extract-keys-from-export-html.mjs [--comma] <export.html>',
  )
  process.exit(1)
}
const html = readFileSync(p, 'utf8')
const keys = []
for (const m of html.matchAll(/r2\.dev\/([^"?\s#]+)/gi)) {
  keys.push(decodeURIComponent(m[1]))
}
if (!keys.length) {
  console.error('No r2.dev URLs found.')
  process.exit(1)
}
console.log(asComma ? keys.join(',') : keys.join('\n'))
console.error(`count=${keys.length}`)
