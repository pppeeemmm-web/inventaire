import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * R1 step 6 slice 4b — work notes as lines (work card), the Fil on Overview (admin), the team
 * « Pour vous ». Only the note-line / Fil Server Actions are intercepted, by their ids read from the
 * dev build's manifest; every other Atelier call passes through (reads only). Nothing is written,
 * flagged or discarded in the database (the dev DB is production). Runs against `npm run dev`.
 * The Overview Fil test needs an admin session (Pem's account); it skips itself otherwise.
 */
test.describe('Note lines + Overview Fil (R1 step 6 slice 4b)', () => {
  test.skip(!process.env.ATELIER_E2E, 'Set ATELIER_E2E=1 with a logged-in app session to run atelier E2E.')

  const reply = (value: unknown) => `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`

  /** Server Action id of an export, from the dev manifest (compiled once the page has loaded it). */
  function actionId(name: string): string | null {
    const raw = decodeURIComponent(fs.readFileSync(path.join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8'))
    const m = raw.match(new RegExp(`"id":"([0-9a-f]+)","exportedName":"${name}"`))
    return m ? m[1] : null
  }

  /** Answer the named actions with fake data; record their arguments. Other actions pass through. */
  async function mock(page: Page, answers: Record<string, (args: unknown[]) => unknown>): Promise<Array<{ name: string; args: unknown[] }>> {
    const calls: Array<{ name: string; args: unknown[] }> = []
    await page.route('**/*', async (route: Route) => {
      const req = route.request()
      const id = req.headers()['next-action']
      if (req.method() !== 'POST' || !id) return route.continue()
      const name = Object.keys(answers).find((n) => actionId(n) === id)
      if (!name) return route.continue()
      const args = JSON.parse(req.postData() || '[]') as unknown[]
      calls.push({ name, args })
      return route.fulfill({ status: 200, contentType: 'text/x-component', body: reply(answers[name](args)) })
    })
    return calls
  }

  test('work card (375 px): lines oldest first, discarded marked, team nudge flags the new line', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const lines = [
      { id: 901, body: 'E2E first line', author: 'Test A', createdAt: '2026-11-10T10:00:00Z', flagged: false, discarded: false, mine: false },
      { id: 902, body: 'E2E taken out', author: 'Test B', createdAt: '2026-11-12T10:00:00Z', flagged: true, discarded: true, mine: true },
    ]
    const calls = await mock(page, {
      listWorkNoteLines: () => ({ lines }),
      addWorkNoteLine: (args) => ({
        ok: true,
        line: { id: 903, body: String(args[1]), author: 'Moi', createdAt: '2026-11-17T10:00:00Z', flagged: args[2] === true, discarded: false, mine: true },
      }),
    })
    await page.goto('/atelier/inventory?work=2357')
    await page.getByTestId('work-card-creation').getByRole('button').first().click({ timeout: 60_000 })
    const box = page.getByTestId('work-note-lines')
    await expect(box.getByTestId('work-note-line')).toHaveCount(2, { timeout: 30_000 })
    await expect(box.getByTestId('work-note-line').first()).toContainText('E2E first line')
    await expect(box.getByTestId('work-note-line').nth(1)).toContainText(/retirée du Fil|taken out of the feed/)

    const input = page.getByTestId('work-note-line-input')
    await input.fill('E2E short')
    await expect(page.getByTestId('work-note-line-flag')).toHaveCount(0)
    await input.fill('E2E long line\nsecond line of text')
    const nudge = page.getByTestId('work-note-line-flag')
    const admin = (await nudge.count()) === 0
    if (!admin) await nudge.locator('input').check()
    await page.getByTestId('work-note-line-add').click()
    await expect(box.getByTestId('work-note-line')).toHaveCount(3)
    const add = calls.find((c) => c.name === 'addWorkNoteLine')
    expect(add?.args).toEqual([2357, 'E2E long line\nsecond line of text', !admin])

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(scroll).toBeLessThanOrEqual(0)
  })

  test('team « Pour vous » on Overview: own lines, standing or taken out with the date', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mock(page, {
      listMyNoteLines: () => ({
        lines: [
          { id: 1, kind: 'work', body: 'E2E standing line', createdAt: '2026-11-16T10:00:00Z', flagged: true, discardedAt: null, work: { id: 2357, title: 'E2E work' }, idea: null },
          { id: 2, kind: 'proposal', body: 'E2E proposal out', createdAt: '2026-11-14T10:00:00Z', flagged: false, discardedAt: '2026-11-15T10:00:00Z', work: null, idea: null },
        ],
      }),
    })
    await page.goto('/atelier/overview')
    await page.waitForSelector('[data-testid=overview-mine], [data-testid=overview-fil]', { timeout: 60_000 })
    test.skip(await page.getByTestId('overview-fil').isVisible(), 'Admin session: the team view is not shown.')
    const mine = page.getByTestId('overview-mine')
    await expect(mine.locator('[data-state=standing]')).toContainText('E2E standing line')
    await expect(mine.locator('[data-state=discarded]')).toContainText(/Retirée par Pem le|Taken out by Pem on/)
    await expect(page.getByTestId('overview-mine-out')).toBeVisible()
    // Side rail: every panel starts folded.
    await expect(page.getByTestId('overview-panel-fold-reminders')).toHaveAttribute('aria-expanded', 'false')
  })

  test('admin Overview: the Fil column, ← discards with 6 s undo, → keeps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const recent = new Date(Date.now() - 86_400_000).toISOString()
    const base = { title: null, body: '', work: null, flagged: false, cooled: false }
    const calls = await mock(page, {
      listFil: () => ({
        items: [
          { ...base, key: 'note_line:e2e-1', kind: 'note_line', id: 'e2e-1', section: 'creation', author: 'Test A', at: recent, body: 'E2E flagged line', work: { id: 2357, title: 'E2E work', thumb: null }, lineKind: 'work', flagged: true },
          { ...base, key: 'pending_change:e2e-2', kind: 'pending_change', id: 'e2e-2', section: 'fiches', author: 'Test B', at: recent, work: { id: 1316, title: null, thumb: null }, changes: [{ key: 'titre', before: 'Old', after: 'New' }], changeKind: 'edit' },
        ],
      }),
      decideFil: () => ({ ok: true }),
    })
    await page.goto('/atelier/overview')
    await page.waitForSelector('[data-testid=overview-mine], [data-testid=overview-fil]', { timeout: 60_000 })
    test.skip(await page.getByTestId('overview-mine').isVisible(), 'Needs an admin session (Pem).')
    const fil = page.getByTestId('overview-fil')
    await expect(page.getByTestId('overview-fil-count')).toHaveText('2', { timeout: 30_000 })
    await expect(page.getByTestId('overview-fil-section-creation')).toContainText('E2E flagged line')

    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('overview-fil-count')).toHaveText('1')
    await page.getByRole('button', { name: /Annuler|Undo/ }).click()
    await expect(page.getByTestId('overview-fil-count')).toHaveText('2')
    await page.waitForTimeout(6_500)
    expect(calls.filter((c) => c.name === 'decideFil')).toEqual([])

    await fil.getByTestId('overview-fil-row-pending_change').getByTestId('overview-fil-keep').click()
    await expect.poll(() => calls.filter((c) => c.name === 'decideFil').length, { timeout: 10_000 }).toBe(1)
    expect(calls.find((c) => c.name === 'decideFil')?.args).toEqual(['pending_change', 'e2e-2', 'keep'])
  })
})
