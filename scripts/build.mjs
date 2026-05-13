/**
 * Cloudflare Pages sets CF_PAGES=1 during the build phase.
 * OpenNext deploy expects `opennextjs-cloudflare build` output (.open-next/), not plain `next build` alone.
 * Vercel and local dev leave CF_PAGES unset → standard `next build`.
 */
import { spawnSync } from 'node:child_process'

const useOpenNext =
  process.env.CF_PAGES === '1' ||
  process.env.CF_PAGES === 'true'
const argv = useOpenNext ? ['opennextjs-cloudflare', 'build'] : ['next', 'build']
const r = spawnSync('npx', argv, { stdio: 'inherit', shell: true, env: process.env })
process.exit(typeof r.status === 'number' ? r.status : 1)
