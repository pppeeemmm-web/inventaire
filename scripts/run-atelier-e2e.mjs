/**
 * Runs Playwright specs that are gated on ATELIER_E2E=1 (logged-in dev session).
 * Usage: node scripts/run-atelier-e2e.mjs [--target live|stress] [extra playwright args...]
 *   npm run test:e2e:field                       (live dev server on :3000 — specs tagged @writes are skipped)
 *   node scripts/run-atelier-e2e.mjs tests/hub-field-launcher.spec.ts
 *   npm run test:e2e:stress                      (the throwaway copy: scripts/stress/e2e.mjs, which calls this with --target stress)
 * --target stress: base URL http://127.0.0.1:$STRESS_PORT (3077); refuses unless that server answers with the
 * x-stress-copy header (set only by scripts/stress/run-stress-dev.mjs). --target live refuses a spec file tagged @writes.
 * Design: docs/design/2026-11-23/TestsOnDockerCopy.md.
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const defaultSpecs = [
  'tests/hub-field-launcher.spec.ts',
  'tests/mobile-sale.spec.ts',
  'tests/hub-mobile-capture.spec.ts',
  'tests/atelier-mobile-action-bar.spec.ts',
  'tests/phone-pattern.spec.ts',
  'tests/session-new.spec.ts',
  'tests/session-journal.spec.ts',
  'tests/batch-edit-broadcast-ready.spec.ts',
  'tests/atelier-shell-tab-hop.spec.ts',
]

const args = process.argv.slice(2)
let target = process.env.E2E_TARGET || 'live'
const ti = args.indexOf('--target')
if (ti >= 0) {
  target = args[ti + 1]
  args.splice(ti, 2)
}
if (target !== 'live' && target !== 'stress') {
  console.error(`[e2e] --target must be live or stress (got ${target})`)
  process.exit(2)
}

const env = { ...process.env, ATELIER_E2E: '1', E2E_TARGET: target }
if (target === 'stress') {
  const base = `http://127.0.0.1:${Number(process.env.STRESS_PORT) || 3077}`
  let marker = null
  try {
    const r = await fetch(`${base}/login`, { redirect: 'manual', signal: AbortSignal.timeout(60_000) })
    marker = r.headers.get('x-stress-copy')
  } catch (e) {
    console.error(`[e2e] Refusing: no server on ${base} (${e.message}). Start the copy: npm run test:e2e:stress`)
    process.exit(2)
  }
  if (marker !== '1') {
    console.error(`[e2e] Refusing: ${base} is not the throwaway copy (no x-stress-copy header). Restart it with scripts/stress/run-stress-dev.mjs.`)
    process.exit(2)
  }
  env.PLAYWRIGHT_BASE_URL = base
} else {
  delete env.PLAYWRIGHT_BASE_URL // live: playwright.config.ts starts / reuses :3000
  const tagged = args.filter((a) => a.endsWith('.ts') && fs.existsSync(a) && fs.readFileSync(a, 'utf8').includes('@writes'))
  if (tagged.length > 0) {
    console.error(`[e2e] Refusing: ${tagged.join(', ')} write(s) data (@writes) — run with --target stress, never on live.`)
    process.exit(2)
  }
}

// No spec named (flags only, e.g. --reporter=list,json) → the default field specs.
const pwArgs = args.some((a) => !a.startsWith('-')) ? args : [...defaultSpecs, ...args]
const r = spawnSync('npx', ['playwright', 'test', ...pwArgs], { stdio: 'inherit', shell: true, env })
process.exit(typeof r.status === 'number' ? r.status : 1)
