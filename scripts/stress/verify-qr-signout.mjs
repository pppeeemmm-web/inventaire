// Verify on the LOCAL copy: (1) the label QR link /atelier/works/<id> ends on a page that opens the work;
// (2) « Se déconnecter » in one browser leaves the same user's other session signed in.
import { chromium } from 'playwright';
import { BASE, call, cookiesFor } from './actions.mjs';
import { USERS } from './seed.mjs';

// (1) redirect chain as admin
const cookie = await cookiesFor('admin');
let url = `${BASE}/atelier/works/1199`; const chain = [];
for (let i = 0; i < 5; i++) {
  const r = await fetch(url, { headers: { Cookie: cookie }, redirect: 'manual' });
  chain.push(`${r.status} ${new URL(url).pathname}${new URL(url).search}`);
  const loc = r.headers.get('location'); if (!loc || r.status < 300 || r.status >= 400) break;
  url = new URL(loc, url).href;
}
console.log('QR chain:', chain.join(' → '));

// (2) session A = the cached admin cookie; session B = a new browser signed in as the same admin, which signs out
const before = await call('fetchWorkOrders', [], { user: 'admin' });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.getByLabel('E-mail').fill(USERS.admin.email);
await page.getByLabel('Mot de passe', { exact: true }).fill(USERS.admin.password);
await page.getByRole('button', { name: 'Se connecter' }).click();
await page.waitForURL(/atelier|hub/, { timeout: 60000 });
await page.goto(`${BASE}/atelier/overview`);
await page.getByTestId('account-sign-out').first().click();
await page.waitForURL(/\/login/, { timeout: 60000 });
const bAfter = await page.goto(`${BASE}/atelier/overview`).then(() => page.url());
await browser.close();
const after = await call('fetchWorkOrders', [], { user: 'admin' });
console.log('session A before:', before.ok ? `ok (${before.result.orders.length} orders)` : before.error);
console.log('session B after sign-out opens:', bAfter.replace(BASE, ''));
console.log('session A after B signed out:', after.ok ? `still signed in (${after.result.orders.length} orders)` : `SIGNED OUT: ${after.error}`);
