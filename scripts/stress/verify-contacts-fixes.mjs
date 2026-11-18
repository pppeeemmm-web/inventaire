// Contacts fixes on the LOCAL copy (stress test 2026-11-18 evening):
// (1) phone quick-add: one tap saves, no page error, the form clears, the new contact opens;
// (2) merge: a contact with invoices can only be the one kept (refused cleanly otherwise); a buyer who owns sold works
//     merges (orders move before works); supply order, share kit and exhibition roles follow the kept contact.
import { signedIn, go, shot, toasts, browser } from './pw.mjs';
import { psql } from './seed.mjs';

const res = (ok, label, detail = '') => console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
const stamp = Date.now().toString(36);

// (1)
{
  const page = await signedIn('admin', 375, 812);
  await go(page, '/atelier/contacts');
  const qa = page.getByTestId('contacts-quick-add');
  const nom = `Rapide${stamp}`;
  await qa.locator('input[name=prenom]').fill('Essai');
  await qa.locator('input[name=nom]').fill(nom);
  await qa.locator('input[name=email]').fill(`${nom.toLowerCase()}@example.test`);
  await qa.getByRole('button', { name: /Enregistrer/i }).click();
  await page.waitForTimeout(4000);
  const rows = psql(`select count(*) from "Contact" where "Nom"='${nom}'`);
  const cleared = (await qa.locator('input[name=nom]').inputValue().catch(() => '(form gone)')) || '';
  const editorOpen = await page.getByText(/Modifier #\d+/i).first().isVisible().catch(() => false);
  res(rows === '1' && !page.errs.length, 'quick-add saves once with no page error', `rows ${rows}, errors ${JSON.stringify(page.errs)}`);
  res(cleared === '' || cleared === '(form gone)', 'quick-add form cleared (or replaced by the contact card)', `nom field « ${cleared} », card open ${editorOpen}`);
  await shot(page, 'vc1-quickadd');
  await page.context().close();
}

// (2) The pair half-merged by the first test (before the fix): #104 kept its invoice, #1004 got the sold works and
// orders. Add to #1004 a supply order, a share kit and two exhibition roles (one #104 has too).
const A = '104', B = '1004';
const sup = psql(`select id from supply_order order by id limit 1`);
const supWas = psql(`select supplier_id from supply_order where id=${sup}`);
const kit = psql(`select token from private_link order by created_at limit 1`);
const ev = psql(`select id from suivi_process where type='exposition' order by id limit 1`);
psql(`update supply_order set supplier_id=${B} where id=${sup}; update private_link set contact_id=${B} where token='${kit}';
  delete from event_contact where contact_id in (${A}, ${B});
  insert into event_contact (process_id, contact_id, role) values ('${ev}', ${B}, 'prêteur'), ('${ev}', ${B}, 'invité'), ('${ev}', ${A}, 'invité');`);
const before = psql(`select count(*) from "Oeuvres" where "ContactID"=${B}`) + ' works, ' + psql(`select count(*) from work_order where party_id=${B}`) + ' orders on #1004';
async function mergeUi(keepFirst) {
  const page = await signedIn('admin');
  await go(page, '/atelier/contacts');
  await page.locator('input[placeholder^="Rechercher"]').first().fill('Collector05');
  await page.waitForTimeout(800);
  const row = (id) => page.locator('tr').filter({ has: page.locator('td', { hasText: new RegExp(`^${id}$`) }) }).first();
  await row(A).locator('input[type=checkbox]').check();
  await row(B).locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: /^Fusionner$/i }).first().click();
  const dlg = page.locator('[aria-labelledby=merge-title]');
  await dlg.locator('input[name=merge-keep]').nth(keepFirst ? 0 : 1).check();
  await dlg.locator('button', { hasText: /^Fusionner$/i }).click();
  await page.waitForTimeout(5000);
  const t = await toasts(page);
  await shot(page, keepFirst ? 'vc3-merge-keep104' : 'vc2-merge-keep1004');
  const errs = page.errs;
  await page.context().close();
  return { t: t.filter((x) => x.length > 2).slice(-1)[0] ?? '', errs };
}
// (2a) keep #1004, merge #104 (it has an invoice) away → refused before any write
{
  const snap = () => psql(`select (select count(*) from "Contact" where "ContactID" in (${A},${B}))||'/'||(select count(*) from "Oeuvres" where "ContactID"=${B})||'/'||(select count(*) from work_order where party_id=${A})`);
  const s0 = snap();
  const r = await mergeUi(false);
  res(snap() === s0 && /factures/.test(r.t), 'merging away the contact with an invoice is refused, nothing moves', `${r.t} (contacts/works/orders ${s0} → ${snap()})`);
}
// (2b) keep #104 (the invoiced one), merge #1004 away → finishes; works, orders, roles, kit, supply order follow
{
  const r = await mergeUi(true);
  const q = (sql) => psql(sql);
  res(q(`select count(*) from "Contact" where "ContactID"=${B}`) === '0', 'merge of a buyer who owns sold works finishes', `${before} → toast « ${r.t} », errors ${JSON.stringify(r.errs)}`);
  res(q(`select count(*) from "Oeuvres" where "ContactID"=${B} or "LocalisationID"=${B} or "AcheteurID"=${B}`) === '0' && q(`select count(*) from work_order where party_id=${B}`) === '0',
    'works and orders all on the kept contact', `#104 owns ${q(`select count(*) from "Oeuvres" where "ContactID"=${A}`)} works, ${q(`select count(*) from work_order where party_id=${A}`)} orders`);
  res(q(`select supplier_id from supply_order where id=${sup}`) === A, 'supply order follows', '');
  res(q(`select contact_id from private_link where token='${kit}'`) === A, 'share kit keeps its contact', '');
  const roles = q(`select string_agg(role, ',' order by role) from event_contact where process_id='${ev}' and contact_id=${A}`);
  res(roles === 'invité,prêteur', 'exhibition roles kept, the shared one once', roles);
}
psql(`update supply_order set supplier_id=${supWas} where id=${sup}; update private_link set contact_id=null where token='${kit}';`);
await browser.close();
