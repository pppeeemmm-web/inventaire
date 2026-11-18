// UI pass on the stress copy: each tab as admin (or team) at 1280 px and 375 px.
// Records: time to the tab's data (network idle, no « Chargement » left), DOM size, horizontal scroll at 375,
// tap targets under 44 px, console errors; screenshots in dump/shots/.
// Usage: node scripts/stress/ui.mjs [user] [route ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { BASE } from './actions.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(here, 'dump', 'shots');
fs.mkdirSync(shots, { recursive: true });
const [user = 'admin', ...routesArg] = process.argv.slice(2);
const routes = routesArg.length ? routesArg : ['/hub', '/atelier/overview', '/atelier/inventory', '/atelier/production', '/atelier/sales', '/atelier/logistics', '/atelier/exhibitions', '/atelier/audit', '/atelier/journal'];
const state = JSON.parse(fs.readFileSync(path.join(here, 'dump', `auth-${user}.json`), 'utf8'));

const browser = await chromium.launch();
const out = [];
for (const [label, viewport, mobile] of [['desktop', { width: 1280, height: 860 }, false], ['phone', { width: 375, height: 812 }, true]]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await ctx.addCookies(state.cookies.map((c) => ({ ...c, domain: 'localhost', path: '/' })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message.slice(0, 160)}`));
  for (const r of routes) {
    errors.length = 0;
    const t = performance.now();
    let status = 0;
    try {
      const res = await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      status = res?.status() ?? 0;
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
      await page.waitForFunction(() => !/Chargement|Loading/i.test(document.body.innerText.slice(0, 4000)), null, { timeout: 30_000 }).catch(() => {});
    } catch (e) { status = e.name; }
    const ms = Math.round(performance.now() - t);
    const m = await page.evaluate(() => {
      const se = document.scrollingElement;
      const small = [...document.querySelectorAll('button, a[href], [role=button], input, select')].filter((el) => {
        const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && b.top < innerHeight * 3 && (b.height < 44 && b.width < 44);
      }).length;
      const clipped = [...document.querySelectorAll('button, input, select')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); }).length;
      return { dom: document.getElementsByTagName('*').length, hscroll: se.scrollWidth > innerWidth + 1 ? se.scrollWidth - innerWidth : 0, smallTargets: small, clipped, textLen: document.body.innerText.length };
    }).catch(() => ({}));
    const file = `${label}-${r.replace(/\//g, '_').replace(/^_/, '')}.png`;
    await page.screenshot({ path: path.join(shots, file), fullPage: false }).catch(() => {});
    const rec = { user, label, route: r, status, ms, ...m, errors: [...new Set(errors)].slice(0, 5), shot: file };
    out.push(rec);
    console.log(`${label.padEnd(7)} ${r.padEnd(24)} ${String(status).padEnd(4)} ${String(ms).padStart(6)} ms  dom ${String(m.dom).padStart(6)}  hscroll ${m.hscroll ?? '?'}  small ${m.smallTargets ?? '?'}  clipped ${m.clipped ?? '?'}  errors ${rec.errors.length}`);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(here, 'dump', `ui-${user}.json`), JSON.stringify(out, null, 1));
