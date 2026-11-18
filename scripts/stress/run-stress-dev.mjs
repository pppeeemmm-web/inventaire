// Stress dev server: Next dev on :3077 against the LOCAL Supabase + the local R2 stub.
// Writes scripts/stress/dump/stress.env (gitignored) from `supabase status`, then starts
// `next dev` with those values in process.env (Next never overrides an existing variable).
// Refuses when a .env.local sits next to it (it would leak production keys into unset names)
// or when any value points at the production project.
// Usage: node scripts/stress/run-stress-dev.mjs   (start the R2 stub first: node scripts/stress/r2-stub.mjs)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localEnv } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const PORT = Number(process.env.STRESS_PORT) || 3077;
if (fs.existsSync(path.join(root, '.env.local'))) throw new Error('Refusing: .env.local present in this checkout (production keys). Run from a worktree without it.');

const sb = localEnv();
const secret = () => crypto.randomBytes(24).toString('hex');
const env = {
  NEXT_PUBLIC_SUPABASE_URL: sb.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: sb.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: sb.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  R2_ACCOUNT_ID: 'stress',
  R2_ACCESS_KEY_ID: 'stress',
  R2_SECRET_ACCESS_KEY: 'stress',
  R2_BUCKET: 'paintings',
  R2_VAULT_BUCKET: 'vault',
  R2_S3_HOST: 'localhost:9443',
  NEXT_PUBLIC_R2_PUBLIC_URL: 'http://localhost:9444',
  CALENDAR_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  CALENDAR_OAUTH_STATE_SECRET: secret(),
  INVENTORY_BROADCAST_SECRET: secret(),
  NODE_TLS_REJECT_UNAUTHORIZED: '0', // self-signed local R2 stub only
  NEXT_TELEMETRY_DISABLED: '1',
};
const dump = JSON.stringify(env);
if (/mcrzsxrcoexnlwmaunte|cloudflarestorage|thepemworkshop/.test(dump)) throw new Error('Refusing: production value in stress env');
fs.writeFileSync(path.join(here, 'dump', 'stress.env'), Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');

// --prod: next build (stress env baked into NEXT_PUBLIC_*), then next start (--build-only / --no-build split the two) — stable memory, real timings.
const PROD = process.argv.includes('--prod');
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const childEnv = { ...process.env, ...env, PORT: String(PORT), NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${pathToFileURL(path.join(here, 'net-guard.mjs')).href}`.trim() };
if (PROD && !process.argv.includes('--no-build')) {
  const { spawnSync } = await import('node:child_process');
  const b = spawnSync(process.execPath, [nextBin, 'build'], { cwd: root, stdio: 'inherit', env: { ...childEnv, NODE_ENV: 'production' } });
  if (b.status !== 0 || process.argv.includes('--build-only')) process.exit(b.status ?? 1);
}
const child = spawn(process.execPath, [nextBin, PROD ? 'start' : 'dev', '-p', String(PORT), '-H', '127.0.0.1'], {
  cwd: root, stdio: 'inherit', env: PROD ? { ...childEnv, NODE_ENV: 'production' } : childEnv,
});
child.on('exit', (code, signal) => { console.error(`[stress] next exited code=${code} signal=${signal} at ${new Date().toISOString()}`); process.exit(code ?? 0); });
