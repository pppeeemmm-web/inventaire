// The card's contact list after a QR-link open (LOCAL copy): « Don… » on #1197 opens the order form fed by the card's
// list; searching « Collector » there shows how many contacts the card holds (Inventory open as the reference).
import { chromium } from 'playwright';
import { BASE } from './actions.mjs';
import { USERS, psql } from './seed.mjs';
const inDb = Number(psql(`select count(*) from public."Contact" where coalesce("Nom",'') ilike '%Collector%'`));
const browser = await chromium.launch();
for (const path of ['/atelier/works/1197', '/atelier/inventory?work=1197']) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-mail').fill(USERS.admin.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(USERS.admin.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/atelier|hub/, { timeout: 60000 });
  await page.goto(`${BASE}${path}`);
  await page.getByText('Propriété').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.getByText('Don…', { exact: true }).first().click();
  const box = page.getByPlaceholder('Chercher un contact…');
  await box.waitFor({ timeout: 10000 });
  const found = [];
  for (const name of ['Noa Collector25', 'Galerie Test A', 'Fournisseur Test 1', 'Alex Collector04']) {
    await box.fill(name);
    await page.waitForTimeout(1200);
    const dialog = page.locator('div').filter({ hasText: /^Nouvelle commande/ }).last();
    found.push(`${name}: ${(await page.getByText(name, { exact: true }).count()) > 0}`);
  }
  console.log(`${path} → gift form finds ${found.join(' · ')} (form shows at most 8 matches; « Collector » contacts in DB: ${inDb})`);
  await page.screenshot({ path: `scripts/stress/dump/todo4-shots/picker-${path.replace(/\W+/g, '-')}.png` });
  await page.context().close();
}
await browser.close();
