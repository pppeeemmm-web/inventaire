/**
 * OpenNext deploy (`wrangler deploy`) needs `.open-next/` from `opennextjs-cloudflare build`,
 * not plain `next build` alone.
 *
 * Cloudflare Pages injects CF_PAGES=1 (overridable in dashboard). If CF_PAGES was cleared,
 * CF_PAGES_COMMIT_SHA / CF_PAGES_BRANCH are still usually present for Git-connected builds.
 *
 * Escape hatches:
 *   CF_OPENNEXT_BUILD=1  → always run OpenNext build (e.g. non-Pages Wrangler CI)
 *   CF_OPENNEXT_BUILD=0  → always run `next build` only
 *
 * Vercel / local: none of the above → `next build`.
 */
import { spawnSync } from 'node:child_process'

function useOpenNextBuild() {
  const o = process.env.CF_OPENNEXT_BUILD
  if (o === '0' || o === 'false') return false
  if (o === '1' || o === 'true') return true

  const cf = process.env.CF_PAGES
  if (cf === '1' || cf === 'true') return true

  const sha = (process.env.CF_PAGES_COMMIT_SHA ?? '').trim()
  if (sha.length > 0) return true

  const branch = (process.env.CF_PAGES_BRANCH ?? '').trim()
  if (branch.length > 0) return true

  return false
}

const argv = useOpenNextBuild()
  ? ['opennextjs-cloudflare', 'build']
  : ['next', 'build']
const r = spawnSync('npx', argv, { stdio: 'inherit', shell: true, env: process.env })
process.exit(typeof r.status === 'number' ? r.status : 1)
