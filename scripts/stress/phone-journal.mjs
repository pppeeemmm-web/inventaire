// Phone « Aujourd'hui » / « Écrire » / Journal on the LOCAL copy, 375 px, as admin then team.
// (1) Écrire with « #1189 #99999 » + double tap → one entry, linked to #1189 only, on today;
// (2) Écrire from a past day (‹) → entry dated that day;
// (3) a 25 000-character text → what is kept, and does the phone say so;
// (4) the entry shows on the phone day and in the desktop Journal;
// (5) ☰ search « #1189 » opens the work;
// (6) « Plus tard » / « Écrire à ce sujet » on « À revoir aujourd'hui ».
import { signedIn, go, shot, toasts, browser } from './pw.mjs';
import { psql } from './seed.mjs';
import { BASE } from './actions.mjs';

const stamp = Date.now().toString(36);
const entries = (tag) => psql(`select e.id||' '||e.event_on||' '||length(e.body)||' links:'||coalesce((select string_agg(coalesce(l.oeuvre_id::text,'c'),',') from journal_entry_link l where l.entry_id=e.id),'') from journal_entry e where e.body like '%${tag}%' order by e.id`);
const res = (ok, label, detail = '') => console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
const paris = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

for (const who of ['admin', 'team']) {
  console.log(`\n== ${who}`);
  const page = await signedIn(who, 375, 812);
  await go(page, '/hub');
  // (1)
  const tag1 = `T1-${who}-${stamp}`;
  await page.getByTestId('phone-bar-write').click();
  await page.getByTestId('day-write-body').fill(`Essai ${tag1} sur #1189 et #99999`);
  await page.getByTestId('day-write-save').dblclick();
  await page.waitForTimeout(3000);
  const e1 = entries(tag1).split('\n').filter(Boolean);
  res(e1.length === 1 && e1[0].includes(paris()) && /links:1189$/.test(e1[0]), 'Écrire + double tap → one entry today linked to #1189', e1.join(' | '));
  const sheetGone = !(await page.getByTestId('day-write-sheet').count());
  const onDay = await page.getByText(tag1).first().isVisible().catch(() => false);
  res(sheetGone && onDay, 'sheet closes and the entry shows on the day', `sheet closed ${sheetGone}, on page ${onDay}`);
  // (2)
  await page.getByRole('button', { name: '‹' }).first().click().catch(() => page.locator('a,button').filter({ hasText: '‹' }).first().click());
  await page.waitForTimeout(2500);
  const urlDay = new URL(page.url()).searchParams.get('day');
  const tag2 = `T2-${who}-${stamp}`;
  await page.getByTestId('phone-bar-write').click();
  await page.getByTestId('day-write-body').fill(`Hier ${tag2}`);
  await page.getByTestId('day-write-save').click();
  await page.waitForTimeout(3000);
  const e2 = entries(tag2);
  res(urlDay && e2.includes(urlDay), 'Écrire from the previous day is dated that day', `url day ${urlDay}, entry ${e2}`);
  // (3)
  const tag3 = `T3-${who}-${stamp}`;
  await go(page, '/hub');
  await page.getByTestId('phone-bar-write').click();
  const long = `${tag3} ` + 'x'.repeat(25000);
  await page.getByTestId('day-write-body').fill(long);
  await page.getByTestId('day-write-save').click();
  await page.waitForTimeout(3000);
  const e3 = entries(tag3);
  const t3 = await toasts(page);
  res(false, 'a 25 000-character text (information)', `typed ${long.length}, saved ${e3.split(' ')[2] ?? '—'} chars, toasts ${JSON.stringify(t3.slice(-2))}`);
  // (4)
  await go(page, '/atelier/journal');
  const inJournal = await page.getByText(tag1).first().isVisible({ timeout: 8000 }).catch(() => false);
  res(inJournal, 'the entry is in the Journal at 375', '');
  await shot(page, `pj-${who}-journal`);
  // (5)
  await go(page, '/hub');
  await page.getByRole('button', { name: /menu/i }).first().click().catch(() => page.locator('button').first().click());
  await page.waitForTimeout(800);
  const search = page.locator('input[placeholder*="#"]').first();
  if (await search.count()) {
    await search.fill('#1189');
    await search.press('Enter');
    await page.waitForTimeout(4000);
    const opened = /work=1189|works\/1189/.test(page.url()) || (await page.getByText('#1189').first().isVisible().catch(() => false));
    res(opened, '☰ search « #1189 » opens the work', page.url().replace(BASE, ''));
    await shot(page, `pj-${who}-search`);
  } else res(false, '☰ search field not found');
  // (6)
  await go(page, '/hub');
  const later = page.getByRole('button', { name: 'Plus tard' }).first();
  if (await later.count()) {
    const card = await page.getByText(/À revoir aujourd/i).first().locator('xpath=..').innerText().catch(() => '');
    await later.click();
    await page.waitForTimeout(2500);
    const after = await page.getByText(/À revoir aujourd/i).first().locator('xpath=..').innerText().catch(() => '(section gone)');
    res(card !== after, '« Plus tard » takes the work off « À revoir »', `${card.replace(/\s+/g, ' ').slice(0, 80)} → ${after.replace(/\s+/g, ' ').slice(0, 80)}`);
  } else console.log('skip « Plus tard » (no work to review)');
  console.log('page errors:', page.errs);
  await page.context().close();
}
await browser.close();
