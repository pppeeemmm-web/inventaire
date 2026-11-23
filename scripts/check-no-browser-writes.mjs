/**
 * Building principles 2 and 6 (docs/design/2026-11-21/BuildingPrinciples.md), push-blocking.
 *
 * Rule A (principle 2): no table write from a browser file. In every file that starts with 'use client'
 *   under app/, components/, hooks/, lib/, flag  .from('x').insert|update|upsert|delete(  and  .rpc('fn')
 *   of a writing function (a name not starting with a read verb: get/list/search/count/fetch/find/read/
 *   is/has/check/preview/stat — a read RPC with another name is listed in the debt file like any other).
 * Rule B (principle 6): no new revalidatePath('/atelier') (whole-Atelier refresh), anywhere under
 *   app/, components/, hooks/, lib/.
 *
 * Today's offenders live in scripts/principles-debt.json: { writes: {file: n}, atelierRevalidate: {file: n} }.
 * Fails when a file is not listed or its count grows; passes with a « shrink the list » hint when a count
 * drops. `--update` rewrites the debt file from the tree (use only after shrinking, never to grow it).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const debtPath = path.join(root, 'scripts', 'principles-debt.json')
const DIRS = ['app', 'components', 'hooks', 'lib']
const READ_RPC = /^(get|list|search|count|fetch|find|read|is|has|check|preview|stat)/i

async function walk(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(path.join(root, dir), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      out.push(...(await walk(rel)))
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(rel)
  }
  return out
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, '$1')
const isClient = (src) => {
  let s = src.trimStart()
  for (;;) {
    if (s.startsWith('//')) {
      const i = s.indexOf('\n')
      if (i < 0) return false
      s = s.slice(i + 1).trimStart()
    } else if (s.startsWith('/*')) {
      const i = s.indexOf('*/')
      if (i < 0) return false
      s = s.slice(i + 2).trimStart()
    } else break
  }
  return s.startsWith("'use client'") || s.startsWith('"use client"')
}

const writes = {}
const reval = {}
for (const dir of DIRS) {
  for (const file of await walk(dir)) {
    const raw = await fs.readFile(path.join(root, file), 'utf8')
    const src = stripComments(raw)
    const rv = (src.match(/revalidatePath\(\s*['"`]\/atelier['"`]\s*[,)]/g) || []).length
    if (rv) reval[file] = rv
    if (!isClient(raw)) continue
    let n = (src.match(/\.from\(\s*['"`][^'"`]+['"`]\s*\)\s*\.(insert|update|upsert|delete)\s*\(/g) || []).length
    // multi-line chains: .from('x')\n  .update(
    n = Math.max(n, (src.match(/\.from\(\s*['"`][^'"`]+['"`]\s*\)\s*(?:\.\s*(?:select|eq|match)\([^)]*\)\s*)*\.(insert|update|upsert|delete)\s*\(/g) || []).length)
    for (const m of src.matchAll(/\.rpc\(\s*['"`]([A-Za-z0-9_]+)['"`]/g)) if (!READ_RPC.test(m[1])) n++
    if (n) writes[file] = n
  }
}

const current = { writes, atelierRevalidate: reval }
if (process.argv.includes('--update')) {
  await fs.writeFile(debtPath, JSON.stringify(current, null, 2) + '\n')
  console.log('principles:check — debt file rewritten from the tree')
  process.exit(0)
}

let debt = { writes: {}, atelierRevalidate: {} }
try {
  debt = JSON.parse(await fs.readFile(debtPath, 'utf8'))
} catch {
  console.error('principles:check — scripts/principles-debt.json missing or invalid')
  process.exit(1)
}

const labels = {
  writes: 'table write from a browser file (principle 2: one server door per record)',
  atelierRevalidate: "revalidatePath('/atelier') (principle 6: no whole-Atelier refresh)",
}
const fails = []
const shrink = []
for (const key of ['writes', 'atelierRevalidate']) {
  const allowed = debt[key] || {}
  for (const [file, n] of Object.entries(current[key])) {
    if (!(file in allowed)) fails.push(`${file}: ${n} new — ${labels[key]}`)
    else if (n > allowed[file]) fails.push(`${file}: ${allowed[file]} → ${n} — ${labels[key]}`)
    else if (n < allowed[file]) shrink.push(`${file}: ${allowed[file]} → ${n}`)
  }
  for (const file of Object.keys(allowed)) if (!(file in current[key])) shrink.push(`${file}: ${allowed[file]} → 0 (${key})`)
}

if (fails.length) {
  console.error('principles:check FAILED\n' + fails.map((f) => '  ' + f).join('\n'))
  console.error('Move the write behind a server action / SQL door, or drop the revalidate. Never raise the debt file.')
  process.exit(1)
}
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0)
console.log(`principles:check OK — browser writes ${total(current.writes)} in ${Object.keys(current.writes).length} files, atelier revalidate ${total(current.atelierRevalidate)} in ${Object.keys(current.atelierRevalidate).length} files (debt, may only shrink)`)
if (shrink.length) console.log('Debt shrank — run `node scripts/check-no-browser-writes.mjs --update` and commit the smaller list:\n' + shrink.map((s) => '  ' + s).join('\n'))
