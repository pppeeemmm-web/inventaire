// The work card on the LOCAL copy, opened before the shell's contact list arrives (QR link `?work=`, ⌘K) and from
// Inventory: owner / custodian named, the pickers offer the whole list, and a work Pem holds — or a Confié work out
// at a framer, or an archive work — opens clean (no « unsaved » on close).
import { chromium } from 'playwright';
import { BASE } from './actions.mjs';
import { USERS } from './seed.mjs';
const UNSAVED = 'Modifications non enregistrées';
const browser = await chromium.launch();
async function signedIn(user, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-mail').fill(USERS[user].email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(USERS[user].password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/atelier|hub/, { timeout: 60000 });
  return page;
}
const shows = async (page, text, ms = 15000) => page.getByText(text).first().waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
// Contact pickers in the card: the largest <select> whose options look like contacts.
const pickerSize = (page) => page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('select')].map((s) => [...s.options].filter((o) => /Collector|Galerie|Pem|Fournisseur/.test(o.text)).length)));
async function closeClean(page) {
  await page.waitForTimeout(6000); // contacts hydrate, stage effects run
  const footer = await page.getByText('aucune modification').first().isVisible().catch(() => false);
  await page.getByRole('button', { name: 'Fermer' }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const dialog = await page.getByText(UNSAVED).first().isVisible().catch(() => false);
  return { footer, dialog };
}
const desk = { width: 1280, height: 800 }; const phone = { width: 375, height: 812 };
const named = [
  ['QR link, admin, 1280', 'admin', desk, '/atelier/works/1199', 'Noa Collector14'],
  ['QR link, admin, phone 375', 'admin', phone, '/atelier/works/1160', 'Noa Collector09'],
  ['QR link, team, 1280', 'team', desk, '/atelier/works/1150', 'Sam Collector17'],
  ['Inventory (reference)', 'admin', desk, '/atelier/inventory?work=1181', 'Alex Collector15'],
];
for (const [name, user, vp, path, owner] of named) {
  const page = await signedIn(user, vp);
  await page.goto(`${BASE}${path}`);
  const ok = await shows(page, owner);
  await page.waitForTimeout(3000);
  const picker = await pickerSize(page);
  await page.screenshot({ path: `scripts/stress/dump/todo4-shots/card-${name.replace(/\W+/g, '-')}.png` });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: « ${owner} » shown ${ok}; largest contact picker ${picker} names`);
  await page.context().close();
}
{
  const page = await signedIn('admin', desk);
  await page.goto(`${BASE}/atelier/overview`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Ouvrir la palette de commandes/ }).click();
  await page.waitForTimeout(800);
  await page.keyboard.type('Œuvre test 1181');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Enter');
  const ok = await shows(page, 'Alex Collector15');
  await page.screenshot({ path: 'scripts/stress/dump/todo4-shots/card-cmdk-overview.png' });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ⌘K on Vue d'ensemble (#1181): « Alex Collector15 » shown ${ok}`);
  await page.context().close();
}
for (const [name, path, custodian] of [
  ['artist work Pem holds (#1197)', '/atelier/works/1197', null],
  ['Confié out at Galerie Test A (#1196)', '/atelier/works/1196', 'Galerie Test A'],
  ['archive work (#4)', '/atelier/works/4', null],
]) {
  const page = await signedIn('admin', desk);
  await page.goto(`${BASE}${path}`);
  await shows(page, 'Propriété');
  const cust = custodian ? await shows(page, custodian, 8000) : null;
  const { footer, dialog } = await closeClean(page);
  await page.screenshot({ path: `scripts/stress/dump/todo4-shots/clean-${name.replace(/\W+/g, '-')}.png` });
  console.log(`${!dialog && footer ? 'ok  ' : 'FAIL'} ${name}: « aucune modification » ${footer}, unsaved dialog on close ${dialog}${custodian ? `, custodian « ${custodian} » shown ${cust}` : ''}`);
  await page.context().close();
}
await browser.close();
