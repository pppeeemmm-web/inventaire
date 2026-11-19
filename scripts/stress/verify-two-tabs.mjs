// Work card in two tabs on the LOCAL copy (stress test round 3 fix, Pem « go for it »):
// (1) tab B opened first, tab A saves a price, tab B then saves a title → B refused with a message, A's price kept;
// (2) the same card saves three times in a row (its own stamp follows) → all saved;
// (3) B reopened → its save goes through;
// (4) a team member's edit from the card still becomes a proposal, and the admin's approval applies it;
// (5) flow review P1: tab A loads Inventory (card closed), tab B saves the work, tab A then opens the card from its list → A refused;
// (6) P6: the work binned while its card is open → « mise à la corbeille », not « enregistrée ailleurs »;
// (7) trace gap: restoring a version stamps now (an open card's older stamp no longer matches).
import { signedIn, go, shot, toasts, browser } from './pw.mjs';
import { psql } from './seed.mjs';
import fs from 'node:fs';
import { call } from './actions.mjs';
// A stale cached action list can hold two ids for one action (earlier builds): read the live one only.
fs.rmSync(new URL('./dump/actions-manifest.json', import.meta.url), { force: true });

const res = (ok, label, detail = '') => console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
const stamp = Date.now().toString(36);
const W = psql(`select "OeuvreID" from "Oeuvres" where "statusId"=2 and deleted_at is null order by "OeuvreID" desc offset 7 limit 1`);
const row = () => psql(`select coalesce("Prix"::text,'-')||' | '||"Titre" from "Oeuvres" where "OeuvreID"=${W}`);
const start = row();

async function openCard(who = 'admin') {
  const p = await signedIn(who);
  await go(p, `/atelier/inventory?work=${W}`);
  await p.getByText(`#${W}`).first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(3500);
  return p;
}
const setPrice = async (p, v) => {
  if (!(await p.getByLabel('Prix de base (€)').first().isVisible().catch(() => false))) { await p.getByRole('button', { name: 'Développé' }).click(); await p.waitForTimeout(1200); }
  await p.getByLabel('Prix de base (€)').fill(v);
};
const setTitle = (p, v) => p.getByRole('textbox', { name: 'Toucher pour modifier' }).first().fill(v);
const save = async (p) => { await p.getByRole('button', { name: /^Enregistrer$/i }).last().click(); await p.waitForTimeout(3500); };
const lastToast = async (p) => (await toasts(p)).filter((x) => x.length > 3).slice(-1)[0] ?? '';

// (1)
const b = await openCard();
const a = await openCard();
await setPrice(a, '7777');
await save(a);
const afterA = row();
await setTitle(b, `Titre B ${stamp}`);
await save(b);
const msg = await b.getByText(/enregistrée ailleurs/).first().textContent({ timeout: 4000 }).catch(() => '');
const afterB = row();
res(afterA.startsWith('7777') && afterB === afterA && /enregistrée ailleurs/.test(msg), 'B (opened first) is refused after A saved; A\'s price kept',
  `start « ${start} » → A « ${afterA} » → B « ${afterB} »; B says « ${msg.trim().slice(0, 90)}… »`);
await shot(b, 'tt1-b-refused');
// (2)
for (const v of ['7001', '7002', '7003']) { await setPrice(a, v); await save(a); }
res(row().startsWith('7003') && !(await a.getByText(/enregistrée ailleurs/).count()), 'the same card saves three times in a row', `${row()}; last toast « ${await lastToast(a)} »`);
// (3)
await b.close();
const b2 = await openCard();
await setTitle(b2, `Titre B2 ${stamp}`);
await save(b2);
res(row() === `7003 | Titre B2 ${stamp}`, 'B reopened saves (the latest price kept)', row());
// (4)
psql(`update "Oeuvres" set "Prix"=2500, "Titre"='Œuvre test ${W}' where "OeuvreID"=${W}`);
const before = psql(`select count(*) from pending_changes where oeuvre_id=${W} and status='pending'`);
const t = await openCard('team');
await setPrice(t, '3333');
await save(t);
const pend = psql(`select id from pending_changes where oeuvre_id=${W} and status='pending' order by id desc limit 1`);
res(pend && Number(psql(`select count(*) from pending_changes where oeuvre_id=${W} and status='pending'`)) === Number(before) + 1 && row().startsWith('2500'),
  'team member\'s card edit becomes a proposal (work unchanged)', `pending #${pend}, work « ${row()} », toast « ${await lastToast(t)} »`);
const appr = await call('approvePendingChange', [Number(pend)], { page: '/atelier/audit' });
res(appr.ok && row().startsWith('3333'), 'admin approval applies it', `${JSON.stringify(appr.result).slice(0, 120)}; work « ${row()} »`);
console.log('page errors', JSON.stringify([...a.errs, ...b2.errs, ...t.errs]));
psql(`update "Oeuvres" set "Prix"=2500, "Titre"='Œuvre test ${W}' where "OeuvreID"=${W}`);
// (5)
{
  const a5 = await signedIn('admin');
  await go(a5, '/atelier/inventory');
  await a5.waitForTimeout(3000);
  const b5 = await openCard();
  await setPrice(b5, '5555');
  await save(b5);
  const afterB5 = row();
  await a5.getByPlaceholder(/Rechercher/).first().fill(String(W));
  await a5.waitForTimeout(1500);
  await a5.getByText(`Œuvre test ${W}`).first().click();
  await a5.getByText(`#${W}`).first().waitFor({ timeout: 20000 });
  await a5.waitForTimeout(3000);
  await setTitle(a5, `Titre A5 ${stamp}`);
  await save(a5);
  const msg5 = await a5.getByText(/enregistrée ailleurs/).first().textContent({ timeout: 4000 }).catch(() => '');
  res(afterB5.startsWith('5555') && row() === afterB5 && /enregistrée ailleurs/.test(msg5), 'P1: card opened from a list loaded before B saved is refused, B’s price kept', `B « ${afterB5} » → after A « ${row()} »`);
  await shot(a5, 'tt5-list-before');
  await a5.close(); await b5.close();
}
// (6)
{
  const c6 = await openCard();
  psql(`update "Oeuvres" set deleted_at=now() where "OeuvreID"=${W}`);
  await setTitle(c6, `Titre C6 ${stamp}`);
  await save(c6);
  const msg6 = await c6.getByText(/corbeille depuis/).first().textContent({ timeout: 4000 }).catch(() => '');
  psql(`update "Oeuvres" set deleted_at=null where "OeuvreID"=${W}`);
  res(/corbeille/.test(msg6) && !row().includes('C6'), 'P6: binned while open → « mise à la corbeille »', msg6.trim().slice(0, 80));
  await c6.close();
}
// (7)
{
  const before7 = psql(`select edited_at from "Oeuvres" where "OeuvreID"=${W}`);
  const ver = psql(`select id from oeuvre_versions where oeuvre_id=${W} order by id limit 1`);
  const r7 = await call('restoreOeuvreVersion', [Number(ver)], { page: '/atelier/audit' });
  const after7 = psql(`select edited_at > now() - interval '1 minute' from "Oeuvres" where "OeuvreID"=${W}`);
  res(r7.ok && after7 === 't', 'version restore stamps now', `${before7} → fresh ${after7}; ${r7.error ?? ''}`);
}
psql(`update "Oeuvres" set "Prix"=2500, "Titre"='Œuvre test ${W}' where "OeuvreID"=${W}`);
await browser.close();
