// TODO §4 « Retour » of a paid sale out of a deposit → the work back « Consigné » at the gallery. LOCAL copy only.
import { call, fd } from './actions.mjs';
import { psql } from './seed.mjs';
const one = (s) => psql(s);
const row = one(`select o.id || '|' || l.oeuvre_id || '|' || o.party_id from public.work_order o join public.work_order_work l on l.order_id = o.id
  where o.kind = 'consignment' and o.status = 'out' and l.line_status = 'active'
  and not exists (select 1 from public.work_order_work x join public.work_order s on s.id = x.order_id where x.oeuvre_id = l.oeuvre_id and s.kind in ('sale','gift') and s.status not in ('cancelled')) limit 1`);
const [dep, w, gallery] = row.split('|');
const buyer = Number(one(`select "ContactID" from public."Contact" where "ContactID" between 100 and 130 order by random() limit 1`));
const st = () => one(`select "statusId" || ' owner ' || "ContactID" || ' at ' || coalesce("LocalisationID"::text, '-') || ' buyer ' || coalesce("AcheteurID"::text, '-') || ' paid ' || coalesce(is_paid::text, '-') from public."Oeuvres" where "OeuvreID" = ${w}`);
const dl = () => one(`select o.status || ' line ' || l.line_status from public.work_order o join public.work_order_work l on l.order_id = o.id and l.oeuvre_id = ${w} where o.id = '${dep}'`);
console.log('deposit', dep, 'work', w, 'gallery', gallery, '→', st(), '|', dl());
const s = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: buyer, price_final: 1200, takeaway: 0 })]);
const id = s.result.id;
await call('advanceWorkOrder', [id, 'signed']);
const p = await call('recordOrderPayment', [fd({ order_id: id, amount: 1200, method: 'virement' })]);
console.log('sale', s.result.ref, 'paid', p.ok ? p.result.status : p.error, '→', st(), '|', dl());
const r = await call('returnSaleOrder', [id]);
console.log('retour', r.ok ? 'ok' : r.error, '→', st(), '|', dl(), '| sale', one(`select status from public.work_order where id = '${id}'`));
