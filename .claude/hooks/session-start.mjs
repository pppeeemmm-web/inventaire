// SessionStart hook (owner GO 2026-11-18; Node since 2026-11-28 — `pwsh` is not installed in cloud sessions, so the
// PowerShell version never ran there). Every session opens knowing: the git state, every branch with work not on
// main (Pem 2026-11-28: a design left on an unmerged branch was missed by the next session), the read order and
// STATE's next actions. Read only; one `git fetch`. stdout goes into the session's context: keep it short.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}
const read = (p) => {
  try {
    return readFileSync(join(root, p), 'utf8')
  } catch {
    return ''
  }
}
const out = []

git('fetch', '--quiet', '--prune', 'origin')
out.push('## Session start (auto: .claude/hooks/session-start.mjs)', '```', ...git('status', '--short', '--branch').split('\n').slice(0, 25), '```')
const ahead = git('log', '--oneline', 'origin/main..HEAD').split('\n').filter(Boolean)
out.push(ahead.length ? `This checkout: ${ahead.length} commit(s) not on origin/main.` : 'This checkout: HEAD == origin/main.')

// Every remote branch holding commits that are not on main — unmerged work the next session must know about.
const here = git('rev-parse', '--abbrev-ref', 'HEAD')
const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin').split('\n')
  .filter((b) => b && b !== 'origin/main' && b !== 'origin/HEAD' && b !== 'origin')
const open = []
for (const b of branches) {
  const n = Number(git('rev-list', '--count', `origin/main..${b}`)) || 0
  if (!n) continue
  const last = git('log', '-1', '--format=%cs %s', b)
  const docs = git('diff', '--name-only', `origin/main...${b}`, '--', 'docs/agent', 'docs/TODO.md', 'docs/design').split('\n').filter(Boolean)
  const mark = b === `origin/${here}` ? ' (this checkout)' : ''
  open.push(`- ${b}${mark}: ${n} commit(s), last ${last}${docs.length ? ` — touches ${docs.slice(0, 4).join(', ')}${docs.length > 4 ? ` +${docs.length - 4}` : ''}` : ''}`)
}
if (open.length) out.push('', `**Unmerged branches (${open.length}) — read their STATE / LOG / design changes before planning:**`, ...open.slice(0, 15))
else out.push('No unmerged branches on origin.')

const readOrder = read('docs/README.md').split('\n').find((l) => l.startsWith('**Read order'))
if (readOrder) out.push('', `docs/README.md: ${readOrder}`)

// STATE's next actions (the repository is the only memory between sessions).
const state = read('docs/agent/STATE.md')
const at = state.indexOf('## Next actions')
if (at >= 0) out.push('', ...state.slice(at).split('\n').slice(0, 14))

process.stdout.write(out.join('\n') + '\n')
