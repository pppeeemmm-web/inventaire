/**
 * Runs Playwright specs that are gated on ATELIER_E2E=1 (logged-in dev session).
 * Usage: node scripts/run-atelier-e2e.mjs [extra playwright args...]
 *   npm run test:e2e:field
 *   node scripts/run-atelier-e2e.mjs tests/hub-field-launcher.spec.ts
 */
import { spawnSync } from 'node:child_process'

const env = { ...process.env, ATELIER_E2E: '1' }
const userArgs = process.argv.slice(2)
const defaultSpecs = [
  'tests/hub-field-launcher.spec.ts',
  'tests/mobile-sale.spec.ts',
  'tests/hub-mobile-capture.spec.ts',
  'tests/atelier-mobile-action-bar.spec.ts',
  'tests/session-new.spec.ts',
  'tests/session-journal.spec.ts',
  'tests/batch-edit-broadcast-ready.spec.ts',
  'tests/atelier-shell-tab-hop.spec.ts',
]
const pwArgs = userArgs.length > 0 ? userArgs : defaultSpecs
const r = spawnSync('npx', ['playwright', 'test', ...pwArgs], {
  stdio: 'inherit',
  shell: true,
  env,
})
process.exit(typeof r.status === 'number' ? r.status : 1)
