/**
 * One-off generator: splits lib/i18n/dictionary.ts into lib/i18n/dictionary/*.ts
 * Run from repo root: node scripts/split-dictionary-once.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcPath = path.join(root, 'lib/i18n/dictionary.ts')
const raw = fs.readFileSync(srcPath, 'utf8')
if (raw.includes("from './dictionary/index'")) {
  console.error(
    '[split-dictionary-once] Already applied: dictionary.ts re-exports from ./dictionary/. Do not re-run.',
  )
  process.exit(1)
}
const lines = raw.split(/\r?\n/)

const keyLines = lines.slice(7, 395)
const keysTs =
  '/**\n * Every key must exist in both `fr.ts` and `en.ts`.\n */\n' +
  keyLines.join('\n') +
  '\n'

const strip = (s) => (s.startsWith('    ') ? s.slice(4) : s)
const frBody = lines.slice(399, 1818).map(strip).join('\n')
const enBody = lines.slice(1820, 3236).map(strip).join('\n')

const outDir = path.join(root, 'lib/i18n/dictionary')
fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(path.join(outDir, 'keys.ts'), keysTs)
fs.writeFileSync(
  path.join(outDir, 'types.ts'),
  `import type { DictKey } from './keys'

export type Lang = 'fr' | 'en'

export type Dictionary = Record<DictKey, string>
`,
)
fs.writeFileSync(
  path.join(outDir, 'fr.ts'),
  `import type { Dictionary } from './types'

export const fr = {
${frBody}
} satisfies Dictionary
`,
)
fs.writeFileSync(
  path.join(outDir, 'en.ts'),
  `import type { Dictionary } from './types'

export const en = {
${enBody}
} satisfies Dictionary
`,
)
fs.writeFileSync(
  path.join(outDir, 'index.ts'),
  `import type { Lang, Dictionary } from './types'
import { fr } from './fr'
import { en } from './en'

export type { DictKey } from './keys'
export type { Lang, Dictionary } from './types'

export const dict: Record<Lang, Dictionary> = { fr, en }
`,
)

console.log('OK →', outDir)
