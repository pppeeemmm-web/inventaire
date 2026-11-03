/**
 * Starts Next dev on 0.0.0.0:<PORT|3000> (LAN phone testing).
 * Port already taken → refuse (it may be another session's server).
 * `npm run dev -- --force` stops the listener first (stale server from a closed terminal).
 */
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const port = Number(process.env.PORT) || 3000
const force = process.argv.includes('--force')

function listenerPids() {
  const pids = new Set()
  if (process.platform === 'win32') {
    let out = ''
    try {
      out = execSync('netstat -ano', { encoding: 'utf8', cwd: root })
    } catch {
      return pids
    }
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue
      const local = parts[1]
      if (!local || !local.endsWith(`:${port}`)) continue
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
    return pids
  }
  try {
    const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8', cwd: root }).trim()
    for (const pid of out.split(/\n/)) if (/^\d+$/.test(pid)) pids.add(pid)
  } catch {
    // nothing listening or lsof missing
  }
  return pids
}

function stopPid(pid) {
  const cmd = process.platform === 'win32' ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`
  try {
    execSync(cmd, { stdio: 'pipe', cwd: root })
    console.log(`[dev] Freed port ${port} (stopped PID ${pid})`)
  } catch {
    // already gone
  }
}

function ensurePortFree() {
  const pids = listenerPids()
  if (pids.size === 0) return
  if (force) {
    for (const pid of pids) stopPid(pid)
    return
  }
  const list = [...pids].join(', ')
  console.error(`[dev] Port ${port} is already in use (PID ${list}) — maybe another session's dev server.`)
  console.error(`[dev] Reuse http://localhost:${port}, or if it is a stale server of yours: npm run dev -- --force`)
  process.exit(1)
}

function firstLanIPv4() {
  const nets = os.networkInterfaces()
  for (const list of Object.values(nets)) {
    if (!list) continue
    for (const n of list) {
      const fam = n.family
      const is4 = fam === 'IPv4' || fam === 4
      if (is4 && !n.internal && n.address && !n.address.startsWith('169.')) {
        return n.address
      }
    }
  }
  return null
}

ensurePortFree()

const ip = firstLanIPv4()
console.log('')
console.log(`  Local : http://localhost:${port}`)
if (ip) console.log(`  Phone : http://${ip}:${port}`)
console.log('')

const devEnv = { ...process.env }
if (ip) devEnv.DEV_LAN_HOST = ip

const require = createRequire(import.meta.url)
const nextCli = require.resolve('next/dist/bin/next')
const child = spawn(process.execPath, [nextCli, 'dev', '-H', '0.0.0.0', '-p', String(port)], {
  cwd: root,
  stdio: 'inherit',
  env: devEnv,
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
