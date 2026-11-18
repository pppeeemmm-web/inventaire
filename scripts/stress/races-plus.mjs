// Extra race checks for the B1 / B2 guards (supabase/sql/order_race_guards.sql + conditional step).
// LOCAL copy only. Usage: node scripts/stress/races-plus.mjs [rounds]
import { call, fd } from './actions.mjs';
import { psql } from './seed.mjs';

const one = (sql) => psql(sql);
const rounds = Number(process.argv[2] || 3);
const COLLECTOR = () => Number(one(`select "ContactID" from public."Contact" where "ContactID" >= 100 order by random() limit 1`));
const free = (n) => one(`select string_agg(id::text, ',') from (select "OeuvreID" id from public."Oeuvres" o where "statusId" = 2 and deleted_at is null
  and not exists (select 1 from public.work_order_work l where l.oeuvre_id = o."OeuvreID" and l.line_status = 'active') order by random() limit ${n}) x`).split(',').map(Number);
const sum = (id) => Number(one(`select coalesce(sum(amount), 0) from public.payments where work_order_id = '${id}'`));
const coas = (w) => Number(one(`select count(*) from public.document where kind ilike '%coa%' and oeuvre_id = ${w}`));
const report = [];
const check = (name, ok, detail) => { report.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  ${JSON.stringify(detail)}`); };

for (let r = 0; r < rounds; r++) {
  // 1. five sales of one work at once
  const [w] = free(1);
  const five = await Promise.all(Array.from({ length: 5 }, () => call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: COLLECTOR(), price_final: 500 })])));
  const live = Number(one(`select count(*) from public.work_order_work l join public.work_order o on o.id = l.order_id where l.oeuvre_id = ${w} and l.line_status = 'active' and o.status not in ('cancelled')`));
  check('5 sales of one work at once → 1 live', live === 1, { accepted: five.filter((x) => x.ok).length, live, errors: [...new Set(five.map((x) => x.error).filter(Boolean))] });

  // 2. sale + gift of one work at once (same family)
  const [g] = free(1);
  const mix = await Promise.all([
    call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [g], party_id: COLLECTOR(), price_final: 500 })]),
    call('createWorkOrder', [fd({ kind: 'gift', oeuvre_ids: [g], party_id: COLLECTOR() })]),
  ]);
  check('sale + gift of one work at once → 1 accepted', mix.filter((x) => x.ok).length === 1, { errors: mix.map((x) => x.error) });

  // 3. three full payments at once
  const [p] = free(1);
  const o = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [p], party_id: COLLECTOR(), price_final: 1000 })]);
  await call('advanceWorkOrder', [o.result.id, 'signed']);
  const pays = await Promise.all([0, 1, 2].map(() => call('recordOrderPayment', [fd({ order_id: o.result.id, amount: 1000, method: 'virement' })])));
  check('3 full payments at once → 1000 €, 1 COA', sum(o.result.id) === 1000 && coas(p) === 1, { total: sum(o.result.id), coas: coas(p), errors: pays.map((x) => x.error) });

  // 4. after a deposit, two partial payments at once that together pass the price
  const [q] = free(1);
  const o2 = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [q], party_id: COLLECTOR(), price_final: 1000 })]);
  await call('advanceWorkOrder', [o2.result.id, 'signed']);
  await call('recordOrderPayment', [fd({ order_id: o2.result.id, amount: 300, method: 'virement' })]);
  const two = await Promise.all([0, 1].map(() => call('recordOrderPayment', [fd({ order_id: o2.result.id, amount: 400, method: 'virement' })])));
  check('300 then 2×400 at once → never above 1000 €', sum(o2.result.id) <= 1000, { total: sum(o2.result.id), errors: two.map((x) => x.error) });

  // 5. normal path still works: deposit then balance, one after the other
  const [n] = free(1);
  const o3 = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [n], party_id: COLLECTOR(), price_final: 800 })]);
  await call('advanceWorkOrder', [o3.result.id, 'signed']);
  const d1 = await call('recordOrderPayment', [fd({ order_id: o3.result.id, amount: 200, method: 'cb' })]);
  const d2 = await call('recordOrderPayment', [fd({ order_id: o3.result.id, amount: 600, method: 'cb' })]);
  const st = one(`select status from public.work_order where id = '${o3.result.id}'`);
  check('200 then 600 → Soldée, 800 €, 1 COA', d1.ok && d2.ok && st === 'paid' && sum(o3.result.id) === 800 && coas(n) === 1, { st, total: sum(o3.result.id), coas: coas(n), d1: d1.error, d2: d2.error });

  // 6. one after the other: a second full payment is refused with the new message
  const again = await call('recordOrderPayment', [fd({ order_id: o3.result.id, amount: 800, method: 'cb' })]);
  check('a payment on a paid sale is refused', !again.ok, { error: again.error });

  // 7. two signatures of one draft at once
  const [s] = free(1);
  const o4 = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [s], party_id: COLLECTOR(), price_final: 500 })]);
  const signs = await Promise.all([0, 1].map(() => call('advanceWorkOrder', [o4.result.id, 'signed'])));
  const ships = Number(one(`select count(distinct s.id) from public.shipment s join public.shipment_work sl on sl.shipment_id = s.id where sl.oeuvre_id = ${s}`) || 0);
  check('2 signatures at once → 1 signed', signs.filter((x) => x.ok).length === 1, { errors: signs.map((x) => x.error), shipments: ships });
}
const bad = report.filter((x) => !x.ok).length;
console.log(`\n${report.length} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
