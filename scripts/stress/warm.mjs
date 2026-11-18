// Open each page once as admin (compiles it in dev → its Server Actions get ids). Logs code + seconds + RSS of the dev server.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { cookiesFor, BASE } from './actions.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const routes = process.argv.slice(2);
const ck = await cookiesFor('admin');
const out = [];
for (const r of routes) {
  const t = performance.now(); let code = 0;
  try { const res = await fetch(BASE + r, { headers: { Cookie: ck }, signal: AbortSignal.timeout(180_000), redirect: 'manual' }); code = res.status; await res.text(); } catch (e) { code = e.name; }
  const s = ((performance.now() - t) / 1000).toFixed(1); out.push({ r, code, s }); console.log(`${String(code).padEnd(5)} ${s.padStart(6)} s  ${r}`);
  if (code !== 200 && code !== 307) { console.log('stop: server unhealthy'); break; }
}
fs.appendFileSync(path.join(here, 'dump', 'compile.jsonl'), out.map((o) => JSON.stringify(o)).join('\n') + '\n');
