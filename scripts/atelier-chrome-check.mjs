/**
 * Atelier chrome invariants (BottomStack modals, portal shell persistence).
 * Blocking in CI — same ratchet pattern as scripts/i18n-check.mjs.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

async function read(rel) {
  return fs.readFile(path.join(root, rel), 'utf8')
}

async function walk(dir) {
  const abs = path.join(root, dir)
  let entries
  try {
    entries = await fs.readdir(abs, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const e of entries) {
    const rel = path.join(dir, e.name).replace(/\\/g, '/')
    if (e.isDirectory()) out.push(...(await walk(rel)))
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(rel)
  }
  return out
}

const failures = []

function fail(msg) {
  failures.push(msg)
}

const PORTAL_LAYOUT = 'app/atelier/(portal)/layout.tsx'
const PORTAL_TAB_PAGE = 'app/atelier/(portal)/portal-tab-page.tsx'
const LOADER = 'lib/atelier/load-atelier-shell-props.ts'
const TEAM_PORTAL = 'components/atelier/TeamPortalClient.tsx'
const MODAL_FILES = [
  'components/atelier/BatchEditModal.tsx',
  'components/atelier/ExportModal.tsx',
  'components/atelier/CatalogPersistModal.tsx',
]

const layoutSrc = await read(PORTAL_LAYOUT)
if (!layoutSrc.includes('shellPersistsAcrossTabs: true')) {
  fail(`${PORTAL_LAYOUT} must call loadAtelierShellProps({ shellPersistsAcrossTabs: true })`)
}
if (!layoutSrc.includes('AtelierTeamPortalLoader')) {
  fail(`${PORTAL_LAYOUT} must render AtelierTeamPortalLoader (shared shell across segment tabs)`)
}

const tabPageSrc = await read(PORTAL_TAB_PAGE)
if (!/export default function AtelierPortalTabPage\(\)[\s\S]*return null/.test(tabPageSrc)) {
  fail(`${PORTAL_TAB_PAGE} must return null — shell lives in (portal)/layout.tsx only`)
}

for (const rel of await walk('app/atelier/(portal)')) {
  if (rel === PORTAL_LAYOUT) continue
  if (!rel.endsWith('page.tsx')) continue
  const src = await read(rel)
  if (src.includes('loadAtelierShellProps')) {
    fail(`${rel} must not call loadAtelierShellProps — use ${PORTAL_LAYOUT}`)
  }
}

const loaderSrc = await read(LOADER)
if (/atelierShellNonce:\s*Date\.now\(\)/.test(loaderSrc)) {
  fail(`${LOADER} must not set atelierShellNonce from Date.now() when shell persists across tabs`)
}

const teamSrc = await read(TEAM_PORTAL)
if (!teamSrc.includes('BottomStackLayer')) {
  fail(`${TEAM_PORTAL} must wrap bottom chrome in BottomStackLayer (pointer-events opt-in)`)
}
if (!teamSrc.includes('layer="curationDock"')) {
  fail(`${TEAM_PORTAL} must use BottomStackLayer layer="curationDock" for CurationDock`)
}
if (!teamSrc.includes('shellPersistsAcrossTabs && postPaintLoadedRef.current')) {
  fail(`${TEAM_PORTAL} must skip duplicate postPaint when shellPersistsAcrossTabs`)
}

for (const rel of MODAL_FILES) {
  const src = await read(rel)
  if (!src.includes('PemModalOverlay')) {
    fail(`${rel} must use PemModalOverlay (portaled — not trapped in BottomStack z-index 40)`)
  }
}

const pemOverlaySrc = await read('components/shared/PemModalOverlay.tsx')
if (!pemOverlaySrc.includes('createPortal')) {
  fail('components/shared/PemModalOverlay.tsx must portal to document.body')
}

/** Full-screen fixed overlays inside BottomStack consumers (except allowlist). */
const bottomStackAllowlist = new Set([
  'components/shared/BottomStack.tsx',
  'components/shared/PemModalOverlay.tsx',
  'components/shared/VoiceNoteSheet.tsx',
  ...MODAL_FILES,
])

/** z-index 80/90/modal inside BottomStack stack context = dead modal (CompareModal uses 1000 outside stack). */
const trappedModalRe =
  /position:\s*['"]fixed['"][\s\S]{0,500}?inset:\s*0[\s\S]{0,220}?zIndex:\s*(?:PEM_Z_INDEX\.modal|80|90)\b/

for (const rel of await walk('components')) {
  const src = await read(rel)
  if (!src.includes('BottomStack') && !src.includes("from '@/components/shared/BottomStack'")) continue
  if (bottomStackAllowlist.has(rel)) continue
  if (trappedModalRe.test(src) && !src.includes('PemModalOverlay')) {
    fail(`${rel} imports BottomStack and defines a trapped modal overlay — use PemModalOverlay`)
  }
}

console.log('atelier chrome check')
console.log(`- portal layout: ${PORTAL_LAYOUT}`)
console.log(`- modal files: ${MODAL_FILES.length}`)
console.log(`- failures: ${failures.length}`)

if (failures.length) {
  console.error('\natelier:chrome:check FAILED:')
  for (const f of failures) console.error(`  • ${f}`)
  process.exitCode = 1
} else {
  console.log('\natelier:chrome:check passed.')
}
