/**
 * Frees TCP 3000 then starts Next dev on 0.0.0.0:3000 (LAN phone testing).
 * Use `npm run dev` — avoids stale listeners when terminals close without Ctrl+C.
 */
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function killListenersOn3000() {
  if (process.platform === 'win32') {
    let out = ''
    try {
      out = execSync('netstat -ano', { encoding: 'utf8', cwd: root })
    } catch {
      return
    }
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue
      const local = parts[1]
      if (!local || !/:3000$/.test(local)) continue
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid)) pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe', cwd: root })
        console.log(`[dev] Freed port 3000 (stopped PID ${pid})`)
      } catch {
        // ignore
      }
    }
    return
  }
  try {
    const out = execSync('lsof -ti:3000', { encoding: 'utf8', cwd: root }).trim()
    if (!out) return
    for (const pid of out.split(/\n/)) {
      if (!/^\d+$/.test(pid)) continue
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'pipe', cwd: root })
        console.log(`[dev] Freed port 3000 (stopped PID ${pid})`)
      } catch {
        // ignore
      }
    }
  } catch {
    // nothing listening or lsof missing
  }
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

killListenersOn3000()

const ip = firstLanIPv4()
console.log('')
console.log('  Local : http://localhost:3000')
if (ip) console.log(`  Phone : http://${ip}:3000`)
console.log('')

const devEnv = { ...process.env }
if (ip) devEnv.DEV_LAN_HOST = ip

const require = createRequire(import.meta.url)
const nextCli = require.resolve('next/dist/bin/next')
const child = spawn(process.execPath, [nextCli, 'dev', '-H', '0.0.0.0', '-p', '3000'], {
  cwd: root,
  stdio: 'inherit',
  env: devEnv,
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
