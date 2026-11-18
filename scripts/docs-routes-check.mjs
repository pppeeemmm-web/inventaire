/**
 * Every page and route handler is in SITE_MAP.md (Pem 2026-11-18: « Yes, both » — docs drift when nothing
 * checks them). Blocking in CI and in ship.ps1, like i18n:check.
 *
 * Each page.tsx under app/ → its URL (route groups « (x) » dropped) must appear in SITE_MAP.md in backticks,
 * followed by a backtick, « ? », « / » or a space. A dynamic segment « [id] » matches any text there.
 * A route.ts passes the same way, or by a link to its file (app/api/.../route.ts).
 *
 * Also (2026-11-18, Pem GO on the docs tidy): every relative markdown link in the live docs — SITE_MAP.md, the
 * CLAUDE.md files, docs/*.md (not docs/archive/ or docs/design/: dated history) — must point to a file or
 * folder that exists, resolved from the linking file's folder.
 */
import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

async function walk(dir) {
  const out = []
  for (const e of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...(await walk(rel)))
    else if (e.name === 'page.tsx' || e.name === 'route.ts') out.push(rel)
  }
  return out
}

const esc = (s) => s.replace(/[.*+?^${}()|\\]/g, '\\$&')

const siteMap = await fs.readFile(path.join(root, 'SITE_MAP.md'), 'utf8')
const files = await walk('app')
const missing = []

for (const file of files) {
  const url =
    file
      .replace(/^app/, '')
      .replace(/\/(page\.tsx|route\.ts)$/, '')
      .replace(/\/\([^)]*\)/g, '') || '/'
  const pattern = url
    .split(/(\[[^\]]*\])/)
    .map((part) => (part.startsWith('[') ? '[^`]*' : esc(part)))
    .join('')
  const asUrl = new RegExp('`' + pattern + '[`?/ ]')
  const asFile = file.endsWith('route.ts') && siteMap.includes(file)
  if (!asUrl.test(siteMap) && !asFile) missing.push(`${url}  (${file})`)
}

// Dead links in the live docs.
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'SITE_MAP.md', '*CLAUDE.md', 'docs/*.md'], { encoding: 'utf8' })
  .split('\0')
  .filter((f) => f && !f.startsWith('docs/archive/') && !f.startsWith('docs/design/') && !f.startsWith('node_modules/'))
const linkRe = /\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g
const dead = []
for (const doc of tracked) {
  const text = await fs.readFile(path.join(root, doc), 'utf8')
  for (const m of text.matchAll(linkRe)) {
    const target = m[1].split('#')[0]
    if (!target || /^(https?:|mailto:)/.test(target)) continue
    const abs = path.resolve(root, path.dirname(doc), decodeURI(target))
    try {
      await fs.access(abs)
    } catch {
      dead.push(`${doc}:${text.slice(0, m.index).split('\n').length}  ${m[1]}`)
    }
  }
}

if (missing.length || dead.length) {
  if (missing.length) {
    console.error(`docs:routes:check — ${missing.length} route(s) not in SITE_MAP.md:`)
    for (const m of missing) console.error(`  ${m}`)
    console.error('Add a row for each (what it is, who sees it, its main files), then run again.')
  }
  if (dead.length) {
    console.error(`docs:routes:check — ${dead.length} dead link(s) in the live docs:`)
    for (const d of dead) console.error(`  ${d}`)
    console.error('Point each to the file where it lives now (links resolve from the linking file\'s folder), or drop it.')
  }
  process.exit(1)
}
console.log(`docs:routes:check — all ${files.length} pages and route handlers are in SITE_MAP.md; ${tracked.length} docs, no dead link`)
