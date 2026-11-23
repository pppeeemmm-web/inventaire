// B4 (shipments follow their orders) and B5 (Sales list past ~200 orders) checks on the LOCAL copy.
// Usage: node scripts/stress/b4b5.mjs
import { call, fd } from './actions.mjs';
import { psql } from './seed.mjs';

const one = (sql) => psql(sql);
const json = (sql) => JSON.parse(psql(`select coalesce(json_agg(_r), '[]') from (${sql}) _r`) || '[]');
const free = (n) => one(`select string_agg(id::text, ',') from (select "OeuvreID" id from public."Oeuvres" o where "statusId" = 2 and deleted_at is null and "Prix" > 0
  and not exists (select 1 from public.work_order_work l where l.oeuvre_id = o."OeuvreID")
  and not exists (select 1 from public.shipment_work s where s.oeuvre_id = o."OeuvreID") order by random() limit ${n}) x`).split(',').map(Number);
// A collector with exactly one address, so every order to them goes to the same place.
const party = () => Number(one(`select c."ContactID" from public."Contact" c where c."ContactID" >= 100 and c."ContactID" < 900
  and (select count(distinct a.place_id) from public.contact_place_lines a where a.contact_id = c."ContactID") = 1
  and not exists (select 1 from public.shipment s where s.to_contact_id = c."ContactID" and s.status not in ('shipped', 'delivered', 'cancelled'))
  order by random() limit 1`));
const boxesOf = (orderId) => json(`select s.id, s.status, s.kind, (select count(*) from public.shipment_work x where x.shipment_id = s.id) n
  from public.shipment s where exists (select 1 from public.shipment_work sw join public.work_order_work l on l.id = sw.order_line_id where sw.shipment_id = s.id and l.order_id = '${orderId}')`);
const box = (id) => json(`select s.status, (select count(*) from public.shipment_work x where x.shipment_id = s.id) n from public.shipment s where s.id = '${id}'`)[0];
const shipIdOf = (orderId) => boxesOf(orderId)[0]?.id;
const report = [];
const check = (name, ok, detail) => { report.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  ${JSON.stringify(detail)}`); };
const sale = async (w, p, price = 900) => (await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: p, price_final: price })])).result.id;

// 1. a signed sale alone in its box, cancelled → box cancelled
{
  const [w] = free(1); const p = party();
  const id = await sale(w, p); await call('advanceWorkOrder', [id, 'signed']);
  const sid = shipIdOf(id);
  const c = await call('cancelWorkOrder', [id]);
  check('cancel a signed sale alone in its box → box cancelled', c.ok && box(sid)?.status === 'cancelled' && box(sid)?.n === 0, { cancel: c.error ?? 'ok', box: box(sid) });
}
// 2. two sales to one place share a box; one cancelled → its work leaves, the box stays for the other
{
  const [w1, w2] = free(2); const p = party();
  const a = await sale(w1, p); await call('advanceWorkOrder', [a, 'signed']);
  const b = await sale(w2, p); await call('advanceWorkOrder', [b, 'signed']);
  const sid = shipIdOf(a); const shared = sid && sid === shipIdOf(b);
  await call('cancelWorkOrder', [a]);
  const left = json(`select oeuvre_id from public.shipment_work where shipment_id = '${sid}'`).map((x) => x.oeuvre_id);
  check('two sales share a box; one cancelled → only the other work stays, box open', shared && box(sid).status === 'open' && left.length === 1 && left[0] === w2, { shared, box: box(sid), left });
}
// 3. paid sale, « Retour » before delivery → work off the box
{
  const [w] = free(1); const p = party();
  const id = await sale(w, p, 700); await call('advanceWorkOrder', [id, 'signed']);
  await call('recordOrderPayment', [fd({ order_id: id, amount: 700, method: 'virement' })]);
  const sid = shipIdOf(id);
  const r = await call('returnSaleOrder', [id]);
  check('paid sale returned → its box cancelled', r.ok && box(sid)?.n === 0 && box(sid)?.status === 'cancelled', { ret: r.error ?? 'ok', box: box(sid) });
}
// 4. loan out, return box opened, loan closed by hand → return box cancelled
{
  const [w] = free(1); const p = party();
  const today = new Date().toISOString().slice(0, 10); const later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const id = (await call('createWorkOrder', [fd({ kind: 'loan', oeuvre_ids: [w], party_id: p, start_date: today, end_date: later })])).result.id;
  await call('advanceWorkOrder', [id, 'signed']);
  const out = await call('advanceWorkOrder', [id, 'out']);
  const ret = await call('openShipmentForOrder', [id]);
  const rid = ret.result?.id;
  const closed = await call('advanceWorkOrder', [id, 'closed']);
  check('loan closed by hand → its open return box cancelled', out.ok && closed.ok && rid && box(rid).status === 'cancelled' && box(rid).n === 0, { out: out.error ?? 'ok', ret: ret.error ?? rid, closed: closed.error ?? 'ok', box: rid && box(rid) });
}
// 5. data from before the fix: an open box holding only a cancelled order's work → a new order to the
//    same place opens its own box; Logistics does not list the stale box
{
  const [w1, w2] = free(2); const p = party();
  const a = await sale(w1, p); await call('advanceWorkOrder', [a, 'signed']);
  const stale = shipIdOf(a);
  one(`update public.work_order set status = 'cancelled' where id = '${a}'`); // as the old code left it (box untouched)
  const b = await sale(w2, p); await call('advanceWorkOrder', [b, 'signed']);
  const nb = shipIdOf(b);
  const list = await call('fetchShipments', [false], { page: '/atelier/logistics' });
  const listed = (list.result?.shipments ?? []).map((s) => s.id);
  check('stale box (cancelled order only) → not joined, not listed', nb && nb !== stale && !listed.includes(stale) && listed.includes(nb), { stale, newBox: nb, staleListed: listed.includes(stale), newListed: listed.includes(nb) });
}
// B5 — Sales list with every order, and the other long lists
{
  const n = Number(one(`select count(*) from public.work_order`));
  const r = await call('fetchWorkOrders', []);
  check(`Sales list with ${n} orders`, r.ok && r.result?.orders?.length === n, { listed: r.result?.orders?.length, error: r.error, ms: r.ms });
  const rep = await call('fetchSaleOrdersForReport', [], { page: '/atelier/reports' });
  const sales = Number(one(`select count(*) from public.work_order where kind = 'sale' and status <> 'cancelled'`));
  check(`Reports sale orders (${sales})`, Array.isArray(rep.result) && rep.result.length === sales, { listed: rep.result?.length, ms: rep.ms });
  const all = await call('fetchShipments', [true], { page: '/atelier/logistics' });
  check('Logistics with finished boxes', all.ok && Array.isArray(all.result?.shipments), { listed: all.result?.shipments?.length, error: all.error, ms: all.ms });
}
const bad = report.filter((x) => !x).length;
console.log(`\n${report.length} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
