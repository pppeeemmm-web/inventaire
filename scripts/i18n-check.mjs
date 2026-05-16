import { promises as fs } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const sourceDirs = ['app', 'components', 'hooks']
const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx'])
const ignoredParts = new Set(['node_modules', '.next', 'tests'])

const uiCopy = /^[A-ZÀ-Ÿ][a-zà-ÿ\s'’,.!?\-:/]{2,}$/u
const trademarkOk = /^(PDF|R2|API|GitHub|OAuth|JSON|CSV|XLSX|OG|SEO|PEM|URL|UUID|HTML|CSS|JS|TS|FR|EN|UK|EU|RGB|OGP)$/i

function shouldSkipCopy(value) {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length < 4) return true
  if (/^[\s\d.,:%/()[\]{}]+$/.test(trimmed)) return true
  if (/^https?:\/\//i.test(trimmed)) return true
  if (trademarkOk.test(trimmed)) return true
  if (!/[a-zà-ÿ]/i.test(trimmed)) return true
  if (!trimmed.includes(' ') && trimmed.length < 10) return true
  if (/^[^\p{L}]/u.test(trimmed)) return true
  return false
}

function looksLikeUiCopy(value) {
  const trimmed = value.trim()
  if (shouldSkipCopy(trimmed)) return false
  if (/^[A-ZÀ-Ÿ]{2,}$/.test(trimmed.replace(/\s/g, ''))) return false
  return uiCopy.test(trimmed)
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8')
}

async function walk(dir) {
  const absolute = path.join(root, dir)
  const entries = await fs.readdir(absolute, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (ignoredParts.has(entry.name)) continue
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(relative))
    } else if (sourceExts.has(path.extname(entry.name))) {
      files.push(relative)
    }
  }

  return files
}

function parseLegacyKeys(source) {
  return new Set([...source.matchAll(/\|\s*'([^']+)'/g)].map((match) => match[1]))
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return null
}

function collectObjectLiteralKeys(objectLiteral) {
  const keys = new Set()
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const key = propertyNameText(property.name)
    if (key) keys.add(key)
  }
  return keys
}

function unwrapExpression(node) {
  let current = node
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function parseExportedObjectKeys(source, variableName) {
  const file = ts.createSourceFile('messages.ts', source, ts.ScriptTarget.Latest, true)
  const keys = new Set()

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer)
      if (ts.isObjectLiteralExpression(initializer)) {
        for (const key of collectObjectLiteralKeys(initializer)) keys.add(key)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(file)
  return keys
}

function parseDefineMessagesKeys(source) {
  const file = ts.createSourceFile('messages.ts', source, ts.ScriptTarget.Latest, true)
  const keys = new Set()

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineMessages' &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const key of collectObjectLiteralKeys(node.arguments[0])) keys.add(key)
    }
    ts.forEachChild(node, visit)
  }

  visit(file)
  return keys
}

function findHardcodedHotspots(source, relativePath) {
  const hotspots = []
  const patterns = [
    />([^<>{}\n]*[A-Za-zÀ-ÿ][^<>{}\n]*)</g,
    /\b(?:title|placeholder|aria-label|aria-description|alt)=["']([^"']+)["']/g,
    /\b(?:alert|confirm|prompt)\(["']([^"']+)["']\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const text = match[1]
      if (!looksLikeUiCopy(text)) continue
      const line = source.slice(0, match.index).split(/\r?\n/).length
      hotspots.push(`${relativePath}:${line} ${text.trim()}`)
    }
  }

  return hotspots
}

function collectUsedKeys(source) {
  const keys = new Set()
  const patterns = [
    /\bt\(\s*['"]([^'"]+)['"]/g,
    /\bdict(?:\[[^\]]+\])?\[['"]([^'"]+)['"]\]/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      keys.add(match[1])
    }
  }

  return keys
}

function printList(title, items, limit = 30) {
  if (!items.length) return
  console.log(`\n${title}`)
  for (const item of items.slice(0, limit)) {
    console.log(`- ${item}`)
  }
  if (items.length > limit) console.log(`- ... ${items.length - limit} more`)
}

const legacyKeys = parseLegacyKeys(await read('lib/i18n/dictionary/keys.ts'))
const frKeys = parseExportedObjectKeys(await read('lib/i18n/dictionary/fr.ts'), 'fr')
const enKeys = parseExportedObjectKeys(await read('lib/i18n/dictionary/en.ts'), 'en')

const messageFiles = [
  'lib/i18n/messages/atelier.messages.ts',
  'lib/i18n/messages/public.messages.ts',
  'lib/i18n/messages/hub.messages.ts',
  'lib/i18n/messages/work-form.messages.ts',
  'lib/i18n/messages/system.messages.ts',
]

const featureKeys = new Set()
for (const file of messageFiles) {
  for (const key of parseDefineMessagesKeys(await read(file))) featureKeys.add(key)
}

const missingFr = [...legacyKeys].filter((key) => !frKeys.has(key))
const missingEn = [...legacyKeys].filter((key) => !enKeys.has(key))
const extraFr = [...frKeys].filter((key) => !legacyKeys.has(key))
const extraEn = [...enKeys].filter((key) => !legacyKeys.has(key))

const allSourceFiles = (await Promise.all(sourceDirs.map(walk))).flat()
const usedKeys = new Set()
const hotspots = []

for (const relativePath of allSourceFiles) {
  if (/\.spec\.(ts|tsx|js|jsx)$/.test(relativePath)) continue
  const source = await read(relativePath)
  for (const key of collectUsedKeys(source)) usedKeys.add(key)
  hotspots.push(...findHardcodedHotspots(source, relativePath))
}

const allKeys = new Set([...legacyKeys, ...featureKeys])
const unused = [...allKeys].filter((key) => !usedKeys.has(key)).sort()
const missing = [...missingFr.map((key) => `${key} missing in fr.ts`), ...missingEn.map((key) => `${key} missing in en.ts`)]

console.log('i18n check')
console.log(`- legacy keys: ${legacyKeys.size}`)
console.log(`- feature message keys: ${featureKeys.size}`)
console.log(`- scanned source files: ${allSourceFiles.length}`)

printList('Missing translations', missing)
printList('Dictionary keys not declared in keys.ts', [
  ...extraFr.map((key) => `${key} in fr.ts`),
  ...extraEn.map((key) => `${key} in en.ts`),
])
printList('Hardcoded copy hotspots', hotspots)
printList('Possibly unused keys', unused, 40)

if (missing.length) {
  process.exitCode = 1
}
