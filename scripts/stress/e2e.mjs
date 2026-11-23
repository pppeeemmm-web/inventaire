// One command: the field e2e specs on the throwaway copy, never on the live catalogue (docs/design/2026-11-23/TestsOnDockerCopy.md).
// Usage (from the main checkout):  npm run test:e2e:stress [-- tests/x.spec.ts ...]
//   1. live counts BEFORE (oeuvre_versions, work_order) — read only, Management API read-only endpoint, keys stay in this process
//   2. up.ps1 -Prepare: Docker, ..\app-worktrees\stress-live at this checkout's commit + its uncommitted changes, the copy's database
//   3. reseed only when stale: no seed mark, seed.mjs changed, or the fake team login / works are missing
//   4. fake image storage (:9443) and the app (next dev, no build, :STRESS_PORT=3077, auto-login as the fake team account)
//      — reused when already up, else started; 2 workers by default (next dev compiles each page on first visit)
//   5. run-atelier-e2e.mjs --target stress (refuses a server without the x-stress-copy header)
//   6. stops only what it started; live counts AFTER; one-screen result file (E2E_RESULT_FILE, default scripts/stress/dump/e2e-result.md)
// Exit code = Playwright's (2 when the copy could not be prepared).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).stdout.trim();
const wt = path.join(path.dirname(root), 'app-worktrees', 'stress-live');
const wtDump = path.join(wt, 'scripts', 'stress', 'dump');
const PORT = Number(process.env.STRESS_PORT) || 3077;
const BASE = `http://127.0.0.1:${PORT}`;
const outFile = process.env.E2E_RESULT_FILE || path.join(here, 'dump', 'e2e-result.md');
const specArgs = process.argv.slice(2);
const t0 = Date.now();
const log = (m) => console.log(`[e2e-stress +${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

// ── live counts, read only ─────────────────────────────────────────────────────────────────
async function liveCounts() {
  const envFile = path.join(root, '.env.local');
  if (!fs.existsSync(envFile)) return { error: 'no .env.local — live not checked' };
  const env = fs.readFileSync(envFile, 'utf8');
  const val = (k) => (new RegExp(`^${k}\\s*=\\s*(.*)$`, 'm').exec(env)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  const token = val('SUPABASE_ACCESS_TOKEN');
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(val('NEXT_PUBLIC_SUPABASE_URL'))?.[1];
  if (!token || !ref) return { error: 'SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL missing — live not checked' };
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query/read-only`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'select (select count(*) from public.oeuvre_versions)::int versions, (select max(id) from public.oeuvre_versions)::bigint max_version_id, (select count(*) from public.work_order)::int orders' }),
      signal: AbortSignal.timeout(30_000),
    });
    const t = await r.text();
    if (!r.ok) return { error: `${r.status} ${t.slice(0, 120)}` };
    return JSON.parse(t)[0];
  } catch (e) { return { error: e.message }; }
}

// ── helpers ────────────────────────────────────────────────────────────────────────────────
const portOpen = (port) => new Promise((res) => {
  const s = net.connect({ host: '127.0.0.1', port }); s.setTimeout(1500);
  s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); s.on('timeout', () => { s.destroy(); res(false); });
});
const dbRunning = () => spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', 'supabase_db_stress'], { encoding: 'utf8' }).stdout.trim() === 'true';
const psql = (sql) => {
  const r = spawnSync('docker', ['exec', '-i', 'supabase_db_stress', 'psql', '-U', 'postgres', '-d', 'postgres', '-qtA'], { input: sql, encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  return r.status === 0 ? r.stdout.trim() : null;
};
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function startBg(name, args) {
  const logFd = fs.openSync(path.join(wtDump, `e2e-${name}.log`), 'w');
  const env = { ...process.env, STRESS_PORT: String(PORT), STRESS_E2E_LOGIN: '1' };
  // openssl for the storage stub's certificate: Git for Windows ships one (README « Start »).
  const gitUsr = path.join(path.dirname(path.dirname(spawnSync('where', ['git'], { encoding: 'utf8' }).stdout.split(/\r?\n/)[0] || '')), 'usr', 'bin');
  if (fs.existsSync(gitUsr)) env.PATH = `${env.PATH};${gitUsr}`;
  const child = spawn(process.execPath, args, { cwd: wt, env, stdio: ['ignore', logFd, logFd], windowsHide: true });
  log(`started ${name} (pid ${child.pid}, log scripts/stress/dump/e2e-${name}.log in the stress worktree)`);
  return child;
}
const kill = (child) => { if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); };
// Ctrl+C: the finally below does not run — stop what this run started before leaving.
process.on('SIGINT', () => { kill(started.app); kill(started.r2); console.log('[e2e-stress] interrupted — stopped the app / storage stub it started (the database is left running)'); process.exit(130); });

// ── run ────────────────────────────────────────────────────────────────────────────────────
const started = { db: false, r2: null, app: null };
const notes = [];
let exitCode = 2;
let report = null;
let seeded = 'no (fresh)';

const before = await liveCounts();
log(`live before: ${JSON.stringify(before)}`);
const headSha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();

try {
  // 2. Docker + worktree + database
  started.db = !dbRunning();
  const shell = spawnSync('where', ['pwsh'], { encoding: 'utf8' }).status === 0 ? 'pwsh' : 'powershell';
  const up = spawnSync(shell, ['-NoProfile', '-File', path.join(here, 'up.ps1'), '-Prepare'], { cwd: root, stdio: 'inherit' });
  if (up.status !== 0) throw new Error('up.ps1 -Prepare failed');
  if (!dbRunning()) throw new Error('the copy database (supabase_db_stress) is not running');

  // 3. reseed only when stale
  const seedHash = sha256(fs.readFileSync(path.join(wt, 'scripts', 'stress', 'seed.mjs')));
  const markFile = path.join(wtDump, 'seed.mark');
  const mark = fs.existsSync(markFile) ? fs.readFileSync(markFile, 'utf8').trim() : '';
  const works = Number(psql('select count(*) from public."Oeuvres"') ?? 0);
  const team = Number(psql("select count(*) from auth.users where email = 'team.stress@example.test'") ?? 0);
  const why = !mark ? 'no seed mark' : mark !== seedHash ? 'seed.mjs changed' : works === 0 ? 'no works' : team === 0 ? 'fake team login missing' : null;

  // 4. storage stub first (the seed writes its fake images into the stub's folder, the app reads them through it)
  if (await portOpen(9443)) log('image storage stub already on :9443 — reused');
  else started.r2 = startBg('r2', ['scripts/stress/r2-stub.mjs']);

  if (why) {
    log(`reseeding the copy (${why})`);
    const s = spawnSync(process.execPath, ['scripts/stress/seed.mjs'], { cwd: wt, stdio: 'inherit' });
    if (s.status !== 0) throw new Error('seed.mjs failed');
    fs.writeFileSync(markFile, seedHash + '\n');
    seeded = `yes (${why})`;
  } else log(`copy data fresh (${works} works) — no reseed`);

  if (await portOpen(PORT)) { log(`app already on :${PORT} — reused (must carry x-stress-copy, checked next)`); notes.push(`app server on :${PORT} was already running — reused, not stopped; it signs in as the team account only if started by this command (else the specs meet /login)`); }
  else started.app = startBg('app', ['scripts/stress/run-stress-dev.mjs']);

  // wait for the app, then open the pages the specs use once (dev compiles each page on first visit)
  const deadline = Date.now() + 240_000;
  let ok = false;
  while (Date.now() < deadline) {
    try { const r = await fetch(`${BASE}/login`, { redirect: 'manual', signal: AbortSignal.timeout(120_000) }); if (r.status < 500) { ok = true; break; } } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!ok) throw new Error(`app did not answer on ${BASE} within 4 minutes`);
  log('app answers — warming /hub and /atelier');
  for (const p of ['/hub', '/atelier']) {
    try { await (await fetch(BASE + p, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(180_000) })).text(); } catch { /* the spec will say */ }
  }

  // 5. the specs
  const jsonOut = path.join(wtDump, 'e2e-report.json');
  fs.rmSync(jsonOut, { force: true });
  const pw = spawnSync(process.execPath, ['scripts/run-atelier-e2e.mjs', '--target', 'stress', ...specArgs, ...(specArgs.some((a) => a.startsWith('--workers')) ? [] : ['--workers=2']), '--reporter=list,json'], {
    cwd: wt, stdio: 'inherit', env: { ...process.env, STRESS_PORT: String(PORT), PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut },
  });
  exitCode = typeof pw.status === 'number' ? pw.status : 1;
  if (fs.existsSync(jsonOut)) report = JSON.parse(fs.readFileSync(jsonOut, 'utf8'));
  else notes.push('no Playwright report (the runner refused before testing — see terminal)');
} catch (e) {
  notes.push(`STOPPED: ${e.message}`);
  log(e.message);
} finally {
  // 6. stop only what this run started
  if (started.app) { kill(started.app); log('stopped the app it started'); }
  if (started.r2) { kill(started.r2); log('stopped the storage stub it started'); }
  if (started.db) {
    spawnSync('npx', ['-y', 'supabase@3', 'stop', '--workdir', 'scripts/stress'], { cwd: wt, stdio: 'inherit', shell: true });
    log('stopped the copy database it started (data kept)');
  }
}

const after = await liveCounts();
log(`live after: ${JSON.stringify(after)}`);

// ── result file ────────────────────────────────────────────────────────────────────────────
const patchFile = path.join(wtDump, 'draft.patch');
const patch = fs.existsSync(patchFile) ? fs.readFileSync(patchFile) : Buffer.alloc(0);
const perFile = new Map();
const walk = (suite, file) => {
  const f = suite.file || file;
  for (const sp of suite.specs ?? []) {
    const e = perFile.get(f) ?? { passed: 0, failed: 0, skipped: 0, failures: [] };
    for (const t of sp.tests ?? []) {
      const st = t.status; // expected | unexpected | flaky | skipped
      if (st === 'skipped') e.skipped++;
      else if (st === 'unexpected') { e.failed++; e.failures.push(sp.title); }
      else e.passed++;
    }
    perFile.set(f, e);
  }
  for (const s of suite.suites ?? []) walk(s, f);
};
for (const s of report?.suites ?? []) walk(s, s.file);

const sameLive = !before.error && !after.error && before.versions === after.versions && before.orders === after.orders && String(before.max_version_id) === String(after.max_version_id);
const liveLine = (c) => (c.error ? `not read (${c.error})` : `oeuvre_versions ${c.versions} (max id ${c.max_version_id}), work_order ${c.orders}`);
const rows = [...perFile.entries()].map(([f, e]) => `| ${f} | ${e.failed ? 'FAIL' : e.passed ? 'pass' : 'skipped'} | ${e.passed} / ${e.failed} / ${e.skipped} | ${e.failures.join('; ').slice(0, 160)} |`);
const totals = [...perFile.values()].reduce((a, e) => ({ p: a.p + e.passed, f: a.f + e.failed, s: a.s + e.skipped }), { p: 0, f: 0, s: 0 });
const md = `# e2e on the throwaway copy — ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC

- Code: ${headSha.slice(0, 7)} + uncommitted diff ${patch.length ? `sha256 ${sha256(patch).slice(0, 12)} (${patch.length} bytes)` : 'none'}
- Server: ${BASE} (next dev, copy marker checked), login = fake team account; reseeded: ${seeded}
- Result: **${exitCode === 0 ? 'PASS' : 'FAIL'}** (exit ${exitCode}) — ${totals.p} passed, ${totals.f} failed, ${totals.s} skipped, ${((Date.now() - t0) / 60000).toFixed(1)} min
- Live (read only): before ${liveLine(before)} · after ${liveLine(after)} → **${sameLive ? 'unchanged' : before.error || after.error ? 'NOT PROVEN' : 'CHANGED'}**
${notes.map((n) => `- ${n}`).join('\n')}

| Spec | Result | pass / fail / skip | Failed tests |
|---|---|---|---|
${rows.join('\n') || '| (none ran) | | | |'}

Details: Playwright report ${path.join(wtDump, 'e2e-report.json')}; app log ${path.join(wtDump, 'e2e-app.log')} (when this run started it).
`;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, md);
log(`result file: ${outFile}`);
process.exit(exitCode);
