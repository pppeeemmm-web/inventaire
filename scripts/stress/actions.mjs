// Call the app's own Server Actions on the stress dev server (:3077), as a given user.
// Same code path as a button: POST with `Next-Action: <id>` (ids from .next/server/server-reference-manifest.json,
// filled in once the page that imports the action has compiled). Args are encoded like React's encodeReply:
// plain JSON array, or multipart when an argument is a FormData.
// Sessions: Playwright signs in on /login once per user and keeps the cookies (dump/auth-<user>.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { USERS } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
export const BASE = `http://localhost:${process.env.STRESS_PORT || 3077}`;

let manifest = null;
let manifestCache = null;
function readManifest(force = false) {
  if (manifestCache && !force) return manifestCache;
  // The dev server rewrites its manifest as pages compile; keep the union with the cached copy (ids are stable).
  const live = path.join(root, '.next', 'server', 'server-reference-manifest.json');
  const cache = path.join(here, 'dump', 'actions-manifest.json');
  const a = fs.existsSync(live) ? JSON.parse(fs.readFileSync(live, 'utf8')).node : {};
  const b = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')).node : {};
  // Keep only what the client needs (the live manifest lists every page per action: hundreds of MB).
  const slim = (o) => Object.fromEntries(Object.entries(o).map(([id, v]) => [id, { exportedName: v.exportedName, filename: v.filename }]));
  const node = { ...slim(b), ...slim(a) };
  fs.writeFileSync(cache, JSON.stringify({ node }));
  manifestCache = { node };
  return manifestCache;
}
export function actionId(name, fileHint) {
  manifest = readManifest();
  const hits = Object.entries(manifest.node).filter(([, v]) => v.exportedName === name && (!fileHint || String(v.filename ?? JSON.stringify(v)).includes(fileHint)));
  if (hits.length === 0) throw new Error(`action ${name} not compiled yet — open its page first`);
  if (hits.length > 1 && !fileHint) throw new Error(`action ${name} ambiguous: ${hits.map(([, v]) => v.filename).join(' | ')}`);
  return hits[0][0];
}
export function listActions() {
  const m = readManifest();
  return Object.entries(m.node).map(([id, v]) => ({ id, name: v.exportedName, file: String(v.filename ?? '').replace(/^.*brave-goldberg-0cf0bd[\\/]/, '') }));
}

const cookieCache = {};
export async function cookiesFor(user) {
  if (user === 'anon') return '';
  if (cookieCache[user]) return cookieCache[user];
  const file = path.join(here, 'dump', `auth-${user}.json`);
  let state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const fresh = state && state.at > Date.now() - 45 * 60_000;
  if (!fresh) {
    const u = USERS[user];
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { timeout: 120_000 });
    await page.getByLabel('E-mail').fill(u.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(u.password);
    await Promise.all([page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 120_000 }).catch(() => {}), page.getByRole('button', { name: 'Se connecter' }).click()]);
    state = { at: Date.now(), cookies: (await ctx.cookies()).filter((c) => c.name.startsWith('sb-')) };
    await browser.close();
    fs.writeFileSync(file, JSON.stringify(state));
  }
  cookieCache[user] = state.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  return cookieCache[user];
}

function encode(args) {
  const fdIdx = args.findIndex((a) => a instanceof FormData);
  if (fdIdx < 0) return { body: JSON.stringify(args), type: 'text/plain;charset=UTF-8' };
  const fd = new FormData();
  let ref = 1;
  const root = args.map((a) => {
    if (!(a instanceof FormData)) return a;
    const id = ref++;
    for (const [k, v] of a.entries()) fd.append(`_${id}_${k}`, v);
    return `$K${id}`;
  });
  fd.append('0', JSON.stringify(root));
  return { body: fd, type: null };
}

function parseFlight(text) {
  // Lines "<hex id>:<json>"; the root (0) says which chunk holds the action's return value ("a":"$@1").
  const chunks = new Map();
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]+):(.*)$/.exec(line);
    if (!m) continue;
    try { chunks.set(m[1], JSON.parse(m[2])); } catch { chunks.set(m[1], m[2]); }
  }
  const r = chunks.get('0');
  const ref = r && typeof r.a === 'string' && r.a.startsWith('$@') ? r.a.slice(2) : null;
  const v = ref ? chunks.get(ref) : r?.a;
  return v === '$undefined' ? undefined : v;
}

/** Run one action. Returns { ok, ms, status, result, raw } — never throws on an app error. */
export async function call(name, args = [], { user = 'admin', page = '/atelier/sales', fileHint, timeoutMs = 60_000 } = {}) {
  const id = actionId(name, fileHint);
  const { body, type } = encode(args);
  const headers = { 'Next-Action': id, Origin: BASE, Accept: 'text/x-component', Cookie: await cookiesFor(user) };
  if (type) headers['Content-Type'] = type;
  const t = performance.now();
  let res, raw;
  try {
    res = await fetch(`${BASE}${page}`, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    raw = await res.text();
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - t), status: 0, result: undefined, error: `timeout/${e.name}`, raw: String(e) };
  }
  const ms = Math.round(performance.now() - t);
  let result;
  try { result = parseFlight(raw); } catch { result = undefined; }
  const appErr = result && typeof result === 'object' && 'error' in result ? result.error : null;
  return { ok: res.status === 200 && !appErr, ms, status: res.status, result, error: appErr ?? (res.status !== 200 ? raw.slice(0, 300) : null), raw: raw.slice(0, 2000) };
}

export function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, String(x)));
    else if (v !== undefined && v !== null) f.append(k, String(v));
  }
  return f;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // smoke: node scripts/stress/actions.mjs <name> '<json args>' [user]
  const [name, json, user] = process.argv.slice(2);
  console.log(JSON.stringify(await call(name, JSON.parse(json || '[]'), { user: user || 'admin' }), null, 1).slice(0, 3000));
}
