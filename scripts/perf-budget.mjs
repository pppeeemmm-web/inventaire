#!/usr/bin/env node
/**
 * JS budget for the phone's light routes (R2 speed, design rule 6 — docs/design/2026-11-17/PhoneToday.notes.md).
 * Reads the production build output (`.next/`, after `next build`) and adds up the JS a route needs for its
 * first screen: the shared runtime (`rootMainFiles`) + the root layout + the route's layouts + its page.
 * Chunks loaded later (sheets fetched after first paint, other routes) are not counted.
 * Prints raw and gzip bytes per route (`--files`: each file); exits 1 when a route is over budget, 2 when there is no build.
 *
 *   npm run build && npm run perf:budget
 *
 * Budgets = measured on 2026-11-17 + a small margin (see BUDGETS). Raise one only on purpose, with the
 * reason in the commit, never to make the check pass.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const next = path.join(root, '.next')

/** kB = 1000 bytes. Measured 2026-11-17 (this script, build of main + one-language copy), plus ~3 %. */
const BUDGETS = {
  // Measured: 920.1 raw / 271.4 gzip (15 files); was 1108.5 / 334.7 before the copy shipped one language.
  // The design target is < 150 kB gzip: not met yet.
  '/hub': { segments: ['/layout', '/hub/layout', '/hub/page'], rawKB: 950, gzipKB: 280 },
  '/hub/today': { segments: ['/layout', '/hub/layout', '/hub/today/page'], rawKB: 950, gzipKB: 280 },
  // Measured: 667.8 raw / 203.4 gzip (10 files); was 856.3 / 265.9.
  '/hub/fil': { segments: ['/layout', '/hub/layout', '/hub/fil/page'], rawKB: 690, gzipKB: 210 },
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(next, file), 'utf8'))
}

if (!fs.existsSync(path.join(next, 'app-build-manifest.json')) || !fs.existsSync(path.join(next, 'BUILD_ID'))) {
  console.error('[perf:budget] no production build in .next/ — run `npm run build` first.')
  process.exit(2)
}

const buildManifest = readJson('build-manifest.json')
const appManifest = readJson('app-build-manifest.json').pages ?? {}
const shared = buildManifest.rootMainFiles ?? []

const sizeCache = new Map()
function sizes(file) {
  if (!sizeCache.has(file)) {
    const buf = fs.readFileSync(path.join(next, file))
    sizeCache.set(file, { raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length })
  }
  return sizeCache.get(file)
}

const kB = (n) => (n / 1000).toFixed(1)
const verbose = process.argv.includes('--files')
let failed = false
console.log('[perf:budget] first-screen JS per route (kB = 1000 bytes; gzip level 9 ≈ what the phone downloads)')
for (const [route, budget] of Object.entries(BUDGETS)) {
  const missing = budget.segments.filter((s) => !appManifest[s])
  if (missing.length) {
    console.error(`  ${route}: not in the build (${missing.join(', ')}) — fix BUDGETS if the route moved.`)
    failed = true
    continue
  }
  const files = [...new Set([...shared, ...budget.segments.flatMap((s) => appManifest[s])])].filter((f) => f.endsWith('.js'))
  const total = files.reduce((acc, f) => {
    const s = sizes(f)
    return { raw: acc.raw + s.raw, gzip: acc.gzip + s.gzip }
  }, { raw: 0, gzip: 0 })
  const overRaw = budget.rawKB > 0 && total.raw > budget.rawKB * 1000
  const overGzip = budget.gzipKB > 0 && total.gzip > budget.gzipKB * 1000
  const verdict = overRaw || overGzip ? 'OVER BUDGET' : 'ok'
  if (overRaw || overGzip) failed = true
  console.log(
    `  ${route.padEnd(11)} ${String(files.length).padStart(2)} files  raw ${kB(total.raw).padStart(7)} / ${budget.rawKB} kB  gzip ${kB(total.gzip).padStart(6)} / ${budget.gzipKB} kB  ${verdict}`,
  )
  // `--files`: the biggest files first, to see what grew.
  if (verbose) {
    for (const f of [...files].sort((a, b) => sizes(b).gzip - sizes(a).gzip)) {
      console.log(`      ${kB(sizes(f).gzip).padStart(6)} kB gzip  ${f}`)
    }
  }
}
if (failed) {
  console.error('[perf:budget] FAILED: a phone route is over its JS budget (or missing). Find what grew before raising a budget.')
  process.exit(1)
}
