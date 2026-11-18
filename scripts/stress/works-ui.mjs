// Works through the real screens on the LOCAL copy:
// (1) « Nouvelle œuvre » (1280): double-click « Enregistrer » → how many works; a photo picked in the form arrives;
// (2) same at 375 with a phone photo (the form's own downscale);
// (3) two tabs on the same work card: tab A saves a price, then tab B (opened before) saves a title → is A's price kept?
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { signedIn, go, shot, toasts, browser, SHOTS } from './pw.mjs';
import { psql } from './seed.mjs';

const res = (ok, label, detail = '') => console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
const stamp = Date.now().toString(36);
const jpg = path.join(SHOTS, `photo-${stamp}.jpg`);
await sharp({ create: { width: 3000, height: 2200, channels: 3, background: { r: 180, g: 90, b: 60 } } }).jpeg({ quality: 92 }).toFile(jpg);

async function newWork(vw, vh, title) {
  const page = await signedIn('admin', vw, vh);
  await go(page, '/atelier/works/new');
  const t = page.locator('input[name=titre]'); if (await t.count()) await t.first().fill(title); else await page.getByLabel('Titre', { exact: true }).first().fill(title);
  const file = page.locator('input[type=file]').first();
  if (await file.count()) await file.setInputFiles(jpg);
  await page.waitForTimeout(1500);
  const save = vw < 768 ? page.getByRole('button', { name: /Créer l’œuvre/i }).last() : page.getByRole('button', { name: /^Enregistrer$/i }).last();
  await save.dblclick();
  await page.waitForTimeout(12000);
  const rows = psql(`select string_agg("OeuvreID"::text, ',') from "Oeuvres" where "Titre"='${title}'`);
  const ids = rows ? rows.split(',') : [];
  const imgs = ids.length ? psql(`select count(*) from "tblImage" where "OeuvreID" in (${ids.join(',')})`) : '0';
  const cover = ids.length ? psql(`select coalesce("txtImageNameLink",'(none)') from "Oeuvres" where "OeuvreID"=${ids[0]}`) : '';
  res(ids.length === 1, `${vw}px « Nouvelle œuvre » double-click → one work`, `works ${ids.join(',') || 'none'}, url ${page.url().replace(/^https?:\/\/[^/]+/, '')}`);
  res(imgs === '1' && cover !== '(none)', `${vw}px photo picked in the form arrives as the cover`, `images ${imgs}, cover ${cover}`);
  console.log('   toasts', JSON.stringify((await toasts(page)).slice(-2)), 'dialog', page.lastDialog ?? '-', 'errors', JSON.stringify(page.errs));
  await shot(page, `w-new-${vw}`);
  await page.context().close();
  return ids;
}

// await newWork(375, 812, `Essai phone ${stamp}`);

// (3)
{
  const W = psql(`select "OeuvreID" from "Oeuvres" where "statusId"=2 and deleted_at is null order by "OeuvreID" desc offset 5 limit 1`);
  const p0 = psql(`select coalesce("Prix"::text,'-')||' / '||"Titre" from "Oeuvres" where "OeuvreID"=${W}`);
  const a = await signedIn('admin');
  const b = await signedIn('admin');
  // B keeps an older copy of the card: open it first, then A.
  for (const p of [b, a]) {
    await go(p, `/atelier/inventory?work=${W}`);
    await p.getByText(`#${W}`).first().waitFor({ timeout: 20000 });
    await p.waitForTimeout(3000);
  }
  // A: change the price (« Développé » shows it)
  await a.getByRole('button', { name: 'Développé' }).click();
  await a.waitForTimeout(1200);
  await a.getByLabel('Prix de base (€)').fill('7777');
  await a.getByRole('button', { name: /^Enregistrer$/i }).last().click();
  await a.waitForTimeout(4000);
  const p1 = psql(`select coalesce("Prix"::text,'-')||' / '||"Titre" from "Oeuvres" where "OeuvreID"=${W}`);
  // B (opened before A saved): change the title
  const titleBox = b.getByRole('textbox', { name: 'Toucher pour modifier' }).first(); const bClean = await b.getByText('aucune modification').first().isVisible().catch(() => false); console.log('   B footer « aucune modification » before its edit:', bClean);
  await titleBox.fill(`Titre B ${stamp}`).catch((e) => console.log('title field:', e.message.slice(0, 80)));
  await b.getByRole('button', { name: /^Enregistrer$/i }).last().click();
  await b.waitForTimeout(4000);
  const p2 = psql(`select coalesce("Prix"::text,'-')||' / '||"Titre" from "Oeuvres" where "OeuvreID"=${W}`);
  res(p2.startsWith('7777'), `two tabs on #${W}: A's price survives B's later save`, `start « ${p0} » → after A « ${p1} » → after B « ${p2} »; B toasts ${JSON.stringify((await toasts(b)).slice(-1))}`);
  await shot(b, 'w-two-tabs-b');
  console.log('   errors', JSON.stringify([...a.errs, ...b.errs]));
}
await browser.close();
