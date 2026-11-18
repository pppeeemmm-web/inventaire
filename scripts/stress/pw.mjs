// Small Playwright helpers for the click-through scripts (LOCAL copy only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BASE } from './actions.mjs';
import { USERS } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.join(here, 'dump', 'click');
fs.mkdirSync(SHOTS, { recursive: true });
export const browser = await chromium.launch();

export async function signedIn(who = 'admin', vw = 1280, vh = 800) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: vw < 768, hasTouch: vw < 768 });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => page.errs.push('PAGEERROR ' + String(e.message).slice(0, 200)));
  page.on('dialog', (d) => { page.lastDialog = d.message(); void d.accept(); });
  await page.goto(`${BASE}/login`);
  await page.getByLabel('E-mail').fill(USERS[who].email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(USERS[who].password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/atelier|hub/, { timeout: 60000 });
  return page;
}
export async function go(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
}
export async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}
/** Visible form controls with their label-ish text. */
export function fields(page, scope = 'body') {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    return [...root.querySelectorAll('input, select, textarea, button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
      const lab = e.labels?.[0]?.textContent || e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.textContent || '';
      return `${e.tagName.toLowerCase()}${e.type ? ':' + e.type : ''} «${lab.trim().replace(/\s+/g, ' ').slice(0, 50)}»${e.value && e.tagName !== 'BUTTON' ? ' =' + String(e.value).slice(0, 30) : ''}${e.disabled ? ' [disabled]' : ''}`;
    });
  }, scope);
}
export const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast], li[data-type], .toast, [class*=toast]')].map((t) => t.textContent.trim().replace(/\s+/g, ' ').slice(0, 200)).filter(Boolean));
