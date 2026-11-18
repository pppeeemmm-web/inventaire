// Security sweep on the LOCAL copy.
//  1. actions: every compiled Server Action called as `anon` (no session) and `outsider` (signed in, not team)
//     with dummy args; a row-count snapshot of every table before/after shows any write that got through.
//  2. rest: direct PostgREST per table as anon / outsider / team: read, insert {}, update (pk = pk), delete 1 row.
//  3. admin: admin-only actions called by the team member with real ids.
// Usage: node scripts/stress/security.mjs [actions|rest|admin]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { call, listActions, cookiesFor } from './actions.mjs';
import { psql, localEnv, USERS } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const what = process.argv[2] || 'actions';
const out = [];
const counts = () => Object.fromEntries(psql(`select string_agg(t || '=' || n, ',') from (select relname t, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', relname), false, true, '')))[1]::text n from pg_class where relnamespace='public'::regnamespace and relkind='r') x`).split(',').map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)]));
const diff = (a, b) => Object.keys(b).filter((k) => a[k] !== b[k]).map((k) => `${k} ${a[k]}→${b[k]}`);
const REFUSED = /authent|accès refusé|acces refuse|forbidden|unauth|not_?admin|not_?team|admin_only|team_only|denied|refus|login|session|err_auth|non connecté|_auth\b|permission/i;
const ZERO = '00000000-0000-0000-0000-000000000000';

function classify(r) {
  if (r.status === 404 || /Server action not found|Failed to find Server Action/i.test(r.raw)) return 'not-loaded';
  if (r.status >= 500) return 'crash';
  if (r.status !== 200) return `http${r.status}`;
  const v = r.result;
  if (v && typeof v === 'object' && !Array.isArray(v) && 'error' in v) return REFUSED.test(String(v.error)) ? 'refused' : `error:${String(v.error).slice(0, 50)}`;
  if (v === undefined || v === null || v === false || (Array.isArray(v) && v.length === 0)) return 'empty';
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return 'empty';
  return 'DATA';
}

if (what === 'actions') {
  const acts = listActions().filter((a) => !/scripts[\\/]stress/.test(a.file));
  for (const user of ['anon', 'outsider']) {
    const before = counts();
    const queue = [...acts];
    const one = async (a) => {
      const results = await Promise.all([[], [ZERO], [1]].map(async (args) => {
        let r;
        try { r = await call(a.name, args, { user, page: '/atelier/sales', fileHint: a.file, timeoutMs: 30_000 }); }
        catch (e) { r = { status: 0, raw: String(e), result: undefined, ms: 0 }; }
        return { args: JSON.stringify(args), c: classify(r), ms: r.ms, sample: JSON.stringify(r.result ?? r.raw).slice(0, 160) };
      }));
      fs.appendFileSync(path.join(here, 'dump', 'security-progress.log'), `${user} ${a.name} ${results.map((x) => x.c + '/' + x.ms).join(' ')}
`);
      const worst = results.find((x) => x.c === 'DATA') ?? results.find((x) => x.c === 'crash') ?? results.find((x) => x.c.startsWith('error')) ?? results[0];
      out.push({ user, action: a.name, file: a.file, verdict: worst.c, args: worst.args, sample: worst.sample });
      if (!['refused', 'empty', 'not-loaded'].includes(worst.c)) console.log(`${user.padEnd(8)} ${worst.c.padEnd(28)} ${a.name.padEnd(36)} ${a.file}  ${worst.args} ${worst.sample.slice(0, 120)}`);
    };
    await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await one(queue.shift()); }));
    const after = counts();
    const d = diff(before, after);
    out.push({ user, action: '*', verdict: d.length ? 'WRITES' : 'no writes', detail: d });
    console.log(`── ${user}: ${acts.length} actions; table rows changed: ${d.length ? d.join(', ') : 'none'}`);
  }
}

if (what === 'rest') {
  const env = localEnv();
  const tokenFor = async (user) => {
    if (user === 'anon') return env.ANON_KEY;
    const r = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: USERS[user].email, password: USERS[user].password }) });
    return (await r.json()).access_token;
  };
  const pks = Object.fromEntries(psql(`select string_agg(c.relname || '=' || a.attname, ',') from pg_index i join pg_class c on c.oid=i.indrelid join pg_attribute a on a.attrelid=c.oid and a.attnum=i.indkey[0]
    where i.indisprimary and c.relnamespace='public'::regnamespace and array_length(i.indkey::int2[],1)=1`).split(',').map((x) => x.split('=')));
  const tables = psql(`select string_agg(relname, ',' order by relname) from pg_class where relnamespace='public'::regnamespace and relkind in ('r','v')`).split(',');
  for (const user of ['anon', 'outsider', 'team']) {
    const tok = await tokenFor(user);
    const h = { apikey: env.ANON_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    for (const t of tables) {
      const u = `${env.API_URL}/rest/v1/${encodeURIComponent(t)}`;
      const total = Number(psql(`select count(*) from public."${t}"`));
      const rd = await fetch(`${u}?select=*&limit=1000`, { headers: h });
      const rows = rd.ok ? await rd.json() : [];
      const read = rd.ok ? `${rows.length}/${total}` : `x${rd.status}`;
      const ins = await fetch(u, { method: 'POST', headers: h, body: '{}' });
      const insTxt = await ins.text();
      const insV = ins.ok ? 'INSERTED' : /42501|row-level security|permission denied/.test(insTxt) ? 'denied' : `other(${(/"code":"(\w+)"/.exec(insTxt) || [])[1]})`;
      let upd = 'n/a', del = 'n/a';
      const pk = pks[t];
      const victim = pk ? psql(`select "${pk}"::text from public."${t}" order by random() limit 1`) : '';
      if (pk && victim) {
        const f = `${u}?${encodeURIComponent(pk)}=eq.${encodeURIComponent(victim)}`;
        const ur = await fetch(f, { method: 'PATCH', headers: h, body: JSON.stringify({ [pk]: /^\d+$/.test(victim) ? Number(victim) : victim }) });
        const uj = ur.ok ? await ur.json() : null; upd = ur.ok ? (uj.length ? 'UPDATED' : 'no-row') : `x${ur.status}`;
        if (user !== 'team') {
          const dr = await fetch(f, { method: 'DELETE', headers: h });
          const dj = dr.ok ? await dr.json() : null; del = dr.ok ? (dj.length ? 'DELETED' : 'no-row') : `x${dr.status}`;
        }
      }
      out.push({ user, table: t, read, insert: insV, update: upd, delete: del });
    }
    const flagged = out.filter((o) => o.user === user && (o.insert === 'INSERTED' || o.update === 'UPDATED' || o.delete === 'DELETED' || (user !== 'team' && /^[1-9]/.test(o.read))));
    console.log(`── ${user}: ${flagged.length} tables readable or writable`);
    for (const f of flagged) console.log(`   ${f.table.padEnd(28)} read ${String(f.read).padEnd(10)} insert ${f.insert.padEnd(16)} update ${f.update.padEnd(8)} delete ${f.delete}`);
  }
}

if (what === 'admin') {
  const id = (sql) => psql(sql);
  const work = Number(id(`select "OeuvreID" from public."Oeuvres" where "statusId"=2 order by 1 limit 1`));
  const img = Number(id(`select "ImageID" from public."tblImage" order by 1 limit 1`));
  const ver = id(`select id::text from public.oeuvre_versions order by 1 limit 1`);
  const order = id(`select id::text from public.work_order where kind='sale' and status in ('paid','delivered') and not reconstituted and not exists (select 1 from public.invoice_order io where io.order_id=work_order.id) limit 1`);
  const inv = id(`select id::text from public.invoice where kind='invoice' limit 1`);
  const tries = [
    ['purgeWorkPermanently', [work]], ['deleteWorkImage', [img]], ['deleteWorkImage', [work, img]], ['restoreOeuvreVersion', [ver]],
    ['issueInvoice', [[order]]], ['creditInvoice', [inv]],
  ];
  for (const [name, args] of tries) {
    let r; try { r = await call(name, args, { user: 'team' }); } catch (e) { r = { raw: String(e), status: 0 }; }
    const v = classify(r);
    out.push({ user: 'team', action: name, args, verdict: v, sample: JSON.stringify(r.result ?? r.raw).slice(0, 200) });
    console.log(`team  ${v.padEnd(26)} ${name}(${JSON.stringify(args)})  ${JSON.stringify(r.result ?? r.raw).slice(0, 140)}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
fs.writeFileSync(path.join(here, 'dump', `security-${what}-${stamp}.json`), JSON.stringify(out, null, 1));
console.log(`→ dump/security-${what}-${stamp}.json`);
