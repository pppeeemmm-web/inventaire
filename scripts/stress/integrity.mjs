// Data-integrity checks on the LOCAL copy after the chains. Read-only SQL + the R2 stub folder.
// Each check prints its count and a few examples. Usage: node scripts/stress/integrity.mjs
// The same SQL can be run read-only on production (EXPLAIN-free selects) to see whether live data has the same holes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { psql } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const json = (sql) => JSON.parse(psql(`select coalesce(json_agg(_r), '[]') from (${sql}) _r`) || '[]');

export const CHECKS = {
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
    select "OeuvreID", "ContactID" from public."Oeuvres" w where "statusId" = 6 and not exists (
      select 1 from public.work_order o join public.work_order_work l on l.order_id = o.id
      where l.oeuvre_id = w."OeuvreID" and o.party_id = w."ContactID" and o.kind = 'sale' and o.status in ('paid','delivered'))`,
  'reserved work (Réservé) with no signed sale to its buyer': `
    select "OeuvreID", "AcheteurID" from public."Oeuvres" w where "statusId" = 4 and not exists (
      select 1 from public.work_order o join public.work_order_work l on l.order_id = o.id
      where l.oeuvre_id = w."OeuvreID" and o.party_id = w."AcheteurID" and o.kind = 'sale' and o.status in ('signed','deposit_paid'))`,
  'order with no line': `select ref, status from public.work_order o where not exists (select 1 from public.work_order_work l where l.order_id = o.id)`,
  'paper path set, file missing in R2': `
    select 'order' k, ref, paper_path from public.work_order where paper_path is not null
    union all select 'invoice', number, paper_path from public.invoice where paper_path is not null
    union all select 'document', cert_id, storage_path from public.document where storage_path is not null and kind not in ('link')`,
  'image row, file missing in R2': `select "OeuvreID", "txtImageNameLink" from public."tblImage"`,
  'graph node of a deleted / missing work': `
    select n.node_id from public.nodes n where n.node_type = 'oeuvre' and not exists (select 1 from public."Oeuvres" o where o."OeuvreID"::text = n.source_pk)`,
  'versions per work (top)': `select oeuvre_id, count(*) n from public.oeuvre_versions group by 1 order by 2 desc limit 5`,
  'system_log rows by event (top)': `select coalesce(event_type, '(manual)') e, count(*) n from public.system_log group by 1 order by 2 desc limit 8`,
};

const R2 = path.join(here, 'dump', 'r2');
const exists = (bucket, key) => fs.existsSync(path.join(R2, bucket, key));
const res = {};
for (const [name, sql] of Object.entries(CHECKS)) {
  let rows;
  try { rows = json(sql); } catch (e) { console.log(`?? ${name}: ${e.message.split('\n')[0]}`); continue; }
  if (name.startsWith('paper path')) rows = rows.filter((r) => !r.paper_path || !exists('vault', r.paper_path));
  if (name.startsWith('image row')) rows = rows.filter((r) => !r.txtImageNameLink || !exists('paintings', r.txtImageNameLink));
  res[name] = rows;
  const info = /\(top\)/.test(name);
  console.log(`${info ? '·' : rows.length ? '✗' : '✓'} ${name}: ${info ? '' : rows.length}${rows.length ? '  ' + JSON.stringify(rows.slice(0, info ? 8 : 3)).slice(0, 300) : ''}`);
}
fs.writeFileSync(path.join(here, 'dump', 'integrity.json'), JSON.stringify(res, null, 1));
