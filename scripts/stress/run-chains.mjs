// Stress chains on the LOCAL copy: every automatic chain end to end through the app's own Server
// Actions, each step timed, then the database checked. Results → dump/chains-<stamp>.json + console table.
// Prereqs: local Supabase seeded (seed.mjs), r2-stub.mjs, stress dev server (run-stress-dev.mjs),
// /atelier/sales opened once so its actions are compiled.
// Usage: node scripts/stress/run-chains.mjs [chainName ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { call, fd } from './actions.mjs';
import { psql } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const R2 = path.join(here, 'dump', 'r2');
const results = [];
let chain = '';
const one = (sql) => psql(sql);
const json = (sql) => JSON.parse(psql(`select coalesce(json_agg(_r), '[]') from (${sql}) _r`) || '[]');

async function step(name, action, args, opts = {}, check) {
  const r = await call(action, args, opts);
  let verdict = r.ok ? 'ok' : `ERR ${r.error}`;
  let detail = null;
  if (check) {
    try { detail = await check(r); if (detail && detail.fail) verdict = `FAIL ${detail.fail}`; }
    catch (e) { verdict = `FAIL ${e.message}`; }
  }
  if (opts.expectError) verdict = r.ok ? `FAIL expected refusal, got ok` : `ok (refused: ${String(r.error).slice(0, 60)})`;
  const rec = { chain, step: name, action, ms: r.ms, verdict, detail };
  results.push(rec);
  console.log(`${verdict.startsWith('ok') ? '✓' : '✗'} ${chain.padEnd(14)} ${name.padEnd(44)} ${String(r.ms).padStart(6)} ms  ${verdict}${detail && !detail.fail ? '  ' + JSON.stringify(detail).slice(0, 160) : ''}`);
  return r;
}
const expect = (cond, msg) => (cond ? null : { fail: msg });
const work = (id) => json(`select "statusId" s, "ContactID" owner, "LocalisationID" loc, "AcheteurID" buyer, is_paid paid, localisation_address_id addr from public."Oeuvres" where "OeuvreID"=${id}`)[0];
const order = (id) => json(`select status, ref, paper_path, parent_order_id, commission_amount, address_id from public.work_order where id='${id}'`)[0];
const r2Has = (bucket, key) => key && fs.existsSync(path.join(R2, bucket, key));
// Works free for a new order: Disponible, catalogued, priced, on no active line, not used by a past run.
const used = new Set();
function freeWorks(n, extra = '') {
  const rows = json(`select "OeuvreID" id from public."Oeuvres" o where "statusId"=2 and "Catalogué" and not "NeedsPhotograph" and "Prix" is not null and deleted_at is null
    and not exists (select 1 from public.work_order_work l join public.work_order w on w.id=l.order_id where l.oeuvre_id=o."OeuvreID" and l.line_status='active' and w.status not in ('cancelled','closed','delivered','handed_over'))
    and not exists (select 1 from public.event_work e where e.oeuvre_id=o."OeuvreID") ${extra}
    order by "OeuvreID" desc limit ${n + used.size}`).map((r) => r.id).filter((id) => !used.has(id)).slice(0, n);
  rows.forEach((id) => used.add(id));
  return rows;
}
const contact = (name) => Number(one(`select "ContactID" from public."Contact" where coalesce("NomInstitution","Nom")='${name}'`));
const COLLECTOR = () => Number(one(`select c."ContactID" from public."Contact" c where c."Nom" like 'Collector%' and (select count(*) from public.contact_addresses a where a.contact_id=c."ContactID")=1 order by random() limit 1`));
const today = new Date().toISOString().slice(0, 10);
const plusDays = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

const SHIP_STEPS = { ship: ['open', 'photos', 'picked', 'packed', 'insured', 'labelled', 'shipped', 'delivered'], pickup: ['open', 'photos', 'picked', 'packed', 'delivered'], return: ['open', 'photos', 'packed', 'insured', 'labelled', 'shipped', 'delivered'] };
/** Walk a shipment through its checklist to « delivered », one advanceShipment per step. */
async function driveShipment(id, label) {
  for (let i = 0; i < 9; i++) {
    const s = json(`select kind, status from public.shipment where id='${id}'`)[0];
    const steps = SHIP_STEPS[s.kind]; const next = steps[steps.indexOf(s.status) + 1];
    if (!next) return s;
    const r = await step(`${label} ${s.kind} → ${next}`, 'advanceShipment', [id, next]);
    if (!r.ok) return s;
  }
}
const chains = {
  // A — sale shipped: draft → signed (shipment opens) → deposit → paid (COA) → invoice → shipment delivered → order delivered → « Retour » → credit note
  async sale() {
    const [w] = freeWorks(1); const buyer = COLLECTOR(); const price = Number(one(`select "Prix" from public."Oeuvres" where "OeuvreID"=${w}`));
    const c = await step('create sale (draft + paper)', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: buyer, price_final: price, price_catalogue: price })], {}, (r) => {
      const o = order(r.result.id); return expect(o?.status === 'draft' && r2Has('vault', o.paper_path), `draft/paper: ${JSON.stringify(o)}`) ?? { ref: o.ref, paper: o.paper_path };
    });
    if (!c.ok) return; const id = c.result.id;
    await step('sign → work Réservé + shipment open', 'advanceWorkOrder', [id, 'signed'], {}, () => {
      const x = work(w); const sh = json(`select s.status, s.kind from public.shipment s join public.shipment_work sw on sw.shipment_id=s.id join public.work_order_work l on l.id=sw.order_line_id where l.order_id='${id}'`);
      return expect(x.s === 4 && x.buyer === buyer && sh.length === 1 && sh[0].status === 'open', `work ${JSON.stringify(x)} shipments ${JSON.stringify(sh)}`) ?? { shipment: sh[0] };
    });
    await step('pay 30 % → Acompte', 'recordOrderPayment', [fd({ order_id: id, amount: Math.round(price * 0.3), method: 'virement' })], {}, () => {
      const o = order(id); return expect(o.status === 'deposit_paid' && work(w).s === 4, `order ${o.status}`);
    });
    await step('pay the rest → Soldée, owner, paid, COA', 'recordOrderPayment', [fd({ order_id: id, amount: price - Math.round(price * 0.3), method: 'virement' })], {}, () => {
      const x = work(w); const coa = json(`select d.storage_path, d.kind from public.document d join public.work_order_work l on l.coa_document_id=d.id where l.order_id='${id}'`);
      return expect(order(id).status === 'paid' && x.s === 6 && x.owner === buyer && x.paid && coa.length === 1 && r2Has('vault', coa[0].storage_path), `work ${JSON.stringify(x)} coa ${JSON.stringify(coa)}`) ?? { coa: coa[0]?.storage_path };
    });
    const inv = await step('issue invoice (admin)', 'issueInvoice', [[id]], {}, (r) => {
      const i = json(`select number, total, paper_path from public.invoice order by created_at desc limit 1`)[0];
      return expect(i && r2Has('vault', i.paper_path), `invoice ${JSON.stringify(i)}`) ?? i;
    });
    await step('invoice again for the same order (should refuse)', 'issueInvoice', [[id]], { expectError: true });
    const ship = json(`select distinct s.id from public.shipment s join public.shipment_work sw on sw.shipment_id=s.id join public.work_order_work l on l.id=sw.order_line_id where l.order_id='${id}' and s.kind='ship'`)[0];
    if (ship) {
      await driveShipment(ship.id, 'shipment');
      results.at(-1).detail = { order: order(id).status, work: work(w), reminder: one(`select count(*) from public.suivi_reminder where message like '%${order(id).ref}%'`) };
    }
    await step('« Retour » in the 14 days → Pem Disponible, not paid', 'returnSaleOrder', [id], {}, () => {
      const x = work(w); return expect(order(id).status === 'cancelled' && x.s === 2 && x.owner === 13 && !x.paid, `work ${JSON.stringify(x)}`) ?? { work: x };
    });
    const invId = one(`select id from public.invoice where kind='invoice' order by created_at desc limit 1`);
    if (inv.ok) await step('credit note for the return', 'creditInvoice', [invId], {}, () => json(`select number, total from public.invoice where kind='credit_note' order by created_at desc limit 1`)[0]);
  },

  // B — sale paid at the studio and taken away: no shipment, delivered at once
  async takeaway() {
    const [w] = freeWorks(1); const buyer = COLLECTOR(); const price = Number(one(`select "Prix" from public."Oeuvres" where "OeuvreID"=${w}`));
    const c = await step('create sale « emportée »', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: buyer, price_final: price, takeaway: 1 })]);
    if (!c.ok) return; const id = c.result.id;
    await step('sign (no shipment expected)', 'advanceWorkOrder', [id, 'signed'], {}, () => {
      const n = Number(one(`select count(*) from public.shipment_work sw join public.work_order_work l on l.id=sw.order_line_id where l.order_id='${id}'`)); return expect(n === 0, `${n} shipment lines`);
    });
    await step('pay in full, taken away → delivered', 'recordOrderPayment', [fd({ order_id: id, amount: price, method: 'cb', takeaway: 1 })], {}, (r) => {
      const x = work(w); return expect(r.result?.status === 'delivered' && x.s === 6 && x.loc === buyer, `status ${r.result?.status} work ${JSON.stringify(x)}`) ?? { work: x };
    });
  },

  // C — deposit at a gallery with two addresses → sale out of the deposit → « Retour » before delivery → deposit back
  async deposit() {
    const ws = freeWorks(3); const gal = Number(one(`select contact_id from public.contact_addresses where label='Réserve' and contact_id in (select "ContactID" from public."Contact" where "NomInstitution" like 'Galerie%') limit 1`));
    const c = await step('create deposit (gallery, 2 addresses, no address)', 'createWorkOrder', [fd({ kind: 'consignment', oeuvre_ids: ws, party_id: gal, start_date: today, end_date: plusDays(90), commission_pct: 40 })], {}, (r) => {
      const o = order(r.result.id); return expect(o.address_id == null, `address ${o.address_id}`) ?? { ref: o.ref, address: 'none (picker expected)' };
    });
    if (!c.ok) return; const id = c.result.id;
    const addr = Number(one(`select id from public.contact_addresses where contact_id=${gal} and label='Réserve'`));
    await step('pick the address on the order', 'setOrderAddress', [id, addr]);
    await step('sign → return shipment? no: ship to gallery', 'advanceWorkOrder', [id, 'signed'], {}, () => json(`select kind, status, address_id from public.shipment s where exists (select 1 from public.shipment_work sw where sw.shipment_id=s.id and sw.oeuvre_id=${ws[0]})`));
    const ship = json(`select distinct s.id from public.shipment s join public.shipment_work sw on sw.shipment_id=s.id join public.work_order_work l on l.id=sw.order_line_id where l.order_id='${id}'`)[0];
    await driveShipment(ship.id, 'deposit shipment');
    results.at(-1).detail = { order: order(id).status, works: ws.map(work) };
    // sale out of the deposit
    const buyer = COLLECTOR(); const w = ws[0]; const price = Number(one(`select "Prix" from public."Oeuvres" where "OeuvreID"=${w}`));
    const s = await step('sale of a consigned work', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: buyer, price_final: price })]);
    if (!s.ok) return; const sid = s.result.id;
    await step('sign (work stays at the gallery)', 'advanceWorkOrder', [sid, 'signed'], {}, () => ({ work: work(w), shipments: json(`select kind, status, to_contact_id from public.shipment s join public.shipment_work sw on sw.shipment_id=s.id where sw.oeuvre_id=${w}`) }));
    await step('pay in full → parent deposit + commission', 'recordOrderPayment', [fd({ order_id: sid, amount: price, method: 'virement' })], {}, () => {
      const o = order(sid); const line = json(`select line_status, closed_by_order_id from public.work_order_work where order_id='${id}' and oeuvre_id=${w}`)[0];
      return expect(o.parent_order_id === id && Number(o.commission_amount) === Math.round(price * 40) / 100 && line.line_status === 'sold', `order ${JSON.stringify(o)} line ${JSON.stringify(line)}`) ?? { commission: o.commission_amount, line };
    });
    await step('« Retour » before delivery → Consigné at gallery, line reopened', 'returnSaleOrder', [sid], {}, () => {
      const x = work(w); const line = json(`select line_status from public.work_order_work where order_id='${id}' and oeuvre_id=${w}`)[0];
      return expect(x.s === 7 && x.loc === gal && line.line_status === 'active' && order(id).status === 'out', `work ${JSON.stringify(x)} line ${JSON.stringify(line)} dep ${order(id).status}`) ?? { work: x };
    });
    // the gallery sends everything back
    const back = await step('open the return shipment', 'openShipmentForOrder', [id, null]);
    if (back.ok) await driveShipment(back.result.id, 'return');
    results.at(-1).detail = { deposit: order(id).status, works: ws.map((x) => work(x).s) };
  },

  // D — loan and gift
  async loanGift() {
    const [a, b] = freeWorks(2); const mus = contact('Musée Test 1'); const friend = COLLECTOR();
    const l = await step('create loan', 'createWorkOrder', [fd({ kind: 'loan', oeuvre_ids: [a], party_id: mus, start_date: today, end_date: plusDays(30) })]);
    if (l.ok) {
      await step('loan signed', 'advanceWorkOrder', [l.result.id, 'signed']);
      await step('loan out (by hand) → Prêt', 'advanceWorkOrder', [l.result.id, 'out'], {}, () => expect(work(a).s === 8, `work ${JSON.stringify(work(a))}`));
      await step('loan closed → back Disponible', 'advanceWorkOrder', [l.result.id, 'closed'], {}, () => expect(work(a).s === 2 && work(a).loc === 13, `work ${JSON.stringify(work(a))}`));
    }
    const g = await step('create gift', 'createWorkOrder', [fd({ kind: 'gift', oeuvre_ids: [b], party_id: friend })]);
    if (g.ok) {
      await step('gift deed signed', 'advanceWorkOrder', [g.result.id, 'signed']);
      await step('gift handed over → Don, owner', 'advanceWorkOrder', [g.result.id, 'handed_over'], {}, () => expect(work(b).s === 11 && work(b).owner === friend, `work ${JSON.stringify(work(b))}`));
    }
  },

  // E — cancellations and refused steps
  async refusals() {
    const [a, b] = freeWorks(2); const buyer = COLLECTOR();
    const s = await step('create sale', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [a], party_id: buyer, price_final: 999 })]);
    await step('skip a step: draft → paid', 'advanceWorkOrder', [s.result.id, 'paid'], { expectError: true });
    await step('sign', 'advanceWorkOrder', [s.result.id, 'signed']);
    await step('second sale of the reserved work', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [a], party_id: COLLECTOR(), price_final: 999 })], { expectError: true });
    await step('cancel signed sale → Disponible', 'cancelWorkOrder', [s.result.id], {}, () => expect(work(a).s === 2 && work(a).buyer == null, `work ${JSON.stringify(work(a))}`));
    await step('sale without a price', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [b], party_id: buyer })], { expectError: true });
    await step('order to Pem himself', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [b], party_id: 13, price_final: 10 })], { expectError: true });
    await step('deposit without dates', 'createWorkOrder', [fd({ kind: 'consignment', oeuvre_ids: [b], party_id: contact('Galerie Test A') })], { expectError: true });
    await step('deposit ends before it starts', 'createWorkOrder', [fd({ kind: 'consignment', oeuvre_ids: [b], party_id: contact('Galerie Test A'), start_date: plusDays(10), end_date: today })], { expectError: true });
    await step('sale of a work in production (allowed: commission / pre-order)', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [Number(one(`select "OeuvreID" from public."Oeuvres" where "statusId"=1 limit 1`))], party_id: buyer, price_final: 10 })]);
    await step('sale of an archived work', 'createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [Number(one(`select "OeuvreID" from public."Oeuvres" where "statusId"=3 limit 1`))], party_id: buyer, price_final: 10 })], { expectError: true });
    await step('negative payment', 'recordOrderPayment', [fd({ order_id: s.result.id, amount: -5 })], { expectError: true });
    await step('payment with a bad date', 'recordOrderPayment', [fd({ order_id: s.result.id, amount: 5, payment_date: '2026-13-45' })], { expectError: true });
  },

  // F — races: the same work in two orders at once; ten orders at once (numbering); two full payments at once
  async races() {
    const [w] = freeWorks(1);
    const both = await Promise.all([0, 1].map(() => call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: COLLECTOR(), price_final: 500 })])));
    const okN = both.filter((r) => r.ok).length;
    const draftsN = Number(one(`select count(*) from public.work_order_work l join public.work_order o on o.id=l.order_id where l.oeuvre_id=${w} and o.status='draft'`));
    results.push({ chain, step: 'same work, two sales at once', action: 'createWorkOrder ×2', ms: Math.max(...both.map((r) => r.ms)), verdict: 'info', detail: { accepted: okN, drafts: draftsN } });
    console.log(`· ${chain} same work two sales at once: accepted ${okN}, drafts ${draftsN}`);
    // signing both
    const ids = both.filter((r) => r.ok).map((r) => r.result.id);
    if (ids.length === 2) {
      const signs = await Promise.all(ids.map((id) => call('advanceWorkOrder', [id, 'signed'])));
      results.push({ chain, step: 'sign both drafts at once', action: 'advanceWorkOrder ×2', ms: Math.max(...signs.map((r) => r.ms)), verdict: signs.filter((r) => r.ok).length > 1 ? 'FAIL both signed — work reserved twice' : 'ok', detail: { signed: signs.filter((r) => r.ok).length, errors: signs.map((r) => r.error) } });
      console.log(`· ${chain} sign both at once: ${signs.filter((r) => r.ok).length} signed ${signs.map((r) => r.error).join(' | ')}`);
    }
    // ten at once
    const ten = freeWorks(10);
    const t = performance.now();
    const many = await Promise.all(ten.map((x) => call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [x], party_id: COLLECTOR(), price_final: 700 })])));
    const refs = many.filter((r) => r.ok).map((r) => r.result.ref).sort();
    const dup = refs.length - new Set(refs).size;
    results.push({ chain, step: '10 sales created at once', action: 'createWorkOrder ×10', ms: Math.round(performance.now() - t), verdict: many.every((r) => r.ok) && !dup ? 'ok' : `FAIL ${many.filter((r) => !r.ok).map((r) => r.error).join(' | ')}`, detail: { refs } });
    console.log(`· ${chain} 10 at once: ${refs.join(' ')} errors ${many.filter((r) => !r.ok).map((r) => r.error).join(' | ')}`);
    // double full payment
    const [p] = freeWorks(1);
    const o = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [p], party_id: COLLECTOR(), price_final: 1000 })]);
    await call('advanceWorkOrder', [o.result.id, 'signed']);
    const pays = await Promise.all([0, 1].map(() => call('recordOrderPayment', [fd({ order_id: o.result.id, amount: 1000, method: 'virement' })])));
    const total = Number(one(`select coalesce(sum(amount),0) from public.payments where work_order_id='${o.result.id}'`));
    const coas = Number(one(`select count(*) from public.document where kind ilike '%coa%' and oeuvre_id=${p}`));
    results.push({ chain, step: 'two full payments at once', action: 'recordOrderPayment ×2', ms: Math.max(...pays.map((r) => r.ms)), verdict: total > 1000 ? `FAIL ${total} € recorded for a 1000 € sale` : 'ok', detail: { accepted: pays.filter((r) => r.ok).length, total, coas, errors: pays.map((r) => r.error) } });
    console.log(`· ${chain} double payment: total ${total}, coas ${coas}, ${pays.map((r) => r.error).join(' | ')}`);
  },

  // G — volume: 60 sales through draft → signed → paid one after the other; then the Sales list read
  async volume() {
    const ws = freeWorks(60); const times = { create: [], sign: [], pay: [] };
    for (const w of ws) {
      const c = await call('createWorkOrder', [fd({ kind: 'sale', oeuvre_ids: [w], party_id: COLLECTOR(), price_final: 800 })]); times.create.push(c.ms);
      if (!c.ok) { console.log('volume create', c.error); continue; }
      const s = await call('advanceWorkOrder', [c.result.id, 'signed']); times.sign.push(s.ms);
      const p = await call('recordOrderPayment', [fd({ order_id: c.result.id, amount: 800, method: 'cb' })]); times.pay.push(p.ms);
      if (!s.ok || !p.ok) console.log('volume', s.error, p.error);
    }
    const stat = (a) => { const s = [...a].sort((x, y) => x - y); return { n: s.length, p50: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s.at(-1) }; };
    for (const [k, v] of Object.entries(times)) { results.push({ chain, step: `60 × ${k}`, action: k, ms: stat(v).p50, verdict: 'info', detail: stat(v) }); console.log(`· volume ${k}`, stat(v)); }
    await step('Sales list (all orders)', 'fetchWorkOrders', [], {}, (r) => ({ orders: r.result?.orders?.length ?? r.result?.length, bytes: r.raw.length }));
    await step('Shipments list', 'fetchShipments', [true], {}, (r) => ({ shipments: r.result?.shipments?.length }));
    await step('Report sale orders', 'fetchSaleOrdersForReport', []);
  },
};

// A full work-card form built from the stored row (saveWork writes every field it is given).
function workForm(id, patch = {}) {
  const w = json(`select o.*, extract(year from "Année")::int yr, (select string_agg(theme_id::text, ',') from public.oeuvre_theme where oeuvre_id=o."OeuvreID") th from public."Oeuvres" o where "OeuvreID"=${id}`)[0];
  const f = {
    oeuvre_id: id, titre: w.Titre, annee: w.yr, technique: w.Technique, support: w.Support, format: w.Format,
    hauteur: w.Hauteur, largeur: w.Largeur, prix: w.Prix, status_id: w.statusId, contact_id: w.ContactID,
    localisation_id: w.LocalisationID, exposable: w.Exposable ? 1 : 0, catalogued: w['Catalogué'] ? 1 : 0,
    needs_photograph: w.NeedsPhotograph ? 1 : 0, historique_base: w.Historique ?? '', themes: (w.th ?? '').split(',').filter(Boolean),
    ...patch,
  };
  return fd(f);
}
const wrow = (id) => json(`select "Titre" t, "Prix" prix, "statusId" s, "Catalogué" cat, "NeedsPhotograph" photo, edited_by, (select string_agg(theme_id::text, ',' order by theme_id) from public.oeuvre_theme where oeuvre_id=${id}) themes from public."Oeuvres" where "OeuvreID"=${id}`)[0];

Object.assign(chains, {
  // H — review: a team member's edit waits in Audit; admin approves; the hidden « skip review » switch
  async review() {
    const [w] = freeWorks(1); const before = wrow(w);
    await step('team edits price → pending', 'saveWork', [workForm(w, { prix: 9999 })], { user: 'team', page: '/atelier/inventory' }, (r) => {
      const p = json(`select id, status, change_kind from public.pending_changes where oeuvre_id=${w} order by id desc limit 1`)[0];
      return expect(r.result?.pending === true && p?.status === 'pending' && wrow(w).prix === before.prix, `result ${JSON.stringify(r.result)} pending ${JSON.stringify(p)}`) ?? { pending: p };
    });
    const pid = Number(one(`select id from public.pending_changes where oeuvre_id=${w} order by id desc limit 1`));
    await step('team approves own change (should refuse)', 'approvePendingChange', [pid], { user: 'team', page: '/atelier/audit', expectError: true });
    await step('admin approves → price applied', 'approvePendingChange', [pid], { page: '/atelier/audit' }, () => expect(Number(wrow(w).prix) === 9999, `prix ${wrow(w).prix}`) ?? { edited_by: wrow(w).edited_by });
    const [w2] = freeWorks(1);
    await step('team sends __skip_review=1 (should still be reviewed)', 'saveWork', [workForm(w2, { prix: 1, __skip_review: 1 })], { user: 'team', page: '/atelier/inventory' }, (r) => {
      const x = wrow(w2); return Number(x.prix) === 1 ? { fail: `applied without review: price now ${x.prix} (result ${JSON.stringify(r.result)})` } : { result: r.result };
    });
    const [w3] = freeWorks(1); const t3 = wrow(w3).themes;
    await step('outside account, __skip_review=1, rewrites themes', 'saveWork', [workForm(w3, { titre: 'piraté', themes: ['1', '2', '3'], __skip_review: 1 })], { user: 'outsider', page: '/atelier/inventory' }, (r) => {
      const x = wrow(w3); return x.themes !== t3 || x.t === 'piraté' ? { fail: `outsider changed work #${w3}: themes ${t3} → ${x.themes}, title ${x.t} (result ${JSON.stringify(r.result)})` } : { result: r.result };
    });
  },

  // I — stages: production → catalogued → photo done → available; tasks follow; bin pauses tasks
  async stages() {
    const w = Number(one(`select "OeuvreID" from public."Oeuvres" where "statusId"=1 and not "Catalogué" and deleted_at is null and "Prix" is not null and not exists (select 1 from public.work_order_work l where l.oeuvre_id="OeuvreID") order by 1 limit 1`));
    const tasks = () => json(`select t.label, a.done from public.work_action a join public.work_action_type t on t.id=a.action_type_id where a.oeuvre_id=${w} order by 1`);
    results.push({ chain, step: 'start', verdict: 'info', detail: { w, row: wrow(w), tasks: tasks() } });
    await step('catalogue it, photo still needed', 'saveWork', [workForm(w, { catalogued: 1, needs_photograph: 1, status_id: 1 })], { page: '/atelier/inventory' }, () => ({ row: wrow(w), tasks: tasks() }));
    await step('photo done → Disponible', 'saveWork', [workForm(w, { catalogued: 1, needs_photograph: 0, status_id: 2 })], { page: '/atelier/inventory' }, () => {
      const x = wrow(w); return expect(x.s === 2 && x.cat && !x.photo, `row ${JSON.stringify(x)}`) ?? { tasks: tasks() };
    });
    await step('archive it', 'saveWork', [workForm(w, { status_id: 3, catalogued: 1 })], { page: '/atelier/inventory' }, () => expect(wrow(w).s === 3, `row ${JSON.stringify(wrow(w))}`));
    await step('archive → Disponible directly (photo done: allowed)', 'saveWork', [workForm(w, { status_id: 2, catalogued: 1 })], { page: '/atelier/inventory' }, () => expect(wrow(w).s === 2, `row ${JSON.stringify(wrow(w))}`));
    const p = Number(one(`select "OeuvreID" from public."Oeuvres" where "statusId"=1 and deleted_at is null and exists (select 1 from public.work_action a where a.oeuvre_id="OeuvreID" and not a.done) order by 1 desc limit 1`));
    await step('to the bin (admin) → open tasks paused', 'deleteWork', [p], { page: '/atelier/inventory' }, () => ({ deleted: one(`select deleted_at is not null from public."Oeuvres" where "OeuvreID"=${p}`), tasks: json(`select done, paused_at is not null paused from public.work_action where oeuvre_id=${p}`) }));
    await step('restore from the bin → tasks resume', 'restoreSoftDeletedWorks', [[p]], { page: '/atelier/inventory' }, () => ({ tasks: json(`select done, paused_at is not null paused from public.work_action where oeuvre_id=${p}`) }));
    await step('team member deletes a work (admin only?)', 'deleteWork', [p], { user: 'team', page: '/atelier/inventory' }, () => ({ deleted: one(`select deleted_at is not null from public."Oeuvres" where "OeuvreID"=${p}`) }));
  },
  // K — exhibition: event → dates → template steps → selection → deposit to the venue from the event → prep ticks → the event's view
  async exhibition() {
    const ev = await step('create event', 'createEvent', [{ nom: 'Expo Stress', type: 'exposition' }], { page: '/atelier/exhibitions' });
    if (!ev.ok) return; const id = ev.result.event.id; const gal = contact('Galerie Test C');
    for (const [f, v] of [['date_debut', plusDays(20)], ['date_fin', plusDays(60)], ['contact_id', gal], ['localisation', 'Paris']]) await step(`set ${f}`, 'patchEventField', [id, f, v], { page: '/atelier/exhibitions' });
    await step('apply step template', 'applyStepTemplate', [id, 'exposition', 'fr', 0], { page: '/atelier/exhibitions' }, (r) => ({ steps: r.result?.steps?.length }));
    const ws = freeWorks(12);
    const sel = await step('selection of 12 works', 'createEventSelection', [id, 'Sélection Expo Stress', ws], { page: '/atelier/exhibitions' });
    await step('deposit to the venue from the event', 'createWorkOrder', [fd({ kind: 'consignment', oeuvre_ids: ws, party_id: gal, start_date: plusDays(15), end_date: plusDays(65), commission_pct: 35, process_id: id })], {}, (r) => ({ ref: r.result?.ref }));
    for (const w of ws.slice(0, 3)) await step(`tick constat out #${w}`, 'tickEventWork', [id, w, 'constat_out', true], { page: '/atelier/exhibitions' });
    await step('load the event (works, orders, prep)', 'loadEvent', [id], { page: '/atelier/exhibitions' }, (r) => ({ works: r.result?.event?.works?.length, orders: r.result?.event?.orders?.length, steps: r.result?.event?.steps?.length, bytes: r.raw.length }));
    await step('events list', 'listEvents', [], { page: '/atelier/exhibitions' }, (r) => ({ n: r.result?.events?.length ?? r.result?.length }));
    await step('reminders written for the deposit dates', 'listEvents', [], { page: '/atelier/exhibitions' }, () => ({ reminders: json(`select message, remind_at from public.suivi_reminder where created_at > now() - interval '2 minutes' order by remind_at`) }));
  },

  // L — supplies: order → ordered → partial receive (stock up) → the same receive twice at once
  async supplies() {
    const sup = contact('Fournisseur Test 1');
    const items = json(`select id, quantity from public.stock_item where supplier_id=${sup} order by id limit 2`);
    if (items.length < 2) { results.push({ chain, step: 'needs 2 items of the supplier', verdict: 'info' }); return; }
    const so = await step('create supply order (2 lines)', 'saveSupplyOrder', [{ id: null, supplier_id: sup, notes: 'stress', lines: items.map((i) => ({ id: null, stock_item_id: i.id, qty_ordered: 10, unit_price_ht: 4.5 })) }], { page: '/atelier/stock' }, () => json(`select ref, status from public.supply_order order by id desc limit 1`)[0]);
    if (!so.ok) return; const id = so.result.id;
    await step('mark ordered', 'setSupplyOrderStatus', [id, 'ordered'], { page: '/atelier/stock' });
    const lines = json(`select id, stock_item_id from public.supply_order_line where order_id=${id} order by id`);
    await step('receive 4 of the first line', 'receiveSupplyOrder', [id, [{ line_id: lines[0].id, qty: 4 }]], { page: '/atelier/stock' }, () => {
      const q = Number(one(`select quantity from public.stock_item where id=${items[0].id}`)); return expect(q === items[0].quantity + 4, `stock ${items[0].quantity} → ${q}`) ?? { stock: `${items[0].quantity} → ${q}`, status: one(`select status from public.supply_order where id=${id}`) };
    });
    const before = Number(one(`select quantity from public.stock_item where id=${items[1].id}`));
    const two = await Promise.all([0, 1].map(() => call('receiveSupplyOrder', [id, [{ line_id: lines[1].id, qty: 6 }]], { page: '/atelier/stock' })));
    const after = Number(one(`select quantity from public.stock_item where id=${items[1].id}`));
    const recv = Number(one(`select qty_received from public.supply_order_line where id=${lines[1].id}`));
    results.push({ chain, step: 'same receive twice at once', action: 'receiveSupplyOrder ×2', ms: Math.max(...two.map((r) => r.ms)), verdict: after - before > 6 ? `FAIL stock +${after - before} for 6 delivered` : 'ok', detail: { accepted: two.filter((r) => r.ok).length, stock: `${before} → ${after}`, qty_received: recv, errors: two.map((r) => r.error) } });
    console.log(`· supplies receive twice at once: stock ${before} → ${after}, line received ${recv}, ${two.map((r) => r.error).join(' | ')}`);
    await step('supply orders list', 'listSupplyOrders', [], { page: '/atelier/stock' }, (r) => ({ n: r.result?.orders?.length }));
  },

  // J — the reads every tab hop pays: badges, What's new, work rules (as admin and as team), on the stressed data
  async badges() {
    for (const user of ['admin', 'team']) {
      await step(`${user}: sidebar counts`, 'getSidebarCounts', [], { user, page: '/atelier/overview' }, (r) => r.result);
      await step(`${user}: Kaizen / What's new unseen`, 'kaizenUnseenCounts', [], { user, page: '/atelier/overview' }, (r) => r.result);
    }
    await step('admin: run the work-rule checks', 'runWorkRuleChecks', [], { page: '/atelier/audit' }, (r) => {
      const v = r.result; return v && typeof v === 'object' ? { keys: Object.keys(v), sample: JSON.stringify(v).slice(0, 300) } : v;
    });
    await step('team: run the work-rule checks', 'runWorkRuleChecks', [], { user: 'team', page: '/atelier/audit' }, (r) => ({ sample: JSON.stringify(r.result).slice(0, 200) }));
    await step('admin: pending changes list', 'listPendingChanges', [], { page: '/atelier/audit' }, (r) => ({ n: r.result?.length }));
  },
});

const pick = process.argv.slice(2);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
for (const [name, fn] of Object.entries(chains)) {
  if (pick.length && !pick.includes(name)) continue;
  chain = name;
  const t = performance.now();
  try { await fn(); } catch (e) { results.push({ chain, step: 'CRASH', verdict: `FAIL ${e.message}` }); console.log(`✗ ${chain} crashed: ${e.stack}`); }
  console.log(`── ${name}: ${Math.round(performance.now() - t)} ms`);
}
fs.writeFileSync(path.join(here, 'dump', `chains-${stamp}.json`), JSON.stringify(results, null, 1));
const fails = results.filter((r) => /^(FAIL|ERR)/.test(r.verdict));
console.log(`\n${results.length} steps, ${fails.length} failed → dump/chains-${stamp}.json`);
