// « Money guards » draft test (B1 / B2 / B3) on the LOCAL copy: the same simultaneous calls as in the
// report, plus what each leaves behind. Usage: node scripts/stress/money-guards.mjs [label] [rounds]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { call, fd } from './actions.mjs';
import { psql } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || 'run';
const rounds = Number(process.argv[3] || 2);
const one = (sql) => psql(sql);
const json = (sql) => JSON.parse(psql(`select coalesce(json_agg(_r), '[]') from (${sql}) _r`) || '[]');
const COLLECTOR = () => Number(one(`select "ContactID" from public."Contact" where "ContactID" >= 100 and "ContactID" < 900 order by random() limit 1`));
const free = (n) => one(`select string_agg(id::text, ',') from (select "OeuvreID" id from public."Oeuvres" o where "statusId" = 2 and deleted_at is null
  and not exists (select 1 from public.work_order_work l where l.oeuvre_id = o."OeuvreID" and l.line_status = 'active') order by random() limit ${n}) x`).split(',').map(Number);
const ordersOf = (w, t0) => json(`select o.ref, o.status, (select count(*) from public.work_order_work x where x.order_id = o.id) lines, left(o.notes, 70) notes
  from public.work_order o where exists (select 1 from public.work_order_work l where l.order_id = o.id and l.oeuvre_id = ${w})
     or (o.created_at >= '${t0}' and not exists (select 1 from public.work_order_work l where l.order_id = o.id)) order by o.created_at`);
const out = [];
const log = (k, v) => { out.push({ label, k, ...v }); console.log(k.padEnd(28), JSON.stringify(v)); };

for (let r = 0; r < rounds; r++) {
  // B1 — the same work in two sales at once, then five at once
  for (const n of [2, 5]) {
    const [w] = free(1);
    const t0 = one(`select now()::text`);
    const rs = await Promise.all(Array.from({ length: n }, () => call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: COLLECTOR(), price_final: 500 })])));
    const orders = ordersOf(w, t0);
    log(`B1 ${n} sales at once`, {
      accepted: rs.filter((x) => x.ok).length, errors: rs.map((x) => x.error).filter(Boolean),
      orders: orders.map((o) => `${o.ref ?? '—'} ${o.status} lines=${o.lines}${o.notes ? ` « ${o.notes} »` : ''}`),
      workStatus: Number(one(`select "statusId" from public."Oeuvres" where "OeuvreID" = ${w}`)),
    });
  }

  // B2 — two full payments at once on a signed 1 000 € sale
  const [p] = free(1);
  const o = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [p], party_id: COLLECTOR(), price_final: 1000 })]);
  await call('advanceWorkOrder', [o.result.id, 'signed']);
  const since = one(`select now()::text`);
  const pays = await Promise.all([0, 1].map(() => call('recordOrderPayment', [fd({ order_id: o.result.id, amount: 1000, method: 'virement' })])));
  log('B2 2 full payments at once', {
    accepted: pays.filter((x) => x.ok).length, errors: pays.map((x) => x.error).filter(Boolean),
    payments: one(`select count(*) || ' rows, ' || coalesce(sum(amount), 0) || ' €' from public.payments where work_order_id = '${o.result.id}'`),
    order: one(`select status from public.work_order where id = '${o.result.id}'`),
    coas: Number(one(`select count(*) from public.document where kind ilike '%coa%' and oeuvre_id = ${p}`)),
    work: one(`select "statusId" || ' owner ' || "ContactID" || ' paid ' || coalesce(is_paid::text, '-') from public."Oeuvres" where "OeuvreID" = ${p}`),
    stepEvents: Number(one(`select count(*) from public.system_log where table_name = 'work_order' and row_id::text = '${o.result.id}' and new_value #>> '{}' = 'paid'`)),
    shipments: Number(one(`select count(distinct sw.shipment_id) from public.shipment_work sw where sw.oeuvre_id = ${p}`)),
    errorLog: json(`select left(coalesce(action, '') || ' ' || coalesce(details::text, ''), 90) m from public.system_log where created_at >= '${since}' and (coalesce(action, '') || coalesce(details::text, '')) ilike '%payment%' and coalesce(event_type, '') <> 'PAYMENT_GRAIN'`).map((x) => x.m),
  });

  // B3 — the same receive (6 of 10) twice at once
  const sup = Number(one(`select "ContactID" from public."Contact" where "NomInstitution" = 'Fournisseur Test 1' limit 1`));
  const items = json(`select id from public.stock_item where supplier_id = ${sup} order by random() limit 1`);
  const so = await call('saveSupplyOrder', [{ id: null, supplier_id: sup, notes: 'money guards', lines: [{ id: null, stock_item_id: items[0].id, qty_ordered: 10, unit_price_ht: 4.5 }] }], { page: '/atelier/stock' });
  const soId = so.result.id;
  await call('setSupplyOrderStatus', [soId, 'ordered'], { page: '/atelier/stock' });
  const line = Number(one(`select id from public.supply_order_line where order_id = ${soId}`));
  const before = Number(one(`select quantity from public.stock_item where id = ${items[0].id}`));
  const two = await Promise.all([0, 1].map(() => call('receiveSupplyOrder', [soId, [{ line_id: line, qty: 6 }]], { page: '/atelier/stock' })));
  log('B3 same receive twice', {
    accepted: two.filter((x) => x.ok).length, errors: two.map((x) => x.error).filter(Boolean),
    stock: `${before} → ${one(`select quantity from public.stock_item where id = ${items[0].id}`)}`,
    line: `${one(`select qty_received from public.supply_order_line where id = ${line}`)} of 10`,
    order: one(`select status from public.supply_order where id = ${soId}`),
  });
  // and the rest (4) still goes in, then nothing more
  const rest = await call('receiveSupplyOrder', [soId, [{ line_id: line, qty: 4 }]], { page: '/atelier/stock' });
  const extra = await call('receiveSupplyOrder', [soId, [{ line_id: line, qty: 1 }]], { page: '/atelier/stock' });
  log('B3 then the 4 left, then 1', { rest: rest.ok || rest.error, extra: extra.ok || extra.error, line: `${one(`select qty_received from public.supply_order_line where id = ${line}`)} of 10`, order: one(`select status from public.supply_order where id = ${soId}`) });
}
fs.writeFileSync(path.join(here, 'dump', `money-guards-${label}.json`), JSON.stringify(out, null, 1));
