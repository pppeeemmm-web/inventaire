// Work card contacts on the LOCAL copy, opened by the QR link (before the shell's contacts arrive):
// (1) a reserved work owned in the data by someone else than Pem (#32, made with the holder check off) opens clean;
// (2) a contact made with « + » stays in the card's list after « Annuler »;
// (3) a contact renamed in the pop-up keeps its new name after the shell's list arrives.
import { chromium } from 'playwright';
import { BASE } from './actions.mjs';
import { USERS, psql } from './seed.mjs';
const UNSAVED = 'Modifications non enregistrées';
const browser = await chromium.launch();
async function signedIn() {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-mail').fill(USERS.admin.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(USERS.admin.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/atelier|hub/, { timeout: 60000 });
  return page;
}
const optionsWith = (page, text) => page.evaluate((t) => [...document.querySelectorAll('select')].some((s) => [...s.options].some((o) => o.text.includes(t))), text);

// (1)
{
  const page = await signedIn();
  await page.goto(`${BASE}/atelier/works/32`);
  await page.getByText('#32').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(6000);
  const footer = await page.getByText('aucune modification').first().isVisible().catch(() => false);
  await page.getByRole('button', { name: 'Fermer' }).first().click();
  await page.waitForTimeout(1200);
  const dialog = await page.getByText(UNSAVED).first().isVisible().catch(() => false);
  console.log(`${footer && !dialog ? 'ok  ' : 'FAIL'} reserved #32 (owner 124 in the data) via QR: « aucune modification » ${footer}, unsaved dialog on close ${dialog}`);
  await page.context().close();
}
// (2)
{
  const page = await signedIn();
  await page.goto(`${BASE}/atelier/works/32`);
  await page.getByText('#32').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.getByTestId('work-card-buyer').locator('button').first().hover();
  await page.waitForTimeout(1200);
  await page.locator('#wc-contact-hovercard button:not([aria-disabled="true"])').last().click().catch((e) => console.log('hovercard:', e.message.slice(0, 60)));
  await page.waitForTimeout(800);
  const plus = page.locator('button[aria-label="Nouveau contact"]').first();
  if (!(await plus.count())) { console.log('SKIP « + » not shown on #32'); }
  else {
    await plus.click();
    await page.waitForTimeout(800);
    const modal = page.locator('div').filter({ has: page.getByText('Nouveau contact', { exact: false }) }).filter({ has: page.locator('input') }).last();
    const ins = modal.locator('input');
    await ins.nth(1).fill('Essai');
    await ins.nth(2).fill('Plus-Copie');
    await modal.locator('button.primary').last().click();
    await page.waitForTimeout(2500);
    const before = await optionsWith(page, 'Essai Plus-Copie');
    await page.getByRole('button', { name: /^Annuler$/i }).last().click();
    await page.waitForTimeout(2500);
    const after = await optionsWith(page, 'Essai Plus-Copie');
    console.log(`${before && after ? 'ok  ' : 'FAIL'} « + » contact « Essai Plus-Copie »: in the card's pickers after create ${before}, after « Annuler » ${after}`);
  }
  await page.context().close();
}
// (3)
{
  const id = 124;
  const old = psql(`select "Nom" from public."Contact" where "ContactID" = ${id}`);
  const page = await signedIn();
  await page.goto(`${BASE}/atelier/works/32`);
  await page.getByText('#32').first().waitFor({ timeout: 20000 });
  const t0 = Date.now();
  await page.getByTestId('work-drawer-open-contact').first().click();
  const modal = page.getByTestId('contact-quick-modal');
  await modal.waitFor({ timeout: 10000 });
  await page.waitForFunction((v) => [...document.querySelectorAll('[data-testid=contact-quick-modal] input')].some((i) => i.value === v), old, { timeout: 15000 }).catch(() => {});
  const done = await page.evaluate((v) => {
    const i = [...document.querySelectorAll('[data-testid=contact-quick-modal] input')].find((x) => x.value === v);
    if (!i) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v + '-Renamed');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, old);
  await modal.getByRole('button', { name: /^Enregistrer$/ }).click();
  await page.waitForTimeout(8000);
  const shown = await page.getByText(`${old}-Renamed`).first().isVisible().catch(() => false);
  console.log(`${shown ? 'ok  ' : 'FAIL'} rename in the pop-up ${Date.now() - t0 < 99999 ? '' : ''}(${done ? 'field found' : 'Nom field NOT found'}): new name « ${old}-Renamed » shown on the card 8 s later ${shown}`);
  psql(`update public."Contact" set "Nom" = '${old}' where "ContactID" = ${id}`);
  await page.context().close();
}
await browser.close();
