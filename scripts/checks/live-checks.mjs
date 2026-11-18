// Live data checks — layer 3 (owner choices 2026-11-18: reuse the management token, warn only, never block a push).
// READ ONLY: every query goes through the Supabase Management API read-only endpoint, which refuses any write.
// Runs the work rule checks (supabase/sql/work_rules_checks.sql, same as Audit « Règles») + the order / payment /
// shipment integrity checks from the stress test (scripts/stress/integrity.mjs keeps the same SQL for the Docker copy:
// a check changed here is changed there). Each query returns the rows that BREAK its rule; empty = holds.
// Usage: npm run checks:live   (ship.ps1 runs it before every push; exit code is always 0 — it warns, never blocks).
// Token + project: SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL from .env.local (or the file in PEM_ENV_FILE).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const warn = (why) => {
  console.log(`\n!!!!! LIVE DATA CHECKS DID NOT RUN — ${why}\n!!!!! Nothing about live data was checked for this push.\n`);
  process.exit(0);
};

const envFile = process.env.PEM_ENV_FILE ?? path.join(root, '.env.local');
if (!fs.existsSync(envFile)) warn(`no ${envFile}`);
const env = fs.readFileSync(envFile, 'utf8');
const val = (k) => (new RegExp(`^${k}\\s*=\\s*(.*)$`, 'm').exec(env)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
const token = val('SUPABASE_ACCESS_TOKEN');
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(val('NEXT_PUBLIC_SUPABASE_URL'))?.[1];
if (!token) warn('SUPABASE_ACCESS_TOKEN missing in .env.local');
if (!ref) warn('NEXT_PUBLIC_SUPABASE_URL missing or not a supabase.co URL');

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query/read-only`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

const INTEGRITY = {
  'work sold / given / reserved on two live orders': `
    select l.oeuvre_id, string_agg(o.ref || ':' || o.status, ', ' order by o.ref) orders
    from public.work_order_work l join public.work_order o on o.id = l.order_id
    where o.kind in ('sale','gift') and o.status not in ('cancelled','draft') and l.line_status = 'active' and not o.reconstituted
    group by 1 having count(*) > 1`,
  'work on two open deposits / loans at once': `
    select l.oeuvre_id, string_agg(o.ref, ', ') orders from public.work_order_work l join public.work_order o on o.id = l.order_id
    where o.kind in ('consignment','loan','entrusted') and o.status in ('signed','out') and l.line_status = 'active' group by 1 having count(*) > 1`,
  'money received above the price': `
    select o.ref, o.price_final, sum(p.amount) received from public.work_order o join public.payments p on p.work_order_id = o.id
    where p.refunded_at is null group by o.id, o.ref, o.price_final having sum(p.amount) > o.price_final + 0.005`,
  'more than one certificate for a work': `
    select oeuvre_id, count(*) n, string_agg(cert_id, ', ') certs from public.document where cert_id is not null group by 1 having count(*) > 1`,
  'shipment still open, every order on it finished': `
    select s.id, s.kind, s.status, string_agg(distinct o.ref || ':' || o.status, ', ') orders
    from public.shipment s join public.shipment_work sw on sw.shipment_id = s.id
    join public.work_order_work l on l.id = sw.order_line_id join public.work_order o on o.id = l.order_id
    where s.status not in ('delivered','cancelled')
    group by s.id, s.kind, s.status having bool_and(o.status in ('cancelled','closed','delivered','handed_over'))`,
  'shipment delivered for a cancelled order': `
    select s.id, string_agg(distinct o.ref, ', ') orders from public.shipment s join public.shipment_work sw on sw.shipment_id = s.id
    join public.work_order_work l on l.id = sw.order_line_id join public.work_order o on o.id = l.order_id
    where s.status = 'delivered' and o.status = 'cancelled' and s.kind <> 'return' group by s.id`,
  'unread reminders of finished / cancelled orders': `
    select r.message, r.remind_at from public.suivi_reminder r join public.work_order o on r.message like o.ref || ' %'
    where not coalesce(r.lu, false) and o.status in ('cancelled','closed')`,
  'order number gaps (per kind / year)': `
    select kind, ref_year, array_agg(s) missing from (select kind, ref_year, generate_series(1, max(ref_seq)) s from public.work_order where not reconstituted and ref_seq is not null group by 1, 2) g
    where not exists (select 1 from public.work_order o where o.kind = g.kind and o.ref_year = g.ref_year and o.ref_seq = g.s) group by 1, 2`,
  'invoice number gaps': `
    select kind, series_year, array_agg(s) missing from (select kind, series_year, generate_series(1, max(series_seq)) s from public.invoice group by 1, 2) g
    where not exists (select 1 from public.invoice i where i.kind = g.kind and i.series_year = g.series_year and i.series_seq = g.s) group by 1, 2`,
  'paid sale with no invoice': `
    select o.ref, o.status from public.work_order o where o.kind = 'sale' and o.status in ('paid','delivered') and not o.reconstituted
    and not exists (select 1 from public.invoice_order io where io.order_id = o.id)`,
  'sold work (Vendu) whose owner has no paid sale': `
    select "OeuvreID", "ContactID" from public."Oeuvres" w where "statusId" = 6 and deleted_at is null and not exists (
      select 1 from public.work_order o join public.work_order_work l on l.order_id = o.id
      where l.oeuvre_id = w."OeuvreID" and o.party_id = w."ContactID" and o.kind = 'sale' and o.status in ('paid','delivered'))`,
  'reserved work (Réservé) with no signed sale to its buyer': `
    select "OeuvreID", "AcheteurID" from public."Oeuvres" w where "statusId" = 4 and deleted_at is null and not exists (
      select 1 from public.work_order o join public.work_order_work l on l.order_id = o.id
      where l.oeuvre_id = w."OeuvreID" and o.party_id = w."AcheteurID" and o.kind = 'sale' and o.status in ('signed','deposit_paid'))`,
  'order with no line': `select ref, status from public.work_order o where not exists (select 1 from public.work_order_work l where l.order_id = o.id)`,
  'graph node of a deleted / missing work': `
    select n.node_id from public.nodes n where n.node_type = 'oeuvre' and not exists (select 1 from public."Oeuvres" o where o."OeuvreID"::text = n.source_pk)`,
};

// Work rules: one SELECT per rule in the SQL file; comments stripped, rule number read from its first literal.
const RULES = Object.fromEntries(
  fs.readFileSync(path.join(root, 'supabase/sql/work_rules_checks.sql'), 'utf8')
    .split(/;\s*\r?\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter((s) => /^select/i.test(s))
    .map((s) => [`work rule ${/'(\d+)'/.exec(s)?.[1] ?? '?'}`, s]),
);

const t0 = Date.now();
const all = { ...RULES, ...INTEGRITY };
const results = await Promise.all(Object.entries(all).map(async ([name, sql]) => {
  try { return { name, rows: await q(sql) }; } catch (e) { return { name, error: e.message }; }
}));

const errors = results.filter((r) => r.error);
if (errors.length === results.length) warn(`every query failed (${errors[0].error.split('\n')[0]})`);
const breaks = results.filter((r) => r.rows?.length);
for (const r of breaks) console.log(`WARNING ${r.name}: ${r.rows.length} — e.g. ${JSON.stringify(r.rows.slice(0, 2)).slice(0, 220)}`);
for (const r of errors) console.log(`!! could not run « ${r.name} »: ${r.error.split('\n')[0]}`);
const ok = results.length - breaks.length - errors.length;
console.log(`Live data checks: ${ok}/${results.length} hold, ${breaks.length} with breaks, ${errors.length} not run (${Date.now() - t0} ms, read only)`);
