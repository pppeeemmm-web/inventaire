// PreToolUse guards in Node (2026-11-28, Pem « go wave 2 »): the .ps1 versions never ran in cloud sessions (no pwsh).
// Same rules as commit-guard.ps1 / pre-push-checks.ps1 / agent-guard.ps1, one file:
//   node guard.mjs commit — `git commit` refused with no staged source file, or with unstaged source files left.
//   node guard.mjs push   — force push refused; push allowed from `main` with a clean tree; from a `claude/…` branch
//                           with a clean tree only in a cloud session (CLAUDE.md: work Pem does not watch → branch →
//                           draft PR); any other branch refused.
//   node guard.mjs agent  — subagents only scout / builder / flow-reviewer (the others inherit the top model).
// Exit 2 + stderr blocks the call (Claude Code PreToolUse); exit 0 with no output lets it through.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const mode = process.argv[2]
let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  let input = {}
  try {
    input = JSON.parse(raw || '{}')
  } catch {
    input = {}
  }
  try {
    run(input)
  } catch (e) {
    block(`Guard (${mode}) failed before it could verify safety: ${e instanceof Error ? e.message : e}. Inspect .claude/hooks/guard.mjs.`)
  }
})

function block(msg) {
  process.stderr.write(msg + '\n')
  process.exit(2)
}

function run(input) {
  if (mode === 'agent') {
    const t = input?.tool_input?.subagent_type
    if (['scout', 'builder', 'flow-reviewer'].includes(t)) process.exit(0)
    block(`Agent guard: '${t}' inherits the main model (token burn). Use scout (read-only search), builder (mechanical edit), or flow-reviewer. Max 3 subagents at once; long work = new session or cloud.`)
  }

  const cmd = String(input?.tool_input?.command ?? input?.command ?? '')
  // The session's folder (a worktree session is checked against its own tree, not the main checkout).
  const cwd = typeof input?.cwd === 'string' && existsSync(input.cwd) ? input.cwd : process.cwd()
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|md|mdx|mdc|json|sql|ps1|yml|yaml)$/
  const sources = (out) => out.split('\n').filter((f) => f && SOURCE.test(f) && !/(^|\/)(\.next|node_modules|test-results|playwright-report)\//.test(f) && f !== 'tsconfig.tsbuildinfo')

  if (mode === 'commit') {
    if (!/(^|[;&|]\s*)git\s+commit(\s|$)/.test(cmd)) process.exit(0)
    // `git add … && git commit` in one command: this runs before the add, so the index cannot be judged yet.
    const at = cmd.search(/(^|[;&|]\s*)git\s+commit(\s|$)/)
    if (/(^|[;&|]\s*)git\s+add(\s|$)/.test(cmd.slice(0, at))) process.exit(0)
    if (!sources(git('diff', '--cached', '--name-only', '--diff-filter=ACMRT')).length) {
      block('Commit blocked: no staged source files were found. Stage the intended source files before committing, and do not commit build artifacts.')
    }
    const unstaged = sources(git('diff', '--name-only', '--diff-filter=ACMRT'))
    if (unstaged.length) {
      block(`Commit blocked: unstaged source files remain: ${unstaged.slice(0, 12).join(', ')}. Run git diff --stat, decide whether they belong in the commit, and stage all intended source changes before committing.`)
    }
    process.exit(0)
  }

  if (mode === 'push') {
    if (!/(^|[;&|]\s*)git\s+push(\s|$)/.test(cmd)) process.exit(0)
    if (/\s(--force|-f|--force-with-lease)(\s|$)/.test(cmd) || /\s\+\S+/.test(cmd.replace(/^.*?git\s+push/, ' '))) {
      block('Push blocked: force push is not allowed without explicit owner approval.')
    }
    const branch = git('branch', '--show-current')
    if (!branch) block('Push blocked: could not determine the current branch. Inspect git branch state before pushing.')
    const cloud = !!process.env.CCR_AGENT_PROXY_ENABLED
    if (branch !== 'main' && !(cloud && branch.startsWith('claude/'))) {
      block(`Push blocked: current branch is '${branch}', not 'main'. origin/main is release truth; a cloud session pushes only its own claude/… branch.`)
    }
    if (git('status', '--porcelain')) block('Push blocked: working tree is dirty. Commit or explicitly leave local draft files before pushing.')
    process.exit(0)
  }

  process.exit(0)
}
