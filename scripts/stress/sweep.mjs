// Page sweep on the LOCAL copy: each route as admin / team at 1280 and 375 px. Logs per page: time to network idle,
// console errors, page errors, failed requests (>= 400, not the dev map tiles), sideways scroll, controls past the
// right edge, buttons < 44 px tall at 375 (phone). Screenshot per page in dump/sweep/. Usage:
//   node scripts/stress/sweep.mjs [admin|team] [filter]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BASE } from './actions.mjs';
import { USERS } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'dump', 'sweep');
fs.mkdirSync(out, { recursive: true });
const who = process.argv[2] || 'admin';
const filter = process.argv[3] || '';
const today = new Date().toISOString().slice(0, 10);
const ROUTES = [
  '/atelier/contacts', '/atelier/sales', '/atelier/sale/new', '/atelier/journal', '/atelier/notes', '/atelier/ai',
  '/atelier/field-inbox', '/atelier/session/new', '/atelier/capture?mode=card', '/atelier/triage', '/atelier/share-triage',
  '/atelier/scan', '/atelier/documents/new', '/atelier/issue/new', '/atelier/works/new',
  '/hub', `/hub?day=${today}`, '/hub/today', '/hub/fil',
].filter((r) => r.includes(filter));

const browser = await chromium.launch();
const rows = [];
for (const [vw, vh] of [[1280, 800], [375, 812]]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: vw < 768, hasTouch: vw < 768 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-mail').fill(USERS[who].email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(USERS[who].password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/atelier|hub/, { timeout: 60000 });
  for (const route of ROUTES) {
    const errs = [], fails = [];
    const onConsole = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); };
    const onPageErr = (e) => errs.push('PAGEERROR ' + String(e.message).slice(0, 160));
    const onResp = (r) => { if (r.status() >= 400 && !/tile\.openstreetmap|favicon/.test(r.url())) fails.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 90)}`); };
    page.on('console', onConsole); page.on('pageerror', onPageErr); page.on('response', onResp);
    const t0 = Date.now();
    let status = 0, finalUrl = '';
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
      status = res?.status() ?? 0;
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => errs.push('networkidle timeout'));
      await page.waitForTimeout(800);
      finalUrl = page.url().replace(BASE, '');
    } catch (e) { errs.push('GOTO ' + e.message.slice(0, 120)); }
    const ms = Date.now() - t0;
    const lay = await page.evaluate((phone) => {
      const W = document.documentElement.clientWidth;
      const sideways = document.documentElement.scrollWidth > W + 1;
      const past = [];
      const small = [];
      for (const el of document.querySelectorAll('button, a, input, select, textarea, [role=button]')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') continue;
        // ignore things inside a horizontally scrolling box (intended)
        let p = el.parentElement, inScroller = false;
        while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) { inScroller = true; break; } p = p.parentElement; }
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
        if (!inScroller && r.right > W + 1 && r.top < 3000) past.push(`${label}@${Math.round(r.right)}`);
        if (phone && !inScroller && r.height < 44 && r.width < 44 && el.tagName !== 'INPUT' && r.top < 3000 && r.top >= 0) small.push(`${label}(${Math.round(r.width)}x${Math.round(r.height)})`);
      }
      return { sideways, past: past.slice(0, 8), small: small.slice(0, 12), smallN: small.length, h1: (document.querySelector('h1,h2')?.textContent || '').trim().slice(0, 50) };
    }, vw < 768).catch(() => ({}));
    const shot = `${who}-${vw}-${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}.png`;
    await page.screenshot({ path: path.join(out, shot), fullPage: false }).catch(() => {});
    rows.push({ who, vw, route, status, finalUrl, ms, errs: [...new Set(errs)].slice(0, 6), fails: [...new Set(fails)].slice(0, 6), ...lay, shot });
    page.off('console', onConsole); page.off('pageerror', onPageErr); page.off('response', onResp);
    const r = rows.at(-1);
    console.log(`${vw} ${route} → ${r.finalUrl} ${r.status} ${ms}ms h=«${r.h1}» side=${r.sideways} past=${(r.past || []).length} small=${r.smallN ?? '-'} errs=${r.errs.length} fails=${r.fails.length}`);
    for (const e of r.errs) console.log('   err ', e);
    for (const f of r.fails) console.log('   fail', f);
    if (r.past?.length) console.log('   past', r.past.join(' | '));
    if (r.small?.length) console.log('   small', r.small.join(' | '));
  }
  await ctx.close();
}
fs.writeFileSync(path.join(out, `sweep-${who}.json`), JSON.stringify(rows, null, 1));
await browser.close();
